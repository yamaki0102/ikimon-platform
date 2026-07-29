import assert from "node:assert/strict";
import test from "node:test";
import type { FoundationSourceRegistryReadOnlyEvidence } from "./zukanFoundationV2ReadOnlyEvidence.js";
import { buildSourceImportEvidenceEnvelope } from "./zukanSourceImportEvidenceEnvelope.js";

function evidence(): FoundationSourceRegistryReadOnlyEvidence {
  const run = {
    manifestSha256: "1".repeat(64),
    payloadSha256: "2".repeat(64),
    itemDiffSha256: "3".repeat(64),
    itemDiff: [],
  };
  return {
    schema: "zukan.foundation-source-registry-read-only-evidence/v1",
    mode: "read_only_dry_run",
    source: { commitSha: "a".repeat(40), verification: "git_head_clean" },
    target: {
      evidenceKind: "direct_read_only",
      dialect: "postgres",
      locator: "postgres://read-only",
      capabilities: {
        available: true,
        dialect: "postgres",
        schemaVersion: "foundation_v2_integrity_0139",
        readOnly: false,
        blockers: [],
      },
      readOnlyEnforcement: "postgres_default_transaction_read_only",
    },
    tenantId: "tenant-a",
    sourceRegistry: {
      publisherCount: 1,
      sourceAssetCount: 1,
      entityCount: 4,
      projectionSha256: "4".repeat(64),
    },
    runs: [run, { ...run }],
    twoRunStability: {
      stable: true,
      manifestMatch: true,
      payloadMatch: true,
      itemDiffMatch: true,
    },
    identityCandidates: [],
    rights: { status: "unknown", warnings: ["review:b", "review:a", "review:a"] },
    mutationEvidence: {
      before: { stateSha256: "5".repeat(64), entityCount: 0 },
      after: { stateSha256: "5".repeat(64), entityCount: 0 },
      mutationCount: 0,
      unchanged: true,
    },
    rolloutBoundary: { publicResponseChanged: false, writeMethodsInvoked: 0 },
  };
}

test("stable read-only evidence is sealed deterministically and remains AI-blocked", () => {
  const first = buildSourceImportEvidenceEnvelope(evidence());
  const second = buildSourceImportEvidenceEnvelope(evidence());
  assert.equal(first.payloadSha256, second.payloadSha256);
  assert.equal(first.payload.rightsReview.aiInputAdmitted, false);
  assert.deepEqual(first.payload.rightsReview.warnings, ["review:a", "review:b"]);
});

test("unstable, mutating, or rollout-crossing evidence is rejected", () => {
  const unstable = evidence();
  unstable.twoRunStability.stable = false;
  assert.throws(() => buildSourceImportEvidenceEnvelope(unstable), /source_evidence_not_stable/u);

  const mutating = evidence();
  mutating.mutationEvidence.mutationCount = 1;
  mutating.mutationEvidence.unchanged = false;
  assert.throws(() => buildSourceImportEvidenceEnvelope(mutating), /source_evidence_mutation_detected/u);

  const crossing = evidence();
  crossing.rolloutBoundary.writeMethodsInvoked = 1;
  assert.throws(() => buildSourceImportEvidenceEnvelope(crossing), /source_evidence_rollout_boundary_crossed/u);
});
