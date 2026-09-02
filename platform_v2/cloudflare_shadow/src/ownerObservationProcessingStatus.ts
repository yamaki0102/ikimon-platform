import {
  deriveObservationProcessingStatus,
  type ObservationProcessingStatus,
} from "../../src/services/observationProcessingStatus.js";

type D1Value = string | number | null;

type D1PreparedStatementLike = {
  bind(...values: D1Value[]): D1PreparedStatementLike;
  first<T = unknown>(): Promise<T | null>;
};

export type OwnerObservationProcessingStatusDatabase = {
  prepare(query: string): D1PreparedStatementLike;
};

type OwnerObservationProcessingFactsRow = {
  observation_id: string;
  observed_at: string;
  original_photo_count: number;
  display_photo_count: number;
  latest_media_job_status: string | null;
  latest_media_job_error: string | null;
  ai_request_status: string | null;
  ai_request_source_payload_json: string | null;
  ai_assessment_status: string | null;
  candidate_count: number;
  identification_count: number;
  updated_at: string | null;
};

export function isObsoleteInteractiveGeminiResult(sourcePayloadJson: string | null | undefined): boolean {
  if (!sourcePayloadJson) return false;
  try {
    const payload = JSON.parse(sourcePayloadJson) as Record<string, unknown>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.providerMode !== "direct_generate_content") return false;
    const plan = payload.modelPlan && typeof payload.modelPlan === "object" && !Array.isArray(payload.modelPlan)
      ? payload.modelPlan as Record<string, unknown>
      : {};
    const models = Array.isArray(payload.models) ? payload.models : [];
    return [plan.primary, plan.census, plan.environment, plan.summary, ...models]
      .some((model) => model === "gemini-3.1-flash-lite");
  } catch {
    return false;
  }
}

const OWNER_PROCESSING_STATUS_SQL = `SELECT
  o.observation_id,
  o.observed_at,
  (SELECT COUNT(*)
     FROM asset_ledger a
    WHERE a.observation_id = o.observation_id
      AND a.mime LIKE 'image/%'
      AND a.processing_state = 'uploaded') AS original_photo_count,
  (SELECT COUNT(*)
     FROM asset_ledger a
    WHERE a.observation_id = o.observation_id
      AND a.mime LIKE 'image/%'
      AND a.processing_state = 'uploaded'
      AND a.public_derivative_key IS NOT NULL
      AND a.public_derivative_verified_at IS NOT NULL
      AND a.public_derivative_metadata_json IS NOT NULL
      AND a.public_derivative_metadata_json NOT LIKE '%"scannedContainer":"svg+xml"%'
      AND a.public_derivative_metadata_json NOT LIKE '%"contentType":"image/svg%'
      AND a.exif_scrub_state = 'scrubbed'
      AND a.public_ready_at IS NOT NULL) AS display_photo_count,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM asset_ledger failed_asset
       WHERE failed_asset.observation_id = o.observation_id
         AND failed_asset.mime LIKE 'image/%'
         AND failed_asset.processing_state = 'uploaded'
         AND failed_asset.exif_scrub_state = 'failed'
    ) THEN 'failed'
    ELSE (SELECT CASE
                   WHEN ob.dispatch_state = 'pending' AND ob.last_error IS NOT NULL THEN 'failed'
                   ELSE ob.dispatch_state
                 END
            FROM outbox ob
           WHERE ob.target_id = o.observation_id
             AND ob.topic = 'media.process'
           ORDER BY ob.created_at DESC
           LIMIT 1)
  END AS latest_media_job_status,
  (SELECT ob.last_error
     FROM outbox ob
    WHERE ob.target_id = o.observation_id
      AND ob.topic = 'media.process'
    ORDER BY ob.created_at DESC
    LIMIT 1) AS latest_media_job_error,
  (SELECT rr.request_state
     FROM observation_reassessment_requests rr
    WHERE rr.observation_id = o.observation_id
      AND rr.actor_user_id = o.owner_user_id
      AND rr.request_kind = 'standard'
    ORDER BY rr.updated_at DESC
    LIMIT 1) AS ai_request_status,
  (SELECT rr.source_payload_json
     FROM observation_reassessment_requests rr
    WHERE rr.observation_id = o.observation_id
      AND rr.actor_user_id = o.owner_user_id
      AND rr.request_kind = 'standard'
    ORDER BY rr.updated_at DESC
    LIMIT 1) AS ai_request_source_payload_json,
  (SELECT art.ai_assessment_status
     FROM observation_ai_review_targets art
    WHERE art.occurrence_id = 'occ:' || o.observation_id || ':0'
    LIMIT 1) AS ai_assessment_status,
  (SELECT CASE WHEN
       art.candidate_id IS NOT NULL
       OR art.candidate_scientific_name IS NOT NULL
       OR art.candidate_vernacular_name IS NOT NULL
       OR art.ai_recommended_taxon_name IS NOT NULL
     THEN 1 ELSE 0 END
     FROM observation_ai_review_targets art
    WHERE art.occurrence_id = 'occ:' || o.observation_id || ':0'
    LIMIT 1) AS candidate_count,
  (SELECT COUNT(*)
     FROM observation_identifications oi
    WHERE oi.occurrence_id = 'occ:' || o.observation_id || ':0'
      AND oi.is_current = 1) AS identification_count,
  COALESCE(
    (SELECT MAX(rr.updated_at)
       FROM observation_reassessment_requests rr
      WHERE rr.observation_id = o.observation_id),
    (SELECT MAX(COALESCE(a.public_derivative_verified_at, a.uploaded_at, a.created_at))
       FROM asset_ledger a
      WHERE a.observation_id = o.observation_id),
    o.observed_at
  ) AS updated_at
FROM observations o
WHERE o.observation_id = ?
  AND o.owner_user_id = ?
LIMIT 1`;

export async function loadOwnerObservationProcessingStatusFromD1(
  database: OwnerObservationProcessingStatusDatabase,
  input: {
    observationId: string;
    ownerUserId: string;
    providerAvailable: boolean;
  },
): Promise<ObservationProcessingStatus | null> {
  const row = await database
    .prepare(OWNER_PROCESSING_STATUS_SQL)
    .bind(input.observationId, input.ownerUserId)
    .first<OwnerObservationProcessingFactsRow>();
  if (!row) return null;

  const obsoleteInteractiveResult = row.ai_request_status === "completed"
    && isObsoleteInteractiveGeminiResult(row.ai_request_source_payload_json);

  return deriveObservationProcessingStatus({
    occurrenceId: `occ:${row.observation_id}:0`,
    visitId: row.observation_id,
    originalPhotoCount: Number(row.original_photo_count ?? 0),
    displayPhotoCount: Number(row.display_photo_count ?? 0),
    latestMediaJobStatus: row.latest_media_job_status,
    latestMediaJobError: row.latest_media_job_error,
    aiRequestStatus: obsoleteInteractiveResult ? "failed" : row.ai_request_status,
    aiAssessmentStatus: obsoleteInteractiveResult ? null : row.ai_assessment_status,
    candidateCount: obsoleteInteractiveResult ? 0 : Number(row.candidate_count ?? 0),
    identificationCount: Number(row.identification_count ?? 0),
    providerAvailable: input.providerAvailable,
    updatedAt: row.updated_at ?? row.observed_at,
  });
}
