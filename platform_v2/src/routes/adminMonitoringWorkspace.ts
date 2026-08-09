import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import { getSessionFromCookie } from "../services/authSession.js";
import type { MonitoringWorkspaceReportPurpose } from "../services/monitoringWorkspaceReadModel.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

type MonitoringWorkspaceQuery = {
  field_id?: string;
  start?: string;
  end?: string;
  purpose?: string;
  grid_step?: string;
  limit?: string;
};

type FieldFallbackRow = {
  field_id: string;
};

const PURPOSE_LABELS: Record<MonitoringWorkspaceReportPurpose, string> = {
  formal_report: "標準出力",
  identification_strengthening: "同定強化",
  area_strengthening: "エリア強化",
};

const QUEUE_LABELS = {
  identification_waiting: "同定待ち",
  evidence_insufficient: "根拠不足",
  area_coverage_attention: "エリア網羅/努力量",
  location_privacy_review: "位置制御確認",
  export_request: "出力準備",
} as const;

function loginGate(nextPath: string): string {
  return `
<div class="mw-login">
  <h2>Monitoring Workspace は管理者専用</h2>
  <p>アナリストまたは管理者ロールでログインしてください。</p>
  <p><a href="/login?next=${encodeURIComponent(nextPath)}">ログインへ</a></p>
</div>`;
}

function isoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function defaultStartDate(now = new Date()): string {
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return isoDateOnly(start);
}

function normalizePurpose(value: string | undefined): MonitoringWorkspaceReportPurpose {
  if (value === "identification_strengthening" || value === "area_strengthening" || value === "formal_report") {
    return value;
  }
  return "formal_report";
}

function normalizeGridStep(value: string | undefined): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : "0.01";
}

function normalizeLimit(value: string | undefined): string {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(Math.trunc(n)) : "500";
}

async function resolveFieldId(requestedFieldId: string | undefined): Promise<string> {
  const fieldId = requestedFieldId?.trim();
  if (fieldId) return fieldId;
  try {
    const pool = getPool();
    const latest = await pool.query<FieldFallbackRow>(
      `select field_id::text as field_id
         from observation_fields
        order by updated_at desc nulls last, created_at desc nulls last
        limit 1`,
    );
    return latest.rows[0]?.field_id ?? "";
  } catch {
    return "";
  }
}

function buildInitialState(query: MonitoringWorkspaceQuery, fieldId: string): string {
  const state = {
    fieldId,
    start: query.start || defaultStartDate(),
    end: query.end || isoDateOnly(new Date()),
    purpose: normalizePurpose(query.purpose),
    gridStep: normalizeGridStep(query.grid_step),
    limit: normalizeLimit(query.limit),
    purposes: PURPOSE_LABELS,
    queues: QUEUE_LABELS,
    apiPath: "/api/v1/monitoring/workspace/field",
  };
  return JSON.stringify(state).replace(/</g, "\\u003c");
}

function renderPurposeControls(activePurpose: MonitoringWorkspaceReportPurpose): string {
  return (Object.entries(PURPOSE_LABELS) as Array<[MonitoringWorkspaceReportPurpose, string]>)
    .map(([purpose, label]) => `
      <label class="mw-segment${purpose === activePurpose ? " is-active" : ""}">
        <input type="radio" name="purpose" value="${escapeHtml(purpose)}"${purpose === activePurpose ? " checked" : ""}>
        <span>${escapeHtml(label)}</span>
      </label>`)
    .join("");
}

