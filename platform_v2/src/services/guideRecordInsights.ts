import { readFileSync } from "node:fs";
import { meshKey100m } from "./observationEventEffort.js";

export type GuideRecordInsightFeature = {
  type?: string;
  name?: string;
  confidence?: number;
  note?: string;
};

export type GuideRecordInsightRow = {
  guide_record_id: string;
  session_id: string;
  lat: number | null;
  lng: number | null;
  scene_summary: string | null;
  detected_species: string[] | null;
  detected_features: GuideRecordInsightFeature[] | null;
  created_at: string;
  captured_at: string | null;
  returned_at: string | null;
  delivery_state: string | null;
  seen_state: string | null;
  environment_context: string | null;
  seasonal_note: string | null;
  primary_subject: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
};

export type CanonicalTaxon = {
  canonicalName: string;
  rank: "species" | "genus" | "family" | "lifeform" | "unknown";
  sourceNames: string[];
};

type CanonicalRank = CanonicalTaxon["rank"];
type CanonicalFeatureType = "species" | "vegetation" | "landform" | "structure" | "sound";

export type GuideRecordBundle = {
  bundleId: string;
  sessionId: string;
  representative: GuideRecordInsightRow;
  records: GuideRecordInsightRow[];
  recordCount: number;
  startAt: string;
  endAt: string;
  durationSec: number;
  canonicalTaxa: CanonicalTaxon[];
  features: GuideRecordInsightFeature[];
  meshKey: string | null;
  regionalHypothesisId?: string;
  regionalHypothesisClaimType?: string;
  nextSamplingProtocol?: string;
};

type GuideCanonicalizationSeed = {
  version: string;
  taxonAliases: Array<{ canonicalName: string; rank: CanonicalRank; aliases: string[] }>;
  featureAliases: Array<{ canonicalName: string; type: CanonicalFeatureType; aliases: string[] }>;
  nonBiologicalSpeciesAliases: string[];
};

const FALLBACK_SEED: GuideCanonicalizationSeed = {
  version: "fallback",
  taxonAliases: [
    { canonicalName: "イネ科草本", rank: "family", aliases: ["イネ科", "イネ科の草", "イネ科の草本", "イネ科植物", "イネ科草本", "イネ科草本類", "芝生"] },
    { canonicalName: "タンポポ属", rank: "genus", aliases: ["タンポポ", "タンポポ属", "タンポポ類"] },
    { canonicalName: "ベニカナメモチ", rank: "species", aliases: ["レッドロビン", "レッドロビン（ベニカナメモチ）", "ベニカナメモチ", "カナメモチ"] },
  ],
  featureAliases: [
    { canonicalName: "看板・ロゴ", type: "structure", aliases: ["看板", "ロゴ", "文字"] },
    { canonicalName: "車両", type: "structure", aliases: ["車", "自動車", "車両"] },
  ],
  nonBiologicalSpeciesAliases: ["スズキ", "SUZUKI", "Suzuki", "ENEOS", "ATM"],
};

let cachedSeed: GuideCanonicalizationSeed | null = null;

function loadSeed(): GuideCanonicalizationSeed {
  if (cachedSeed) return cachedSeed;
  const candidates = [
    new URL("../content/guide_canonicalization.seed.json", import.meta.url),
    new URL("../../src/content/guide_canonicalization.seed.json", import.meta.url),
  ];
  for (const url of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(url, "utf-8")) as GuideCanonicalizationSeed;
      if (parsed && Array.isArray(parsed.taxonAliases) && Array.isArray(parsed.featureAliases)) {
        cachedSeed = parsed;
        return parsed;
      }
    } catch {
      // Build output resolves the first path; tsx tests resolve the second path.
    }
  }
  cachedSeed = FALLBACK_SEED;
  return FALLBACK_SEED;
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, "")
    .replace(/[()]/g, (ch) => ch === "(" ? "（" : "）")
    .trim();
}

function inferRank(name: string): CanonicalTaxon["rank"] {
  if (!name) return "unknown";
  if (/科$/u.test(name)) return "family";
  if (/属$/u.test(name)) return "genus";
  if (/類|草本|植栽|植物|街路樹|雑草|草地/u.test(name)) return "lifeform";
  return "species";
}

