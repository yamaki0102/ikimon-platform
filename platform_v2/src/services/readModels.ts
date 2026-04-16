import { getPool } from "../db.js";

type RecentObservation = {
  occurrenceId: string;
  visitId: string;
  displayName: string;
  observedAt: string;
  observerName: string;
  placeName: string;
  municipality: string | null;
  photoUrl: string | null;
  identificationCount: number;
};

type HomePlace = {
  placeId: string;
  placeName: string;
  municipality: string | null;
  lastObservedAt: string;
  visitCount: number;
};

export type HomeSnapshot = {
  viewerUserId: string | null;
  recentObservations: RecentObservation[];
  myPlaces: HomePlace[];
};

export type ObservationDetailSnapshot = {
  occurrenceId: string;
  visitId: string;
  observerUserId: string | null;
  displayName: string;
  scientificName: string | null;
  observedAt: string;
  note: string | null;
  observerName: string;
  placeName: string;
  municipality: string | null;
  photoUrls: string[];
  identifications: Array<{
    proposedName: string;
    proposedRank: string | null;
    notes: string | null;
    actorName: string;
    createdAt: string;
  }>;
};

export type ProfileSnapshot = {
  userId: string;
  displayName: string;
  rankLabel: string | null;
  recentPlaces: HomePlace[];
  recentObservations: RecentObservation[];
};

export type ExploreSnapshot = {
  recentObservations: RecentObservation[];
  municipalities: Array<{
    municipality: string;
    observationCount: number;
  }>;
  topTaxa: Array<{
    displayName: string;
    observationCount: number;
  }>;
};

export type SpecialistSnapshot = {
  lane: "default" | "public-claim" | "expert-lane" | "review-queue";
  summary: {
    totalOccurrences: number;
    unresolvedOccurrences: number;
    identificationCount: number;
    observationPhotoAssets: number;
  };
  queue: RecentObservation[];
};

function normalizeAssetUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }
  return `/${value.replace(/^\.?\//, "")}`;
}

export async function getHomeSnapshot(userId: string | null): Promise<HomeSnapshot> {
  const pool = getPool();
  const recentResult = await pool.query<{
    occurrence_id: string;
    visit_id: string;
    display_name: string | null;
    observed_at: string;
    observer_name: string | null;
    place_name: string | null;
    municipality: string | null;
    photo_url: string | null;
    identification_count: string;
  }>(
    `select
        o.occurrence_id,
        o.visit_id,
        coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name,
        v.observed_at::text,
        coalesce(u.display_name, 'Unknown observer') as observer_name,
        coalesce(p.canonical_name, 'Unknown place') as place_name,
        coalesce(v.observed_municipality, p.municipality) as municipality,
        photo.public_url as photo_url,
        (
          select count(*)::text
          from identifications i
          where i.occurrence_id = o.occurrence_id
        ) as identification_count
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
     order by v.observed_at desc
     limit 12`,
  );

  let myPlaces: HomePlace[] = [];
  if (userId) {
    const placesResult = await pool.query<{
      place_id: string;
      place_name: string | null;
      municipality: string | null;
      last_observed_at: string;
      visit_count: string;
    }>(
      `select
          p.place_id,
          p.canonical_name as place_name,
          p.municipality,
          max(v.observed_at)::text as last_observed_at,
          count(*)::text as visit_count
       from visits v
       join places p on p.place_id = v.place_id
       where v.user_id = $1
       group by p.place_id, p.canonical_name, p.municipality
       order by max(v.observed_at) desc
       limit 6`,
      [userId],
    );

    myPlaces = placesResult.rows.map((row) => ({
      placeId: row.place_id,
      placeName: row.place_name ?? "Unknown place",
      municipality: row.municipality,
      lastObservedAt: row.last_observed_at,
      visitCount: Number(row.visit_count),
    }));
  }

  return {
    viewerUserId: userId,
    recentObservations: recentResult.rows.map((row) => ({
      occurrenceId: row.occurrence_id,
      visitId: row.visit_id,
      displayName: row.display_name ?? "Unresolved",
      observedAt: row.observed_at,
      observerName: row.observer_name ?? "Unknown observer",
      placeName: row.place_name ?? "Unknown place",
      municipality: row.municipality,
      photoUrl: normalizeAssetUrl(row.photo_url),
      identificationCount: Number(row.identification_count),
    })),
    myPlaces,
  };
}

