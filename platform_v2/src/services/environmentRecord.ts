import type { Landcover, SiteBrief, SiteSignals } from "./siteBrief.js";

export const ENVIRONMENT_RECORD_FIELDS = [
  {
    field: "place_type",
    title: "場所の型",
    label: "場所の型",
    help: "草地、市街地、林内、海岸、湿地など、観察が起きた大きな場を残す。",
    options: [
      { value: "grassland_urban_edge", label: "草地と市街地の縁" },
      { value: "urban", label: "市街地" },
      { value: "woodland", label: "林内" },
      { value: "water_edge", label: "水辺" },
      { value: "wetland", label: "湿地" },
      { value: "coast", label: "海岸" },
      { value: "unknown", label: "不明" },
    ],
  },
  {
    field: "contact_surface",
    title: "接している面",
    label: "接している面",
    help: "対象が触れている・立っている・浮いている面を残す。",
    options: [
      { value: "soil_gravel_litter", label: "土・礫・枯れ草" },
      { value: "soil", label: "土" },
      { value: "plant", label: "植物上" },
      { value: "water", label: "水面・水中" },
      { value: "rock", label: "岩・石" },
      { value: "artificial", label: "人工物" },
      { value: "unknown", label: "不明" },
    ],
  },
  {
    field: "surrounding_cover",
    title: "周辺の被覆",
    label: "周辺の被覆",
    help: "まわりを覆う植物、水、雪、岩、構造物などを残す。",
    options: [
      { value: "low_grass", label: "低い草地" },
      { value: "trees_shrubs", label: "樹木・低木" },
      { value: "bare_ground", label: "裸地" },
      { value: "water", label: "水" },
      { value: "snow", label: "雪" },
      { value: "built_surface", label: "舗装・構造物" },
      { value: "unknown", label: "不明" },
    ],
  },
  {
    field: "environment_condition",
    title: "環境条件",
    label: "環境条件",
    help: "乾湿、明るさ、流れ、深さ、開け方など、その場の状態を残す。",
    options: [
      { value: "open_dry", label: "開けて乾き気味" },
      { value: "sunny", label: "日当たり" },
      { value: "shaded", label: "日陰" },
      { value: "wet", label: "湿り気あり" },
      { value: "flowing", label: "流れあり" },
      { value: "windy", label: "風あり" },
      { value: "unknown", label: "不明" },
    ],
  },
  {
    field: "human_change",
    title: "人為・変化",
    label: "人為・変化",
    help: "草刈り、踏圧、造成、放流、管理、攪乱など、人や時間の影響を残す。",
    options: [
      { value: "trampling_mowing", label: "踏圧・草刈り跡" },
      { value: "mowing", label: "草刈り" },
      { value: "trampling", label: "踏圧" },
      { value: "planting", label: "植栽・管理" },
      { value: "construction", label: "造成・工事" },
      { value: "release", label: "放流・放逐" },
      { value: "none_visible", label: "目立つ変化なし" },
      { value: "unknown", label: "不明" },
    ],
  },
] as const;

export type EnvironmentRecordFieldDefinition = typeof ENVIRONMENT_RECORD_FIELDS[number];
export type EnvironmentRecordField = EnvironmentRecordFieldDefinition["field"];
export type EnvironmentRecordFieldSource = "user" | "derived" | "legacy" | "unknown";

type EnvironmentFieldChoice = {
  value: string;
  confidence: number;
};

type EnvironmentAreaCandidate = {
  label?: unknown;
  why?: unknown;
  confidence?: unknown;
};

type EnvironmentAreaInferenceLike = Partial<Record<
  | "vegetation_structure_candidates"
  | "succession_stage_candidates"
  | "human_influence_candidates"
  | "moisture_regime_candidates"
  | "management_hint_candidates",
  EnvironmentAreaCandidate[]
>>;

