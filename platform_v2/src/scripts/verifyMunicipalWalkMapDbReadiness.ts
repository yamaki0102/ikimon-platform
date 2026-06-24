import { getPool } from "../db.js";
import { listMunicipalWalkMapReviewQueueV0 } from "../services/municipalWalkMap.js";

type TableCheck = {
  table: string;
  present: boolean;
};

type SeedRow = {
  walk_map_id: string;
  source_count: number;
  stop_count: number;
  publish_mode: string;
};

type MunicipalWalkMapDbPoolLike = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  connect(): Promise<{
    query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
    release(): void;
  }>;
};

const REQUIRED_TABLES = [
  "municipal_walk_map_creators",
  "municipal_walk_maps",
  "municipal_walk_map_stops",
  "municipal_walk_map_audit",
];

function assertDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for municipal walk-map DB readiness.");
  }
}

async function tableChecks(): Promise<TableCheck[]> {
  const pool = getPool();
  const result = await pool.query<{ table_name: string; present: boolean }>(
    `select table_name, to_regclass('public.' || table_name) is not null as present
     from unnest($1::text[]) as required(table_name)
     order by table_name`,
    [REQUIRED_TABLES],
  );
  return result.rows.map((row) => ({
    table: row.table_name,
    present: row.present,
  }));
}

async function seedRows(): Promise<SeedRow[]> {
  const pool = getPool();
  const result = await pool.query<{
    walk_map_id: string;
    source_count: string | number;
    stop_count: string | number;
    publish_mode: string;
  }>(
    `select
       m.walk_map_id,
       jsonb_array_length(m.source_references) as source_count,
       count(s.stop_id)::int as stop_count,
       m.publish_mode
     from municipal_walk_maps m
     left join municipal_walk_map_stops s on s.walk_map_id = m.walk_map_id
     where m.walk_map_id like 'jp-shizuoka-%sample-v0'
     group by m.walk_map_id, m.source_references, m.publish_mode
     order by m.walk_map_id`,
  );
  return result.rows.map((row) => ({
    walk_map_id: row.walk_map_id,
    source_count: Number(row.source_count) || 0,
    stop_count: Number(row.stop_count) || 0,
    publish_mode: row.publish_mode,
  }));
}

async function creatorReady(): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ ok: boolean }>(
    `select exists(
       select 1
       from municipal_walk_map_creators
       where creator_id = 'municipality:shizuoka-city'
         and registration_kind = 'municipality'
         and verification_status = 'verified'
         and commercial_intent = 'none'
     ) as ok`,
  );
  return Boolean(result.rows[0]?.ok);
}

async function main(): Promise<void> {
  assertDatabaseUrl();
  const pool = getPool();
  try {
    await pool.query("select 1");
    const tables = await tableChecks();
    const missingTables = tables.filter((table) => !table.present).map((table) => table.table);
    if (missingTables.length > 0) {
      throw new Error(`municipal_walk_map_tables_missing:${missingTables.join(",")}`);
    }

    const [samples, creatorOk, reviewQueue] = await Promise.all([
      seedRows(),
      creatorReady(),
      listMunicipalWalkMapReviewQueueV0(pool as unknown as MunicipalWalkMapDbPoolLike),
    ]);
    const missingSampleEvidence = samples.filter((row) => row.source_count < 1 || row.stop_count < 1);
    const shizuokaReviewItems = reviewQueue.filter((item) => item.walkMapId.startsWith("jp-shizuoka-"));
    const ok = samples.length >= 3 && creatorOk && missingSampleEvidence.length === 0 && shizuokaReviewItems.length >= 3;
    const report = {
      ok,
      tables,
      creatorOk,
      samples,
      reviewQueueCount: reviewQueue.length,
      shizuokaReviewQueueCount: shizuokaReviewItems.length,
    };
    if (!ok) {
      throw new Error(`municipal_walk_map_db_not_ready:${JSON.stringify(report)}`);
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.end();
  }
}

void main();
