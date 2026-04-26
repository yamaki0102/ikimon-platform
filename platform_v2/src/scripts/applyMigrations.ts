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
};

const DESTRUCTIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bdrop\s+table\b/i, label: "DROP TABLE" },
  { pattern: /\bdrop\s+column\b/i, label: "DROP COLUMN" },
  { pattern: /\balter\s+table\b[\s\S]*\bdrop\b/i, label: "ALTER TABLE ... DROP" },
  { pattern: /\btruncate\b/i, label: "TRUNCATE" },
  { pattern: /\bdelete\s+from\b/i, label: "DELETE FROM" },
  { pattern: /^\s*update\b/im, label: "UPDATE" },
];

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
  };
}

function assertSafeMigration(filename: string, sql: string, options: MigrationOptions): void {
  if (options.allowDestructive) {
    return;
  }

  const hits = DESTRUCTIVE_PATTERNS
    .filter(({ pattern }) => pattern.test(sql))
    .map(({ label }) => label);

  if (hits.length === 0) {
    return;
  }

  throw new Error(
    `Destructive migration blocked for ${filename}: ${hits.join(", ")}. Re-run with --allow-destructive only after rollback plan is explicit.`,
  );
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
    const sql = await readFile(fullPath, "utf8");
    assertSafeMigration(filename, sql, options);
    const checksum = checksumFor(sql);
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
      throw error;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

void main();
