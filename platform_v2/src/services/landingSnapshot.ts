import { getPool } from "../db.js";
import { getHomeSnapshot } from "./readModels.js";
import { buildObserverNameSql } from "./observerNameSql.js";
import {
  buildPublicCellGeometry,
  buildPublicLocationSummary,
  parsePublicCellId,
  summarizePublicLocalitySet,
} from "./publicLocation.js";
import { buildPublicMapCellName } from "./publicMapCellNaming.js";
import { buildStagingFixtureExclusionSql } from "./stagingFixtureGuard.js";
import {
  PUBLIC_OBSERVATION_HAS_VALID_MEDIA_SQL,
  PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL,
  PUBLIC_OBSERVATION_QUALITY_SQL,
  VALID_OBSERVATION_PHOTO_ASSET_SQL,
  VALID_OBSERVATION_VIDEO_ASSET_SQL,
} from "./observationQualityGate.js";
import { getRegionalStoryCue } from "./regionalStory.js";
import type {
  AmbientObserver,
  LandingDailyCard,
  LandingDailyDashboard,
  LandingFeaturedObservation,
  LandingHeroReason,
  LandingHeroScoreBreakdown,
  LandingHabitStats,
  LandingMapPreviewCell,
  LandingObservation,
  LandingSnapshot,
  LandingStats,
  LandingTopGuideItem,
  LandingTopOverflowSummary,
  LandingTopShelf,
  LandingTopShelfItem,
  LandingTopShelfKind,
} from "./readModels.js";

function normalizeAssetUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }
  return `/${value.replace(/^\.?\//, "")}`;
}

function normalizeAssetUrls(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const value of values) {
    const normalized = normalizeAssetUrl(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}

function normalizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === "unresolved" || lowered === "awaiting id" || trimmed === "同定待ち") {
    return null;
  }
  return trimmed;
}

export function resolveLandingDisplayName(
  primaryName: string | null | undefined,
  identificationName: string | null | undefined,
  aiCandidateName: string | null | undefined,
): string {
  return normalizeDisplayName(primaryName)
    ?? normalizeDisplayName(identificationName)
    ?? normalizeDisplayName(aiCandidateName)
    ?? "同定待ち";
}

function landingMonthDay(raw: string | null | undefined): string {
  const value = raw?.trim();
  if (!value) return "";
  const direct = value.match(/(?:^|\D)(\d{4})-(\d{2})-(\d{2})(?:\D|$)/);
  if (direct) return `${direct[2]}-${direct[3]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
}

function normalizedKnownDummyName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isKnownLandingDummyObservation(input: {
  displayName?: string | null;
  aiCandidateName?: string | null;
  observedAt?: string | null;
}): boolean {
  const name = normalizedKnownDummyName(input.displayName ?? input.aiCandidateName);
  const monthDay = landingMonthDay(input.observedAt);
  if (!monthDay) return false;
  const isWinterFixtureDate = monthDay === "01-10" || monthDay === "02-17";
  if (!isWinterFixtureDate) return false;
  return name === "アブラゼミ" ||
    name === "graptopsaltria nigrofuscata" ||
    name === "アジサイ" ||
    name === "hydrangea macrophylla";
}

const LANDING_FIXTURE_MARKER_RE =
  /(?:e2e[-_]?test|fixture[-_]?prefix|prod[-_]?media[-_]?smoke|smoke[-_]?regression[-_]?fixture|smoke[-_]?ui(?:[-_]?local)?|staging[-_]?regression)/i;

export function isLandingFixtureObservation(input: {
  occurrenceId?: string | null;
  visitId?: string | null;
  displayName?: string | null;
  aiCandidateName?: string | null;
  observerName?: string | null;
  placeName?: string | null;
  municipality?: string | null;
  photoUrl?: string | null;
  photoUrls?: string[] | null;
}): boolean {
  const values = [
    input.occurrenceId,
    input.visitId,
    input.displayName,
    input.aiCandidateName,
    input.observerName,
    input.placeName,
    input.municipality,
    input.photoUrl,
    ...(input.photoUrls ?? []),
  ];
  return values.some((value) => typeof value === "string" && LANDING_FIXTURE_MARKER_RE.test(value));
}

function isLandingSuppressedObservation(input: {
  occurrenceId?: string | null;
  visitId?: string | null;
  displayName?: string | null;
  aiCandidateName?: string | null;
  observedAt?: string | null;
  observerName?: string | null;
  placeName?: string | null;
  municipality?: string | null;
  photoUrl?: string | null;
  photoUrls?: string[] | null;
}): boolean {
  return isKnownLandingDummyObservation(input) || isLandingFixtureObservation(input);
}

type FeedRow = {
  occurrence_id: string;
  visit_id: string;
  display_name: string | null;
  scientific_name: string | null;
  vernacular_name: string | null;
  identification_display_name: string | null;
  ai_candidate_name: string | null;
  ai_candidate_rank: string | null;
  is_ai_candidate: boolean | null;
  observed_at: string;
  observer_user_id: string | null;
  observer_name: string | null;
  observer_avatar_url: string | null;
  place_name: string | null;
  municipality: string | null;
  prefecture: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  photo_url: string | null;
  video_thumb_url: string | null;
  photo_urls: string[] | null;
  photo_count: string | number | null;
  photo_width_px: number | null;
  photo_height_px: number | null;
  photo_bytes: string | number | null;
  video_count: string | null;
  session_mode: string | null;
  visit_mode: string | null;
  record_mode: string | null;
  identification_count: string;
  evidence_tier: number | null;
  quality_grade: string | null;
};

type GuideTopRow = {
  guide_record_id: string;
  session_id: string;
  occurrence_id: string | null;
  has_promotable_audio: boolean | null;
  observer_user_id: string | null;
  observer_name: string | null;
  observer_avatar_url: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  scene_summary: string | null;
  detected_species: string[] | null;
  detected_features: unknown;
  captured_at: string | null;
  returned_at: string | null;
  created_at: string;
  frame_thumb: string | null;
  primary_subject: unknown;
  environment_context: string | null;
  seasonal_note: string | null;
};

const FEED_OBSERVER_NAME_SQL = buildObserverNameSql({
  userIdExpr: "v.user_id",
  displayNameExpr: "u.display_name",
  sourcePayloadExpr: "v.source_payload",
  guestFallback: "Guest",
  defaultFallback: "Unknown observer",
});

const AMBIENT_OBSERVER_NAME_SQL = buildObserverNameSql({
  userIdExpr: "latest.user_id",
  displayNameExpr: "u.display_name",
  sourcePayloadExpr: "latest.source_payload",
  guestFallback: "Guest",
  defaultFallback: "Observer",
});

const GUIDE_OBSERVER_NAME_SQL = buildObserverNameSql({
  userIdExpr: "gr.user_id",
  displayNameExpr: "u.display_name",
  guestFallback: "Guest",
  defaultFallback: "Observer",
});

const FEED_SQL_BASE = `
  select
    o.occurrence_id,
    o.visit_id,
    coalesce(
      nullif(o.vernacular_name, ''),
      nullif(o.scientific_name, ''),
      ident.display_name,
      nullif(ai.recommended_taxon_name, ''),
      '同定待ち'
    ) as display_name,
    o.scientific_name,
    o.vernacular_name,
    ident.display_name as identification_display_name,
    ai.recommended_taxon_name as ai_candidate_name,
    coalesce(ident.proposed_rank, ai.recommended_rank) as ai_candidate_rank,
    (coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, ''), ident.display_name) is null
      and nullif(ai.recommended_taxon_name, '') is not null) as is_ai_candidate,
    v.observed_at::text,
    v.user_id as observer_user_id,
    ${FEED_OBSERVER_NAME_SQL} as observer_name,
    avatar.public_url as observer_avatar_url,
    p.canonical_name as place_name,
    coalesce(v.observed_municipality, p.municipality) as municipality,
    coalesce(v.observed_prefecture, p.prefecture) as prefecture,
    coalesce(v.point_latitude, p.center_latitude) as latitude,
    coalesce(v.point_longitude, p.center_longitude) as longitude,
    photo.public_url as photo_url,
    video.thumb_url as video_thumb_url,
    photo.photo_urls,
    photo.photo_count,
    photo.width_px as photo_width_px,
    photo.height_px as photo_height_px,
    photo.bytes as photo_bytes,
    video.video_count,
    v.session_mode,
    v.visit_mode,
    v.source_payload->>'record_mode' as record_mode,
    (
      select count(*)::text
      from identifications i
      where i.occurrence_id = o.occurrence_id
    ) as identification_count,
    o.evidence_tier,
    o.quality_grade
  from occurrences o
  join visits v on v.visit_id = o.visit_id
  left join users u on u.user_id = v.user_id
  left join places p on p.place_id = v.place_id
  left join lateral (
    select recommended_taxon_name, recommended_rank
    from observation_ai_assessments a
    where a.occurrence_id = o.occurrence_id
    order by generated_at desc
    limit 1
  ) ai on true
  left join lateral (
    select
      case
        when btrim(i.proposed_name) = '' then null
        when lower(btrim(i.proposed_name)) in ('unresolved', 'awaiting id') then null
        when btrim(i.proposed_name) = '同定待ち' then null
        else btrim(i.proposed_name)
      end as display_name,
      i.proposed_rank
    from identifications i
    where i.occurrence_id = o.occurrence_id
      and coalesce(i.is_current, true)
    order by i.created_at desc
    limit 1
  ) ident on true
  left join lateral (
    select
      (array_agg(asset.public_url order by asset.sort_scope, asset.created_at asc))[1] as public_url,
      coalesce(array_agg(asset.public_url order by asset.sort_scope, asset.created_at asc) filter (where asset.public_url is not null), '{}'::text[]) as photo_urls,
      count(*)::text as photo_count,
      (array_agg(asset.width_px order by asset.sort_scope, asset.created_at asc))[1] as width_px,
      (array_agg(asset.height_px order by asset.sort_scope, asset.created_at asc))[1] as height_px,
      (array_agg(asset.bytes order by asset.sort_scope, asset.created_at asc))[1] as bytes
    from (
      select
        coalesce(ab.public_url, ab.storage_path) as public_url,
        ab.width_px,
        ab.height_px,
        ab.bytes,
        ea.created_at,
        case when ea.occurrence_id = o.occurrence_id then 0 else 1 end as sort_scope
      from evidence_assets ea
      join asset_blobs ab on ab.blob_id = ea.blob_id
      where (ea.occurrence_id = o.occurrence_id or ea.visit_id = o.visit_id)
        and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
    ) asset
  ) photo on true
  left join lateral (
    select
      count(*)::text as video_count,
      (array_agg(coalesce(ea.source_payload->>'thumbnail_url', ab.source_payload->>'thumbnail_url', ab.public_url, ab.storage_path, ab.source_payload->>'iframe_url') order by ea.created_at asc))[1] as thumb_url
    from evidence_assets ea
    join asset_blobs ab on ab.blob_id = ea.blob_id
    where (ea.occurrence_id = o.occurrence_id or ea.visit_id = o.visit_id)
      and ${VALID_OBSERVATION_VIDEO_ASSET_SQL}
  ) video on true
  left join lateral (
    select coalesce(ab.public_url, ab.storage_path) as public_url
    from evidence_assets ea
    join asset_blobs ab on ab.blob_id = ea.blob_id
    where ea.asset_id = u.avatar_asset_id
    limit 1
  ) avatar on true