const FIELD_SET = new Set<string>(ENVIRONMENT_RECORD_FIELDS.map((item) => item.field));
const SOURCE_VALUES = new Set(["user", "derived", "legacy"]);

function stringRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function copyStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(stringRecord(value))
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== ""),
  );
}

function optionValues(field: EnvironmentRecordField): Set<string> {
  const def = ENVIRONMENT_RECORD_FIELDS.find((item) => item.field === field);
  return new Set(def?.options.map((option) => option.value) ?? []);
}

function normalizeConfidence(value: number): string {
  return Math.max(0, Math.min(1, value)).toFixed(2);
}

function confidenceNumber(value: unknown, fallback = 0.44): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function textFromAreaCandidate(candidate: EnvironmentAreaCandidate): string {
  return `${typeof candidate.label === "string" ? candidate.label : ""} ${typeof candidate.why === "string" ? candidate.why : ""}`.toLowerCase();
}

function bestAreaCandidate(area: EnvironmentAreaInferenceLike | null | undefined, matcher: RegExp): EnvironmentFieldChoice | null {
  if (!area) return null;
  let best: EnvironmentFieldChoice | null = null;
  for (const candidates of Object.values(area)) {
    if (!Array.isArray(candidates)) continue;
    for (const candidate of candidates) {
      const labelText = typeof candidate.label === "string" ? candidate.label.toLowerCase() : "";
      const text = textFromAreaCandidate(candidate);
      if (!matcher.test(labelText) && /証拠は弱い|見えない|読み取れない|不足|不明|unclear|not visible|no evidence/i.test(text)) continue;
      if (!matcher.test(text)) continue;
      const confidence = confidenceNumber(candidate.confidence);
      if (!best || confidence > best.confidence) {
        best = fieldChoice("", confidence);
      }
    }
  }
  return best;
}

function hasCover(covers: Set<Landcover>, ...needles: Landcover[]): boolean {
  return needles.some((cover) => covers.has(cover));
}

function fieldChoice(value: string, confidence: number): EnvironmentFieldChoice {
  return { value, confidence };
}

function placeTypeChoice(signals: SiteSignals): EnvironmentFieldChoice {
  const covers = new Set<Landcover>([...signals.landcover, ...signals.nearbyLandcover]);
  const nearWater = signals.waterDistanceM != null && signals.waterDistanceM <= 80;
  const hasWetland = hasCover(covers, "wetland");
  const hasWater = hasCover(covers, "water");
  const hasTrees = hasCover(covers, "tree_cover", "shrubland");
  const hasBuilt = hasCover(covers, "built_up");
  const hasGrass = hasCover(covers, "grassland", "cropland");
  const hasBare = hasCover(covers, "bare");

  if (hasWetland) return fieldChoice("wetland", 0.58);
  if (hasWater || nearWater) return fieldChoice("water_edge", 0.56);
  if (hasBare && signals.waterDistanceM != null && signals.waterDistanceM <= 160) return fieldChoice("coast", 0.38);
  if (hasTrees && !hasBuilt) return fieldChoice("woodland", 0.5);
  if (hasBuilt && hasGrass) return fieldChoice("grassland_urban_edge", 0.46);
  if (hasBuilt && !hasTrees && !hasGrass) return fieldChoice("urban", 0.48);
  return fieldChoice("unknown", 0);
}

function contactSurfaceChoice(signals: SiteSignals): EnvironmentFieldChoice {
  const covers = new Set<Landcover>([...signals.landcover, ...signals.nearbyLandcover]);
  const waterAtPoint = hasCover(new Set(signals.landcover), "water", "wetland");
  const hasWaterNear = signals.waterDistanceM != null && signals.waterDistanceM <= 20;
  if (waterAtPoint || hasWaterNear) return fieldChoice("water", 0.54);
  if (hasCover(covers, "tree_cover", "shrubland", "grassland", "cropland", "wetland")) return fieldChoice("plant", 0.42);
  if (hasCover(covers, "built_up")) return fieldChoice("artificial", 0.42);
  if (hasCover(covers, "bare")) return fieldChoice("soil_gravel_litter", 0.4);
  return fieldChoice("unknown", 0);
}

