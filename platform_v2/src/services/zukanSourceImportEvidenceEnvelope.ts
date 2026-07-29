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
  if (evidence.mode !== "read_only_dry_run") throw new Error("source_evidence_not_read_only_dry_run");
  if (evidence.source.verification !== "git_head_clean") throw new Error("source_evidence_source_not_verified");
  if (!evidence.twoRunStability.stable
    || !evidence.twoRunStability.manifestMatch
    || !evidence.twoRunStability.payloadMatch
    || !evidence.twoRunStability.itemDiffMatch) {
    throw new Error("source_evidence_not_stable");
  }
  if (evidence.mutationEvidence.mutationCount !== 0 || !evidence.mutationEvidence.unchanged) {
    throw new Error("source_evidence_mutation_detected");
  }
  if (evidence.rolloutBoundary.publicResponseChanged || evidence.rolloutBoundary.writeMethodsInvoked !== 0) {
    throw new Error("source_evidence_rollout_boundary_crossed");
  }
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
      warnings: [...new Set(evidence.rights.warnings)].sort(),
    },
  };
  return {
    schema: "zukan.source-import-evidence-envelope/v1",
    payloadSha256: sha256(canonicalFoundationJson(payload)),
    payload,
  };
}
