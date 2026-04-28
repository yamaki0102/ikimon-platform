import { assertNoSecretLeak } from "../services/curatorTrustBoundary.js";
import { CURATOR_DEEPSEEK_MODEL, CURATOR_DEFAULT_MODEL } from "../services/aiModelPricing.js";
import { generateCuratorJsonWithRetry, type CuratorModelProvider } from "../services/curatorGeminiWorker.js";

export type BakeoffFixtureKind = "invasive-law" | "redlist" | "paper-research" | "satellite-update";

export type BakeoffFixture = {
  id: string;
  kind: BakeoffFixtureKind;
  systemPrompt: string;
  userText: string;
  responseJsonSchema: unknown;
  expectedFields: Record<string, string | number | boolean>;
  enumFields?: Record<string, string[]>;
  uniqueFields?: string[];
};

export type FixtureScore = {
  fixtureId: string;
  provider: CuratorModelProvider;
  model: string;
  schemaValid: boolean;
  fieldAccuracyPct: number;
  criticalFailures: string[];
  costUsd: number;
};

export type BakeoffAggregate = {
  provider: CuratorModelProvider;
  model: string;
  fixtureCount: number;
  criticalFailureCount: number;
  schemaValidRatePct: number;
  fieldAccuracyPct: number;
  averageCostUsd: number;
};

export type BakeoffWinner = {
  winner: CuratorModelProvider;
  reason: string;
};

const INVASIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          scientific_name: { type: "string" },
          vernacular_jp: { type: "string" },
          mhlw_category: { type: "string", enum: ["iaspecified", "priority", "industrial", "prevention"] },
          source_excerpt: { type: "string" },
        },
        required: ["scientific_name", "mhlw_category", "source_excerpt"],
      },
    },
  },
  required: ["rows"],
};

const REDLIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          scientific_name: { type: "string" },
          risk_category: { type: "string", enum: ["CR", "EN", "VU", "NT", "LC", "DD"] },
          source_excerpt: { type: "string" },
        },
        required: ["scientific_name", "risk_category", "source_excerpt"],
      },
    },
  },
  required: ["rows"],
};

const PAPER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    papers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          doi: { type: "string" },
          year: { type: "number" },
          species: { type: "string" },
          evidence_type: { type: "string", enum: ["distribution", "phenology", "invasion", "taxonomy"] },
          abstract_excerpt: { type: "string" },
        },
        required: ["title", "year", "species", "evidence_type", "abstract_excerpt"],
      },
    },
  },
  required: ["papers"],
};

const SATELLITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          stac_id: { type: "string" },
          date: { type: "string" },
          change_type: { type: "string", enum: ["landcover", "impervious", "vegetation", "water"] },
          confidence: { type: "number" },
          source_excerpt: { type: "string" },
        },
        required: ["stac_id", "date", "change_type", "confidence", "source_excerpt"],
      },
    },
  },
  required: ["items"],
};

function fixture(id: string, kind: BakeoffFixtureKind, input: Omit<BakeoffFixture, "id" | "kind">): BakeoffFixture {
  return { id, kind, ...input };
}

const INVASIVE_NAMES = [
  ["Procyon lotor", "アライグマ", "iaspecified"],
  ["Linepithema humile", "アルゼンチンアリ", "iaspecified"],
  ["Solenopsis invicta", "ヒアリ", "iaspecified"],
  ["Myocastor coypus", "ヌートリア", "iaspecified"],
  ["Micropterus salmoides", "オオクチバス", "iaspecified"],
  ["Trachemys scripta", "アカミミガメ", "priority"],
  ["Solidago altissima", "セイタカアワダチソウ", "prevention"],
  ["Limnoperna fortunei", "カワヒバリガイ", "iaspecified"],
  ["Eichhornia crassipes", "ホテイアオイ", "industrial"],
  ["Veronica anagallis-aquatica", "オオカワヂシャ", "iaspecified"],
] as const;

