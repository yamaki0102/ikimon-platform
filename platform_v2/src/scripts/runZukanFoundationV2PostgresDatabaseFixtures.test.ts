import assert from "node:assert/strict";
import test from "node:test";
import {
  FOUNDATION_POSTGRES_FIXTURE_MIGRATIONS,
  FoundationPostgresDatabaseFixtureDriver,
  parseFoundationPostgresFixtureCli,
} from "./runZukanFoundationV2PostgresDatabaseFixtures.js";

test("PostgreSQL fixture CLI requires an explicit guarded scratch target", () => {
  assert.throws(
    () => parseFoundationPostgresFixtureCli([], {}),
    /database_url_required/,
  );
  assert.throws(() => parseFoundationPostgresFixtureCli([
    "--database-url=postgresql://localhost/ikimon_v2_staging",
    "--confirm-scratch-target=ikimon_v2_staging",
    `--source-sha=${"a".repeat(40)}`,
  ], {}), /scratch_target_rejected/);
  assert.throws(() => parseFoundationPostgresFixtureCli([
    "--database-url=postgresql://localhost/zukan_foundation_fixture_contract",
    "--confirm-scratch-target=another",
    `--source-sha=${"a".repeat(40)}`,
  ], {}), /scratch_confirmation_mismatch/);
});

test("PostgreSQL fixture source contract registers all six migrations and nine methods", () => {
  assert.deepEqual(FOUNDATION_POSTGRES_FIXTURE_MIGRATIONS.map((item) => item.slice(0, 4)), [
    "0134", "0135", "0136", "0137", "0138", "0139",
  ]);
  const methodNames = [
    "fixture16IdentitySplit",
    "fixture17NonDetectionThenDetection",
    "fixture18PendingDisputePublicationGate",
    "fixture19PredicateBreakingChange",
    "fixture20PolicyAndWatermark",
    "fixture21RightsExpiry",
    "fixture22EraseAndDegradedReplay",
    "fixture23ProspectiveRevocation",
    "fixture24EqualAuthorityDispute",
  ] as const;
  for (const methodName of methodNames) {
    assert.equal(typeof FoundationPostgresDatabaseFixtureDriver.prototype[methodName], "function");
  }
});
