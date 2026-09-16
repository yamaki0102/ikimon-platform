// IKIMON DB MCP tool implementation library.
//
// The only runtime entrypoint is src/index.ts, which creates a fresh MCP SDK
// v2 server and serves it through the stdio transport. This module contains
// the allowlisted database and proposal operations used by those tools.

import { readFile, mkdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

type AgentId = "invasive-law" | "redlist" | "paper-research" | "satellite-update";

type AgentPermission = {
  read: string[];
  write_proposal: string[];
  write_direct: string[];
  constraints?: Record<string, unknown>;
};

type PermissionDoc = {
  agents: Record<AgentId, AgentPermission>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PERMISSIONS_PATH = path.resolve(__dirname, "../permissions.json");
const PROPOSALS_DIR = path.resolve(__dirname, "../out/proposals");

let permissionsCache: PermissionDoc | null = null;

async function loadPermissions(): Promise<PermissionDoc> {
  if (permissionsCache) return permissionsCache;
  const raw = await readFile(PERMISSIONS_PATH, "utf8");
  permissionsCache = JSON.parse(raw) as PermissionDoc;
  return permissionsCache;
}

async function assertCanRead(agentId: AgentId, table: string): Promise<void> {
  const perms = (await loadPermissions()).agents[agentId];
  if (!perms.read.includes(table)) {
    throw new Error(`agent ${agentId} is not allowed to read ${table}`);
  }
}

async function assertCanProposeWrite(agentId: AgentId, table: string): Promise<void> {
  const perms = (await loadPermissions()).agents[agentId];
  if (!perms.write_proposal.includes(table)) {
    throw new Error(`agent ${agentId} is not allowed to propose writes to ${table}`);
  }
}

async function assertCanWriteDirect(agentId: AgentId, table: string): Promise<void> {
  const perms = (await loadPermissions()).agents[agentId];
  if (!perms.write_direct.includes(table)) {
    throw new Error(`agent ${agentId} is not allowed to write directly to ${table}`);
  }
}

// ---------- Tool: query_readonly ----------

export type QueryReadonlyInput = {
  table: string;
  columns?: string[];
  where?: Record<string, string | number | boolean | null>;
  limit?: number;
};

export async function queryReadonly(
  pool: Pool,
  agentId: AgentId,
  input: QueryReadonlyInput,
): Promise<unknown[]> {
  await assertCanRead(agentId, input.table);
  const cols = (input.columns && input.columns.length > 0 ? input.columns : ["*"])
    .map((c) => (c === "*" ? "*" : `"${c.replace(/[^a-zA-Z0-9_]/g, "")}"`))
    .join(", ");
  const params: Array<string | number | boolean | null> = [];
  const conds: string[] = [];
  for (const [key, value] of Object.entries(input.where ?? {})) {
    const sanitized = key.replace(/[^a-zA-Z0-9_]/g, "");
    params.push(value);
    conds.push(`"${sanitized}" = $${params.length}`);
  }
  const whereClause = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(1, Math.floor(input.limit ?? 100)), 1000);
  const safeTable = input.table.replace(/[^a-zA-Z0-9_]/g, "");
  const sql = `SELECT ${cols} FROM "${safeTable}" ${whereClause} LIMIT ${limit}`;
  const result = await pool.query(sql, params);
  return result.rows;
}

// ---------- Tool: propose_write ----------

export type ProposeWriteInput = {
  runId: string;
  table: string;
  changeType: "insert" | "update" | "version_close";
  rows: Array<Record<string, string | number | boolean | null>>;
  rationale: string;
};

function applyConstraints(
  agentPerms: AgentPermission,
  table: string,
  row: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const out = { ...row };
  const constraints = agentPerms.constraints ?? {};
  for (const [key, expected] of Object.entries(constraints)) {
    const [tbl, col] = key.split(".");
    if (tbl !== table) continue;
    if (col === "claim_text" || col === "citation_span") continue;
    if (col && (typeof expected === "string" || typeof expected === "boolean" || typeof expected === "number")) {
      out[col] = expected;
    }
  }
  const claimMaxLen = (constraints["knowledge_claims.claim_text.maxLength"] as number | undefined) ?? null;
  if (table === "knowledge_claims" && typeof out.claim_text === "string" && claimMaxLen !== null) {
    if (out.claim_text.length > claimMaxLen) {
      throw new Error(`claim_text exceeds maxLength=${claimMaxLen}`);
    }
  }
  const citationMaxLen = (constraints["knowledge_claims.citation_span.maxLength"] as number | undefined) ?? null;
  if (table === "knowledge_claims" && typeof out.citation_span === "string" && citationMaxLen !== null) {
    if (out.citation_span.length > citationMaxLen) {
      throw new Error(`citation_span exceeds maxLength=${citationMaxLen}`);
    }
  }
  return out;
}

function escapeSqlLiteral(value: string | number | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function proposeWrite(
  agentId: AgentId,
  input: ProposeWriteInput,
): Promise<{ proposalPath: string; rowCount: number }> {
  const perms = (await loadPermissions()).agents[agentId];
  await assertCanProposeWrite(agentId, input.table);

  const enforcedRows = input.rows.map((row) => applyConstraints(perms, input.table, row));

  if (!existsSync(PROPOSALS_DIR)) {
    await mkdir(PROPOSALS_DIR, { recursive: true });
  }
  const safeTable = input.table.replace(/[^a-zA-Z0-9_]/g, "");
  const proposalPath = path.join(PROPOSALS_DIR, `${input.runId}.sql`);

  const header = `-- agent: ${agentId}\n-- run_id: ${input.runId}\n-- change_type: ${input.changeType}\n-- table: ${safeTable}\n-- rationale: ${input.rationale.replace(/\n/g, " ")}\n`;
  const stmts = enforcedRows.map((row) => {
    const cols = Object.keys(row);
    const colList = cols.map((c) => `"${c.replace(/[^a-zA-Z0-9_]/g, "")}"`).join(", ");
    const valList = cols.map((c) => escapeSqlLiteral(row[c]!)).join(", ");
    if (input.changeType === "insert" || input.changeType === "version_close") {
      return `INSERT INTO "${safeTable}" (${colList}) VALUES (${valList});`;
    }
    const keyCol = cols.find((c) => c.endsWith("_id")) ?? cols[0];
    if (!keyCol) throw new Error(`update proposal needs a key column for ${safeTable}`);
    const sets = cols
      .filter((c) => c !== keyCol)
      .map((c) => `"${c.replace(/[^a-zA-Z0-9_]/g, "")}" = ${escapeSqlLiteral(row[c]!)}`)
      .join(", ");
    return `UPDATE "${safeTable}" SET ${sets} WHERE "${keyCol.replace(/[^a-zA-Z0-9_]/g, "")}" = ${escapeSqlLiteral(row[keyCol]!)};`;
  });

  const sqlBody = `${header}\n${stmts.join("\n")}\n`;
  await appendFile(proposalPath, sqlBody, "utf8");
  return { proposalPath, rowCount: enforcedRows.length };
}

// ---------- Tool: schema_introspect ----------

export async function schemaIntrospect(
  pool: Pool,
  agentId: AgentId,
  table: string,
): Promise<unknown[]> {
  await assertCanRead(agentId, table);
  const safeTable = table.replace(/[^a-zA-Z0-9_]/g, "");
  const result = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [safeTable],
  );
  return result.rows;
}

// ---------- Tool: record_run_status ----------

export type RecordRunStatusInput = {
  runId: string;
  status: "running" | "success" | "partial" | "failed" | "cancelled";
  costJpy?: number;
  costUsd?: number;
  prUrl?: string | null;
  error?: string | null;
};

export async function recordRunStatus(
  pool: Pool,
  agentId: AgentId,
  input: RecordRunStatusInput,
): Promise<void> {
  await assertCanWriteDirect(agentId, "ai_curator_runs");
  await pool.query(
    `UPDATE ai_curator_runs
        SET status = $2, finished_at = NOW(),
            cost_jpy = COALESCE($3, cost_jpy),
            cost_usd = COALESCE($4, cost_usd),
            pr_url = COALESCE($5, pr_url),
            error = $6
      WHERE run_id = $1`,
    [input.runId, input.status, input.costJpy ?? null, input.costUsd ?? null, input.prUrl ?? null, input.error ?? null],
  );
}

// ---------- Tool: register_snapshot ----------

export type RegisterSnapshotInput = {
  sourceKind: string;
  sourceUrl: string;
  contentSha256: string;
  contentBytes: number;
  storagePath: string;
  license: string;
  curatorRunId: string;
  httpEtag?: string | null;
  httpLastMod?: string | null;
};

export async function registerSnapshot(
  pool: Pool,
  agentId: AgentId,
  input: RegisterSnapshotInput,
): Promise<{ snapshotId: string; deduplicated: boolean }> {
  await assertCanProposeWrite(agentId, "source_snapshots");
  const result = await pool.query<{ snapshot_id: string; existed: boolean }>(
    `WITH ins AS (
       INSERT INTO source_snapshots (
         source_kind, source_url, http_etag, http_last_mod,
         content_sha256, content_bytes, storage_path, license, curator_run_id
       ) VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8, $9::uuid)
       ON CONFLICT (source_kind, content_sha256) DO NOTHING
       RETURNING snapshot_id, FALSE AS existed
     )
     SELECT * FROM ins
     UNION ALL
     SELECT snapshot_id, TRUE AS existed
       FROM source_snapshots
      WHERE source_kind = $1 AND content_sha256 = $5
      LIMIT 1`,
    [
      input.sourceKind,
      input.sourceUrl,
      input.httpEtag ?? null,
      input.httpLastMod ?? null,
      input.contentSha256,
      input.contentBytes,
      input.storagePath,
      input.license,
      input.curatorRunId,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("register_snapshot returned no row");
  return { snapshotId: row.snapshot_id, deduplicated: row.existed };
}