function surroundingCoverChoice(signals: SiteSignals): EnvironmentFieldChoice {
  const covers = new Set<Landcover>([...signals.landcover, ...signals.nearbyLandcover]);
  const nearWater = signals.waterDistanceM != null && signals.waterDistanceM <= 80;
  if (hasCover(covers, "water", "wetland") || nearWater) return fieldChoice("water", 0.52);
  if (hasCover(covers, "tree_cover", "shrubland")) return fieldChoice("trees_shrubs", 0.5);
  if (hasCover(covers, "grassland", "cropland")) return fieldChoice("low_grass", 0.44);
  if (hasCover(covers, "built_up")) return fieldChoice("built_surface", 0.44);
  if (hasCover(covers, "bare")) return fieldChoice("bare_ground", 0.42);
  return fieldChoice("unknown", 0);
}

function environmentConditionChoice(signals: SiteSignals): EnvironmentFieldChoice {
  const covers = new Set<Landcover>([...signals.landcover, ...signals.nearbyLandcover]);
  const nearWater = signals.waterDistanceM != null && signals.waterDistanceM <= 80;
  if (hasCover(covers, "wetland", "water") || nearWater) return fieldChoice("wet", 0.52);
  if (hasCover(covers, "tree_cover", "shrubland")) return fieldChoice("shaded", 0.42);
  if (hasCover(covers, "built_up", "bare")) return fieldChoice("open_dry", 0.38);
  return fieldChoice("unknown", 0);
}

function humanChangeChoice(signals: SiteSignals): EnvironmentFieldChoice {
  const covers = new Set<Landcover>([...signals.landcover, ...signals.nearbyLandcover]);
  const hasBuilt = hasCover(covers, "built_up");
  const hasGrass = hasCover(covers, "grassland");
  if (hasBuilt && hasGrass) return fieldChoice("trampling_mowing", 0.4);
  if (hasBuilt) return fieldChoice("trampling", 0.36);
  if (hasCover(covers, "cropland")) return fieldChoice("planting", 0.42);
  return fieldChoice("unknown", 0);
}

function derivedChoices(signals: SiteSignals): Record<EnvironmentRecordField, EnvironmentFieldChoice> {
  return {
    place_type: placeTypeChoice(signals),
    contact_surface: contactSurfaceChoice(signals),
    surrounding_cover: surroundingCoverChoice(signals),
    environment_condition: environmentConditionChoice(signals),
    human_change: humanChangeChoice(signals),
  };
}

function areaChoice(value: string, confidence: number): EnvironmentFieldChoice {
  return fieldChoice(value, Math.max(0.34, Math.min(0.74, confidence)));
}

function areaPlaceTypeChoice(area: EnvironmentAreaInferenceLike): EnvironmentFieldChoice {
  const wetland = bestAreaCandidate(area, /湿地|wetland/u);
  if (wetland) return areaChoice("wetland", wetland.confidence);
  const wet = bestAreaCandidate(area, /湿性|水辺|水際|water|moist|湿り/u);
  if (wet) return areaChoice("water_edge", wet.confidence);
  const woodland = bestAreaCandidate(area, /樹林|林内|樹木|低木|woodland|forest|tree|shrub/u);
  if (woodland) return areaChoice("woodland", woodland.confidence);
  const grass = bestAreaCandidate(area, /草地|草本|芝|低い草|grass|herb|lawn/u);
  const urban = bestAreaCandidate(area, /舗装|道路|市街|建物|人工|urban|built|pavement|road/u);
  if (grass && urban) return areaChoice("grassland_urban_edge", Math.max(grass.confidence, urban.confidence));
  if (grass) return areaChoice("grassland_urban_edge", grass.confidence);
  if (urban) return areaChoice("urban", urban.confidence);
  const coast = bestAreaCandidate(area, /海岸|砂浜|潮|coast|shore|beach/u);
  if (coast) return areaChoice("coast", coast.confidence);
  return fieldChoice("unknown", 0);
}

