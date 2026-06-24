import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { QueryResultRow } from "pg";
import { getPool } from "../db.js";

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

type Options = {
  expectedDatabasePattern: RegExp | null;
  requireApplied: boolean;
};

type IdentityRow = {
  current_user: string;
  current_database: string;
  server_addr: string | null;
  server_port: number | null;
};

type SchemaMigrationRow = {
  filename: string;
  checksum: string;
  applied_at: string | Date | null;
};

type LatestMigrationRow = {
  applied_count: string | number;
  latest_filename: string | null;
};

const TARGET_MIGRATION = "0123_municipal_walk_maps.sql";
const REQUIRED_EXTENSIONS = ["timescaledb", "vector"];
const MUNICIPAL_TABLES = [
  "municipal_walk_map_creators",
  "municipal_walk_maps",
  "municipal_walk_map_stops",
  "municipal_walk_map_audit",
];

function checksumFor(content: string): string {
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function parseArgs(argv: string[]): Options {
  let expectedDatabasePattern: RegExp | null = /staging|shadow/i;
  let requireApplied = false;
  for (const arg of argv) {
    if (arg === "--no-expected-database-pattern") {
      expectedDatabasePattern = null;
    } else if (arg.startsWith("--expected-database-pattern=")) {
      const pattern = arg.slice("--expected-database-pattern=".length).trim();
      expectedDatabasePattern = pattern ? new RegExp(pattern, "i") : null;
    } else if (arg === "--require-applied") {
      requireApplied = true;
    }
  }
  return { expectedDatabasePattern, requireApplied };
}

function migrationChecksumPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return path.resolve(currentDir, "../../db/migrations", TARGET_MIGRATION);
}

async function targetMigrationChecksum(): Promise<string> {
  return checksumFor(await readFile(migrationChecksumPath(), "utf8"));
}

async function tablePresence(db: Queryable, tables: string[]): Promise<Record<string, boolean>> {
  const result = await db.query<{ table_name: string; present: boolean }>(
    `select table_name, to_regclass('public.' || table_name) is not null as present
     from unnest($1::text[]) as required(table_name)
     order by table_name`,
    [tables],
  );
  return Object.fromEntries(result.rows.map((row) => [row.table_name, Boolean(row.present)]));
}

async function schemaMigrationEvidence(db: Queryable, checksum: string) {
  const presence = await tablePresence(db, ["schema_migrations"]);
  if (!presence.schema_migrations) {
    return {
      schemaMigrationsPresent: false,
      target: null,
      latest: null,
      checksumMatches: false,
    };
  }
  const targetResult = await db.query<SchemaMigrationRow>(
    `select filename, checksum, applied_at
     from schema_migrations
     where filename = $1
     limit 1`,
    [TARGET_MIGRATION],
  );
  const latestResult = await db.query<LatestMigrationRow>(
    `select count(*) as applied_count, max(filename) as latest_filename
     from schema_migrations`,
  );
  const target = targetResult.rows[0] ?? null;
  return {
    schemaMigrationsPresent: true,
    target,
    latest: latestResult.rows[0] ?? null,
    checksumMatches: target ? target.checksum === checksum : false,
  };
}

async function extensionEvidence(db: Queryable) {
  const result = await db.query<{ extname: string }>(
    `select extname
     from pg_extension
     where extname = any($1::text[])
     order by extname`,
    [REQUIRED_EXTENSIONS],
  );
  const installed = result.rows.map((row) => row.extname);
  return {
    required: REQUIRED_EXTENSIONS,
    installed,
    missing: REQUIRED_EXTENSIONS.filter((ext) => !installed.includes(ext)),
  };
}

async function identityEvidence(db: Queryable): Promise<IdentityRow> {
  const result = await db.query<IdentityRow>(
    `select
       current_user,
       current_database(),
       inet_server_addr()::text as server_addr,
       inet_server_port()::int as server_port`,
  );
  const row = result.rows[0];
  if (!row) throw new Error("db_identity_query_returned_no_rows");
  return row;
}

