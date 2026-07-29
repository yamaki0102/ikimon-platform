import { createHash } from "node:crypto";
import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";
import type { FoundationSourceRegistryReadOnlyEvidence } from "./zukanFoundationV2ReadOnlyEvidence.js";

export type SourceImportEvidencePayload = {
  source: FoundationSourceRegistryReadOnlyEvidence["source"];
  target: FoundationSourceRegistryReadOnlyEvidence["target"];
  tenantId: string;
  sourceRegistry: FoundationSourceRegistryReadOnlyEvidence["sourceRegistry"];
  runs: FoundationSourceRegistryReadOnlyEvidence["runs"];
  twoRunStability: FoundationSourceRegistryReadOnlyEvidence["twoRunStability"];
  identityCandidates: FoundationSourceRegistryReadOnlyEvidence["identityCandidates"];
  mutationEvidence: FoundationSourceRegistryReadOnlyEvidence["mutationEvidence"];
  rolloutBoundary: FoundationSourceRegistryReadOnlyEvidence["rolloutBoundary"];
  rightsReview: {
    status: "required";
    sourceStatus: "unknown";
    aiInputAdmitted: false;
    warnings: string[];
  };
};

export type SourceImportEvidenceEnvelope = {
  schema: "zukan.source-import-evidence-envelope/v1";
  payloadSha256: string;
  payload: SourceImportEvidencePayload;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function buildSourceImportEvidenceEnvelope(
  evidence: FoundationSourceRegistryReadOnlyEvidence,
): SourceImportEvidenceEnvelope {
  const payload: SourceImportEvidencePayload = {
    source: evidence.source,
    target: evidence.target,
    tenantId: evidence.tenantId,
    sourceRegistry: evidence.sourceRegistry,
    runs: evidence.runs,
    twoRunStability: evidence.twoRunStability,
    identityCandidates: evidence.identityCandidates,
    mutationEvidence: evidence.mutationEvidence,
    rolloutBoundary: evidence.rolloutBoundary,
    rightsReview: {
      status: "required",
      sourceStatus: "unknown",
      aiInputAdmitted: false,
      warnings: [...evidence.rights.warnings].sort(),
    },
  };
  return {
    schema: "zukan.source-import-evidence-envelope/v1",
    payloadSha256: sha256(canonicalFoundationJson(payload)),
    payload,
  };
}
