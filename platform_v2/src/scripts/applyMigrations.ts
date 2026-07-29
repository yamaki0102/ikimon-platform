import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../db.js";

type MigrationRecord = {
  filename: string;
  checksum: string;
};

type MigrationOptions = {
  allowDestructive: boolean;
  repairChecksums: Set<string>;
  localExtensionCompat: boolean;
};

const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bdrop\s+table\b/i, label: "DROP TABLE" },
  { pattern: /\bdrop\s+column\b/i, label: "DROP COLUMN" },
  { pattern: /\btruncate\b/i, label: "TRUNCATE" },
  { pattern: /\bdelete\s+from\b/i, label: "DELETE FROM" },
  { pattern: /^\s*update\b/im, label: "UPDATE" },
];
const EXPLICIT_DESTRUCTIVE_APPROVAL = /destructive-ok:\s*.{12,}/i;
const OWNER_SENSITIVE_APPROVAL = /owner-sensitive-ok:\s*.{12,}/i;

function checksumFor(content: string): string {
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function parseArgs(argv: string[]): MigrationOptions {
  const repairChecksums = new Set<string>();
  const envRepairChecksums = process.env.IKIMON_MIGRATION_REPAIR_CHECKSUMS ?? "";
  for (const filename of envRepairChecksums.split(",")) {
    const trimmed = filename.trim();
    if (trimmed) {
      repairChecksums.add(trimmed);
    }
  }
  for (const arg of argv) {
    if (!arg.startsWith("--repair-checksum=")) {
      continue;
    }
    const filename = arg.slice("--repair-checksum=".length).trim();
    if (filename) {
      repairChecksums.add(filename);
    }
  }

  return {
    allowDestructive: argv.includes("--allow-destructive"),
    repairChecksums,
    localExtensionCompat: argv.includes("--local-extension-compat"),
  };
}

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const parsed = new URL(databaseUrl);
    return ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function assertLocalExtensionCompatAllowed(): void {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!isLocalDatabaseUrl(databaseUrl)) {
    throw new Error("--local-extension-compat is allowed only for localhost scratch DATABASE_URL values.");
  }
}

function applyLocalExtensionCompat(sql: string): string {
  return sql
    .replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+vector\s*;/gi, "-- local-extension-compat: pgvector extension skipped")
    .replace(/^\s*SELECT\s+create_hypertable\([^\n;]+;\s*$/gim, "-- local-extension-compat: Timescale hypertable skipped")
    .replace(/\bVECTOR\s*\(\s*\d+\s*\)/gi, "DOUBLE PRECISION[]")
    .replace(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\S+\s+ON\s+\S+\s+USING\s+ivfflat\s*\([\s\S]*?\)\s+WITH\s*\([^;]*\)\s*(?:WHERE[\s\S]*?)?;/gi,
      "-- local-extension-compat: pgvector ivfflat index skipped",
    );
}

function assertSafeMigration(filename: string, sql: string, options: MigrationOptions): void {
  if (options.allowDestructive || options.repairChecksums.has(filename)) {
    return;
  }

  const hits = DESTRUCTIVE_PATTERNS
    .filter(({ pattern }) => pattern.test(sql))
    .map(({ label }) => label);

  if (hits.length === 0) {
    return;
  }

  if (EXPLICIT_DESTRUCTIVE_APPROVAL.test(sql)) {
    return;
  }

  throw new Error(
    `Destructive migration blocked for ${filename}: ${hits.join(", ")}. Re-run with --allow-destructive or add an explicit destructive-ok rollback note only after the rollback plan is explicit.`,
  );
}

function isOwnerPrivilegeError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "42501");
}

async function ensureSchemaMigrationsTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function loadAppliedMigrations(): Promise<Map<string, MigrationRecord>> {
  const pool = getPool();
  const result = await pool.query<MigrationRecord>(
    "select filename, checksum from schema_migrations order by filename",
  );

  return new Map(result.rows.map((row: MigrationRecord) => [row.filename, row]));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.localExtensionCompat) {
    assertLocalExtensionCompatAllowed();
  }
  await ensureSchemaMigrationsTable();

  const pool = getPool();
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const migrationsDir = path.resolve(currentDir, "../../db/migrations");
  const migrationFiles = (await readdir(migrationsDir))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  const applied = await loadAppliedMigrations();

  for (const filename of migrationFiles) {
    const fullPath = path.join(migrationsDir, filename);
    const rawSql = await readFile(fullPath, "utf8");
    const checksum = checksumFor(rawSql);
    const sql = options.localExtensionCompat ? applyLocalExtensionCompat(rawSql) : rawSql;
    const appliedMigration = applied.get(filename);

    if (appliedMigration) {
      if (appliedMigration.checksum !== checksum) {
        if (options.repairChecksums.has(filename)) {
          await pool.query("update schema_migrations set checksum = $1 where filename = $2", [
            checksum,
            filename,
          ]);
          console.warn(`repair checksum ${filename}`);
          continue;
        }
        throw new Error(`Migration checksum mismatch for ${filename}`);
      }
      console.log(`skip ${filename}`);
      continue;
    }

    assertSafeMigration(filename, sql, options);

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into schema_migrations (filename, checksum) values ($1, $2)",
        [filename, checksum],
      );
      await client.query("commit");
      console.log(`apply ${filename}`);
    } catch (error) {
      await client.query("rollback");
      if (OWNER_SENSITIVE_APPROVAL.test(sql) && isOwnerPrivilegeError(error)) {
        throw new Error(
          `Owner-sensitive migration blocked for ${filename}: database role lacks ownership or required privileges. The transaction was rolled back and the migration was not recorded as applied. Repair object ownership or run with the approved migration owner role before retrying.`,
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

void main();
