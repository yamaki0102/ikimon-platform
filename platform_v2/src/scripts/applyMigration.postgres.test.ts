import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";
import { Pool } from "pg";

const execFileAsync = promisify(execFile);
const runPostgresTest = process.env.IKIMON_RUN_POSTGRES_MIGRATION_TEST === "1";

async function docker(args: string[], allowFailure = false): Promise<string> {
  try {
    const result = await execFileAsync("docker", args, {
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    return result.stdout.trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    throw error;
  }
}

async function waitForPostgres(databaseUrl: string): Promise<Pool> {
  const pool = new Pool({ connectionString: databaseUrl });
  let lastError: unknown;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await pool.query("select 1");
      return pool;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  await pool.end();
  throw lastError;
}

type SchemaSnapshot = {
  columns: string[];
  indexes: string[];
  constraints: string[];
  partialProbePresent: boolean;
  laterMarkerPresent: boolean;
};

async function readSchemaSnapshot(pool: Pool): Promise<SchemaSnapshot> {
  const [columns, indexes, constraints, markers] = await Promise.all([
    pool.query<{ column_name: string }>(
      `select column_name
         from information_schema.columns
        where table_schema = 'public' and table_name = 'owner_sensitive_target'
        order by ordinal_position`,
    ),
    pool.query<{ indexname: string }>(
      `select indexname
         from pg_indexes
        where schemaname = 'public' and tablename = 'owner_sensitive_target'
        order by indexname`,
    ),
    pool.query<{ conname: string }>(
      `select con.conname
         from pg_constraint con
         join pg_class rel on rel.oid = con.conrelid
         join pg_namespace nsp on nsp.oid = rel.relnamespace
        where nsp.nspname = 'public' and rel.relname = 'owner_sensitive_target'
        order by con.conname`,
    ),
    pool.query<{ partial_probe_present: boolean; later_marker_present: boolean }>(
      `select to_regclass('public.partial_change_probe') is not null as partial_probe_present,
              to_regclass('public.after_failure_marker') is not null as later_marker_present`,
    ),
  ]);

  return {
    columns: columns.rows.map((row) => row.column_name),
    indexes: indexes.rows.map((row) => row.indexname),
    constraints: constraints.rows.map((row) => row.conname),
    partialProbePresent: markers.rows[0]?.partial_probe_present ?? false,
    laterMarkerPresent: markers.rows[0]?.later_marker_present ?? false,
  };
}

test(
  "PostgreSQL 16 owner error rolls back schema and ledger, then stops fail-closed",
  { skip: !runPostgresTest, timeout: 240_000 },
  async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    const containerName = `ikimon-migration-42501-${suffix}`;
    const databaseName = "ikimon_migration_test";
    const adminPassword = "disposable_admin_only";
    const ownerPassword = "disposable_owner_only";
    const migrationPassword = "disposable_migration_only";
    let caughtError: unknown;

    try {
      await docker([
        "run",
        "--detach",
        "--rm",
        "--name",
        containerName,
        "--publish",
        "127.0.0.1::5432",
        "--env",
        `POSTGRES_PASSWORD=${adminPassword}`,
        "--env",
        `POSTGRES_DB=${databaseName}`,
        "postgres:16-alpine",
      ]);
      const portOutput = await docker(["port", containerName, "5432/tcp"]);
      const port = portOutput.match(/:(\d+)\s*$/)?.[1];
      assert.ok(port, `Unable to resolve disposable PostgreSQL port from: ${portOutput}`);

      const adminUrl = `postgresql://postgres:${adminPassword}@127.0.0.1:${port}/${databaseName}`;
      const adminPool = await waitForPostgres(adminUrl);
      const versionResult = await adminPool.query<{ server_version: string }>(
        "show server_version",
      );
      const serverVersion = versionResult.rows[0]?.server_version ?? "";
      assert.match(serverVersion, /^16\./);

      await adminPool.query(`
        CREATE ROLE object_owner LOGIN PASSWORD '${ownerPassword}';
        CREATE ROLE migration_runner LOGIN PASSWORD '${migrationPassword}';
        GRANT CONNECT ON DATABASE ${databaseName} TO object_owner, migration_runner;
        GRANT USAGE, CREATE ON SCHEMA public TO object_owner, migration_runner;
        SET ROLE object_owner;
        CREATE TABLE public.owner_sensitive_target (id INTEGER PRIMARY KEY);
        RESET ROLE;
        GRANT SELECT ON public.owner_sensitive_target TO migration_runner;
      `);
      await adminPool.end();

      const migrationUrl =
        `postgresql://migration_runner:${migrationPassword}@127.0.0.1:${port}/${databaseName}`;
      const migrationPool = await waitForPostgres(migrationUrl);
      await migrationPool.query(`
        CREATE TABLE public.schema_migrations (
          filename TEXT PRIMARY KEY,
          checksum TEXT NOT NULL,
          applied_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      const ledgerBefore = await migrationPool.query<{ count: string }>(
        "select count(*)::text as count from public.schema_migrations",
      );
      const schemaBefore = await readSchemaSnapshot(migrationPool);

      const fixturePath = fileURLToPath(
        new URL("./applyMigration.postgres.fixture.ts", import.meta.url),
      );
      const fixtureResult = await execFileAsync(
        process.execPath,
        ["--import", "tsx", fixturePath],
        {
          env: { ...process.env, DATABASE_URL: migrationUrl },
          maxBuffer: 4 * 1024 * 1024,
          windowsHide: true,
        },
      ).catch(
        (error: {
          code?: number;
          stdout?: string;
          stderr?: string;
        }) => error,
      );
      const runnerExitCode = "code" in fixtureResult ? (fixtureResult.code ?? 0) : 0;

      assert.equal(runnerExitCode, 1);
      assert.match(fixtureResult.stderr ?? "", /postgres_code=42501/);
      assert.match(
        fixtureResult.stderr ?? "",
        /Repair object ownership or run with the approved migration role/,
      );

      const ledgerAfter = await migrationPool.query<{ count: string }>(
        "select count(*)::text as count from public.schema_migrations",
      );
      const schemaAfter = await readSchemaSnapshot(migrationPool);
      await migrationPool.end();

      assert.equal(ledgerBefore.rows[0]?.count, "0");
      assert.equal(ledgerAfter.rows[0]?.count, "0");
      assert.deepEqual(schemaAfter, schemaBefore);
      assert.equal(schemaAfter.partialProbePresent, false);
      assert.equal(schemaAfter.laterMarkerPresent, false);
      assert.deepEqual(schemaAfter.columns, ["id"]);
      assert.deepEqual(schemaAfter.indexes, ["owner_sensitive_target_pkey"]);
      assert.deepEqual(schemaAfter.constraints, ["owner_sensitive_target_pkey"]);

      console.log(
        JSON.stringify({
          postgresVersion: serverVersion,
          runnerExitCode,
          postgresErrorCode: "42501",
          schemaMigrations: { before: "0", after: "0" },
          schemaObjects: { before: schemaBefore, after: schemaAfter },
        }),
      );
    } catch (error) {
      caughtError = error;
    } finally {
      await docker(["rm", "--force", containerName], true);
    }

    const remnants = await docker([
      "ps",
      "--all",
      "--filter",
      `name=^/${containerName}$`,
      "--format",
      "{{.ID}}",
    ]);
    assert.equal(remnants, "", "Disposable PostgreSQL container must be removed.");
    if (caughtError) {
      throw caughtError;
    }
  },
);
