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

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) throw new Error(`context_packet_required:${field}`);
}

export function sealContextPacket(payload: ContextPacketPayload): ContextPacketEnvelope {
  requireNonEmpty(payload.principal.subjectId, "principal.subject_id");
  requireNonEmpty(payload.principal.tenantId, "principal.tenant_id");
  requireNonEmpty(payload.authorization.decisionId, "authorization.decision_id");
  requireNonEmpty(payload.derivedFrom.resolutionRunId, "derived_from.resolution_run_id");
  if (payload.completeness.admittedFacts !== payload.facts.length) {
    throw new Error("context_packet_admitted_fact_count_mismatch");
  }
  for (const fact of payload.facts) {
    requireNonEmpty(fact.rightsEvaluationId, "fact.rights_evaluation_id");
    if (fact.rightsBasis !== "allowed" || fact.rightsPurpose !== "ai_input") {
      throw new Error("context_packet_rights_not_allowed");
    }
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
  const admitted = new Map(
    input.context.payload.facts.map((fact) => [
      `${fact.claimId}:${fact.claimRevision}`,
      fact.rightsEvaluationId,
    ]),
  );
  for (const segment of input.segments) {
    const rightsEvaluationId = admitted.get(`${segment.claimId}:${segment.claimRevision}`);
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
