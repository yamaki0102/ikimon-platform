export type FoundationDatabaseFixtureDialect = "postgres" | "d1";

export type FoundationFixture16Result = {
  assertionMode: string;
  candidateCount: number;
  oldSnapshotHash: string;
  oldPublicationManifestHash: string;
};
export type FoundationFixture17Result = {
  outcomeCount: number;
  distinctSurveyCount: number;
  claimCount: number;
};
export type FoundationFixture18Result = {
  pendingDisputeCount: number;
  publicationRejected: boolean;
  publicationAfterDisputeClosed: boolean;
};
export type FoundationFixture19Result = {
  destructiveMutationRejected: boolean;
  replacementPredicateCount: number;
  legacyClaimPredicateVersion: number;
};
export type FoundationFixture20Result = {
  revisionsAtWatermark: number;
  allRevisions: number;
  watermarkMutationRejected: boolean;
};
export type FoundationFixture21Result = {
  publicationAt2026: "allow" | "deny" | "review";
  publicationAt2028: "allow" | "deny" | "review";
  preservationAt2028: "allow" | "deny" | "review";
  embeddingAt2026: "allow" | "deny" | "review";
};
export type FoundationFixture22Result = {
  snapshotHash: string;
  artifactAvailability: string;
  reproducibilityStatus: string;
};
export type FoundationFixture23Result = {
  prospectivePastValid: boolean;
  prospectiveFutureValid: boolean;
  retroactivePastValid: boolean;
  prospectiveMutationRejected: boolean;
};
export type FoundationFixture24Result = {
  acceptedCount: number;
  disputeEvent: string;
};

export interface FoundationDatabaseFixtureDriver {
  readonly dialect: FoundationDatabaseFixtureDialect;
  readonly targetName: string;
  beginCase(caseId: string): Promise<void>;
  rollbackCase(): Promise<void>;
  fixture16IdentitySplit(): Promise<FoundationFixture16Result>;
  fixture17NonDetectionThenDetection(): Promise<FoundationFixture17Result>;
  fixture18PendingDisputePublicationGate(): Promise<FoundationFixture18Result>;
  fixture19PredicateBreakingChange(): Promise<FoundationFixture19Result>;
  fixture20PolicyAndWatermark(): Promise<FoundationFixture20Result>;
  fixture21RightsExpiry(): Promise<FoundationFixture21Result>;
  fixture22EraseAndDegradedReplay(): Promise<FoundationFixture22Result>;
  fixture23ProspectiveRevocation(): Promise<FoundationFixture23Result>;
  fixture24EqualAuthorityDispute(): Promise<FoundationFixture24Result>;
}

export type FoundationDatabaseFixtureCaseResult = {
  caseId: `#${number}`;
  name: string;
  status: "passed" | "failed";
  assertionCount: number;
  error: string | null;
};

export type FoundationDatabaseFixtureEvidence = {
  schema: "zukan.foundation-v2-database-fixtures/v1";
  dialect: FoundationDatabaseFixtureDialect;
  targetName: string;
  transactionMode: "rollback_each_case";
  cleanup: "external_exact_target_only";
  cases: FoundationDatabaseFixtureCaseResult[];
  passed: number;
  failed: number;
};

function expectEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}:expected=${String(expected)}:actual=${String(actual)}`);
  }
}

const HASH_E = "e".repeat(64);
const HASH_F = "f".repeat(64);
const HASH_NINE = "9".repeat(64);

const fixtureCases: ReadonlyArray<{
  caseId: FoundationDatabaseFixtureCaseResult["caseId"];
  name: string;
  assertionCount: number;
  run(driver: FoundationDatabaseFixtureDriver): Promise<void>;
}> = [
  {
    caseId: "#16",
    name: "identity split keeps old publication reproducible and returns ambiguity",
    assertionCount: 4,
    async run(driver) {
      const result = await driver.fixture16IdentitySplit();
      expectEqual(result.assertionMode, "ambiguous", "identity_mode");
      expectEqual(result.candidateCount, 2, "identity_candidates");
      expectEqual(result.oldSnapshotHash, HASH_F, "old_snapshot_reproducible");
      expectEqual(result.oldPublicationManifestHash, HASH_NINE, "old_publication_reproducible");
    },
  },
  {
    caseId: "#17",
    name: "non-detection then later detection is not a contradiction",
    assertionCount: 3,
    async run(driver) {
      const result = await driver.fixture17NonDetectionThenDetection();
      expectEqual(result.outcomeCount, 2, "detection_outcome_history");
      expectEqual(result.distinctSurveyCount, 2, "detection_distinct_surveys");
      expectEqual(result.claimCount, 0, "coverage_is_not_claim");
    },
  },
  {
    caseId: "#18",
    name: "pending dispute obeys versioned publication gate",
    assertionCount: 3,
    async run(driver) {
      const result = await driver.fixture18PendingDisputePublicationGate();
      expectEqual(result.pendingDisputeCount, 1, "pending_dispute");
      expectEqual(result.publicationRejected, true, "publication_gate");
      expectEqual(result.publicationAfterDisputeClosed, true, "publication_after_dispute_closed");
    },
  },
  {
    caseId: "#19",
    name: "destructive predicate change requires another URI",
    assertionCount: 3,
    async run(driver) {
      const result = await driver.fixture19PredicateBreakingChange();
      expectEqual(result.destructiveMutationRejected, true, "predicate_immutable");
      expectEqual(result.replacementPredicateCount, 1, "replacement_predicate");
      expectEqual(result.legacyClaimPredicateVersion, 1, "legacy_claim_pinned");
    },
  },
  {
    caseId: "#20",
    name: "policy and claim watermark make replay deterministic",
    assertionCount: 3,
    async run(driver) {
      const result = await driver.fixture20PolicyAndWatermark();
      expectEqual(result.revisionsAtWatermark, 2, "watermark_candidate_count");
      expectEqual(result.allRevisions, 3, "post_watermark_revision_exists");
      expectEqual(result.watermarkMutationRejected, true, "watermark_immutable");
    },
  },
  {
    caseId: "#21",
    name: "publication expiry does not remove preservation",
    assertionCount: 4,
    async run(driver) {
      const result = await driver.fixture21RightsExpiry();
      expectEqual(result.publicationAt2026, "allow", "publication_before_expiry");
      expectEqual(result.publicationAt2028, "deny", "publication_expired");
      expectEqual(result.preservationAt2028, "allow", "preservation_allowed");
      expectEqual(result.embeddingAt2026, "review", "embedding_unknown_review");
    },
  },
  {
    caseId: "#22",
    name: "erase produces degraded replay without changing snapshot hash",
    assertionCount: 3,
    async run(driver) {
      const result = await driver.fixture22EraseAndDegradedReplay();
      expectEqual(result.snapshotHash, HASH_E, "snapshot_hash_immutable");
      expectEqual(result.artifactAvailability, "erased", "artifact_tombstone");
      expectEqual(result.reproducibilityStatus, "degraded", "replay_degraded");
    },
  },
  {
    caseId: "#23",
    name: "prospective revocation does not invalidate the valid past",
    assertionCount: 4,
    async run(driver) {
      const result = await driver.fixture23ProspectiveRevocation();
      expectEqual(result.prospectivePastValid, true, "prospective_valid_past");
      expectEqual(result.prospectiveFutureValid, false, "prospective_invalid_future");
      expectEqual(result.retroactivePastValid, false, "retroactive_invalid_past");
      expectEqual(result.prospectiveMutationRejected, true, "revocation_immutable");
    },
  },
  {
    caseId: "#24",
    name: "equal-authority conflict becomes a DisputeCase",
    assertionCount: 2,
    async run(driver) {
      const result = await driver.fixture24EqualAuthorityDispute();
      expectEqual(result.acceptedCount, 0, "no_accepted_claim");
      expectEqual(result.disputeEvent, "opened", "dispute_opened");
    },
  },
];

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/giu, "postgresql://[redacted]");
}

export async function runFoundationDatabaseFixtureContract(
  driver: FoundationDatabaseFixtureDriver,
): Promise<FoundationDatabaseFixtureEvidence> {
  assertFoundationFixtureTargetName({
    dialect: driver.dialect,
    targetName: driver.targetName,
  });
  const cases: FoundationDatabaseFixtureCaseResult[] = [];
  for (const fixture of fixtureCases) {
    let began = false;
    try {
      await driver.beginCase(fixture.caseId);
      began = true;
      await fixture.run(driver);
      cases.push({
        caseId: fixture.caseId,
        name: fixture.name,
        status: "passed",
        assertionCount: fixture.assertionCount,
        error: null,
      });
    } catch (error) {
      cases.push({
        caseId: fixture.caseId,
        name: fixture.name,
        status: "failed",
        assertionCount: fixture.assertionCount,
        error: safeError(error),
      });
    } finally {
      if (began) {
        try {
          await driver.rollbackCase();
        } catch (error) {
          const result = cases.at(-1);
          if (result) {
            result.status = "failed";
            result.error = `${result.error ? `${result.error};` : ""}rollback:${safeError(error)}`;
          }
        }
      }
    }
  }
  const passed = cases.filter((item) => item.status === "passed").length;
  return {
    schema: "zukan.foundation-v2-database-fixtures/v1",
    dialect: driver.dialect,
    targetName: driver.targetName,
    transactionMode: "rollback_each_case",
    cleanup: "external_exact_target_only",
    cases,
    passed,
    failed: cases.length - passed,
  };
}

export function foundationFixtureUuid(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error("foundation_fixture_uuid_value_invalid");
  }
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}

export function assertFoundationFixtureTargetName(input: {
  dialect: FoundationDatabaseFixtureDialect;
  targetName: string;
}): void {
  const valid = input.dialect === "postgres"
    ? /^zukan_foundation_fixture_[a-z0-9_]{1,48}$/u.test(input.targetName)
    : /^zukan-foundation-fixture-[a-z0-9-]{1,48}\.sqlite$/u.test(input.targetName);
  if (!valid) {
    throw new Error(`foundation_fixture_scratch_target_rejected:${input.dialect}:${input.targetName}`);
  }
}
