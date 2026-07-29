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
  rightsReview: { status: "required"; sourceStatus: "unknown"; aiInputAdmitted: false; warnings: string[] };
};

export type SourceImportEvidenceEnvelope = {
  schema: "zukan.source-import-evidence-envelope/v2";
  payloadSha256: string;
  payload: SourceImportEvidencePayload;
};

function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function requireHash(value: string, field: string, length = 64): void {
  if (!new RegExp(`^[0-9a-f]{${length}}$`, "u").test(value)) throw new Error(`source_evidence_invalid_hash:${field}`);
}

export function buildSourceImportEvidenceEnvelope(
  evidence: FoundationSourceRegistryReadOnlyEvidence,
): SourceImportEvidenceEnvelope {
  if (evidence.mode !== "read_only_dry_run") throw new Error("source_evidence_not_read_only_dry_run");
  if (evidence.source.verification !== "git_head_clean") throw new Error("source_evidence_source_not_verified");
  requireHash(evidence.source.commitSha, "source.commit_sha", 40);
  const [first, second] = evidence.runs;
  for (const [index, run] of evidence.runs.entries()) {
    requireHash(run.manifestSha256, `runs.${index}.manifest_sha256`);
    requireHash(run.payloadSha256, `runs.${index}.payload_sha256`);
    requireHash(run.itemDiffSha256, `runs.${index}.item_diff_sha256`);
    if (sha256(canonicalFoundationJson(run.itemDiff)) !== run.itemDiffSha256) {
      throw new Error(`source_evidence_item_diff_digest_mismatch:${index}`);
    }
  }
  const manifestMatch = first.manifestSha256 === second.manifestSha256;
  const payloadMatch = first.payloadSha256 === second.payloadSha256;
  const itemDiffMatch = first.itemDiffSha256 === second.itemDiffSha256
    && canonicalFoundationJson(first.itemDiff) === canonicalFoundationJson(second.itemDiff);
  if (!manifestMatch || !payloadMatch || !itemDiffMatch
    || evidence.twoRunStability.manifestMatch !== manifestMatch
    || evidence.twoRunStability.payloadMatch !== payloadMatch
    || evidence.twoRunStability.itemDiffMatch !== itemDiffMatch
    || evidence.twoRunStability.stable !== (manifestMatch && payloadMatch && itemDiffMatch)) {
    throw new Error("source_evidence_not_stable");
  }
  requireHash(evidence.mutationEvidence.before.stateSha256, "mutation.before.state_sha256");
  requireHash(evidence.mutationEvidence.after.stateSha256, "mutation.after.state_sha256");
  const stateUnchanged = evidence.mutationEvidence.before.stateSha256 === evidence.mutationEvidence.after.stateSha256
    && evidence.mutationEvidence.before.entityCount === evidence.mutationEvidence.after.entityCount;
  if (evidence.mutationEvidence.mutationCount !== 0
    || evidence.mutationEvidence.unchanged !== stateUnchanged
    || !stateUnchanged) throw new Error("source_evidence_mutation_detected");
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
      warnings: [...new Set<string>(evidence.rights.warnings)].sort(),
    },
  };
  return {
    schema: "zukan.source-import-evidence-envelope/v2",
    payloadSha256: sha256(canonicalFoundationJson(payload)),
    payload,
  };
}
