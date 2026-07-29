export type MigrationTransactionClient = {
  query(queryText: string, values?: unknown[]): Promise<unknown>;
};

export type PendingMigration = {
  filename: string;
  checksum: string;
  sql: string;
};

const OWNER_SENSITIVE_APPROVAL = /owner-sensitive-ok:\s*.{12,}/i;

function isOwnerPrivilegeError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "42501",
  );
}

export async function applyMigrationTransaction(
  client: MigrationTransactionClient,
  migration: PendingMigration,
): Promise<void> {
  try {
    await client.query("begin");
    await client.query(migration.sql);
    await client.query(
      "insert into schema_migrations (filename, checksum) values ($1, $2)",
      [migration.filename, migration.checksum],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    if (OWNER_SENSITIVE_APPROVAL.test(migration.sql) && isOwnerPrivilegeError(error)) {
      throw new Error(
        `Owner-sensitive migration blocked for ${migration.filename}: database role lacks object ownership or required privileges. The transaction was rolled back and the migration was not recorded as applied. Repair object ownership or run with the approved migration role before retrying.`,
        { cause: error },
      );
    }
    throw error;
  }
}
