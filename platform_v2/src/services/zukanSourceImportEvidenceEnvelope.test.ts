import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";
import type { FoundationSourceRegistryReadOnlyEvidence } from "./zukanFoundationV2ReadOnlyEvidence.js";
import { buildSourceImportEvidenceEnvelope } from "./zukanSourceImportEvidenceEnvelope.js";

const sha = (value: unknown) => createHash("sha256").update(canonicalFoundationJson(value)).digest("hex");

function evidence(): FoundationSourceRegistryReadOnlyEvidence {
  const itemDiff: FoundationSourceRegistryReadOnlyEvidence["runs"][number]["itemDiff"] = [];
  const run = { manifestSha256: "1".repeat(64), payloadSha256: "2".repeat(64), itemDiffSha256: sha(itemDiff), itemDiff };
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
    sourceRegistry: { publisherCount: 1, sourceAssetCount: 1, entityCount: 4, projectionSha256: "4".repeat(64) },
    runs: [run, structuredClone(run)],
    twoRunStability: { stable: true, manifestMatch: true, payloadMatch: true, itemDiffMatch: true },
    identityCandidates: [],
    rights: { status: "unknown", warnings: ["b", "a", "a"] },
    mutationEvidence: {
      before: { stateSha256: "5".repeat(64), entityCount: 0 },
      after: { stateSha256: "5".repeat(64), entityCount: 0 },
      mutationCount: 0,
      unchanged: true,
    },
    rolloutBoundary: { publicResponseChanged: false, writeMethodsInvoked: 0 },
  };
}

test("evidence seal recomputes stability and state equality", () => {
  const envelope = buildSourceImportEvidenceEnvelope(evidence());
  assert.equal(envelope.payload.rightsReview.aiInputAdmitted, false);
  assert.deepEqual(envelope.payload.rightsReview.warnings, ["a", "b"]);

  const badRun = evidence();
  badRun.runs[1].payloadSha256 = "3".repeat(64);
  assert.throws(() => buildSourceImportEvidenceEnvelope(badRun), /source_evidence_not_stable/u);

  const badDiff = evidence();
  badDiff.runs[0].itemDiff = [{
    kind: "source_work",
    id: "work-1",
    status: "would_insert",
    desiredProjectionSha256: "6".repeat(64),
    foundationSha256: null,
  }];
  assert.throws(() => buildSourceImportEvidenceEnvelope(badDiff), /item_diff_digest_mismatch/u);

  const changedState = evidence();
  changedState.mutationEvidence.after.stateSha256 = "6".repeat(64);
  assert.throws(() => buildSourceImportEvidenceEnvelope(changedState), /mutation_detected/u);
});
