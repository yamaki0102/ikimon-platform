// /admin/data-health — Biodiversity Freshness OS Evaluation Gate dashboard.
//
// Surfaces the 6 governance metrics (monthly AI cost per layer,
// freshness_registry status per source, pending claim reviews,
// unresolved staleness alerts) in a single SSR page. Admin/Analyst only.

import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { renderSiteDocument } from "../ui/siteShell.js";
import { summarizeMonthlyCost, type AiCostLayer } from "../services/aiCostLogger.js";
import { snapshotBudget } from "../services/aiBudgetGate.js";

type FreshnessRow = {
  registry_key: string;
  source_kind: string;
  expected_freshness_days: number;
  last_attempt_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
  trust_grade: string;
  status: string;
  next_due_at: string | null;
};

type ClaimReviewSummary = { severity: string; pending: number };
type StalenessSummary = { severity: string; pending: number };

type AiRoleChainMetricRow = {
  chain_name: string;
  stage_name: string;
  layer: string;
  calls_7d: string;
  calls_30d: string;
  fallback_calls_7d: string;
  fallback_calls_30d: string;
  avg_latency_ms_7d: string | null;
  avg_latency_ms_30d: string | null;
  p95_latency_ms_7d: string | null;
  p95_latency_ms_30d: string | null;
  input_tokens_30d: string | null;
  output_tokens_30d: string | null;
  cost_jpy_30d: string | null;
  models_30d: string | null;
};

type CuratorRunRow = {
  run_id: string;
  curator_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  cost_jpy: string | null;
  pr_url: string | null;
  receiver_response_status: number | null;
  deepseek_call_count: number | null;
  deepseek_skip_reason: string | null;
  curator_model_provider: string | null;
  curator_model_name: string | null;
  curator_model_call_count: number | null;
  gemini_call_count: number | null;
  gemini_skip_reason: string | null;
  chunk_count: number | null;
  rows_proposed: number | null;
  rows_dropped_validation: number | null;
  wet_run_marker: boolean;
  attempt_no: number;
};

type AiCandidateNameHealthSummaryRow = {
  source_kind: string;
  total_7d: string;
  missing_scientific_7d: string;
  invalid_scientific_7d: string;
  total_30d: string;
  missing_scientific_30d: string;
  invalid_scientific_30d: string;
  latest_seen_at: string | null;
};

type AiCandidateNameHealthSampleRow = {
  source_kind: string;
  visit_id: string | null;
  candidate_name: string | null;
  candidate_rank: string | null;
  scientific_name: string | null;
  model_used: string | null;
  seen_at: string | null;
};

function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loginGate(): string {
  return `
<div style="max-width:560px;margin:64px auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;font-family:-apple-system,system-ui,sans-serif;">
  <h2 style="margin-top:0;">データ健康診断は管理者専用</h2>
  <p style="color:#555;font-size:14px;">アナリストまたは管理者ロールでログインしてください。</p>
  <p style="font-size:13px;"><a href="/login?next=${encodeURIComponent("/admin/data-health")}">ログインへ</a></p>
</div>`;
}

function statusBadge(status: string): string {
  const colorMap: Record<string, string> = {
    fresh: "#10b981",
    stale: "#f59e0b",
    critical: "#ef4444",
    paused: "#6b7280",
    unknown: "#9ca3af",
  };
  const color = colorMap[status] ?? "#9ca3af";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${color};color:#fff;font-size:11px;font-weight:600;">${escapeHtml(status)}</span>`;
}

function budgetStateBadge(state: string): string {
  const colorMap: Record<string, string> = {
    normal: "#10b981",
    constrained: "#f59e0b",
    strict: "#f97316",
    freeze: "#ef4444",
    reject: "#7f1d1d",
  };
  const color = colorMap[state] ?? "#9ca3af";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${color};color:#fff;font-size:11px;font-weight:600;">${escapeHtml(state)}</span>`;
}

