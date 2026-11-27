export type CompatibleEnvironmentRecordField = "place_type" | "contact_surface" | "surrounding_cover" | "environment_condition" | "human_change";

export const COMPATIBLE_ENVIRONMENT_RECORD_OPTIONS: Record<CompatibleEnvironmentRecordField, Array<{ value: string; label: string }>> = {
  place_type: [
    { value: "grassland_urban_edge", label: "草地と市街地の縁" },
    { value: "urban", label: "市街地" },
    { value: "woodland", label: "林内" },
    { value: "water_edge", label: "水辺" },
    { value: "wetland", label: "湿地" },
    { value: "coast", label: "海岸" },
    { value: "unknown", label: "不明" }
  ],
  contact_surface: [
    { value: "soil_gravel_litter", label: "土・礫・枯れ草" },
    { value: "soil", label: "土" },
    { value: "plant", label: "植物上" },
    { value: "water", label: "水面・水中" },
    { value: "rock", label: "岩・石" },
    { value: "artificial", label: "人工物" },
    { value: "unknown", label: "不明" }
  ],
  surrounding_cover: [
    { value: "low_grass", label: "低い草地" },
    { value: "trees_shrubs", label: "樹木・低木" },
    { value: "bare_ground", label: "裸地" },
    { value: "water", label: "水" },
    { value: "snow", label: "雪" },
    { value: "built_surface", label: "舗装・構造物" },
    { value: "unknown", label: "不明" }
  ],
  environment_condition: [
    { value: "open_dry", label: "開けて乾き気味" },
    { value: "sunny", label: "日当たり" },
    { value: "shaded", label: "日陰" },
    { value: "wet", label: "湿り気あり" },
    { value: "flowing", label: "流れあり" },
    { value: "windy", label: "風あり" },
    { value: "unknown", label: "不明" }
  ],
  human_change: [
    { value: "trampling_mowing", label: "踏圧・草刈り跡" },
    { value: "mowing", label: "草刈り" },
    { value: "trampling", label: "踏圧" },
    { value: "planting", label: "植栽・管理" },
    { value: "construction", label: "造成・工事" },
    { value: "release", label: "放流・放逐" },
    { value: "none_visible", label: "目立つ変化なし" },
    { value: "unknown", label: "不明" }
  ]
};

export const COMPATIBLE_ENVIRONMENT_RECORD_FIELD_LABELS: Record<CompatibleEnvironmentRecordField, string> = {
  place_type: "場所",
  contact_surface: "足元",
  surrounding_cover: "周囲",
  environment_condition: "状態",
  human_change: "人の影響"
};

export const COMPATIBLE_ENVIRONMENT_RECORD_MULTI_FIELDS = ["contact_surface", "surrounding_cover", "environment_condition", "human_change"] as const;

const EXCLUSIVE_VALUES = new Set(["unknown", "none_visible"]);
const MAX_INPUT_VALUES = 16;

export function isCompatibleEnvironmentRecordMultiField(field: string): boolean {
  return (COMPATIBLE_ENVIRONMENT_RECORD_MULTI_FIELDS as readonly string[]).includes(field);
}

export const compatibleEnvironmentRecordValuesKey = (field: string): string => `${field}_values`;

function splitValues(raw: unknown): string[] {
  const parts = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  return parts.filter((part): part is string => typeof part === "string").map((part) => part.trim()).filter(Boolean);
}

function dedupeExclusive(values: readonly string[]): string[] {
  const unique = [...new Set(values)];
  const rest = unique.filter((value) => !EXCLUSIVE_VALUES.has(value));
  return rest.length > 0 ? rest : unique.slice(0, 1);
}

export function compatibleEnvironmentRecordRawValues(
  record: Record<string, unknown> | null | undefined,
  field: string
): string[] {
  if (!record) return [];
  const listed = isCompatibleEnvironmentRecordMultiField(field) ? splitValues(record[compatibleEnvironmentRecordValuesKey(field)]) : [];
  const values = listed.length > 0 ? listed : splitValues(record[field]);
  return isCompatibleEnvironmentRecordMultiField(field) ? dedupeExclusive(values) : values.slice(0, 1);
}