function renderBody(query: MonitoringWorkspaceQuery, fieldId: string): string {
  const activePurpose = normalizePurpose(query.purpose);
  return `
<main class="mw-wrap" data-monitoring-workspace>
  <header class="mw-head">
    <div>
      <p class="mw-eyebrow">IKIMON Monitoring</p>
      <h1>Monitoring Workspace v0</h1>
      <p class="mw-muted">契約対象エリアの記録を、運用キューと分析モードで確認します。</p>
    </div>
    <div class="mw-status" data-status>待機中</div>
  </header>

  <form class="mw-controls" data-controls>
    <label>field_id
      <input name="field_id" value="${escapeHtml(fieldId)}" autocomplete="off" spellcheck="false" required>
    </label>
    <label>start
      <input name="start" type="date" value="${escapeHtml(query.start || defaultStartDate())}" required>
    </label>
    <label>end
      <input name="end" type="date" value="${escapeHtml(query.end || isoDateOnly(new Date()))}" required>
    </label>
    <label>grid_step
      <input name="grid_step" inputmode="decimal" value="${escapeHtml(normalizeGridStep(query.grid_step))}">
    </label>
    <label>limit
      <input name="limit" inputmode="numeric" value="${escapeHtml(normalizeLimit(query.limit))}">
    </label>
    <fieldset class="mw-purpose" aria-label="分析モード">
      ${renderPurposeControls(activePurpose)}
    </fieldset>
    <button class="mw-button" type="submit">表示</button>
  </form>

  <section class="mw-section">
    <div class="mw-section-head">
      <h2>サマリー</h2>
      <span data-workspace-label class="mw-muted"></span>
    </div>
    <div class="mw-kpis" data-summary></div>
  </section>

  <section class="mw-section">
    <div class="mw-section-head">
      <h2>運用キュー</h2>
      <span class="mw-muted">同定・根拠・エリア・位置・出力</span>
    </div>
    <div class="mw-queues" data-queues></div>
  </section>

  <section class="mw-two">
    <div class="mw-section">
      <div class="mw-section-head">
        <h2>分析モード readiness</h2>
        <span data-purpose-label class="mw-muted"></span>
      </div>
      <div data-readiness></div>
    </div>
    <div class="mw-section">
      <div class="mw-section-head">
        <h2>メッシュ状況</h2>
        <span class="mw-muted">記録密度・季節・努力量</span>
      </div>
      <div data-grid></div>
    </div>
  </section>

  <section class="mw-section">
    <div class="mw-section-head">
      <h2>記録一覧</h2>
      <span class="mw-muted">候補を正式指標に混ぜないための確認面</span>
    </div>
    <div data-records></div>
  </section>
</main>
<script id="monitoring-workspace-state" type="application/json">${buildInitialState(query, fieldId)}</script>
<script>
(() => {
  const state = JSON.parse(document.getElementById("monitoring-workspace-state").textContent || "{}");
  const root = document.querySelector("[data-monitoring-workspace]");
  if (!root) return;
  const form = root.querySelector("[data-controls]");
  const status = root.querySelector("[data-status]");
  const summaryEl = root.querySelector("[data-summary]");
  const queuesEl = root.querySelector("[data-queues]");
  const readinessEl = root.querySelector("[data-readiness]");
  const gridEl = root.querySelector("[data-grid]");
  const recordsEl = root.querySelector("[data-records]");
  const workspaceLabel = root.querySelector("[data-workspace-label]");
  const purposeLabel = root.querySelector("[data-purpose-label]");

  const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
  const pct = (value) => Math.round(Number(value || 0) * 100);
  const countQueues = (queues) => Object.values(queues || {}).reduce((sum, items) => sum + (Array.isArray(items) ? items.length : 0), 0);
  const badge = (value) => '<span class="mw-badge">' + escapeText(value) + '</span>';

  function paramsFromForm() {
    const data = new FormData(form);
    return new URLSearchParams({
      field_id: String(data.get("field_id") || "").trim(),
      start: String(data.get("start") || ""),
      end: String(data.get("end") || ""),
      purpose: String(data.get("purpose") || "formal_report"),
      grid_step: String(data.get("grid_step") || "0.01"),
      limit: String(data.get("limit") || "500"),
    });
  }

  function renderSummary(model) {
    const s = model.summary || {};
    const queueTotal = countQueues(model.operationQueues);
    const cards = [
      ["対象記録", s.scopedRecordCount ?? 0, "除外 " + (s.excludedRecordCount ?? 0)],
      ["確定", s.confirmedCount ?? 0, "正式指標候補"],
      ["候補", s.candidateCount ?? 0, "同定強化へ"],
      ["monitoring_ready", s.monitoringReadyCount ?? 0, "運用判断に利用可"],
      ["export_ready", s.exportReadyCount ?? 0, "外部出力候補"],
      ["メッシュ網羅", pct(s.meshCoverageRate) + "%", "運用キュー " + queueTotal],
      ["季節カバー", pct(s.seasonCoverageRate) + "%", "月/季節の偏り確認"],
      ["出力準備", s.outputPreparationReady ? "ready" : "pending", model.reportReadiness?.purpose || ""],
    ];
    summaryEl.innerHTML = cards.map(([label, value, note]) => '<div class="mw-kpi"><span>' + escapeText(label) + '</span><strong>' + escapeText(value) + '</strong><small>' + escapeText(note) + '</small></div>').join("");
  }

  function renderQueues(model) {
    const queues = model.operationQueues || {};
    queuesEl.innerHTML = Object.entries(state.queues).map(([key, label]) => {
      const items = Array.isArray(queues[key]) ? queues[key] : [];
      const rows = items.slice(0, 8).map((item) => '<li><strong>' + escapeText(item.targetId) + '</strong><span>' + escapeText((item.reasons || []).join(", ") || "review") + '</span></li>').join("");
      return '<section class="mw-queue"><div><h3>' + escapeText(label) + '</h3><b>' + items.length + '</b></div><ol>' + (rows || '<li class="mw-empty">該当なし</li>') + '</ol></section>';
    }).join("");
  }

  function renderReadiness(model) {
    const readiness = model.reportReadiness || {};
    purposeLabel.textContent = state.purposes[readiness.purpose] || readiness.purpose || "";
    readinessEl.innerHTML = '<div class="mw-readiness ' + (readiness.ready ? "is-ready" : "is-pending") + '"><strong>' + (readiness.ready ? "ready" : "pending") + '</strong></div>' +
      '<ul class="mw-checklist">' + (readiness.checklist || []).map((item) => '<li><span>' + (item.ready ? "✓" : "!") + '</span><div><strong>' + escapeText(item.label) + '</strong><small>' + escapeText((item.blockers || []).join(", ") || item.key) + '</small></div></li>').join("") + '</ul>';
  }

  function renderGrid(model) {
    const rows = (model.grid || []).slice().sort((a, b) => (b.recordCount - a.recordCount) || (b.candidateCount - a.candidateCount)).slice(0, 18);
    if (rows.length === 0) {
      gridEl.innerHTML = '<p class="mw-muted">表示できるメッシュがありません。</p>';
      return;
    }
    gridEl.innerHTML = '<table class="mw-table"><thead><tr><th>cell</th><th>status</th><th>records</th><th>effort</th><th>months</th><th>action</th></tr></thead><tbody>' +
      rows.map((cell) => '<tr><td><code>' + escapeText(cell.cellId) + '</code></td><td>' + badge(cell.detectionStatus) + '</td><td>' + escapeText(cell.recordCount) + ' / c' + escapeText(cell.candidateCount) + '</td><td>' + Math.round(Number(cell.effortMinutes || 0)) + 'm</td><td>' + escapeText((cell.months || []).join(" ")) + '</td><td>' + escapeText(cell.actionCue) + '</td></tr>').join("") +
      '</tbody></table>';
  }

  function renderRecords(model) {
    const rows = (model.records || []).slice(0, 40);
    if (rows.length === 0) {
      recordsEl.innerHTML = '<p class="mw-muted">対象記録がありません。</p>';
      return;
    }
    recordsEl.innerHTML = '<table class="mw-table"><thead><tr><th>record</th><th>month</th><th>detection</th><th>verification</th><th>ready</th><th>queues</th></tr></thead><tbody>' +
      rows.map((record) => '<tr><td><code>' + escapeText(record.recordId) + '</code></td><td>' + escapeText(record.month) + '</td><td>' + badge(record.detectionStatus) + '</td><td>' + escapeText(record.verificationState) + '</td><td>' + (record.monitoringReady ? "monitoring" : "-") + " / " + (record.exportReady ? "export" : "-") + '</td><td>' + escapeText((record.queueKeys || []).join(", ")) + '</td></tr>').join("") +
      '</tbody></table>';
  }

  async function load() {
    const params = paramsFromForm();
    if (!params.get("field_id")) {
      status.textContent = "field_id 未指定";
      return;
    }
    status.textContent = "読み込み中";
    const url = state.apiPath + "?" + params.toString();
    history.replaceState(null, "", "/admin/monitoring-workspace?" + params.toString());
    const response = await fetch(url, { headers: { "accept": "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      status.textContent = "error";
      summaryEl.innerHTML = '<p class="mw-error">' + escapeText(payload.error || response.statusText) + '</p>';
      queuesEl.innerHTML = "";
      readinessEl.innerHTML = "";
      gridEl.innerHTML = "";
      recordsEl.innerHTML = "";
      return;
    }
    const model = payload.model;
    status.textContent = "loaded";
    workspaceLabel.textContent = [model.workspace?.label, model.workspace?.areaLabel].filter(Boolean).join(" / ");
    renderSummary(model);
    renderQueues(model);
    renderReadiness(model);
    renderGrid(model);
    renderRecords(model);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void load();
  });
  for (const input of form.querySelectorAll('input[name="purpose"]')) {
    input.addEventListener("change", () => void load());
  }
  void load();
})();
</script>`;
}

