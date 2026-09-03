export const GEMINI_QUALITY_BACKLOG_MAX_ACTIVE = 40;
export const GEMINI_QUALITY_BACKLOG_MAX_REQUEUE_PER_TICK = 10;

export type ObservationAiQualityBacklogTargetRow = {
  request_id: string | null;
  observation_id: string;
  owner_user_id: string;
  actor_user_id: string | null;
  request_state: string | null;
  source_payload_json: string | null;
  candidate_label: string | null;
  candidate_rank: string | null;
};

export const OBSERVATION_AI_QUALITY_BACKLOG_SELECT_SQL = `
  SELECT rr.request_id, o.observation_id, o.owner_user_id,
         rr.actor_user_id, rr.request_state, rr.source_payload_json,
         COALESCE(
           art.candidate_vernacular_name,
           art.candidate_scientific_name,
           art.ai_recommended_taxon_name,
           art.vernacular_name,
           art.scientific_name
         ) AS candidate_label,
         COALESCE(
           art.candidate_taxon_rank,
           art.ai_recommended_rank,
           art.taxon_rank
         ) AS candidate_rank
    FROM observations o
    LEFT JOIN observation_ai_review_targets art
      ON art.occurrence_id = 'occ:' || o.observation_id || ':0'
    LEFT JOIN observation_reassessment_requests rr
      ON rr.observation_id = o.observation_id
     AND rr.request_kind = 'standard'
     AND rr.actor_user_id = o.owner_user_id
   WHERE o.visibility = 'public'
     AND o.emergency_hidden = 0
     AND EXISTS (
       SELECT 1 FROM asset_ledger asset
        WHERE asset.observation_id = o.observation_id
          AND asset.processing_state = 'uploaded'
          AND asset.mime LIKE 'image/%'
          AND asset.public_derivative_key IS NOT NULL
          AND asset.public_derivative_verified_at IS NOT NULL
          AND asset.exif_scrub_state = 'scrubbed'
     )
     AND (
       rr.request_id IS NULL
       OR (
         rr.request_state IN ('completed', 'failed')
         AND (
           CASE
             WHEN json_valid(rr.source_payload_json)
               THEN COALESCE(json_extract(rr.source_payload_json, '$.ruleVersion'), '')
             ELSE ''
           END
         ) <> ?
       )
     )
   ORDER BY
     CASE
       WHEN candidate_rank IN ('class', 'order', 'lifeform', 'unknown')
         OR candidate_label IN ('鳥', '鳥類', '生きもの', '生物', '動物', '植物', '昆虫', '菌類', '未同定', '同定待ち', '名前待ち')
         THEN 0
       WHEN candidate_label IS NULL OR TRIM(candidate_label) = '' THEN 1
       ELSE 2
     END,
     CASE WHEN rr.request_id IS NULL THEN 0 ELSE 1 END,
     o.observed_at DESC,
     o.observation_id
   LIMIT ?`;

export function observationAiQualityBacklogCapacity(activeCount: number): number {
  return Math.max(
    0,
    Math.min(
      GEMINI_QUALITY_BACKLOG_MAX_REQUEUE_PER_TICK,
      GEMINI_QUALITY_BACKLOG_MAX_ACTIVE - activeCount,
    ),
  );
}

export function observationAiQualityBacklogReason(
  row: Pick<ObservationAiQualityBacklogTargetRow, "request_id" | "candidate_label" | "candidate_rank">,
): "missing_reassessment_request" | "coarse_taxonomic_rank" | "outdated_ai_result" | "missing_ai_candidate" {
  if (!row.request_id) return "missing_reassessment_request";
  if (row.candidate_rank && ["class", "order", "lifeform", "unknown"].includes(row.candidate_rank)) {
    return "coarse_taxonomic_rank";
  }
  return row.candidate_label ? "outdated_ai_result" : "missing_ai_candidate";
}
