import { isCanonicalOrLegacyPublicHost } from "./zukanPublicHost.js";

export const PLACE_ATLAS_PROFILE_VERSION = "place_atlas_profile/v1" as const;
export const PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS = 3;

export const PLACE_ATLAS_FACET_KEYS = [
  "nature",
  "scenery",
  "daily_life",
  "facility",
  "activity",
  "history",
  "audio_visual",
  "insight",
  "unclassified",
] as const;

export type PlaceAtlasFacetKey = typeof PLACE_ATLAS_FACET_KEYS[number];

export type PlaceAtlasRef =
  | { kind: "field"; fieldId: string }
  | {
      kind: "osm_area";
      entityKey: string;
      osmType: "way" | "relation";
      osmId: number;
    }
  | { kind: "public_cell"; cellId: string };

export type PlaceAtlasIdentificationStatus =
  | "confirmed"
  | "ai_candidate"
  | "awaiting_identification"
  | "unknown";

export type PlaceAtlasMediaKind = "photo" | "video" | "audio" | "record";

export type PlaceAtlasSourceRecord = {
  recordId: string;
  observedAt: string | null;
  contributorKey?: string | null;
  displayName?: string | null;
  href?: string | null;
  mediaUrl?: string | null;
  mediaKind?: PlaceAtlasMediaKind | null;
  taxonGroup?: string | null;
  themes?: PlaceAtlasFacetKey[];
  identificationStatus?: PlaceAtlasIdentificationStatus;
};

export type PlaceAtlasProfileRecord = {
  recordId: string;
  observedAt: string | null;
  displayName: string | null;
  href: string | null;
  mediaUrl: string | null;
  mediaKind: PlaceAtlasMediaKind;
  taxonGroup: string | null;
  themes: PlaceAtlasFacetKey[];
  identificationStatus: PlaceAtlasIdentificationStatus;
};

export type PlaceAtlasFacet = {
  key: PlaceAtlasFacetKey;
  label: string;
  count: number | null;
  representativeMediaUrl?: string | null;
};

export type PlaceAtlasHighlight = {
  kind: "recent_activity" | "seasonal_pattern" | "dominant_theme";
  text: string;
  evidenceCount: number | null;
  sourceLabel: string;
  confidence: "confirmed" | "derived" | "unknown";
};

export type PlaceAtlasProfile = {
  version: 1;
  placeRef: PlaceAtlasRef;
  place: {
    name: string;
    type: string;
    localityLabel: string | null;
    description: string | null;
    canonicalPlaceId?: string;
    aliases?: string[];
    multilingualNames?: Record<string, string>;
    verificationStatus?: "unverified" | "source_verified" | "administrator_verified";
    officialStatus?: "official" | "unofficial" | "unknown";
    representativeMedia: Array<{
      url: string;
      recordId?: string;
      observedAt?: string;
      kind?: PlaceAtlasMediaKind;
    }>;
  };
  summary: {
    recordCount: number | null;
    contributorCount: number | null;
    firstRecordedAt: string | null;
    latestRecordedAt: string | null;
  };
  facets: PlaceAtlasFacet[];
  highlights: PlaceAtlasHighlight[];
  recentRecords: PlaceAtlasProfileRecord[];
  guide: unknown | null;
  memories: unknown[];
  facilities: unknown[];
  activities?: unknown[];
  stories?: unknown[];
  policy?: PlacePolicyProjection;
  dataGaps: Array<{
    key: string;
    label: string;
    reason: string;
  }>;
  publication: {
    status: "published" | "partial" | "suppressed";
    suppressedSections: string[];
    locationMode: "field" | "osm_area" | "public_cell" | "public_cell_derived";
  };
  provenance: {
    generatedAt: string;
    profileVersion: typeof PLACE_ATLAS_PROFILE_VERSION;
    sources: string[];
    sourceReferences?: Array<{
      sourceType: string;
      sourceId: string;
      sourceUrl: string | null;
      confidence: number;
      verificationStatus: string;
      lastCheckedAt: string | null;
    }>;
  };
};

