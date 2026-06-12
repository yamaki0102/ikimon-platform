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