const REDLIST_NAMES = [
  ["Nipponia nippon", "CR"],
  ["Grus japonensis", "EN"],
  ["Hynobius tokyoensis", "VU"],
  ["Cypripedium japonicum", "EN"],
  ["Pitta nympha", "VU"],
  ["Luehdorfia japonica", "NT"],
  ["Ciconia boyciana", "CR"],
  ["Gekko hokouensis", "LC"],
  ["Rhinogobius flumineus", "DD"],
  ["Mergus squamatus", "EN"],
] as const;

const PAPER_ROWS = [
  ["Urban pond networks alter dragonfly phenology", "10.1000/ikimon.001", 2022, "Anax parthenope", "phenology"],
  ["Range expansion of fire ant in port districts", "10.1000/ikimon.002", 2024, "Solenopsis invicta", "invasion"],
  ["Citizen records improve winter bird distribution maps", "10.1000/ikimon.003", 2021, "Turdus eunomus", "distribution"],
  ["Taxonomic revision of a Japanese salamander group", "10.1000/ikimon.004", 2023, "Hynobius tokyoensis", "taxonomy"],
  ["Grassland mowing cadence predicts butterfly occupancy", "10.1000/ikimon.005", 2020, "Luehdorfia japonica", "distribution"],
  ["Thermal refugia shape urban cicada emergence", "10.1000/ikimon.006", 2025, "Cryptotympana facialis", "phenology"],
  ["New invasive mussel monitoring using eDNA", "10.1000/ikimon.007", 2024, "Limnoperna fortunei", "invasion"],
  ["Fine-scale habitat maps for stork restoration", "10.1000/ikimon.008", 2022, "Ciconia boyciana", "distribution"],
  ["Revision of Veronica records in riparian parks", "10.1000/ikimon.009", 2021, "Veronica anagallis-aquatica", "taxonomy"],
  ["Early detection of aquarium plant escapes", "10.1000/ikimon.010", 2025, "Eichhornia crassipes", "invasion"],
] as const;

const SATELLITE_ROWS = [
  ["S2A_20260401_HAMAMATSU_01", "2026-04-01", "vegetation", 0.91],
  ["S2B_20260318_TOKYO_02", "2026-03-18", "impervious", 0.88],
  ["LANDSAT_20260211_NAGOYA_03", "2026-02-11", "landcover", 0.84],
  ["S2A_20260122_OSAKA_04", "2026-01-22", "water", 0.87],
  ["S2B_20251210_KOBE_05", "2025-12-10", "vegetation", 0.83],
  ["LANDSAT_20251106_SENDAI_06", "2025-11-06", "impervious", 0.9],
  ["S2A_20251014_NIIGATA_07", "2025-10-14", "landcover", 0.82],
  ["S2B_20250902_FUKUOKA_08", "2025-09-02", "water", 0.86],
  ["LANDSAT_20250819_KUMAMOTO_09", "2025-08-19", "vegetation", 0.89],
  ["S2A_20250730_SAPPORO_10", "2025-07-30", "impervious", 0.85],
] as const;

