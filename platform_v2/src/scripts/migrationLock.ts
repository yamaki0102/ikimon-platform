export const MIGRATION_ADVISORY_LOCK_KEY = "ikimon-platform-schema-migrations";

export interface MigrationLockClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  release(error?: Error): void;
}

export interface MigrationLockPool {
  connect(): Promise<MigrationLockClient>;
}

/** Hold one PostgreSQL session lock across discovery, migration, and bookkeeping. */
export async function withMigrationLock<T>(
  pool: MigrationLockPool,
  run: (client: MigrationLockClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let locked = false;
  let releaseError: Error | undefined;
  try {
    try {
      await client.query("select pg_advisory_lock(hashtext($1))", [MIGRATION_ADVISORY_LOCK_KEY]);
    } catch (error) {
      releaseError = error instanceof Error ? error : new Error("Failed to acquire migration advisory lock.");
      throw error;
    }
    locked = true;
    return await run(client);
  } finally {
    try {
      if (locked) {
        try {
          await client.query("select pg_advisory_unlock(hashtext($1))", [MIGRATION_ADVISORY_LOCK_KEY]);
        } catch (error) {
          releaseError = error instanceof Error ? error : new Error("Failed to release migration advisory lock.");
          throw error;
        }
      }
    } finally {
      client.release(releaseError);
    }
  }
}
