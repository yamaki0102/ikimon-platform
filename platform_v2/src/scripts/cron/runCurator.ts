// Biodiversity Freshness OS: Node-owned curator dispatcher.
//
// Sprint 7 v2.2 removes CMA/Sonnet agent execution from this path. Node owns
// source fetch, snapshot checks, deterministic validation, SQL generation, and
// receiver submission. LLM providers are used only for structured extraction.

import { randomUUID } from "node:crypto";
import { getPool } from "../../db.js";
import { CURATOR_DEFAULT_MODEL } from "../../services/aiModelPricing.js";
import { runInvasiveLawCurator } from "./curators/invasive-law.js";
import {
  cancelledResult,
  type CuratorName,
  type CuratorWorkflowResult,
  type ReceiverCredentials,
} from "./curators/types.js";

const VALID_CURATORS: CuratorName[] = ["invasive-law", "redlist", "paper-research", "satellite-update"];

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

function receiverFromEnv(): ReceiverCredentials | null {
  const url = process.env.CURATOR_RECEIVER_URL?.trim();
  const secret = process.env.CURATOR_RECEIVER_SECRET?.trim();
  return url && secret ? { url, secret } : null;
}

async function openRunRecord(curator: CuratorName, inputSnapshotIds: string[], dryRun: boolean): Promise<string> {
  const pool = getPool();
  const runId = randomUUID();
  const meta = {
    trigger: "systemd_timer",
    receiver_configured: Boolean(process.env.CURATOR_RECEIVER_URL?.trim() && process.env.CURATOR_RECEIVER_SECRET?.trim()),
    prompt_version: "v7-gemini-node",
    curator_model_default: CURATOR_DEFAULT_MODEL,
  };
  await pool.query(
    `INSERT INTO ai_curator_runs (
       run_id, curator_name, started_at, status, input_snapshot_ids, dry_run, metadata
     ) VALUES ($1::uuid, $2, NOW(), 'running', $3::uuid[], $4, $5::jsonb)`,
    [runId, curator, inputSnapshotIds, dryRun, JSON.stringify(meta)],
  );
  return runId;
}

async function closeRunRecord(runId: string, result: CuratorWorkflowResult): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE ai_curator_runs
        SET status = $2,
            finished_at = NOW(),
            cma_session_id = NULL,
            cost_jpy = $3,
            cost_usd = $4,
            pr_url = $5,
            error = $6,
            curator_model_provider = $7,
            curator_model_name = $8,
            curator_model_call_count = $9,
            gemini_call_count = $10,
            gemini_skip_reason = $11,
            chunk_count = $12,
            rows_proposed = $13,
            rows_dropped_validation = $14
      WHERE run_id = $1::uuid`,
    [
      runId,
      result.status,
      result.costJpy,
      result.costUsd,
      result.prUrl,
      result.error,
      result.curatorModelProvider,
      result.curatorModelName,
      result.curatorModelCallCount,
      result.geminiCallCount,
      result.geminiSkipReason,
      result.chunkCount,
      result.rowsProposed,
      result.rowsDroppedValidation,
    ],
  );
}

function dryRunResult(): CuratorWorkflowResult {
  return {
    ...cancelledResult("none"),
    status: "success",
    error: null,
    geminiSkipReason: "none",
  };
}

function failureResult(error: unknown): CuratorWorkflowResult {
  const msg = error instanceof Error ? error.message : String(error);
  const reason = msg.includes("source_fetch_failed")
    ? "source_fetch_failed"
    : msg.includes("schema_validation_failed")
      ? "schema_validation_failed_all_chunks"
      : "api_5xx_after_3_retries";
  return {
    ...cancelledResult(reason),
    status: "failed",
    error: msg,
    geminiSkipReason: reason,
  };
}

async function runCuratorWorkflow(
  curator: CuratorName,
  runId: string,
  inputSnapshotIds: string[],
  receiver: ReceiverCredentials | null,
): Promise<CuratorWorkflowResult> {
  if (curator === "invasive-law") {
    return runInvasiveLawCurator({ runId, curator, inputSnapshotIds, receiver });
  }
  return cancelledResult("not_migrated");
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

  try {
    const receiver = receiverFromEnv();
    if (!receiver && !dryRun) {
      // eslint-disable-next-line no-console
      console.warn("[curator] CURATOR_RECEIVER_URL / CURATOR_RECEIVER_SECRET not set; proposal POST is disabled");
    }
    const result = dryRun
      ? dryRunResult()
      : await runCuratorWorkflow(curator, runId, inputSnapshotIds, receiver);
    await closeRunRecord(runId, result);
    // eslint-disable-next-line no-console
    console.log(
      `[curator] ${curator} ${result.status} provider=${result.curatorModelProvider} model=${result.curatorModelName ?? "none"} calls=${result.curatorModelCallCount} rows=${result.rowsProposed} cost_usd=${result.costUsd.toFixed(6)}`,
    );
    if (result.status === "failed") {
      process.exitCode = 1;
    }
  } catch (error) {
    const result = failureResult(error);
    await closeRunRecord(runId, result);
    throw error;
  } finally {
    await getPool().end().catch(() => undefined);
  }
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[curator] failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
