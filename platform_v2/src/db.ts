import { Pool } from "pg";
import { loadConfig } from "./config.js";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const config = loadConfig();
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  pool = new Pool({
    connectionString: config.databaseUrl,
    application_name: "ikimon-platform-v2",
  });

  return pool;
}

export async function checkDatabase(): Promise<{ ok: boolean; now?: string; error?: string }> {
  try {
    const client = await getPool().connect();
    try {
      const result = await client.query<{ now: string }>("select now()::text as now");
      return { ok: true, now: result.rows[0]?.now };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown_db_error",
    };
  }
}
