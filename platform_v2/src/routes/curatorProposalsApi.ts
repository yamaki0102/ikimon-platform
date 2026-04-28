// Sprint 6/7: /api/internal/agent-proposals — receives curator proposals
// and turns them into PRs against ikimon-platform.
//
// Auth: X-Curator-Secret header timing-safe compared with
// process.env.CURATOR_RECEIVER_SECRET. LLMs never see GitHub credentials or
// receiver secrets; the VPS holds GH_TOKEN and uses it server-side.

import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import {
  receiveProposal,
  type CuratorName,
  type ProposalSubmission,
} from "../services/curatorProposalReceiver.js";

type RequestBody = {
  run_id?: string;
  curator_name?: string;
  proposal_kind?: string;
  title?: string;
  summary?: string;
  sql_content?: string;
  rationale?: string;
  // v6 telemetry from the retired Sonnet/DeepSeek curator path
  deepseek_call_count?: number | string;
  deepseek_skip_reason?: string;
  // v7 telemetry from Node-owned Gemini/DeepSeek dispatcher
  curator_model_provider?: string;
  curator_model_name?: string;
  curator_model_call_count?: number | string;
  gemini_call_count?: number | string;
  gemini_skip_reason?: string;
  chunk_count?: number | string;
  rows_proposed?: number | string;
  rows_dropped_validation?: number | string;
};

const VALID_DEEPSEEK_SKIP_REASONS = new Set([
  "none",
  "key_empty",
  "api_5xx_after_3_retries",
  "all_chunks_under_1k_chars",
  "no_papers_above_threshold",
]);

const VALID_GEMINI_SKIP_REASONS = new Set([
  "none",
  "not_migrated",
  "budget_cap",
  "source_unchanged",
  "source_fetch_failed",
  "all_chunks_under_1k_chars",
  "no_papers_above_threshold",
  "api_5xx_after_3_retries",
  "schema_validation_failed_all_chunks",
  "receiver_not_configured",
  "model_bakeoff_required",
]);

const VALID_MODEL_PROVIDERS = new Set(["gemini", "deepseek", "none"]);

type ReceiverTelemetry = {
  deepseekCallCount: number | null;
  deepseekSkipReason: string | null;
  curatorModelProvider: string | null;
  curatorModelName: string | null;
  curatorModelCallCount: number | null;
  geminiCallCount: number | null;
  geminiSkipReason: string | null;
  chunkCount: number | null;
  rowsProposed: number | null;
  rowsDroppedValidation: number | null;
};

async function recordReceiverOutcome(
  runId: string,
  curatorName: string,
  responseStatus: number,
  responseBody: string,
  prUrl: string | null,
  telemetry: ReceiverTelemetry,
): Promise<void> {
  try {
    const pool = getPool();
    // Upsert pattern: row may not exist yet (manual wet-run) — create with
    // wet_run_marker=TRUE so the dashboard can distinguish manual QA from
    // systemd-driven runs. attempt_no increments per receiver POST per run_id.
    await pool.query(
      `INSERT INTO ai_curator_runs (
         run_id, curator_name, started_at, status, dry_run,
         attempt_no, receiver_response_status, receiver_response_body,
         wet_run_marker, deepseek_call_count, deepseek_skip_reason,
         curator_model_provider, curator_model_name, curator_model_call_count,
         gemini_call_count, gemini_skip_reason, chunk_count,
         rows_proposed, rows_dropped_validation,
         pr_url, finished_at, metadata
       ) VALUES (
         $1::uuid, $2, NOW(),
         CASE WHEN $3 BETWEEN 200 AND 299 THEN 'success' ELSE 'failed' END,
         FALSE, 1, $3, $4, TRUE, $5, $6,
         $7, $8, $9, $10, $11, $12, $13, $14,
         $15, NOW(),
         '{"trigger":"receiver_post","prompt_version":"v7-gemini-node"}'::jsonb
       )
       ON CONFLICT (run_id) DO UPDATE SET
         attempt_no               = ai_curator_runs.attempt_no + 1,
         receiver_response_status = EXCLUDED.receiver_response_status,
         receiver_response_body   = EXCLUDED.receiver_response_body,
         deepseek_call_count      = EXCLUDED.deepseek_call_count,
         deepseek_skip_reason     = EXCLUDED.deepseek_skip_reason,
         curator_model_provider   = EXCLUDED.curator_model_provider,
         curator_model_name       = EXCLUDED.curator_model_name,
         curator_model_call_count = EXCLUDED.curator_model_call_count,
         gemini_call_count        = EXCLUDED.gemini_call_count,
         gemini_skip_reason       = EXCLUDED.gemini_skip_reason,
         chunk_count              = EXCLUDED.chunk_count,
         rows_proposed            = EXCLUDED.rows_proposed,
         rows_dropped_validation  = EXCLUDED.rows_dropped_validation,
         pr_url                   = COALESCE(EXCLUDED.pr_url, ai_curator_runs.pr_url),
         status                   = EXCLUDED.status,
         finished_at              = NOW()`,
      [
        runId,
        curatorName,
        responseStatus,
        responseBody.slice(0, 600),
        telemetry.deepseekCallCount,
        telemetry.deepseekSkipReason,
        telemetry.curatorModelProvider,
        telemetry.curatorModelName,
        telemetry.curatorModelCallCount,
        telemetry.geminiCallCount,
        telemetry.geminiSkipReason,
        telemetry.chunkCount,
        telemetry.rowsProposed,
        telemetry.rowsDroppedValidation,
        prUrl,
      ],
    );
  } catch (err) {
    // Telemetry failures must never block the receiver path.
    // eslint-disable-next-line no-console
    console.warn("[curator-proposals] telemetry write failed:", err instanceof Error ? err.message : String(err));
  }
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

function asString(value: unknown, max = 50_000): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number.parseInt(value.trim(), 10);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }
  return null;
}

