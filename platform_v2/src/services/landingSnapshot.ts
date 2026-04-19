import { getPool } from "../db.js";
import { getHomeSnapshot } from "./readModels.js";
import { buildStagingFixtureExclusionSql } from "./stagingFixtureGuard.js";
import type {
  AmbientObserver,
  LandingHabitStats,
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
  place_name: string | null;
  municipality: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  photo_url: string | null;
  identification_count: string;
  evidence_tier: number | null;
};

const FEED_SQL_BASE = `
  select
    o.occurrence_id,
    o.visit_id,
    coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name,
    v.observed_at::text,
    v.user_id as observer_user_id,
    coalesce(u.display_name, 'Unknown observer') as observer_name,
    avatar.public_url as observer_avatar_url,
    coalesce(p.canonical_name, 'Unknown place') as place_name,
    coalesce(v.observed_municipality, p.municipality) as municipality,
    coalesce(v.point_latitude, p.center_latitude) as latitude,
    coalesce(v.point_longitude, p.center_longitude) as longitude,
    photo.public_url as photo_url,
    (
      select count(*)::text
      from identifications i
      where i.occurrence_id = o.occurrence_id
    ) as identification_count,
    o.evidence_tier
  from occurrences o
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
  return {
    occurrenceId: row.occurrence_id,
    visitId: row.visit_id,
    displayName: row.display_name ?? "Unresolved",
    observedAt: row.observed_at,
    observerName: row.observer_name ?? "Unknown observer",
    placeName: row.place_name ?? "Unknown place",
    municipality: row.municipality,
    photoUrl: normalizeAssetUrl(row.photo_url),
    identificationCount: Number(row.identification_count),
    latitude: lat !== null && Number.isFinite(lat) ? lat : null,
    longitude: lng !== null && Number.isFinite(lng) ? lng : null,
    observerUserId: row.observer_user_id,
    observerAvatarUrl: normalizeAssetUrl(row.observer_avatar_url),
    entryType: "observation",
    evidenceTier: row.evidence_tier != null ? Number(row.evidence_tier) : null,
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
  latitude: string | number | null;
  longitude: string | number | null;
  photo_url: string | null;
  identification_count: string;
};

function toIdentificationEntry(row: IdentificationRow): LandingObservation {
  const lat = row.latitude === null || row.latitude === undefined ? null : Number(row.latitude);
  const lng = row.longitude === null || row.longitude === undefined ? null : Number(row.longitude);
  return {
    occurrenceId: row.occurrence_id,
    visitId: row.visit_id,
    displayName: row.proposed_name,
    observedAt: row.observed_at,
    observerName: row.observer_name ?? "Unknown observer",
    placeName: row.place_name ?? "Unknown place",
    municipality: row.municipality,
    photoUrl: normalizeAssetUrl(row.photo_url),
    identificationCount: Number(row.identification_count),
    latitude: lat !== null && Number.isFinite(lat) ? lat : null,
    longitude: lng !== null && Number.isFinite(lng) ? lng : null,
    observerUserId: row.observer_user_id,
    observerAvatarUrl: normalizeAssetUrl(row.observer_avatar_url),
    entryType: "identification",
    proposedName: row.proposed_name,
    identifiedAt: row.created_at,
  };
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
    return {
      viewerUserId: userId,
      stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
      feed: [],
      myFeed: [],
      myPlaces: [],
      ambient: [],
      habit: null,
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
           coalesce(u.display_name, 'Unknown observer') as observer_name,
           avatar.public_url as observer_avatar_url,
           coalesce(p.canonical_name, 'Unknown place') as place_name,
           coalesce(v.observed_municipality, p.municipality) as municipality,
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
         u.display_name,
         avatar.public_url as avatar_url,
         latest.latest_observed_at::text as latest_observed_at,
         latest_obs.display_name as latest_display_name
       from users u
       join lateral (
         select v.user_id, max(v.observed_at) as latest_observed_at
         from visits v
         where v.user_id = u.user_id
           and ${AMBIENT_VISIT_FIXTURE_EXCLUSION_SQL}
         group by v.user_id
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
  const combined = [...ownObservationEntries, ...ownIdentificationEntries].sort((a, b) => {
    const aTs = (a.entryType === "identification" ? a.identifiedAt : a.observedAt) ?? "";
    const bTs = (b.entryType === "identification" ? b.identifiedAt : b.observedAt) ?? "";
    return bTs.localeCompare(aTs);
  });

  return {
    viewerUserId: userId,
    stats,
    feed: feedRows.map(toLandingObservation),
    myFeed: combined.slice(0, 12),
    myPlaces,
    ambient,
    habit,
  };
}
