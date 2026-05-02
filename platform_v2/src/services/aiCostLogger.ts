// Biodiversity Freshness OS: ai_cost_log writer + monthly aggregator.
//
// All LLM invocations across Hot / Warm / Cold layers MUST go through
// aiCostLogger.log() so that aiBudgetGate can enforce the monthly cap.

import { getPool } from "../db.js";

export type AiCostLayer = "hot" | "warm" | "cold";
export type AiCostProvider = "gemini" | "claude" | "deepseek" | "openai" | "other";

export type AiCostLogEntry = {
  layer: AiCostLayer;
  endpoint: string;
  provider: AiCostProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  costJpy?: number;
  userId?: string | null;
  visitId?: string | null;
  occurrenceId?: string | null;
  agentRunId?: string | null;
  cacheKey?: string | null;
  escalated?: boolean;
  cacheHit?: boolean;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
};

export type MonthlyCostSummary = {
  layer: AiCostLayer | "all";
  monthStart: string;
  totalCostJpy: number;
  totalCostUsd: number;
  callCount: number;
  cacheHits: number;
  escalations: number;
};

const DEFAULT_JPY_PER_USD = 150;

function safeNonNegativeInt(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function safeNonNegativeNumber(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function deriveCostJpy(costUsd: number, costJpy: number | undefined, jpyPerUsd: number): number {
  if (typeof costJpy === "number" && Number.isFinite(costJpy) && costJpy >= 0) {
    return costJpy;
  }
  return Number((costUsd * jpyPerUsd).toFixed(4));
}

export async function logAiCost(entry: AiCostLogEntry, jpyPerUsd: number = DEFAULT_JPY_PER_USD): Promise<void> {
  const pool = getPool();
  const inputTokens = safeNonNegativeInt(entry.inputTokens);
  const outputTokens = safeNonNegativeInt(entry.outputTokens);
  const costUsd = safeNonNegativeNumber(entry.costUsd);
  const costJpy = deriveCostJpy(costUsd, entry.costJpy, jpyPerUsd);
  const latencyMs = entry.latencyMs !== undefined ? safeNonNegativeInt(entry.latencyMs) : null;

  await pool.query(
    `INSERT INTO ai_cost_log (
       layer, endpoint, provider, model,
       input_tokens, output_tokens, cost_usd, cost_jpy,
       user_id, visit_id, occurrence_id, agent_run_id,
       cache_key, escalated, cache_hit, latency_ms, metadata
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11, $12,
       $13, $14, $15, $16, $17::jsonb
     )`,
    [
      entry.layer,
      entry.endpoint,
      entry.provider,
      entry.model,
      inputTokens,
      outputTokens,
      costUsd,
      costJpy,
      entry.userId ?? null,
      entry.visitId ?? null,
      entry.occurrenceId ?? null,
      entry.agentRunId ?? null,
      entry.cacheKey ?? null,
      entry.escalated ?? false,
      entry.cacheHit ?? false,
      latencyMs,
      JSON.stringify(entry.metadata ?? {}),
    ]
  );
}

export async function summarizeMonthlyCost(layer: AiCostLayer | "all" = "all", monthOffset = 0): Promise<MonthlyCostSummary> {
  const pool = getPool();
  const layerClause = layer === "all" ? "" : "AND layer = $2";
  const params: Array<number | string> = [monthOffset];
  if (layer !== "all") {
    params.push(layer);
  }

  const result = await pool.query<{
    month_start: string;
    total_cost_jpy: string | null;
    total_cost_usd: string | null;
    call_count: string;
    cache_hits: string;
    escalations: string;
  }>(
    `WITH bounds AS (
       SELECT date_trunc('month', NOW() - ($1 || ' month')::interval) AS month_start,
              date_trunc('month', NOW() - ($1 || ' month')::interval) + INTERVAL '1 month' AS next_start
     )
     SELECT
       (SELECT month_start::date::text FROM bounds) AS month_start,
       COALESCE(SUM(cost_jpy), 0)::text AS total_cost_jpy,
       COALESCE(SUM(cost_usd), 0)::text AS total_cost_usd,
       COUNT(*)::text AS call_count,
       COUNT(*) FILTER (WHERE cache_hit)::text AS cache_hits,
       COUNT(*) FILTER (WHERE escalated)::text AS escalations
     FROM ai_cost_log
     WHERE occurred_at >= (SELECT month_start FROM bounds)
       AND occurred_at <  (SELECT next_start  FROM bounds)
       ${layerClause}`,
    params
  );

  const row = result.rows[0];
  return {
    layer,
    monthStart: row?.month_start ?? new Date().toISOString().slice(0, 10),
    totalCostJpy: Number(row?.total_cost_jpy ?? 0),
    totalCostUsd: Number(row?.total_cost_usd ?? 0),
    callCount: Number(row?.call_count ?? 0),
    cacheHits: Number(row?.cache_hits ?? 0),
    escalations: Number(row?.escalations ?? 0),
  };
}
