import { getPool } from "../db.js";
import { getHomeSnapshot } from "./readModels.js";
import { buildObserverNameSql } from "./observerNameSql.js";
import {
  buildPublicCellGeometry,
  buildPublicLocationSummary,
  parsePublicCellId,
  summarizePublicLocalitySet,
} from "./publicLocation.js";
import { buildStagingFixtureExclusionSql } from "./stagingFixtureGuard.js";
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

type FeedRow = {
  occurrence_id: string;
  visit_id: string;
  display_name: string | null;
  observed_at: string;
  observer_user_id: string | null;
  observer_name: string | null;
  observer_avatar_url: string | null;
  ai_candidate_name: string | null;
  ai_candidate_rank: string | null;
  is_ai_candidate: boolean | null;
  place_name: string | null;
  municipality: string | null;
  prefecture: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  photo_url: string | null;
  photo_width_px: number | null;
  photo_height_px: number | null;
  identification_count: string;
  evidence_tier: number | null;
  quality_grade: string | null;
};

const FEED_OBSERVER_NAME_SQL = buildObserverNameSql({
  userIdExpr: "v.user_id",
  displayNameExpr: "u.display_name",
  sourcePayloadExpr: "v.source_payload",
  guestFallback: "Guest",
  defaultFallback: "Unknown observer",
});

const AMBIENT_OBSERVER_NAME_SQL = buildObserverNameSql({
  userIdExpr: "u.user_id",
  displayNameExpr: "u.display_name",
  sourcePayloadExpr: "latest.source_payload",
  guestFallback: "Guest",
  defaultFallback: "Observer",
});

const FEED_SQL_BASE = `
  select
    o.occurrence_id,
    o.visit_id,
    coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name,
    v.observed_at::text,
    v.user_id as observer_user_id,
    ${FEED_OBSERVER_NAME_SQL} as observer_name,
    avatar.public_url as observer_avatar_url,
    ai.recommended_taxon_name as ai_candidate_name,
    ai.recommended_rank as ai_candidate_rank,
    (coalesce(o.quality_grade, '') = 'needs_review'
      and nullif(ai.recommended_taxon_name, '') is not null) as is_ai_candidate,
    coalesce(p.canonical_name, 'Unknown place') as place_name,
    coalesce(v.observed_municipality, p.municipality) as municipality,
    coalesce(v.observed_prefecture, p.prefecture) as prefecture,
    coalesce(v.point_latitude, p.center_latitude) as latitude,
    coalesce(v.point_longitude, p.center_longitude) as longitude,
    photo.public_url as photo_url,
    photo.width_px as photo_width_px,
    photo.height_px as photo_height_px,
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
    select coalesce(ab.public_url, ab.storage_path) as public_url, ab.width_px, ab.height_px
    from evidence_assets ea
    join asset_blobs ab on ab.blob_id = ea.blob_id
    where ea.occurrence_id = o.occurrence_id
      and ea.asset_role = 'observation_photo'
    order by ea.created_at asc
    limit 1
  ) photo on true
  left join lateral (
    select coalesce(ab.public_url, ab.storage_path) as public_url
    from asset_blobs ab
    where ab.blob_id = u.avatar_asset_id
    limit 1
  ) avatar on true
`;

const PUBLIC_READ_FIXTURE_EXCLUSION_SQL = buildStagingFixtureExclusionSql({
  userIdColumn: "v.user_id",
  visitIdColumn: "v.visit_id",
  occurrenceIdColumn: "o.occurrence_id",
  visitSourceColumn: "coalesce(v.source_payload->>'source', '')",
  occurrenceSourceColumn: "coalesce(o.source_payload->>'source', '')",
});

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

const AMBIENT_USER_FIXTURE_EXCLUSION_SQL = buildStagingFixtureExclusionSql({
  userIdColumn: "u.user_id",
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
    displayName: row.display_name ?? "Unresolved",
    observedAt: row.observed_at,
    observerName: row.observer_name ?? "Unknown observer",
    placeName: row.place_name ?? "Unknown place",
    municipality: row.municipality,
    publicLocation: buildPublicLocationSummary({
      municipality: row.municipality,
      prefecture: row.prefecture,
      latitude: safeLat,
      longitude: safeLng,
    }),
    photoUrl: normalizeAssetUrl(row.photo_url),
    identificationCount: Number(row.identification_count),
    latitude: safeLat,
    longitude: safeLng,
    observerUserId: row.observer_user_id,
    observerAvatarUrl: normalizeAssetUrl(row.observer_avatar_url),
    aiCandidateName: row.ai_candidate_name ?? null,
    aiCandidateRank: row.ai_candidate_rank ?? null,
    isAiCandidate: Boolean(row.is_ai_candidate),
    entryType: "observation",
    evidenceTier: row.evidence_tier != null ? Number(row.evidence_tier) : null,
  };
}