export function compatibleEnvironmentRecordValues(
  record: Record<string, unknown> | null | undefined,
  field: CompatibleEnvironmentRecordField
): string[] {
  const valid = new Set(COMPATIBLE_ENVIRONMENT_RECORD_OPTIONS[field].map((option) => option.value));
  const listed = isCompatibleEnvironmentRecordMultiField(field) ? splitValues(record?.[compatibleEnvironmentRecordValuesKey(field)]) : [];
  const values = (listed.length > 0 ? listed : splitValues(record?.[field])).filter((value) => valid.has(value));
  return isCompatibleEnvironmentRecordMultiField(field) ? dedupeExclusive(values) : values.slice(0, 1);
}

export function normalizeCompatibleEnvironmentRecordInput(field: CompatibleEnvironmentRecordField, value: unknown): string[] | null {
  const valid = new Set(COMPATIBLE_ENVIRONMENT_RECORD_OPTIONS[field].map((option) => option.value));
  const items = Array.isArray(value) ? value : [value];
  if (items.length === 0 || items.length > MAX_INPUT_VALUES) return null;
  const cleaned = items.map((item) => (typeof item === "string" ? item.trim() : item == null ? "" : String(item).trim()));
  if (cleaned.some((item) => !valid.has(item))) return null;
  if (!isCompatibleEnvironmentRecordMultiField(field)) return cleaned.length === 1 ? cleaned : null;
  return dedupeExclusive(cleaned);
}

export function parseCompatibleStructuredJson(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof entry === "string") {
        if (entry.trim() !== "") out[key] = entry;
      } else if (Array.isArray(entry) && COMPATIBLE_ENVIRONMENT_RECORD_MULTI_FIELDS.some((field) => compatibleEnvironmentRecordValuesKey(field) === key)) {
        const joined = splitValues(entry).join(",");
        if (joined !== "") out[key] = joined;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeCompatibleStructuredJson(structured: Record<string, string>): string {
  const out: Record<string, string | string[]> = {};
  for (const [key, entry] of Object.entries(structured)) {
    out[key] = COMPATIBLE_ENVIRONMENT_RECORD_MULTI_FIELDS.some((field) => compatibleEnvironmentRecordValuesKey(field) === key) && typeof entry === "string"
      ? splitValues(entry)
      : entry;
  }
  return JSON.stringify(out);
}

export function publicCompatibleEnvironmentRecord(record: Record<string, string> | null | undefined): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, entry] of Object.entries(record ?? {})) {
    out[key] = COMPATIBLE_ENVIRONMENT_RECORD_MULTI_FIELDS.some((field) => compatibleEnvironmentRecordValuesKey(field) === key)
      ? splitValues(entry)
      : entry;
  }
  return out;
}

export function mergeCompatibleUserEnvironmentRecordValues(
  previous: Record<string, string>,
  values: Partial<Record<CompatibleEnvironmentRecordField, string[]>>,
  updatedBy: string
): Record<string, string> {
  const updatedAt = new Date().toISOString();
  const structured = { ...previous };
  for (const field of Object.keys(COMPATIBLE_ENVIRONMENT_RECORD_OPTIONS) as CompatibleEnvironmentRecordField[]) {
    const list = values[field];
    if (!list || list.length === 0) continue;
    structured[field] = list[0]!;
    if (isCompatibleEnvironmentRecordMultiField(field)) structured[compatibleEnvironmentRecordValuesKey(field)] = list.join(",");
    structured[`${field}_source`] = "user";
    structured[`${field}_confidence`] = "1.00";
    structured[`${field}_updated_at`] = updatedAt;
  }
  structured.environment_record_status = "user_edited";
  structured.environment_record_updated_by = updatedBy;
  structured.environment_record_updated_at = updatedAt;
  structured.updated_by = updatedBy;
  structured.updated_at = updatedAt;
  return structured;
}