function renderCostPanel(
  layer: AiCostLayer,
  summary: { totalCostJpy: number; callCount: number; cacheHits: number; escalations: number },
  budget: { state: string; ratio: number; monthlyBudgetJpy: number },
): string {
  const pct = (budget.ratio * 100).toFixed(1);
  const cacheRatio = summary.callCount > 0 ? ((summary.cacheHits / summary.callCount) * 100).toFixed(1) : "0.0";
  const escRatio = summary.callCount > 0 ? ((summary.escalations / summary.callCount) * 100).toFixed(1) : "0.0";
  const barColor = budget.ratio >= 0.95 ? "#ef4444" : budget.ratio >= 0.80 ? "#f59e0b" : "#10b981";
  const fillPct = Math.min(100, budget.ratio * 100).toFixed(1);
  return `
<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#fff;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <h3 style="margin:0;font-size:14px;text-transform:uppercase;color:#374151;">${escapeHtml(layer)} layer</h3>
    ${budgetStateBadge(budget.state)}
  </div>
  <div style="font-size:24px;font-weight:600;color:#111827;">¥${summary.totalCostJpy.toFixed(2)} <span style="font-size:12px;font-weight:400;color:#6b7280;">/ ¥${budget.monthlyBudgetJpy.toFixed(0)}</span></div>
  <div style="margin-top:8px;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;">
    <div style="height:100%;width:${fillPct}%;background:${barColor};"></div>
  </div>
  <div style="margin-top:8px;font-size:12px;color:#6b7280;">${pct}% 使用 · ${summary.callCount} calls · cache ${cacheRatio}% · pro escalation ${escRatio}%</div>
</div>`;
}

function renderFreshnessTable(rows: FreshnessRow[]): string {
  if (rows.length === 0) return `<p style="color:#6b7280;font-size:13px;">freshness_registry にエントリがありません。</p>`;
  const tbody = rows.map((row) => {
    const lastSuccess = row.last_success_at ?? "—";
    const nextDue = row.next_due_at ?? "—";
    const failBadge = row.consecutive_failures > 0
      ? `<span style="color:#ef4444;font-weight:600;">${row.consecutive_failures}</span>`
      : `<span style="color:#10b981;">0</span>`;
    return `
<tr>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-family:ui-monospace,monospace;font-size:12px;">${escapeHtml(row.registry_key)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${escapeHtml(row.source_kind)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;">${row.expected_freshness_days}d</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;">${escapeHtml(row.trust_grade)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${statusBadge(row.status)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${escapeHtml(lastSuccess)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${escapeHtml(nextDue)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;text-align:right;">${failBadge}</td>
</tr>`;
  }).join("");
  return `
<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
  <thead>
    <tr style="background:#f9fafb;">
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">registry_key</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">source_kind</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">freshness</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">trust</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">status</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">last_success</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">next_due</th>
      <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">fails</th>
    </tr>
  </thead>
  <tbody>${tbody}</tbody>
</table>`;
}

function renderQueueSummary(label: string, rows: { severity: string; pending: number }[]): string {
  if (rows.length === 0) {
    return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#fff;"><h3 style="margin:0 0 8px;font-size:14px;color:#374151;">${escapeHtml(label)}</h3><p style="margin:0;color:#10b981;font-size:13px;">未対応なし</p></div>`;
  }
  const total = rows.reduce((sum, row) => sum + Number(row.pending ?? 0), 0);
  const tbody = rows.map((row) => `<tr><td style="padding:4px 8px;font-size:12px;color:#6b7280;">${escapeHtml(row.severity)}</td><td style="padding:4px 8px;font-size:12px;text-align:right;font-weight:600;color:${row.severity === "critical" ? "#ef4444" : "#374151"};">${row.pending}</td></tr>`).join("");
  return `
<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#fff;">
  <h3 style="margin:0 0 8px;font-size:14px;color:#374151;">${escapeHtml(label)} <span style="font-size:18px;font-weight:600;color:#111827;">${total}</span></h3>
  <table style="width:100%;border-collapse:collapse;">${tbody}</table>
</div>`;
}

async function fetchAiRoleChainMetrics(): Promise<AiRoleChainMetricRow[]> {
  const pool = getPool();
  try {
    const result = await pool.query<AiRoleChainMetricRow>(
      `WITH recent AS (
         SELECT
           COALESCE(metadata->>'aiModelChain', endpoint) AS chain_name,
           CASE
             WHEN endpoint = 'guide_scene_visual_extract' THEN 'visual_extract_model'
             WHEN endpoint = 'guide_scene_text' THEN 'text_model'
             ELSE endpoint
           END AS stage_name,
           layer,
           provider,
           model,
           occurred_at,
           latency_ms,
           input_tokens,
           output_tokens,
           cost_jpy,
           COALESCE((metadata->>'aiModelFallbackIndex')::int, 0) AS fallback_index
         FROM ai_cost_log
         WHERE occurred_at >= NOW() - INTERVAL '30 days'
           AND metadata ? 'aiModelChain'
       )
       SELECT
         chain_name,
         stage_name,
         layer,
         COUNT(*) FILTER (WHERE occurred_at >= NOW() - INTERVAL '7 days')::text AS calls_7d,
         COUNT(*)::text AS calls_30d,
         COUNT(*) FILTER (WHERE occurred_at >= NOW() - INTERVAL '7 days' AND fallback_index > 0)::text AS fallback_calls_7d,
         COUNT(*) FILTER (WHERE fallback_index > 0)::text AS fallback_calls_30d,
         ROUND(AVG(latency_ms) FILTER (WHERE occurred_at >= NOW() - INTERVAL '7 days' AND latency_ms IS NOT NULL))::text AS avg_latency_ms_7d,
         ROUND(AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL))::text AS avg_latency_ms_30d,
         ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE occurred_at >= NOW() - INTERVAL '7 days' AND latency_ms IS NOT NULL))::text AS p95_latency_ms_7d,
         ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE latency_ms IS NOT NULL))::text AS p95_latency_ms_30d,
         COALESCE(SUM(input_tokens), 0)::text AS input_tokens_30d,
         COALESCE(SUM(output_tokens), 0)::text AS output_tokens_30d,
         COALESCE(SUM(cost_jpy), 0)::text AS cost_jpy_30d,
         string_agg(DISTINCT provider || ':' || model, ', ' ORDER BY provider || ':' || model) AS models_30d
       FROM recent
       GROUP BY chain_name, stage_name, layer
       ORDER BY
         COUNT(*) FILTER (WHERE occurred_at >= NOW() - INTERVAL '7 days') DESC,
         COUNT(*) DESC,
         chain_name`,
    );
    return result.rows;
  } catch {
    return [];
  }
}

