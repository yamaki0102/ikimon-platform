import type { Pool, PoolClient, QueryResultRow } from "pg";
import type {
  AiUsagePostgresClient,
  AiUsagePostgresPool,
} from "./aiUsagePostgresRepository.js";

function wrapClient(client: PoolClient): AiUsagePostgresClient {
  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      params: readonly unknown[] = [],
    ): Promise<{ rows: T[]; rowCount?: number | null }> {
      const result = await client.query<QueryResultRow>(sql, [...params]);
      return { rows: result.rows as T[], rowCount: result.rowCount };
    },
    release(): void {
      client.release();
    },
  };
}

/**
 * Type-safe bridge from the repository's minimal transaction interface to pg.
 * Creating this adapter does not wire it into runtime call sites.
 */
export function adaptPgPoolForAiUsage(pool: Pool): AiUsagePostgresPool {
  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      params: readonly unknown[] = [],
    ): Promise<{ rows: T[]; rowCount?: number | null }> {
      const result = await pool.query<QueryResultRow>(sql, [...params]);
      return { rows: result.rows as T[], rowCount: result.rowCount };
    },
    async connect(): Promise<AiUsagePostgresClient> {
      return wrapClient(await pool.connect());
    },
  };
}