const MONITORING_WORKSPACE_STYLES = `
.mw-wrap{max-width:1280px;margin:32px auto;padding:0 18px 56px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827}
.mw-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px}
.mw-head h1{margin:0;font-size:28px;line-height:1.2}
.mw-eyebrow{margin:0 0 6px;color:#0f766e;font-size:12px;font-weight:800;text-transform:uppercase}
.mw-muted{margin:4px 0 0;color:#6b7280;font-size:13px}
.mw-status{min-width:104px;text-align:center;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;background:#fff;color:#374151;font-size:12px;font-weight:800}
.mw-controls{display:grid;grid-template-columns:minmax(220px,2fr) repeat(4,minmax(112px,1fr)) auto;gap:10px;align-items:end;margin:18px 0 18px;padding:14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
.mw-controls label{display:grid;gap:4px;color:#6b7280;font-size:12px;font-weight:700}
.mw-controls input{min-height:38px;border:1px solid #d1d5db;border-radius:6px;padding:7px 9px;color:#111827;font-size:14px}
.mw-purpose{grid-column:1 / -2;display:flex;flex-wrap:wrap;gap:8px;border:0;margin:0;padding:0}
.mw-segment input{position:absolute;opacity:0;pointer-events:none}
.mw-segment span{display:inline-flex;align-items:center;min-height:34px;border:1px solid #d1d5db;border-radius:6px;padding:0 12px;background:#fff;color:#374151;font-size:13px;font-weight:800}
.mw-segment.is-active span,.mw-segment input:checked + span{border-color:#0f766e;background:#ecfdf5;color:#047857}
.mw-button{min-height:38px;border:1px solid #0f766e;border-radius:6px;background:#0f766e;color:#fff;padding:0 14px;font-size:14px;font-weight:800;cursor:pointer}
.mw-section{margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
.mw-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.mw-section h2{margin:0;font-size:17px}
.mw-two{display:grid;grid-template-columns:minmax(320px,.85fr) minmax(0,1.15fr);gap:16px;align-items:start}
.mw-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(142px,1fr));gap:10px}
.mw-kpi{display:grid;gap:4px;border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#f9fafb}
.mw-kpi span,.mw-kpi small{color:#6b7280;font-size:12px}
.mw-kpi strong{font-size:24px;line-height:1.1}
.mw-queues{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
.mw-queue{border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#f9fafb;min-width:0}
.mw-queue>div{display:flex;justify-content:space-between;gap:8px;align-items:center}
.mw-queue h3{margin:0;font-size:13px;color:#374151}
.mw-queue b{font-size:22px}
.mw-queue ol{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:8px}
.mw-queue li{display:grid;gap:2px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:12px}
.mw-queue li strong{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;overflow-wrap:anywhere}
.mw-queue li span{color:#6b7280;overflow-wrap:anywhere}
.mw-empty{color:#047857}
.mw-readiness{display:inline-flex;align-items:center;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:13px;font-weight:900}
.mw-readiness.is-ready{background:#ecfdf5;color:#047857}
.mw-readiness.is-pending{background:#fff7ed;color:#c2410c}
.mw-checklist{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.mw-checklist li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:start;border:1px solid #e5e7eb;border-radius:8px;padding:9px}
.mw-checklist span{display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:#f3f4f6;font-weight:900}
.mw-checklist strong{display:block;font-size:13px}
.mw-checklist small{display:block;margin-top:2px;color:#6b7280;font-size:11px;overflow-wrap:anywhere}
.mw-table{width:100%;border-collapse:collapse;font-size:12px}
.mw-table th,.mw-table td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
.mw-table th{background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase}
.mw-table code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;overflow-wrap:anywhere}
.mw-badge{display:inline-flex;align-items:center;border-radius:999px;padding:2px 7px;background:#eef2ff;color:#3730a3;font-size:11px;font-weight:800;white-space:nowrap}
.mw-error{border:1px solid #fecaca;border-radius:8px;background:#fef2f2;color:#991b1b;padding:10px;font-size:13px}
.mw-login{max-width:560px;margin:64px auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.mw-login h2{margin-top:0}
.mw-login p{color:#555;font-size:14px}
@media(max-width:980px){
  .mw-head{align-items:flex-start;flex-direction:column}
  .mw-controls{grid-template-columns:1fr 1fr}
  .mw-purpose{grid-column:1 / -1}
  .mw-button{grid-column:1 / -1}
  .mw-two{grid-template-columns:1fr}
}
@media(max-width:640px){
  .mw-controls{grid-template-columns:1fr}
  .mw-section-head{align-items:flex-start;flex-direction:column}
}
`;

export async function registerAdminMonitoringWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: MonitoringWorkspaceQuery }>("/admin/monitoring-workspace", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "Monitoring Workspace — ZUKAN",
        extraStyles: MONITORING_WORKSPACE_STYLES,
        body: loginGate("/admin/monitoring-workspace"),
      });
    }

    const fieldId = await resolveFieldId(request.query.field_id);
    return renderSiteDocument({
      basePath: "",
      title: "Monitoring Workspace — ZUKAN",
      extraStyles: MONITORING_WORKSPACE_STYLES,
      body: renderBody(request.query, fieldId),
    });
  });
}

export const adminMonitoringWorkspaceRouteContract = {
  path: "/admin/monitoring-workspace",
  apiPath: "/api/v1/monitoring/workspace/field",
  queues: Object.keys(QUEUE_LABELS),
  purposes: Object.keys(PURPOSE_LABELS),
  guard: "admin_or_analyst_session",
  writesData: false,
} as const;