export type PlaceAtlasBuildInput = {
  placeRef: PlaceAtlasRef;
  place: {
    name: string;
    type: string;
    localityLabel?: string | null;
    description?: string | null;
    canonicalPlaceId?: string | null;
    aliases?: string[];
    multilingualNames?: Record<string, string>;
    verificationStatus?: PlaceAtlasProfile["place"]["verificationStatus"];
    officialStatus?: PlaceAtlasProfile["place"]["officialStatus"];
  };
  records: PlaceAtlasSourceRecord[] | null;
  recordSetComplete: boolean;
  locationMode: PlaceAtlasProfile["publication"]["locationMode"];
  minimumPublicRecords?: number;
  contributorCountAllowed?: boolean;
  guide?: unknown | null;
  memories?: unknown[];
  facilities?: unknown[];
  activities?: unknown[];
  stories?: unknown[];
  policy?: PlaceAtlasProfile["policy"];
  suppressedSections?: string[];
  dataGaps?: PlaceAtlasProfile["dataGaps"];
  sources: string[];
  sourceReferences?: PlaceAtlasProfile["provenance"]["sourceReferences"];
  generatedAt?: string;
  now?: string;
};

const FACET_LABELS: Record<PlaceAtlasFacetKey, string> = {
  nature: "自然・生きもの",
  scenery: "風景・季節",
  daily_life: "過ごし方",
  facility: "場所・施設",
  activity: "出来事・活動",
  history: "歴史・物語",
  audio_visual: "音・映像",
  insight: "気づき",
  unclassified: "未分類",
};

const SEASON_LABELS = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
} as const;

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function isValidFieldId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(value);
}

function isValidPublicCellId(value: string): boolean {
  if (/^\d{2,6}:-?\d+:-?\d+$/.test(value)) return true;
  const coordinateMatch = /^cell:(-?\d{1,2}(?:\.\d{1,8})?),(-?\d{1,3}(?:\.\d{1,8})?)$/.exec(value);
  if (!coordinateMatch) return false;
  const lat = Number(coordinateMatch[1]);
  const lng = Number(coordinateMatch[2]);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

function parseSafePositiveInteger(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue <= 0) return null;
  return numberValue;
}

export function normalizePlaceAtlasRef(input: Record<string, unknown>): PlaceAtlasRef | null {
  const kind = normalizeText(input.kind, 32);
  if (kind === "field") {
    const fieldId = normalizeText(input.fieldId ?? input.field_id, 128);
    return fieldId && isValidFieldId(fieldId) ? { kind, fieldId } : null;
  }
  if (kind === "public_cell") {
    const cellId = normalizeText(input.cellId ?? input.cell_id, 128);
    return cellId && isValidPublicCellId(cellId) ? { kind, cellId } : null;
  }
  if (kind === "osm_area") {
    const osmType = normalizeText(input.osmType ?? input.osm_type, 16);
    const osmId = parseSafePositiveInteger(input.osmId ?? input.osm_id);
    const entityKey = normalizeText(input.entityKey ?? input.entity_key, 128);
    if ((osmType !== "way" && osmType !== "relation") || osmId === null || !entityKey) return null;
    if (entityKey !== `osm:${osmType}:${osmId}`) return null;
    return { kind, entityKey, osmType, osmId };
  }
  return null;
}

