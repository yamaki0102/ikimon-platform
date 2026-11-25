import {
  OBSERVATION_AI_PROMPT_VERSION,
  OBSERVATION_AI_RULE_VERSION,
  OBSERVATION_VISION_MODEL,
  observationAiSubjects,
  type ObservationAiCandidate,
} from "./cloudflareObservationAi";
import {
  buildFeaturePlaceMutations,
  buildOrganismReadingMutations,
  deterministicUuid,
  resolveMediaIndex,
  sha256Hex,
  validTimeRange,
  type ReadingFeatureInput,
  type ReadingMediaMeta,
  type ReadingPlaceInput,
} from "./recordReading";

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
  mediaMeta?: ReadingMediaMeta[];
  features?: ReadingFeatureInput[];
  place?: ReadingPlaceInput[];
};

export async function buildObservationAiDualWritePlan(input: ObservationAiDualWriteInput): Promise<{
  observationIds: string[];
  mutations: ObservationAiSqlMutation[];
}> {
  const mutations: ObservationAiSqlMutation[] = [];
  const observationIds: string[] = [];
  for (const subject of observationAiSubjects(input.candidate)) {
    if (input.mediaIds.length === 0) continue;
    const requestedIndices: Array<number | undefined> = subject.candidate.assetIndices
      ?? (subject.candidate.assetIndex === undefined ? [undefined] : [subject.candidate.assetIndex]);
    const attachedMediaIds = [...new Set(
      (requestedIndices.length > 0 ? requestedIndices : [undefined])
        .map((index) => resolveMediaIndex(index, input.mediaIds))
        .filter((value): value is string => value !== null),
    )];
    const primaryMediaId = resolveMediaIndex(subject.candidate.assetIndex ?? requestedIndices[0], input.mediaIds);
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
    const suggestionId = await deterministicUuid(`observation-ai-suggestion:${sourceKey}`);
    const lifecycleEventId = await deterministicUuid(`observation-lifecycle-created:${sourceKey}`);
    const ledgerId = await deterministicUuid(`record-observation-consistency:${sourceKey}`);
    const provenance = JSON.stringify({
      source: "google_gemini_batch_observation_reassessment",
      legacyOccurrenceId: input.legacyOccurrenceId,
      requestId: input.requestId,
      aiRunId: input.aiRunId,
      assetId: attachedMediaIds[0] ?? null,
      assetIds: attachedMediaIds,
      subjectKey: subject.subjectKey,
      primary: subject.primary,
      model: modelName,
      promptVersion: OBSERVATION_AI_PROMPT_VERSION,
      ruleVersion: OBSERVATION_AI_RULE_VERSION,
      inputFingerprint,
    });
    const mediaMutations: ObservationAiSqlMutation[] = [];
    const mediaLinkIds: string[] = [];
    const mediaSourceKeys: string[] = [];
    for (const attachedId of attachedMediaIds) {
      const linkSourceKey = `${sourceKey}:media:${attachedId}`;
      const linkId = await deterministicUuid(`record-observation-media:${sourceKey}:${attachedId}`);
      const locator = attachedId === primaryMediaId ? subject.candidate.subjectLocator : {};
      const range = attachedId === primaryMediaId
        ? validTimeRange(locator.timeRange, input.mediaMeta?.[input.mediaIds.indexOf(attachedId)]?.durationMs)
        : null;
      mediaLinkIds.push(linkId);
      mediaSourceKeys.push(linkSourceKey);
      mediaMutations.push({
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
          linkId,
          observationId,
          attachedId,
          range ? "time_range" : locator.rect ? "rect" : "full",
          JSON.stringify(range ?? locator),
          linkSourceKey,
          provenance,
        ],
      });
    }
    mediaMutations.push({
      sql: `UPDATE record_observation_media SET active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE observation_id = ? AND origin = 'ai' AND active = 1
          AND source_key NOT IN (${mediaSourceKeys.length > 0 ? mediaSourceKeys.map(() => "?").join(", ") : "''"})`,
      values: [observationId, ...mediaSourceKeys],
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
      ...mediaMutations,
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
          JSON.stringify({ observationId, suggestionId, mediaLinkIds }),
          inputFingerprint,
          targetChecksum,
        ],
      },
      ...await buildOrganismReadingMutations(input.recordId, input.requestId, {
        observationId,
        suggestionId,
        displayOrder: observationIds.length - 1,
        assetIds: attachedMediaIds,
        aiRunId: input.aiRunId,
      }),
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
  if (input.place !== undefined || input.features !== undefined) {
    mutations.push(...await buildFeaturePlaceMutations({
      recordId: input.recordId,
      requestId: input.requestId,
      aiRunId: input.aiRunId,
      mediaIds: input.mediaIds,
      mediaMeta: input.mediaMeta,
      model: input.candidate.sourceModel ?? OBSERVATION_VISION_MODEL,
      promptVersion: OBSERVATION_AI_PROMPT_VERSION,
      organismCount: observationIds.length,
      features: input.features,
      place: input.place,
    }));
  }
  return { observationIds, mutations };
}

export function guardObservationAiMutation<T extends string | number | null>(
  sql: string,
  values: T[],
  guard: string,
  requestId: string,
  completedPayload: string,
): { sql: string; values: T[] } {
  const guardValues = [requestId, completedPayload] as T[];
  const insert = /^(\s*INSERT(?:\s+OR\s+IGNORE)?\s+INTO[\s\S]*?\))\s+VALUES\s*\(([\s\S]*)\)(\s+ON\s+CONFLICT[\s\S]*)?$/iu.exec(sql);
  if (insert) {
    const suffix = insert[3] ?? "";
    return {
      sql: `${insert[1]} SELECT ${insert[2]} WHERE ${guard}${suffix}`,
      values: [...values, ...guardValues],
    };
  }
  if (/^\s*UPDATE\s/iu.test(sql) && /\sWHERE\s/iu.test(sql)) {
    return {
      sql: `${sql} AND ${guard}`,
      values: [...values, ...guardValues],
    };
  }
  throw new Error("unsupported_observation_ai_dual_write_mutation");
}
