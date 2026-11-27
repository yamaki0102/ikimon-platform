import type { Env } from "./core/env";
import { classifyInvasive, invasiveItemInfo, type InvasiveItemInfo } from "./mapInvasive";
import { resolveRecordReaderGroup } from "./recordReaderModes";
import { isWeakTaxonLabel } from "./taxonNameResolver";

export const SPECIES_READER_LAYER_FLAG = "SPECIES_READER_LAYER_ENABLED";

export type SpeciesReaderTab = "child" | "parent" | "teacher";

export type SpeciesReaderAggregateInput = {
  speciesName: string;
  scientificName?: string | null;
  taxonomy?: {
    kingdom?: string | null;
    class?: string | null;
    order?: string | null;
    family?: string | null;
  };
  publicCount: number;
  seasons: string[];
  regions: string[];
};

export type SpeciesReaderGeneratedJson = {
  speciesName: string;
  childText: string;
  parentText: string;
  teacherText: string;
};

export type SpeciesReaderValidationResult = {
  valid: boolean;
  reasons: string[];
};

export type SpeciesReaderLiveStats = {
  publicCount: number;
  seasons: string[];
  regions: string[];
};

export type LoadedSpeciesReaderLayer = {
  speciesKey: string;
  canonicalName: string;
  scientificName: string | null;
  taxonGroup: string;
  invasive: InvasiveItemInfo | null;
  childText: string;
  parentText: string;
  teacherText: string;
  liveStats: SpeciesReaderLiveStats;
};

export const FORBIDDEN_SPECIES_READER_TERMS: readonly RegExp[] = [
  /毒(?:性|草|虫|針|物|が|を|に|は|も|の)?/u,
  /食用/u,
  /食べられ/u,
  /接触/u,
  /(?:さわ|触)(?:る|っ|れ|ら)/u,
  /希少/u,
  /絶滅危惧/u,
  /レッドリスト|レッドデータ/u,
];

const esc = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function normalizeSpeciesReaderKey(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ");
}

function seasonFromIso(observedAt: string | null): string | null {
  if (!observedAt) return null;
  const parsed = Date.parse(observedAt);
  if (!Number.isFinite(parsed)) return null;
  const mText = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }).format(new Date(parsed));
  const m = Number(mText);
  if (m >= 3 && m <= 5) return "春";
  if (m >= 6 && m <= 8) return "夏";
  if (m >= 9 && m <= 11) return "秋";
  if (m === 12 || m === 1 || m === 2) return "冬";
  return null;
}

function regionLabelFromCell(cell: string | null | undefined): string | null {
  const clean = (cell ?? "").trim();
  if (!clean || clean === "private") return null;
  if (/hamamatsu|浜松/i.test(clean)) return "浜松地域";
  if (/kakegawa|掛川/i.test(clean)) return "掛川地域";
  if (/iwata|磐田/i.test(clean)) return "磐田地域";
  if (/shizuoka|静岡/i.test(clean)) return "静岡地域";
  return clean.length <= 24 ? clean : null;
}

