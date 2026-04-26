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
  bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
};

export type PlaceBbox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

/**
 * places.bbox_json から bounding box を取得。
 * 形式: { minLat, maxLat, minLng, maxLng } または GeoJSON-ish。
 * 空 or 不明形式なら center_latitude/longitude から 150m 四方を推定。
 */
export async function loadPlaceBbox(placeId: string): Promise<PlaceBbox | null> {
  try {
    const pool = getPool();
    const result = await pool.query<{
      bbox_json: unknown;
      center_latitude: number | null;
      center_longitude: number | null;
    }>(
      `SELECT bbox_json,
              center_latitude::float8 AS center_latitude,
              center_longitude::float8 AS center_longitude
         FROM places WHERE place_id = $1`,
      [placeId]
    );
    const row = result.rows[0];
    if (!row) return null;

    const raw = row.bbox_json as Record<string, unknown> | null;
    if (raw && typeof raw === "object") {
      // 直接 minLat 等を持つ形式
      const minLat = Number((raw as Record<string, unknown>).minLat ?? (raw as Record<string, unknown>).min_lat);
      const maxLat = Number((raw as Record<string, unknown>).maxLat ?? (raw as Record<string, unknown>).max_lat);
      const minLng = Number((raw as Record<string, unknown>).minLng ?? (raw as Record<string, unknown>).min_lng);
      const maxLng = Number((raw as Record<string, unknown>).maxLng ?? (raw as Record<string, unknown>).max_lng);
      if ([minLat, maxLat, minLng, maxLng].every((v) => Number.isFinite(v))) {
        return { minLat, maxLat, minLng, maxLng };
      }
    }

    // center から 150m 四方を生成 (緯度0.00135°≒150m, 経度は緯度で変化)
    if (row.center_latitude != null && row.center_longitude != null) {
      const latPad = 0.00135;
      const lngPad = 0.00135 / Math.max(0.05, Math.cos((row.center_latitude * Math.PI) / 180));
      return {
        minLat: row.center_latitude - latPad,
        maxLat: row.center_latitude + latPad,
        minLng: row.center_longitude - lngPad,
        maxLng: row.center_longitude + lngPad,
      };
    }
    return null;
  } catch (error) {
    console.warn("[relationshipScore.queries] loadPlaceBbox failed", error);
    return null;
  }
}

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
  const { placeId, periodStart, periodEnd, bbox } = options;
  const pool = getPool();

  // bbox を使うかどうかで visits/occurrences の WHERE 条件を切替
  // bbox 指定時: place_id 一致 OR (point_lat/lng が bbox 内)
  // bbox なし: place_id 一致のみ
  const visitsWhereSql = bbox
    ? `(visits.place_id = $1
         OR (visits.point_latitude BETWEEN $4 AND $5
             AND visits.point_longitude BETWEEN $6 AND $7))`
    : `visits.place_id = $1`;
  const visitsParams: unknown[] = bbox
    ? [placeId, periodStart, periodEnd, bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng]
    : [placeId, periodStart, periodEnd];

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
            WHERE ${visitsWhereSql}
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
        visitsParams
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
            WHERE ${visitsWhereSql} AND observed_at >= $2 AND observed_at < $3
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
        visitsParams
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
           WHERE ${bbox ? `(v.place_id = $1
                  OR (v.point_latitude BETWEEN $4 AND $5
                      AND v.point_longitude BETWEEN $6 AND $7))` : `v.place_id = $1`}
             AND v.observed_at >= $2
             AND v.observed_at < $3
         ) AS exists`,
        visitsParams
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