export type LandingHeroCandidate = LandingObservation & {
  photoWidthPx: number | null;
  photoHeightPx: number | null;
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
  if (!width || !height || width <= 0 || height <= 0) return 20;
  const ratio = width / height;
  if (ratio < 0.45 || ratio > 2.4) return 0;
  const pixels = width * height;
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
  if (!width || !height || width <= 0 || height <= 0) return true;
  const ratio = width / height;
  return ratio >= 0.45 && ratio <= 2.4;
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
  const { photoWidthPx: _photoWidthPx, photoHeightPx: _photoHeightPx, qualityGrade: _qualityGrade, ...observation } = best.candidate;
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
      secondaryText: revisitPlace?.municipality ?? null,
      metricValue: revisitPlace?.visitCount ?? null,
    },
    {
      kind: "nearbyPulse",
      href: "/map",
      primaryText: topMapCell?.label ?? null,
      secondaryText: null,
      metricValue: topMapCell?.count ?? null,
    },
    {
      kind: "needsId",
      href: needsId ? `/observations/${encodeURIComponent(needsId.detailId ?? needsId.visitId ?? needsId.occurrenceId)}` : "/explore",
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

type IdentificationRow = {
  identification_id: string;
  created_at: string;
  proposed_name: string;
  proposed_rank: string | null;
  occurrence_id: string;
  visit_id: string;
  observation_display_name: string | null;
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
    displayName: row.proposed_name,
    observedAt: row.observed_at,
    observerName: row.observer_name ?? "Unknown observer",
    placeName: row.place_name ?? "Unknown place",
    municipality: row.municipality,
    publicLocation: buildPublicLocationSummary({
      municipality: row.municipality,
      prefecture: row.prefecture,
      latitude: safeLat,
      longitude: safeLng,
    }),
    photoUrl: normalizeAssetUrl(row.photo_url),
    identificationCount: Number(row.identification_count),
    latitude: safeLat,
    longitude: safeLng,
    observerUserId: row.observer_user_id,
    observerAvatarUrl: normalizeAssetUrl(row.observer_avatar_url),
    entryType: "identification",
    proposedName: row.proposed_name,
    identifiedAt: row.created_at,
  };
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

  return Array.from(groups.entries())
    .map(([cellId, group]) => {
      const parts = parsePublicCellId(cellId);
      if (!parts) return null;
      const geometry = buildPublicCellGeometry(parts);
      const locality = summarizePublicLocalitySet(group.localityInputs);
      return {
        cellId,
        label: locality.label,
        count: group.count,
        gridM: parts.gridM,
        centroidLat: geometry.centroidLat,
        centroidLng: geometry.centroidLng,
        polygon: geometry.ring,
      } satisfies LandingMapPreviewCell;
    })
    .filter((cell): cell is LandingMapPreviewCell => Boolean(cell))
    .sort((a, b) => b.count - a.count)
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
      myPlaces: [],
      mapPreviewCells: [],
      ambient: [],
      habit: null,
    } satisfies Omit<LandingSnapshot, "dailyDashboard">;
    return {
      ...emptySnapshot,
      dailyDashboard: buildLandingDailyDashboard(emptySnapshot, []),
    };
  }

  // Public feed (all observers), latest 12 — photo-only (skip sketch/no-photo cards)
  let feedRows: FeedRow[] = [];
  try {
    const result = await pool.query<FeedRow>(
      `${FEED_SQL_BASE} where photo.public_url is not null and ${PUBLIC_READ_FIXTURE_EXCLUSION_SQL} order by v.observed_at desc limit 12`,
    );
    feedRows = result.rows;
  } catch {
    feedRows = [];
  }

  let heroCandidateRows: FeedRow[] = [];
  try {
    const result = await pool.query<FeedRow>(
      `${FEED_SQL_BASE} where photo.public_url is not null and ${PUBLIC_READ_FIXTURE_EXCLUSION_SQL} order by v.observed_at desc limit 60`,
    );
    heroCandidateRows = result.rows;
  } catch {
    heroCandidateRows = [];
  }

  // Viewer own feed (if logged in) — own observations, photo-only
  let myFeedRows: FeedRow[] = [];
  if (userId) {
    try {
      const result = await pool.query<FeedRow>(
        `${FEED_SQL_BASE} where v.user_id = $1 and photo.public_url is not null order by v.observed_at desc limit 6`,
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
           coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as observation_display_name,
           v.observed_at::text,
           v.user_id as observer_user_id,
           ${FEED_OBSERVER_NAME_SQL} as observer_name,
           avatar.public_url as observer_avatar_url,
           coalesce(p.canonical_name, 'Unknown place') as place_name,
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
           where ea.occurrence_id = o.occurrence_id
             and ea.asset_role = 'observation_photo'
           order by ea.created_at asc
           limit 1
         ) photo on true
         left join lateral (
           select coalesce(ab.public_url, ab.storage_path) as public_url
           from asset_blobs ab
           where ab.blob_id = u.avatar_asset_id
           limit 1
         ) avatar on true
         where i.actor_user_id = $1
         order by i.created_at desc
         limit 6`,
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
         (select count(*) from occurrences) as observation_count,
         (select count(distinct scientific_name) from occurrences where scientific_name is not null and scientific_name <> '') as species_count,
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
      latest_observed_at: string;
      latest_display_name: string | null;
    }>(
      `select
         u.user_id,
         ${AMBIENT_OBSERVER_NAME_SQL} as display_name,
         avatar.public_url as avatar_url,
         latest.latest_observed_at::text as latest_observed_at,
         latest_obs.display_name as latest_display_name
       from users u
       join lateral (
         select v.user_id, v.observed_at as latest_observed_at, v.source_payload
         from visits v
         where v.user_id = u.user_id
           and ${AMBIENT_VISIT_FIXTURE_EXCLUSION_SQL}
         order by v.observed_at desc
         limit 1
       ) latest on true
       left join lateral (
         select coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name
         from occurrences o
         join visits v2 on v2.visit_id = o.visit_id
         where v2.user_id = u.user_id
           and ${AMBIENT_OCCURRENCE_FIXTURE_EXCLUSION_SQL}
         order by v2.observed_at desc
         limit 1
       ) latest_obs on true
       left join lateral (
         select coalesce(ab.public_url, ab.storage_path) as public_url
         from asset_blobs ab
         where ab.blob_id = u.avatar_asset_id
         limit 1
       ) avatar on true
       where ${AMBIENT_USER_FIXTURE_EXCLUSION_SQL}
       order by latest.latest_observed_at desc
       limit 8`,
    );
    ambient = ambientResult.rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name ?? "Observer",
      avatarUrl: normalizeAssetUrl(row.avatar_url),
      latestObservedAt: row.latest_observed_at,
      latestDisplayName: row.latest_display_name ?? "Unresolved",
    }));
  } catch {
    ambient = [];
  }

  // Merge own observations + own identifications into myFeed, sorted by timestamp desc,
  // so that the "your notebook" stream shows both kinds of pages in one timeline.
  const ownObservationEntries = myFeedRows.map(toLandingObservation);
  const ownIdentificationEntries = myIdentificationRows.map(toIdentificationEntry);
  const publicFeed = feedRows.map(toLandingObservation);
  const combined = [...ownObservationEntries, ...ownIdentificationEntries].sort((a, b) => {
    const aTs = (a.entryType === "identification" ? a.identifiedAt : a.observedAt) ?? "";
    const bTs = (b.entryType === "identification" ? b.identifiedAt : b.observedAt) ?? "";
    return bTs.localeCompare(aTs);
  });

  const snapshotWithoutDashboard = {
    viewerUserId: userId,
    stats,
    feed: publicFeed,
    myFeed: combined.slice(0, 12),
    myPlaces,
    mapPreviewCells: buildMapPreviewCells(feedRows),
    ambient,
    habit,
  } satisfies Omit<LandingSnapshot, "dailyDashboard">;

  return {
    ...snapshotWithoutDashboard,
    dailyDashboard: buildLandingDailyDashboard(
      snapshotWithoutDashboard,
      heroCandidateRows.map(toLandingHeroCandidate),
    ),
  };
}