export function buildSpeciesReaderGenerationPrompt(input: SpeciesReaderAggregateInput): string {
  const speciesName = normalizeSpeciesReaderKey(input.speciesName);
  const invasive = invasiveItemInfo(speciesName);
  const seasons = input.seasons.length > 0 ? input.seasons.join("・") : "通年未集計";
  const regions = input.regions.length > 0 ? input.regions.join("・") : "地域集計待ち";
  const taxParts = [
    input.taxonomy?.kingdom ? `界:${input.taxonomy.kingdom}` : null,
    input.taxonomy?.class ? `綱:${input.taxonomy.class}` : null,
    input.taxonomy?.order ? `目:${input.taxonomy.order}` : null,
    input.taxonomy?.family ? `科:${input.taxonomy.family}` : null,
  ].filter(Boolean);

  return [
    "あなたは自然観察プラットフォームZUKANの種解説作成補助です。以下の確定情報のみを根拠に、1回の応答で3つの読み方（こども／おや／せんせい）を作成してください。",
    "【厳守事項】",
    "- 入力にない生態・分布・事実を断定しないこと。",
    "- 次の話題や語句を絶対に含めないこと：毒・有毒・食用・食べられる・接触・触る・希少・絶滅危惧・レッドリスト。",
    "- 件数・季節・地域の数値を本文に埋め込む場合は必ず {{count}}・{{seasons}}・{{regions}} のプレースホルダを使うこと（生数字を書かない）。",
    "- 各読み方は100〜180字程度で簡潔にまとめ、合計約1,000トークン以内に収めること。",
    "【入力情報】",
    `種名: ${speciesName}`,
    input.scientificName ? `学名: ${input.scientificName}` : null,
    taxParts.length > 0 ? `分類: ${taxParts.join(" / ")}` : null,
    `外来種区分: ${invasive ? `${invasive.label}（${invasive.legalNote}）` : "該当なし"}`,
    `公開記録集計: ${input.publicCount}件 / 季節: ${seasons} / 地域: ${regions}`,
    'JSONのみ出力: {"speciesName":"<入力と同じ種名>","childText":"...","parentText":"...","teacherText":"..."}',
  ].filter(Boolean).join("\n");
}

export function validateSpeciesReaderOutput(input: {
  expectedSpecies: string;
  output: Partial<SpeciesReaderGeneratedJson> | null | undefined;
}): SpeciesReaderValidationResult {
  const reasons: string[] = [];
  const expectedKey = normalizeSpeciesReaderKey(input.expectedSpecies);
  if (!expectedKey || isWeakTaxonLabel(expectedKey)) {
    reasons.push("unconfirmed_or_weak_species");
  }
  const actualKey = normalizeSpeciesReaderKey(input.output?.speciesName);
  if (!actualKey || actualKey !== expectedKey) {
    reasons.push("species_name_mismatch");
  }

  const fields = [
    ["childText", input.output?.childText],
    ["parentText", input.output?.parentText],
    ["teacherText", input.output?.teacherText],
  ] as const;

  for (const [name, raw] of fields) {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) {
      reasons.push(`${name}_empty`);
      continue;
    }
    if (text.length > 500) {
      reasons.push(`${name}_too_long`);
    }
    for (const pattern of FORBIDDEN_SPECIES_READER_TERMS) {
      if (pattern.test(text)) {
        reasons.push(`forbidden_term:${name}:${pattern.source}`);
      }
    }
  }

  return { valid: reasons.length === 0, reasons };
}

export function spliceSpeciesReaderLiveStats(template: string, stats: SpeciesReaderLiveStats): string {
  const countStr = String(Math.max(0, stats.publicCount));
  const seasonsStr = stats.seasons.length > 0 ? stats.seasons.join("・") : "記録集計中";
  const regionsStr = stats.regions.length > 0 ? stats.regions.join("・") : "記録地域";
  return template
    .replaceAll("{{count}}", countStr)
    .replaceAll("{{seasons}}", seasonsStr)
    .replaceAll("{{regions}}", regionsStr);
}

async function queryLiveSpeciesAggregate(db: Env["OBS_DB"], canonicalName: string): Promise<SpeciesReaderLiveStats> {
  const rows = (await db.prepare(
    `SELECT observed_at, public_cell
       FROM observations
      WHERE taxon_label = ?
        AND visibility = 'public'
      LIMIT 1000`
  ).bind(canonicalName).all<{ observed_at: string | null; public_cell: string | null }>()).results;

  const seasons = new Set<string>();
  const regions = new Set<string>();
  for (const row of rows) {
    const season = seasonFromIso(row.observed_at);
    if (season) seasons.add(season);
    const region = regionLabelFromCell(row.public_cell);
    if (region) regions.add(region);
  }
  const seasonOrder = ["春", "夏", "秋", "冬"];
  return {
    publicCount: rows.length,
    seasons: [...seasons].sort((a, b) => seasonOrder.indexOf(a) - seasonOrder.indexOf(b)),
    regions: [...regions],
  };
}

type StoredLayerRow = {
  species_key: string;
  canonical_name: string;
  scientific_name: string | null;
  taxon_group: string;
  invasive_category: string | null;
  child_text: string;
  parent_text: string;
  teacher_text: string;
  review_status: string;
};

