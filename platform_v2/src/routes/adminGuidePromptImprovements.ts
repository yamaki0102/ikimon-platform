import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  listGuideHypothesisPromptImprovementQueue,
  listGuideHypothesisPromptImprovements,
  updateGuideHypothesisPromptImprovementQueueStatus,
  updateGuideHypothesisPromptImprovementReviewStatus,
} from "../services/guideHypothesisPromptImprovements.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

type ReviewStatus = "auto" | "needs_review" | "reviewed" | "rejected";
type QueueStatus = "open" | "in_review" | "resolved" | "dismissed";

const REVIEW_STATUSES: ReadonlyArray<ReviewStatus | "any"> = ["needs_review", "auto", "reviewed", "rejected", "any"];
const QUEUE_STATUSES: ReadonlyArray<QueueStatus> = ["open", "in_review", "resolved", "dismissed"];

function adminErrorStatus(message: string): number {
  if (message === "forbidden" || message === "forbidden_privileged_write") return 403;
  if (message === "privileged_write_api_key_not_configured") return 503;
  if (message.endsWith("_required") || message.startsWith("invalid_")) return 400;
  return 500;
}

async function assertAdminAccess(request: FastifyRequest): Promise<{ reviewerUserId: string; via: "session" | "write_key" }> {
  const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
  if (session && !session.banned && isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
    return { reviewerUserId: session.userId, via: "session" };
  }
  assertPrivilegedWriteAccess(request);
  return { reviewerUserId: "system_write_key", via: "write_key" };
}

function loginGate(): string {
  return `
<div class="gpi-login">
  <h2>ガイド改善レビューは管理者専用</h2>
  <p>helpful/wrong は地域仮説の証拠ではなく、次回観察指示の改善候補として確認します。</p>
  <p><a href="/login?next=${encodeURIComponent("/admin/guide-prompt-improvements")}">ログインへ</a></p>
</div>`;
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    auto: "#64748b",
    needs_review: "#f59e0b",
    reviewed: "#16a34a",
    rejected: "#dc2626",
    open: "#f59e0b",
    in_review: "#2563eb",
    resolved: "#16a34a",
    dismissed: "#64748b",
  };
  return `<span class="gpi-badge" style="background:${colors[status] ?? "#64748b"}">${escapeHtml(status)}</span>`;
}

function renderFilters(status: string): string {
  const options = REVIEW_STATUSES.map((item) => `<option value="${item}" ${item === status ? "selected" : ""}>${item}</option>`).join("");
  return `
<form class="gpi-filter" method="get">
  <label>review <select name="status">${options}</select></label>
  <button type="submit">絞り込み</button>
</form>`;
}

function renderQueue(rows: Awaited<ReturnType<typeof listGuideHypothesisPromptImprovementQueue>>): string {
  if (rows.length === 0) return `<p class="gpi-empty">wrong feedback の閾値を超えた改善対象はありません。</p>`;
  return rows.map((row) => {
    const actions = QUEUE_STATUSES.filter((status) => status !== row.queueStatus)
      .map((status) => `<button type="button" data-queue-id="${escapeHtml(row.queueId)}" data-queue-status="${status}">${status}</button>`)
      .join("");
    const missing = Array.isArray(row.evidence.commonMissingData) ? row.evidence.commonMissingData.map(String).slice(0, 6).join(" / ") : "";
    return `
<article class="gpi-queue-card">
  <div class="gpi-card-head">
    <div>
      <div class="gpi-meta">${escapeHtml(row.trigger)} / threshold ${row.thresholdCount}</div>
      <h2>${escapeHtml(row.claimType || "global")}</h2>
    </div>
    ${statusBadge(row.queueStatus)}
  </div>
  <p><strong>${row.wrongCount}</strong> 件の wrong feedback があり、次回観察指示の改善対象です。</p>
  ${missing ? `<div class="gpi-hooks">${escapeHtml(missing)}</div>` : ""}
  <div class="gpi-actions">${actions}</div>
</article>`;
  }).join("");
}

