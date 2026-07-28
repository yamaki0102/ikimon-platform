import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFoundationSourceRegistryReadOnlyEvidence,
  buildFoundationItemShadowDiff,
  canonicalizeFoundationSourceImportState,
  type FoundationIdentityCandidateReader,
  type FoundationReadOnlyRepository,
  type VerifiedFoundationEvidenceSourceSha,
} from "./zukanFoundationV2ReadOnlyEvidence.js";
import {
  emptyFoundationSourceImportState,
  type FoundationSourceImportState,
} from "./zukanFoundationV2RepositoryContract.js";
import {
  planRegionalSourceFoundationImport,
} from "./zukanFoundationV2SourceRegistryImport.js";

const candidateReader: FoundationIdentityCandidateReader = {
  async searchIdentityCandidates(input) {
    return [{
      subjectId: `candidate:${input.publisher.publisherId}`,
      matchSignals: ["official_url", "name", "name"],
    }];
  },
};
const verifiedSourceSha = "a".repeat(40) as VerifiedFoundationEvidenceSourceSha;

function repository(input: {
  state?: FoundationSourceImportState;
  onWrite?: () => never;
} = {}): FoundationReadOnlyRepository & { applySourceImport(): never } {
  return {
    dialect: "postgres",
    async capabilities() {
      return {
        available: true,
        dialect: "postgres",
        schemaVersion: "foundation_v2_integrity_0139",
        readOnly: false,
        blockers: [],
      };
    },
    async readSourceImportState() {
      return input.state ?? emptyFoundationSourceImportState();
    },
    applySourceImport() {
      return input.onWrite?.() ?? (() => {
        throw new Error("write_method_must_not_be_called");
      })();
    },
  };
}

test("read-only evidence uses actual repository state twice and never calls write", async () => {
  let writes = 0;
  const evidence = await buildFoundationSourceRegistryReadOnlyEvidence({
    repository: repository({
      onWrite: () => {
        writes += 1;
        throw new Error("write_method_must_not_be_called");
      },
    }),
    candidateReader,
    tenantId: "fixture-tenant",
    sourceSha: verifiedSourceSha,
    target: {
      evidenceKind: "direct_read_only",
      locator: "postgres:zukan_foundation_fixture_contract",
      readOnlyEnforcement: "postgres_default_transaction_read_only",
    },
  });
  assert.equal(evidence.source.commitSha, "a".repeat(40));
  assert.equal(evidence.target.evidenceKind, "direct_read_only");
  assert.equal(evidence.twoRunStability.stable, true);
  assert.equal(evidence.runs[0].manifestSha256, evidence.runs[1].manifestSha256);
  assert.deepEqual(evidence.runs[0].itemDiff, evidence.runs[1].itemDiff);
  assert.equal(evidence.mutationEvidence.unchanged, true);
  assert.equal(evidence.mutationEvidence.mutationCount, 0);
  assert.equal(evidence.rolloutBoundary.publicResponseChanged, false);
  assert.equal(evidence.rolloutBoundary.writeMethodsInvoked, 0);
  assert.equal(writes, 0);
  assert.ok(evidence.identityCandidates.length > 0);
  assert.ok(evidence.identityCandidates.every((item) =>
    item.disposition === "manual_review_required"
    && item.autoCanonicalized === false
    && item.autoSamePlace === false));
  assert.ok(evidence.rights.warnings.every((warning) =>
    warning.startsWith("rights_unknown_requires_review:")));
});

test("canonical state and item diff are stable across row ordering", () => {
  const plan = planRegionalSourceFoundationImport({ tenantId: "fixture-tenant" });
  const populated: FoundationSourceImportState = {
    subjects: [...plan.batch.subjects].reverse(),
    sourceWorks: [...plan.batch.sourceWorks].reverse(),
    sourceEditions: [...plan.batch.sourceEditions].reverse(),
    contentFixityEvents: [],
    contentObjects: [],
    publicIdentifiers: [...plan.batch.publicIdentifiers].reverse(),
  };
  const canonical = canonicalizeFoundationSourceImportState(populated);
  const diff = buildFoundationItemShadowDiff({
    desired: plan.batch,
    actual: canonical,
  });
  assert.equal(diff.length, plan.counts.entities);
  assert.ok(diff.every((item) => item.status === "unchanged"));
});

test("repository capability failure cannot be mislabeled as target evidence", async () => {
  const unavailable: FoundationReadOnlyRepository = {
    dialect: "d1",
    async capabilities() {
      return {
        available: false,
        dialect: "d1",
        schemaVersion: null,
        readOnly: false,
        blockers: ["foundation_v2_integrity_0014_not_applied"],
      };
    },
    async readSourceImportState() {
      throw new Error("must_not_read");
    },
  };
  await assert.rejects(
    buildFoundationSourceRegistryReadOnlyEvidence({
      repository: unavailable,
      candidateReader,
      tenantId: "fixture-tenant",
      sourceSha: verifiedSourceSha,
      target: {
        evidenceKind: "remote_snapshot_export",
        locator: "d1-export:fixture",
        readOnlyEnforcement: "d1_database_sync_read_only",
      },
    }),
    /foundation_evidence_repository_unavailable/,
  );
});
