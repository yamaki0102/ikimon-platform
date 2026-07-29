import { createHash } from "node:crypto";
import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";
import type {
  ContextPacketEnvelope, ContextPacketPayload, ContextPacketReceiptInput,
  ContextRightsAdmission, ContextVisibility, ModelInputEnvelope,
  ModelInputEnvelopePayload, ModelInputSegmentSelector, VisibilityReference,
} from "./zukanContextPacketTypes.js";

const visibilityRank: Record<ContextVisibility, number> = { public: 0, tenant: 1, internal: 2 };

function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`context_packet_required:${field}`);
  return normalized;
}
function requireTimestamp(value: string, field: string): number {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) throw new Error(`context_packet_invalid_timestamp:${field}`);
  return epoch;
}
function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`context_packet_invalid_integer:${field}`);
}
function requireHash(value: string, field: string): string {
  const normalized = requireNonEmpty(value, field).toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(normalized)) throw new Error(`context_packet_invalid_hash:${field}`);
  return normalized;
}
function moreRestrictive(left: ContextVisibility, right: ContextVisibility): ContextVisibility {
  return visibilityRank[right] > visibilityRank[left] ? right : left;
}
function normalizeVisibilityReferences(items: VisibilityReference[], field: string): VisibilityReference[] {
  const seen = new Set<string>();
  return items.map((item) => {
    const id = requireNonEmpty(item.id, `${field}.id`);
    if (seen.has(id)) throw new Error(`context_packet_duplicate_reference:${field}:${id}`);
    seen.add(id);
    return { ...item, id };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
function expectedVisibility(payload: ContextPacketPayload): ContextVisibility {
  let visibility: ContextVisibility = "public";
  let elements = 0;
  for (const fact of payload.facts) {
    visibility = moreRestrictive(visibility, fact.visibility); elements += 1;
    for (const item of [...fact.authorityAssertions, ...fact.evidenceLinks]) {
      visibility = moreRestrictive(visibility, item.visibility); elements += 1;
    }
  }
  for (const conflict of payload.conflicts) {
    visibility = moreRestrictive(visibility, conflict.visibility); elements += 1;
  }
  for (const governance of payload.openGovernance) {
    visibility = moreRestrictive(visibility, governance.visibility); elements += 1;
  }
  return elements === 0 ? "internal" : visibility;
}
function normalizePayload(payload: ContextPacketPayload): ContextPacketPayload {
  return {
    ...payload,
    reproducibility: { ...payload.reproducibility, missingFields: [...new Set(payload.reproducibility.missingFields)].sort() },
    completeness: { ...payload.completeness, omissionReasons: [...new Set(payload.completeness.omissionReasons)].sort() },
    facts: payload.facts.map((fact) => ({
      ...fact,
      authorityAssertions: normalizeVisibilityReferences(fact.authorityAssertions, "fact.authority_assertions"),
      evidenceLinks: normalizeVisibilityReferences(fact.evidenceLinks, "fact.evidence_links"),
    })).sort((a, b) => a.claimId.localeCompare(b.claimId) || a.claimRevision - b.claimRevision),
    conflicts: payload.conflicts.map((conflict) => ({
      ...conflict,
      claimRevisionIds: [...new Set(conflict.claimRevisionIds)].sort(),
    })).sort((a, b) => a.reasonCode.localeCompare(b.reasonCode)
      || a.claimRevisionIds.join("\u0000").localeCompare(b.claimRevisionIds.join("\u0000"))),
    openGovernance: [...payload.openGovernance].sort((a, b) => a.kind.localeCompare(b.kind) || a.caseId.localeCompare(b.caseId)),
  };
}
function normalizeReceipt(receipt: ContextPacketReceiptInput): ContextPacketReceiptInput {
  return { ...receipt, principal: { ...receipt.principal, scopes: [...new Set(receipt.principal.scopes)].sort() } };
}
function validateRights(rights: ContextRightsAdmission, at: number, field: string): void {
  requireNonEmpty(rights.evaluationId, `${field}.evaluation_id`);
  requireHash(rights.objectDigest, `${field}.object_digest`);
  if (rights.purpose !== "ai_input" || rights.basis !== "allowed") throw new Error("context_packet_rights_not_allowed");
  const evaluated = requireTimestamp(rights.evaluatedAt, `${field}.evaluated_at`);
  const from = requireTimestamp(rights.validFrom, `${field}.valid_from`);
  const until = requireTimestamp(rights.validUntil, `${field}.valid_until`);
  const review = requireTimestamp(rights.reviewDue, `${field}.review_due`);
  if (evaluated > at || from > at || until < at || review < at) throw new Error("context_packet_rights_not_current");
  if (until < from || review < evaluated) throw new Error("context_packet_rights_window_invalid");
}

export function sealContextPacket(input: {
  payload: ContextPacketPayload;
  receipt: ContextPacketReceiptInput;
}): ContextPacketEnvelope {
  const payload = normalizePayload(input.payload);
  const receiptInput = normalizeReceipt(input.receipt);
  requireNonEmpty(payload.purpose, "purpose");
  requireNonEmpty(payload.scope.tenantId, "scope.tenant_id");
  if (payload.scope.workspaceId !== null) requireNonEmpty(payload.scope.workspaceId, "scope.workspace_id");
  requireNonEmpty(receiptInput.receiptId, "receipt.receipt_id");
  requireNonEmpty(receiptInput.principal.subjectId, "receipt.principal.subject_id");
  requireNonEmpty(receiptInput.principal.tenantId, "receipt.principal.tenant_id");
  if (!receiptInput.principal.scopes.includes("context:read") || !receiptInput.principal.scopes.includes("ai:input")) {
    throw new Error("context_packet_required_scope_missing");
  }
  requireNonEmpty(receiptInput.authorization.decisionId, "receipt.authorization.decision_id");
  if (receiptInput.authorization.allowed !== true) throw new Error("context_packet_authorization_not_allowed");
  if (receiptInput.principal.tenantId !== payload.scope.tenantId
    || receiptInput.principal.workspaceId !== payload.scope.workspaceId) throw new Error("context_packet_receipt_scope_mismatch");
  const generatedAt = requireTimestamp(receiptInput.generatedAt, "receipt.generated_at");
  const evaluatedAt = requireTimestamp(receiptInput.authorization.evaluatedAt, "receipt.authorization.evaluated_at");
  const validUntil = requireTimestamp(receiptInput.authorization.validUntil, "receipt.authorization.valid_until");
  if (generatedAt < evaluatedAt) throw new Error("context_packet_receipt_generated_before_authorization");
  if (validUntil < generatedAt) throw new Error("context_packet_authorization_expired_at_generation");

  for (const field of ["resolutionRunId", "claimStoreSnapshotToken", "policyId", "policyVersion", "evaluatorBuild"] as const) {
    requireNonEmpty(payload.derivedFrom[field], `derived_from.${field}`);
  }
  for (const field of ["predicateRegistrySnapshotHash", "authoritySnapshotHash", "inputHash", "outputHash"] as const) {
    requireHash(payload.derivedFrom[field], `derived_from.${field}`);
  }
  requireNonNegativeInteger(payload.derivedFrom.claimStoreSequenceWatermark, "derived_from.claim_store_sequence_watermark");
  requireTimestamp(payload.derivedFrom.recordedTimeWatermark, "derived_from.recorded_time_watermark");
  requireTimestamp(payload.derivedFrom.targetTime, "derived_from.target_time");
  requireNonNegativeInteger(payload.completeness.admittedFacts, "completeness.admitted_facts");
  requireNonNegativeInteger(payload.completeness.omittedFacts, "completeness.omitted_facts");
  if (payload.completeness.admittedFacts !== payload.facts.length) throw new Error("context_packet_admitted_fact_count_mismatch");
  const shouldBePartial = payload.completeness.omittedFacts > 0 || payload.completeness.truncatedForBudget;
  if ((payload.completeness.status === "partial") !== shouldBePartial) throw new Error("context_packet_completeness_status_mismatch");
  if (payload.reproducibility.level === "full" && payload.reproducibility.missingFields.length > 0) {
    throw new Error("context_packet_full_reproducibility_has_missing_fields");
  }
  if (payload.reproducibility.level === "degraded" && payload.reproducibility.missingFields.length === 0) {
    throw new Error("context_packet_degraded_reproducibility_requires_missing_fields");
  }

  const facts = new Set<string>();
  for (const fact of payload.facts) {
    requireNonEmpty(fact.claimId, "fact.claim_id");
    requireNonNegativeInteger(fact.claimRevision, "fact.claim_revision");
    const factKey = `${fact.claimId}:${fact.claimRevision}`;
    if (facts.has(factKey)) throw new Error(`context_packet_duplicate_fact:${factKey}`);
    facts.add(factKey);
    requireNonEmpty(fact.subjectId, "fact.subject_id");
    requireNonEmpty(fact.predicateUri, "fact.predicate_uri");
    requireNonEmpty(fact.predicateVersion, "fact.predicate_version");
    requireNonEmpty(fact.valueArtifactId, "fact.value_artifact_id");
    requireTimestamp(fact.time.recorded, "fact.time.recorded");
    if (typeof fact.admittedValue === "undefined") throw new Error("context_packet_admitted_value_undefined");
    validateRights(fact.rights, generatedAt, "fact.rights");
  }
  for (const conflict of payload.conflicts) {
    requireNonEmpty(conflict.reasonCode, "conflict.reason_code");
    if (conflict.claimRevisionIds.length === 0) throw new Error("context_packet_conflict_requires_claims");
  }
  for (const governance of payload.openGovernance) requireNonEmpty(governance.caseId, "governance.case_id");
  if (expectedVisibility(payload) !== payload.visibility) throw new Error("context_packet_visibility_not_most_restrictive");

  const payloadSha256 = sha256(canonicalFoundationJson(payload));
  const receiptForDigest = { ...receiptInput, contextPacketSha256: payloadSha256 };
  const receiptSha256 = sha256(canonicalFoundationJson(receiptForDigest));
  return {
    schema: "zukan.context-packet-envelope/v2",
    payloadSha256,
    payload,
    receipt: { ...receiptInput, contextPacketSha256: payloadSha256, receiptSha256 },
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
  if (input.context.receipt.contextPacketSha256 !== input.context.payloadSha256) throw new Error("context_packet_receipt_digest_mismatch");
  const { receiptSha256, ...receiptForDigest } = input.context.receipt;
  if (sha256(canonicalFoundationJson(receiptForDigest)) !== receiptSha256) throw new Error("context_packet_receipt_digest_mismatch");
  const generatedAt = requireTimestamp(input.context.receipt.generatedAt, "receipt.generated_at");
  const authorizationEvaluatedAt = requireTimestamp(input.context.receipt.authorization.evaluatedAt, "receipt.authorization.evaluated_at");
  const authorizationValidUntil = requireTimestamp(input.context.receipt.authorization.validUntil, "receipt.authorization.valid_until");
  if (requestedAt < generatedAt) throw new Error("model_input_before_context_generation");
  if (requestedAt < authorizationEvaluatedAt) throw new Error("model_input_before_authorization");
  if (requestedAt > authorizationValidUntil) throw new Error("model_input_authorization_expired");

  const admitted = new Map(input.context.payload.facts.map((fact) => [`${fact.claimId}:${fact.claimRevision}`, fact]));
  const seen = new Set<string>();
  const segments: ModelInputEnvelopePayload["segments"] = [];
  let expiresAt = authorizationValidUntil;
  for (const selector of input.selectors) {
    const key = `${selector.claimId}:${selector.claimRevision}`;
    if (seen.has(key)) throw new Error("model_input_duplicate_segment");
    seen.add(key);
    const fact = admitted.get(key);
    if (!fact || fact.valueArtifactId !== selector.valueArtifactId
      || fact.rights.evaluationId !== selector.rightsEvaluationId) throw new Error("model_input_segment_not_admitted");
    validateRights(fact.rights, requestedAt, "fact.rights");
    expiresAt = Math.min(expiresAt, Date.parse(fact.rights.validUntil), Date.parse(fact.rights.reviewDue));
    const text = typeof fact.admittedValue === "string" ? fact.admittedValue : canonicalFoundationJson(fact.admittedValue);
    requireNonEmpty(text, "model_input.segment.text");
    segments.push({
      claimId: fact.claimId,
      claimRevision: fact.claimRevision,
      valueArtifactId: fact.valueArtifactId,
      rightsEvaluationId: fact.rights.evaluationId,
      rightsObjectDigest: fact.rights.objectDigest,
      text,
    });
  }
  const payload: ModelInputEnvelopePayload = {
    envelopeVersion: "zukan.model-input/v2",
    contextPacketSha256: input.context.payloadSha256,
    contextReceiptId: input.context.receipt.receiptId,
    contextReceiptSha256: input.context.receipt.receiptSha256,
    provider: input.provider,
    modelId: input.modelId,
    purpose: "ai_input",
    authorizationDecisionId: input.context.receipt.authorization.decisionId,
    requestedAt: new Date(requestedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    segments,
  };
  return { schema: "zukan.model-input-envelope/v2", payloadSha256: sha256(canonicalFoundationJson(payload)), payload };
}
