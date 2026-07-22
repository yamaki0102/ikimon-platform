export type ObservationDualWriteSqlMutation = {
  sql: string;
  values: Array<string | number | null>;
};

export type ObservationDualWritePlan = {
  observationId: string;
  mutations: ObservationDualWriteSqlMutation[];
};

const textBytes = (value: string): ArrayBuffer => new TextEncoder().encode(value).buffer as ArrayBuffer;

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", textBytes(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const deterministicUuid = async (value: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", textBytes(value)));
  const bytes = digest.slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const ownerObservationSourceKey = (recordId: string): string => `legacy_record:${recordId}:owner_primary`;

export async function observationIdForRecord(recordId: string): Promise<string> {
  return deterministicUuid(`record-observation:${ownerObservationSourceKey(recordId)}`);
}

export async function buildOwnerObservationUpsertPlan(input: {
  recordId: string;
  ownerUserId: string;
  visibility: "public" | "limited" | "private";
  subjectType?: "organism" | "group" | "trace" | "sound" | "unknown_subject";
  individualCertainty?: "individual" | "group" | "unknown";
  captiveContext?: "wild" | "captive" | "cultivated" | "pet" | "unknown";
  sourceSnapshot: Record<string, unknown>;
  writeMode?: "dual_write" | "backfill";
}): Promise<ObservationDualWritePlan> {
  const sourceKey = ownerObservationSourceKey(input.recordId);
  const writeMode = input.writeMode ?? "dual_write";
  const mappingRuleVersion = writeMode === "backfill" ? "record-observation-backfill/v1" : "record-observation-dual-write/v1";
  const operationKind = writeMode === "backfill" ? "backfill" : "record_save";
  const operationKey = writeMode === "backfill" ? `backfill:v1:record:${input.recordId}` : `${sourceKey}:record_save`;
  const observationId = await observationIdForRecord(input.recordId);
  const mappingId = await deterministicUuid(`record-observation-source-map:${sourceKey}`);
  const eventId = await deterministicUuid(`record-observation-event:${sourceKey}:created`);
  const ledgerId = await deterministicUuid(`record-observation-ledger:${operationKey}`);
  const sourceDigest = await sha256Hex(JSON.stringify(input.sourceSnapshot));
  const targetDigest = await sha256Hex(JSON.stringify({
    observationId,
    ownerUserId: input.ownerUserId,
    visibility: input.visibility,
    subjectType: input.subjectType ?? "unknown_subject",
    individualCertainty: input.individualCertainty ?? "unknown",
    captiveContext: input.captiveContext ?? "unknown",
  }));
  const provenance = JSON.stringify({
    source: writeMode === "backfill" ? "cloudflare_native_record_backfill" : "cloudflare_native_record_writer",
    recordRuntime: "cloudflare_d1",
    sourceKey,
    sourceDigest,
    mappingRuleVersion,
  });
  const context = JSON.stringify({
    legacyRecordSnapshot: input.sourceSnapshot,
    acceptedIdentificationExplicitlyDecided: false,
  });
  return {
    observationId,
    mutations: [
      {
        sql: `INSERT INTO record_observations (
          observation_id, record_runtime, record_id, owner_user_id, source_key,
          origin, assertion_status, verification_status, lifecycle_status, data_use_scope,
          accepted_identification_id, subject_type, individual_certainty, captive_context,
          count_mode, display_order, context_json, provenance_json,
          reviewed_by_actor_kind, reviewed_by_actor_id, reviewed_at, created_at, updated_at
        ) VALUES (?, 'cloudflare_d1', ?, ?, ?,
          'owner', 'human_asserted', 'owner_confirmed', 'active', 'personal_only',
          NULL, ?, ?, ?, 'unknown', 0, ?, ?,
          'owner', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(observation_id) DO UPDATE SET
          owner_user_id = excluded.owner_user_id,
          subject_type = excluded.subject_type,
          individual_certainty = excluded.individual_certainty,
          captive_context = excluded.captive_context,
          context_json = excluded.context_json,
          provenance_json = excluded.provenance_json,
          reviewed_by_actor_kind = 'owner',
          reviewed_by_actor_id = excluded.reviewed_by_actor_id,
          reviewed_at = CURRENT_TIMESTAMP,
          row_version = record_observations.row_version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE record_observations.owner_user_id = excluded.owner_user_id
          AND record_observations.lifecycle_status = 'active'`,
        values: [
          observationId,
          input.recordId,
          input.ownerUserId,
          sourceKey,
          input.subjectType ?? "unknown_subject",
          input.individualCertainty ?? "unknown",
          input.captiveContext ?? "unknown",
          context,
          provenance,
          input.ownerUserId,
        ],
      },
      {
        sql: `INSERT INTO record_observation_policies (
          record_runtime, record_id, owner_user_id, visibility,
          accepts_identification_proposals, default_source, created_at, updated_at
        ) VALUES ('cloudflare_d1', ?, ?, ?, ?, 'visibility_default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(record_runtime, record_id) DO UPDATE SET
          owner_user_id = excluded.owner_user_id,
          visibility = excluded.visibility,
          accepts_identification_proposals = CASE
            WHEN record_observation_policies.default_source = 'owner_override'
              THEN record_observation_policies.accepts_identification_proposals
            ELSE excluded.accepts_identification_proposals
          END,
          row_version = record_observation_policies.row_version + 1,
          updated_at = CURRENT_TIMESTAMP`,
        values: [input.recordId, input.ownerUserId, input.visibility, input.visibility === "private" ? 0 : 1],
      },
      {
        sql: `INSERT INTO record_observation_source_map (
          mapping_id, source_runtime, source_entity_kind, source_entity_id,
          mapping_rule_version, observation_id, mapping_kind, mapping_confidence,
          ambiguity_state, source_snapshot_hash, provenance_json, created_at
        ) VALUES (?, 'cloudflare_d1', 'native_observation', ?,
          ?, ?, 'primary', 1,
          'clear', ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(source_runtime, source_entity_kind, source_entity_id, mapping_rule_version)
        DO UPDATE SET observation_id = excluded.observation_id,
          source_snapshot_hash = excluded.source_snapshot_hash,
          provenance_json = excluded.provenance_json`,
        values: [mappingId, input.recordId, mappingRuleVersion, observationId, sourceDigest, provenance],
      },
      {
        sql: `INSERT OR IGNORE INTO observation_lifecycle_events (
          event_id, observation_id, event_kind, actor_kind, actor_id, reason_code,
          before_json, after_json, related_observation_ids_json, source_key, created_at
        ) VALUES (?, ?, 'created', 'owner', ?, ?, '{}', ?, '[]', ?, CURRENT_TIMESTAMP)`,
        values: [eventId, observationId, input.ownerUserId, writeMode === "backfill" ? "legacy_record_backfilled" : "record_saved", JSON.stringify({ assertionStatus: "human_asserted" }), `${sourceKey}:created`],
      },
      {
        sql: `INSERT INTO record_observation_consistency_ledger (
          ledger_id, operation_key, record_runtime, record_id, observation_id,
          operation_kind, legacy_write_refs_json, target_write_refs_json,
          source_digest, target_digest, consistency_state, reason_codes_json,
          attempt_count, created_at, updated_at, resolved_at
        ) VALUES (?, ?, 'cloudflare_d1', ?, ?, ?, ?, ?, ?, ?,
          'matched', '[]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
          operationKey,
          input.recordId,
          observationId,
          operationKind,
          JSON.stringify({ recordId: input.recordId }),
          JSON.stringify({ observationId }),
          sourceDigest,
          targetDigest,
        ],
      },
    ],
  };
}

export async function buildHumanObservationEditPlan(input: {
  recordId: string;
  actorUserId: string;
  editKind: string;
  payload: Record<string, unknown>;
  captiveContext?: "wild" | "captive" | "cultivated" | "pet" | "unknown";
}): Promise<ObservationDualWritePlan> {
  const observationId = await observationIdForRecord(input.recordId);
  const sourceDigest = await sha256Hex(JSON.stringify({ editKind: input.editKind, payload: input.payload }));
  const eventSourceKey = `legacy_record:${input.recordId}:human_edit:${input.editKind}:${sourceDigest}`;
  const eventId = await deterministicUuid(`record-observation-event:${eventSourceKey}`);
  const ledgerId = await deterministicUuid(`record-observation-ledger:${eventSourceKey}`);
  const targetDigest = await sha256Hex(JSON.stringify({ observationId, editKind: input.editKind, sourceDigest }));
  return {
    observationId,
    mutations: [
      {
        sql: `UPDATE record_observations SET
          captive_context = COALESCE(?, captive_context),
          context_json = json_set(context_json, '$.lastHumanEditKind', ?, '$.lastHumanEditDigest', ?),
          reviewed_by_actor_kind = 'owner',
          reviewed_by_actor_id = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          row_version = row_version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE observation_id = ? AND owner_user_id = ? AND lifecycle_status = 'active'`,
        values: [input.captiveContext ?? null, input.editKind, sourceDigest, input.actorUserId, observationId, input.actorUserId],
      },
      {
        sql: `INSERT OR IGNORE INTO observation_lifecycle_events (
          event_id, observation_id, event_kind, actor_kind, actor_id, reason_code,
          before_json, after_json, related_observation_ids_json, source_key, created_at
        ) VALUES (?, ?, 'verification_changed', 'owner', ?, ?, '{}', ?, '[]', ?, CURRENT_TIMESTAMP)`,
        values: [eventId, observationId, input.actorUserId, `human_edit_${input.editKind}`, JSON.stringify({ editKind: input.editKind, sourceDigest }), eventSourceKey],
      },
      {
        sql: `INSERT INTO record_observation_consistency_ledger (
          ledger_id, operation_key, record_runtime, record_id, observation_id,
          operation_kind, legacy_write_refs_json, target_write_refs_json,
          source_digest, target_digest, consistency_state, reason_codes_json,
          attempt_count, created_at, updated_at, resolved_at
        ) VALUES (?, ?, 'cloudflare_d1', ?, ?, 'human_edit', ?, ?, ?, ?,
          'matched', '[]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(operation_key) DO UPDATE SET
          target_digest = excluded.target_digest,
          consistency_state = 'matched',
          reason_codes_json = '[]',
          attempt_count = MIN(record_observation_consistency_ledger.attempt_count + 1, 100),
          updated_at = CURRENT_TIMESTAMP,
          resolved_at = CURRENT_TIMESTAMP`,
        values: [
          ledgerId,
          eventSourceKey,
          input.recordId,
          observationId,
          JSON.stringify({ recordId: input.recordId, editKind: input.editKind }),
          JSON.stringify({ observationId, eventId }),
          sourceDigest,
          targetDigest,
        ],
      },
    ],
  };
}

export async function buildObservationLifecyclePlan(input: {
  recordId: string;
  actorUserId: string;
  action: "split" | "merge" | "exclude" | "restore";
  sourceObservationId: string;
  targetObservationId?: string | null;
  operationId: string;
  reason?: string | null;
}): Promise<ObservationDualWritePlan> {
  const operationKey = `record_observation_lifecycle:${input.action}:${input.operationId}`;
  const newObservationId = input.action === "split"
    ? await deterministicUuid(`record-observation-split:${operationKey}`)
    : input.sourceObservationId;
  const eventId = await deterministicUuid(`record-observation-event:${operationKey}`);
  const ledgerId = await deterministicUuid(`record-observation-ledger:${operationKey}`);
  const sourceDigest = await sha256Hex(JSON.stringify({
    action: input.action,
    sourceObservationId: input.sourceObservationId,
    targetObservationId: input.targetObservationId ?? null,
    reason: input.reason ?? null,
  }));
  const targetDigest = await sha256Hex(JSON.stringify({ observationId: newObservationId, action: input.action }));
  const lifecycleEventKind = input.action === "merge" ? "merged" : input.action === "exclude" ? "excluded" : input.action === "restore" ? "restored" : "split";
  const relatedIds = JSON.stringify([input.sourceObservationId, input.targetObservationId, input.action === "split" ? newObservationId : null].filter(Boolean));
  let lifecycleMutation: ObservationDualWriteSqlMutation;
  if (input.action === "split") {
    lifecycleMutation = {
      sql: `INSERT INTO record_observations (
        observation_id, record_runtime, record_id, owner_user_id, source_key,
        origin, assertion_status, verification_status, lifecycle_status, data_use_scope,
        data_use_consent_key, accepted_identification_id, subject_type, individual_certainty,
        captive_context, count_mode, count_value, count_min, count_max, display_order,
        context_json, provenance_json, reviewed_by_actor_kind, reviewed_by_actor_id,
        reviewed_at, created_at, updated_at
      ) SELECT ?, record_runtime, record_id, owner_user_id, ?, 'owner', 'human_asserted',
        'owner_confirmed', 'active', data_use_scope, data_use_consent_key, NULL,
        subject_type, individual_certainty, captive_context, count_mode, count_value,
        count_min, count_max, display_order + 1,
        json_set(context_json, '$.splitFromObservationId', observation_id, '$.splitOperationId', ?),
        json_set(provenance_json, '$.lifecycleAction', 'split', '$.operationId', ?),
        'owner', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM record_observations
      WHERE observation_id = ? AND record_runtime = 'cloudflare_d1' AND record_id = ?
        AND owner_user_id = ? AND lifecycle_status = 'active'
      ON CONFLICT(observation_id) DO NOTHING`,
      values: [newObservationId, `owner_split:${input.operationId}`, input.operationId, input.operationId, input.actorUserId, input.sourceObservationId, input.recordId, input.actorUserId],
    };
  } else if (input.action === "merge") {
    if (!input.targetObservationId || input.targetObservationId === input.sourceObservationId) throw new Error("observation_merge_target_invalid");
    lifecycleMutation = {
      sql: `UPDATE record_observations SET lifecycle_status = 'superseded', excluded_reason = NULL,
        superseded_by_observation_id = ?, reviewed_by_actor_kind = 'owner', reviewed_by_actor_id = ?,
        reviewed_at = CURRENT_TIMESTAMP, row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE observation_id = ? AND record_runtime = 'cloudflare_d1' AND record_id = ?
        AND owner_user_id = ? AND lifecycle_status = 'active'
        AND EXISTS (SELECT 1 FROM record_observations target
          WHERE target.observation_id = ? AND target.record_runtime = 'cloudflare_d1'
            AND target.record_id = ? AND target.owner_user_id = ? AND target.lifecycle_status = 'active')`,
      values: [input.targetObservationId, input.actorUserId, input.sourceObservationId, input.recordId, input.actorUserId, input.targetObservationId, input.recordId, input.actorUserId],
    };
  } else if (input.action === "exclude") {
    lifecycleMutation = {
      sql: `UPDATE record_observations SET lifecycle_status = 'excluded', excluded_reason = ?,
        superseded_by_observation_id = NULL, reviewed_by_actor_kind = 'owner', reviewed_by_actor_id = ?,
        reviewed_at = CURRENT_TIMESTAMP, row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE observation_id = ? AND record_runtime = 'cloudflare_d1' AND record_id = ?
        AND owner_user_id = ? AND lifecycle_status = 'active'`,
      values: [input.reason?.trim() || "owner_excluded", input.actorUserId, input.sourceObservationId, input.recordId, input.actorUserId],
    };
  } else {
    lifecycleMutation = {
      sql: `UPDATE record_observations SET lifecycle_status = 'active', excluded_reason = NULL,
        superseded_by_observation_id = NULL, reviewed_by_actor_kind = 'owner', reviewed_by_actor_id = ?,
        reviewed_at = CURRENT_TIMESTAMP, row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE observation_id = ? AND record_runtime = 'cloudflare_d1' AND record_id = ?
        AND owner_user_id = ? AND lifecycle_status = 'excluded'`,
      values: [input.actorUserId, input.sourceObservationId, input.recordId, input.actorUserId],
    };
  }
  return {
    observationId: newObservationId,
    mutations: [
      lifecycleMutation,
      {
        sql: `INSERT OR IGNORE INTO observation_lifecycle_events (
          event_id, observation_id, event_kind, actor_kind, actor_id, reason_code,
          before_json, after_json, related_observation_ids_json, source_key, created_at
        ) VALUES (?, ?, ?, 'owner', ?, ?, '{}', ?, ?, ?, CURRENT_TIMESTAMP)`,
        values: [eventId, input.sourceObservationId, lifecycleEventKind, input.actorUserId, input.reason ?? `owner_${input.action}`, JSON.stringify({ action: input.action, resultingObservationId: newObservationId }), relatedIds, operationKey],
      },
      {
        sql: `INSERT INTO record_observation_consistency_ledger (
          ledger_id, operation_key, record_runtime, record_id, observation_id,
          operation_kind, legacy_write_refs_json, target_write_refs_json,
          source_digest, target_digest, consistency_state, reason_codes_json,
          attempt_count, created_at, updated_at, resolved_at
        ) VALUES (?, ?, 'cloudflare_d1', ?, ?, 'human_edit', '{}', ?, ?, ?,
          'matched', '[]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(operation_key) DO UPDATE SET target_digest = excluded.target_digest,
          consistency_state = 'matched', reason_codes_json = '[]',
          attempt_count = MIN(record_observation_consistency_ledger.attempt_count + 1, 100),
          updated_at = CURRENT_TIMESTAMP, resolved_at = CURRENT_TIMESTAMP`,
        values: [ledgerId, operationKey, input.recordId, newObservationId, JSON.stringify({ action: input.action, sourceObservationId: input.sourceObservationId, targetObservationId: input.targetObservationId ?? null, resultingObservationId: newObservationId, eventId }), sourceDigest, targetDigest],
      },
    ],
  };
}

export async function buildIdentificationClaimDualWritePlan(input: {
  recordId: string;
  legacyIdentificationId: string;
  actorUserId: string;
  actorKind: "owner" | "community_member" | "curator" | "import";
  targetObservationId?: string;
  proposedName: string;
  proposedRank?: string | null;
  stance?: "support" | "alternative" | "not_organism" | "needs_more_evidence" | "context_only";
  sourcePayload: Record<string, unknown>;
  writeMode?: "dual_write" | "backfill";
}): Promise<ObservationDualWritePlan> {
  const observationId = input.targetObservationId ?? await observationIdForRecord(input.recordId);
  const sourceKey = `legacy_identification:${input.legacyIdentificationId}`;
  const identificationId = await deterministicUuid(`record-observation-identification:${sourceKey}`);
  const eventId = await deterministicUuid(`record-observation-event:${sourceKey}`);
  const operationKey = input.writeMode === "backfill" ? `backfill:v1:identification:${input.legacyIdentificationId}` : sourceKey;
  const backfillProvenanceCorrection = input.writeMode === "backfill"
    ? "actor_id = excluded.actor_id, actor_kind = excluded.actor_kind,"
    : "";
  const ledgerId = await deterministicUuid(`record-observation-ledger:${operationKey}`);
  const sourcePayloadJson = JSON.stringify(input.sourcePayload);
  const sourceDigest = await sha256Hex(sourcePayloadJson);
  const targetDigest = await sha256Hex(JSON.stringify({ observationId, identificationId, claimStatus: "candidate" }));
  return {
    observationId,
    mutations: [
      {
        sql: `INSERT INTO observation_identification_claims (
          identification_id, observation_id, actor_id, actor_kind, claim_status,
          proposed_name, proposed_rank, stance, source_key, source_payload_json,
          evidence_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'candidate', ?, ?, ?, ?, ?, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(observation_id, source_key) DO UPDATE SET
          ${backfillProvenanceCorrection}
          proposed_name = excluded.proposed_name,
          proposed_rank = excluded.proposed_rank,
          stance = excluded.stance,
          source_payload_json = excluded.source_payload_json,
          updated_at = CURRENT_TIMESTAMP
        WHERE observation_identification_claims.claim_status = 'candidate'`,
        values: [identificationId, observationId, input.actorUserId, input.actorKind, input.proposedName, input.proposedRank ?? null, input.stance ?? "support", sourceKey, sourcePayloadJson],
      },
      {
        sql: `INSERT OR IGNORE INTO observation_lifecycle_events (
          event_id, observation_id, event_kind, actor_kind, actor_id, reason_code,
          before_json, after_json, related_observation_ids_json, source_key, created_at
        ) VALUES (?, ?, 'identification_changed', ?, ?, 'candidate_identification_added',
          '{}', ?, '[]', ?, CURRENT_TIMESTAMP)`,
        values: [eventId, observationId, input.actorKind, input.actorUserId, JSON.stringify({ identificationId, claimStatus: "candidate" }), `${sourceKey}:event`],
      },
      {
        sql: `INSERT INTO record_observation_consistency_ledger (
          ledger_id, operation_key, record_runtime, record_id, observation_id,
          operation_kind, legacy_write_refs_json, target_write_refs_json,
          source_digest, target_digest, consistency_state, reason_codes_json,
          attempt_count, created_at, updated_at, resolved_at
        ) VALUES (?, ?, 'cloudflare_d1', ?, ?, 'identification', ?, ?, ?, ?,
          'matched', '[]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(operation_key) DO UPDATE SET
          source_digest = excluded.source_digest,
          target_digest = excluded.target_digest,
          consistency_state = 'matched',
          reason_codes_json = '[]',
          attempt_count = MIN(record_observation_consistency_ledger.attempt_count + 1, 100),
          updated_at = CURRENT_TIMESTAMP,
          resolved_at = CURRENT_TIMESTAMP`,
        values: [ledgerId, operationKey, input.recordId, observationId, JSON.stringify({ identificationId: input.legacyIdentificationId }), JSON.stringify({ identificationId }), sourceDigest, targetDigest],
      },
    ],
  };
}

export async function buildMediaReassignmentDualWritePlan(input: {
  recordId: string;
  mediaId: string;
  mediaSourceRuntime?: string;
  actorUserId: string;
  targetObservationId?: string;
  role?: "primary_evidence" | "supporting_evidence" | "context" | "audio_evidence" | "trace_evidence";
  sourcePayload: Record<string, unknown>;
  writeMode?: "dual_write" | "backfill";
}): Promise<ObservationDualWritePlan> {
  const observationId = input.targetObservationId ?? await observationIdForRecord(input.recordId);
  const sourceKey = `legacy_media:${input.mediaId}`;
  const linkId = await deterministicUuid(`record-observation-media:${observationId}:${sourceKey}`);
  const eventId = await deterministicUuid(`record-observation-event:${observationId}:${sourceKey}:linked`);
  const operationKey = input.writeMode === "backfill" ? `backfill:v1:media:${input.mediaId}:${input.recordId}` : `${sourceKey}:reassign:${input.recordId}`;
  const ledgerId = await deterministicUuid(`record-observation-ledger:${operationKey}`);
  const sourceDigest = await sha256Hex(JSON.stringify(input.sourcePayload));
  const targetDigest = await sha256Hex(JSON.stringify({ observationId, mediaId: input.mediaId, role: input.role ?? "primary_evidence" }));
  const provenance = JSON.stringify({ source: input.writeMode === "backfill" ? "cloudflare_native_media_backfill" : "cloudflare_native_media_writer", actorUserId: input.actorUserId, sourceDigest });
  return {
    observationId,
    mutations: [
      {
        sql: `UPDATE record_observation_media SET active = 0, updated_at = CURRENT_TIMESTAMP
          WHERE media_source_runtime = ? AND media_id = ? AND observation_id <> ? AND active = 1`,
        values: [input.mediaSourceRuntime ?? "cloudflare_d1", input.mediaId, observationId],
      },
      {
        sql: `INSERT INTO record_observation_media (
          link_id, observation_id, media_source_runtime, media_id, role,
          locator_kind, locator_json, origin, active, source_key,
          provenance_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'full', '{}', 'owner', 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(observation_id, source_key) DO UPDATE SET
          role = excluded.role,
          active = 1,
          provenance_json = excluded.provenance_json,
          updated_at = CURRENT_TIMESTAMP`,
        values: [linkId, observationId, input.mediaSourceRuntime ?? "cloudflare_d1", input.mediaId, input.role ?? "primary_evidence", sourceKey, provenance],
      },
      {
        sql: `INSERT OR IGNORE INTO observation_lifecycle_events (
          event_id, observation_id, event_kind, actor_kind, actor_id, reason_code,
          before_json, after_json, related_observation_ids_json, source_key, created_at
        ) VALUES (?, ?, 'media_linked', 'owner', ?, 'media_reassigned', '{}', ?, '[]', ?, CURRENT_TIMESTAMP)`,
        values: [eventId, observationId, input.actorUserId, JSON.stringify({ mediaId: input.mediaId, role: input.role ?? "primary_evidence" }), `${sourceKey}:linked`],
      },
      {
        sql: `INSERT INTO record_observation_consistency_ledger (
          ledger_id, operation_key, record_runtime, record_id, observation_id,
          operation_kind, legacy_write_refs_json, target_write_refs_json,
          source_digest, target_digest, consistency_state, reason_codes_json,
          attempt_count, created_at, updated_at, resolved_at
        ) VALUES (?, ?, 'cloudflare_d1', ?, ?, 'media_reassign', ?, ?, ?, ?,
          'matched', '[]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(operation_key) DO UPDATE SET
          source_digest = excluded.source_digest,
          target_digest = excluded.target_digest,
          consistency_state = 'matched',
          reason_codes_json = '[]',
          attempt_count = MIN(record_observation_consistency_ledger.attempt_count + 1, 100),
          updated_at = CURRENT_TIMESTAMP,
          resolved_at = CURRENT_TIMESTAMP`,
        values: [ledgerId, operationKey, input.recordId, observationId, JSON.stringify({ mediaId: input.mediaId }), JSON.stringify({ observationId, linkId }), sourceDigest, targetDigest],
      },
    ],
  };
}
