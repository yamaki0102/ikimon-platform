import type { FastifyInstance, FastifyRequest } from "fastify";
import { getPool } from "../db.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";
import { renderSiteDocument } from "../ui/siteShell.js";

type RegionalKnowledgeReviewStatus = "draft" | "review" | "approved" | "retrieval" | "rejected";

type RegionalKnowledgeAdminRow = {
  card_id: string;
  region_scope: string;
  category: string;
  title: string;
  summary: string;
  source_url: string;
  source_label: string;
  observation_hooks: unknown;
  review_status: RegionalKnowledgeReviewStatus;
  quality_score: string | number;
  has_embedding: boolean;
  embedding_model: string | null;
  embedded_at: string | null;
  updated_at: string;
};

const VALID_STATUSES: ReadonlyArray<RegionalKnowledgeReviewStatus | "any"> = [
  "draft",
  "review",
  "approved",
  "retrieval",
  "rejected",
  "any",
];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function adminErrorStatus(message: string): number {
  if (message === "forbidden" || message === "forbidden_privileged_write") return 403;
  if (message === "privileged_write_api_key_not_configured") return 503;
  if (message.endsWith("_required") || message.startsWith("invalid_")) return 400;
  return 500;
}

async function assertRegionalKnowledgeAdminAccess(request: FastifyRequest): Promise<{ reviewerUserId: string; via: "session" | "write_key" }> {
  const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
  if (session && !session.banned && isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
    return { reviewerUserId: session.userId, via: "session" };
  }
  assertPrivilegedWriteAccess(request);
  return { reviewerUserId: "system_write_key", via: "write_key" };
}

function loginGate(): string {
  return `
<div class="rk-login">
  <h2>地域カード管理は管理者専用</h2>
  <p>地域資料を source -> draft -> review -> approved -> retrieval に進める画面です。</p>
  <p><a href="/login?next=${encodeURIComponent("/admin/regional-knowledge")}">ログインへ</a></p>
</div>`;
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    draft: "#64748b",
    review: "#f59e0b",
    approved: "#2563eb",
    retrieval: "#16a34a",
    rejected: "#dc2626",
  };
  const color = colors[status] ?? "#64748b";
  return `<span class="rk-badge" style="background:${color};">${escapeHtml(status)}</span>`;
}

function hooksText(value: unknown): string {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 8).join(" / ") : "";
}

async function listCards(options: {
  status: RegionalKnowledgeReviewStatus | "any";
  limit: number;
  regionScope?: string;
}): Promise<RegionalKnowledgeAdminRow[]> {
  const values: unknown[] = [];
  const clauses: string[] = [];
  if (options.status !== "any") {
    values.push(options.status);
    clauses.push(`review_status = $${values.length}`);
  }
  if (options.regionScope) {
    values.push(options.regionScope);
    clauses.push(`region_scope = $${values.length}`);
  }
  values.push(options.limit);
  const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  const result = await getPool().query<RegionalKnowledgeAdminRow>(
    `select card_id,
            region_scope,
            category,
            title,
            summary,
            source_url,
            source_label,
            observation_hooks,
            review_status,
            quality_score,
            retrieval_embedding is not null as has_embedding,
            nullif(embedding_model, '') as embedding_model,
            embedded_at::text as embedded_at,
            updated_at::text as updated_at
       from regional_knowledge_cards
       ${where}
      order by
        case review_status
          when 'draft' then 0
          when 'review' then 1
          when 'approved' then 2
          when 'retrieval' then 3
          else 4
        end,
        updated_at desc
      limit $${values.length}`,
    values,
  );
  return result.rows;
}

function renderFilters(status: string, regionScope: string): string {
  const options = VALID_STATUSES.map((item) => `<option value="${item}" ${item === status ? "selected" : ""}>${item}</option>`).join("");
  return `
<form class="rk-filter" method="get">
  <label>status <select name="status">${options}</select></label>
  <label>region <input name="regionScope" value="${escapeHtml(regionScope)}" placeholder="JP-22-Hamamatsu"></label>
  <button type="submit">絞り込み</button>
</form>`;
}

function renderCards(rows: RegionalKnowledgeAdminRow[]): string {
  if (rows.length === 0) return `<p class="rk-empty">該当する地域カードはありません。</p>`;
  return rows.map((row) => {
    const nextActions: RegionalKnowledgeReviewStatus[] = row.review_status === "draft"
      ? ["review", "rejected"]
      : row.review_status === "review"
        ? ["approved", "rejected"]
        : row.review_status === "approved"
          ? ["retrieval", "review"]
          : row.review_status === "retrieval"
            ? ["approved", "review"]
            : ["review"];
    const actions = nextActions.map((status) => `
      <button type="button" data-card-id="${escapeHtml(row.card_id)}" data-status="${status}">${status}</button>
    `).join("");
    return `
<article class="rk-card">
  <div class="rk-card-head">
    <div>
      <div class="rk-meta">${escapeHtml(row.region_scope)} / ${escapeHtml(row.category)} / ${escapeHtml(row.source_label)}</div>
      <h2>${escapeHtml(row.title)}</h2>
    </div>
    ${statusBadge(row.review_status)}
  </div>
  <p>${escapeHtml(row.summary)}</p>
  <div class="rk-hooks">${escapeHtml(hooksText(row.observation_hooks))}</div>
  <div class="rk-source"><a href="${escapeHtml(row.source_url)}" target="_blank" rel="noreferrer">出典を開く</a></div>
  <div class="rk-foot">
    <span>quality ${Number(row.quality_score).toFixed(2)}</span>
    <span>${row.has_embedding ? `embedding ${escapeHtml(row.embedding_model ?? "")}` : "embedding 未作成"}</span>
    <span>${escapeHtml(row.embedded_at ?? row.updated_at)}</span>
  </div>
  <div class="rk-actions">${actions}</div>
</article>`;
  }).join("");
}

