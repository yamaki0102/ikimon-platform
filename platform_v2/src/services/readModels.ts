import { getPool } from "../db.js";
import { deriveVisitDisplayState } from "./visitDisplayState.js";
import {
  getReviewerAccessContext,
  matchesAuthorityScope,
  type ReviewerAuthorityAccessContext,
} from "./reviewerAuthorities.js";

type RecentObservation = {
  occurrenceId: string;
  visitId: string;
  detailId?: string;
  featuredOccurrenceId?: string | null;
  featuredSubjectName?: string | null;
  subjectCount?: number;
  isMultiSubject?: boolean;
  featuredConfidenceBand?: "high" | "medium" | "low" | "unknown" | null;
  displayStability?: "locked" | "stable" | "adaptive" | null;
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
  placeId: string | null;
  observerUserId: string | null;
  observerAvatarUrl: string | null;
  displayName: string;
  scientificName: string | null;
  observedAt: string;
  note: string | null;
  observerName: string;
  placeName: string;
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  photoAssets: Array<{
    assetId: string;
    url: string;
  }>;
  photoUrls: string[];
  videoAssets: Array<{
    assetId: string;
    providerUid: string;
    iframeUrl: string;
    thumbnailUrl: string | null;
    watchUrl: string | null;
    createdAt: string;
  }>;
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

type VisitCardRow = {
  visit_id: string;
  observed_at: string;
  observer_name: string | null;
  place_name: string | null;
  municipality: string | null;
  photo_url: string | null;
};

type VisitSubjectRow = {
  occurrence_id: string;
  visit_id: string;
  subject_index: number;
  display_name: string | null;
  scientific_name: string | null;
  vernacular_name: string | null;
  taxon_rank: string | null;
  confidence_score: string | null;
  source_payload: Record<string, unknown> | null;
};

async function loadVisitSummaryObservations(
  limit: number,
  options: { userId?: string | null } = {},
): Promise<RecentObservation[]> {
  const pool = getPool();
  const params: Array<string | number> = [];
  const whereClauses: string[] = [];
  if (options.userId) {
    params.push(options.userId);
    whereClauses.push(`v.user_id = $${params.length}`);
  }
  params.push(limit);
  const visitRows = await pool.query<VisitCardRow>(
    `SELECT v.visit_id,
            v.observed_at::text,
            coalesce(u.display_name, 'Unknown observer') AS observer_name,
            coalesce(p.canonical_name, 'Unknown place') AS place_name,
            coalesce(v.observed_municipality, p.municipality) AS municipality,
            photo.public_url AS photo_url
       FROM visits v
       LEFT JOIN users u ON u.user_id = v.user_id
       LEFT JOIN places p ON p.place_id = v.place_id
       LEFT JOIN LATERAL (
         SELECT coalesce(ab.public_url, ab.storage_path) AS public_url
           FROM evidence_assets ea
           JOIN asset_blobs ab ON ab.blob_id = ea.blob_id
          WHERE ea.visit_id = v.visit_id
            AND ea.asset_role = 'observation_photo'
          ORDER BY ea.created_at ASC
          LIMIT 1
       ) photo ON true
       ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
      ORDER BY v.observed_at DESC
      LIMIT $${params.length}`,
    params,
  );
  const visitIds = visitRows.rows.map((row) => row.visit_id);
  if (visitIds.length === 0) {
    return [];
  }

  const subjectRows = await pool.query<VisitSubjectRow>(
    `SELECT occurrence_id,
            visit_id,
            subject_index,
            coalesce(vernacular_name, scientific_name, 'Unresolved') AS display_name,
            scientific_name,
            vernacular_name,
            taxon_rank,
            confidence_score::text,
            source_payload
       FROM occurrences
      WHERE visit_id = ANY($1::text[])
      ORDER BY visit_id ASC, subject_index ASC, created_at ASC`,
    [visitIds],
  );
  const occurrenceIds = subjectRows.rows.map((row) => row.occurrence_id);

  const [idCounts, latestAssessments, storedDisplayStates] = await Promise.all([
    occurrenceIds.length > 0
      ? pool.query<{ occurrence_id: string; n: string }>(
        `SELECT occurrence_id, count(*)::text AS n
           FROM identifications
          WHERE occurrence_id = ANY($1::text[])
          GROUP BY occurrence_id`,
        [occurrenceIds],
      )
      : Promise.resolve({ rows: [] }),
    occurrenceIds.length > 0
      ? pool.query<{ occurrence_id: string; confidence_band: string | null }>(
        `SELECT DISTINCT ON (occurrence_id)
                occurrence_id,
                confidence_band
           FROM observation_ai_assessments
          WHERE occurrence_id = ANY($1::text[])
          ORDER BY occurrence_id, generated_at DESC`,
        [occurrenceIds],
      )
      : Promise.resolve({ rows: [] }),
    pool.query<{
      visit_id: string;
      featured_occurrence_id: string | null;
      selected_reason: string;
      selection_source: "human_consensus" | "specialist_lock" | "system_stable" | "latest_ai_default";
      locked_by_human: boolean;
      derived_from_ai_run_id: string | null;
      updated_at: string;
    }>(
      `SELECT visit_id,
              featured_occurrence_id,
              selected_reason,
              selection_source,
              locked_by_human,
              derived_from_ai_run_id::text,
              updated_at::text
         FROM visit_display_state
        WHERE visit_id = ANY($1::text[])`,
      [visitIds],
    ).catch(() => ({ rows: [] })),
  ]);

  const idCountMap = new Map<string, number>();
  for (const row of idCounts.rows) {
    idCountMap.set(row.occurrence_id, Number(row.n));
  }
  const latestAssessmentMap = new Map<string, "high" | "medium" | "low" | "unknown" | null>();
  for (const row of latestAssessments.rows) {
    latestAssessmentMap.set(
      row.occurrence_id,
      row.confidence_band === "high" || row.confidence_band === "medium" || row.confidence_band === "low"
        ? row.confidence_band
        : row.confidence_band == null
          ? null
          : "unknown",
    );
  }
  const storedStateMap = new Map<string, typeof storedDisplayStates.rows[number]>();
  for (const row of storedDisplayStates.rows) {
    storedStateMap.set(row.visit_id, row);
  }

  const subjectsByVisit = new Map<string, Array<{
    occurrenceId: string;
    subjectIndex: number;
    displayName: string;
    scientificName: string | null;
    rank: string | null;
    roleHint: string;
    confidence: number | null;
    identificationCount: number;
    latestAssessmentBand: "high" | "medium" | "low" | "unknown" | null;
    isPrimary: boolean;
    hasSpecialistApproval: boolean;
  }>>();
  for (const row of subjectRows.rows) {
    const specialistPayload = ((row.source_payload ?? {}) as { specialist_review?: { decision?: string } }).specialist_review;
    const v2SubjectPayload = ((row.source_payload ?? {}) as { v2_subject?: { role_hint?: string } }).v2_subject;
    const list = subjectsByVisit.get(row.visit_id) ?? [];
    list.push({
      occurrenceId: row.occurrence_id,
      subjectIndex: row.subject_index,
      displayName: row.display_name ?? "Unresolved",
      scientificName: row.scientific_name,
      rank: row.taxon_rank,
      roleHint: String(v2SubjectPayload?.role_hint ?? (row.subject_index === 0 ? "primary" : "coexisting")),
      confidence: row.confidence_score != null ? Number(row.confidence_score) : null,
      identificationCount: idCountMap.get(row.occurrence_id) ?? 0,
      latestAssessmentBand: latestAssessmentMap.get(row.occurrence_id) ?? null,
      isPrimary: row.subject_index === 0,
      hasSpecialistApproval: specialistPayload?.decision === "approve",
    });
    subjectsByVisit.set(row.visit_id, list);
  }

  return visitRows.rows.map((visitRow) => {
    const subjects = subjectsByVisit.get(visitRow.visit_id) ?? [];
    const stored = storedStateMap.get(visitRow.visit_id);
    const derived = deriveVisitDisplayState(visitRow.visit_id, subjects, stored?.derived_from_ai_run_id ?? null);
    const displayState = stored
      ? {
          visitId: stored.visit_id,
          featuredOccurrenceId: stored.featured_occurrence_id,
          selectedReason: stored.selected_reason,
          selectionSource: stored.selection_source,
          lockedByHuman: stored.locked_by_human,
          derivedFromAiRunId: stored.derived_from_ai_run_id,
          updatedAt: stored.updated_at,
          displayStability: stored.locked_by_human || stored.selection_source === "specialist_lock"
            ? "locked" as const
            : stored.selection_source === "latest_ai_default"
              ? "adaptive" as const
              : "stable" as const,
        }
      : derived;
    const featuredSubject =
      subjects.find((subject) => subject.occurrenceId === displayState.featuredOccurrenceId)
      ?? subjects.find((subject) => subject.isPrimary)
      ?? subjects[0];
    return {
      occurrenceId: featuredSubject?.occurrenceId ?? visitRow.visit_id,
      visitId: visitRow.visit_id,
      detailId: visitRow.visit_id,
      featuredOccurrenceId: featuredSubject?.occurrenceId ?? null,
      featuredSubjectName: featuredSubject?.displayName ?? null,
      subjectCount: subjects.length,
      isMultiSubject: subjects.length > 1,
      featuredConfidenceBand: featuredSubject?.latestAssessmentBand ?? null,
      displayStability: displayState.displayStability,
      displayName: featuredSubject?.displayName ?? "Unresolved",
      observedAt: visitRow.observed_at,
      observerName: visitRow.observer_name ?? "Unknown observer",
      placeName: visitRow.place_name ?? "Unknown place",
      municipality: visitRow.municipality,
      photoUrl: normalizeAssetUrl(visitRow.photo_url),
      identificationCount: featuredSubject?.identificationCount ?? 0,
    };
  });
}

export async function getHomeSnapshot(userId: string | null): Promise<HomeSnapshot> {
  const pool = getPool();
  const recentObservations = await loadVisitSummaryObservations(12);

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
    recentObservations,
    myPlaces,
  };
}

