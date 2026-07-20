import {
  OBSERVATION_AI_PROMPT_VERSION,
  OBSERVATION_AI_RULE_VERSION,
  OBSERVATION_VISION_MODEL,
  observationAiSubjects,
  type ObservationAiCandidate,
} from "./cloudflareObservationAi";

export type ObservationAiSqlMutation = {
  sql: string;
  values: Array<string | number | null>;
};

export type ObservationAiDualWriteInput = {
  recordId: string;
  ownerUserId: string;
  mediaId: string;
  legacyOccurrenceId: string;
  requestId: string;
  aiRunId: string;
  candidate: ObservationAiCandidate;
};

const textBytes = (value: string): ArrayBuffer => new TextEncoder().encode(value).buffer as ArrayBuffer;

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", textBytes(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const deterministicUuid = async (value: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", textBytes(value)));
  const bytes = digest.slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export async function buildObservationAiDualWritePlan(input: ObservationAiDualWriteInput): Promise<{
  observationIds: string[];
  mutations: ObservationAiSqlMutation[];
}> {
  const mutations: ObservationAiSqlMutation[] = [];
  const observationIds: string[] = [];
  for (const subject of observationAiSubjects(input.candidate)) {
    const sourceKey = [
      "cloudflare_workers_ai",
      input.recordId,
      input.mediaId,
      OBSERVATION_VISION_MODEL,
      OBSERVATION_AI_PROMPT_VERSION,
      OBSERVATION_AI_RULE_VERSION,
      subject.subjectKey,
    ].join(":");
    const inputFingerprint = await sha256Hex(sourceKey);
    const observationId = await deterministicUuid(`record-observation:${sourceKey}`);
    const mappingId = await deterministicUuid(`record-observation-source-map:${sourceKey}`);
    const mediaLinkId = await deterministicUuid(`record-observation-media:${sourceKey}`);
    const suggestionId = await deterministicUuid(`observation-ai-suggestion:${sourceKey}`);
    const lifecycleEventId = await deterministicUuid(`observation-lifecycle-created:${sourceKey}`);
    const ledgerId = await deterministicUuid(`record-observation-consistency:${sourceKey}`);
    const provenance = JSON.stringify({
      source: "cloudflare_workers_ai_observation_reassessment",
      legacyOccurrenceId: input.legacyOccurrenceId,
      requestId: input.requestId,
      aiRunId: input.aiRunId,
      assetId: input.mediaId,
      subjectKey: subject.subjectKey,
      primary: subject.primary,
      model: OBSERVATION_VISION_MODEL,
      promptVersion: OBSERVATION_AI_PROMPT_VERSION,
      ruleVersion: OBSERVATION_AI_RULE_VERSION,
      inputFingerprint,
    });
    const context = JSON.stringify({
      primary: subject.primary,
      subjectKey: subject.subjectKey,
      candidateConfidence: subject.candidate.confidence,
      subjectLocator: subject.candidate.subjectLocator,
    });
    const rationale = JSON.stringify({
      visualEvidence: subject.candidate.visualEvidence,
      needsMoreEvidence: subject.candidate.needsMoreEvidence,
      subjectLocator: subject.candidate.subjectLocator,
    });
    const targetChecksum = await sha256Hex(JSON.stringify({ observationId, context, rationale }));
    observationIds.push(observationId);
    mutations.push(
      {
        sql: `INSERT INTO record_observations (
          observation_id, record_id, owner_user_id, origin, assertion_status,
          verification_status, lifecycle_status, data_use_scope, accepted_identification_id,
          subject_type, individual_certainty, context_json, provenance_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'ai', 'provisional', 'unreviewed', 'active', 'personal_only', NULL,
          'organism', 'unknown', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(observation_id) DO UPDATE SET
          context_json = excluded.context_json,
          provenance_json = excluded.provenance_json,
          updated_at = CURRENT_TIMESTAMP
        WHERE record_observations.origin = 'ai'
          AND record_observations.assertion_status = 'provisional'`,
        values: [observationId, input.recordId, input.ownerUserId, context, provenance],
      },
      {
        sql: `INSERT INTO record_observation_source_map (
          mapping_id, observation_id, source_system, source_entity_type, source_id,
          source_version, mapping_kind, provenance_json, created_at
        ) VALUES (?, ?, 'cloudflare_native', 'ai_visual_subject', ?, ?, 'dual_write', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(observation_id, source_system, source_entity_type, source_id, mapping_kind)
        DO UPDATE SET source_version = excluded.source_version, provenance_json = excluded.provenance_json`,
        values: [mappingId, observationId, sourceKey, OBSERVATION_AI_RULE_VERSION, provenance],
      },
      {
        sql: `INSERT INTO record_observation_media (
          link_id, observation_id, media_id, media_role, locator_key, subject_locator,
          source_kind, confidence_score, lifecycle_status, provenance_json, created_at, updated_at
        ) VALUES (?, ?, ?, 'evidence', ?, ?, 'ai', ?, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(observation_id, media_id, locator_key) DO UPDATE SET
          subject_locator = excluded.subject_locator,
          confidence_score = excluded.confidence_score,
          provenance_json = excluded.provenance_json,
          lifecycle_status = 'active',
          updated_at = CURRENT_TIMESTAMP`,
        values: [
          mediaLinkId,
          observationId,
          input.mediaId,
          subject.subjectKey,
          JSON.stringify(subject.candidate.subjectLocator),
          subject.candidate.confidence,
          provenance,
        ],
      },
      {
        sql: `INSERT INTO observation_ai_suggestions (
          suggestion_id, observation_id, ai_run_id, idempotency_key, candidate_key,
          proposed_name, proposed_scientific_name, proposed_rank, confidence_score,
          rationale_json, model_provider, model_name, model_version, prompt_version,
          rule_version, input_fingerprint, input_provenance, suggestion_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cloudflare_workers_ai', ?, '', ?, ?, ?, ?,
          'proposed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(idempotency_key) DO UPDATE SET
          ai_run_id = excluded.ai_run_id,
          proposed_name = excluded.proposed_name,
          proposed_scientific_name = excluded.proposed_scientific_name,
          proposed_rank = excluded.proposed_rank,
          confidence_score = excluded.confidence_score,
          rationale_json = excluded.rationale_json,
          input_provenance = excluded.input_provenance,
          updated_at = CURRENT_TIMESTAMP
        WHERE observation_ai_suggestions.suggestion_status = 'proposed'`,
        values: [
          suggestionId,
          observationId,
          input.aiRunId,
          inputFingerprint,
          subject.subjectKey,
          subject.candidate.vernacularName ?? subject.candidate.scientificName,
          subject.candidate.scientificName,
          subject.candidate.rank,
          subject.candidate.confidence,
          rationale,
          OBSERVATION_VISION_MODEL,
          OBSERVATION_AI_PROMPT_VERSION,
          OBSERVATION_AI_RULE_VERSION,
          inputFingerprint,
          provenance,
        ],
      },
      {
        sql: `INSERT OR IGNORE INTO observation_lifecycle_events (
          event_id, observation_id, actor_kind, actor_user_id, event_type,
          previous_state, next_state, reason_code, provenance_json, created_at
        ) VALUES (?, ?, 'system', NULL, 'created', '{}', ?, 'ai_visual_subject_detected', ?, CURRENT_TIMESTAMP)`,
        values: [
          lifecycleEventId,
          observationId,
          JSON.stringify({
            origin: "ai",
            assertionStatus: "provisional",
            verificationStatus: "unreviewed",
            dataUseScope: "personal_only",
            acceptedIdentificationId: null,
          }),
          provenance,
        ],
      },
      {
        sql: `INSERT INTO record_observation_consistency_ledger (
          ledger_id, ledger_key, record_id, observation_id, operation_key,
          old_write_status, new_write_status, source_ref, target_ref,
          source_checksum, target_checksum, difference_code, details_json, created_at, resolved_at
        ) VALUES (?, ?, ?, ?, 'ai_provisional_observation_dual_write',
          'succeeded', 'succeeded', ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(ledger_key) DO UPDATE SET
          old_write_status = 'succeeded', new_write_status = 'succeeded',
          source_ref = excluded.source_ref, target_ref = excluded.target_ref,
          source_checksum = excluded.source_checksum, target_checksum = excluded.target_checksum,
          difference_code = NULL, details_json = excluded.details_json, resolved_at = CURRENT_TIMESTAMP`,
        values: [
          ledgerId,
          inputFingerprint,
          input.recordId,
          observationId,
          input.legacyOccurrenceId,
          observationId,
          inputFingerprint,
          targetChecksum,
          JSON.stringify({ subjectKey: subject.subjectKey, aiOnly: true, activeOccurrenceCreated: false }),
        ],
      },
    );
  }
  return { observationIds, mutations };
}