function pct(part: number, total: number): string {
  return total > 0 ? `${((part / total) * 100).toFixed(1)}%` : "0.0%";
}

function compactNumber(value: string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("ja-JP");
}

function renderAiRoleChainMetrics(rows: AiRoleChainMetricRow[]): string {
  if (rows.length === 0) {
    return `<p style="color:#6b7280;font-size:13px;">router 経由の role chain telemetry はまだありません。</p>`;
  }
  const tbody = rows.map((row) => {
    const calls7 = Number(row.calls_7d ?? 0);
    const calls30 = Number(row.calls_30d ?? 0);
    const fallback7 = Number(row.fallback_calls_7d ?? 0);
    const fallback30 = Number(row.fallback_calls_30d ?? 0);
    const fallbackColor = fallback7 > 0 || fallback30 > 0 ? "#f59e0b" : "#10b981";
    return `
<tr>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-family:ui-monospace,monospace;font-size:12px;color:#111827;">${escapeHtml(row.chain_name)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-family:ui-monospace,monospace;font-size:11px;color:#065f46;">${escapeHtml(row.stage_name)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;">${escapeHtml(row.layer)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#111827;">${calls7} / ${calls30}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:${fallbackColor};font-weight:700;">${pct(fallback7, calls7)} / ${pct(fallback30, calls30)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#374151;">${compactNumber(row.avg_latency_ms_7d)} / ${compactNumber(row.p95_latency_ms_7d)} ms</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#374151;">${compactNumber(row.avg_latency_ms_30d)} / ${compactNumber(row.p95_latency_ms_30d)} ms</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#374151;">${compactNumber(row.input_tokens_30d)} / ${compactNumber(row.output_tokens_30d)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#374151;">¥${Number(row.cost_jpy_30d ?? 0).toFixed(2)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280;max-width:320px;">${escapeHtml(row.models_30d ?? "—")}</td>
</tr>`;
  }).join("");
  return `
<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
  <thead>
    <tr style="background:#f9fafb;">
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">role chain</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">stage</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">layer</th>
      <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">calls 7d/30d</th>
      <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">fallback 7d/30d</th>
      <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">avg/p95 7d</th>
      <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">avg/p95 30d</th>
      <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">tokens in/out 30d</th>
      <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">cost 30d</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">models</th>
    </tr>
  </thead>
  <tbody>${tbody}</tbody>
</table>`;
}

