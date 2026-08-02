import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMigrationTransaction,
  type MigrationTransactionClient,
  type PendingMigration,
} from "./applyMigration.js";

const ownerSensitiveMigration: PendingMigration = {
  filename: "0001_owner_sensitive.sql",
  checksum: "owner-sensitive-checksum",
  sql: `
    -- owner-sensitive-ok: verified rollback-only behavioral fixture
    ALTER TABLE owner_sensitive_target ADD COLUMN should_not_exist TEXT;
  `,
};

test("42501 rolls back, records no ledger row, and prevents the next migration", async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  let laterMigrationRan = false;
  const client: MigrationTransactionClient = {
    async query(text, values) {
      queries.push({ text, values });
      if (text === ownerSensitiveMigration.sql) {
        throw Object.assign(new Error("must be owner of table owner_sensitive_target"), {
          code: "42501",
        });
      }
      if (text.includes("after_failure_marker")) {
        laterMigrationRan = true;
      }
      return {};
    },
  };

  const migrations: PendingMigration[] = [
    ownerSensitiveMigration,
    {
      filename: "0002_after_failure.sql",
      checksum: "after-failure-checksum",
      sql: "CREATE TABLE after_failure_marker (id INTEGER);",
    },
  ];

  await assert.rejects(
    async () => {
      for (const migration of migrations) {
        await applyMigrationTransaction(client, migration);
      }
    },
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /object ownership or required privileges/);
      assert.match(error.message, /approved migration role/);
      assert.match(error.message, /transaction was rolled back/);
      assert.match(error.message, /not recorded as applied/);
      assert.equal((error.cause as { code?: string } | undefined)?.code, "42501");
      return true;
    },
  );

  assert.deepEqual(
    queries.map(({ text }) => text),
    ["begin", ownerSensitiveMigration.sql, "rollback"],
  );
  assert.equal(
    queries.some(({ text }) => text.includes("insert into schema_migrations")),
    false,
  );
  assert.equal(laterMigrationRan, false);
});

test("successful migrations retain begin, SQL, ledger insert, and commit ordering", async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const client: MigrationTransactionClient = {
    async query(text, values) {
      queries.push({ text, values });
      return {};
    },
  };
  const migration: PendingMigration = {
    filename: "0001_success.sql",
    checksum: "success-checksum",
    sql: "CREATE TABLE success_marker (id INTEGER);",
  };

  await applyMigrationTransaction(client, migration);

  assert.deepEqual(
    queries.map(({ text }) => text),
    [
      "begin",
      migration.sql,
      "insert into schema_migrations (filename, checksum) values ($1, $2)",
      "commit",
    ],
  );
  assert.deepEqual(queries[2]?.values, [migration.filename, migration.checksum]);
});