function renderImprovements(rows: Awaited<ReturnType<typeof listGuideHypothesisPromptImprovements>>): string {
  if (rows.length === 0) return `<p class="gpi-empty">該当する改善候補はありません。</p>`;
  return rows.map((row) => {
    const nextStatuses: ReviewStatus[] = row.reviewStatus === "needs_review"
      ? ["reviewed", "rejected", "auto"]
      : row.reviewStatus === "reviewed"
        ? ["needs_review", "rejected"]
        : row.reviewStatus === "rejected"
          ? ["needs_review"]
          : ["needs_review", "reviewed", "rejected"];
    const actions = nextStatuses
      .map((status) => `<button type="button" data-improvement-id="${escapeHtml(row.improvementId)}" data-review-status="${status}">${status}</button>`)
      .join("");
    return `
<article class="gpi-card">
  <div class="gpi-card-head">
    <div>
      <div class="gpi-meta">${escapeHtml(row.label)} / ${escapeHtml(row.improvementType)} / ${escapeHtml(row.claimType || "global")}</div>
      <h2>${escapeHtml(row.recommendation)}</h2>
    </div>
    ${statusBadge(row.reviewStatus)}
  </div>
  <pre>${escapeHtml(row.promptPatch)}</pre>
  <div class="gpi-foot">
    <span>support ${row.supportCount}</span>
    <span>${escapeHtml(row.trigger)}</span>
    <span>${escapeHtml(row.generatedAt)}</span>
  </div>
  <div class="gpi-actions">${actions}</div>
</article>`;
  }).join("");
}

const STYLES = `
body{background:#f8fafc;color:#172033;}
.gpi-login{max-width:560px;margin:64px auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-family:-apple-system,system-ui,sans-serif;}
.gpi-wrap{max-width:1160px;margin:0 auto;padding:32px 18px 72px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
.gpi-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:18px;}
.gpi-top h1{font-size:28px;line-height:1.25;margin:0;color:#111827;}
.gpi-top p{margin:6px 0 0;color:#475569;font-size:14px;line-height:1.7;}
.gpi-filter{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin:0 0 18px;padding:14px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;}
.gpi-filter label{display:grid;gap:4px;font-size:12px;color:#475569;text-transform:uppercase;}
.gpi-filter select{min-height:36px;border:1px solid #cbd5e1;border-radius:6px;padding:0 10px;background:#fff;}
.gpi-filter button,.gpi-actions button{min-height:36px;border:1px solid #0f766e;border-radius:6px;background:#0f766e;color:#fff;padding:0 12px;font-weight:800;cursor:pointer;}
.gpi-section{display:grid;gap:12px;margin-bottom:22px;}
.gpi-section h2{font-size:18px;margin:0;color:#111827;}
.gpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px;}
.gpi-card,.gpi-queue-card{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:16px;display:grid;gap:10px;}
.gpi-queue-card{background:#fffdf7;border-color:#fde68a;}
.gpi-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;}
.gpi-card h2,.gpi-queue-card h2{font-size:15px;line-height:1.55;margin:3px 0 0;color:#111827;}
.gpi-card p,.gpi-queue-card p{margin:0;color:#334155;font-size:14px;line-height:1.7;}
.gpi-meta,.gpi-foot{font-size:12px;color:#64748b;}
.gpi-badge{display:inline-flex;align-items:center;border-radius:999px;color:#fff;font-size:11px;font-weight:900;padding:3px 9px;text-transform:uppercase;}
.gpi-card pre{margin:0;white-space:pre-wrap;word-break:break-word;border:1px solid #e2e8f0;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:10px;font-size:11px;line-height:1.55;}
.gpi-hooks{font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px;line-height:1.65;}
.gpi-foot{display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid #f1f5f9;padding-top:10px;}
.gpi-actions{display:flex;gap:8px;flex-wrap:wrap;}
.gpi-actions button[data-review-status="rejected"],.gpi-actions button[data-queue-status="dismissed"]{border-color:#dc2626;background:#dc2626;}
.gpi-empty{color:#64748b;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;}
`;