async function fetchAiCandidateNameHealth(): Promise<{
  summaries: AiCandidateNameHealthSummaryRow[];
  samples: AiCandidateNameHealthSampleRow[];
}> {
  const pool = getPool();
  try {
    const result = await pool.query<AiCandidateNameHealthSummaryRow>(
      `WITH json_candidates AS (
         SELECT
           'raw_json.candidate_readings'::text AS source_kind,
           a.visit_id,
           a.model_used,
           a.generated_at AS seen_at,
           item->>'name' AS candidate_name,
           item->>'rank' AS candidate_rank,
           item->>'scientific_name' AS scientific_name
         FROM observation_ai_assessments a
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(COALESCE(a.raw_json #> '{parsed,candidate_readings}', a.raw_json -> 'candidate_readings')) = 'array'
               THEN COALESCE(a.raw_json #> '{parsed,candidate_readings}', a.raw_json -> 'candidate_readings')
             ELSE '[]'::jsonb
           END
         ) AS item
         WHERE a.generated_at >= NOW() - INTERVAL '30 days'

         UNION ALL

         SELECT
           'raw_json.coexisting_taxa'::text AS source_kind,
           a.visit_id,
           a.model_used,
           a.generated_at AS seen_at,
           item->>'name' AS candidate_name,
           item->>'rank' AS candidate_rank,
           item->>'scientific_name' AS scientific_name
         FROM observation_ai_assessments a
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(COALESCE(a.raw_json #> '{parsed,coexisting_taxa}', a.raw_json -> 'coexisting_taxa')) = 'array'
               THEN COALESCE(a.raw_json #> '{parsed,coexisting_taxa}', a.raw_json -> 'coexisting_taxa')
             ELSE '[]'::jsonb
           END
         ) AS item
         WHERE a.generated_at >= NOW() - INTERVAL '30 days'
       ),
       materialized_candidates AS (
         SELECT
           'observation_ai_subject_candidates'::text AS source_kind,
           c.visit_id,
           COALESCE(NULLIF(r.model_provider || ':' || r.model_name, ':'), '') AS model_used,
           c.created_at AS seen_at,
           COALESCE(c.vernacular_name, c.scientific_name) AS candidate_name,
           c.taxon_rank AS candidate_rank,
           c.scientific_name
         FROM observation_ai_subject_candidates c
         LEFT JOIN observation_ai_runs r ON r.ai_run_id = c.ai_run_id
         WHERE c.created_at >= NOW() - INTERVAL '30 days'
       ),
       candidates AS (
         SELECT * FROM json_candidates
         UNION ALL
         SELECT * FROM materialized_candidates
       )
       SELECT
         source_kind,
         COUNT(*) FILTER (WHERE seen_at >= NOW() - INTERVAL '7 days')::text AS total_7d,
         COUNT(*) FILTER (
           WHERE seen_at >= NOW() - INTERVAL '7 days'
             AND NULLIF(BTRIM(COALESCE(scientific_name, '')), '') IS NULL
         )::text AS missing_scientific_7d,
         COUNT(*) FILTER (
           WHERE seen_at >= NOW() - INTERVAL '7 days'
             AND NULLIF(BTRIM(COALESCE(scientific_name, '')), '') IS NOT NULL
             AND BTRIM(scientific_name) !~ '^[A-Z][a-z]+( [a-z][a-z-]+)?$'
         )::text AS invalid_scientific_7d,
         COUNT(*)::text AS total_30d,
         COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(scientific_name, '')), '') IS NULL)::text AS missing_scientific_30d,
         COUNT(*) FILTER (
           WHERE NULLIF(BTRIM(COALESCE(scientific_name, '')), '') IS NOT NULL
             AND BTRIM(scientific_name) !~ '^[A-Z][a-z]+( [a-z][a-z-]+)?$'
         )::text AS invalid_scientific_30d,
         MAX(seen_at)::text AS latest_seen_at
       FROM candidates
       GROUP BY source_kind
       ORDER BY source_kind`,
    );
    const samples = await pool.query<AiCandidateNameHealthSampleRow>(
      `WITH json_candidates AS (
         SELECT
           'raw_json.candidate_readings'::text AS source_kind,
           a.visit_id,
           a.model_used,
           a.generated_at AS seen_at,
           item->>'name' AS candidate_name,
           item->>'rank' AS candidate_rank,
           item->>'scientific_name' AS scientific_name
         FROM observation_ai_assessments a
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(COALESCE(a.raw_json #> '{parsed,candidate_readings}', a.raw_json -> 'candidate_readings')) = 'array'
               THEN COALESCE(a.raw_json #> '{parsed,candidate_readings}', a.raw_json -> 'candidate_readings')
             ELSE '[]'::jsonb
           END
         ) AS item
         WHERE a.generated_at >= NOW() - INTERVAL '30 days'

         UNION ALL

         SELECT
           'raw_json.coexisting_taxa'::text AS source_kind,
           a.visit_id,
           a.model_used,
           a.generated_at AS seen_at,
           item->>'name' AS candidate_name,
           item->>'rank' AS candidate_rank,
           item->>'scientific_name' AS scientific_name
         FROM observation_ai_assessments a
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(COALESCE(a.raw_json #> '{parsed,coexisting_taxa}', a.raw_json -> 'coexisting_taxa')) = 'array'
               THEN COALESCE(a.raw_json #> '{parsed,coexisting_taxa}', a.raw_json -> 'coexisting_taxa')
             ELSE '[]'::jsonb
           END
         ) AS item
         WHERE a.generated_at >= NOW() - INTERVAL '30 days'
       ),
       materialized_candidates AS (
         SELECT
           'observation_ai_subject_candidates'::text AS source_kind,
           c.visit_id,
           COALESCE(NULLIF(r.model_provider || ':' || r.model_name, ':'), '') AS model_used,
           c.created_at AS seen_at,
           COALESCE(c.vernacular_name, c.scientific_name) AS candidate_name,
           c.taxon_rank AS candidate_rank,
           c.scientific_name
         FROM observation_ai_subject_candidates c
         LEFT JOIN observation_ai_runs r ON r.ai_run_id = c.ai_run_id
         WHERE c.created_at >= NOW() - INTERVAL '30 days'
       ),
       candidates AS (
         SELECT * FROM json_candidates
         UNION ALL
         SELECT * FROM materialized_candidates
       )
       SELECT source_kind, visit_id, candidate_name, candidate_rank, scientific_name, model_used, seen_at::text AS seen_at
       FROM candidates
       WHERE NULLIF(BTRIM(COALESCE(scientific_name, '')), '') IS NULL
          OR BTRIM(scientific_name) !~ '^[A-Z][a-z]+( [a-z][a-z-]+)?$'
       ORDER BY seen_at DESC NULLS LAST
       LIMIT 16`,
    );
    return { summaries: result.rows, samples: samples.rows };
  } catch {
    return { summaries: [], samples: [] };
  }
}

