import type { PoolClient } from "pg";
import { getPool } from "../db.js";

type RepairOptions = {
  apply: boolean;
  canonicalUserId: string;
  retiredUserId: string;
  displayName: string;
};

type UserRefColumn = {
  table_name: string;
  column_name: string;
};

type ColumnImpact = {
  tableName: string;
  columnName: string;
  matches: number;
};

function parseArgs(argv: string[]): RepairOptions {
  const options: RepairOptions = {
    apply: false,
    canonicalUserId: "user_69be85c688371",
    retiredUserId: "user_69a01379b962e",
    displayName: "Nats",
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.apply = false;
      continue;
    }
    if (arg.startsWith("--canonical-user-id=")) {
      options.canonicalUserId = arg.slice("--canonical-user-id=".length).trim() || options.canonicalUserId;
      continue;
    }
    if (arg.startsWith("--retired-user-id=")) {
      options.retiredUserId = arg.slice("--retired-user-id=".length).trim() || options.retiredUserId;
      continue;
    }
    if (arg.startsWith("--display-name=")) {
      options.displayName = arg.slice("--display-name=".length).trim() || options.displayName;
    }
  }

  return options;
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

async function discoverUserRefColumns(client: PoolClient): Promise<UserRefColumn[]> {
  const result = await client.query<UserRefColumn>(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name <> 'users'
        and column_name like '%\\_user_id' escape '\\'
      order by table_name, column_name`,
  );
  return result.rows;
}

async function countMatches(client: PoolClient, tableName: string, columnName: string, userId: string): Promise<number> {
  const result = await client.query<{ c: string }>(
    `select count(*)::text as c
       from ${quoteIdent(tableName)}
      where ${quoteIdent(columnName)} = $1`,
    [userId],
  );
  return Number(result.rows[0]?.c ?? 0);
}

async function updateColumnReferences(
  client: PoolClient,
  tableName: string,
  columnName: string,
  canonicalUserId: string,
  retiredUserId: string,
): Promise<number> {
  const result = await client.query<{ c: string }>(
    `with updated_rows as (
       update ${quoteIdent(tableName)}
          set ${quoteIdent(columnName)} = $1
        where ${quoteIdent(columnName)} = $2
        returning 1
     )
     select count(*)::text as c from updated_rows`,
    [canonicalUserId, retiredUserId],
  );
  return Number(result.rows[0]?.c ?? 0);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = getPool();
  const client = await pool.connect();

  try {
    const [userColumns, canonicalUserResult, retiredUserResult] = await Promise.all([
      discoverUserRefColumns(client),
      client.query<{
        user_id: string;
        display_name: string;
        legacy_user_id: string | null;
      }>(
        `select user_id, display_name, legacy_user_id
           from users
          where user_id = $1
          limit 1`,
        [options.canonicalUserId],
      ),
      client.query<{
        user_id: string;
        display_name: string;
        legacy_user_id: string | null;
      }>(
        `select user_id, display_name, legacy_user_id
           from users
          where user_id = $1
          limit 1`,
        [options.retiredUserId],
      ),
    ]);

    if (!canonicalUserResult.rows[0]) {
      throw new Error(`canonical_user_missing:${options.canonicalUserId}`);
    }

    const impacts: ColumnImpact[] = [];
    for (const column of userColumns) {
      const matches = await countMatches(client, column.table_name, column.column_name, options.retiredUserId);
      if (matches > 0) {
        impacts.push({
          tableName: column.table_name,
          columnName: column.column_name,
          matches,
        });
      }
    }

    const summary = {
      dryRun: !options.apply,
      canonicalUserId: options.canonicalUserId,
      retiredUserId: options.retiredUserId,
      canonicalBefore: canonicalUserResult.rows[0] ?? null,
      retiredBefore: retiredUserResult.rows[0] ?? null,
      impactedColumns: impacts,
      updates: {
        displayName: options.apply ? 1 : canonicalUserResult.rows[0]?.display_name === options.displayName ? 0 : 1,
        references: impacts.reduce((sum, item) => sum + item.matches, 0),
        retiredUserDeleted: options.apply && retiredUserResult.rows[0] ? 1 : 0,
      },
    };

    if (!options.apply) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    await client.query("begin");
    try {
      await client.query(
        `update users
            set display_name = $2,
                updated_at = now()
          where user_id = $1`,
        [options.canonicalUserId, options.displayName],
      );

      for (const impact of impacts) {
        await updateColumnReferences(
          client,
          impact.tableName,
          impact.columnName,
          options.canonicalUserId,
          options.retiredUserId,
        );
      }

      await client.query(`delete from users where user_id = $1`, [options.retiredUserId]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    const [canonicalAfter, retiredAfter] = await Promise.all([
      client.query<{
        user_id: string;
        display_name: string;
        legacy_user_id: string | null;
      }>(
        `select user_id, display_name, legacy_user_id
           from users
          where user_id = $1
          limit 1`,
        [options.canonicalUserId],
      ),
      client.query<{
        user_id: string;
      }>(
        `select user_id
           from users
          where user_id = $1
          limit 1`,
        [options.retiredUserId],
      ),
    ]);

    console.log(
      JSON.stringify(
        {
          ...summary,
          dryRun: false,
          canonicalAfter: canonicalAfter.rows[0] ?? null,
          retiredAfter: retiredAfter.rows[0] ?? null,
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
