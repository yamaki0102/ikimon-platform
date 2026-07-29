import { createHash } from "node:crypto";
import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";

export type ContextVisibility = "internal" | "tenant" | "public";

export type ContextPacketPayload = {
  packetVersion: "zukan.context-packet/v1";
  purpose: string;
  principal: {
    subjectId: string;
    tenantId: string;
    workspaceId: string | null;
    scopes: string[];
  };
  authorization: {
    decisionId: string;
    evaluatedAt: string;
    allowed: true;
  };
  derivedFrom: {
    resolutionRunId: string;
    claimStoreSnapshotToken: string;
    claimStoreSequenceWatermark: number;
    recordedTimeWatermark: string;
    predicateRegistrySnapshotHash: string;
    authoritySnapshotHash: string;
    policyId: string;
    policyVersion: string;
    evaluatorBuild: string;
    targetTime: string;
    inputHash: string;
    outputHash: string;
  };
  reproducibility: {
    level: "full" | "degraded";
    missingFields: string[];
  };
  visibility: ContextVisibility;
  completeness: {
    status: "complete" | "partial";
    admittedFacts: number;
    omittedFacts: number;
    omissionReasons: string[];
    truncatedForBudget: boolean;
  };
  facts: Array<{
    claimId: string;
    claimRevision: number;
    subjectId: string;
    predicateUri: string;
    predicateVersion: string;
    valueArtifactId: string;
    admittedValue: unknown;
    polarity: string;
    time: {
      valid: string | null;
      observed: string | null;
      recorded: string;
      publication: string | null;
    };
    visibility: ContextVisibility;
    authorityAssertionIds: string[];
    evidenceLinkIds: string[];
    rightsEvaluationId: string;
    rightsPurpose: "ai_input";
    rightsBasis: "allowed";
  }>;
  conflicts: Array<{
    claimRevisionIds: string[];
    reasonCode: string;
  }>;
  openGovernance: Array<{
    kind: "dispute" | "correction" | "suppression";
    caseId: string;
  }>;
};

export type ContextPacketEnvelope = {
  schema: "zukan.context-packet-envelope/v1";
  payloadSha256: string;
  payload: ContextPacketPayload;
};

export type ModelInputEnvelopePayload = {
  envelopeVersion: "zukan.model-input/v1";
  contextPacketSha256: string;
  provider: string;
  modelId: string;
  purpose: "ai_input";
  authorizationDecisionId: string;
  segments: Array<{
    claimId: string;
    claimRevision: number;
    rightsEvaluationId: string;
    text: string;
  }>;
};

export type ModelInputEnvelope = {
  schema: "zukan.model-input-envelope/v1";
  payloadSha256: string;
  payload: ModelInputEnvelopePayload;
};

const visibilityRank: Record<ContextVisibility, number> = {
  public: 0,
  tenant: 1,
  internal: 2,
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) throw new Error(`context_packet_required:${field}`);
}

function requireTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`context_packet_invalid_timestamp:${field}`);
}

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`context_packet_invalid_integer:${field}`);
}

function expectedVisibility(payload: ContextPacketPayload): ContextVisibility | null {
  if (payload.facts.length === 0) return null;
  return payload.facts.reduce<ContextVisibility>((current, fact) =>
    visibilityRank[fact.visibility] > visibilityRank[current] ? fact.visibility : current,
  "public");
}