function areaContactSurfaceChoice(area: EnvironmentAreaInferenceLike): EnvironmentFieldChoice {
  const water = bestAreaCandidate(area, /水面|水中|水辺|water|wetland/u);
  if (water) return areaChoice("water", water.confidence);
  const artificial = bestAreaCandidate(area, /舗装|道路|人工|構造物|建物|コンクリ|asphalt|pavement|built|artificial/u);
  if (artificial) return areaChoice("artificial", artificial.confidence);
  const plant = bestAreaCandidate(area, /葉|花|茎|草|植物|植栽|plant|leaf|grass|shrub|tree/u);
  if (plant) return areaChoice("plant", plant.confidence);
  const rock = bestAreaCandidate(area, /岩|石|礫|rock|stone|gravel/u);
  if (rock) return areaChoice("soil_gravel_litter", rock.confidence);
  const soil = bestAreaCandidate(area, /土|裸地|落ち葉|枯れ草|soil|bare|litter/u);
  if (soil) return areaChoice("soil_gravel_litter", soil.confidence);
  return fieldChoice("unknown", 0);
}

function areaSurroundingCoverChoice(area: EnvironmentAreaInferenceLike): EnvironmentFieldChoice {
  const water = bestAreaCandidate(area, /水|湿地|water|wetland/u);
  if (water) return areaChoice("water", water.confidence);
  const trees = bestAreaCandidate(area, /樹木|低木|樹林|林|tree|shrub|forest/u);
  if (trees) return areaChoice("trees_shrubs", trees.confidence);
  const grass = bestAreaCandidate(area, /低い草|草地|草本|芝|grass|herb|lawn/u);
  if (grass) return areaChoice("low_grass", grass.confidence);
  const built = bestAreaCandidate(area, /舗装|道路|建物|人工|built|pavement|road|urban/u);
  if (built) return areaChoice("built_surface", built.confidence);
  const bare = bestAreaCandidate(area, /裸地|土|礫|bare|soil|gravel/u);
  if (bare) return areaChoice("bare_ground", bare.confidence);
  const snow = bestAreaCandidate(area, /雪|snow/u);
  if (snow) return areaChoice("snow", snow.confidence);
  return fieldChoice("unknown", 0);
}

function areaEnvironmentConditionChoice(area: EnvironmentAreaInferenceLike): EnvironmentFieldChoice {
  const wet = bestAreaCandidate(area, /湿|水|wet|moist|water/u);
  if (wet) return areaChoice("wet", wet.confidence);
  const shaded = bestAreaCandidate(area, /日陰|陰|木陰|shaded|shade/u);
  if (shaded) return areaChoice("shaded", shaded.confidence);
  const sunny = bestAreaCandidate(area, /日当たり|明るい|sunny|sunlit/u);
  if (sunny) return areaChoice("sunny", sunny.confidence);
  const flowing = bestAreaCandidate(area, /流れ|流水|flow|stream/u);
  if (flowing) return areaChoice("flowing", flowing.confidence);
  const windy = bestAreaCandidate(area, /風|wind/u);
  if (windy) return areaChoice("windy", windy.confidence);
  const dry = bestAreaCandidate(area, /乾|開け|裸地|舗装|dry|open|bare|pavement/u);
  if (dry) return areaChoice("open_dry", dry.confidence);
  return fieldChoice("unknown", 0);
}