export async function getExploreSnapshot(): Promise<ExploreSnapshot> {
  const pool = getPool();
  const recentResult = await pool.query<{
    occurrence_id: string;
    visit_id: string;
    display_name: string | null;
    observed_at: string;
    observer_name: string | null;
    place_name: string | null;
    municipality: string | null;
    photo_url: string | null;
    identification_count: string;
  }>(
    `select
        o.occurrence_id,
        o.visit_id,
        coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name,
        v.observed_at::text,
        coalesce(u.display_name, 'Unknown observer') as observer_name,
        coalesce(p.canonical_name, 'Unknown place') as place_name,
        coalesce(v.observed_municipality, p.municipality) as municipality,
        photo.public_url as photo_url,
        (
          select count(*)::text
          from identifications i
          where i.occurrence_id = o.occurrence_id
        ) as identification_count
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
     order by v.observed_at desc
     limit 18`,
  );

  const municipalitiesResult = await pool.query<{
    municipality: string | null;
    observation_count: string;
  }>(
    `select
        coalesce(v.observed_municipality, p.municipality, 'Municipality unknown') as municipality,
        count(*)::text as observation_count
     from occurrences o
     join visits v on v.visit_id = o.visit_id
     left join places p on p.place_id = v.place_id
     group by 1
     order by count(*) desc, municipality asc
     limit 6`,
  );

  const taxaResult = await pool.query<{
    display_name: string | null;
    observation_count: string;
  }>(
    `select
        coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name,
        count(*)::text as observation_count
     from occurrences o
     group by 1
     order by count(*) desc, display_name asc
     limit 6`,
  );

  return {
    recentObservations: recentResult.rows.map((row) => ({
      occurrenceId: row.occurrence_id,
      visitId: row.visit_id,
      displayName: row.display_name ?? "Unresolved",
      observedAt: row.observed_at,
      observerName: row.observer_name ?? "Unknown observer",
      placeName: row.place_name ?? "Unknown place",
      municipality: row.municipality,
      photoUrl: normalizeAssetUrl(row.photo_url),
      identificationCount: Number(row.identification_count),
    })),
    municipalities: municipalitiesResult.rows.map((row) => ({
      municipality: row.municipality ?? "Municipality unknown",
      observationCount: Number(row.observation_count),
    })),
    topTaxa: taxaResult.rows.map((row) => ({
      displayName: row.display_name ?? "Unresolved",
      observationCount: Number(row.observation_count),
    })),
  };
}

