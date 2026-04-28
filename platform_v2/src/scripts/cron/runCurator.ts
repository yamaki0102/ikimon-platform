// Biodiversity Freshness OS: Claude Managed Agents (CMA) curator runner.
//
// Triggers a CMA session for one of the 4 curators (invasive-law / redlist /
// paper-research / satellite-update) and records the run in ai_curator_runs.
// Designed to be invoked from systemd timers on the VPS.
//
// Required env:
//   ANTHROPIC_API_KEY              - Anthropic API key with CMA beta access
//   ANTHROPIC_CMA_AGENT_<NAME>_ID  - Agent ID created in CMA console (per curator)
//   CURATOR_NAME                   - invasive-law | redlist | paper-research | satellite-update
//   DATABASE_URL                   - Postgres connection string
//
// Optional env:
//   ANTHROPIC_CMA_BETA_HEADER      - default "managed-agents-2026-04-01"
//   ANTHROPIC_CMA_BASE_URL         - default https://api.anthropic.com
//   CURATOR_DRY_RUN                - "1" to skip CMA HTTP calls, useful for
//                                    smoke tests
//   CURATOR_INPUT_SNAPSHOT_IDS     - comma-separated UUIDs to seed the run
//
// Usage:
//   CURATOR_NAME=invasive-law node dist/scripts/cron/runCurator.js
//   CURATOR_NAME=invasive-law CURATOR_DRY_RUN=1 tsx src/scripts/cron/runCurator.ts

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../../db.js";

type CuratorName = "invasive-law" | "redlist" | "paper-research" | "satellite-update";

const VALID_CURATORS: CuratorName[] = ["invasive-law", "redlist", "paper-research", "satellite-update"];

type CmaSessionResponse = {
  // CMA β returns "id"; older drafts of the spec used "session_id" — accept both.
  id?: string;
  session_id?: string;
  agent_id?: string;
  status?: string;
  outcome?: { summary?: string; cost_jpy?: number; cost_usd?: number };
  events?: Array<{ event_id: string; type: string; payload?: unknown }>;
};

function sessionIdOf(session: CmaSessionResponse): string {
  return session.id ?? session.session_id ?? "";
}

function parseCuratorName(): CuratorName {
  const raw = process.env.CURATOR_NAME?.trim();
  if (!raw) throw new Error("CURATOR_NAME env var is required");
  if (!(VALID_CURATORS as string[]).includes(raw)) {
    throw new Error(`Unknown CURATOR_NAME: ${raw}. Must be one of: ${VALID_CURATORS.join(", ")}`);
  }
  return raw as CuratorName;
}