export const BAKEOFF_FIXTURES: BakeoffFixture[] = [
  ...INVASIVE_NAMES.map(([scientificName, vernacularJp, category], index) => fixture(
    `invasive-law-${String(index + 1).padStart(2, "0")}`,
    "invasive-law",
    {
      systemPrompt: "Extract invasive-law rows as JSON. Use rows[].scientific_name, vernacular_jp, mhlw_category, source_excerpt.",
      userText: `<html><body><table><tr><td>${vernacularJp}</td><td>${scientificName}</td><td>${category}</td></tr></table><p>official source excerpt: ${vernacularJp} ${scientificName} ${category}</p></body></html>`,
      responseJsonSchema: INVASIVE_SCHEMA,
      expectedFields: {
        "rows.0.scientific_name": scientificName,
        "rows.0.vernacular_jp": vernacularJp,
        "rows.0.mhlw_category": category,
      },
      enumFields: { "rows.0.mhlw_category": ["iaspecified", "priority", "industrial", "prevention"] },
      uniqueFields: ["rows:scientific_name"],
    },
  )),
  ...REDLIST_NAMES.map(([scientificName, category], index) => fixture(
    `redlist-${String(index + 1).padStart(2, "0")}`,
    "redlist",
    {
      systemPrompt: "Extract redlist rows as JSON. Use rows[].scientific_name, risk_category, source_excerpt.",
      userText: `Red List sample: species=${scientificName}; category=${category}; excerpt="${scientificName} is listed as ${category} in the sample."`,
      responseJsonSchema: REDLIST_SCHEMA,
      expectedFields: {
        "rows.0.scientific_name": scientificName,
        "rows.0.risk_category": category,
      },
      enumFields: { "rows.0.risk_category": ["CR", "EN", "VU", "NT", "LC", "DD"] },
      uniqueFields: ["rows:scientific_name"],
    },
  )),
  ...PAPER_ROWS.map(([title, doi, year, species, evidenceType], index) => fixture(
    `paper-research-${String(index + 1).padStart(2, "0")}`,
    "paper-research",
    {
      systemPrompt: "Extract paper metadata and abstract signal as JSON. Use papers[].title, doi, year, species, evidence_type, abstract_excerpt.",
      userText: `Title: ${title}\nDOI: ${doi}\nYear: ${year}\nAbstract: This study reports ${evidenceType} evidence for ${species} in citizen-science biodiversity records.`,
      responseJsonSchema: PAPER_SCHEMA,
      expectedFields: {
        "papers.0.title": title,
        "papers.0.doi": doi,
        "papers.0.year": year,
        "papers.0.species": species,
        "papers.0.evidence_type": evidenceType,
      },
      enumFields: { "papers.0.evidence_type": ["distribution", "phenology", "invasion", "taxonomy"] },
      uniqueFields: ["papers:doi"],
    },
  )),
  ...SATELLITE_ROWS.map(([stacId, date, changeType, confidence], index) => fixture(
    `satellite-update-${String(index + 1).padStart(2, "0")}`,
    "satellite-update",
    {
      systemPrompt: "Extract STAC land update items as JSON. Use items[].stac_id, date, change_type, confidence, source_excerpt.",
      userText: JSON.stringify({
        type: "Feature",
        id: stacId,
        properties: { datetime: `${date}T00:00:00Z`, "ikimon:change_type": changeType, "ikimon:confidence": confidence },
      }),
      responseJsonSchema: SATELLITE_SCHEMA,
      expectedFields: {
        "items.0.stac_id": stacId,
        "items.0.date": date,
        "items.0.change_type": changeType,
        "items.0.confidence": confidence,
      },
      enumFields: { "items.0.change_type": ["landcover", "impervious", "vegetation", "water"] },
      uniqueFields: ["items:stac_id"],
    },
  )),
];

function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number.parseInt(part, 10);
      return Number.isFinite(index) ? current[index] : undefined;
    }
    if (typeof current === "object") {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, value);
}

function comparable(value: unknown): string {
  if (typeof value === "number") return Number(value.toFixed(4)).toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value ?? "").trim().toLowerCase();
}

function collectSourceExcerptFailures(value: unknown, path = ""): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectSourceExcerptFailures(item, `${path}.${index}`));
  }
  if (typeof value === "object") {
    const failures: string[] = [];
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      if (key.endsWith("excerpt") && typeof child === "string" && child.length > 600) {
        failures.push(`source_excerpt_too_long:${childPath}`);
      }
      failures.push(...collectSourceExcerptFailures(child, childPath));
    }
    return failures;
  }
  return [];
}