export function sealContextPacket(payload: ContextPacketPayload): ContextPacketEnvelope {
  requireNonEmpty(payload.purpose, "purpose");
  requireNonEmpty(payload.principal.subjectId, "principal.subject_id");
  requireNonEmpty(payload.principal.tenantId, "principal.tenant_id");
  requireNonEmpty(payload.authorization.decisionId, "authorization.decision_id");
  requireTimestamp(payload.authorization.evaluatedAt, "authorization.evaluated_at");
  requireNonEmpty(payload.derivedFrom.resolutionRunId, "derived_from.resolution_run_id");
  requireNonEmpty(payload.derivedFrom.claimStoreSnapshotToken, "derived_from.claim_store_snapshot_token");
  requireNonNegativeInteger(
    payload.derivedFrom.claimStoreSequenceWatermark,
    "derived_from.claim_store_sequence_watermark",
  );
  requireTimestamp(payload.derivedFrom.recordedTimeWatermark, "derived_from.recorded_time_watermark");
  requireTimestamp(payload.derivedFrom.targetTime, "derived_from.target_time");
  requireNonNegativeInteger(payload.completeness.admittedFacts, "completeness.admitted_facts");
  requireNonNegativeInteger(payload.completeness.omittedFacts, "completeness.omitted_facts");
  if (payload.completeness.admittedFacts !== payload.facts.length) {
    throw new Error("context_packet_admitted_fact_count_mismatch");
  }
  const shouldBePartial = payload.completeness.omittedFacts > 0 || payload.completeness.truncatedForBudget;
  if ((payload.completeness.status === "partial") !== shouldBePartial) {
    throw new Error("context_packet_completeness_status_mismatch");
  }
  if (payload.reproducibility.level === "full" && payload.reproducibility.missingFields.length > 0) {
    throw new Error("context_packet_full_reproducibility_has_missing_fields");
  }
  if (payload.reproducibility.level === "degraded" && payload.reproducibility.missingFields.length === 0) {
    throw new Error("context_packet_degraded_reproducibility_requires_missing_fields");
  }
  for (const fact of payload.facts) {
    requireNonEmpty(fact.claimId, "fact.claim_id");
    requireNonNegativeInteger(fact.claimRevision, "fact.claim_revision");
    requireNonEmpty(fact.rightsEvaluationId, "fact.rights_evaluation_id");
    requireTimestamp(fact.time.recorded, "fact.time.recorded");
    if (typeof fact.admittedValue === "undefined") throw new Error("context_packet_admitted_value_undefined");
    if (fact.rightsBasis !== "allowed" || fact.rightsPurpose !== "ai_input") {
      throw new Error("context_packet_rights_not_allowed");
    }
  }
  const derivedVisibility = expectedVisibility(payload);
  if (derivedVisibility !== null && derivedVisibility !== payload.visibility) {
    throw new Error("context_packet_visibility_not_most_restrictive");
  }
  return {
    schema: "zukan.context-packet-envelope/v1",
    payloadSha256: sha256(canonicalFoundationJson(payload)),
    payload,
  };
}

export function buildModelInputEnvelope(input: {
  context: ContextPacketEnvelope;
  provider: string;
  modelId: string;
  segments: ModelInputEnvelopePayload["segments"];
}): ModelInputEnvelope {
  requireNonEmpty(input.provider, "model_input.provider");
  requireNonEmpty(input.modelId, "model_input.model_id");
  const expectedContextSha = sha256(canonicalFoundationJson(input.context.payload));
  if (expectedContextSha !== input.context.payloadSha256) throw new Error("context_packet_digest_mismatch");
  const admitted = new Map(
    input.context.payload.facts.map((fact) => [
      `${fact.claimId}:${fact.claimRevision}`,
      fact.rightsEvaluationId,
    ]),
  );
  const seen = new Set<string>();
  for (const segment of input.segments) {
    requireNonEmpty(segment.text, "model_input.segment.text");
    const key = `${segment.claimId}:${segment.claimRevision}`;
    if (seen.has(key)) throw new Error("model_input_duplicate_segment");
    seen.add(key);
    const rightsEvaluationId = admitted.get(key);
    if (!rightsEvaluationId || rightsEvaluationId !== segment.rightsEvaluationId) {
      throw new Error("model_input_segment_not_admitted");
    }
  }
  const payload: ModelInputEnvelopePayload = {
    envelopeVersion: "zukan.model-input/v1",
    contextPacketSha256: input.context.payloadSha256,
    provider: input.provider,
    modelId: input.modelId,
    purpose: "ai_input",
    authorizationDecisionId: input.context.payload.authorization.decisionId,
    segments: input.segments,
  };
  return {
    schema: "zukan.model-input-envelope/v1",
    payloadSha256: sha256(canonicalFoundationJson(payload)),
    payload,
  };
}
