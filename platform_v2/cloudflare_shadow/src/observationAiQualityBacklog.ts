export const GEMINI_QUALITY_BACKLOG_VERSION = "public-photo-quality-backlog/v1";
export const GEMINI_QUALITY_BACKLOG_MAX_ACTIVE = 40;
export const GEMINI_QUALITY_BACKLOG_MAX_REQUEUE_PER_TICK = 10;
export const GEMINI_QUALITY_BACKLOG_MAX_SCAN_PER_TICK = 100;

export type ObservationAiQualityBacklogTargetRow = {
  request_id: string | null;
  observation_id: string;
  owner_user_id: string;
  request_state: string | null;
  source_payload_json: string | null;
  candidate_label: string | null;
  candidate_rank: string | null;
  quality_revision: string;
  needs_reason: "missing_ai_candidate" | "coarse_taxonomic_rank" | "outdated_ai_result";
};

export type ObservationAiBatchResultIndexes = {
  primaryIndex: number;
  censusIndex: number;
  environmentIndex: number;
};

export function observationAiBatchResultIndexes(primaryIndex: number): ObservationAiBatchResultIndexes {
  return {
    primaryIndex,
    censusIndex: primaryIndex * 2,
    environmentIndex: primaryIndex * 2 + 1,
  };
}

export function publicQualityBacklogCancellationPayload(
  previousPayload: string | null,
  errorCode: string,
  cancelledAt: string,
): string | null {
  if (errorCode !== "public_quality_backlog_no_longer_eligible"
    && errorCode !== "public_quality_backlog_public_safety_blocked") return null;
  if (!previousPayload) return null;
  try {
    const previous: unknown = JSON.parse(previousPayload);
    if (!previous || typeof previous !== "object" || Array.isArray(previous)) return null;
    const payload = previous as Record<string, unknown>;
    if (payload.qualityBacklogVersion !== GEMINI_QUALITY_BACKLOG_VERSION) return null;
    return JSON.stringify({
      ...payload,
      executionStatus: "cancelled",
      errorCode,
      cancelledAt,
    });
  } catch {
    return null;
  }
}

const COARSE_CANDIDATE_SQL = `(
  COALESCE(candidate_rank, '') IN ('class', 'order', 'lifeform', 'unknown')
  OR COALESCE(candidate_label, '') IN ('鳥', '鳥類', '生きもの', '生物', '動物', '植物', '昆虫', '菌類', '未同定', '同定待ち', '名前待ち')
)`;
const MISSING_CANDIDATE_SQL = `(candidate_label IS NULL OR TRIM(candidate_label) = '')`;

/**
 * Read a deterministic, bounded candidate window. The Worker applies the
 * existing public-risk decision before admission and writes each reservation
 * with an independent active-cap predicate.
 */
