import { createHash } from "node:crypto";
import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";

export type ContextVisibility = "internal" | "tenant" | "public";

export type ContextPacketPayload = {
  packetVersion: "zukan.context-packet/v1";
  purpose: string;
  scope: {
    tenantId: string;
    workspaceId: string | null;
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

export type ContextPacketReceiptInput = {
  receiptVersion: "zukan.context-packet-receipt/v1";
  receiptId: string;
  generatedAt: string;
  principal: {
    subjectId: string;
    tenantId: string;
    workspaceId: string | null;
    scopes: string[];
  };
  authorization: {
    decisionId: string;
    evaluatedAt: string;
    validUntil: string;
    allowed: true;
  };
};

export type ContextPacketReceipt = ContextPacketReceiptInput & {
  contextPacketSha256: string;
  receiptSha256: string;
};

export type ContextPacketEnvelope = {
  schema: "zukan.context-packet-envelope/v1";
  payloadSha256: string;
  payload: ContextPacketPayload;
  receipt: ContextPacketReceipt;
};

export type ModelInputEnvelopePayload = {
  envelopeVersion: "zukan.model-input/v1";
  contextPacketSha256: string;
  contextReceiptId: string;
  contextReceiptSha256: string;
  provider: string;
  modelId: string;
  purpose: "ai_input";
  authorizationDecisionId: string;
  requestedAt: string;
  segments: Array<{
    claimId: string;
    claimRevision: number;
    valueArtifactId: string;
    rightsEvaluationId: string;
    text: string;
  }>;
};

export type ModelInputSegmentSelector = {
  claimId: string;
  claimRevision: number;
  rightsEvaluationId: string;
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

function requireTimestamp(value: string, field: string): number {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) throw new Error(`context_packet_invalid_timestamp:${field}`);
  return epoch;
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

function normalizePayload(payload: ContextPacketPayload): ContextPacketPayload {
  return {
    ...payload,
    reproducibility: {
      ...payload.reproducibility,
      missingFields: [...new Set(payload.reproducibility.missingFields)].sort(),
    },
    completeness: {
      ...payload.completeness,
      omissionReasons: [...new Set(payload.completeness.omissionReasons)].sort(),
    },
    facts: payload.facts.map((fact) => ({
      ...fact,
      authorityAssertionIds: [...new Set(fact.authorityAssertionIds)].sort(),
      evidenceLinkIds: [...new Set(fact.evidenceLinkIds)].sort(),
    })).sort((left, right) =>
      left.claimId.localeCompare(right.claimId) || left.claimRevision - right.claimRevision),
    conflicts: payload.conflicts.map((conflict) => ({
      ...conflict,
      claimRevisionIds: [...new Set(conflict.claimRevisionIds)].sort(),
    })).sort((left, right) =>
      left.reasonCode.localeCompare(right.reasonCode)
      || left.claimRevisionIds.join("\u0000").localeCompare(right.claimRevisionIds.join("\u0000"))),
    openGovernance: [...payload.openGovernance].sort((left, right) =>
      left.kind.localeCompare(right.kind) || left.caseId.localeCompare(right.caseId)),
  };
}

function normalizeReceipt(receipt: ContextPacketReceiptInput): ContextPacketReceiptInput {
  return {
    ...receipt,
    principal: {
      ...receipt.principal,
      scopes: [...new Set(receipt.principal.scopes)].sort(),
    },
  };
}

export function sealContextPacket(input: {
  payload: ContextPacketPayload;
  receipt: ContextPacketReceiptInput;
}): ContextPacketEnvelope {
  const payload = normalizePayload(input.payload);
  const receiptInput = normalizeReceipt(input.receipt);
  requireNonEmpty(payload.purpose, "purpose");
  requireNonEmpty(payload.scope.tenantId, "scope.tenant_id");
  requireNonEmpty(receiptInput.receiptId, "receipt.receipt_id");
  requireNonEmpty(receiptInput.principal.subjectId, "receipt.principal.subject_id");
  requireNonEmpty(receiptInput.principal.tenantId, "receipt.principal.tenant_id");
  requireNonEmpty(receiptInput.authorization.decisionId, "receipt.authorization.decision_id");
  if (receiptInput.authorization.allowed !== true) throw new Error("context_packet_authorization_not_allowed");
  if (receiptInput.principal.tenantId !== payload.scope.tenantId
    || receiptInput.principal.workspaceId !== payload.scope.workspaceId) {
    throw new Error("context_packet_receipt_scope_mismatch");
  }
  const generatedAt = requireTimestamp(receiptInput.generatedAt, "receipt.generated_at");
  const evaluatedAt = requireTimestamp(receiptInput.authorization.evaluatedAt, "receipt.authorization.evaluated_at");
  const validUntil = requireTimestamp(receiptInput.authorization.validUntil, "receipt.authorization.valid_until");
  if (generatedAt < evaluatedAt) throw new Error("context_packet_receipt_generated_before_authorization");
  if (validUntil < generatedAt) throw new Error("context_packet_authorization_expired_at_generation");
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
  const payloadSha256 = sha256(canonicalFoundationJson(payload));
  const receiptForDigest = {
    ...receiptInput,
    contextPacketSha256: payloadSha256,
  };
  const receiptSha256 = sha256(canonicalFoundationJson(receiptForDigest));
  return {
    schema: "zukan.context-packet-envelope/v1",
    payloadSha256,
    payload,
    receipt: {
      ...receiptInput,
      contextPacketSha256: payloadSha256,
      receiptSha256,
    },
  };
}

export function buildModelInputEnvelope(input: {
  context: ContextPacketEnvelope;
  provider: string;
  modelId: string;
  requestedAt: string;
  selectors: ModelInputSegmentSelector[];
}): ModelInputEnvelope {
  requireNonEmpty(input.provider, "model_input.provider");
  requireNonEmpty(input.modelId, "model_input.model_id");
  const requestedAt = requireTimestamp(input.requestedAt, "model_input.requested_at");
  const expectedContextSha = sha256(canonicalFoundationJson(input.context.payload));
  if (expectedContextSha !== input.context.payloadSha256) throw new Error("context_packet_digest_mismatch");
  if (input.context.receipt.contextPacketSha256 !== input.context.payloadSha256) {
    throw new Error("context_packet_receipt_digest_mismatch");
  }
  const { receiptSha256, ...receiptForDigest } = input.context.receipt;
  if (sha256(canonicalFoundationJson(receiptForDigest)) !== receiptSha256) {
    throw new Error("context_packet_receipt_digest_mismatch");
  }
  const authorizationEvaluatedAt = requireTimestamp(
    input.context.receipt.authorization.evaluatedAt,
    "receipt.authorization.evaluated_at",
  );
  const authorizationValidUntil = requireTimestamp(
    input.context.receipt.authorization.validUntil,
    "receipt.authorization.valid_until",
  );
  if (requestedAt < authorizationEvaluatedAt) throw new Error("model_input_before_authorization");
  if (requestedAt > authorizationValidUntil) throw new Error("model_input_authorization_expired");
  const admitted = new Map(
    input.context.payload.facts.map((fact) => [
      `${fact.claimId}:${fact.claimRevision}`,
      fact,
    ]),
  );
  const seen = new Set<string>();
  const segments: ModelInputEnvelopePayload["segments"] = [];
  for (const selector of input.selectors) {
    const key = `${selector.claimId}:${selector.claimRevision}`;
    if (seen.has(key)) throw new Error("model_input_duplicate_segment");
    seen.add(key);
    const fact = admitted.get(key);
    if (!fact || fact.rightsEvaluationId !== selector.rightsEvaluationId) {
      throw new Error("model_input_segment_not_admitted");
    }
    const text = typeof fact.admittedValue === "string"
      ? fact.admittedValue
      : canonicalFoundationJson(fact.admittedValue);
    requireNonEmpty(text, "model_input.segment.text");
    segments.push({
      claimId: fact.claimId,
      claimRevision: fact.claimRevision,
      valueArtifactId: fact.valueArtifactId,
      rightsEvaluationId: fact.rightsEvaluationId,
      text,
    });
  }
  const payload: ModelInputEnvelopePayload = {
    envelopeVersion: "zukan.model-input/v1",
    contextPacketSha256: input.context.payloadSha256,
    contextReceiptId: input.context.receipt.receiptId,
    contextReceiptSha256: input.context.receipt.receiptSha256,
    provider: input.provider,
    modelId: input.modelId,
    purpose: "ai_input",
    authorizationDecisionId: input.context.receipt.authorization.decisionId,
    requestedAt: input.requestedAt,
    segments,
  };
  return {
    schema: "zukan.model-input-envelope/v1",
    payloadSha256: sha256(canonicalFoundationJson(payload)),
    payload,
  };
}