`;

function landingLibrarySourceKind(row: FeedRow): LandingObservation["librarySourceKind"] {
  const sessionMode = String(row.session_mode ?? "").toLowerCase();
  const visitMode = String(row.visit_mode ?? "").toLowerCase();
  const recordMode = String(row.record_mode ?? "").toLowerCase();
  if (sessionMode === "fieldscan" || visitMode === "track") return "scan";
  if (sessionMode.includes("guide") || visitMode.includes("guide") || recordMode.includes("guide")) return "guide";
  if (Number(row.video_count ?? 0) > 0) return "video";
  if (row.photo_url) return "photo";
  return "note";
}

const PUBLIC_READ_FIXTURE_EXCLUSION_SQL = buildStagingFixtureExclusionSql({
  userIdColumn: "v.user_id",
  visitIdColumn: "v.visit_id",
  occurrenceIdColumn: "o.occurrence_id",
  visitSourceColumn: "coalesce(v.source_payload->>'source', '')",
  occurrenceSourceColumn: "coalesce(o.source_payload->>'source', '')",
});

const PUBLIC_READ_SYNTHETIC_EXCLUSION_SQL = `
  coalesce(u.is_seed, false) = false
  and coalesce(v.legacy_observation_id, '') !~* '^(dummy|seed|sample[-_])'
  and coalesce(o.legacy_observation_id, '') !~* '^(dummy|seed|sample[-_])'
  and coalesce(v.source_payload->>'import_source', '') !~* '^(dummy|seed)$'
  and coalesce(o.source_payload->>'import_source', '') !~* '^(dummy|seed)$'
  and coalesce(v.source_payload->>'source', '') !~* '^(dummy|seed|sample[-_])'
  and coalesce(o.source_payload->>'source', '') !~* '^(dummy|seed|sample[-_])'