function collectDuplicateFailures(value: unknown, uniqueFields: string[] | undefined): string[] {
  if (!uniqueFields) return [];
  const failures: string[] = [];
  for (const rule of uniqueFields) {
    const [arrayPath, key] = rule.split(":");
    if (!arrayPath || !key) continue;
    const rows = readPath(value, arrayPath);
    if (!Array.isArray(rows)) continue;
    const seen = new Set<string>();
    for (const row of rows) {
      const itemKey = comparable(typeof row === "object" && row ? (row as Record<string, unknown>)[key] : undefined);
      if (!itemKey) continue;
      if (seen.has(itemKey)) {
        failures.push(`duplicate_row:${rule}:${itemKey}`);
        break;
      }
      seen.add(itemKey);
    }
  }
  return failures;
}

export function scoreFixtureOutput(input: {
  fixture: BakeoffFixture;
  provider: CuratorModelProvider;
  model: string;
  output: unknown;
  costUsd?: number;
  secrets?: Array<string | undefined | null>;
}): FixtureScore {
  const criticalFailures: string[] = [];
  try {
    assertNoSecretLeak(JSON.stringify(input.output), input.secrets ?? []);
  } catch (error) {
    criticalFailures.push(error instanceof Error ? error.message : "secret_leak");
  }

  criticalFailures.push(...collectSourceExcerptFailures(input.output));
  criticalFailures.push(...collectDuplicateFailures(input.output, input.fixture.uniqueFields));

  let correct = 0;
  let total = 0;
  for (const [path, expected] of Object.entries(input.fixture.expectedFields)) {
    total += 1;
    const actual = readPath(input.output, path);
    if (comparable(actual) === comparable(expected)) {
      correct += 1;
    } else if (typeof actual === "string" && typeof expected === "string" && actual.trim().toLowerCase().includes(expected.trim().toLowerCase())) {
      correct += 1;
    } else if (actual === undefined || actual === null || actual === "") {
      criticalFailures.push(`missing_required:${path}`);
    }
  }

  for (const [path, allowed] of Object.entries(input.fixture.enumFields ?? {})) {
    const actual = readPath(input.output, path);
    if (typeof actual !== "string" || !allowed.includes(actual)) {
      criticalFailures.push(`enum_violation:${path}`);
    }
  }

  return {
    fixtureId: input.fixture.id,
    provider: input.provider,
    model: input.model,
    schemaValid: criticalFailures.length === 0,
    fieldAccuracyPct: total > 0 ? Number(((correct / total) * 100).toFixed(2)) : 0,
    criticalFailures,
    costUsd: input.costUsd ?? 0,
  };
}

export function aggregateScores(provider: CuratorModelProvider, model: string, scores: FixtureScore[]): BakeoffAggregate {
  const fixtureCount = scores.length;
  const criticalFailureCount = scores.reduce((sum, score) => sum + score.criticalFailures.length, 0);
  const schemaValidCount = scores.filter((score) => score.schemaValid).length;
  const fieldAccuracySum = scores.reduce((sum, score) => sum + score.fieldAccuracyPct, 0);
  const costSum = scores.reduce((sum, score) => sum + score.costUsd, 0);
  return {
    provider,
    model,
    fixtureCount,
    criticalFailureCount,
    schemaValidRatePct: fixtureCount > 0 ? Number(((schemaValidCount / fixtureCount) * 100).toFixed(2)) : 0,
    fieldAccuracyPct: fixtureCount > 0 ? Number((fieldAccuracySum / fixtureCount).toFixed(2)) : 0,
    averageCostUsd: fixtureCount > 0 ? Number((costSum / fixtureCount).toFixed(8)) : 0,
  };
}

