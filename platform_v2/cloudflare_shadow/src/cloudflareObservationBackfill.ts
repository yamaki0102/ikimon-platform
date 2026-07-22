import {
  buildIdentificationClaimDualWritePlan,
  buildMediaReassignmentDualWritePlan,
  buildOwnerObservationUpsertPlan,
  observationIdForRecord,
  type ObservationDualWriteSqlMutation,
} from "./cloudflareObservationDualWrite";

export type LegacyObservationBackfillRow = {
  observation_id: string;
  owner_user_id: string;
  taxon_label: string | null;
  visibility: string;
  processing_state: string;
  created_at: string;
  record_consent: string | null;
  withdrawal_status: string | null;
};

export type LegacyAssetBackfillRow = {
  asset_id: string;
  observation_id: string | null;
  owner_user_id: string;
  mime: string;
  processing_state: string;
};

export type LegacyIdentificationBackfillRow = {
  identification_id: string;
  occurrence_id: string;
  actor_user_id: string;
  actor_provenance?: "owner" | "community_member" | "curator" | "import" | null;
  proposed_name: string;
  proposed_rank: string | null;
  stance: string;
  source_key: string;
  source_payload_json: string;
  is_current: number;
};

export type LegacyAiTargetBackfillRow = {
  occurrence_id: string;
  ai_assessment_status: string;
  scientific_name: string | null;
  vernacular_name: string | null;
  taxon_rank: string | null;
  ai_run_id: string | null;
  candidate_id: string | null;
  candidate_scientific_name: string | null;
  candidate_vernacular_name: string | null;
  candidate_taxon_rank: string | null;
  ai_recommended_taxon_name: string | null;
  ai_recommended_rank: string | null;
  updated_at: string;
};

export type RecordObservationBackfillInput = {
  observations: LegacyObservationBackfillRow[];
  assets: LegacyAssetBackfillRow[];
  identifications: LegacyIdentificationBackfillRow[];
  aiTargets: LegacyAiTargetBackfillRow[];
};

export type RecordObservationBackfillReport = {
  schema: "ikimon.record-observation-backfill-report/v1";
  sourceCounts: { observations: number; assets: number; identifications: number; aiTargets: number };
  plannedCounts: { ownerObservations: number; mediaLinks: number; identificationClaims: number; aiProvisionalObservations: number };
  quarantineCounts: Record<string, number>;
  mutationCount: number;
  mappingRuleVersion: "record-observation-backfill/v1";
};