`;

const AMBIENT_VISIT_FIXTURE_EXCLUSION_SQL = buildStagingFixtureExclusionSql({
  userIdColumn: "v.user_id",
  visitIdColumn: "v.visit_id",
  visitSourceColumn: "coalesce(v.source_payload->>'source', '')",
});

const AMBIENT_OCCURRENCE_FIXTURE_EXCLUSION_SQL = buildStagingFixtureExclusionSql({
  userIdColumn: "v2.user_id",
  visitIdColumn: "v2.visit_id",
  occurrenceIdColumn: "o.occurrence_id",
  visitSourceColumn: "coalesce(v2.source_payload->>'source', '')",
  occurrenceSourceColumn: "coalesce(o.source_payload->>'source', '')",
});

function toLandingObservation(row: FeedRow): LandingObservation {
  const latRaw = row.latitude;
  const lngRaw = row.longitude;
  const lat = latRaw === null || latRaw === undefined ? null : Number(latRaw);
  const lng = lngRaw === null || lngRaw === undefined ? null : Number(lngRaw);
  const safeLat = lat !== null && Number.isFinite(lat) ? lat : null;
  const safeLng = lng !== null && Number.isFinite(lng) ? lng : null;
  return {
    occurrenceId: row.occurrence_id,
    visitId: row.visit_id,
    displayName: resolveLandingDisplayName(row.display_name, row.identification_display_name, row.ai_candidate_name),
    scientificName: row.scientific_name,
    vernacularName: row.vernacular_name,
    aiCandidateName: row.ai_candidate_name ?? null,
    aiCandidateRank: row.ai_candidate_rank ?? null,
    isAiCandidate: Boolean(row.is_ai_candidate),
    observedAt: row.observed_at,
    observerName: row.observer_name ?? "",
    placeName: row.place_name ?? "",
    municipality: row.municipality,
    publicLocation: buildPublicLocationSummary({
      municipality: row.municipality,
      prefecture: row.prefecture,
      latitude: safeLat,
      longitude: safeLng,
    }),
    photoUrl: normalizeAssetUrl(row.photo_url),
    mediaUrl: normalizeAssetUrl(row.video_thumb_url),
    photoUrls: normalizeAssetUrls(row.photo_urls),
    photoCount: Math.max(0, Number(row.photo_count ?? 0) || 0),
    identificationCount: Number(row.identification_count),
    librarySourceKind: landingLibrarySourceKind(row),
    hasVideo: Number(row.video_count ?? 0) > 0,
    latitude: safeLat,
    longitude: safeLng,
    observerUserId: row.observer_user_id,
    observerAvatarUrl: normalizeAssetUrl(row.observer_avatar_url),
    entryType: "observation",
    evidenceTier: row.evidence_tier != null ? Number(row.evidence_tier) : null,
  };
}

function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function primarySubjectName(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function firstDetectedFeatureName(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const name = (item as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function guideDisplayName(row: GuideTopRow): string {
  return firstNonEmpty([
    primarySubjectName(row.primary_subject),
    ...(row.detected_species ?? []),
    firstDetectedFeatureName(row.detected_features),
    row.environment_context,
    row.scene_summary,
  ]) ?? "ガイドで見た自然";
}

function toLandingGuideItem(row: GuideTopRow): LandingTopGuideItem {
  const lat = toNumberOrNull(row.latitude);
  const lng = toNumberOrNull(row.longitude);
  const observedAt = row.captured_at ?? row.returned_at ?? row.created_at;
  const publicLocation = buildPublicLocationSummary({
    latitude: lat,
    longitude: lng,
  });
  const promotedOccurrenceId = row.occurrence_id?.trim() || null;
  const promotedVisitId = promotedOccurrenceId?.replace(/^occ:/, "").replace(/:0$/, "") ?? null;
  const promotionAction = promotedOccurrenceId
    ? "view_observation"
    : row.has_promotable_audio
      ? "promote"
      : "add_photo";
  return {
    topItemType: "guide",
    guideRecordId: row.guide_record_id,
    sessionId: row.session_id,
    promotedOccurrenceId,
    canPromote: promotionAction === "promote",
    promotionAction,
    displayName: guideDisplayName(row),
    summary: firstNonEmpty([row.scene_summary, row.environment_context, row.seasonal_note]),
    observedAt,
    observerName: row.observer_name ?? "Observer",
    observerUserId: row.observer_user_id,
    observerAvatarUrl: normalizeAssetUrl(row.observer_avatar_url),
    placeName: publicLocation.label,
    municipality: null,
    publicLocation,
    photoUrl: normalizeAssetUrl(row.frame_thumb),
    latitude: lat,
    longitude: lng,
    librarySourceKind: "guide",
    detectedSpecies: (row.detected_species ?? []).filter((name) => typeof name === "string" && name.trim()).slice(0, 8),
    identificationCount: 0,
    isAiCandidate: false,
    href: promotedOccurrenceId && promotedVisitId
      ? `/observations/${encodeURIComponent(promotedVisitId)}?occurrence=${encodeURIComponent(promotedOccurrenceId)}`
      : promotionAction === "add_photo"
        ? `/record?source=guide&guideRecordId=${encodeURIComponent(row.guide_record_id)}`
        : "/guide/outcomes",
  };
}

export type LandingHeroCandidate = LandingObservation & {
  photoWidthPx: number | null;
  photoHeightPx: number | null;
  photoBytes: number | null;
  qualityGrade: string | null;
};

export type LandingHeroScoreContext = {
  dateKey: string;
  now: Date;
  preferredMunicipalities: string[];
};

function toLandingHeroCandidate(row: FeedRow): LandingHeroCandidate {
  return {
    ...toLandingObservation(row),
    photoWidthPx: row.photo_width_px != null ? Number(row.photo_width_px) : null,
    photoHeightPx: row.photo_height_px != null ? Number(row.photo_height_px) : null,
    photoBytes: row.photo_bytes != null ? Number(row.photo_bytes) : null,
    qualityGrade: row.quality_grade ?? null,
  };
}

function monthDistance(left: number, right: number): number {
  const diff = Math.abs(left - right);
  return Math.min(diff, 12 - diff);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scoreSeason(candidate: LandingHeroCandidate, context: LandingHeroScoreContext): number {
  const observed = new Date(candidate.observedAt);
  if (Number.isNaN(observed.getTime())) return 0;
  const distance = monthDistance(observed.getUTCMonth(), context.now.getUTCMonth());
  if (distance === 0) return 25;
  if (distance === 1) return 18;
  if (distance === 2) return 10;
  return 4;
}

function scoreRegion(candidate: LandingHeroCandidate, context: LandingHeroScoreContext): number {
  const municipality = candidate.municipality?.trim();
  if (municipality && context.preferredMunicipalities.includes(municipality)) return 20;
  if (candidate.publicLocation.scope === "municipality") return context.preferredMunicipalities.length > 0 ? 10 : 14;
  if (candidate.publicLocation.scope === "prefecture") return context.preferredMunicipalities.length > 0 ? 6 : 10;
  return 0;
}

function scorePhoto(candidate: LandingHeroCandidate): number {
  if (!candidate.photoUrl) return 0;
  const width = candidate.photoWidthPx;
  const height = candidate.photoHeightPx;
  const bytes = candidate.photoBytes;
  if (!width || !height || width <= 0 || height <= 0) return bytes && bytes >= 90_000 ? 20 : 12;
  const ratio = width / height;
  if (ratio < 0.45 || ratio > 2.4) return 0;
  const pixels = width * height;
  if (bytes && pixels > 0 && (bytes < 70_000 || bytes / pixels < 0.035)) return 6;
  const ratioPenalty = ratio < 0.62 || ratio > 1.95 ? 5 : 0;
  if (pixels >= 1_080_000) return 25 - ratioPenalty;
  if (pixels >= 480_000) return 22 - ratioPenalty;
  if (pixels >= 172_800) return 18 - ratioPenalty;
  return Math.max(10, 14 - ratioPenalty);
}

function scoreEvidence(candidate: LandingHeroCandidate): number {
  const tier = candidate.evidenceTier ?? 0;
  if (tier >= 3) return 15;
  if (tier >= 2) return 12;
  if (tier >= 1) return 8;
  if (candidate.identificationCount >= 2) return 7;
  if (candidate.identificationCount >= 1) return 5;
  return 3;
}

function scoreFreshness(candidate: LandingHeroCandidate, context: LandingHeroScoreContext): number {
  const observed = new Date(candidate.observedAt);
  if (Number.isNaN(observed.getTime())) return 0;
  const ageDays = Math.max(0, (context.now.getTime() - observed.getTime()) / 86_400_000);
  if (ageDays <= 7) return 10;
  if (ageDays <= 30) return 7;
  if (ageDays <= 90) return 4;
  return 1;
}

function scoreDailyVariation(candidate: LandingHeroCandidate, context: LandingHeroScoreContext): number {
  return stableHash(`${context.dateKey}:${candidate.occurrenceId}:${candidate.visitId}`) % 6;
}

export function isLandingHeroCandidateEligible(candidate: LandingHeroCandidate): boolean {
  if (!candidate.photoUrl) return false;
  if (candidate.publicLocation.scope === "blurred") return false;
  const width = candidate.photoWidthPx;
  const height = candidate.photoHeightPx;
  const bytes = candidate.photoBytes;
  if (!width || !height || width <= 0 || height <= 0) return !bytes || bytes >= 90_000;
  const ratio = width / height;
  const pixels = width * height;
  if (ratio < 0.45 || ratio > 2.4) return false;
  if (pixels < 900_000 || Math.max(width, height) < 1000 || Math.min(width, height) < 720) return false;
  if (bytes && (bytes < 70_000 || bytes / pixels < 0.035)) return false;
  return true;
}

export function scoreLandingHeroCandidate(
  candidate: LandingHeroCandidate,
  context: LandingHeroScoreContext,
): LandingHeroScoreBreakdown {
  const breakdown = {
    season: scoreSeason(candidate, context),
    region: scoreRegion(candidate, context),
    photo: scorePhoto(candidate),
    evidence: scoreEvidence(candidate),
    freshness: scoreFreshness(candidate, context),
    dailyVariation: scoreDailyVariation(candidate, context),
    total: 0,
  };
  breakdown.total = Math.min(100, breakdown.season + breakdown.region + breakdown.photo + breakdown.evidence + breakdown.freshness + breakdown.dailyVariation);
  return breakdown;
}

function reasonFromBreakdown(breakdown: LandingHeroScoreBreakdown): LandingHeroReason {
  const ranked: Array<{ key: LandingHeroReason; score: number }> = [
    { key: "seasonal", score: breakdown.season },
    { key: "nearby", score: breakdown.region },
    { key: "vividPhoto", score: breakdown.photo },
    { key: "supported", score: breakdown.evidence },
    { key: "fresh", score: breakdown.freshness },
  ];
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.key ?? "seasonal";
}

function buildFeaturedObservation(
  candidates: LandingHeroCandidate[],
  context: LandingHeroScoreContext,
): LandingFeaturedObservation | null {
  const scored = candidates
    .filter(isLandingHeroCandidateEligible)
    .map((candidate) => {
      const scoreBreakdown = scoreLandingHeroCandidate(candidate, context);
      return {
        candidate,
        scoreBreakdown,
      };
    })
    .sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total);
  const best = scored[0];
  if (!best) return null;
  const { photoWidthPx: _photoWidthPx, photoHeightPx: _photoHeightPx, photoBytes: _photoBytes, qualityGrade: _qualityGrade, ...observation } = best.candidate;
  return {
    ...observation,
    score: best.scoreBreakdown.total,
    reasonKey: reasonFromBreakdown(best.scoreBreakdown),
    scoreBreakdown: best.scoreBreakdown,
  };
}

function buildPreferredMunicipalities(userId: string | null, myPlaces: LandingSnapshot["myPlaces"], publicFeed: LandingObservation[]): string[] {
  const values = userId
    ? myPlaces.map((place) => place.municipality).filter((value): value is string => Boolean(value))
    : publicFeed.map((obs) => obs.municipality).filter((value): value is string => Boolean(value));
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 5);
}

function buildLandingDailyCards(snapshot: Omit<LandingSnapshot, "dailyDashboard">): LandingDailyCard[] {
  const topMapCell = snapshot.mapPreviewCells[0] ?? null;
  const revisitPlace = snapshot.myPlaces[0] ?? null;
  const needsId = [...snapshot.myFeed, ...snapshot.feed].find((obs) => obs.isAiCandidate || obs.identificationCount === 0) ?? null;
  const regionalStory = snapshot.regionalStory ?? null;
  const cards: LandingDailyCard[] = [
    {
      kind: "recordToday",
      href: snapshot.viewerUserId && (snapshot.habit?.todayCount ?? 0) > 0 ? "/notes" : "/record",
      primaryText: null,
      secondaryText: null,
      metricValue: snapshot.habit?.todayCount ?? null,
    },
    {
      kind: "revisitPlace",
      href: snapshot.viewerUserId ? "/notes" : "/map",
      primaryText: revisitPlace?.placeName ?? topMapCell?.label ?? null,
      secondaryText: regionalStory?.placeHook ?? revisitPlace?.latestDisplayName ?? revisitPlace?.municipality ?? null,
      metricValue: revisitPlace?.visitCount ?? null,
      regionalStory,
    },
    {
      kind: "nearbyPulse",
      href: "/map",
      primaryText: topMapCell?.label ?? null,
      secondaryText: regionalStory?.nextObservationAngle ?? null,
      metricValue: topMapCell?.count ?? null,
      regionalStory,
    },
    {
      kind: "needsId",
      href: needsId ? `/observations/${encodeURIComponent(needsId.detailId ?? needsId.visitId ?? needsId.occurrenceId)}` : "/observations",
      primaryText: needsId?.displayName ?? null,
      secondaryText: needsId?.publicLocation.label ?? null,
      metricValue: needsId?.identificationCount ?? null,
      observation: needsId ?? undefined,
    },
  ];
  return cards;
}

function buildLandingDailyDashboard(
  snapshot: Omit<LandingSnapshot, "dailyDashboard">,
  heroCandidates: LandingHeroCandidate[],
): LandingDailyDashboard | null {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const context: LandingHeroScoreContext = {
    dateKey,
    now,
    preferredMunicipalities: buildPreferredMunicipalities(snapshot.viewerUserId, snapshot.myPlaces, snapshot.feed),
  };
  const featuredObservation = buildFeaturedObservation(heroCandidates, context);
  const seasonalStrip = heroCandidates
    .filter(isLandingHeroCandidateEligible)
    .map((candidate) => {
      const scoreBreakdown = scoreLandingHeroCandidate(candidate, context);
      return {
        observation: candidate,
        score: scoreBreakdown.total,
        reasonKey: reasonFromBreakdown(scoreBreakdown),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const dailyCards = buildLandingDailyCards(snapshot);
  return {
    dateKey,
    updatedAt: now.toISOString(),
    featuredObservation,
    dailyCards,
    seasonalStrip,
  };
}

type LandingTopShelfDefinition = {
  kind: LandingTopShelfKind;
  title: string;
  eyebrow: string;
  href: string;
  limit: number;
  cta?: LandingTopShelf["cta"];
  matches: (item: LandingTopShelfItem) => boolean;
};

function isLandingObservationItem(item: LandingTopShelfItem): item is LandingObservation {
  return "occurrenceId" in item;
}

const LANDING_TOP_SHELF_DEFINITIONS: LandingTopShelfDefinition[] = [
  {
    kind: "today",
    title: "みんなの発見",
    eyebrow: "LIVE FEED",
    href: "/observations",
    limit: 8,
    matches: () => true,
  },
  {
    kind: "photo",
    title: "写真",
    eyebrow: "PHOTO",
    href: "/observations?filter=photo",
    limit: 6,
    matches: (item) => isLandingObservationItem(item) && Boolean(item.photoUrl),
  },
  {
    kind: "video",
    title: "動画",
    eyebrow: "VIDEO",
    href: "/observations?filter=video",
    limit: 4,
    matches: (item) => isLandingObservationItem(item) && (Boolean(item.hasVideo) || item.librarySourceKind === "video"),
    cta: {
      title: "動きのある記録を増やす",
      body: "鳴き声、歩き方、羽ばたきは写真だけでは残りません。動画で短く残せます。",
      href: "/record?start=video",
      actionLabel: "動画を記録する",
    },
  },
  {
    kind: "guide",
    title: "ガイドで見つけたこと",
    eyebrow: "GUIDE",
    href: "/guide",
    limit: 4,
    matches: (observation) => observation.librarySourceKind === "guide",
    cta: {
      title: "観察ガイドから歩く",
      body: "場所や季節に合わせた見どころをたどると、次に見返す手がかりが決まりやすくなります。",
      href: "/guide",
      actionLabel: "ガイドを見る",
    },
  },
  {
    kind: "scan",
    title: "スキャンから見えたもの",
    eyebrow: "SCAN",
    href: "/lens",
    limit: 4,
    matches: (observation) => observation.librarySourceKind === "scan",
    cta: {
      title: "現地をスキャンする",
      body: "写真、音、場所の手がかりを束ねて、あとから確かめられる観察にできます。",
      href: "/lens",
      actionLabel: "スキャンを始める",
    },
  },
  {
    kind: "needsId",
    title: "名前を待つ記録",
    eyebrow: "IDENTIFY",
    href: "/observations?filter=needs_id",
    limit: 6,
    matches: (item) => isLandingObservationItem(item) && (item.isAiCandidate === true || item.identificationCount === 0),
  },
];

type LandingTopSelectionState = {
  globalUserCounts: Map<string, number>;
};

function landingObserverKey(item: LandingTopShelfItem): string | null {
  const userId = item.observerUserId?.trim();
  if (userId) return `user:${userId}`;
  const observerName = item.observerName?.trim();
  return observerName ? `name:${observerName}` : null;
}

function landingAreaKey(item: LandingTopShelfItem): string {
  if (item.publicLocation.cellId) return item.publicLocation.cellId;
  return (item.publicLocation.label || item.municipality || item.placeName || "").trim();
}

function daysSince(observedAt: string, now: Date): number {
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return 365;
  return Math.max(0, (now.getTime() - observed.getTime()) / 86_400_000);
}

function scoreLandingTopCandidate(
  item: LandingTopShelfItem,
  shelfKind: LandingTopShelfKind,
  now: Date,
  preferredMunicipalities: string[],
): number {
  let score = 0;
  if (item.photoUrl) score += 24;
  if (isLandingObservationItem(item) && (item.photoCount ?? 0) >= 2) score += 4;
  if (isLandingObservationItem(item) && (item.hasVideo || item.librarySourceKind === "video")) score += shelfKind === "video" ? 30 : 8;
  if (item.topItemType === "guide" && shelfKind === "guide") score += 35;
  if (item.librarySourceKind === shelfKind) score += 26;
  if (isLandingObservationItem(item) && shelfKind === "needsId" && (item.isAiCandidate || item.identificationCount === 0)) score += 28;
  if (isLandingObservationItem(item) && item.identificationCount === 0) score += 7;
  if (isLandingObservationItem(item) && item.isAiCandidate) score += 5;
  if (isLandingObservationItem(item) && item.evidenceTier && item.evidenceTier >= 2) score += 8;
  const municipality = item.municipality?.trim();
  if (municipality && preferredMunicipalities.includes(municipality)) score += 10;
  else if (item.publicLocation.scope === "municipality") score += 6;
  const ageDays = daysSince(item.observedAt, now);
  if (ageDays <= 7) score += 14;
  else if (ageDays <= 30) score += 10;
  else if (ageDays <= 90) score += 5;
  const observed = new Date(item.observedAt);
  if (!Number.isNaN(observed.getTime())) {
    const distance = monthDistance(observed.getUTCMonth(), now.getUTCMonth());
    score += distance === 0 ? 12 : distance === 1 ? 8 : distance === 2 ? 4 : 1;
  }
  score += stableHash(`${shelfKind}:${landingTopItemId(item)}`) % 5;
  return score;
}

function landingTopItemId(item: LandingTopShelfItem): string {
  if ("guideRecordId" in item) return `guide:${item.guideRecordId}`;
  return `observation:${item.occurrenceId}`;
}

function isGuideRecordTopItem(item: LandingTopShelfItem): item is LandingTopGuideItem {
  return item.topItemType === "guide";
}

function uniqueLandingObservationList(observations: LandingObservation[]): LandingObservation[] {
  const seen = new Set<string>();
  const unique: LandingObservation[] = [];
  for (const observation of observations) {
    if (seen.has(observation.occurrenceId)) continue;
    seen.add(observation.occurrenceId);
    unique.push(observation);
  }
  return unique;
}

function uniqueLandingTopItemList(items: LandingTopShelfItem[]): LandingTopShelfItem[] {
  const seen = new Set<string>();
  const unique: LandingTopShelfItem[] = [];
  for (const item of items) {
    const key = landingTopItemId(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function selectLandingShelfItems(
  candidates: LandingTopShelfItem[],
  definition: LandingTopShelfDefinition,
  state: LandingTopSelectionState,
  now: Date,
  preferredMunicipalities: string[],
): LandingTopShelfItem[] {
  const ranked = candidates
    .filter(definition.matches)
    .map((observation) => ({
      observation,
      areaKey: landingAreaKey(observation),
      observerKey: landingObserverKey(observation),
      score: scoreLandingTopCandidate(observation, definition.kind, now, preferredMunicipalities),
    }))
    .sort((a, b) => b.score - a.score || b.observation.observedAt.localeCompare(a.observation.observedAt));

  const picked: typeof ranked = [];
  const shelfObserverKeys = new Set<string>();
  for (let pass = 0; pass < 2 && picked.length < definition.limit; pass += 1) {
    for (const candidate of ranked) {
      if (picked.includes(candidate)) continue;
      const bypassObserverDiversity = definition.kind === "guide" && isGuideRecordTopItem(candidate.observation);
      if (candidate.observerKey) {
        if (!bypassObserverDiversity && shelfObserverKeys.has(candidate.observerKey)) continue;
        if (!bypassObserverDiversity && (state.globalUserCounts.get(candidate.observerKey) ?? 0) >= 3) continue;
      }
      const previous = picked[picked.length - 1];
      if (pass === 0 && previous?.areaKey && candidate.areaKey && previous.areaKey === candidate.areaKey) continue;
      picked.push(candidate);
      if (candidate.observerKey && !bypassObserverDiversity) {
        shelfObserverKeys.add(candidate.observerKey);
        state.globalUserCounts.set(candidate.observerKey, (state.globalUserCounts.get(candidate.observerKey) ?? 0) + 1);
      }
      if (picked.length >= definition.limit) break;
    }
  }
  return picked.map((item) => item.observation);
}

function buildLandingOverflowSummaries(observations: LandingObservation[]): LandingTopOverflowSummary[] {
  const groups = new Map<string, LandingObservation[]>();
  for (const observation of observations) {
    const userId = observation.observerUserId?.trim();
    if (!userId) continue;
    const group = groups.get(userId) ?? [];
    group.push(observation);
    groups.set(userId, group);
  }
  return Array.from(groups.entries())
    .map(([observerUserId, group]) => {
      const sorted = [...group].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
      const sampleObservation = sorted[0];
      if (!sampleObservation || sorted.length <= 3) return null;
      return {
        observerUserId,
        observerName: sampleObservation.observerName || "Observer",
        count: sorted.length - 3,
        latestObservedAt: sampleObservation.observedAt,
        sampleObservation,
      } satisfies LandingTopOverflowSummary;
    })
    .filter((summary): summary is LandingTopOverflowSummary => Boolean(summary))
    .sort((a, b) => b.count - a.count || b.latestObservedAt.localeCompare(a.latestObservedAt))
    .slice(0, 3);
}

export function buildLandingTopShelves(
  observations: LandingObservation[],
  options: {
    now?: Date;
    preferredMunicipalities?: string[];
    extraItems?: LandingTopShelfItem[];
  } = {},
): {
  shelves: LandingTopShelf[];
  overflowSummaries: LandingTopOverflowSummary[];
} {
  const now = options.now ?? new Date();
  const preferredMunicipalities = options.preferredMunicipalities ?? [];
  const observationCandidates = uniqueLandingObservationList(filterLandingDummyObservations(observations));
  const extraCandidates = (options.extraItems ?? []).filter((item) => !isLandingSuppressedObservation({
    occurrenceId: "occurrenceId" in item ? item.occurrenceId : item.guideRecordId,
    visitId: "visitId" in item ? item.visitId : item.sessionId,
    displayName: item.displayName,
    aiCandidateName: "aiCandidateName" in item ? item.aiCandidateName : null,
    observedAt: item.observedAt,
    observerName: item.observerName,
    placeName: item.placeName,
    municipality: item.municipality,
    photoUrl: item.photoUrl,
  }));
  const personalGuideCandidates = extraCandidates.filter(isGuideRecordTopItem);
  const sharedExtraCandidates = extraCandidates.filter((item) => !isGuideRecordTopItem(item));
  const candidates = uniqueLandingTopItemList([...observationCandidates, ...sharedExtraCandidates]);
  const state: LandingTopSelectionState = {
    globalUserCounts: new Map<string, number>(),
  };
  const shelves = LANDING_TOP_SHELF_DEFINITIONS.map((definition) => {
    const isPersonalGuideShelf = definition.kind === "guide" && personalGuideCandidates.length > 0;
    return {
      kind: definition.kind,
      title: isPersonalGuideShelf ? "自分のガイド成果" : definition.title,
      eyebrow: isPersonalGuideShelf ? "MY GUIDE" : definition.eyebrow,
      href: isPersonalGuideShelf ? "/guide/outcomes" : definition.href,
      items: selectLandingShelfItems(
        isPersonalGuideShelf ? personalGuideCandidates : candidates,
        definition,
        state,
        now,
        preferredMunicipalities,
      ),
      cta: definition.cta,
    };
  });
  return {
    shelves: collapseVideoShelfIntoEvidenceShelf(shelves),
    overflowSummaries: buildLandingOverflowSummaries(observationCandidates),
  };
}

function collapseVideoShelfIntoEvidenceShelf(shelves: LandingTopShelf[]): LandingTopShelf[] {
  const videoShelf = shelves.find((shelf) => shelf.kind === "video");
  const photoShelf = shelves.find((shelf) => shelf.kind === "photo");
  if (!photoShelf) return shelves.filter((shelf) => shelf.kind !== "video");

  const mergedMediaItems = uniqueLandingTopItemList([...photoShelf.items, ...(videoShelf?.items ?? [])]).slice(0, 6);
  return shelves
    .map((shelf) => {
      if (shelf.kind !== "photo") return shelf;
      return {
        ...shelf,
        title: "写真と動画",
        eyebrow: "MEDIA",
        href: "/observations",
        items: mergedMediaItems,
      };
    })
    .filter((shelf) => shelf.kind !== "video");
}

type IdentificationRow = {
  identification_id: string;
  created_at: string;
  proposed_name: string;
  proposed_rank: string | null;
  occurrence_id: string;
  visit_id: string;
  observation_display_name: string | null;
  scientific_name: string | null;
  vernacular_name: string | null;
  ai_candidate_name: string | null;
  observed_at: string;
  observer_user_id: string | null;
  observer_name: string | null;
  observer_avatar_url: string | null;
  place_name: string | null;
  municipality: string | null;
  prefecture: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  photo_url: string | null;
  identification_count: string;
};

function toIdentificationEntry(row: IdentificationRow): LandingObservation {
  const lat = row.latitude === null || row.latitude === undefined ? null : Number(row.latitude);
  const lng = row.longitude === null || row.longitude === undefined ? null : Number(row.longitude);
  const safeLat = lat !== null && Number.isFinite(lat) ? lat : null;
  const safeLng = lng !== null && Number.isFinite(lng) ? lng : null;
  return {
    occurrenceId: row.occurrence_id,
    visitId: row.visit_id,
    displayName: resolveLandingDisplayName(row.proposed_name, row.observation_display_name, row.ai_candidate_name),
    scientificName: row.scientific_name,
    vernacularName: row.vernacular_name,
    aiCandidateName: row.ai_candidate_name,
    observedAt: row.observed_at,
    observerName: row.observer_name ?? "",
    placeName: row.place_name ?? "",
    municipality: row.municipality,
    publicLocation: buildPublicLocationSummary({
      municipality: row.municipality,
      prefecture: row.prefecture,
      latitude: safeLat,
      longitude: safeLng,
    }),
    photoUrl: normalizeAssetUrl(row.photo_url),
    identificationCount: Number(row.identification_count),
    librarySourceKind: "note",
    hasVideo: false,
    latitude: safeLat,
    longitude: safeLng,
    observerUserId: row.observer_user_id,
    observerAvatarUrl: normalizeAssetUrl(row.observer_avatar_url),
    entryType: "identification",
    proposedName: row.proposed_name,
    identifiedAt: row.created_at,
  };
}

function filterLandingDummyObservations<T extends {
  occurrenceId?: string | null;
  visitId?: string | null;
  displayName?: string | null;
  aiCandidateName?: string | null;
  observedAt?: string | null;
  observerName?: string | null;
  placeName?: string | null;
  municipality?: string | null;
  photoUrl?: string | null;
  photoUrls?: string[] | null;
}>(observations: T[]): T[] {
  return observations.filter((observation) => !isLandingSuppressedObservation(observation));
}

function filterLandingDummyPlaces(places: LandingSnapshot["myPlaces"]): LandingSnapshot["myPlaces"] {
  return places.filter((place) =>
    !isLandingSuppressedObservation({
      displayName: place.latestDisplayName,
      observedAt: place.lastObservedAt,
    }),
  );
}

function isLandingSuppressedFeedRow(row: FeedRow): boolean {
  return isLandingSuppressedObservation({
    occurrenceId: row.occurrence_id,
    visitId: row.visit_id,
    displayName: resolveLandingDisplayName(row.display_name, row.identification_display_name, row.ai_candidate_name),
    aiCandidateName: row.ai_candidate_name,
    observedAt: row.observed_at,
    observerName: row.observer_name,
    placeName: row.place_name,
    municipality: row.municipality,
    photoUrl: row.photo_url,
    photoUrls: row.photo_urls,
  });
}

function buildMapPreviewCells(rows: FeedRow[]): LandingMapPreviewCell[] {
  const groups = new Map<string, {
    count: number;
    localityInputs: Array<{ municipality?: string | null; prefecture?: string | null }>;
  }>();

  for (const row of rows) {
    const location = buildPublicLocationSummary({
      municipality: row.municipality,
      prefecture: row.prefecture,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
    });
    if (!location.cellId) continue;
    if (!groups.has(location.cellId)) {
      groups.set(location.cellId, {
        count: 0,
        localityInputs: [],
      });
    }
    const group = groups.get(location.cellId)!;
    group.count += 1;
    group.localityInputs.push({
      municipality: row.municipality,
      prefecture: row.prefecture,
    });
  }

  const cells: LandingMapPreviewCell[] = Array.from(groups.entries())
    .map(([cellId, group]) => {
      const parts = parsePublicCellId(cellId);
      if (!parts) return null;
      const geometry = buildPublicCellGeometry(parts);
      const locality = summarizePublicLocalitySet(group.localityInputs);
      const name = buildPublicMapCellName({
        localityLabel: locality.label,
        localityScope: locality.scope,
        gridM: parts.gridM,
        count: group.count,
      });
      const cell: LandingMapPreviewCell = {
        cellId,
        label: locality.label,
        albumName: name.albumName,
        themeLabel: name.themeLabel,
        scaleLabel: name.scaleLabel,
        count: group.count,
        gridM: parts.gridM,
        centroidLat: geometry.centroidLat,
        centroidLng: geometry.centroidLng,
        polygon: geometry.ring,
      };
      return cell;
    })
    .filter((cell): cell is LandingMapPreviewCell => Boolean(cell))
    .sort((a, b) => b.count - a.count);
  return cells
    .slice(0, 18);
}

/** Compute streak from a descending list of ISO date strings (YYYY-MM-DD). */
function computeStreakFromDays(days: string[], todayIso: string, yesterdayIso: string): number {
  if (days.length === 0) return 0;
  const daySet = new Set(days);
  // Streak only counts if it reaches today or yesterday — otherwise the
  // anchor is lost and streak is 0 even if there's a long run in the past.
  let cursor: string = "";
  if (daySet.has(todayIso)) {
    cursor = todayIso;
  } else if (daySet.has(yesterdayIso)) {
    cursor = yesterdayIso;
  } else {
    return 0;
  }
  let streak = 0;
  while (daySet.has(cursor)) {
    streak += 1;
    const prev = new Date(`${cursor}T00:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    cursor = prev.toISOString().slice(0, 10);
  }
  return streak;
}