function renderAiCandidateNameHealth(input: {
  summaries: AiCandidateNameHealthSummaryRow[];
  samples: AiCandidateNameHealthSampleRow[];
}): string {
  if (input.summaries.length === 0) {
    return `<p style="color:#6b7280;font-size:13px;">直近 30 日の AI candidate scientific_name telemetry はまだありません。</p>`;
  }
  const summaryRows = input.summaries.map((row) => {
    const total7 = Number(row.total_7d ?? 0);
    const missing7 = Number(row.missing_scientific_7d ?? 0);
    const invalid7 = Number(row.invalid_scientific_7d ?? 0);
    const total30 = Number(row.total_30d ?? 0);
    const missing30 = Number(row.missing_scientific_30d ?? 0);
    const invalid30 = Number(row.invalid_scientific_30d ?? 0);
    const bad7 = missing7 + invalid7;
    const bad30 = missing30 + invalid30;
    const badColor = bad7 > 0 ? "#ef4444" : bad30 > 0 ? "#f59e0b" : "#10b981";
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-family:ui-monospace,monospace;font-size:12px;color:#111827;">${escapeHtml(row.source_kind)}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#111827;">${total7}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:${badColor};font-weight:700;">${pct(missing7, total7)}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#92400e;font-weight:700;">${pct(invalid7, total7)}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#111827;">${total30}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:${bad30 > 0 ? "#f59e0b" : "#10b981"};font-weight:700;">${pct(missing30, total30)}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#92400e;font-weight:700;">${pct(invalid30, total30)}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280;">${escapeHtml((row.latest_seen_at ?? "—").slice(0, 19))}</td>
    </tr>`;
  }).join("");
  const sampleRows = input.samples.length === 0
    ? `<tr><td colspan="7" style="padding:10px;color:#10b981;font-size:12px;">欠落・不正な scientific_name のサンプルはありません。</td></tr>`
    : input.samples.map((row) => `<tr>
      <td style="padding:7px;border-bottom:1px solid #f3f4f6;font-family:ui-monospace,monospace;font-size:11px;color:#6b7280;">${escapeHtml(row.source_kind)}</td>
      <td style="padding:7px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#111827;">${escapeHtml(row.candidate_name ?? "—")}</td>
      <td style="padding:7px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280;">${escapeHtml(row.candidate_rank ?? "—")}</td>
      <td style="padding:7px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#ef4444;font-weight:700;">${escapeHtml(row.scientific_name || "missing")}</td>
      <td style="padding:7px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280;">${escapeHtml(row.model_used || "—")}</td>
      <td style="padding:7px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280;">${escapeHtml(row.visit_id ?? "—")}</td>
      <td style="padding:7px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6b7280;">${escapeHtml((row.seen_at ?? "—").slice(0, 19))}</td>
    </tr>`).join("");
  return `
<div style="display:grid;gap:12px;">
  <p style="margin:0;color:#6b7280;font-size:12px;">raw_json の候補配列と materialized candidate を分けて監視。missing は空欄、invalid は和名混入など Latin scientific name らしくない値。</p>
  <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">source</th>
        <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">total 7d</th>
        <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">missing 7d</th>
        <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">invalid 7d</th>
        <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">total 30d</th>
        <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">missing 30d</th>
        <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">invalid 30d</th>
        <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">latest</th>
      </tr>
    </thead>
    <tbody>${summaryRows}</tbody>
  </table>
  <details style="border:1px solid #e5e7eb;border-radius:8px;background:#fff;">
    <summary style="cursor:pointer;padding:10px 12px;font-size:13px;font-weight:700;color:#374151;">欠落・不正 scientific_name の最新サンプル</summary>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:7px;text-align:left;font-size:10px;color:#374151;text-transform:uppercase;">source</th>
          <th style="padding:7px;text-align:left;font-size:10px;color:#374151;text-transform:uppercase;">candidate</th>
          <th style="padding:7px;text-align:left;font-size:10px;color:#374151;text-transform:uppercase;">rank</th>
          <th style="padding:7px;text-align:left;font-size:10px;color:#374151;text-transform:uppercase;">scientific_name</th>
          <th style="padding:7px;text-align:left;font-size:10px;color:#374151;text-transform:uppercase;">model</th>
          <th style="padding:7px;text-align:left;font-size:10px;color:#374151;text-transform:uppercase;">visit</th>
          <th style="padding:7px;text-align:left;font-size:10px;color:#374151;text-transform:uppercase;">seen</th>
        </tr>
      </thead>
      <tbody>${sampleRows}</tbody>
    </table>
  </details>
</div>`;
}

async function fetchRecentCuratorRuns(): Promise<CuratorRunRow[]> {
  const pool = getPool();
  try {
    const result = await pool.query<CuratorRunRow>(
      `SELECT run_id::text AS run_id,
              curator_name,
              started_at::text AS started_at,
              finished_at::text AS finished_at,
              status,
              cost_jpy::text AS cost_jpy,
              pr_url,
              receiver_response_status,
              deepseek_call_count,
              deepseek_skip_reason,
              curator_model_provider,
              curator_model_name,
              curator_model_call_count,
              gemini_call_count,
              gemini_skip_reason,
              chunk_count,
              rows_proposed,
              rows_dropped_validation,
              COALESCE(wet_run_marker, FALSE) AS wet_run_marker,
              COALESCE(attempt_no, 1) AS attempt_no
         FROM ai_curator_runs
        WHERE started_at >= NOW() - INTERVAL '7 days'
        ORDER BY started_at DESC
        LIMIT 30`,
    );
    return result.rows;
  } catch {
    return [];
  }
}

function renderCuratorRunsTable(rows: CuratorRunRow[]): string {
  if (rows.length === 0) {
    return `<p style="color:#6b7280;font-size:13px;">過去 7 日に curator run の記録がありません。</p>`;
  }
  const tbody = rows
    .map((row) => {
      const statusColor =
        row.status === "success" ? "#10b981"
        : row.status === "running" ? "#3b82f6"
        : row.status === "partial" ? "#f59e0b"
        : "#ef4444";
      const modelCell = (() => {
        if (row.curator_model_provider && row.curator_model_provider !== "none") {
          const calls = row.curator_model_call_count ?? 0;
          const geminiCalls = row.gemini_call_count ?? 0;
          const reason = row.gemini_skip_reason ?? "";
          const violated = row.curator_model_provider === "gemini" && calls === 0 && (!reason || reason === "none");
          const color = violated ? "#ef4444" : calls >= 1 ? "#10b981" : "#f59e0b";
          const detail = [
            `${row.curator_model_provider}/${row.curator_model_name ?? "unknown"}`,
            `model calls ${calls}`,
            `gemini calls ${geminiCalls}`,
            reason ? `reason ${reason}` : "",
          ].filter(Boolean).join(" · ");
          return `<span style="color:${color};font-weight:600;" title="${escapeHtml(detail)}">${escapeHtml(row.curator_model_provider)} ${calls}</span>`;
        }
        if (row.deepseek_call_count !== null && row.deepseek_call_count !== undefined) {
          if (row.deepseek_call_count >= 1) {
            return `<span style="color:#10b981;font-weight:600;" title="legacy v6 DeepSeek telemetry">deepseek ${row.deepseek_call_count}</span>`;
          }
          const reason = row.deepseek_skip_reason ?? "(no reason)";
          const justified = reason !== "none" && reason !== "(no reason)";
          const color = justified ? "#f59e0b" : "#ef4444";
          const title = justified
            ? `legacy 0 calls justified by ${reason}`
            : `legacy v6 cost violation: deepseek_skip_reason=${reason}`;
          return `<span style="color:${color};font-weight:600;" title="${escapeHtml(title)}">deepseek 0</span>`;
        }
        return `<span style="color:#9ca3af;font-size:11px;">—</span>`;
      })();
      const rowsCell = row.rows_proposed === null || row.rows_proposed === undefined
        ? "—"
        : `${row.rows_proposed}/${row.rows_dropped_validation ?? 0}`;
      const wetTag = row.wet_run_marker
        ? `<span style="display:inline-block;padding:1px 6px;font-size:10px;background:#fbbf24;color:#78350f;border-radius:9999px;margin-left:4px;">wet-run</span>`
        : "";
      const httpTag = row.receiver_response_status
        ? `<span style="font-size:11px;color:${row.receiver_response_status < 300 ? "#10b981" : "#ef4444"};">HTTP ${row.receiver_response_status}</span>`
        : `<span style="font-size:11px;color:#9ca3af;">—</span>`;
      const prCell = row.pr_url
        ? `<a href="${escapeHtml(row.pr_url)}" target="_blank" rel="noopener" style="color:#3b82f6;font-size:11px;">PR ↗</a>`
        : `<span style="color:#9ca3af;font-size:11px;">—</span>`;
      const costCell = row.cost_jpy ? `¥${Number(row.cost_jpy).toFixed(2)}` : "—";
      return `
<tr>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#6b7280;font-family:ui-monospace,monospace;">${escapeHtml((row.started_at ?? "").slice(0, 19))}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;">${escapeHtml(row.curator_name)}${wetTag}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;"><span style="display:inline-block;padding:2px 6px;border-radius:9999px;background:${statusColor};color:#fff;font-size:11px;font-weight:600;">${escapeHtml(row.status)}</span></td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;">${modelCell}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#374151;">${escapeHtml(rowsCell)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:center;">${httpTag}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-size:12px;color:#374151;">${escapeHtml(costCell)}</td>
  <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:center;">${prCell}</td>
</tr>`;
    })
    .join("");
  const wetCount = rows.filter((r) => r.wet_run_marker).length;
  const violationCount = rows.filter(
    (r) =>
      (r.curator_model_provider === "gemini" && r.curator_model_call_count === 0 && (!r.gemini_skip_reason || r.gemini_skip_reason === "none")) ||
      (!r.curator_model_provider && r.deepseek_call_count === 0 && (!r.deepseek_skip_reason || r.deepseek_skip_reason === "none")),
  ).length;
  const warningBanner = violationCount > 0
    ? `<div style="margin-bottom:8px;padding:8px 12px;background:#fee2e2;border:1px solid #ef4444;border-radius:6px;font-size:12px;color:#7f1d1d;">${violationCount} run(s) で LLM 構造化抽出 call が 0 かつ skip reason なし。</div>`
    : "";
  return `
${warningBanner}
<div style="margin-bottom:8px;font-size:12px;color:#6b7280;">過去 7 日: ${rows.length} run, うち wet-run ${wetCount} 件 / telemetry warning ${violationCount} 件</div>
<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
  <thead>
    <tr style="background:#f9fafb;">
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">started_at</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">curator</th>
      <th style="padding:8px;text-align:left;font-size:11px;color:#374151;text-transform:uppercase;">status</th>
      <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">model calls</th>
      <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">rows ok/drop</th>
      <th style="padding:8px;text-align:center;font-size:11px;color:#374151;text-transform:uppercase;">receiver</th>
      <th style="padding:8px;text-align:right;font-size:11px;color:#374151;text-transform:uppercase;">cost</th>
      <th style="padding:8px;text-align:center;font-size:11px;color:#374151;text-transform:uppercase;">pr</th>
    </tr>
  </thead>
  <tbody>${tbody}</tbody>
</table>`;
}

