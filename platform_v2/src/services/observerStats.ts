import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { getSessionFromCookie } from "./authSession.js";
import {
  deriveObservationProcessingStatus,
  type ObservationProcessingStatus,
} from "./observationProcessingStatus.js";

export type ObserverStats = {
  totalObservations: number;
  thisMonthObservations: number;
  currentStreakDays: number;
  placeVisitCount: number; // この地点を訪れた回数
  uniqueTaxaAllTime: number;
  uniqueTaxaThisSeason: number;
  rankLabel: string;
  // 「あなた以外に何人がこの場所を訪れたか」
  peersAtPlaceCount: number;
  // 100年アーカイブ的な数字（総データベース件数との関係）
  contributionRankNumeric: number; // その人の総観察がDB全体の何番目
};

/**
 * 観察詳細ページ Layer 4「あなたの成長」を支える集計。
 * UI コピーに「自己効力感」等の学術用語は出さず、数字だけ出す。
 */
export async function getObserverStats(
  viewerUserId: string,
  currentPlaceId: string | null,
  currentOccurrenceId: string,
): Promise<ObserverStats> {
  const pool = getPool();

  const totals = await pool.query<{
    total: string;
    this_month: string;
    unique_taxa_all: string;
    unique_taxa_season: string;
    rank_label: string | null;
  }>(
    `SELECT
       (SELECT count(*)::text FROM visits WHERE user_id = $1) AS total,
       (SELECT count(*)::text FROM visits WHERE user_id = $1
         AND observed_at >= date_trunc('month', now())) AS this_month,
       (SELECT count(DISTINCT coalesce(o.vernacular_name, o.scientific_name))::text
          FROM occurrences o JOIN visits v ON v.visit_id = o.visit_id
         WHERE v.user_id = $1
           AND (o.vernacular_name IS NOT NULL OR o.scientific_name IS NOT NULL)) AS unique_taxa_all,
       (SELECT count(DISTINCT coalesce(o.vernacular_name, o.scientific_name))::text
          FROM occurrences o JOIN visits v ON v.visit_id = o.visit_id
         WHERE v.user_id = $1
           AND extract(month from v.observed_at) = extract(month from now())
           AND (o.vernacular_name IS NOT NULL OR o.scientific_name IS NOT NULL)) AS unique_taxa_season,
       (SELECT rank_label FROM users WHERE user_id = $1) AS rank_label`,
    [viewerUserId],
  );

  const streakRow = await pool.query<{ streak: string }>(
    `WITH days AS (
       SELECT DISTINCT date_trunc('day', observed_at)::date AS d
         FROM visits WHERE user_id = $1
         ORDER BY d DESC LIMIT 60
     ),
     ranked AS (
       SELECT d, row_number() OVER (ORDER BY d DESC) - 1 AS rn FROM days
     )
     SELECT count(*)::text AS streak
       FROM ranked WHERE d = current_date - rn`,
    [viewerUserId],
  );

  const placeRow = currentPlaceId
    ? await pool.query<{ visits: string; peers: string }>(
        `SELECT
           (SELECT count(*)::text FROM visits WHERE user_id = $1 AND place_id = $2) AS visits,
           (SELECT count(DISTINCT user_id)::text FROM visits
             WHERE place_id = $2 AND user_id <> $1 AND user_id IS NOT NULL) AS peers`,
        [viewerUserId, currentPlaceId],
      )
    : null;

  const rank = await pool.query<{ rank: string }>(
    `SELECT count(*)::text AS rank FROM visits WHERE visit_id <= $1 OR observed_at <= (SELECT observed_at FROM visits WHERE visit_id = (SELECT visit_id FROM occurrences WHERE occurrence_id = $2 LIMIT 1))`,
    [currentOccurrenceId, currentOccurrenceId],
  ).catch(() => ({ rows: [{ rank: "0" }] }));

  const t = totals.rows[0]!;
  return {
    totalObservations: Number(t.total),
    thisMonthObservations: Number(t.this_month),
    currentStreakDays: Number(streakRow.rows[0]?.streak ?? 0),
    placeVisitCount: placeRow ? Number(placeRow.rows[0]?.visits ?? 0) : 0,
    uniqueTaxaAllTime: Number(t.unique_taxa_all),
    uniqueTaxaThisSeason: Number(t.unique_taxa_season),
    rankLabel: t.rank_label ?? "観察者",
    peersAtPlaceCount: placeRow ? Number(placeRow.rows[0]?.peers ?? 0) : 0,
    contributionRankNumeric: Number(rank.rows[0]?.rank ?? 0),
  };
}