function hydrateApprovedRow(
  row: StoredLayerRow,
  expectedSpecies: string,
  liveStats: SpeciesReaderLiveStats
): LoadedSpeciesReaderLayer | null {
  if (row.review_status !== "approved") return null;
  const validation = validateSpeciesReaderOutput({
    expectedSpecies,
    output: {
      speciesName: row.canonical_name,
      childText: row.child_text,
      parentText: row.parent_text,
      teacherText: row.teacher_text,
    },
  });
  if (!validation.valid) return null;

  return {
    speciesKey: row.species_key,
    canonicalName: row.canonical_name,
    scientificName: row.scientific_name,
    taxonGroup: row.taxon_group || resolveRecordReaderGroup({ taxonName: row.canonical_name }),
    invasive: invasiveItemInfo(row.canonical_name),
    childText: spliceSpeciesReaderLiveStats(row.child_text, liveStats),
    parentText: spliceSpeciesReaderLiveStats(row.parent_text, liveStats),
    teacherText: spliceSpeciesReaderLiveStats(row.teacher_text, liveStats),
    liveStats,
  };
}

export async function loadSpeciesReaderLayerForRecord(
  db: Env["OBS_DB"],
  confirmedSpeciesName: string | null | undefined
): Promise<LoadedSpeciesReaderLayer | null> {
  const key = normalizeSpeciesReaderKey(confirmedSpeciesName);
  if (!key || isWeakTaxonLabel(key)) return null;

  const row = await db.prepare(
    `SELECT species_key, canonical_name, scientific_name, taxon_group, invasive_category,
            child_text, parent_text, teacher_text, review_status
       FROM species_reader_layers
      WHERE species_key = ?
        AND review_status = 'approved'
      LIMIT 1`
  ).bind(key).first<StoredLayerRow>().catch(() => null);
  if (!row) return null;

  const stats = await queryLiveSpeciesAggregate(db, row.canonical_name).catch(() => ({
    publicCount: 0,
    seasons: [],
    regions: [],
  }));
  return hydrateApprovedRow(row, key, stats);
}

export async function loadSpeciesReaderLayersForPlace(
  db: Env["OBS_DB"],
  confirmedSpeciesNames: readonly string[]
): Promise<LoadedSpeciesReaderLayer[]> {
  const uniqueKeys: string[] = [];
  const seen = new Set<string>();
  for (const name of confirmedSpeciesNames) {
    const key = normalizeSpeciesReaderKey(name);
    if (!key || isWeakTaxonLabel(key) || seen.has(key)) continue;
    seen.add(key);
    uniqueKeys.push(key);
    if (uniqueKeys.length >= 6) break;
  }
  const results: LoadedSpeciesReaderLayer[] = [];
  for (const key of uniqueKeys) {
    const loaded = await loadSpeciesReaderLayerForRecord(db, key);
    if (loaded) results.push(loaded);
  }
  return results;
}