function safeMediaUrl(value: unknown): string | null {
  const url = normalizeText(value, 2048);
  if (!url) return null;
  if (
    url.startsWith("/")
    && !url.startsWith("//")
    && !/[\u0000-\u001f\u007f\\]/.test(url)
  ) {
    const path = url.split(/[?#]/, 1)[0] ?? "";
    let decodedPath = "";
    try {
      decodedPath = decodeURIComponent(path);
    } catch {
      return null;
    }
    if (/(?:^|\/)\.\.(?:\/|$)/.test(decodedPath)) return null;
    const allowed = [
      "/derived/",
      "/derived-transform/",
      "/thumb/",
      "/uploads/",
      "/data/uploads/",
    ].some((prefix) => decodedPath.startsWith(prefix));
    return allowed ? url : null;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:"
      && parsed.username === ""
      && parsed.password === ""
      && isCanonicalOrLegacyPublicHost(parsed.hostname)
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function safeHref(value: unknown): string | null {
  const href = normalizeText(value, 2048);
  if (!href) return null;
  if (href.startsWith("/") && !href.startsWith("//") && !/[\u0000-\u001f\u007f]/.test(href)) return href;
  return null;
}

function normalizeMediaKind(value: unknown): PlaceAtlasMediaKind {
  return value === "photo" || value === "video" || value === "audio" || value === "record"
    ? value
    : "record";
}

function normalizeIdentificationStatus(value: unknown): PlaceAtlasIdentificationStatus {
  return value === "confirmed" ||
    value === "ai_candidate" ||
    value === "awaiting_identification" ||
    value === "unknown"
    ? value
    : "unknown";
}

function normalizeThemes(record: PlaceAtlasSourceRecord): PlaceAtlasFacetKey[] {
  const themes = new Set<PlaceAtlasFacetKey>();
  for (const value of record.themes ?? []) {
    if ((PLACE_ATLAS_FACET_KEYS as readonly string[]).includes(value)) themes.add(value);
  }
  const mediaKind = normalizeMediaKind(record.mediaKind);
  if (mediaKind === "audio" || mediaKind === "video") themes.add("audio_visual");
  const taxonGroup = normalizeText(record.taxonGroup, 64);
  if (taxonGroup && taxonGroup !== "other" && taxonGroup !== "unclassified") themes.add("nature");
  if (themes.size === 0) themes.add("unclassified");
  return [...themes];
}

function recordTimestamp(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function richerRecord(
  current: PlaceAtlasProfileRecord,
  candidate: PlaceAtlasProfileRecord,
): PlaceAtlasProfileRecord {
  const currentScore = (current.mediaUrl ? 4 : 0) +
    (current.displayName ? 2 : 0);
  const candidateScore = (candidate.mediaUrl ? 4 : 0) +
    (candidate.displayName ? 2 : 0);
  const primary = candidateScore > currentScore ? candidate : current;
  const secondary = primary === current ? candidate : current;
  const identificationRisk: Record<PlaceAtlasIdentificationStatus, number> = {
    confirmed: 0,
    unknown: 1,
    awaiting_identification: 2,
    ai_candidate: 3,
  };
  const identificationStatus = identificationRisk[primary.identificationStatus] >=
    identificationRisk[secondary.identificationStatus]
    ? primary.identificationStatus
    : secondary.identificationStatus;
  return {
    ...primary,
    observedAt: recordTimestamp(primary.observedAt) >= recordTimestamp(secondary.observedAt)
      ? primary.observedAt
      : secondary.observedAt,
    themes: [...new Set([...primary.themes, ...secondary.themes])],
    identificationStatus,
  };
}

export function dedupePlaceAtlasRecords(records: PlaceAtlasSourceRecord[]): PlaceAtlasProfileRecord[] {
  const byRecordId = new Map<string, PlaceAtlasProfileRecord>();
  for (const source of records) {
    const recordId = normalizeText(source.recordId, 256);
    if (!recordId) continue;
    const normalized: PlaceAtlasProfileRecord = {
      recordId,
      observedAt: normalizeText(source.observedAt, 64),
      displayName: normalizeText(source.displayName, 160),
      href: safeHref(source.href),
      mediaUrl: safeMediaUrl(source.mediaUrl),
      mediaKind: normalizeMediaKind(source.mediaKind),
      taxonGroup: normalizeText(source.taxonGroup, 64),
      themes: normalizeThemes(source),
      identificationStatus: normalizeIdentificationStatus(source.identificationStatus),
    };
    const current = byRecordId.get(recordId);
    byRecordId.set(recordId, current ? richerRecord(current, normalized) : normalized);
  }
  return [...byRecordId.values()].sort((a, b) =>
    recordTimestamp(b.observedAt) - recordTimestamp(a.observedAt) ||
    a.recordId.localeCompare(b.recordId)
  );
}

function representativeMedia(records: PlaceAtlasProfileRecord[]): PlaceAtlasProfile["place"]["representativeMedia"] {
  const seen = new Set<string>();
  const output: PlaceAtlasProfile["place"]["representativeMedia"] = [];
  for (const record of records) {
    if (!record.mediaUrl || seen.has(record.mediaUrl)) continue;
    seen.add(record.mediaUrl);
    output.push({
      url: record.mediaUrl,
      recordId: record.recordId,
      ...(record.observedAt ? { observedAt: record.observedAt } : {}),
      kind: record.mediaKind,
    });
    if (output.length >= 3) break;
  }
  return output;
}

function inferredGuideFacet(guide: unknown): PlaceAtlasFacetKey | null {
  if (!guide || typeof guide !== "object" || Array.isArray(guide)) return null;
  const category = normalizeText((guide as { category?: unknown }).category, 48);
  if (category === "heritage") return "history";
  if (category === "nature") return "nature";
  if (category === "community" || category === "owner") return "activity";
  return null;
}

function buildFacets(
  records: PlaceAtlasProfileRecord[],
  guide: unknown,
  memories: unknown[],
  facilities: unknown[],
): PlaceAtlasFacet[] {
  const counts = new Map<PlaceAtlasFacetKey, { records: Set<string>; media: string | null }>();
  for (const record of records) {
    for (const key of record.themes) {
      const entry = counts.get(key) ?? { records: new Set<string>(), media: null };
      entry.records.add(record.recordId);
      if (!entry.media && record.mediaUrl) entry.media = record.mediaUrl;
      counts.set(key, entry);
    }
  }
  const guideFacet = inferredGuideFacet(guide);
  if (guideFacet) {
    const entry = counts.get(guideFacet) ?? { records: new Set<string>(), media: null };
    entry.records.add("guide");
    counts.set(guideFacet, entry);
  }
  if (memories.length > 0) {
    for (const key of ["daily_life", "insight"] as const) {
      const entry = counts.get(key) ?? { records: new Set<string>(), media: null };
      memories.forEach((_, index) => entry.records.add(`memory:${index}`));
      counts.set(key, entry);
    }
  }
  if (facilities.length > 0) {
    const entry = counts.get("facility") ?? { records: new Set<string>(), media: null };
    facilities.forEach((_, index) => entry.records.add(`facility:${index}`));
    counts.set("facility", entry);
  }
  return PLACE_ATLAS_FACET_KEYS
    .filter((key) => (counts.get(key)?.records.size ?? 0) > 0)
    .sort((a, b) => {
      const countDelta = (counts.get(b)?.records.size ?? 0) - (counts.get(a)?.records.size ?? 0);
      return countDelta !== 0 ? countDelta : PLACE_ATLAS_FACET_KEYS.indexOf(a) - PLACE_ATLAS_FACET_KEYS.indexOf(b);
    })
    .map((key) => ({
      key,
      label: FACET_LABELS[key],
      count: counts.get(key)!.records.size,
      representativeMediaUrl: counts.get(key)!.media,
    }));
}

function seasonForDate(value: string | null): keyof typeof SEASON_LABELS | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value.trim());
  const month = match ? Number(match[2]) : NaN;
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function buildHighlights(
  records: PlaceAtlasProfileRecord[],
  facets: PlaceAtlasFacet[],
  nowValue: string,
): PlaceAtlasHighlight[] {
  if (records.length < PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS) return [];
  const highlights: PlaceAtlasHighlight[] = [];
  const latestMs = recordTimestamp(records[0]?.observedAt ?? null);
  const nowMs = Date.parse(nowValue);
  const recentWindowMs = 1000 * 60 * 60 * 24 * 90;
  if (Number.isFinite(nowMs) && Number.isFinite(latestMs) && nowMs >= latestMs && nowMs - latestMs <= recentWindowMs) {
    highlights.push({
      kind: "recent_activity",
      text: "最近も新しい記録が追加されています",
      evidenceCount: records.filter((record) => {
        const timestamp = recordTimestamp(record.observedAt);
        return Number.isFinite(timestamp) && nowMs - timestamp <= recentWindowMs;
      }).length,
      sourceLabel: "公開Record",
      confidence: "derived",
    });
  }

  const seasonCounts = new Map<keyof typeof SEASON_LABELS, number>();
  for (const record of records) {
    const season = seasonForDate(record.observedAt);
    if (season) seasonCounts.set(season, (seasonCounts.get(season) ?? 0) + 1);
  }
  const dominantSeason = [...seasonCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (dominantSeason && dominantSeason[1] >= 3 && dominantSeason[1] / records.length >= 0.6) {
    highlights.push({
      kind: "seasonal_pattern",
      text: `${SEASON_LABELS[dominantSeason[0]]}の記録が多く残っています`,
      evidenceCount: dominantSeason[1],
      sourceLabel: "公開Recordの観察月",
      confidence: "derived",
    });
  }

  const dominantFacet = facets.find((facet) => facet.key !== "unclassified" && (facet.count ?? 0) >= 3);
  if (dominantFacet && (dominantFacet.count ?? 0) / records.length >= 0.6) {
    const text = dominantFacet.key === "nature"
      ? "自然・生きものの記録が多い場所です"
      : dominantFacet.key === "audio_visual"
        ? "音や映像の記録が多い場所です"
        : `${dominantFacet.label}の記録が多い場所です`;
    highlights.push({
      kind: "dominant_theme",
      text,
      evidenceCount: dominantFacet.count,
      sourceLabel: "地域図鑑theme",
      confidence: "derived",
    });
  }
  return highlights.slice(0, 3);
}

function distinctContributorCount(records: PlaceAtlasSourceRecord[]): number | null {
  const contributors = new Set<string>();
  let hasUnknown = false;
  for (const record of records) {
    const contributor = normalizeText(record.contributorKey, 256);
    if (contributor) contributors.add(contributor);
    else hasUnknown = true;
  }
  if (hasUnknown || contributors.size < PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS) return null;
  return contributors.size;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeText(value, 256)).filter((value): value is string => Boolean(value)))];
}

export function buildPlaceAtlasProfile(input: PlaceAtlasBuildInput): PlaceAtlasProfile {
  const generatedAt = normalizeText(input.generatedAt, 64) ?? new Date().toISOString();
  const nowValue = normalizeText(input.now, 64) ?? generatedAt;
  const minimumPublicRecords = Math.max(
    PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS,
    Number.isFinite(input.minimumPublicRecords) ? Math.floor(input.minimumPublicRecords as number) : 0,
  );
  const dedupedRecords = input.records === null ? null : dedupePlaceAtlasRecords(input.records);
  const belowThreshold = dedupedRecords !== null &&
    dedupedRecords.length > 0 &&
    dedupedRecords.length < minimumPublicRecords;
  const publishableRecords = dedupedRecords === null || belowThreshold ? [] : dedupedRecords;
  const recordCount = dedupedRecords === null || belowThreshold
    ? null
    : input.recordSetComplete
      ? dedupedRecords.length
      : null;
  const memories = Array.isArray(input.memories) ? input.memories.slice(0, 12) : [];
  const facilities = Array.isArray(input.facilities) ? input.facilities.slice(0, 12) : [];
  const activities = Array.isArray(input.activities) ? input.activities.slice(0, 12) : [];
  const stories = Array.isArray(input.stories) ? input.stories.slice(0, 12) : [];
  const facets = buildFacets(publishableRecords, input.guide, memories, facilities);
  const contributorCount = input.contributorCountAllowed && input.records
    ? distinctContributorCount(input.records)
    : null;
  const suppressedSections = uniqueStrings([
    ...(input.suppressedSections ?? []),
    ...(belowThreshold ? ["record_summary", "representative_media", "recent_records", "themes", "highlights"] : []),
    ...(dedupedRecords === null ? ["record_summary"] : []),
  ]);
  const dataGaps = [...(input.dataGaps ?? [])];
  if (contributorCount === null) {
    dataGaps.push({
      key: "contributors",
      label: "記録した人の広がり",
      reason: "個人を特定せず安全に集計できる条件がそろっていないため表示していません。",
    });
  }
  if (belowThreshold) {
    dataGaps.push({
      key: "public_threshold",
      label: "公開Record",
      reason: "少数記録から場所や投稿者が推測されないよう、公開閾値を満たすまで詳細を控えています。",
    });
  }
  const firstRecordedAt = publishableRecords.length > 0
    ? publishableRecords.reduce((earliest, record) =>
        recordTimestamp(record.observedAt) < recordTimestamp(earliest) ? record.observedAt : earliest,
      publishableRecords[0]!.observedAt)
    : null;
  const latestRecordedAt = publishableRecords[0]?.observedAt ?? null;
  const baseStatus = belowThreshold || dedupedRecords === null ? "suppressed" : "published";
  const status: PlaceAtlasProfile["publication"]["status"] =
    baseStatus === "suppressed"
      ? "suppressed"
      : !input.recordSetComplete
        || suppressedSections.length > 0
        || input.locationMode === "public_cell_derived"
        ? "partial"
        : "published";

  return {
    version: 1,
    placeRef: input.placeRef,
    place: {
      name: normalizeText(input.place.name, 160) ?? "名称未確認の場所",
      type: normalizeText(input.place.type, 80) ?? "place",
      localityLabel: normalizeText(input.place.localityLabel, 160),
      description: normalizeText(input.place.description, 360),
      ...(normalizeText(input.place.canonicalPlaceId, 128)
        ? { canonicalPlaceId: normalizeText(input.place.canonicalPlaceId, 128)! }
        : {}),
      ...(input.place.aliases
        ? { aliases: uniqueStrings(input.place.aliases).slice(0, 32) }
        : {}),
      ...(input.place.multilingualNames
        ? {
            multilingualNames: Object.fromEntries(
              Object.entries(input.place.multilingualNames)
                .map(([language, name]) => [
                  normalizeText(language, 16),
                  normalizeText(name, 160),
                ])
                .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))
                .slice(0, 16),
            ),
          }
        : {}),
      ...(input.place.verificationStatus
        ? { verificationStatus: input.place.verificationStatus }
        : {}),
      ...(input.place.officialStatus
        ? { officialStatus: input.place.officialStatus }
        : {}),
      representativeMedia: representativeMedia(publishableRecords),
    },
    summary: {
      recordCount,
      contributorCount,
      firstRecordedAt,
      latestRecordedAt,
    },
    facets,
    highlights: buildHighlights(publishableRecords, facets, nowValue),
    recentRecords: publishableRecords.slice(0, 12),
    guide: input.guide ?? null,
    memories,
    facilities,
    activities,
    stories,
    ...(input.policy ? { policy: input.policy } : {}),
    dataGaps,
    publication: {
      status,
      suppressedSections,
      locationMode: input.locationMode,
    },
    provenance: {
      generatedAt,
      profileVersion: PLACE_ATLAS_PROFILE_VERSION,
      sources: uniqueStrings(input.sources),
      ...(input.sourceReferences
        ? { sourceReferences: input.sourceReferences.slice(0, 32) }
        : {}),
    },
  };
}

export const __test__ = {
  FACET_LABELS,
  buildFacets,
  buildHighlights,
  isValidPublicCellId,
  safeMediaUrl,
  seasonForDate,
};
import type { PlacePolicyProjection } from "./placeDomain.js";