export const OBSERVATION_AI_QUALITY_BACKLOG_SELECT_SQL = `
  WITH candidate_rows AS (
    SELECT rr.request_id, o.observation_id, o.owner_user_id, o.observed_at,
           rr.request_state, rr.source_payload_json,
           COALESCE(
             art.candidate_vernacular_name,
             art.candidate_scientific_name,
             art.ai_recommended_taxon_name,
             art.vernacular_name,
             art.scientific_name
           ) AS candidate_label,
           COALESCE(art.candidate_taxon_rank, art.ai_recommended_rank, art.taxon_rank) AS candidate_rank,
           json_array(
               COALESCE(o.created_at, ''),
               (SELECT COUNT(*)
                  FROM asset_ledger asset_count
                 WHERE asset_count.observation_id = o.observation_id
                   AND asset_count.processing_state = 'uploaded'
                   AND asset_count.mime LIKE 'image/%'),
               COALESCE((SELECT MAX(COALESCE(asset_revision.public_derivative_verified_at,
                                             asset_revision.public_ready_at,
                                             asset_revision.uploaded_at,
                                             asset_revision.created_at))
                           FROM asset_ledger asset_revision
                          WHERE asset_revision.observation_id = o.observation_id
                            AND asset_revision.processing_state = 'uploaded'
                            AND asset_revision.mime LIKE 'image/%'), ''),
               COALESCE((SELECT group_concat(asset_hash.public_derivative_sha256, ',')
                             FROM (SELECT hash_asset.public_derivative_sha256
                                     FROM asset_ledger hash_asset
                                    WHERE hash_asset.observation_id = o.observation_id
                                      AND hash_asset.processing_state = 'uploaded'
                                      AND hash_asset.mime LIKE 'image/%'
                                    ORDER BY hash_asset.asset_id) asset_hash), '')
             ) AS quality_revision
      FROM observations o
      JOIN observation_data_rights rights ON rights.visit_id = o.observation_id
      LEFT JOIN observation_ai_review_targets art
        ON art.occurrence_id = 'occ:' || o.observation_id || ':0'
      LEFT JOIN observation_reassessment_requests rr
        ON rr.observation_id = o.observation_id
       AND rr.request_kind = 'standard'
       AND rr.actor_user_id = o.owner_user_id
     WHERE o.visibility = 'public'
       AND o.emergency_hidden = 0
       AND o.processing_state IN ('accepted', 'auto_accepted')
       AND rights.withdrawal_status = 'active'
       AND rights.record_consent IN ('public_summary', 'external_export')
       AND NOT EXISTS (
       SELECT 1 FROM civic_observation_contexts civic
        WHERE civic.visit_id = o.observation_id
          AND (COALESCE(NULLIF(trim(civic.risk_lane), ''), 'normal') <> 'normal'
            OR (NULLIF(trim(civic.audience_scope), '') IS NOT NULL
              AND trim(civic.audience_scope) <> 'public')
            OR trim(COALESCE(civic.public_precision, '')) IN ('hidden', 'exact_private')
            OR (NULLIF(trim(civic.public_precision), '') IS NOT NULL
              AND trim(civic.public_precision) NOT IN ('municipality', 'mesh')))
       )
       AND NOT EXISTS (
       SELECT 1 FROM record_observations ro
        WHERE ro.record_runtime = 'cloudflare_d1'
          AND ro.record_id = o.observation_id
          AND ro.lifecycle_status <> 'active'
       )
       AND NOT EXISTS (
       SELECT 1 FROM record_observations ro
        WHERE ro.record_runtime = 'cloudflare_d1'
          AND ro.record_id = o.observation_id
          AND ro.lifecycle_status = 'active'
          AND (ro.accepted_identification_id IS NOT NULL
            OR ro.assertion_status = 'human_asserted'
            OR ro.verification_status IN ('owner_confirmed', 'community_review', 'verified'))
       )
       AND NOT EXISTS (
       SELECT 1 FROM observation_identification_claims accepted_claim
       JOIN record_observations accepted_record
         ON accepted_record.observation_id = accepted_claim.observation_id
        WHERE accepted_record.record_runtime = 'cloudflare_d1'
          AND accepted_record.record_id = o.observation_id
          AND accepted_claim.claim_status = 'accepted'
       )
       AND NOT EXISTS (
       SELECT 1 FROM observation_ai_review_targets human_target
        WHERE human_target.occurrence_id = 'occ:' || o.observation_id || ':0'
          AND (NULLIF(TRIM(human_target.scientific_name), '') IS NOT NULL
            OR NULLIF(TRIM(human_target.vernacular_name), '') IS NOT NULL
            OR NULLIF(TRIM(human_target.taxon_rank), '') IS NOT NULL)
       )
       AND NOT EXISTS (
       SELECT 1 FROM observation_record_ai_reviews review
        WHERE review.occurrence_id = 'occ:' || o.observation_id || ':0'
          AND review.review_state IN ('agree', 'disagree')
       )
       AND NOT EXISTS (
       SELECT 1 FROM observation_identifications identification
        WHERE identification.occurrence_id = 'occ:' || o.observation_id || ':0'
          AND identification.is_current = 1
       )
       AND NOT EXISTS (
       SELECT 1 FROM observation_identification_disputes dispute
        WHERE dispute.occurrence_id = 'occ:' || o.observation_id || ':0'
          AND dispute.status = 'open'
       )
       AND EXISTS (
       SELECT 1 FROM asset_ledger asset
        WHERE asset.observation_id = o.observation_id
          AND asset.processing_state = 'uploaded'
          AND asset.mime LIKE 'image/%'
          AND asset.public_derivative_key IS NOT NULL
          AND asset.public_derivative_sha256 IS NOT NULL
          AND asset.public_derivative_verified_at IS NOT NULL
          AND asset.public_derivative_metadata_json IS NOT NULL
          AND asset.public_derivative_metadata_json NOT LIKE '%"scannedContainer":"svg+xml"%'
          AND asset.public_derivative_metadata_json NOT LIKE '%"contentType":"image/svg%'
          AND asset.public_ready_at IS NOT NULL
          AND asset.exif_scrub_state = 'scrubbed'
          AND NOT (
            COALESCE(asset.width, 0) = 320 AND COALESCE(asset.height, 0) = 240
            AND COALESCE(asset.bytes, 0) > 0 AND asset.bytes <= 12000
          )
          AND NOT (COALESCE(asset.width, 0) = 1 AND COALESCE(asset.height, 0) = 1)
       )
  )
  SELECT request_id, observation_id, owner_user_id, request_state,
         source_payload_json, candidate_label, candidate_rank, quality_revision,
         CASE
           WHEN ${COARSE_CANDIDATE_SQL} THEN 'coarse_taxonomic_rank'
           WHEN ${MISSING_CANDIDATE_SQL} THEN 'missing_ai_candidate'
           ELSE 'outdated_ai_result'
         END AS needs_reason
    FROM candidate_rows
   WHERE (
     (request_id IS NULL AND (${COARSE_CANDIDATE_SQL} OR ${MISSING_CANDIDATE_SQL}))
     OR (
       request_state = 'completed'
       AND CASE
         WHEN json_valid(source_payload_json)
           THEN COALESCE(json_extract(source_payload_json, '$.qualityBacklogRevision'), '')
         ELSE ''
       END <> quality_revision
       AND (
         ${COARSE_CANDIDATE_SQL}
         OR ${MISSING_CANDIDATE_SQL}
         OR CASE
           WHEN json_valid(source_payload_json)
             THEN COALESCE(json_extract(source_payload_json, '$.ruleVersion'), '')
           ELSE ''
         END <> ?
       )
     )
   )
   ORDER BY
     CASE
       WHEN ${COARSE_CANDIDATE_SQL} THEN 0
       WHEN ${MISSING_CANDIDATE_SQL} THEN 1
       ELSE 2
     END,
     observed_at ASC,
     observation_id ASC
   LIMIT ?`;