export function renderSpeciesReaderLayerHtml(options: {
  enabled: boolean;
  layer: LoadedSpeciesReaderLayer | null | undefined;
  initialMode?: SpeciesReaderTab;
}): string {
  if (!options.enabled || !options.layer) return "";
  const layer = options.layer;
  const mode: SpeciesReaderTab =
    options.initialMode === "parent" || options.initialMode === "teacher" ? options.initialMode : "child";
  const statsSummary = [
    `公開記録 ${layer.liveStats.publicCount}件`,
    layer.liveStats.seasons.length > 0 ? `季節: ${layer.liveStats.seasons.join("・")}` : null,
    layer.liveStats.regions.length > 0 ? `地域: ${layer.liveStats.regions.join("・")}` : null,
  ].filter(Boolean).join(" ／ ");
  const invasiveBadge = layer.invasive
    ? `<span class="srl-badge">${esc(layer.invasive.label)}（${esc(layer.invasive.legalNote)}）</span>`
    : "";

  return `<section class="of-reader-modes" data-species-reader-layer data-species-key="${esc(layer.speciesKey)}" aria-label="${esc(layer.canonicalName)}の読み方別解説">
  <div class="of-rm-tabs" role="tablist" aria-label="読み方">
    <button type="button" role="tab" class="of-rm-tab${mode === "child" ? " is-active" : ""}" data-reader-mode-tab="child" aria-selected="${mode === "child" ? "true" : "false"}">こども</button>
    <button type="button" role="tab" class="of-rm-tab${mode === "parent" ? " is-active" : ""}" data-reader-mode-tab="parent" aria-selected="${mode === "parent" ? "true" : "false"}">おや</button>
    <button type="button" role="tab" class="of-rm-tab${mode === "teacher" ? " is-active" : ""}" data-reader-mode-tab="teacher" aria-selected="${mode === "teacher" ? "true" : "false"}">せんせい</button>
  </div>
  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
    <h3 class="of-rm-name">${esc(layer.canonicalName)}</h3>
    ${invasiveBadge}
  </div>
  <p class="of-rm-copy" data-reader-mode-panel="child"${mode === "child" ? "" : " hidden"}>${esc(layer.childText)}</p>
  <p class="of-rm-copy" data-reader-mode-panel="parent"${mode === "parent" ? "" : " hidden"}>${esc(layer.parentText)}</p>
  <p class="of-rm-copy" data-reader-mode-panel="teacher"${mode === "teacher" ? "" : " hidden"}>${esc(layer.teacherText)}</p>
  <p style="margin:0;font-size:14px;color:#485a4e" data-species-live-stats>${esc(statsSummary)}</p>
</section>`;
}

export function renderPlaceSpeciesReaderLayersHtml(options: {
  enabled: boolean;
  layers: readonly LoadedSpeciesReaderLayer[];
}): string {
  if (!options.enabled || options.layers.length === 0) return "";
  const cards = options.layers
    .map((layer) => renderSpeciesReaderLayerHtml({ enabled: true, layer }))
    .filter(Boolean)
    .join("");
  if (!cards) return "";
  return `<section class="srl-place-sec" data-place-species-reader-layers aria-labelledby="srl-place-title">
  <style>
    .srl-place-sec{margin:24px auto 0;max-width:1120px;display:grid;gap:12px}
    .srl-place-title{margin:0;font-size:19px;font-weight:800;color:#17211B}
    .of-reader-modes{padding:16px;border:1px solid #d5e2d8;border-radius:16px;background:#f8fbf8;display:grid;gap:10px}
    .of-rm-tabs{display:inline-flex;gap:4px;padding:3px;border-radius:999px;background:#e6efe8;justify-self:start}
    .of-rm-tab{min-height:44px;padding:0 16px;border:0;border-radius:999px;background:transparent;color:#33473c;font:inherit;font-size:14px;font-weight:800;cursor:pointer}
    .of-rm-tab.is-active{background:#143F2E;color:#fff}
    .of-rm-name{margin:0;font-size:16px;font-weight:800;color:#17211B}
    .of-rm-copy{margin:0;font-size:15px;line-height:1.75;color:#17211B;font-weight:600}
    .srl-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:14px;font-weight:700}
  </style>
  <h2 id="srl-place-title" class="srl-place-title">この場所で見つかる種の解説</h2>
  ${cards}
  <script>(()=>{document.querySelectorAll('[data-species-reader-layer]').forEach((root)=>{const tabs=[...root.querySelectorAll('[data-reader-mode-tab]')];const panels=[...root.querySelectorAll('[data-reader-mode-panel]')];const setMode=(next)=>{tabs.forEach((tab)=>{const active=tab.getAttribute('data-reader-mode-tab')===next;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',active?'true':'false');});panels.forEach((panel)=>{panel.hidden=panel.getAttribute('data-reader-mode-panel')!==next;});};tabs.forEach((tab)=>tab.addEventListener('click',()=>setMode(tab.getAttribute('data-reader-mode-tab')||'child')));});})();</script>
</section>`;
}

export function invasiveCategoryForSpecies(name: string): string | null {
  return classifyInvasive(name)?.category ?? null;
}