export async function registerCuratorProposalsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: RequestBody;
    Headers: { "x-curator-secret"?: string };
  }>("/api/internal/agent-proposals", async (request, reply) => {
    const expectedSecret = process.env.CURATOR_RECEIVER_SECRET?.trim();
    if (!expectedSecret) {
      reply.code(503);
      return { ok: false, error: "CURATOR_RECEIVER_SECRET env not configured on server" };
    }

    const headerSecret = request.headers["x-curator-secret"];
    const providedSecret = typeof headerSecret === "string" ? headerSecret : "";
    if (!timingSafeStringEqual(providedSecret, expectedSecret)) {
      reply.code(401);
      return { ok: false, error: "invalid X-Curator-Secret header" };
    }

    const body = request.body ?? {};
    const runId = asString(body.run_id, 64);
    const curatorName = asString(body.curator_name, 64);
    const proposalKind = asString(body.proposal_kind, 64);
    const title = asString(body.title, 200);
    const summary = asString(body.summary, 4_000);
    const sqlContent = asString(body.sql_content, 200_000);
    const rationale = asString(body.rationale, 4_000);

    if (!runId || !curatorName || !sqlContent) {
      reply.code(400);
      return { ok: false, error: "run_id, curator_name, sql_content are required" };
    }
    if (proposalKind !== "migration_sql" && proposalKind !== "claim_paraphrase") {
      reply.code(400);
      return { ok: false, error: "proposal_kind must be migration_sql or claim_paraphrase" };
    }

    const submission: ProposalSubmission = {
      runId,
      curatorName: curatorName as CuratorName,
      proposalKind: proposalKind as "migration_sql" | "claim_paraphrase",
      title,
      summary,
      sqlContent,
      rationale,
    };

    // Telemetry — accept either number or numeric string from curator.
    const deepseekCallCount = parseNonNegativeInt(body.deepseek_call_count);
    const rawSkip = typeof body.deepseek_skip_reason === "string" ? body.deepseek_skip_reason.trim() : "";
    const deepseekSkipReason = VALID_DEEPSEEK_SKIP_REASONS.has(rawSkip) ? rawSkip : null;
    const rawProvider = typeof body.curator_model_provider === "string" ? body.curator_model_provider.trim() : "";
    const curatorModelProvider = VALID_MODEL_PROVIDERS.has(rawProvider) ? rawProvider : null;
    const curatorModelName = asString(body.curator_model_name, 120) || null;
    const rawGeminiSkip = typeof body.gemini_skip_reason === "string" ? body.gemini_skip_reason.trim() : "";
    const geminiSkipReason = VALID_GEMINI_SKIP_REASONS.has(rawGeminiSkip) ? rawGeminiSkip : null;
    const telemetry: ReceiverTelemetry = {
      deepseekCallCount,
      deepseekSkipReason,
      curatorModelProvider,
      curatorModelName,
      curatorModelCallCount: parseNonNegativeInt(body.curator_model_call_count),
      geminiCallCount: parseNonNegativeInt(body.gemini_call_count),
      geminiSkipReason,
      chunkCount: parseNonNegativeInt(body.chunk_count),
      rowsProposed: parseNonNegativeInt(body.rows_proposed),
      rowsDroppedValidation: parseNonNegativeInt(body.rows_dropped_validation),
    };

    try {
      const result = await receiveProposal(submission);
      await recordReceiverOutcome(
        runId,
        curatorName,
        201,
        `pr_url=${result.prUrl ?? "(none)"} migration=${result.migrationFilename}`,
        result.prUrl,
        telemetry,
      );
      reply.code(201);
      return {
        ok: true,
        proposal_path: result.proposalPath,
        pr_url: result.prUrl,
        branch_name: result.branchName,
        migration_filename: result.migrationFilename,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error("[curator-proposals] receive failed:", msg);
      await recordReceiverOutcome(runId, curatorName, 500, msg, null, telemetry);
      reply.code(500);
      return { ok: false, error: msg };
    }
  });
}