export async function getObservationDetailSnapshot(id: string): Promise<ObservationDetailSnapshot | null> {
  const pool = getPool();
  const detailResult = await pool.query<{
    occurrence_id: string;
    visit_id: string;
    observer_user_id: string | null;
    display_name: string | null;
    scientific_name: string | null;
    observed_at: string;
    note: string | null;
    observer_name: string | null;
    place_name: string | null;
    municipality: string | null;
  }>(
    `select
        o.occurrence_id,
        o.visit_id,
        v.user_id as observer_user_id,
        coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name,
        o.scientific_name,
        v.observed_at::text,
        v.note,
        coalesce(u.display_name, 'Unknown observer') as observer_name,
        coalesce(p.canonical_name, 'Unknown place') as place_name,
        coalesce(v.observed_municipality, p.municipality) as municipality
     from occurrences o
     join visits v on v.visit_id = o.visit_id
     left join users u on u.user_id = v.user_id
     left join places p on p.place_id = v.place_id
     where o.occurrence_id = $1
        or v.visit_id = $1
        or o.legacy_observation_id = $1
     order by v.observed_at desc
     limit 1`,
    [id],
  );

  const base = detailResult.rows[0];
  if (!base) {
    return null;
  }

  const photosResult = await pool.query<{ photo_url: string | null }>(
    `select coalesce(ab.public_url, ab.storage_path) as photo_url
     from evidence_assets ea
     join asset_blobs ab on ab.blob_id = ea.blob_id
     where ea.occurrence_id = $1
       and ea.asset_role = 'observation_photo'
     order by ea.created_at asc`,
    [base.occurrence_id],
  );

  const identificationsResult = await pool.query<{
    proposed_name: string;
    proposed_rank: string | null;
    notes: string | null;
    actor_name: string | null;
    created_at: string;
  }>(
    `select
        i.proposed_name,
        i.proposed_rank,
        i.notes,
        coalesce(u.display_name, 'Community') as actor_name,
        i.created_at::text
     from identifications i
     left join users u on u.user_id = i.actor_user_id
     where i.occurrence_id = $1
     order by i.created_at desc
     limit 8`,
    [base.occurrence_id],
  );

  return {
    occurrenceId: base.occurrence_id,
    visitId: base.visit_id,
    observerUserId: base.observer_user_id,
    displayName: base.display_name ?? "Unresolved",
    scientificName: base.scientific_name,
    observedAt: base.observed_at,
    note: base.note,
    observerName: base.observer_name ?? "Unknown observer",
    placeName: base.place_name ?? "Unknown place",
    municipality: base.municipality,
    photoUrls: photosResult.rows.map((row) => normalizeAssetUrl(row.photo_url)).filter((value): value is string => Boolean(value)),
    identifications: identificationsResult.rows.map((row) => ({
      proposedName: row.proposed_name,
      proposedRank: row.proposed_rank,
      notes: row.notes,
      actorName: row.actor_name ?? "Community",
      createdAt: row.created_at,
    })),
  };
}

export async function getProfileSnapshot(userId: string): Promise<ProfileSnapshot | null> {
  const pool = getPool();
  const userResult = await pool.query<{
    user_id: string;
    display_name: string;
    rank_label: string | null;
  }>(
    `select user_id, display_name, rank_label
     from users
     where user_id = $1
     limit 1`,
    [userId],
  );

  const user = userResult.rows[0];
  if (!user) {
    return null;
  }

  const home = await getHomeSnapshot(userId);
  const recentObservationsResult = await pool.query<{
    occurrence_id: string;
    visit_id: string;
    display_name: string | null;
    observed_at: string;
    observer_name: string | null;
    place_name: string | null;
    municipality: string | null;
    photo_url: string | null;
    identification_count: string;
  }>(
    `select
        o.occurrence_id,
        o.visit_id,
        coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name,
        v.observed_at::text,
        coalesce(u.display_name, 'Unknown observer') as observer_name,
        coalesce(p.canonical_name, 'Unknown place') as place_name,
        coalesce(v.observed_municipality, p.municipality) as municipality,
        photo.public_url as photo_url,
        (
          select count(*)::text
          from identifications i
          where i.occurrence_id = o.occurrence_id
        ) as identification_count
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
     where v.user_id = $1
     order by v.observed_at desc
     limit 8`,
    [userId],
  );

  return {
    userId: user.user_id,
    displayName: user.display_name,
    rankLabel: user.rank_label,
    recentPlaces: home.myPlaces,
    recentObservations: recentObservationsResult.rows.map((row) => ({
      occurrenceId: row.occurrence_id,
      visitId: row.visit_id,
      displayName: row.display_name ?? "Unresolved",
      observedAt: row.observed_at,
      observerName: row.observer_name ?? "Unknown observer",
      placeName: row.place_name ?? "Unknown place",
      municipality: row.municipality,
      photoUrl: normalizeAssetUrl(row.photo_url),
      identificationCount: Number(row.identification_count),
    })),
  };
}

