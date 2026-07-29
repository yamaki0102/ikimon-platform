import { Pool } from "pg";
import { applyMigrationTransaction, type PendingMigration } from "./applyMigration.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the disposable PostgreSQL fixture.");
}

const migrations: PendingMigration[] = [
  {
    filename: "0001_owner_sensitive.sql",
    checksum: "owner-sensitive-checksum",
    sql: `
      -- owner-sensitive-ok: disposable PostgreSQL ownership rollback proof
      CREATE TABLE public.partial_change_probe (id INTEGER);
      ALTER TABLE public.owner_sensitive_target
        ADD COLUMN should_not_exist TEXT;
      CREATE INDEX owner_sensitive_target_should_not_exist_idx
        ON public.owner_sensitive_target (should_not_exist);
      ALTER TABLE public.owner_sensitive_target
        ADD CONSTRAINT owner_sensitive_target_should_not_exist_chk
        CHECK (should_not_exist IS NULL);
    `,
  },
  {
    filename: "0002_after_failure.sql",
    checksum: "after-failure-checksum",
    sql: "CREATE TABLE public.after_failure_marker (id INTEGER);",
  },
];

const pool = new Pool({ connectionString: databaseUrl });

try {
  const client = await pool.connect();
  try {
    for (const migration of migrations) {
      await applyMigrationTransaction(client, migration);
    }
  } finally {
    client.release();
  }
} catch (error) {
  const postgresCode =
    error instanceof Error &&
    error.cause &&
    typeof error.cause === "object" &&
    "code" in error.cause
      ? String((error.cause as { code: unknown }).code)
      : "unknown";
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`postgres_code=${postgresCode}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
