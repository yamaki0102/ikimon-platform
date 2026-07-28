import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFoundationFixtureTargetName,
  foundationFixtureUuid,
  runFoundationDatabaseFixtureContract,
  type FoundationDatabaseFixtureDriver,
} from "./zukanFoundationV2DatabaseFixtureContract.js";

test("fixture contract defines the same #16-#24 names and assertions once", async () => {
  const noOp = async () => undefined;
  const driver: FoundationDatabaseFixtureDriver = {
    dialect: "d1",
    targetName: "zukan-foundation-fixture-contract.sqlite",
    beginCase: noOp,
    rollbackCase: noOp,
    async fixture16IdentitySplit() {
      return {
        assertionMode: "ambiguous",
        candidateCount: 2,
        oldSnapshotHash: "f".repeat(64),
        oldPublicationManifestHash: "9".repeat(64),
      };
    },
    async fixture17NonDetectionThenDetection() {
      return { outcomeCount: 2, distinctSurveyCount: 2, claimCount: 0 };
    },
    async fixture18PendingDisputePublicationGate() {
      return {
        pendingDisputeCount: 1,
        publicationRejected: true,
        publicationAfterDisputeClosed: true,
      };
    },
    async fixture19PredicateBreakingChange() {
      return {
        destructiveMutationRejected: true,
        replacementPredicateCount: 1,
        legacyClaimPredicateVersion: 1,
      };
    },
    async fixture20PolicyAndWatermark() {
      return { revisionsAtWatermark: 2, allRevisions: 3, watermarkMutationRejected: true };
    },
    async fixture21RightsExpiry() {
      return {
        publicationAt2026: "allow",
        publicationAt2028: "deny",
        preservationAt2028: "allow",
        embeddingAt2026: "review",
      };
    },
    async fixture22EraseAndDegradedReplay() {
      return {
        snapshotHash: "e".repeat(64),
        artifactAvailability: "erased",
        reproducibilityStatus: "degraded",
      };
    },
    async fixture23ProspectiveRevocation() {
      return {
        prospectivePastValid: true,
        prospectiveFutureValid: false,
        retroactivePastValid: false,
        prospectiveMutationRejected: true,
      };
    },
    async fixture24EqualAuthorityDispute() {
      return { acceptedCount: 0, disputeEvent: "opened" };
    },
  };
  const evidence = await runFoundationDatabaseFixtureContract(driver);
  assert.equal(evidence.cases.length, 9);
  assert.deepEqual(evidence.cases.map((item) => item.caseId), [
    "#16", "#17", "#18", "#19", "#20", "#21", "#22", "#23", "#24",
  ]);
  assert.deepEqual(evidence.cases.map((item) => item.assertionCount), [
    4, 3, 3, 3, 3, 4, 3, 4, 2,
  ]);
  assert.equal(evidence.passed, 9);
  assert.equal(evidence.failed, 0);
});

test("scratch guards reject staging and production names", () => {
  assert.doesNotThrow(() => assertFoundationFixtureTargetName({
    dialect: "postgres",
    targetName: "zukan_foundation_fixture_20260728",
  }));
  assert.doesNotThrow(() => assertFoundationFixtureTargetName({
    dialect: "d1",
    targetName: "zukan-foundation-fixture-20260728.sqlite",
  }));
  for (const targetName of ["ikimon_v2", "ikimon_v2_staging", "ikimon_shadow_core"]) {
    assert.throws(() => assertFoundationFixtureTargetName({
      dialect: "postgres",
      targetName,
    }), /scratch_target_rejected/);
  }
  assert.equal(foundationFixtureUuid(24), "00000000-0000-4000-8000-000000000018");
});

test("runner rejects a mislabeled driver before any case begins", async () => {
  let began = 0;
  const rejected = {
    dialect: "postgres" as const,
    targetName: "ikimon_v2",
    async beginCase() {
      began += 1;
    },
  } as unknown as FoundationDatabaseFixtureDriver;
  await assert.rejects(
    runFoundationDatabaseFixtureContract(rejected),
    /scratch_target_rejected/,
  );
  assert.equal(began, 0);
});
