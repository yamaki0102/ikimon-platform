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
  mediaIds: string[];
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
    const mediaId = input.mediaIds[subject.candidate.assetIndex ?? 0] ?? input.mediaIds[0];
    if (!mediaId) continue;
    const sourceKey = [
      "google_gemini_batch",
      input.recordId,
      OBSERVATION_AI_RULE_VERSION,
      subject.subjectKey,
    ].join(":");
    const modelName = subject.candidate.sourceModel ?? OBSERVATION_VISION_MODEL;
    const inputFingerprint = await sha256Hex(JSON.stringify({ sourceKey, mediaIds: input.mediaIds, modelName, promptVersion: OBSERVATION_AI_PROMPT_VERSION }));
    const observationId = await deterministicUuid(`record-observation:${sourceKey}`);
    const mappingId = await deterministicUuid(`record-observation-source-map:${sourceKey}`);
    const mediaLinkId = await deterministicUuid(`record-observation-media:${sourceKey}`);
    const suggestionId = await deterministicUuid(`observation-ai-suggestion:${sourceKey}`);
    const lifecycleEventId = await deterministicUuid(`observation-lifecycle-created:${sourceKey}`);
    const ledgerId = await deterministicUuid(`record-observation-consistency:${sourceKey}`);
    const provenance = JSON.stringify({
      source: "google_gemini_batch_observation_reassessment",
      legacyOccurrenceId: input.legacyOccurrenceId,
      requestId: input.requestId,
      aiRunId: input.aiRunId,
      assetId: mediaId,
      subjectKey: subject.subjectKey,
      primary: subject.primary,
      model: modelName,
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
          observation_id, record_runtime, record_id, owner_user_id, source_key,
          origin, assertion_status, verification_status, lifecycle_status, data_use_scope,
          accepted_identification_id, subject_type, individual_certainty, captive_context,
          count_mode, display_order, context_json, provenance_json, created_at, updated_at
        ) VALUES (?, 'cloudflare_d1', ?, ?, ?,
          'ai', 'provisional', 'unreviewed', 'active', 'personal_only', NULL,
          'organism', 'unknown', 'unknown', 'unknown', 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(observation_id) DO UPDATE SET
          context_json = excluded.context_json,
          provenance_json = excluded.provenance_json,
          row_version = record_observations.row_version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE record_observations.origin = 'ai'
          AND record_observations.assertion_status = 'provisional'
          AND record_observations.accepted_identification_id IS NULL`,
        values: [observationId, input.recordId, input.ownerUserId, sourceKey, context, provenance],
      },
      {
        sql: `INSERT INTO record_observation_source_map (
          mapping_id, source_runtime, source_entity_kind, source_entity_id,
          mapping_rule_version, observation_id, mapping_kind, mapping_confidence,
          ambiguity_state, source_snapshot_hash, provenance_json, created_at
        ) VALUES (?, 'machine', 'ai_review_target', ?, ?, ?, 'candidate', ?,
          'clear', ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(source_runtime, source_entity_kind, source_entity_id, mapping_rule_version)
        DO UPDATE SET
          observation_id = excluded.observation_id,
          mapping_confidence = excluded.mapping_confidence,
          source_snapshot_hash = excluded.source_snapshot_hash,
          provenance_json = excluded.provenance_json`,
        values: [mappingId, sourceKey, OBSERVATION_AI_RULE_VERSION, observationId, subject.candidate.confidence, inputFingerprint, provenance],
      },
      {
        sql: `INSERT INTO record_observation_media (
          link_id, observation_id, media_source_runtime, media_id, role,
          locator_kind, locator_json, origin, active, source_key,
          provenance_json, created_at, updated_at
        ) VALUES (?, ?, 'cloudflare_d1', ?, 'primary_evidence',
          ?, ?, 'ai', 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(observation_id, source_key) DO UPDATE SET
          locator_kind = excluded.locator_kind,
          locator_json = excluded.locator_json,
          provenance_json = excluded.provenance_json,
          active = 1,
          updated_at = CURRENT_TIMESTAMP`,
        values: [
          mediaLinkId,
          observationId,
          mediaId,
          subject.candidate.subjectLocator.rect ? "rect" : "full",
          JSON.stringify(subject.candidate.subjectLocator),
          `${sourceKey}:media`,
          provenance,
        ],
      },
      {
        sql: `INSERT INTO observation_ai_suggestions (
          suggestion_id, observation_id, ai_run_id, candidate_key, source_key,
          proposed_name, proposed_scientific_name, proposed_rank, confidence_score,
          rationale_json, model_provider, model_name, model_version, prompt_version,
          rule_version, input_digest, input_provenance_json, suggestion_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_gemini_api', ?, '', ?, ?, ?, ?,
          'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(observation_id, source_key) DO UPDATE SET
          ai_run_id = excluded.ai_run_id,
          proposed_name = excluded.proposed_name,
          proposed_scientific_name = excluded.proposed_scientific_name,
          proposed_rank = excluded.proposed_rank,
          confidence_score = excluded.confidence_score,
          rationale_json = excluded.rationale_json,
          input_digest = excluded.input_digest,
          input_provenance_json = excluded.input_provenance_json,
          updated_at = CURRENT_TIMESTAMP
        WHERE observation_ai_suggestions.suggestion_status = 'active'`,
        values: [
          suggestionId,
          observationId,
          input.aiRunId,
          subject.subjectKey,
          sourceKey,
          subject.candidate.vernacularName ?? subject.candidate.scientificName,
          subject.candidate.scientificName,
          subject.candidate.rank,
          subject.candidate.confidence,
          rationale,
          modelName,
          OBSERVATION_AI_PROMPT_VERSION,
          OBSERVATION_AI_RULE_VERSION,
          inputFingerprint,
          provenance,
        ],
      },
      {
        sql: `INSERT OR IGNORE INTO observation_lifecycle_events (
          event_id, observation_id, event_kind, actor_kind, actor_id,
          reason_code, before_json, after_json, related_observation_ids_json,
          source_key, created_at
        ) VALUES (?, ?, 'created', 'system', NULL,
          'ai_visual_subject_detected', '{}', ?, '[]', ?, CURRENT_TIMESTAMP)`,
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
          `${sourceKey}:created`,
        ],
      },
      {
        sql: `INSERT INTO record_observation_consistency_ledger (
          ledger_id, operation_key, record_runtime, record_id, observation_id,
          operation_kind, legacy_write_refs_json, target_write_refs_json,
          source_digest, target_digest, consistency_state, reason_codes_json,
          attempt_count, created_at, updated_at, resolved_at
        ) VALUES (?, ?, 'cloudflare_d1', ?, ?,
          'ai_analysis', ?, ?, ?, ?, 'matched', '[]',
          1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(operation_key) DO UPDATE SET
          legacy_write_refs_json = excluded.legacy_write_refs_json,
          target_write_refs_json = excluded.target_write_refs_json,
          source_digest = excluded.source_digest,
          target_digest = excluded.target_digest,
          consistency_state = 'matched',
          reason_codes_json = '[]',
          attempt_count = MIN(record_observation_consistency_ledger.attempt_count + 1, 100),
          updated_at = CURRENT_TIMESTAMP,
          resolved_at = CURRENT_TIMESTAMP`,
        values: [
          ledgerId,
          inputFingerprint,
          input.recordId,
          observationId,
          JSON.stringify({ occurrenceId: input.legacyOccurrenceId, aiRunId: input.aiRunId }),
          JSON.stringify({ observationId, suggestionId, mediaLinkId }),
          inputFingerprint,
          targetChecksum,
        ],
      },
    );
  }
  const placeholders = observationIds.map(() => "?").join(", ");
  if (observationIds.length > 0) {
    const replacementId = observationIds[0]!;
    const staleWhere = `record_runtime = 'cloudflare_d1' AND record_id = ? AND origin = 'ai'
      AND assertion_status = 'provisional' AND accepted_identification_id IS NULL
      AND lifecycle_status = 'active' AND observation_id NOT IN (${placeholders})`;
    mutations.push(
      {
        sql: `UPDATE observation_ai_suggestions SET suggestion_status = 'superseded', updated_at = CURRENT_TIMESTAMP
          WHERE suggestion_status = 'active' AND observation_id IN (SELECT observation_id FROM record_observations WHERE ${staleWhere})`,
        values: [input.recordId, ...observationIds],
      },
      {
        sql: `UPDATE record_observations SET lifecycle_status = 'superseded', superseded_by_observation_id = ?,
          excluded_reason = NULL, row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE ${staleWhere}`,
        values: [replacementId, input.recordId, ...observationIds],
      },
    );
  } else {
    const staleWhere = `record_runtime = 'cloudflare_d1' AND record_id = ? AND origin = 'ai'
      AND assertion_status = 'provisional' AND accepted_identification_id IS NULL AND lifecycle_status = 'active'`;
    mutations.push(
      {
        sql: `UPDATE observation_ai_suggestions SET suggestion_status = 'superseded', updated_at = CURRENT_TIMESTAMP
          WHERE suggestion_status = 'active' AND observation_id IN (SELECT observation_id FROM record_observations WHERE ${staleWhere})`,
        values: [input.recordId],
      },
      {
        sql: `UPDATE record_observations SET lifecycle_status = 'excluded', excluded_reason = 'ai_reassessment_no_visible_biota',
          superseded_by_observation_id = NULL, row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
          WHERE ${staleWhere}`,
        values: [input.recordId],
      },
    );
  }
  return { observationIds, mutations };
}
