import type { SiteLang } from "../i18n.js";

export const PLACE_FEELING_TAG_LIMIT = 3;

export const PLACE_FEELING_TAGS = [
  { key: "beautiful", category: "positive" },
  { key: "felt_good", category: "positive" },
  { key: "want_return", category: "positive" },
  { key: "trash_seen", category: "concern" },
  { key: "hard_to_walk", category: "concern" },
  { key: "felt_unsafe", category: "concern" },
  { key: "seasonal_change", category: "change" },
  { key: "different_from_before", category: "change" },
  { key: "wildlife_seen", category: "change" },
  { key: "place_to_rest", category: "accessibility_or_use" },
  { key: "guide_easy", category: "accessibility_or_use" },
  { key: "hard_to_find", category: "concern" },
  { key: "observing_life", category: "activity_context" },
  { key: "walking", category: "activity_context" },
  { key: "family_time", category: "social_context" },
  { key: "with_someone", category: "social_context" },
  { key: "date_walk", category: "social_context" },
] as const;

export type PlaceFeelingTagKey = typeof PLACE_FEELING_TAGS[number]["key"];
export type PlaceFeelingTagCategory = typeof PLACE_FEELING_TAGS[number]["category"];

const PLACE_FEELING_TAG_SET = new Set<string>(PLACE_FEELING_TAGS.map((tag) => tag.key));

const PLACE_FEELING_TAG_LABELS_JA: Record<PlaceFeelingTagKey, string> = {
  beautiful: "きれいだった",
  felt_good: "気持ちよかった",
  want_return: "また来たい",
  trash_seen: "ごみがあった",
  hard_to_walk: "歩きにくかった",
  felt_unsafe: "危なそうだった",
  seasonal_change: "季節を感じた",
  different_from_before: "前と違っていた",
  wildlife_seen: "生きものがいた",
  place_to_rest: "休める場所があった",
  guide_easy: "案内が分かりやすかった",
  hard_to_find: "場所が分かりにくかった",
  observing_life: "生きもの観察中",
  walking: "ウォーキング中",
  family_time: "家族と",
  with_someone: "誰かと散策",
  date_walk: "誰かと散策",
};

export function normalizePlaceFeelingTagKeys(value: unknown, limit = PLACE_FEELING_TAG_LIMIT): PlaceFeelingTagKey[] {
  if (!Array.isArray(value)) return [];
  const output: PlaceFeelingTagKey[] = [];
  const max = Math.max(0, Math.min(PLACE_FEELING_TAG_LIMIT, Math.floor(limit)));
  for (const item of value) {
    const key = typeof item === "string" ? item.trim() : "";
    if (!PLACE_FEELING_TAG_SET.has(key) || output.includes(key as PlaceFeelingTagKey)) continue;
    output.push(key as PlaceFeelingTagKey);
    if (output.length >= max) break;
  }
  return output;
}

export function placeFeelingTagLabel(key: string, lang: SiteLang = "ja"): string | null {
  if (!PLACE_FEELING_TAG_SET.has(key)) return null;
  if (lang !== "ja") return PLACE_FEELING_TAG_LABELS_JA[key as PlaceFeelingTagKey];
  return PLACE_FEELING_TAG_LABELS_JA[key as PlaceFeelingTagKey];
}

export function placeFeelingTagLabels(lang: SiteLang = "ja"): Record<PlaceFeelingTagKey, string> {
  return Object.fromEntries(
    PLACE_FEELING_TAGS.map((tag) => [tag.key, placeFeelingTagLabel(tag.key, lang) ?? tag.key]),
  ) as Record<PlaceFeelingTagKey, string>;
}