export const OBSERVATION_AI_QUALITY_BACKLOG_INSERT_SQL = `
  INSERT OR IGNORE INTO observation_reassessment_requests (
    request_id, observation_id, request_kind, actor_user_id, request_state,
    source_payload_json, created_at, updated_at
  )
  SELECT ?, ?, 'standard', ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
   WHERE (SELECT COUNT(*) FROM observation_reassessment_requests
           WHERE request_kind = 'standard' AND request_state IN ('pending', 'processing')) < ?`;

export const OBSERVATION_AI_QUALITY_BACKLOG_CAS_SQL = `
  UPDATE observation_reassessment_requests
     SET request_state = 'pending', source_payload_json = ?, updated_at = CURRENT_TIMESTAMP
   WHERE request_id = ?
     AND request_state = 'completed'
     AND source_payload_json = ?
     AND (SELECT COUNT(*) FROM observation_reassessment_requests
           WHERE request_kind = 'standard' AND request_state IN ('pending', 'processing')) < ?`;

export const OBSERVATION_AI_QUALITY_BACKLOG_REVALIDATE_SQL = `
  SELECT 1 AS eligible
    FROM observations o
    JOIN observation_data_rights rights ON rights.visit_id = o.observation_id
   WHERE o.observation_id = ?
     AND o.visibility = 'public'
     AND o.emergency_hidden = 0
     AND o.processing_state IN ('accepted', 'auto_accepted')
     AND rights.withdrawal_status = 'active'
     AND rights.record_consent IN ('public_summary', 'external_export')
     AND NOT EXISTS (
       SELECT 1 FROM record_observations ro
        WHERE ro.record_runtime = 'cloudflare_d1' AND ro.record_id = o.observation_id
          AND ro.lifecycle_status <> 'active'
     )
     AND NOT EXISTS (
       SELECT 1 FROM record_observations ro
        WHERE ro.record_runtime = 'cloudflare_d1' AND ro.record_id = o.observation_id
          AND ro.lifecycle_status = 'active'
          AND (ro.accepted_identification_id IS NOT NULL
            OR ro.assertion_status = 'human_asserted'
            OR ro.verification_status IN ('owner_confirmed', 'community_review', 'verified'))
     )
     AND NOT EXISTS (
       SELECT 1 FROM observation_identification_claims accepted_claim
       JOIN record_observations accepted_record
         ON accepted_record.observation_id = accepted_claim.observation_id
        WHERE accepted_record.record_runtime = 'cloudflare_d1'
          AND accepted_record.record_id = o.observation_id
          AND accepted_claim.claim_status = 'accepted'
     )
     AND NOT EXISTS (
       SELECT 1 FROM observation_ai_review_targets human_target
        WHERE human_target.occurrence_id = 'occ:' || o.observation_id || ':0'
          AND (NULLIF(TRIM(human_target.scientific_name), '') IS NOT NULL
            OR NULLIF(TRIM(human_target.vernacular_name), '') IS NOT NULL
            OR NULLIF(TRIM(human_target.taxon_rank), '') IS NOT NULL)
     )
     AND NOT EXISTS (
       SELECT 1 FROM observation_record_ai_reviews review
        WHERE review.occurrence_id = 'occ:' || o.observation_id || ':0'
          AND review.review_state IN ('agree', 'disagree')
     )
     AND NOT EXISTS (
       SELECT 1 FROM observation_identifications identification
        WHERE identification.occurrence_id = 'occ:' || o.observation_id || ':0'
          AND identification.is_current = 1
     )
     AND NOT EXISTS (
       SELECT 1 FROM observation_identification_disputes dispute
        WHERE dispute.occurrence_id = 'occ:' || o.observation_id || ':0'
          AND dispute.status = 'open'
     )
     AND EXISTS (
       SELECT 1 FROM asset_ledger asset
        WHERE asset.observation_id = o.observation_id
          AND asset.processing_state = 'uploaded' AND asset.mime LIKE 'image/%'
          AND asset.public_derivative_key IS NOT NULL
          AND asset.public_derivative_sha256 IS NOT NULL
          AND asset.public_derivative_verified_at IS NOT NULL
          AND asset.public_derivative_metadata_json IS NOT NULL
          AND asset.public_derivative_metadata_json NOT LIKE '%"scannedContainer":"svg+xml"%'
          AND asset.public_derivative_metadata_json NOT LIKE '%"contentType":"image/svg%'
          AND asset.public_ready_at IS NOT NULL
          AND asset.exif_scrub_state = 'scrubbed'
          AND NOT (COALESCE(asset.width, 0) = 320 AND COALESCE(asset.height, 0) = 240
            AND COALESCE(asset.bytes, 0) > 0 AND asset.bytes <= 12000)
          AND NOT (COALESCE(asset.width, 0) = 1 AND COALESCE(asset.height, 0) = 1)
     )
   LIMIT 1`;

export function observationAiQualityBacklogCapacity(activeCount: number): number {
  return Math.max(
    0,
    Math.min(
      GEMINI_QUALITY_BACKLOG_MAX_REQUEUE_PER_TICK,
      GEMINI_QUALITY_BACKLOG_MAX_ACTIVE - activeCount,
    ),
  );
}

export function buildObservationAiQualityBacklogPayload(
  previousPayload: string | null,
  reason: ObservationAiQualityBacklogTargetRow["needs_reason"],
  qualityRevision: string,
  requestedAt: string,
): string {
  let previous: Record<string, unknown> = {};
  if (previousPayload) {
    try {
      const parsed: unknown = JSON.parse(previousPayload);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        previous = parsed as Record<string, unknown>;
      }
    } catch {
      previous = {};
    }
  }
  delete previous.batchExecution;
  delete previous.lastSubmitError;
  delete previous.errorCode;
  delete previous.failedAt;
  return JSON.stringify({
    ...previous,
    source: "public_photo_ai_quality_backlog",
    qualityBacklogVersion: GEMINI_QUALITY_BACKLOG_VERSION,
    qualityBacklogRevision: qualityRevision,
    reason,
    executionStatus: "pending",
    attemptCount: 0,
    requestedAt,
  });
}