export function canonicalizeTaxonName(raw: string): Omit<CanonicalTaxon, "sourceNames"> | null {
  const name = cleanName(raw);
  if (!name) return null;
  for (const alias of loadSeed().taxonAliases) {
    if (alias.aliases.map(cleanName).includes(name)) {
      return { canonicalName: alias.canonicalName, rank: alias.rank };
    }
  }
  return { canonicalName: name, rank: inferRank(name) };
}

export function canonicalizeGuideFeature(feature: GuideRecordInsightFeature): GuideRecordInsightFeature {
  const type = String(feature.type ?? "");
  const name = cleanName(String(feature.name ?? ""));
  if (!name) return feature;
  for (const alias of loadSeed().featureAliases) {
    if (alias.aliases.map(cleanName).includes(name)) {
      const note = alias.canonicalName === feature.name ? feature.note : [feature.note, `canonical: ${feature.name}`].filter(Boolean).join(" / ");
      return { ...feature, type: alias.type, name: alias.canonicalName, note };
    }
  }
  return feature;
}

export function isLikelyGuideNonBiologicalName(name: string): boolean {
  const cleaned = cleanName(name);
  if (!cleaned) return true;
  return loadSeed().nonBiologicalSpeciesAliases.map(cleanName).includes(cleaned)
    || /看板|標識|ロゴ|文字|車両|自動車|店舗|道路|ATM|ENEOS/u.test(cleaned);
}

export function canonicalizeTaxonList(rawNames: readonly string[]): CanonicalTaxon[] {
  const map = new Map<string, CanonicalTaxon>();
  for (const rawName of rawNames) {
    if (isLikelyGuideNonBiologicalName(String(rawName ?? ""))) continue;
    const canonical = canonicalizeTaxonName(String(rawName ?? ""));
    if (!canonical) continue;
    const existing = map.get(canonical.canonicalName);
    if (existing) {
      if (!existing.sourceNames.includes(rawName)) existing.sourceNames.push(rawName);
    } else {
      map.set(canonical.canonicalName, { ...canonical, sourceNames: [rawName] });
    }
  }
  return Array.from(map.values()).slice(0, 24);
}

export function canonicalizeSpeciesFeatures(features: readonly GuideRecordInsightFeature[]): GuideRecordInsightFeature[] {
  return features.map((feature) => {
    const canonicalFeature = canonicalizeGuideFeature(feature);
    if (canonicalFeature.type !== "species" || typeof canonicalFeature.name !== "string") return canonicalFeature;
    if (isLikelyGuideNonBiologicalName(canonicalFeature.name)) {
      return { ...canonicalFeature, type: "structure", note: canonicalFeature.note ?? "辞書補正: 生きものではなく人工物として扱います" };
    }
    const canonical = canonicalizeTaxonName(canonicalFeature.name);
    if (!canonical || canonical.canonicalName === canonicalFeature.name) return canonicalFeature;
    const note = [canonicalFeature.note, `canonical: ${canonicalFeature.name}`].filter(Boolean).join(" / ");
    return { ...canonicalFeature, name: canonical.canonicalName, note };
  });
}

