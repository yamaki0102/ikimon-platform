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
  const [hotSummary, warmSummary, coldSummary, hotBudget, warmBudget, coldBudget, freshness, claimReview, staleness] = await Promise.all([
    summarizeMonthlyCost("hot"),
    summarizeMonthlyCost("warm"),
    summarizeMonthlyCost("cold"),
    snapshotBudget("hot"),
    snapshotBudget("warm"),
    snapshotBudget("cold"),
    fetchFreshnessRegistry(),
    fetchClaimReviewSummary(),
    fetchStalenessSummary(),
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
    <h2 style="font-size:14px;color:#374151;text-transform:uppercase;margin:0 0 12px;">人手レビュー待ち</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
      ${renderQueueSummary("claim_review_queue", claimReview)}
      ${renderQueueSummary("staleness_alerts (未解決)", staleness)}
    </div>
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