export async function getExploreSnapshot(): Promise<ExploreSnapshot> {
  const pool = getPool();
  const recentObservations = await loadVisitSummaryObservations(18);

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
    recentObservations,
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
    place_id: string | null;
    observer_user_id: string | null;
    observer_avatar_url: string | null;
    display_name: string | null;
    scientific_name: string | null;
    observed_at: string;
    note: string | null;
    observer_name: string | null;
    place_name: string | null;
    municipality: string | null;
    latitude: number | null;
    longitude: number | null;
  }>(
    `select
        o.occurrence_id,
        o.visit_id,
        v.place_id,
        v.user_id as observer_user_id,
        u.avatar_url as observer_avatar_url,
        coalesce(o.vernacular_name, o.scientific_name, 'Unresolved') as display_name,
        o.scientific_name,
        v.observed_at::text,
        v.note,
        coalesce(u.display_name, 'Unknown observer') as observer_name,
        coalesce(p.canonical_name, 'Unknown place') as place_name,
        coalesce(v.observed_municipality, p.municipality) as municipality,
        p.center_latitude as latitude,
        p.center_longitude as longitude
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

  const photosResult = await pool.query<{ asset_id: string; photo_url: string | null }>(
    `select ea.asset_id::text as asset_id,
            coalesce(ab.public_url, ab.storage_path) as photo_url
     from evidence_assets ea
     join asset_blobs ab on ab.blob_id = ea.blob_id
     where ea.visit_id = $1
       and ea.asset_role = 'observation_photo'
     order by ea.created_at asc`,
    [base.visit_id],
  );

  const videosResult = await pool.query<{
    asset_id: string;
    source_payload: Record<string, unknown> | null;
    blob_source_payload: Record<string, unknown> | null;
    public_url: string | null;
    storage_path: string | null;
    created_at: string;
  }>(
    `select
        ea.asset_id::text as asset_id,
        ea.source_payload,
        ab.source_payload as blob_source_payload,
        ab.public_url,
        ab.storage_path,
        ea.created_at::text
     from evidence_assets ea
     join asset_blobs ab on ab.blob_id = ea.blob_id
     where ea.visit_id = $1
       and ea.asset_role = 'observation_video'
     order by ea.created_at desc`,
    [base.visit_id],
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

  const photoAssets = photosResult.rows
    .map((row) => {
      const normalizedUrl = normalizeAssetUrl(row.photo_url);
      if (!normalizedUrl) return null;
      return {
        assetId: row.asset_id,
        url: normalizedUrl,
      };
    })
    .filter((row): row is { assetId: string; url: string } => Boolean(row));

  return {
    occurrenceId: base.occurrence_id,
    visitId: base.visit_id,
    placeId: base.place_id,
    observerUserId: base.observer_user_id,
    observerAvatarUrl: base.observer_avatar_url,
    displayName: base.display_name ?? "Unresolved",
    scientificName: base.scientific_name,
    observedAt: base.observed_at,
    note: base.note,
    observerName: base.observer_name ?? "Unknown observer",
    placeName: base.place_name ?? "Unknown place",
    municipality: base.municipality,
    latitude: base.latitude,
    longitude: base.longitude,
    photoAssets,
    photoUrls: photoAssets.map((asset) => asset.url),
    videoAssets: videosResult.rows
      .map((row) => {
        const payload = (row.source_payload && typeof row.source_payload === "object")
          ? row.source_payload
          : {};
        const blobPayload = (row.blob_source_payload && typeof row.blob_source_payload === "object")
          ? row.blob_source_payload
          : {};
        const iframeUrl =
          typeof payload.iframe_url === "string"
            ? payload.iframe_url
            : typeof blobPayload.iframe_url === "string"
              ? blobPayload.iframe_url
              : "";
        if (!iframeUrl) {
          return null;
        }
        const watchUrlRaw =
          typeof payload.watch_url === "string"
            ? payload.watch_url
            : typeof blobPayload.watch_url === "string"
              ? blobPayload.watch_url
              : row.public_url;
        const thumbnailUrlRaw =
          typeof payload.thumbnail_url === "string"
            ? payload.thumbnail_url
            : typeof blobPayload.thumbnail_url === "string"
              ? blobPayload.thumbnail_url
              : null;
        return {
          assetId: row.asset_id,
          providerUid:
            typeof payload.stream_uid === "string"
              ? payload.stream_uid
              : row.storage_path ?? "",
          iframeUrl,
          thumbnailUrl: normalizeAssetUrl(thumbnailUrlRaw),
          watchUrl: normalizeAssetUrl(watchUrlRaw),
          createdAt: row.created_at,
        };
      })
      .filter((video): video is ObservationDetailSnapshot["videoAssets"][number] => Boolean(video)),
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
  const recentObservations = await loadVisitSummaryObservations(8, { userId });

  return {
    userId: user.user_id,
    displayName: user.display_name,
    rankLabel: user.rank_label,
    recentPlaces: home.myPlaces,
    recentObservations,
  };
}

export async function getSpecialistSnapshot(
  lane: SpecialistSnapshot["lane"],
  viewer?: {
    userId: string;
    roleName?: string | null;
    rankLabel?: string | null;
  },
): Promise<SpecialistSnapshot> {
  const pool = getPool();
  const accessContext: ReviewerAuthorityAccessContext | null = viewer?.userId
    ? await getReviewerAccessContext(viewer.userId, viewer.roleName, viewer.rankLabel)
    : null;
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
      scientific_name: string | null;
      vernacular_name: string | null;
      ai_taxon_name: string | null;
      evidence_tier: string | null;
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
          ) as identification_count,
          o.scientific_name,
          o.vernacular_name,
          coalesce(ai.recommended_taxon_name, ai.best_specific_taxon_name) as ai_taxon_name,
          o.evidence_tier::text
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
         select recommended_taxon_name, best_specific_taxon_name
         from observation_ai_assessments a
         where a.occurrence_id = o.occurrence_id
         order by a.generated_at desc
         limit 1
       ) ai on true
       where
         case
           when $1 = 'public-claim' then coalesce(o.evidence_tier, 0) >= 2 and coalesce(o.evidence_tier, 0) < 3
           when $1 = 'expert-lane' then coalesce(o.evidence_tier, 0) < 2
           else true
         end
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
       limit 60`,
      [lane],
    ),
  ]);

  const summary = summaryResult.rows[0];
  const scopedRows = (() => {
    if (!accessContext || accessContext.canManageAll) {
      return queueResult.rows;
    }

    if (accessContext.activeAuthorities.length === 0) {
      return [] as typeof queueResult.rows;
    }

    return queueResult.rows.filter((row) =>
      accessContext.activeAuthorities.some((authority) =>
        matchesAuthorityScope(authority, [
          row.scientific_name,
          row.vernacular_name,
          row.ai_taxon_name,
          row.display_name,
        ]),
      ),
    );
  })();

  return {
    lane,
    summary: {
      totalOccurrences: Number(summary?.total_occurrences ?? 0),
      unresolvedOccurrences: Number(summary?.unresolved_occurrences ?? 0),
      identificationCount: Number(summary?.identification_count ?? 0),
      observationPhotoAssets: Number(summary?.observation_photo_assets ?? 0),
    },
    queue: scopedRows.slice(0, 12).map((row) => ({
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
  evidenceTier?: number | null;
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