export function selectBakeoffWinner(gemini: BakeoffAggregate, deepseek: BakeoffAggregate): BakeoffWinner {
  if (gemini.criticalFailureCount >= 1 && deepseek.criticalFailureCount === 0) {
    return { winner: "deepseek", reason: "gemini_critical_failure_deepseek_zero" };
  }
  if (deepseek.fieldAccuracyPct - gemini.fieldAccuracyPct > 5) {
    return { winner: "deepseek", reason: "deepseek_field_accuracy_gt_5pt" };
  }
  const schemaDelta = Math.abs(gemini.schemaValidRatePct - deepseek.schemaValidRatePct);
  const accuracyDelta = Math.abs(gemini.fieldAccuracyPct - deepseek.fieldAccuracyPct);
  if (gemini.criticalFailureCount === 0 && deepseek.criticalFailureCount === 0 && schemaDelta <= 3 && accuracyDelta <= 5) {
    return { winner: "gemini", reason: "no_material_quality_difference_use_default_gemini" };
  }
  return { winner: "gemini", reason: "deepseek_adoption_threshold_not_met" };
}

async function scoreLiveProvider(provider: CuratorModelProvider, fixtureItem: BakeoffFixture): Promise<FixtureScore> {
  const model = provider === "deepseek" ? CURATOR_DEEPSEEK_MODEL : CURATOR_DEFAULT_MODEL;
  try {
    const result = await generateCuratorJsonWithRetry<unknown>({
      provider,
      model,
      curatorName: fixtureItem.kind,
      runId: null,
      systemPrompt: fixtureItem.systemPrompt,
      userText: fixtureItem.userText,
      responseJsonSchema: fixtureItem.responseJsonSchema,
      maxOutputTokens: 2048,
    }, 3);
    return scoreFixtureOutput({
      fixture: fixtureItem,
      provider,
      model,
      output: result.parsed,
      costUsd: result.costUsd,
      secrets: [process.env.GEMINI_API_KEY, process.env.DEEPSEEK_API_KEY],
    });
  } catch (error) {
    return {
      fixtureId: fixtureItem.id,
      provider,
      model,
      schemaValid: false,
      fieldAccuracyPct: 0,
      criticalFailures: [`json_or_api_failure:${error instanceof Error ? error.message : String(error)}`],
      costUsd: 0,
    };
  }
}

export async function runCuratorModelBakeoff(): Promise<{
  gemini: BakeoffAggregate;
  deepseek: BakeoffAggregate;
  winner: BakeoffWinner;
  scores: FixtureScore[];
}> {
  if (process.env.CURATOR_MODEL_BAKEOFF !== "1") {
    throw new Error("CURATOR_MODEL_BAKEOFF=1 is required for live model bakeoff");
  }
  const scores: FixtureScore[] = [];
  for (const fixtureItem of BAKEOFF_FIXTURES) {
    scores.push(await scoreLiveProvider("gemini", fixtureItem));
    scores.push(await scoreLiveProvider("deepseek", fixtureItem));
  }
  const gemini = aggregateScores("gemini", CURATOR_DEFAULT_MODEL, scores.filter((score) => score.provider === "gemini"));
  const deepseek = aggregateScores("deepseek", CURATOR_DEEPSEEK_MODEL, scores.filter((score) => score.provider === "deepseek"));
  return { gemini, deepseek, winner: selectBakeoffWinner(gemini, deepseek), scores };
}

async function main(): Promise<void> {
  const result = await runCuratorModelBakeoff();
  const failures = result.scores
    .filter((score) => score.criticalFailures.length > 0)
    .map((score) => ({
      fixtureId: score.fixtureId,
      provider: score.provider,
      failures: score.criticalFailures.map((failure) => failure.replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-REDACTED")),
    }));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    fixture_count: BAKEOFF_FIXTURES.length,
    gemini: result.gemini,
    deepseek: result.deepseek,
    winner: result.winner,
    failures,
  }, null, 2));
}

function isDirectExecution(): boolean {
  const invoked = process.argv[1]?.replace(/\\/g, "/") ?? "";
  return invoked.endsWith("/curatorModelBakeoff.ts") || invoked.endsWith("/curatorModelBakeoff.js");
}

if (isDirectExecution()) {
  void main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message.replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-REDACTED") : String(error));
    process.exit(1);
  });
}