export async function getLandingSnapshot(userId: string | null): Promise<LandingSnapshot> {
  let pool;
  try {
    pool = getPool();
  } catch {
    const emptySnapshot = {
      viewerUserId: userId,
      stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
      feed: [],
      myFeed: [],
      topShelves: [],
      overflowSummaries: [],
      myPlaces: [],
      mapPreviewCells: [],
      ambient: [],
      habit: null,
    } satisfies Omit<LandingSnapshot, "dailyDashboard">;
    return {
      ...emptySnapshot,
      dailyDashboard: buildLandingDailyDashboard(emptySnapshot, []),
      regionalStory: null,
    };
  }

  // Public feed (all observers), fetched wide so the top can select for diversity
  // before rendering shelves.
  let feedRows: FeedRow[] = [];
  try {
    const result = await pool.query<FeedRow>(
      `${FEED_SQL_BASE} where ${PUBLIC_READ_FIXTURE_EXCLUSION_SQL} and ${PUBLIC_READ_SYNTHETIC_EXCLUSION_SQL} and ${PUBLIC_OBSERVATION_QUALITY_SQL} and ${PUBLIC_OBSERVATION_HAS_VALID_MEDIA_SQL} order by v.observed_at desc limit 120`,
    );
    feedRows = result.rows;
  } catch {
    feedRows = [];
  }

  let heroCandidateRows: FeedRow[] = [];
  try {
    const result = await pool.query<FeedRow>(
      `${FEED_SQL_BASE} where photo.public_url is not null and ${PUBLIC_READ_FIXTURE_EXCLUSION_SQL} and ${PUBLIC_READ_SYNTHETIC_EXCLUSION_SQL} and ${PUBLIC_OBSERVATION_QUALITY_SQL} and ${PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL} order by v.observed_at desc limit 60`,
    );
    heroCandidateRows = result.rows;
  } catch {
    heroCandidateRows = [];
  }

  let guideTopRows: GuideTopRow[] = [];
  if (userId) {
    try {
      const result = await pool.query<GuideTopRow>(
        `select
            gr.guide_record_id::text as guide_record_id,
            gr.session_id,
            gr.occurrence_id,
            gr.user_id as observer_user_id,
            ${GUIDE_OBSERVER_NAME_SQL} as observer_name,
            avatar.public_url as observer_avatar_url,
            gr.lat as latitude,
            gr.lng as longitude,
            gr.scene_summary,
            gr.detected_species,
            gr.detected_features,
            gr.created_at::text as created_at,
            gls.captured_at::text as captured_at,
            gls.returned_at::text as returned_at,
            gls.frame_thumb,
            gls.primary_subject,
            gls.environment_context,
            gls.seasonal_note,
            exists (
              select 1
                from audio_segments audio
               where audio.session_id = gr.session_id
                 and audio.user_id = gr.user_id
                 and audio.blob_id is not null
                 and audio.privacy_status = 'clean'
                 and coalesce(audio.voice_flag, false) = false
                 and coalesce(audio.transcription_status, 'pending') <> 'skipped'
                 and abs(extract(epoch from (audio.recorded_at - coalesce(gls.captured_at, gls.returned_at, gr.created_at)))) <= 120
               limit 1
            ) as has_promotable_audio
          from guide_records gr
          left join guide_record_latency_states gls on gls.guide_record_id = gr.guide_record_id
          left join users u on u.user_id = gr.user_id
          left join lateral (
            select coalesce(ab.public_url, ab.storage_path) as public_url
            from evidence_assets ea
            join asset_blobs ab on ab.blob_id = ea.blob_id
            where ea.asset_id = u.avatar_asset_id
            limit 1
          ) avatar on true
          where gr.user_id = $1
            and coalesce(gls.delivery_state, 'ready') <> 'archived'
            and (nullif(btrim(coalesce(gr.scene_summary, '')), '') is not null
              or gls.primary_subject <> '{}'::jsonb
              or coalesce(array_length(gr.detected_species, 1), 0) > 0)
          order by coalesce(gls.captured_at, gls.returned_at, gr.created_at) desc
          limit 80`,
        [userId],
      );
      guideTopRows = result.rows;
    } catch {
      guideTopRows = [];
    }
  }

  // Viewer own feed (if logged in) — own observation library, including review rows that need media recovery.
  let myFeedRows: FeedRow[] = [];
  if (userId) {
    try {
      const result = await pool.query<FeedRow>(
        `${FEED_SQL_BASE} where v.user_id = $1 and ${PUBLIC_READ_SYNTHETIC_EXCLUSION_SQL} and coalesce(v.public_visibility, 'public') <> 'hidden' order by v.observed_at desc limit 72`,
        [userId],
      );
      myFeedRows = result.rows;
    } catch {
      myFeedRows = [];
    }
  }

  // Viewer own identifications on other people's observations — additional notebook pages
  let myIdentificationRows: IdentificationRow[] = [];
  if (userId) {
    try {
      const result = await pool.query<IdentificationRow>(
        `select
           i.identification_id,
           i.created_at::text as created_at,
           i.proposed_name,
           i.proposed_rank,
           o.occurrence_id,
           o.visit_id,
           coalesce(o.vernacular_name, o.scientific_name, ident.display_name, ai.recommended_taxon_name, '同定待ち') as observation_display_name,
           o.scientific_name,
           o.vernacular_name,
           ai.recommended_taxon_name as ai_candidate_name,
           v.observed_at::text,
           v.user_id as observer_user_id,
           ${FEED_OBSERVER_NAME_SQL} as observer_name,
           avatar.public_url as observer_avatar_url,
           p.canonical_name as place_name,
           coalesce(v.observed_municipality, p.municipality) as municipality,
           coalesce(v.observed_prefecture, p.prefecture) as prefecture,
           coalesce(v.point_latitude, p.center_latitude) as latitude,
           coalesce(v.point_longitude, p.center_longitude) as longitude,
           photo.public_url as photo_url,
           (
             select count(*)::text
             from identifications i2
             where i2.occurrence_id = o.occurrence_id
           ) as identification_count
         from identifications i
         join occurrences o on o.occurrence_id = i.occurrence_id
         join visits v on v.visit_id = o.visit_id
         left join users u on u.user_id = v.user_id
         left join places p on p.place_id = v.place_id
         left join lateral (
           select coalesce(ab.public_url, ab.storage_path) as public_url
           from evidence_assets ea
           join asset_blobs ab on ab.blob_id = ea.blob_id
           where (ea.occurrence_id = o.occurrence_id or ea.visit_id = o.visit_id)
             and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
           order by
             case when ea.occurrence_id = o.occurrence_id then 0 else 1 end,
             ea.created_at asc
           limit 1
         ) photo on true
         left join lateral (
           select
             case
               when btrim(i2.proposed_name) = '' then null
               when lower(btrim(i2.proposed_name)) in ('unresolved', 'awaiting id') then null
               when btrim(i2.proposed_name) = '同定待ち' then null
               else btrim(i2.proposed_name)
             end as display_name
           from identifications i2
           where i2.occurrence_id = o.occurrence_id
             and coalesce(i2.is_current, true)
           order by i2.created_at desc
           limit 1
         ) ident on true
         left join lateral (
           select recommended_taxon_name
           from observation_ai_assessments a
           where a.occurrence_id = o.occurrence_id
           order by generated_at desc
           limit 1
         ) ai on true
         left join lateral (
           select coalesce(ab.public_url, ab.storage_path) as public_url
           from evidence_assets ea
           join asset_blobs ab on ab.blob_id = ea.blob_id
           where ea.asset_id = u.avatar_asset_id
           limit 1
         ) avatar on true
         where i.actor_user_id = $1
           and ${PUBLIC_READ_SYNTHETIC_EXCLUSION_SQL}
           and ${PUBLIC_OBSERVATION_QUALITY_SQL}
           and ${PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL}
         order by i.created_at desc
         limit 24`,
        [userId],
      );
      myIdentificationRows = result.rows;
    } catch {
      myIdentificationRows = [];
    }
  }

  // My places via existing home snapshot
  let myPlaces: LandingSnapshot["myPlaces"] = [];
  if (userId) {
    try {
      const home = await getHomeSnapshot(userId);
      myPlaces = home.myPlaces;
    } catch {
      myPlaces = [];
    }
  }

  // Habit stats — computed from visits directly so the streak is accurate
  // beyond the myFeed page size. Dates are pulled bounded at 60 days for
  // streak, plus today/week totals are counted unbounded.
  let habit: LandingHabitStats | null = null;
  if (userId) {
    try {
      const [todayRes, weekRes, lastRes, daysRes] = await Promise.all([
        pool.query<{ c: string }>(
          `select count(*)::text as c from visits where user_id = $1 and observed_at::date = current_date`,
          [userId],
        ),
        pool.query<{ c: string }>(
          `select count(*)::text as c from visits where user_id = $1 and observed_at::date >= date_trunc('week', current_date)::date`,
          [userId],
        ),
        pool.query<{ days: string | null }>(
          `select (current_date - max(observed_at::date))::text as days from visits where user_id = $1`,
          [userId],
        ),
        pool.query<{ d: string }>(
          `select distinct to_char(observed_at::date, 'YYYY-MM-DD') as d
             from visits
            where user_id = $1
              and observed_at::date > current_date - interval '60 days'
            order by d desc`,
          [userId],
        ),
      ]);
      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayIso = yesterday.toISOString().slice(0, 10);
      const days = daysRes.rows.map((row) => row.d);
      habit = {
        todayCount: Number(todayRes.rows[0]?.c ?? 0),
        thisWeekCount: Number(weekRes.rows[0]?.c ?? 0),
        activeDaysLast60: days.length,
        daysSinceLast: lastRes.rows[0]?.days === null || lastRes.rows[0]?.days === undefined
          ? null
          : Number(lastRes.rows[0].days),
        streak: computeStreakFromDays(days, todayIso, yesterdayIso),
      };
    } catch {
      habit = null;
    }
  }

  // Stats
  let stats: LandingStats = { observationCount: 0, speciesCount: 0, placeCount: 0 };
  try {
    const statsResult = await pool.query<{
      observation_count: string | number;
      species_count: string | number;
      place_count: string | number;
    }>(
      `select
         (select count(*) from occurrences o join visits v on v.visit_id = o.visit_id where ${PUBLIC_OBSERVATION_QUALITY_SQL} and ${PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL}) as observation_count,
         (select count(distinct o.scientific_name) from occurrences o join visits v on v.visit_id = o.visit_id where o.scientific_name is not null and o.scientific_name <> '' and ${PUBLIC_OBSERVATION_QUALITY_SQL} and ${PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL}) as species_count,
         (select count(*) from places) as place_count`,
    );
    const row = statsResult.rows[0];
    if (row) {
      stats = {
        observationCount: Number(row.observation_count) || 0,
        speciesCount: Number(row.species_count) || 0,
        placeCount: Number(row.place_count) || 0,
      };
    }
  } catch {
    // keep zero stats
  }

  // Ambient presence: distinct recent observers
  let ambient: AmbientObserver[] = [];
  try {
    const ambientResult = await pool.query<{
      user_id: string;
      display_name: string | null;
      avatar_url: string | null;
      latest_photo_url: string | null;
      latest_observed_at: string;
      latest_display_name: string | null;
    }>(
      `with latest_photo_visits as (
         select distinct on (v.user_id)
           v.user_id,
           v.visit_id,
           v.observed_at as latest_observed_at,
           v.source_payload,
           coalesce(v.observed_municipality, p.municipality) as municipality,
           coalesce(v.observed_prefecture, p.prefecture) as prefecture,
           coalesce(v.point_latitude, p.center_latitude) as latitude,
           coalesce(v.point_longitude, p.center_longitude) as longitude,
           photo.public_url as latest_photo_url
         from visits v
         left join places p on p.place_id = v.place_id
         join lateral (
           select coalesce(ab.public_url, ab.storage_path) as public_url
           from occurrences o
           join evidence_assets ea
             on (ea.occurrence_id = o.occurrence_id or ea.visit_id = v.visit_id)
           join asset_blobs ab on ab.blob_id = ea.blob_id
           where o.visit_id = v.visit_id
             and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
           order by ea.created_at asc
           limit 1
         ) photo on true
         where v.user_id is not null
           and ${AMBIENT_VISIT_FIXTURE_EXCLUSION_SQL}
           and coalesce(v.legacy_observation_id, '') !~* '^(dummy|seed|sample[-_])'
           and coalesce(v.source_payload->>'import_source', '') !~* '^(dummy|seed)$'
           and coalesce(v.source_payload->>'source', '') !~* '^(dummy|seed|sample[-_])'
           and ${PUBLIC_OBSERVATION_QUALITY_SQL}
           and ${PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL}
         order by v.user_id, v.observed_at desc
       )
       select
         latest.user_id,
         ${AMBIENT_OBSERVER_NAME_SQL} as display_name,
         avatar.public_url as avatar_url,
         latest.latest_photo_url,
         latest.latest_observed_at::text as latest_observed_at,
         latest_obs.display_name as latest_display_name
       from latest_photo_visits latest
       left join users u on u.user_id = latest.user_id
       left join lateral (
         select coalesce(
                  nullif(o.vernacular_name, ''),
                  nullif(o.scientific_name, ''),
                  nullif((select recommended_taxon_name from observation_ai_assessments a where a.occurrence_id = o.occurrence_id order by generated_at desc limit 1), ''),
                  '同定待ち'
                ) as display_name
         from occurrences o
         join visits v2 on v2.visit_id = o.visit_id
         where v2.visit_id = latest.visit_id
           and ${AMBIENT_OCCURRENCE_FIXTURE_EXCLUSION_SQL}
           and coalesce(v2.public_visibility, 'public') = 'public'
           and coalesce(v2.quality_review_status, 'accepted') = 'accepted'
         order by o.subject_index asc, o.created_at asc
         limit 1
       ) latest_obs on true
       left join lateral (
         select count(distinct v3.visit_id)::int as nearby_photo_visits
         from visits v3
         left join places p3 on p3.place_id = v3.place_id
         where coalesce(v3.public_visibility, 'public') = 'public'
           and coalesce(v3.quality_review_status, 'accepted') = 'accepted'
           and v3.observed_at >= now() - interval '90 days'
           and exists (
             select 1
             from occurrences o3
             join evidence_assets ea3
               on (ea3.occurrence_id = o3.occurrence_id or ea3.visit_id = v3.visit_id)
              join asset_blobs ab3 on ab3.blob_id = ea3.blob_id
             where o3.visit_id = v3.visit_id
              and ea3.asset_role = 'observation_photo'
              and coalesce(nullif(lower(ea3.source_payload->>'asset_exists'), ''), 'true') not in ('false', '0', 'no')
              and coalesce(nullif(lower(ab3.source_payload->>'asset_exists'), ''), 'true') not in ('false', '0', 'no')
              and nullif(coalesce(ab3.public_url, ab3.storage_path), '') is not null
           )
           and (
             (latest.municipality is not null and coalesce(v3.observed_municipality, p3.municipality) = latest.municipality)
             or (
               latest.latitude is not null
               and latest.longitude is not null
               and coalesce(v3.point_latitude, p3.center_latitude) between latest.latitude - 0.12 and latest.latitude + 0.12
               and coalesce(v3.point_longitude, p3.center_longitude) between latest.longitude - 0.12 and latest.longitude + 0.12
             )
           )
       ) local_activity on true
       left join lateral (
         select coalesce(ab.public_url, ab.storage_path) as public_url
         from evidence_assets ea
         join asset_blobs ab on ab.blob_id = ea.blob_id
         where ea.asset_id = u.avatar_asset_id
         limit 1
       ) avatar on true
       order by
         coalesce(local_activity.nearby_photo_visits, 0) desc,
         case when latest.latest_observed_at >= now() - interval '14 days' then 1 else 0 end desc,
         latest.latest_observed_at desc
       limit 8`,
    );
    ambient = ambientResult.rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name ?? "Observer",
      avatarUrl: normalizeAssetUrl(row.avatar_url),
      latestPhotoUrl: normalizeAssetUrl(row.latest_photo_url),
      latestObservedAt: row.latest_observed_at,
      latestDisplayName: row.latest_display_name ?? "同定待ち",
    })).filter((observer) => !isLandingFixtureObservation({
      observerName: observer.displayName,
      displayName: observer.latestDisplayName,
      photoUrl: observer.avatarUrl,
      photoUrls: observer.latestPhotoUrl ? [observer.latestPhotoUrl] : [],
    }));
  } catch {
    ambient = [];
  }

  // Merge own observations + own identifications into myFeed, sorted by timestamp desc,
  // so that the "your notebook" stream shows both kinds of pages in one timeline.
  const filteredFeedRows = feedRows.filter((row) => !isLandingSuppressedFeedRow(row));
  const ownObservationEntries = myFeedRows.map(toLandingObservation);
  const ownIdentificationEntries = myIdentificationRows.map(toIdentificationEntry);
  const publicFeedAll = filteredFeedRows.map(toLandingObservation);
  const guideItems = guideTopRows
    .map(toLandingGuideItem)
    .filter((item) => !isLandingSuppressedObservation({
      occurrenceId: item.guideRecordId,
      visitId: item.sessionId,
      displayName: item.displayName,
      observedAt: item.observedAt,
      observerName: item.observerName,
      placeName: item.placeName,
      municipality: item.municipality,
      photoUrl: item.photoUrl,
    }));
  const filteredMyPlaces = filterLandingDummyPlaces(myPlaces);
  const topSelection = buildLandingTopShelves(publicFeedAll, {
    preferredMunicipalities: buildPreferredMunicipalities(userId, filteredMyPlaces, publicFeedAll),
    extraItems: guideItems,
  });
  const selectedFeed = uniqueLandingObservationList(topSelection.shelves.flatMap((shelf) => shelf.items).filter(isLandingObservationItem));
  const publicFeed = selectedFeed.length > 0 ? selectedFeed.slice(0, 24) : publicFeedAll.slice(0, 12);
  const combined = filterLandingDummyObservations([...ownObservationEntries, ...ownIdentificationEntries]).sort((a, b) => {
    const aTs = (a.entryType === "identification" ? a.identifiedAt : a.observedAt) ?? "";
    const bTs = (b.entryType === "identification" ? b.identifiedAt : b.observedAt) ?? "";
    return bTs.localeCompare(aTs);
  });
  const regionalStoryPlace = filteredMyPlaces[0]
    ? {
        placeId: filteredMyPlaces[0].placeId,
        placeName: filteredMyPlaces[0].placeName,
        municipality: filteredMyPlaces[0].municipality,
        latitude: filteredMyPlaces[0].latitude,
        longitude: filteredMyPlaces[0].longitude,
        allowPrecisePlaceLabel: true,
      }
    : publicFeed[0]
      ? {
          placeId: null,
          placeName: publicFeed[0].placeName,
          municipality: publicFeed[0].municipality,
          latitude: publicFeed[0].latitude,
          longitude: publicFeed[0].longitude,
          publicLabel: publicFeed[0].publicLocation.label,
          allowPrecisePlaceLabel: false,
        }
      : {
          municipality: "浜松市",
          publicLabel: "浜松市",
          allowPrecisePlaceLabel: false,
        };
  const regionalStory = await getRegionalStoryCue({
    surface: "landing",
    viewerUserId: userId,
    place: regionalStoryPlace,
    observation: publicFeed[0]
      ? {
          observationId: publicFeed[0].occurrenceId,
          observedAt: publicFeed[0].observedAt,
          displayName: publicFeed[0].displayName,
        }
      : undefined,
    maxCards: 1,
  }).catch(() => null);

  const snapshotWithoutDashboard = {
    viewerUserId: userId,
    stats,
    feed: publicFeed,
    myFeed: combined.slice(0, 96),
    topShelves: topSelection.shelves,
    overflowSummaries: topSelection.overflowSummaries,
    myPlaces: filteredMyPlaces,
    mapPreviewCells: buildMapPreviewCells(filteredFeedRows),
    ambient,
    habit,
    regionalStory,
  } satisfies Omit<LandingSnapshot, "dailyDashboard">;

  return {
    ...snapshotWithoutDashboard,
    dailyDashboard: buildLandingDailyDashboard(
      snapshotWithoutDashboard,
      filterLandingDummyObservations(heroCandidateRows.map(toLandingHeroCandidate)),
    ),
  };
}