function rowTimeMs(row: GuideRecordInsightRow): number {
  const raw = row.captured_at ?? row.created_at;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function bundleFeatureKey(row: GuideRecordInsightRow): string {
  const names = (row.detected_features ?? [])
    .filter((feature) => ["species", "vegetation", "landform"].includes(String(feature.type ?? "")))
    .map((feature) => cleanName(String(feature.name ?? "")))
    .filter(Boolean)
    .slice(0, 4);
  if (names.length > 0) return names.join("|");
  return cleanName(row.environment_context ?? row.scene_summary ?? "");
}

function similarity(a: GuideRecordInsightRow, b: GuideRecordInsightRow): number {
  const aSet = new Set(bundleFeatureKey(a).split("|").filter(Boolean));
  const bSet = new Set(bundleFeatureKey(b).split("|").filter(Boolean));
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let overlap = 0;
  for (const item of aSet) if (bSet.has(item)) overlap += 1;
  return overlap / Math.max(aSet.size, bSet.size);
}

function representativeScore(row: GuideRecordInsightRow): number {
  const speciesCount = (row.detected_species ?? []).filter(Boolean).length;
  const features = row.detected_features ?? [];
  const biologicalFeatureCount = features.filter((feature) => feature.type === "species" || feature.type === "vegetation").length;
  const envScore = row.environment_context ? 2 : 0;
  const summaryScore = row.scene_summary ? Math.min(3, row.scene_summary.length / 80) : 0;
  return speciesCount * 2 + biologicalFeatureCount + envScore + summaryScore;
}

function mergeFeatures(rows: GuideRecordInsightRow[]): GuideRecordInsightFeature[] {
  const map = new Map<string, GuideRecordInsightFeature>();
  for (const row of rows) {
    for (const feature of canonicalizeSpeciesFeatures(row.detected_features ?? [])) {
      const type = String(feature.type ?? "unknown");
      const name = String(feature.name ?? "").trim();
      if (!name) continue;
      const key = `${type}:${name}`;
      const existing = map.get(key);
      const currentConfidence = typeof feature.confidence === "number" ? feature.confidence : 0;
      const existingConfidence = typeof existing?.confidence === "number" ? existing.confidence : 0;
      if (!existing || currentConfidence > existingConfidence) map.set(key, feature);
    }
  }
  return Array.from(map.values()).slice(0, 16);
}

function buildBundle(rows: GuideRecordInsightRow[], index: number): GuideRecordBundle {
  const sorted = rows.slice().sort((a, b) => rowTimeMs(a) - rowTimeMs(b));
  const first = sorted[0];
  if (!first) throw new Error("buildBundle requires at least one guide record");
  const representative = sorted.slice().sort((a, b) => representativeScore(b) - representativeScore(a))[0] ?? first;
  const last = sorted[sorted.length - 1] ?? first;
  const startMs = rowTimeMs(first);
  const endMs = rowTimeMs(last);
  const allSpecies = sorted.flatMap((row) => row.detected_species ?? []);
  const lat = representative?.lat;
  const lng = representative?.lng;
  const meshKey = lat != null && lng != null ? meshKey100m(lat, lng) : null;
  return {
    bundleId: `${representative.session_id}:${Math.floor(startMs / 30_000)}:${index}`,
    sessionId: representative.session_id,
    representative,
    records: sorted,
    recordCount: sorted.length,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    durationSec: Math.max(0, Math.round((endMs - startMs) / 1000)),
    canonicalTaxa: canonicalizeTaxonList(allSpecies),
    features: mergeFeatures(sorted),
    meshKey,
  };
}

export function bundleGuideRecords(rows: readonly GuideRecordInsightRow[], windowMs = 30_000): GuideRecordBundle[] {
  const bySession = new Map<string, GuideRecordInsightRow[]>();
  for (const row of rows) {
    const list = bySession.get(row.session_id) ?? [];
    list.push(row);
    bySession.set(row.session_id, list);
  }
  const bundles: GuideRecordBundle[] = [];
  for (const [sessionId, sessionRows] of bySession) {
    const sorted = sessionRows.slice().sort((a, b) => rowTimeMs(a) - rowTimeMs(b));
    let current: GuideRecordInsightRow[] = [];
    for (const row of sorted) {
      const first = current[0];
      const prev = current[current.length - 1];
      const closeEnough = !first || rowTimeMs(row) - rowTimeMs(first) <= windowMs;
      const similarEnough = !prev || similarity(prev, row) >= 0.2 || current.length === 1;
      if (current.length === 0 || (closeEnough && similarEnough)) {
        current.push(row);
      } else {
        bundles.push(buildBundle(current, bundles.length));
        current = [row];
      }
    }
    if (current.length > 0) bundles.push(buildBundle(current, bundles.length));
    void sessionId;
  }
  return bundles.sort((a, b) => rowTimeMs(b.representative) - rowTimeMs(a.representative));
}

export const __test__ = {
  cleanName,
  similarity,
  representativeScore,
};
