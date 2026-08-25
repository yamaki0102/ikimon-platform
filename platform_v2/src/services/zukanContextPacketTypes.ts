export type ContextVisibility = "internal" | "tenant" | "public";

export type VisibilityReference = { id: string; visibility: ContextVisibility };

export type ContextRightsAdmission = {
  evaluationId: string;
  purpose: "ai_input";
  basis: "allowed";
  evaluatedAt: string;
  validFrom: string;
  validUntil: string;
  reviewDue: string;
  objectDigest: string;
};

export type ContextPacketFact = {
  claimId: string;
  claimRevision: number;
  subjectId: string;
  predicateUri: string;
  predicateVersion: string;
  valueArtifactId: string;
  admittedValue: unknown;
  polarity: string;
  time: { valid: string | null; observed: string | null; recorded: string; publication: string | null };
  visibility: ContextVisibility;
  authorityAssertions: VisibilityReference[];
  evidenceLinks: VisibilityReference[];
  rights: ContextRightsAdmission;
};

export type ContextPacketPayload = {
  packetVersion: "zukan.context-packet/v2";
  purpose: string;
  scope: { tenantId: string; workspaceId: string | null };
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
  reproducibility: { level: "full" | "degraded"; missingFields: string[] };
  visibility: ContextVisibility;
  completeness: {
    status: "complete" | "partial";
    admittedFacts: number;
    omittedFacts: number;
    omissionReasons: string[];
    truncatedForBudget: boolean;
  };
  facts: ContextPacketFact[];
  conflicts: Array<{ claimRevisionIds: string[]; reasonCode: string; visibility: ContextVisibility }>;
  openGovernance: Array<{
    kind: "dispute" | "correction" | "suppression";
    caseId: string;
    visibility: ContextVisibility;
  }>;
};

export type ContextPacketReceiptInput = {
  receiptVersion: "zukan.context-packet-receipt/v2";
  receiptId: string;
  generatedAt: string;
  principal: { subjectId: string; tenantId: string; workspaceId: string | null; scopes: string[] };
  authorization: { decisionId: string; evaluatedAt: string; validUntil: string; allowed: true };
};

export type ContextPacketReceipt = ContextPacketReceiptInput & {
  contextPacketSha256: string;
  receiptSha256: string;
};

export type ContextPacketEnvelope = {
  schema: "zukan.context-packet-envelope/v2";
  payloadSha256: string;
  payload: ContextPacketPayload;
  receipt: ContextPacketReceipt;
};

export type ModelInputEnvelopePayload = {
  envelopeVersion: "zukan.model-input/v2";
  contextPacketSha256: string;
  contextReceiptId: string;
  contextReceiptSha256: string;
  provider: string;
  modelId: string;
  purpose: "ai_input";
  authorizationDecisionId: string;
  requestedAt: string;
  expiresAt: string;
  segments: Array<{
    claimId: string;
    claimRevision: number;
    valueArtifactId: string;
    rightsEvaluationId: string;
    rightsObjectDigest: string;
    text: string;
  }>;
};

export type ModelInputSegmentSelector = {
  claimId: string;
  claimRevision: number;
  valueArtifactId: string;
  rightsEvaluationId: string;
};

export type ModelInputEnvelope = {
  schema: "zukan.model-input-envelope/v2";
  payloadSha256: string;
  payload: ModelInputEnvelopePayload;
};
