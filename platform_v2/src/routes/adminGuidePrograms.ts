import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  getGuideProgramEditorState,
  upsertGuideProgram,
  type GuideProgramAdminItem,
  type GuideProgramAssignableSpot,
} from "../services/guidePrograms.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { assertPrivilegedWriteAccess } from "../services/writeGuards.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function adminErrorStatus(message: string): number {
  if (message === "forbidden" || message === "forbidden_privileged_write") return 403;
  if (message === "privileged_write_api_key_not_configured") return 503;
  if (message.endsWith("_required") || message.startsWith("invalid_")) return 400;
  return 500;
}

async function assertGuideProgramAdminAccess(request: FastifyRequest): Promise<{ actorUserId: string | null; via: "session" | "write_key" }> {
  const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
  if (session && !session.banned && isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
    return { actorUserId: session.userId, via: "session" };
  }
  assertPrivilegedWriteAccess(request);
  return { actorUserId: null, via: "write_key" };
}

function loginGate(): string {
  return `
<div class="gpe-login">
  <h2>ガイドリレー企画は管理者専用</h2>
  <p>現地ガイドの解放企画を作成、公開、停止する運用画面です。</p>
  <p><a href="/login?next=${encodeURIComponent("/admin/guide-programs")}">ログインへ</a></p>
</div>`;
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    published: "#15803d",
    draft: "#64748b",
    paused: "#b45309",
    closed: "#991b1b",
  };
  return `<span class="gpe-badge" style="background:${colors[status] ?? "#64748b"}">${escapeHtml(status)}</span>`;
}