export async function getSpecialistSnapshot(
  lane: SpecialistSnapshot["lane"],
): Promise<SpecialistSnapshot> {
  const pool = getPool();
  const [summaryResult, queueResult] = await Promise.all([
    pool.query<{
      total_occurrences: string;
      unresolved_occurrences: string;
      identification_count: string;
      observation_photo_assets: string;
    }>(
      `select
          (select count(*)::text from occurrences) as total_occurrences,
          (select count(*)::text from occurrences where scientific_name is null or scientific_name = '') as unresolved_occurrences,
          (select count(*)::text from identifications) as identification_count,
          (select count(*)::text from evidence_assets where asset_role = 'observation_photo') as observation_photo_assets`,
    ),
    pool.query<{
      occurrence_id: string;
      visit_id: string;
      display_name: string | null;
      observed_at: string;
      observer_name: string | null;
      place_name: string | null;
      municipality: string | null;
      photo_url: string | null;
      identification_count: string;
    }>(
      `select
          o.occurrence_id,
          o.visit_id,
          coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name,
          v.observed_at::text,
          coalesce(u.display_name, 'Unknown observer') as observer_name,
          coalesce(p.canonical_name, 'Unknown place') as place_name,
          coalesce(v.observed_municipality, p.municipality) as municipality,
          photo.public_url as photo_url,
          (
            select count(*)::text
            from identifications i
            where i.occurrence_id = o.occurrence_id
          ) as identification_count
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
       order by
         case
           when $1 = 'expert-lane' then (
             select count(*)
             from identifications i
             where i.occurrence_id = o.occurrence_id
           )
           else 0
         end asc,
         v.observed_at desc
       limit 12`,
      [lane],
    ),
  ]);

  const summary = summaryResult.rows[0];

  return {
    lane,
    summary: {
      totalOccurrences: Number(summary?.total_occurrences ?? 0),
      unresolvedOccurrences: Number(summary?.unresolved_occurrences ?? 0),
      identificationCount: Number(summary?.identification_count ?? 0),
      observationPhotoAssets: Number(summary?.observation_photo_assets ?? 0),
    },
    queue: queueResult.rows.map((row) => ({
      occurrenceId: row.occurrence_id,
      visitId: row.visit_id,
      displayName: row.display_name ?? "Unresolved",
      observedAt: row.observed_at,
      observerName: row.observer_name ?? "Unknown observer",
      placeName: row.place_name ?? "Unknown place",
      municipality: row.municipality,
      photoUrl: normalizeAssetUrl(row.photo_url),
      identificationCount: Number(row.identification_count),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Landing (top) — field-note-first snapshot                          */
/* ------------------------------------------------------------------ */

export type LandingObservation = RecentObservation & {
  latitude: number | null;
  longitude: number | null;
  observerUserId: string | null;
  observerAvatarUrl: string | null;
  /** "observation" = 自分 or 誰かの観察記録。"identification" = 自分が他人の観察に付けた個人同定。 */
  entryType?: "observation" | "identification";
  /** entryType="identification" のときに自分が提案した種名。 */
  proposedName?: string | null;
  /** entryType="identification" のときの同定時刻。 */
  identifiedAt?: string | null;
};

export type AmbientObserver = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  latestObservedAt: string;
  latestDisplayName: string;
};

export type LandingStats = {
  observationCount: number;
  speciesCount: number;
  placeCount: number;
};

/**
 * Daily habit roll-up for the viewer, computed directly from visits.
 * Derived server-side (not from myFeed) so it stays accurate regardless of
 * feed page size. All fields are zero / null when the viewer has no history.
 */
export type LandingHabitStats = {
  /** Observations the viewer logged today (local-date boundary, UTC). */
  todayCount: number;
  /** Observations the viewer logged this ISO week (Mon-start). */
  thisWeekCount: number;
  /** Distinct days the viewer has logged in the last 60 days (bound). */
  activeDaysLast60: number;
  /** Whole days since the viewer's last observation, or null if never. */
  daysSinceLast: number | null;
  /** Current streak: consecutive days up to (and including today or yesterday). */
  streak: number;
};

export type LandingSnapshot = {
  viewerUserId: string | null;
  stats: LandingStats;
  feed: LandingObservation[];
  myFeed: LandingObservation[];
  myPlaces: HomePlace[];
  ambient: AmbientObserver[];
  habit: LandingHabitStats | null;
};