export async function loadOwnerObservationProcessingStatus(
  observationId: string,
  cookieHeader: string | undefined,
): Promise<ObservationProcessingStatus | null> {
  const session = await getSessionFromCookie(cookieHeader);
  if (!session) return null;

  const pool = getPool();
  const result = await pool.query<{
    occurrence_id: string;
    visit_id: string;
    ai_assessment_status: string | null;
    original_photo_count: string;
    display_photo_count: string;
    latest_job_status: string | null;
    latest_job_error: string | null;
    candidate_count: string;
    identification_count: string;
    updated_at: string | null;
  }>(
    `select
        o.occurrence_id,
        v.visit_id,
        o.ai_assessment_status,
        coalesce(media.original_photo_count, 0)::text as original_photo_count,
        coalesce(media.display_photo_count, 0)::text as display_photo_count,
        job.job_status as latest_job_status,
        job.last_error as latest_job_error,
        coalesce(candidates.candidate_count, 0)::text as candidate_count,
        coalesce(ids.identification_count, 0)::text as identification_count,
        greatest(o.updated_at, v.updated_at, coalesce(job.updated_at, o.updated_at))::text as updated_at
     from occurrences o
     join visits v on v.visit_id = o.visit_id
     left join lateral (
       select
         count(*) filter (where ea.asset_role = 'observation_photo_original') as original_photo_count,
         count(*) filter (
           where ea.asset_role = 'observation_photo'
             and coalesce(ab.bytes, 0) > 0
             and coalesce(nullif(ab.public_url, ''), nullif(ab.storage_path, '')) is not null
         ) as display_photo_count
       from evidence_assets ea
       left join asset_blobs ab on ab.blob_id = ea.blob_id
       where ea.visit_id = v.visit_id
     ) media on true
     left join lateral (
       select job_status, last_error, updated_at
       from media_processing_jobs mpj
       where mpj.media_kind = 'photo'
         and (mpj.observation_id = v.visit_id or mpj.occurrence_id = o.occurrence_id)
       order by mpj.updated_at desc, mpj.created_at desc
       limit 1
     ) job on true
     left join lateral (
       select count(*) as candidate_count
       from observation_ai_subject_candidates c
       where c.suggested_occurrence_id = o.occurrence_id
     ) candidates on true
     left join lateral (
       select count(*) as identification_count
       from identifications i
       where i.occurrence_id = o.occurrence_id
         and coalesce(i.is_current, true) = true
     ) ids on true
     where (o.occurrence_id = $1 or v.visit_id = $1 or o.legacy_observation_id = $1)
       and v.user_id = $2
     order by v.observed_at desc
     limit 1`,
    [observationId, session.userId],
  );

  const row = result.rows[0];
  if (!row) return null;
  const config = loadConfig();
  return deriveObservationProcessingStatus({
    occurrenceId: row.occurrence_id,
    visitId: row.visit_id,
    originalPhotoCount: Number(row.original_photo_count),
    displayPhotoCount: Number(row.display_photo_count),
    latestMediaJobStatus: row.latest_job_status,
    latestMediaJobError: row.latest_job_error,
    aiAssessmentStatus: row.ai_assessment_status,
    candidateCount: Number(row.candidate_count),
    identificationCount: Number(row.identification_count),
    providerAvailable: Boolean(config.geminiApiKey || config.vertexAi),
    updatedAt: row.updated_at,
  });
}