export type RecordObservationBackfillPlan = {
  mutations: ObservationDualWriteSqlMutation[];
  report: RecordObservationBackfillReport;
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

const recordIdFromOccurrence = (value: string): string | null => {
  const match = /^occ:(.+):\d+$/u.exec(String(value || ""));
  return match?.[1] || null;
};

const normalizedVisibility = (row: LegacyObservationBackfillRow): "public" | "limited" | "private" => {
  if (row.withdrawal_status && row.withdrawal_status !== "active") return "private";
  if (row.visibility === "public" || row.visibility === "limited" || row.visibility === "private") return row.visibility;
  if (row.record_consent === "private") return "private";
  if (row.record_consent === "public_summary") return "public";
  return "private";
};

const safeStance = (value: string): "support" | "alternative" | "not_organism" | "needs_more_evidence" | "context_only" => {
  if (["support", "alternative", "not_organism", "needs_more_evidence", "context_only"].includes(value)) {
    return value as ReturnType<typeof safeStance>;
  }
  return "support";
};

const addQuarantine = async (
  mutations: ObservationDualWriteSqlMutation[],
  quarantineCounts: Record<string, number>,
  input: { sourceKind: string; sourceId: string; recordId: string; operationKind: "backfill" | "identification" | "media_reassign" | "ai_analysis"; reason: string; source: unknown },
): Promise<void> => {
  quarantineCounts[input.reason] = (quarantineCounts[input.reason] ?? 0) + 1;
  const operationKey = `backfill:v1:quarantine:${input.sourceKind}:${input.sourceId}`;
  const ledgerId = await deterministicUuid(`record-observation-ledger:${operationKey}`);
  const sourceDigest = await sha256Hex(JSON.stringify(input.source));
  mutations.push({
    sql: `INSERT INTO record_observation_consistency_ledger (
      ledger_id, operation_key, record_runtime, record_id, observation_id,
      operation_kind, legacy_write_refs_json, target_write_refs_json,
      source_digest, target_digest, consistency_state, reason_codes_json,
      attempt_count, created_at, updated_at, resolved_at
    ) VALUES (?, ?, 'cloudflare_d1', ?, NULL, ?, ?, '{}', ?, NULL,
      'quarantined', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
    ON CONFLICT(operation_key) DO UPDATE SET
      source_digest = excluded.source_digest,
      consistency_state = 'quarantined',
      reason_codes_json = excluded.reason_codes_json,
      attempt_count = MIN(record_observation_consistency_ledger.attempt_count + 1, 100),
      updated_at = CURRENT_TIMESTAMP,
      resolved_at = NULL`,
    values: [ledgerId, operationKey, input.recordId, input.operationKind, JSON.stringify({ sourceKind: input.sourceKind, sourceId: input.sourceId }), sourceDigest, JSON.stringify([input.reason])],
  });
};

const buildAiBackfillMutations = async (input: {
  target: LegacyAiTargetBackfillRow;
  record: LegacyObservationBackfillRow;
  primaryAssetId: string | null;
}): Promise<ObservationDualWriteSqlMutation[]> => {
  const sourceKey = `legacy_ai_review_target:${input.target.occurrence_id}`;
  const observationId = await deterministicUuid(`record-observation:${sourceKey}`);
  const mappingId = await deterministicUuid(`record-observation-source-map:${sourceKey}`);
  const suggestionId = await deterministicUuid(`observation-ai-suggestion:${sourceKey}`);
  const lifecycleEventId = await deterministicUuid(`observation-lifecycle-created:${sourceKey}`);
  const ledgerId = await deterministicUuid(`record-observation-ledger:${sourceKey}`);
  const proposedName = input.target.candidate_vernacular_name
    ?? input.target.vernacular_name
    ?? input.target.ai_recommended_taxon_name
    ?? input.target.candidate_scientific_name
    ?? input.target.scientific_name;
  const proposedScientificName = input.target.candidate_scientific_name ?? input.target.scientific_name;
  const proposedRank = input.target.candidate_taxon_rank ?? input.target.taxon_rank ?? input.target.ai_recommended_rank;
  const sourceSnapshot = {
    occurrenceId: input.target.occurrence_id,
    assessmentStatus: input.target.ai_assessment_status,
    aiRunId: input.target.ai_run_id,
    candidateId: input.target.candidate_id,
    proposedName,
    proposedScientificName,
    proposedRank,
    updatedAt: input.target.updated_at,
  };
  const sourceDigest = await sha256Hex(JSON.stringify(sourceSnapshot));
  const targetDigest = await sha256Hex(JSON.stringify({ observationId, proposedName, proposedScientificName, proposedRank }));
  const provenance = JSON.stringify({ source: "legacy_ai_review_target_backfill", sourceKey, sourceDigest, mappingRuleVersion: "record-observation-backfill/v1" });
  const context = JSON.stringify({ acceptedIdentificationExplicitlyDecided: false, legacyAiAssessmentStatus: input.target.ai_assessment_status });
  const mutations: ObservationDualWriteSqlMutation[] = [
    {
      sql: `INSERT INTO record_observations (
        observation_id, record_runtime, record_id, owner_user_id, source_key,
        origin, assertion_status, verification_status, lifecycle_status, data_use_scope,
        accepted_identification_id, subject_type, individual_certainty, captive_context,
        count_mode, display_order, context_json, provenance_json, created_at, updated_at
      ) VALUES (?, 'cloudflare_d1', ?, ?, ?, 'ai', 'provisional', 'unreviewed', 'active',
        'personal_only', NULL, ?, 'unknown', 'unknown', 'unknown', 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(observation_id) DO UPDATE SET
        context_json = excluded.context_json,
        provenance_json = excluded.provenance_json,
        row_version = record_observations.row_version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE record_observations.origin = 'ai'
        AND record_observations.assertion_status = 'provisional'
        AND record_observations.accepted_identification_id IS NULL`,
      values: [observationId, input.record.observation_id, input.record.owner_user_id, sourceKey, proposedName ? "organism" : "unknown_subject", context, provenance],
    },
    {
      sql: `INSERT INTO record_observation_source_map (
        mapping_id, source_runtime, source_entity_kind, source_entity_id,
        mapping_rule_version, observation_id, mapping_kind, mapping_confidence,
        ambiguity_state, source_snapshot_hash, provenance_json, created_at
      ) VALUES (?, 'machine', 'ai_review_target', ?, 'record-observation-backfill/v1', ?,
        'candidate', NULL, 'clear', ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(source_runtime, source_entity_kind, source_entity_id, mapping_rule_version)
      DO UPDATE SET observation_id = excluded.observation_id,
        source_snapshot_hash = excluded.source_snapshot_hash,
        provenance_json = excluded.provenance_json`,
      values: [mappingId, input.target.occurrence_id, observationId, sourceDigest, provenance],
    },
    {
      sql: `INSERT INTO observation_ai_suggestions (
        suggestion_id, observation_id, ai_run_id, candidate_key, source_key,
        proposed_name, proposed_scientific_name, proposed_rank, confidence_score,
        rationale_json, model_provider, model_name, model_version, prompt_version,
        rule_version, input_digest, input_provenance_json, suggestion_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, '{}', 'legacy_ai_runtime', 'unknown', '',
        'legacy', 'record-observation-backfill/v1', ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(observation_id, source_key) DO UPDATE SET
        proposed_name = excluded.proposed_name,
        proposed_scientific_name = excluded.proposed_scientific_name,
        proposed_rank = excluded.proposed_rank,
        input_digest = excluded.input_digest,
        input_provenance_json = excluded.input_provenance_json,
        updated_at = CURRENT_TIMESTAMP
      WHERE observation_ai_suggestions.suggestion_status = 'active'`,
      values: [suggestionId, observationId, input.target.ai_run_id, input.target.candidate_id ?? "legacy-primary", sourceKey, proposedName, proposedScientificName, proposedRank, sourceDigest, provenance],
    },
    {
      sql: `INSERT OR IGNORE INTO observation_lifecycle_events (
        event_id, observation_id, event_kind, actor_kind, actor_id, reason_code,
        before_json, after_json, related_observation_ids_json, source_key, created_at
      ) VALUES (?, ?, 'created', 'import', NULL, 'legacy_ai_provisional_backfill', '{}', ?, '[]', ?, CURRENT_TIMESTAMP)`,
      values: [lifecycleEventId, observationId, JSON.stringify({ origin: "ai", assertionStatus: "provisional", acceptedIdentificationId: null }), `${sourceKey}:created`],
    },
    {
      sql: `INSERT INTO record_observation_consistency_ledger (
        ledger_id, operation_key, record_runtime, record_id, observation_id,
        operation_kind, legacy_write_refs_json, target_write_refs_json,
        source_digest, target_digest, consistency_state, reason_codes_json,
        attempt_count, created_at, updated_at, resolved_at
      ) VALUES (?, ?, 'cloudflare_d1', ?, ?, 'backfill', ?, ?, ?, ?, 'matched', '[]',
        1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(operation_key) DO UPDATE SET source_digest = excluded.source_digest,
        target_digest = excluded.target_digest,
        consistency_state = 'matched', reason_codes_json = '[]',
        attempt_count = MIN(record_observation_consistency_ledger.attempt_count + 1, 100),
        updated_at = CURRENT_TIMESTAMP, resolved_at = CURRENT_TIMESTAMP`,
      values: [ledgerId, `backfill:v1:ai:${input.target.occurrence_id}`, input.record.observation_id, observationId, JSON.stringify({ occurrenceId: input.target.occurrence_id }), JSON.stringify({ observationId, suggestionId }), sourceDigest, targetDigest],
    },
  ];
  if (input.primaryAssetId) {
    const mediaLinkId = await deterministicUuid(`record-observation-media:${sourceKey}:${input.primaryAssetId}`);
    mutations.splice(3, 0, {
      sql: `INSERT INTO record_observation_media (
        link_id, observation_id, media_source_runtime, media_id, role,
        locator_kind, locator_json, origin, active, source_key, provenance_json, created_at, updated_at
      ) VALUES (?, ?, 'cloudflare_d1', ?, 'primary_evidence', 'full', '{}', 'ai', 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(observation_id, source_key) DO UPDATE SET active = 1,
        provenance_json = excluded.provenance_json, updated_at = CURRENT_TIMESTAMP`,
      values: [mediaLinkId, observationId, input.primaryAssetId, `${sourceKey}:media:${input.primaryAssetId}`, provenance],
    });
  }
  return mutations;
};

export async function buildRecordObservationBackfillPlan(input: RecordObservationBackfillInput): Promise<RecordObservationBackfillPlan> {
  const mutations: ObservationDualWriteSqlMutation[] = [];
  const quarantineCounts: Record<string, number> = {};
  const records = new Map(input.observations.map((row) => [row.observation_id, row]));
  const assetsByRecord = new Map<string, LegacyAssetBackfillRow[]>();
  let mediaLinks = 0;
  let identificationClaims = 0;
  let aiProvisionalObservations = 0;

  for (const row of input.observations) {
    const visibility = normalizedVisibility(row);
    const plan = await buildOwnerObservationUpsertPlan({
      recordId: row.observation_id,
      ownerUserId: row.owner_user_id,
      visibility,
      subjectType: row.taxon_label?.trim() ? "organism" : "unknown_subject",
      sourceSnapshot: {
        recordId: row.observation_id,
        taxonLabel: row.taxon_label,
        visibility,
        processingState: row.processing_state,
        createdAt: row.created_at,
        acceptedIdentificationExplicitlyDecided: false,
        mappingRuleVersion: "record-observation-backfill/v1",
      },
      writeMode: "backfill",
    });
    mutations.push(...plan.mutations);
  }

  for (const asset of input.assets) {
    const record = asset.observation_id ? records.get(asset.observation_id) : null;
    if (!record) {
      await addQuarantine(mutations, quarantineCounts, { sourceKind: "asset", sourceId: asset.asset_id, recordId: asset.observation_id ?? `unassigned:${asset.asset_id}`, operationKind: "media_reassign", reason: "asset_record_missing", source: asset });
      continue;
    }
    if (asset.owner_user_id !== record.owner_user_id) {
      await addQuarantine(mutations, quarantineCounts, { sourceKind: "asset", sourceId: asset.asset_id, recordId: record.observation_id, operationKind: "media_reassign", reason: "asset_owner_mismatch", source: asset });
      continue;
    }
    const grouped = assetsByRecord.get(record.observation_id) ?? [];
    grouped.push(asset);
    assetsByRecord.set(record.observation_id, grouped);
    const mediaPlan = await buildMediaReassignmentDualWritePlan({
      recordId: record.observation_id,
      mediaId: asset.asset_id,
      actorUserId: record.owner_user_id,
      role: asset.mime.startsWith("audio/") ? "audio_evidence" : grouped.length === 1 ? "primary_evidence" : "supporting_evidence",
      sourcePayload: { assetId: asset.asset_id, mime: asset.mime, processingState: asset.processing_state, mappingRuleVersion: "record-observation-backfill/v1" },
      writeMode: "backfill",
    });
    mutations.push(...mediaPlan.mutations);
    mediaLinks += 1;
  }

  for (const identification of input.identifications) {
    const recordId = recordIdFromOccurrence(identification.occurrence_id);
    const record = recordId ? records.get(recordId) : null;
    if (!recordId || !record) {
      await addQuarantine(mutations, quarantineCounts, { sourceKind: "identification", sourceId: identification.identification_id, recordId: recordId ?? identification.occurrence_id, operationKind: "identification", reason: "identification_record_missing", source: identification });
      continue;
    }
    const declaredProvenance = identification.actor_provenance ?? null;
    let actorKind: "owner" | "community_member" | "curator" | "import";
    if (identification.actor_user_id === record.owner_user_id) {
      if (declaredProvenance && declaredProvenance !== "owner") {
        await addQuarantine(mutations, quarantineCounts, { sourceKind: "identification", sourceId: identification.identification_id, recordId, operationKind: "identification", reason: "identification_provenance_conflict", source: identification });
        continue;
      }
      actorKind = "owner";
    } else if (["community_member", "curator", "import"].includes(String(declaredProvenance))) {
      actorKind = declaredProvenance as "community_member" | "curator" | "import";
    } else {
      await addQuarantine(mutations, quarantineCounts, { sourceKind: "identification", sourceId: identification.identification_id, recordId, operationKind: "identification", reason: "identification_provenance_ambiguous", source: identification });
      continue;
    }
    const plan = await buildIdentificationClaimDualWritePlan({
      recordId,
      legacyIdentificationId: identification.identification_id,
      actorUserId: identification.actor_user_id,
      actorKind,
      proposedName: identification.proposed_name,
      proposedRank: identification.proposed_rank,
      stance: safeStance(identification.stance),
      sourcePayload: { sourceKey: identification.source_key, isCurrent: identification.is_current, actorProvenance: actorKind, payloadDigest: await sha256Hex(identification.source_payload_json), acceptedByBackfill: false },
      writeMode: "backfill",
    });
    mutations.push(...plan.mutations);
    identificationClaims += 1;
  }

  for (const target of input.aiTargets) {
    const recordId = recordIdFromOccurrence(target.occurrence_id);
    const record = recordId ? records.get(recordId) : null;
    if (!recordId || !record) {
      await addQuarantine(mutations, quarantineCounts, { sourceKind: "ai_review_target", sourceId: target.occurrence_id, recordId: recordId ?? target.occurrence_id, operationKind: "ai_analysis", reason: "ai_target_record_missing", source: target });
      continue;
    }
    const primaryAssetId = (assetsByRecord.get(recordId) ?? [])[0]?.asset_id ?? null;
    mutations.push(...await buildAiBackfillMutations({ target, record, primaryAssetId }));
    aiProvisionalObservations += 1;
  }

  return {
    mutations,
    report: {
      schema: "ikimon.record-observation-backfill-report/v1",
      sourceCounts: { observations: input.observations.length, assets: input.assets.length, identifications: input.identifications.length, aiTargets: input.aiTargets.length },
      plannedCounts: { ownerObservations: input.observations.length, mediaLinks, identificationClaims, aiProvisionalObservations },
      quarantineCounts,
      mutationCount: mutations.length,
      mappingRuleVersion: "record-observation-backfill/v1",
    },
  };
}

export async function expectedOwnerObservationIds(rows: LegacyObservationBackfillRow[]): Promise<Map<string, string>> {
  return new Map(await Promise.all(rows.map(async (row) => [row.observation_id, await observationIdForRecord(row.observation_id)] as const)));
}
