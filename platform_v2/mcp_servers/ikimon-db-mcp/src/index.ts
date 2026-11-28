import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { Pool } from "pg";
import { z } from "zod";
import {
  proposeWrite,
  queryReadonly,
  recordRunStatus,
  registerSnapshot,
  schemaIntrospect,
} from "./server.js";

const AgentIdSchema = z.enum([
  "invasive-law",
  "redlist",
  "paper-research",
  "satellite-update",
]);

const ScalarSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const TableNameSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/u);

const ColumnNameSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/u);

const RowSchema = z.record(ColumnNameSchema, ScalarSchema);

function requiredAgentId(): z.infer<typeof AgentIdSchema> {
  const raw = process.env.AGENT_ID?.trim();
  if (!raw) {
    throw new Error("AGENT_ID is required");
  }
  return AgentIdSchema.parse(raw);
}

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required");
  }
  return value;
}

function result(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

export function createIkimonDbMcpServer(
  pool: Pool,
  agentId: z.infer<typeof AgentIdSchema>,
): McpServer {
  const server = new McpServer({
    name: "ikimon-db-mcp",
    version: "0.2.0",
  });

  server.registerTool(
    "query_readonly",
    {
      description: "Read rows from one allowlisted table. Identifiers are sanitized, values are parameterized, and the result limit is capped at 1000.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        table: TableNameSchema,
        columns: z.array(ColumnNameSchema).max(100).optional(),
        where: z.record(ColumnNameSchema, ScalarSchema).optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      }),
    },
    async (input) => result(await queryReadonly(pool, agentId, input)),
  );

  server.registerTool(
    "propose_write",
    {
      description: "Create an append-only SQL proposal file for an allowlisted table. This tool never applies the proposal to the database.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({
        runId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/u),
        table: TableNameSchema,
        changeType: z.enum(["insert", "update", "version_close"]),
        rows: z.array(RowSchema).min(1).max(1000),
        rationale: z.string().min(1).max(4000),
      }),
    },
    async (input) => result(await proposeWrite(agentId, input)),
  );

  server.registerTool(
    "schema_introspect",
    {
      description: "Return column metadata for one allowlisted table in the public schema.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({ table: TableNameSchema }),
    },
    async ({ table }) => result(await schemaIntrospect(pool, agentId, table)),
  );

  server.registerTool(
    "record_run_status",
    {
      description: "Update the current curator run status in ai_curator_runs when the active agent has explicit direct-write permission.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        runId: z.uuid(),
        status: z.enum(["running", "success", "partial", "failed", "cancelled"]),
        costJpy: z.number().finite().nonnegative().optional(),
        costUsd: z.number().finite().nonnegative().optional(),
        prUrl: z.url().nullable().optional(),
        error: z.string().max(8000).nullable().optional(),
      }),
    },
    async (input) => {
      await recordRunStatus(pool, agentId, input);
      return result({ recorded: true, runId: input.runId, status: input.status });
    },
  );

  server.registerTool(
    "register_snapshot",
    {
      description: "Register an append-only source snapshot with content-hash deduplication after the active agent passes the source_snapshots allowlist.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        sourceKind: z.string().min(1).max(100),
        sourceUrl: z.url(),
        contentSha256: z.string().regex(/^[a-f0-9]{64}$/u),
        contentBytes: z.number().int().nonnegative(),
        storagePath: z.string().min(1).max(1000),
        license: z.string().min(1).max(500),
        curatorRunId: z.uuid(),
        httpEtag: z.string().max(1000).nullable().optional(),
        httpLastMod: z.iso.datetime({ offset: true }).nullable().optional(),
      }),
    },
    async (input) => result(await registerSnapshot(pool, agentId, input)),
  );

  return server;
}

export async function main(): Promise<void> {
  const agentId = requiredAgentId();
  const pool = new Pool({
    connectionString: requiredDatabaseUrl(),
    application_name: `ikimon-db-mcp/${agentId}`,
  });

  console.error(`[ikimon-db-mcp] agent=${agentId} transport=stdio sdk=v2`);
  try {
    await serveStdio(() => createIkimonDbMcpServer(pool, agentId));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("index.js")) {
  void main().catch((error: unknown) => {
    console.error(
      "[ikimon-db-mcp] startup failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    process.exit(1);
  });
}