async function fetchFreshnessRegistry(): Promise<FreshnessRow[]> {
  const pool = getPool();
  const result = await pool.query<FreshnessRow>(
    `SELECT registry_key, source_kind, expected_freshness_days,
            last_attempt_at::text AS last_attempt_at,
            last_success_at::text AS last_success_at,
            consecutive_failures, trust_grade, status,
            next_due_at::text AS next_due_at
       FROM freshness_registry
       ORDER BY status DESC, registry_key`
  );
  return result.rows;
}

async function fetchClaimReviewSummary(): Promise<ClaimReviewSummary[]> {
  const pool = getPool();
  // claim_review_queue may not exist if 0055 not applied — fall back gracefully.
  try {
    const result = await pool.query<{ severity: string; pending: string }>(
      `SELECT severity, COUNT(*)::text AS pending
         FROM claim_review_queue
        WHERE decision IS NULL
        GROUP BY severity
        ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`
    );
    return result.rows.map((row) => ({ severity: row.severity, pending: Number(row.pending) }));
  } catch {
    return [];
  }
}

async function fetchStalenessSummary(): Promise<StalenessSummary[]> {
  const pool = getPool();
  try {
    const result = await pool.query<{ severity: string; pending: string }>(
      `SELECT severity, COUNT(*)::text AS pending
         FROM staleness_alerts
        WHERE resolved_at IS NULL
        GROUP BY severity
        ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`
    );
    return result.rows.map((row) => ({ severity: row.severity, pending: Number(row.pending) }));
  } catch {
    return [];
  }
}

