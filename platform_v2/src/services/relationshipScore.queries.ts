// Relationship Score v0.1 - PostgreSQL queries
// Inputs を構造化 JSON にして calculator に渡す。各クエリは個別 try-catch で fallback。

import { getPool } from "../db.js";
import {
  classifyClimate,
  seasonForMonth,
  seasonCoverageCap,
  type RelationshipScoreInputs,
} from "./relationshipScore.js";

export type LoadInputsOptions = {
  placeId: string;
  periodStart: Date; // inclusive
  periodEnd: Date; // exclusive
};

const EMPTY_NUMERIC = 0;

async function safeQuery<T = unknown>(label: string, runner: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await runner();
  } catch (error) {
    console.warn(`[relationshipScore.queries] ${label} failed`, error);
    return fallback;
  }
}

export async function loadRelationshipScoreInputs(
  options: LoadInputsOptions
): Promise<RelationshipScoreInputs> {
  const { placeId, periodStart, periodEnd } = options;
  const pool = getPool();

  const placeMeta = await safeQuery(
    "place_metadata",
    async () => {
      const result = await pool.query<{
        center_latitude: number | null;
        access_status: string | null;
        safety_notes: string | null;
      }>(
        `SELECT
           center_latitude::float8 AS center_latitude,
           metadata->>'access_status' AS access_status,
           metadata->>'safety_notes' AS safety_notes
         FROM places
         WHERE place_id = $1`,
        [placeId]
      );
      return result.rows[0] ?? null;
    },
    null as null | { center_latitude: number | null; access_status: string | null; safety_notes: string | null }
  );

  const accessStatusRaw = placeMeta?.access_status?.trim().toLowerCase() ?? null;
  const accessStatus =
    accessStatusRaw === "private" || accessStatusRaw === "limited" || accessStatusRaw === "public"
      ? (accessStatusRaw as RelationshipScoreInputs["accessStatus"])
      : null;
  const safetyNotesPresent = !!placeMeta?.safety_notes && placeMeta.safety_notes.length > 0;
  const centerLatitude = placeMeta?.center_latitude ?? null;

  // Engagement
  const visitsAgg = await safeQuery(
    "visits_agg",
    async () => {
      const result = await pool.query<{
        visits_count: string;
        repeat_observers: string;
        seasons_months: number[] | null;
        notes_filled: string;
        notes_total: string;
        effort_filled: string;
        effort_total: string;
        accepted_count: string;
        review_total: string;
      }>(
        `WITH window AS (
            SELECT *
            FROM visits
            WHERE place_id = $1
              AND observed_at >= $2
              AND observed_at < $3
         )
         SELECT
           COUNT(*)::text AS visits_count,
           (SELECT COUNT(*)::text FROM (
              SELECT user_id FROM window WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) >= 2
           ) r) AS repeat_observers,
           ARRAY(SELECT DISTINCT EXTRACT(MONTH FROM observed_at)::int FROM window) AS seasons_months,
           SUM(CASE WHEN note IS NOT NULL AND length(note) > 0 THEN 1 ELSE 0 END)::text AS notes_filled,
           COUNT(*)::text AS notes_total,
           SUM(CASE WHEN effort_minutes IS NOT NULL THEN 1 ELSE 0 END)::text AS effort_filled,
           COUNT(*)::text AS effort_total,
           SUM(CASE WHEN quality_review_status = 'accepted' THEN 1 ELSE 0 END)::text AS accepted_count,
           COUNT(*)::text AS review_total
         FROM window`,
        [placeId, periodStart, periodEnd]
      );
      return result.rows[0] ?? null;
    },
    null as null | {
      visits_count: string;
      repeat_observers: string;
      seasons_months: number[] | null;
      notes_filled: string;
      notes_total: string;
      effort_filled: string;
      effort_total: string;
      accepted_count: string;
      review_total: string;
    }
  );

  const visitsCount = Number(visitsAgg?.visits_count ?? "0");
  const repeatObserverCount = Number(visitsAgg?.repeat_observers ?? "0");

  const months = visitsAgg?.seasons_months ?? [];
  const { climate, hemisphere } = classifyClimate(centerLatitude);
  const cap = seasonCoverageCap(climate);
  const seasonIndices = new Set<number>();
  for (const m of months) {
    seasonIndices.add(seasonForMonth(m, climate, hemisphere));
  }
  const seasonsCovered = Math.min(seasonIndices.size, cap);

  const notesTotal = Number(visitsAgg?.notes_total ?? "0");
  const notesFilled = Number(visitsAgg?.notes_filled ?? "0");
  const notesCompletionRate = notesTotal > 0 ? notesFilled / notesTotal : EMPTY_NUMERIC;

  const effortTotal = Number(visitsAgg?.effort_total ?? "0");
  const effortFilled = Number(visitsAgg?.effort_filled ?? "0");
  const effortCompletionRate = effortTotal > 0 ? effortFilled / effortTotal : EMPTY_NUMERIC;

  const reviewTotal = Number(visitsAgg?.review_total ?? "0");
  const acceptedCount = Number(visitsAgg?.accepted_count ?? "0");
  const acceptedReviewRate = reviewTotal > 0 ? acceptedCount / reviewTotal : EMPTY_NUMERIC;

  // Learning: identification attempt rate
  const identificationAgg = await safeQuery(
    "identification_agg",
    async () => {
      const result = await pool.query<{
        occurrences_total: string;
        occurrences_with_human_id: string;
        taxon_ranks_distinct: string;
        review_replies: string;
      }>(
        `WITH window_visits AS (
            SELECT visit_id FROM visits
            WHERE place_id = $1 AND observed_at >= $2 AND observed_at < $3
         ),
         window_occ AS (
            SELECT o.* FROM occurrences o
            JOIN window_visits w ON o.visit_id = w.visit_id
         )
         SELECT
           COUNT(*)::text AS occurrences_total,
           SUM(CASE WHEN EXISTS (
              SELECT 1 FROM identifications i
              WHERE i.occurrence_id = window_occ.occurrence_id
                AND i.actor_kind = 'human'
                AND i.is_current = TRUE
           ) THEN 1 ELSE 0 END)::text AS occurrences_with_human_id,
           COUNT(DISTINCT taxon_rank)::text AS taxon_ranks_distinct,
           (SELECT COUNT(*)::text FROM identifications i2
              JOIN window_occ wo ON i2.occurrence_id = wo.occurrence_id
              WHERE i2.actor_kind = 'human' AND i2.notes IS NOT NULL AND length(i2.notes) > 0
           ) AS review_replies
         FROM window_occ`,
        [placeId, periodStart, periodEnd]
      );
      return result.rows[0] ?? null;
    },
    null as null | {
      occurrences_total: string;
      occurrences_with_human_id: string;
      taxon_ranks_distinct: string;
      review_replies: string;
    }
  );

  const occTotal = Number(identificationAgg?.occurrences_total ?? "0");
  const occWithHumanId = Number(identificationAgg?.occurrences_with_human_id ?? "0");
  const identificationAttemptRate = occTotal > 0 ? occWithHumanId / occTotal : EMPTY_NUMERIC;
  const taxonRankDistinctCount = Number(identificationAgg?.taxon_ranks_distinct ?? "0");
  const reviewReplyCount = Number(identificationAgg?.review_replies ?? "0");

  // Stewardship
  const stewardshipAgg = await safeQuery(
    "stewardship_agg",
    async () => {
      const result = await pool.query<{
        actions_count: string;
        actions_linked: string;
      }>(
        `SELECT
           COUNT(*)::text AS actions_count,
           SUM(CASE WHEN linked_visit_id IS NOT NULL THEN 1 ELSE 0 END)::text AS actions_linked
         FROM stewardship_actions
         WHERE place_id = $1
           AND occurred_at >= $2
           AND occurred_at < $3`,
        [placeId, periodStart, periodEnd]
      );
      return result.rows[0] ?? null;
    },
    null as null | { actions_count: string; actions_linked: string }
  );

  const stewardshipActionCount = Number(stewardshipAgg?.actions_count ?? "0");
  const stewardshipLinkedCount = Number(stewardshipAgg?.actions_linked ?? "0");
  const stewardshipActionLinkedRate =
    stewardshipActionCount > 0 ? stewardshipLinkedCount / stewardshipActionCount : EMPTY_NUMERIC;

  // Audit trail: observation_quality_reviews が visits に紐付いている
  const auditTrailPresent = await safeQuery(
    "audit_trail",
    async () => {
      const result = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM observation_quality_reviews oqr
           JOIN visits v ON oqr.visit_id = v.visit_id
           WHERE v.place_id = $1
             AND v.observed_at >= $2
             AND v.observed_at < $3
         ) AS exists`,
        [placeId, periodStart, periodEnd]
      );
      return Boolean(result.rows[0]?.exists);
    },
    false
  );

  return {
    accessStatus,
    safetyNotesPresent,
    visitsCount,
    seasonsCovered,
    repeatObserverCount,
    notesCompletionRate,
    identificationAttemptRate,
    taxonRankDistinctCount,
    reviewReplyCount,
    stewardshipActionCount,
    stewardshipActionLinkedRate,
    acceptedReviewRate,
    effortCompletionRate,
    auditTrailPresent,
    centerLatitude,
  };
}