function areaHumanChangeChoice(area: EnvironmentAreaInferenceLike): EnvironmentFieldChoice {
  const mowing = bestAreaCandidate(area, /草刈|刈込|mow/u);
  const trampling = bestAreaCandidate(area, /踏圧|踏ま|trampling|path/u);
  if (mowing && trampling) return areaChoice("trampling_mowing", Math.max(mowing.confidence, trampling.confidence));
  if (mowing) return areaChoice("mowing", mowing.confidence);
  if (trampling) return areaChoice("trampling", trampling.confidence);
  const planting = bestAreaCandidate(area, /植栽|庭|管理|花壇|planted|garden|managed/u);
  if (planting) return areaChoice("planting", planting.confidence);
  const construction = bestAreaCandidate(area, /造成|工事|建設|construction/u);
  if (construction) return areaChoice("construction", construction.confidence);
  const none = bestAreaCandidate(area, /目立つ変化なし|自然|none visible|no obvious/u);
  if (none) return areaChoice("none_visible", none.confidence);
  return fieldChoice("unknown", 0);
}

function areaDerivedChoices(area: EnvironmentAreaInferenceLike): Record<EnvironmentRecordField, EnvironmentFieldChoice> {
  return {
    place_type: areaPlaceTypeChoice(area),
    contact_surface: areaContactSurfaceChoice(area),
    surrounding_cover: areaSurroundingCoverChoice(area),
    environment_condition: areaEnvironmentConditionChoice(area),
    human_change: areaHumanChangeChoice(area),
  };
}

export function normalizeEnvironmentRecordField(value: unknown): EnvironmentRecordField {
  const raw = String(value ?? "").trim();
  if (!FIELD_SET.has(raw)) {
    throw new Error("invalid_environment_record_field");
  }
  return raw as EnvironmentRecordField;
}

export function normalizeEnvironmentRecordValue(field: EnvironmentRecordField, value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!optionValues(field).has(raw)) {
    throw new Error("invalid_environment_record_value");
  }
  return raw;
}

export function environmentRecordLabel(field: EnvironmentRecordField, value: string): string {
  const fieldDef = ENVIRONMENT_RECORD_FIELDS.find((item) => item.field === field);
  return fieldDef?.options.find((item) => item.value === value)?.label ?? "不明";
}

export function environmentRecordValue(record: Record<string, string> | null | undefined, field: EnvironmentRecordFieldDefinition): string {
  const raw = String(record?.[field.field] ?? "").trim();
  return optionValues(field.field).has(raw) ? raw : "unknown";
}

export function environmentRecordFieldSource(
  record: Record<string, string> | null | undefined,
  field: EnvironmentRecordFieldDefinition,
): EnvironmentRecordFieldSource {
  const direct = String(record?.[`${field.field}_source`] ?? "").trim();
  if (SOURCE_VALUES.has(direct)) return direct as EnvironmentRecordFieldSource;
  const value = environmentRecordValue(record, field);
  return value !== "unknown" ? "legacy" : "unknown";
}

export function environmentRecordSourceLabel(
  record: Record<string, string> | null | undefined,
  field: EnvironmentRecordFieldDefinition,
): string {
  const source = environmentRecordFieldSource(record, field);
  const value = environmentRecordValue(record, field);
  if (source === "user") return "保存済み";
  if (source === "derived" && value !== "unknown") return "自動下書き";
  if (source === "legacy" && value !== "unknown") return "入力済み";
  return "未入力";
}

export function environmentRecordHasStoredValue(
  record: Record<string, string> | null | undefined,
  field: EnvironmentRecordFieldDefinition,
): boolean {
  const value = environmentRecordValue(record, field);
  return value !== "unknown" || environmentRecordFieldSource(record, field) === "user";
}

export function hasAnyEnvironmentRecordValue(record: Record<string, string> | null | undefined): boolean {
  return ENVIRONMENT_RECORD_FIELDS.some((field) => environmentRecordHasStoredValue(record, field));
}

