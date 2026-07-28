import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  runFoundationDatabaseFixtureContract,
} from "../../src/services/zukanFoundationV2DatabaseFixtureContract.js";
import {
  applyFoundationD1FixtureMigrations,
  FoundationD1DatabaseFixtureDriver,
  assertFoundationD1ScratchFileAbsent,
  parseFoundationD1FixtureCli,
} from "./runZukanFoundationV2D1DatabaseFixtures.js";

test("D1 fixture CLI requires exact scratch name and matching confirmation", () => {
  assert.throws(() => parseFoundationD1FixtureCli([
    "--database-path=ikimon_shadow_core",
    "--confirm-scratch-target=ikimon_shadow_core",
    `--source-sha=${"a".repeat(40)}`,
  ]), /scratch_target_rejected/);
  assert.throws(() => parseFoundationD1FixtureCli([
    "--database-path=zukan-foundation-fixture-contract.sqlite",
    "--confirm-scratch-target=another.sqlite",
    `--source-sha=${"a".repeat(40)}`,
  ]), /scratch_confirmation_mismatch/);
  const parsed = parseFoundationD1FixtureCli([
    "--database-path=zukan-foundation-fixture-contract.sqlite",
    "--migration-directory=migrations/core",
    "--confirm-scratch-target=zukan-foundation-fixture-contract.sqlite",
    `--source-sha=${"a".repeat(40)}`,
  ]);
  assert.equal(pathBasename(parsed.databasePath), "zukan-foundation-fixture-contract.sqlite");
});

test("D1 fixture CLI refuses every pre-existing target without opening it", () => {
  assert.throws(
    () => assertFoundationD1ScratchFileAbsent(
      "zukan-foundation-fixture-contract.sqlite",
      () => true,
    ),
    /existing_database_refused/,
  );
  assert.doesNotThrow(() => assertFoundationD1ScratchFileAbsent(
    "zukan-foundation-fixture-contract.sqlite",
    () => false,
  ));
});

test("D1 DatabaseSync executes the shared nine-case semantic contract", async () => {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
  });
  try {
    applyFoundationD1FixtureMigrations(
      database,
      fileURLToPath(new URL("../migrations/core", import.meta.url)),
    );
    const evidence = await runFoundationDatabaseFixtureContract(
      new FoundationD1DatabaseFixtureDriver(
        database,
        "zukan-foundation-fixture-in-memory.sqlite",
      ),
    );
    assert.equal(evidence.passed, 9, canonicalFailures(evidence.cases));
    assert.equal(evidence.failed, 0, canonicalFailures(evidence.cases));
  } finally {
    database.close();
  }
});

function canonicalFailures(
  cases: Array<{ caseId: string; status: string; error: string | null }>,
): string {
  return JSON.stringify(cases.filter((item) => item.status === "failed"));
}

function pathBasename(value: string): string {
  return value.replaceAll("\\", "/").split("/").at(-1) ?? "";
}