async function renderDashboard(): Promise<string> {
  const layers: AiCostLayer[] = ["hot", "warm", "cold"];
  const [hotSummary, warmSummary, coldSummary, hotBudget, warmBudget, coldBudget, freshness, claimReview, staleness, curatorRuns, aiRoleChainMetrics, aiCandidateNameHealth] = await Promise.all([
    summarizeMonthlyCost("hot"),
    summarizeMonthlyCost("warm"),
    summarizeMonthlyCost("cold"),
    snapshotBudget("hot"),
    snapshotBudget("warm"),
    snapshotBudget("cold"),
    fetchFreshnessRegistry(),
    fetchClaimReviewSummary(),
    fetchStalenessSummary(),
    fetchRecentCuratorRuns(),
    fetchAiRoleChainMetrics(),
    fetchAiCandidateNameHealth(),
  ]);

  const summaries = { hot: hotSummary, warm: warmSummary, cold: coldSummary };
  const budgets = { hot: hotBudget, warm: warmBudget, cold: coldBudget };

  const costGrid = layers.map((layer) => renderCostPanel(layer, summaries[layer], budgets[layer])).join("");

  return `
<div style="max-width:1280px;margin:32px auto;padding:0 16px;font-family:-apple-system,system-ui,sans-serif;color:#111827;">
  <header style="margin-bottom:24px;">
    <h1 style="margin:0;font-size:22px;">📊 Biodiversity Freshness OS — Data Health</h1>
    <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">月次AIコスト・データソース鮮度・人手レビュー待ち件数を一画面で監視。</p>
  </header>

  <section style="margin-bottom:24px;">
    <h2 style="font-size:14px;color:#374151;text-transform:uppercase;margin:0 0 12px;">月次AIコスト (layer 別)</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">${costGrid}</div>
  </section>

  <section style="margin-bottom:24px;">
    <h2 style="font-size:14px;color:#374151;text-transform:uppercase;margin:0 0 12px;">role chain 別 LLM telemetry</h2>
    ${renderAiRoleChainMetrics(aiRoleChainMetrics)}
  </section>

  <section style="margin-bottom:24px;">
    <h2 style="font-size:14px;color:#374151;text-transform:uppercase;margin:0 0 12px;">AI候補 scientific_name 欠落率</h2>
    ${renderAiCandidateNameHealth(aiCandidateNameHealth)}
  </section>

  <section style="margin-bottom:24px;">
    <h2 style="font-size:14px;color:#374151;text-transform:uppercase;margin:0 0 12px;">人手レビュー待ち</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
      ${renderQueueSummary("claim_review_queue", claimReview)}
      ${renderQueueSummary("staleness_alerts (未解決)", staleness)}
    </div>
  </section>

  <section style="margin-bottom:24px;">
    <h2 style="font-size:14px;color:#374151;text-transform:uppercase;margin:0 0 12px;">直近 7 日の curator run</h2>
    ${renderCuratorRunsTable(curatorRuns)}
  </section>

  <section>
    <h2 style="font-size:14px;color:#374151;text-transform:uppercase;margin:0 0 12px;">freshness_registry</h2>
    ${renderFreshnessTable(freshness)}
  </section>

  <footer style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;">
    Generated at ${new Date().toISOString()} · spec: <code>docs/spec/ikimon_biodiversity_freshness_os_spec.md</code>
  </footer>
</div>`;
}

export async function registerAdminDataHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/data-health", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");

    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "データ健康診断 — ikimon.life",
        body: loginGate(),
      });
    }

    try {
      const body = await renderDashboard();
      return renderSiteDocument({
        basePath: "",
        title: "データ健康診断 — ikimon.life",
        body,
      });
    } catch (error) {
      reply.code(500);
      const errMsg = error instanceof Error ? error.message : String(error);
      return renderSiteDocument({
        basePath: "",
        title: "データ健康診断 (エラー) — ikimon.life",
        body: `<div style="max-width:640px;margin:64px auto;padding:24px;font-family:-apple-system,system-ui,sans-serif;"><h2 style="color:#ef4444;">読み込みエラー</h2><pre style="background:#f9fafb;padding:12px;border-radius:6px;font-size:12px;color:#374151;white-space:pre-wrap;">${escapeHtml(errMsg)}</pre></div>`,
      });
    }
  });
}