const STYLES = `
body{background:#f8fafc;color:#172033;}
.rk-login{max-width:560px;margin:64px auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-family:-apple-system,system-ui,sans-serif;}
.rk-wrap{max-width:1120px;margin:0 auto;padding:32px 18px 72px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
.rk-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:18px;}
.rk-top h1{font-size:28px;line-height:1.25;margin:0;color:#111827;}
.rk-top p{margin:6px 0 0;color:#475569;font-size:14px;}
.rk-filter{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:0 0 18px;padding:14px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;}
.rk-filter label{display:grid;gap:4px;font-size:12px;color:#475569;text-transform:uppercase;}
.rk-filter select,.rk-filter input{min-height:36px;border:1px solid #cbd5e1;border-radius:6px;padding:0 10px;background:#fff;}
.rk-filter button,.rk-actions button{min-height:36px;border:1px solid #0f766e;border-radius:6px;background:#0f766e;color:#fff;padding:0 12px;font-weight:700;cursor:pointer;}
.rk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;}
.rk-card{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:16px;display:grid;gap:10px;}
.rk-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}
.rk-card h2{font-size:17px;line-height:1.45;margin:3px 0 0;color:#111827;}
.rk-card p{margin:0;color:#334155;font-size:14px;line-height:1.75;}
.rk-meta,.rk-foot,.rk-source{font-size:12px;color:#64748b;}
.rk-hooks{font-size:13px;color:#0f766e;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:6px;padding:8px;line-height:1.65;}
.rk-badge{display:inline-flex;align-items:center;border-radius:999px;color:#fff;font-size:11px;font-weight:800;padding:3px 9px;text-transform:uppercase;}
.rk-foot{display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid #f1f5f9;padding-top:10px;}
.rk-actions{display:flex;gap:8px;flex-wrap:wrap;}
.rk-actions button[data-status="rejected"]{border-color:#dc2626;background:#dc2626;}
.rk-empty{color:#64748b;}
`;

const SCRIPT = `
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-card-id][data-status]");
  if (!button) return;
  button.disabled = true;
  try {
    const res = await fetch("/api/v1/admin/regional-knowledge/" + encodeURIComponent(button.dataset.cardId) + "/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewStatus: button.dataset.status })
    });
    if (!res.ok) throw new Error(await res.text());
    location.reload();
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    button.disabled = false;
  }
});
`;

export async function registerAdminRegionalKnowledgeRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: { status?: string; limit?: string; regionScope?: string };
  }>("/admin/regional-knowledge", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "地域カード管理 — ikimon.life",
        extraStyles: STYLES,
        body: loginGate(),
      });
    }
    const rawStatus = request.query.status ?? "draft";
    const status = VALID_STATUSES.includes(rawStatus as RegionalKnowledgeReviewStatus | "any")
      ? rawStatus as RegionalKnowledgeReviewStatus | "any"
      : "draft";
    const limit = Math.max(1, Math.min(200, Number.parseInt(request.query.limit ?? "80", 10) || 80));
    const regionScope = request.query.regionScope?.trim() || "";
    const rows = await listCards({ status, limit, regionScope: regionScope || undefined });
    const body = `
<main class="rk-wrap">
  <header class="rk-top">
    <div>
      <h1>地域カード管理</h1>
      <p>出典候補を review に上げ、確認済みだけを approved / retrieval に進める。</p>
    </div>
  </header>
  ${renderFilters(status, regionScope)}
  <section class="rk-grid">${renderCards(rows)}</section>
</main>
<script>${SCRIPT}</script>`;
    return renderSiteDocument({
      basePath: "",
      title: "地域カード管理 — ikimon.life",
      extraStyles: STYLES,
      body,
    });
  });

  app.post<{
    Params: { cardId: string };
    Body: { reviewStatus?: string; qualityScore?: number };
  }>("/api/v1/admin/regional-knowledge/:cardId/status", async (request, reply) => {
    try {
      await assertRegionalKnowledgeAdminAccess(request);
      const nextStatus = request.body?.reviewStatus;
      if (!nextStatus || !VALID_STATUSES.includes(nextStatus as RegionalKnowledgeReviewStatus)) {
        reply.code(400);
        return { ok: false, error: "invalid_review_status" };
      }
      if (nextStatus === "any") {
        reply.code(400);
        return { ok: false, error: "invalid_review_status" };
      }
      const qualityScore = request.body?.qualityScore;
      await getPool().query(
        `update regional_knowledge_cards
            set review_status = $2,
                quality_score = case when $3::numeric is null then quality_score else greatest(0, least(1, $3::numeric)) end,
                updated_at = now()
          where card_id = $1`,
        [request.params.cardId, nextStatus, typeof qualityScore === "number" ? qualityScore : null],
      );
      return { ok: true, cardId: request.params.cardId, reviewStatus: nextStatus };
    } catch (error) {
      const message = error instanceof Error ? error.message : "regional_knowledge_update_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });
}