const SCRIPT = `
document.addEventListener("click", async (event) => {
  const improvementButton = event.target.closest("[data-improvement-id][data-review-status]");
  if (improvementButton) {
    improvementButton.disabled = true;
    try {
      const res = await fetch("/api/v1/admin/guide-prompt-improvements/" + encodeURIComponent(improvementButton.dataset.improvementId) + "/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reviewStatus: improvementButton.dataset.reviewStatus })
      });
      if (!res.ok) throw new Error(await res.text());
      location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
      improvementButton.disabled = false;
    }
    return;
  }
  const queueButton = event.target.closest("[data-queue-id][data-queue-status]");
  if (queueButton) {
    queueButton.disabled = true;
    try {
      const res = await fetch("/api/v1/admin/guide-prompt-improvement-queue/" + encodeURIComponent(queueButton.dataset.queueId) + "/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queueStatus: queueButton.dataset.queueStatus })
      });
      if (!res.ok) throw new Error(await res.text());
      location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
      queueButton.disabled = false;
    }
  }
});
`;

export async function registerAdminGuidePromptImprovementRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { status?: string; limit?: string } }>("/admin/guide-prompt-improvements", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "ガイド改善レビュー — ikimon.life",
        extraStyles: STYLES,
        body: loginGate(),
      });
    }
    const rawStatus = request.query.status ?? "needs_review";
    const status = REVIEW_STATUSES.includes(rawStatus as ReviewStatus | "any") ? rawStatus as ReviewStatus | "any" : "needs_review";
    const limit = Math.max(1, Math.min(50, Number.parseInt(request.query.limit ?? "30", 10) || 30));
    const [queueRows, improvements] = await Promise.all([
      listGuideHypothesisPromptImprovementQueue(20),
      listGuideHypothesisPromptImprovements(limit, { reviewStatus: status }),
    ]);
    const body = `
<main class="gpi-wrap">
  <header class="gpi-top">
    <div>
      <h1>ガイド改善レビュー</h1>
      <p>wrong が閾値を超えた claim_type を改善対象として扱い、prompt patch は人間レビュー後に使います。</p>
    </div>
  </header>
  ${renderFilters(status)}
  <section class="gpi-section">
    <h2>改善対象キュー</h2>
    <div class="gpi-grid">${renderQueue(queueRows)}</div>
  </section>
  <section class="gpi-section">
    <h2>prompt 改善候補</h2>
    <div class="gpi-grid">${renderImprovements(improvements)}</div>
  </section>
</main>
<script>${SCRIPT}</script>`;
    return renderSiteDocument({
      basePath: "",
      title: "ガイド改善レビュー — ikimon.life",
      extraStyles: STYLES,
      body,
    });
  });

  app.post<{ Params: { improvementId: string }; Body: { reviewStatus?: string } }>(
    "/api/v1/admin/guide-prompt-improvements/:improvementId/status",
    async (request, reply) => {
      try {
        await assertAdminAccess(request);
        const nextStatus = request.body?.reviewStatus;
        if (!nextStatus || !REVIEW_STATUSES.includes(nextStatus as ReviewStatus) || nextStatus === "any") {
          reply.code(400);
          return { ok: false, error: "invalid_review_status" };
        }
        const updated = await updateGuideHypothesisPromptImprovementReviewStatus(request.params.improvementId, nextStatus as ReviewStatus);
        return { ok: updated, improvementId: request.params.improvementId, reviewStatus: nextStatus };
      } catch (error) {
        const message = error instanceof Error ? error.message : "guide_prompt_improvement_update_failed";
        reply.code(adminErrorStatus(message));
        return { ok: false, error: message };
      }
    },
  );

  app.post<{ Params: { queueId: string }; Body: { queueStatus?: string } }>(
    "/api/v1/admin/guide-prompt-improvement-queue/:queueId/status",
    async (request, reply) => {
      try {
        await assertAdminAccess(request);
        const nextStatus = request.body?.queueStatus;
        if (!nextStatus || !QUEUE_STATUSES.includes(nextStatus as QueueStatus)) {
          reply.code(400);
          return { ok: false, error: "invalid_queue_status" };
        }
        const updated = await updateGuideHypothesisPromptImprovementQueueStatus(request.params.queueId, nextStatus as QueueStatus);
        return { ok: updated, queueId: request.params.queueId, queueStatus: nextStatus };
      } catch (error) {
        const message = error instanceof Error ? error.message : "guide_prompt_improvement_queue_update_failed";
        reply.code(adminErrorStatus(message));
        return { ok: false, error: message };
      }
    },
  );
}