async function municipalEvidence(db: Queryable, municipalTablesPresent: boolean) {
  if (!municipalTablesPresent) {
    return {
      tablesAlreadyPresent: false,
      shizuokaSeedSafety: null,
      publicModeCounts: null,
      publicSummaryQuery: null,
      emergencyHiddenPublicCount: null,
    };
  }
  const shizuokaSeedSafety = await db.query<{
    total_stops: string | number;
    unsafe_stop_count: string | number;
    unsafe_stop_ids: string | null;
  }>(
    `select
       count(*)::int as total_stops,
       count(*) filter (
         where s.access <> 'public_access'
            or coalesce(s.sensitive_context, 'none') <> 'none'
            or s.area_kind = 'school'
       )::int as unsafe_stop_count,
       string_agg(s.stop_id, ',' order by s.stop_id) filter (
         where s.access <> 'public_access'
            or coalesce(s.sensitive_context, 'none') <> 'none'
            or s.area_kind = 'school'
       ) as unsafe_stop_ids
     from municipal_walk_maps m
     join municipal_walk_map_stops s on s.walk_map_id = m.walk_map_id
     where m.walk_map_id like 'jp-shizuoka-%sample-v0'`,
  );
  const publicModeCounts = await db.query<{
    publish_mode: string;
    count: string | number;
  }>(
    `select publish_mode, count(*)::int as count
     from municipal_walk_maps
     group by publish_mode
     order by publish_mode`,
  );
  const publicSummaryQuery = await db.query<{
    public_summary_count: string | number;
    non_public_summary_count: string | number;
    exact_location_column_count: string | number;
  }>(
    `select
       count(*) filter (where publish_mode = 'public')::int as public_summary_count,
       count(*) filter (where publish_mode <> 'public')::int as non_public_summary_count,
       (
         select count(*)::int
         from information_schema.columns
         where table_schema = 'public'
           and table_name in ('municipal_walk_maps', 'municipal_walk_map_stops')
           and column_name in ('lat', 'lng', 'latitude', 'longitude', 'point_latitude', 'point_longitude')
       ) as exact_location_column_count
     from municipal_walk_maps`,
  );
  const emergencyHiddenPublicCount = await db.query<{ count: string | number }>(
    `select count(*)::int as count
     from municipal_walk_maps
     where publish_mode = 'public'
       and coalesce((publication_review->>'emergencyHidden')::boolean, false) = true`,
  );

  return {
    tablesAlreadyPresent: true,
    shizuokaSeedSafety: shizuokaSeedSafety.rows[0] ?? null,
    publicModeCounts: publicModeCounts.rows,
    publicSummaryQuery: publicSummaryQuery.rows[0] ?? null,
    emergencyHiddenPublicCount: emergencyHiddenPublicCount.rows[0]?.count ?? null,
  };
}

function assertDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for municipal walk-map DB apply preflight.");
  }
}

async function main(): Promise<void> {
  assertDatabaseUrl();
  const options = parseArgs(process.argv.slice(2));
  const pool = getPool();
  const blockers: string[] = [];
  const warnings: string[] = [];
  try {
    const checksum = await targetMigrationChecksum();
    const [identity, extensions, migrations, tables] = await Promise.all([
      identityEvidence(pool),
      extensionEvidence(pool),
      schemaMigrationEvidence(pool, checksum),
      tablePresence(pool, MUNICIPAL_TABLES),
    ]);

    if (options.expectedDatabasePattern && !options.expectedDatabasePattern.test(identity.current_database)) {
      blockers.push(`database_name_does_not_match_expected_pattern:${identity.current_database}`);
    }
    if (/prod|production/i.test(identity.current_database)) {
      blockers.push(`database_name_looks_production:${identity.current_database}`);
    }
    if (process.env.NODE_ENV === "production") {
      blockers.push("node_env_is_production");
    }
    if (extensions.missing.length > 0) {
      blockers.push(`required_extensions_missing:${extensions.missing.join(",")}`);
    }
    if (!migrations.schemaMigrationsPresent) {
      blockers.push("schema_migrations_table_missing");
    }
    if (migrations.target && !migrations.checksumMatches) {
      blockers.push(`target_migration_checksum_mismatch:${TARGET_MIGRATION}`);
    }
    if (options.requireApplied && !migrations.target) {
      blockers.push(`target_migration_not_applied:${TARGET_MIGRATION}`);
    }

    const municipalTablesPresent = MUNICIPAL_TABLES.every((table) => tables[table]);
    const municipal = await municipalEvidence(pool, municipalTablesPresent);
    if (!municipalTablesPresent) {
      warnings.push("municipal_walk_map_tables_not_present_yet");
    } else {
      const unsafeCount = Number(municipal.shizuokaSeedSafety?.unsafe_stop_count ?? 0);
      const exactLocationColumns = Number(municipal.publicSummaryQuery?.exact_location_column_count ?? 0);
      const emergencyPublicCount = Number(municipal.emergencyHiddenPublicCount ?? 0);
      if (unsafeCount > 0) blockers.push(`unsafe_shizuoka_seed_stops:${municipal.shizuokaSeedSafety?.unsafe_stop_ids ?? "unknown"}`);
      if (exactLocationColumns > 0) blockers.push("municipal_tables_have_exact_location_columns");
      if (emergencyPublicCount > 0) blockers.push("emergency_hidden_public_rows_present");
    }

    const report = {
      ok: blockers.length === 0,
      targetMigration: {
        filename: TARGET_MIGRATION,
        checksum,
      },
      identity,
      extensions,
      migrations,
      municipalTables: tables,
      municipal,
      blockers,
      warnings,
    };
    console.log(JSON.stringify(report, null, 2));
    if (blockers.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

void main();