function option(value: string, current: string, label = value): string {
  return `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function datetimeLocal(value: string | null): string {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  return new Date(time).toISOString().slice(0, 16);
}

function spotPicker(spots: GuideProgramAssignableSpot[], program?: GuideProgramAdminItem): string {
  const selected = new Map((program?.spots ?? []).map((spot) => [spot.id, spot.sortOrder]));
  return spots.map((spot, index) => {
    const isSelected = selected.has(spot.id);
    const order = selected.get(spot.id) ?? (index + 1) * 10;
    return `
<label class="gpe-spot">
  <input type="checkbox" name="guideSpotIds" value="${escapeHtml(spot.id)}" ${isSelected ? "checked" : ""}>
  <input class="gpe-order" type="number" name="spotOrder:${escapeHtml(spot.id)}" value="${order}" min="0" step="10" aria-label="${escapeHtml(spot.title)} の順序">
  <span>
    <strong>${escapeHtml(spot.title)}</strong>
    <small>${escapeHtml(spot.subtitle)} / ${escapeHtml(spot.ownerType)} / ${escapeHtml(spot.availableTimePolicy)}</small>
  </span>
</label>`;
  }).join("");
}

function renderProgramForm(spots: GuideProgramAssignableSpot[], program?: GuideProgramAdminItem): string {
  const isEdit = Boolean(program);
  const status = program?.status ?? "draft";
  const ownerType = program?.ownerType ?? "community";
  const participationMode = program?.participationMode ?? "any_order";
  return `
<form class="gpe-form" data-program-form ${program ? `data-program-id="${escapeHtml(program.programId)}"` : ""}>
  <div class="gpe-form-head">
    <div>
      <h2>${isEdit ? escapeHtml(program?.title) : "新しいガイドリレー企画"}</h2>
      ${program ? `<p>${escapeHtml(program.programId)} / ${escapeHtml(program.updatedAt)}</p>` : "<p>既存の現地ガイドスポットを束ねて、記録投稿で解放される企画を作ります。</p>"}
    </div>
    ${program ? statusBadge(program.status) : statusBadge("draft")}
  </div>
  <div class="gpe-fields">
    <label>program id<input name="programId" value="${escapeHtml(program?.programId ?? "")}" ${isEdit ? "readonly" : ""} placeholder="miyakoda-guide-relay" required></label>
    <label>slug<input name="slug" value="${escapeHtml(program?.slug ?? "")}" placeholder="miyakoda-guide-relay" required></label>
    <label>title<input name="title" value="${escapeHtml(program?.title ?? "")}" placeholder="都田ガイドリレー" required></label>
    <label>owner<select name="ownerType">${["owner", "community", "municipality", "school"].map((item) => option(item, ownerType)).join("")}</select></label>
    <label>mode<select name="participationMode">${option("any_order", participationMode, "any order")}${option("ordered", participationMode, "ordered")}</select></label>
    <label>status<select name="status">${["draft", "published", "paused", "closed"].map((item) => option(item, status)).join("")}</select></label>
    <label>starts<input name="startsAt" type="datetime-local" value="${escapeHtml(datetimeLocal(program?.startsAt ?? null))}"></label>
    <label>ends<input name="endsAt" type="datetime-local" value="${escapeHtml(datetimeLocal(program?.endsAt ?? null))}"></label>
  </div>
  <label class="gpe-summary">summary<textarea name="publicSummary" rows="3" maxlength="600">${escapeHtml(program?.publicSummary ?? "")}</textarea></label>
  <section class="gpe-spot-picker">
    <h3>ガイドスポット</h3>
    <p>公開済み、安全確認済み、学校以外、土地同意ありのスポットだけを選べます。</p>
    <div>${spotPicker(spots, program)}</div>
  </section>
  <div class="gpe-actions">
    <button type="submit">${isEdit ? "更新" : "作成"}</button>
    <span data-program-result></span>
  </div>
</form>`;
}

function renderPrograms(programs: GuideProgramAdminItem[], spots: GuideProgramAssignableSpot[]): string {
  const cards = programs.map((program) => renderProgramForm(spots, program)).join("");
  return cards || `<p class="gpe-empty">まだガイドリレー企画はありません。</p>`;
}

const STYLES = `
body{background:#f8fafc;color:#172033;}
.gpe-login{max-width:560px;margin:64px auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-family:-apple-system,system-ui,sans-serif;}
.gpe-wrap{max-width:1180px;margin:0 auto;padding:32px 18px 72px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
.gpe-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:18px;}
.gpe-top h1{font-size:28px;line-height:1.25;margin:0;color:#111827;}
.gpe-top p{margin:6px 0 0;color:#475569;font-size:14px;line-height:1.7;}
.gpe-grid{display:grid;grid-template-columns:minmax(320px,420px) 1fr;gap:16px;align-items:start;}
.gpe-stack{display:grid;gap:14px;}
.gpe-form{border:1px solid #dbe3ef;background:#fff;border-radius:8px;padding:16px;display:grid;gap:14px;}
.gpe-form-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #eef2f7;padding-bottom:12px;}
.gpe-form-head h2{font-size:17px;line-height:1.35;margin:0;color:#111827;}
.gpe-form-head p{margin:4px 0 0;color:#64748b;font-size:12px;line-height:1.5;}
.gpe-badge{display:inline-flex;align-items:center;border-radius:999px;color:#fff;font-size:11px;font-weight:900;padding:3px 9px;text-transform:uppercase;}
.gpe-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.gpe-form label{display:grid;gap:4px;font-size:12px;color:#475569;text-transform:uppercase;font-weight:800;}
.gpe-form input,.gpe-form select,.gpe-form textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#111827;min-height:36px;padding:7px 9px;font:inherit;font-size:14px;}
.gpe-form textarea{line-height:1.55;resize:vertical;}
.gpe-summary{display:grid;}
.gpe-spot-picker{display:grid;gap:10px;}
.gpe-spot-picker h3{font-size:14px;margin:0;color:#111827;}
.gpe-spot-picker p{font-size:12px;color:#64748b;margin:0;line-height:1.6;}
.gpe-spot-picker>div{display:grid;gap:8px;max-height:360px;overflow:auto;padding-right:4px;}
.gpe-spot{grid-template-columns:18px 64px 1fr;align-items:center;border:1px solid #e2e8f0;border-radius:6px;padding:8px;background:#f8fafc;text-transform:none!important;font-weight:500!important;}
.gpe-spot input[type="checkbox"]{min-height:18px;padding:0;}
.gpe-order{min-height:30px!important;padding:4px 6px!important;font-size:12px!important;}
.gpe-spot strong{display:block;color:#0f172a;font-size:13px;line-height:1.4;}
.gpe-spot small{display:block;color:#64748b;font-size:11px;line-height:1.5;margin-top:2px;}
.gpe-actions{display:flex;align-items:center;gap:10px;border-top:1px solid #eef2f7;padding-top:12px;}
.gpe-actions button{min-height:38px;border:1px solid #0f766e;border-radius:6px;background:#0f766e;color:#fff;padding:0 14px;font-weight:900;cursor:pointer;}
.gpe-actions span{font-size:12px;color:#475569;}
.gpe-empty{color:#64748b;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;}
@media (max-width:860px){.gpe-grid{grid-template-columns:1fr}.gpe-fields{grid-template-columns:1fr}.gpe-top{display:block}.gpe-spot{grid-template-columns:18px 56px 1fr}}
`;

const SCRIPT = `
function collectProgramPayload(form) {
  const data = new FormData(form);
  const selected = data.getAll("guideSpotIds").map(String).map((id) => ({
    id,
    order: Number(data.get("spotOrder:" + id) || 0)
  })).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)).map((item) => item.id);
  return {
    programId: String(data.get("programId") || ""),
    slug: String(data.get("slug") || ""),
    title: String(data.get("title") || ""),
    ownerType: String(data.get("ownerType") || "community"),
    participationMode: String(data.get("participationMode") || "any_order"),
    status: String(data.get("status") || "draft"),
    startsAt: String(data.get("startsAt") || ""),
    endsAt: String(data.get("endsAt") || ""),
    publicSummary: String(data.get("publicSummary") || ""),
    guideSpotIds: selected
  };
}
document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-program-form]");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  const result = form.querySelector("[data-program-result]");
  button.disabled = true;
  result.textContent = "saving...";
  const payload = collectProgramPayload(form);
  const programId = form.dataset.programId || "";
  const endpoint = programId ? "/api/v1/admin/guide-programs/" + encodeURIComponent(programId) : "/api/v1/admin/guide-programs";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.error || "guide_program_save_failed");
    result.textContent = "saved";
    setTimeout(() => location.reload(), 350);
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : String(error);
    button.disabled = false;
  }
});
`;

export async function registerAdminGuideProgramRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/guide-programs", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "ガイドリレー企画 — ikimon.life",
        extraStyles: STYLES,
        body: loginGate(),
      });
    }

    const state = await getGuideProgramEditorState();
    const body = `
<main class="gpe-wrap">
  <header class="gpe-top">
    <div>
      <h1>ガイドリレー企画</h1>
      <p>記録投稿で解放される現地ガイドの企画を作成、公開、停止します。解放は非公開で、位置表示は粗く扱います。</p>
    </div>
  </header>
  <section class="gpe-grid">
    <div>${renderProgramForm(state.guideSpots)}</div>
    <div class="gpe-stack">${renderPrograms(state.programs, state.guideSpots)}</div>
  </section>
</main>
<script>${SCRIPT}</script>`;
    return renderSiteDocument({
      basePath: "",
      title: "ガイドリレー企画 — ikimon.life",
      extraStyles: STYLES,
      body,
    });
  });

  app.get("/api/v1/admin/guide-programs", async (request, reply) => {
    try {
      await assertGuideProgramAdminAccess(request);
      return { ok: true, ...(await getGuideProgramEditorState()) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "guide_program_admin_read_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.post<{ Body: Record<string, unknown> }>("/api/v1/admin/guide-programs", async (request, reply) => {
    try {
      const access = await assertGuideProgramAdminAccess(request);
      const program = await upsertGuideProgram(request.body ?? {}, access.actorUserId);
      return { ok: true, program };
    } catch (error) {
      const message = error instanceof Error ? error.message : "guide_program_admin_create_failed";
      reply.code(adminErrorStatus(message));
      return { ok: false, error: message };
    }
  });

  app.post<{ Params: { programId: string }; Body: Record<string, unknown> }>(
    "/api/v1/admin/guide-programs/:programId",
    async (request, reply) => {
      try {
        const access = await assertGuideProgramAdminAccess(request);
        const program = await upsertGuideProgram(
          { ...(request.body ?? {}), programId: request.params.programId },
          access.actorUserId,
        );
        return { ok: true, program };
      } catch (error) {
        const message = error instanceof Error ? error.message : "guide_program_admin_update_failed";
        reply.code(adminErrorStatus(message));
        return { ok: false, error: message };
      }
    },
  );
}