function isDryRun(): boolean {
  const raw = process.env.CURATOR_DRY_RUN?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parseInputSnapshotIds(): string[] {
  const raw = process.env.CURATOR_INPUT_SNAPSHOT_IDS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function getAgentIdFor(curator: CuratorName): string | null {
  const envKey = `ANTHROPIC_CMA_AGENT_${curator.replace(/-/g, "_").toUpperCase()}_ID`;
  return process.env[envKey]?.trim() || null;
}

async function loadCuratorPrompt(curator: CuratorName): Promise<string> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const promptPath = path.resolve(
    __dirname,
    "../../../mcp_servers/curators",
    `${curator}-curator.md`,
  );
  return readFile(promptPath, "utf8");
}

async function openRunRecord(curator: CuratorName, inputSnapshotIds: string[], dryRun: boolean): Promise<string> {
  const pool = getPool();
  const runId = randomUUID();
  await pool.query(
    `INSERT INTO ai_curator_runs (
       run_id, curator_name, started_at, status, input_snapshot_ids, dry_run, metadata
     ) VALUES ($1::uuid, $2, NOW(), 'running', $3::uuid[], $4, $5::jsonb)`,
    [runId, curator, inputSnapshotIds, dryRun, JSON.stringify({ trigger: "systemd_timer" })],
  );
  return runId;
}

async function closeRunRecord(
  runId: string,
  status: "success" | "partial" | "failed" | "cancelled",
  costJpy: number,
  costUsd: number,
  cmaSessionId: string | null,
  prUrl: string | null,
  error: string | null,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE ai_curator_runs
        SET status = $2,
            finished_at = NOW(),
            cma_session_id = $3,
            cost_jpy = $4,
            cost_usd = $5,
            pr_url = $6,
            error = $7
      WHERE run_id = $1::uuid`,
    [runId, status, cmaSessionId, costJpy, costUsd, prUrl, error],
  );
}

type ReceiverCredentials = {
  url: string;
  secret: string;
};

async function callManagedAgents(
  agentId: string,
  systemPrompt: string,
  inputSnapshotIds: string[],
  curatorName: string,
  runId: string,
  receiver: ReceiverCredentials | null,
): Promise<CmaSessionResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required (CMA beta)");
  const environmentId = process.env.ANTHROPIC_CMA_ENVIRONMENT_ID?.trim();
  if (!environmentId) throw new Error("ANTHROPIC_CMA_ENVIRONMENT_ID is required (CMA beta)");
  const baseUrl = process.env.ANTHROPIC_CMA_BASE_URL?.trim() || "https://api.anthropic.com";
  const betaHeader = process.env.ANTHROPIC_CMA_BETA_HEADER?.trim() || "managed-agents-2026-04-01";

  // CMA β session shape (per console spec 2026-04-28):
  //   POST /v1/sessions  { environment_id, agent: { type: "agent", id } }
  //   POST /v1/sessions/<session_id>/events  { type, content }
  // Sessions are created without an initial message; the curator's first
  // task is sent as a separate "message" event right after creation.
  const sessionRes = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": betaHeader,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      environment_id: environmentId,
      agent: { type: "agent", id: agentId },
    }),
  });
  if (!sessionRes.ok) {
    const body = await sessionRes.text().catch(() => "<no body>");
    throw new Error(`CMA session create failed: ${sessionRes.status} ${sessionRes.statusText} :: ${body.slice(0, 400)}`);
  }
  const session = (await sessionRes.json()) as CmaSessionResponse;

  const sid = sessionIdOf(session);

  // Initial event payload. Includes per-run identifiers, receiver creds,
  // and (optionally) the DeepSeek API key so the agent can offload bulk
  // text-to-text work to DeepSeek V4 Flash. The GitHub PAT never appears
  // in this payload — that token lives on the VPS only.
  const receiverBlock = receiver
    ? `receiver_url: ${receiver.url}\nreceiver_secret: ${receiver.secret}\n`
    : `receiver_url: (not configured — proposal submission disabled, log only)\n`;

  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const deepseekModel = process.env.PROFILE_DIGEST_MODEL?.trim() || "deepseek-v4-flash";
  const deepseekBlock = deepseekKey
    ? `deepseek_api_key: ${deepseekKey}\ndeepseek_model: ${deepseekModel}\n`
    : `deepseek_api_key: (not configured — orchestrator does all the work itself)\n`;

  const taskText =
    `[scheduled-run]\n` +
    `curator: ${curatorName}\n` +
    `run_id: ${runId}\n` +
    `${receiverBlock}` +
    `${deepseekBlock}` +
    `input_snapshot_ids: ${inputSnapshotIds.join(",") || "(none)"}\n` +
    `\n` +
    `Follow the workflow in your system prompt. Use DeepSeek for bulk parsing if a key is provided. ` +
    `Submit the proposed migration SQL to the receiver via POST (X-Curator-Secret header). ` +
    `Never include any secret in the proposal body. Stop after one POST.\n`;

  // Per CMA β docs (https://platform.claude.com/docs/en/managed-agents/sessions):
  //   POST /v1/sessions/<id>/events
  //   { "events": [{ "type": "user.message", "content": [{"type":"text","text":"..."}] }] }
  // The body wraps a list of events; type uses dot notation (user.message).
  if (sid) {
    const eventRes = await fetch(`${baseUrl}/v1/sessions/${sid}/events`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": betaHeader,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        events: [
          {
            type: "user.message",
            content: [{ type: "text", text: taskText }],
          },
        ],
      }),
    });
    if (!eventRes.ok) {
      const body = await eventRes.text().catch(() => "<no body>");
      // eslint-disable-next-line no-console
      console.warn(
        `[curator] initial event POST failed (session still created): ${eventRes.status} ${body.slice(0, 200)}`,
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(`[curator] initial event delivered (session=${sid})`);
    }
  }

  return session;
}

async function main(): Promise<void> {
  const curator = parseCuratorName();
  const dryRun = isDryRun();
  const inputSnapshotIds = parseInputSnapshotIds();
  const runId = await openRunRecord(curator, inputSnapshotIds, dryRun);

  // eslint-disable-next-line no-console
  console.log(
    `[curator] ${curator} run_id=${runId} dry_run=${dryRun} input_snapshots=${inputSnapshotIds.length}`,
  );

  if (dryRun) {
    await closeRunRecord(runId, "success", 0, 0, null, null, null);
    // eslint-disable-next-line no-console
    console.log(`[curator] ${curator} dry-run complete`);
    await getPool().end().catch(() => undefined);
    return;
  }

  const agentId = getAgentIdFor(curator);
  if (!agentId) {
    const message = `ANTHROPIC_CMA_AGENT_${curator.replace(/-/g, "_").toUpperCase()}_ID not set`;
    await closeRunRecord(runId, "failed", 0, 0, null, null, message);
    throw new Error(message);
  }

  try {
    const systemPrompt = await loadCuratorPrompt(curator);
    const receiverUrl = process.env.CURATOR_RECEIVER_URL?.trim();
    const receiverSecret = process.env.CURATOR_RECEIVER_SECRET?.trim();
    const receiver: ReceiverCredentials | null =
      receiverUrl && receiverSecret ? { url: receiverUrl, secret: receiverSecret } : null;
    if (!receiver) {
      // eslint-disable-next-line no-console
      console.warn(
        "[curator] CURATOR_RECEIVER_URL / CURATOR_RECEIVER_SECRET not set — agent will run but cannot submit proposals",
      );
    }
    const session = await callManagedAgents(
      agentId,
      systemPrompt,
      inputSnapshotIds,
      curator,
      runId,
      receiver,
    );
    const sid = sessionIdOf(session);
    const summary = session.outcome?.summary ?? `session ${sid || "<no-id>"} ${session.status ?? "started"}`;
    const costJpy = Number(session.outcome?.cost_jpy ?? 0);
    const costUsd = Number(session.outcome?.cost_usd ?? 0);
    const finalStatus: "success" | "partial" =
      session.status === "succeeded" ? "success" : "partial";
    await closeRunRecord(runId, finalStatus, costJpy, costUsd, sid || null, null, null);
    // eslint-disable-next-line no-console
    console.log(`[curator] ${curator} ${finalStatus} session=${sid} :: ${summary}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await closeRunRecord(runId, "failed", 0, 0, null, null, msg);
    throw error;
  } finally {
    await getPool().end().catch(() => undefined);
  }
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[curator] failed:", error);
  process.exit(1);
});