export function normalizeEnvironmentRecordSnapshot(value: unknown): Record<string, string> | null {
  const raw = stringRecord(value);
  const normalized: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(raw)) {
    if (typeof rawValue === "string" && rawValue.trim() !== "") {
      normalized[key] = rawValue;
      continue;
    }
    if (FIELD_SET.has(key)) {
      const nested = stringRecord(rawValue);
      const nestedValue = typeof nested.value === "string" ? nested.value.trim() : "";
      if (nestedValue && optionValues(key as EnvironmentRecordField).has(nestedValue)) {
        normalized[key] = nestedValue;
        const source = typeof nested.source === "string" ? nested.source.trim() : "";
        const confidence = typeof nested.confidence === "string" || typeof nested.confidence === "number"
          ? String(nested.confidence).trim()
          : "";
        if (SOURCE_VALUES.has(source)) normalized[`${key}_source`] = source;
        if (confidence) normalized[`${key}_confidence`] = confidence;
      }
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function mergeUserEnvironmentRecordValues(
  previous: unknown,
  values: Partial<Record<EnvironmentRecordField, string>>,
  options: { updatedAt?: string; updatedBy?: string } = {},
): Record<string, string> {
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const updatedBy = options.updatedBy ?? "observation_detail_quality_card";
  const structured = copyStringRecord(previous);
  for (const fieldDef of ENVIRONMENT_RECORD_FIELDS) {
    const value = values[fieldDef.field];
    if (value == null) continue;
    const normalized = normalizeEnvironmentRecordValue(fieldDef.field, value);
    structured[fieldDef.field] = normalized;
    structured[`${fieldDef.field}_source`] = "user";
    structured[`${fieldDef.field}_confidence`] = "1.00";
    structured[`${fieldDef.field}_updated_at`] = updatedAt;
  }
  structured.environment_record_status = "user_edited";
  structured.environment_record_updated_by = updatedBy;
  structured.environment_record_updated_at = updatedAt;
  structured.updated_by = updatedBy;
  structured.updated_at = updatedAt;
  return structured;
}

export function deriveEnvironmentRecordFromSiteBrief(
  signals: SiteSignals | null | undefined,
  brief?: SiteBrief | null,
  options: { updatedAt?: string } = {},
): Record<string, string> {
  if (!signals) return {};
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const choices = derivedChoices(signals);
  const record: Record<string, string> = {
    environment_record_source: "site_signals_v1",
    environment_record_status: "auto_draft",
    environment_record_updated_by: "site_brief",
    environment_record_updated_at: updatedAt,
  };
  for (const fieldDef of ENVIRONMENT_RECORD_FIELDS) {
    const choice = choices[fieldDef.field];
    if (!choice || choice.value === "unknown") continue;
    const confidence = Math.min(choice.confidence, brief?.hypothesis.confidence ?? choice.confidence);
    record[fieldDef.field] = normalizeEnvironmentRecordValue(fieldDef.field, choice.value);
    record[`${fieldDef.field}_source`] = "derived";
    record[`${fieldDef.field}_confidence`] = normalizeConfidence(confidence);
    record[`${fieldDef.field}_method`] = "site_signals_v1";
  }
  return record;
}

export function normalizeEnvironmentRecordDraft(
  value: unknown,
  options: { updatedAt?: string; method?: string; source?: string } = {},
): Record<string, string> {
  const raw = stringRecord(value);
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const method = options.method ?? "record_photo_feedback_v1";
  const source = options.source ?? method;
  const record: Record<string, string> = {
    environment_record_source: source,
    environment_record_status: "auto_draft",
    environment_record_updated_by: method,
    environment_record_updated_at: updatedAt,
  };
  for (const fieldDef of ENVIRONMENT_RECORD_FIELDS) {
    const fieldValue = raw[fieldDef.field];
    const nested = stringRecord(fieldValue);
    const rawValue = typeof fieldValue === "string" ? fieldValue : nested.value;
    if (typeof rawValue !== "string") continue;
    const valueText = rawValue.trim();
    if (!valueText || valueText === "unknown") continue;
    try {
      record[fieldDef.field] = normalizeEnvironmentRecordValue(fieldDef.field, valueText);
    } catch {
      continue;
    }
    const confidence = typeof nested.confidence === "string" || typeof nested.confidence === "number"
      ? confidenceNumber(nested.confidence, 0.44)
      : 0.44;
    record[`${fieldDef.field}_source`] = "derived";
    record[`${fieldDef.field}_confidence`] = normalizeConfidence(confidence);
    record[`${fieldDef.field}_method`] = method;
  }
  return hasAnyEnvironmentRecordValue(record) ? record : {};
}

export function deriveEnvironmentRecordFromAreaInference(
  area: EnvironmentAreaInferenceLike | null | undefined,
  options: { updatedAt?: string; method?: string; source?: string } = {},
): Record<string, string> {
  if (!area) return {};
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const method = options.method ?? "image_area_inference_v1";
  const source = options.source ?? method;
  const choices = areaDerivedChoices(area);
  const record: Record<string, string> = {
    environment_record_source: source,
    environment_record_status: "auto_draft",
    environment_record_updated_by: method,
    environment_record_updated_at: updatedAt,
  };
  for (const fieldDef of ENVIRONMENT_RECORD_FIELDS) {
    const choice = choices[fieldDef.field];
    if (!choice || choice.value === "unknown") continue;
    record[fieldDef.field] = normalizeEnvironmentRecordValue(fieldDef.field, choice.value);
    record[`${fieldDef.field}_source`] = "derived";
    record[`${fieldDef.field}_confidence`] = normalizeConfidence(choice.confidence);
    record[`${fieldDef.field}_method`] = method;
  }
  return hasAnyEnvironmentRecordValue(record) ? record : {};
}

export function mergeAutoEnvironmentRecordValues(
  previous: unknown,
  draft: unknown,
  options: { updatedAt?: string; updatedBy?: string } = {},
): Record<string, string> {
  const previousRecord = copyStringRecord(previous);
  const draftRecord = normalizeEnvironmentRecordSnapshot(draft) ?? {};
  if (!hasAnyEnvironmentRecordValue(draftRecord)) return previousRecord;
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const updatedBy = options.updatedBy ?? draftRecord.environment_record_updated_by ?? "auto_environment_record";
  const structured = { ...previousRecord };
  let changed = false;
  for (const fieldDef of ENVIRONMENT_RECORD_FIELDS) {
    const incomingValue = environmentRecordValue(draftRecord, fieldDef);
    if (incomingValue === "unknown") continue;
    const currentValue = environmentRecordValue(structured, fieldDef);
    const currentSource = environmentRecordFieldSource(structured, fieldDef);
    if (currentSource === "user" || currentSource === "legacy") continue;
    const currentConfidence = Number(structured[`${fieldDef.field}_confidence`] ?? "0");
    const incomingConfidence = Number(draftRecord[`${fieldDef.field}_confidence`] ?? "0.44");
    if (currentValue !== "unknown" && Number.isFinite(currentConfidence) && incomingConfidence < currentConfidence) continue;
    structured[fieldDef.field] = incomingValue;
    structured[`${fieldDef.field}_source`] = "derived";
    structured[`${fieldDef.field}_confidence`] = normalizeConfidence(incomingConfidence);
    structured[`${fieldDef.field}_method`] = draftRecord[`${fieldDef.field}_method`] ?? "auto_environment_record";
    changed = true;
  }
  if (changed) {
    structured.environment_record_source = draftRecord.environment_record_source ?? structured.environment_record_source ?? "auto_environment_record";
    structured.environment_record_status = structured.environment_record_status === "user_edited" ? "user_edited" : "auto_draft";
    structured.environment_record_updated_by = updatedBy;
    structured.environment_record_updated_at = updatedAt;
    structured.updated_by = updatedBy;
    structured.updated_at = updatedAt;
  }
  return structured;
}
