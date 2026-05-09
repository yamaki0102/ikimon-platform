import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { getSiteEvidenceReport, monthPeriod, type SiteEvidenceReport } from "../services/siteEvidenceReport.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

const AIKAN_CERTIFICATION_ID = "aikan-renri-ikan-hq";

type SiteEvidenceQuery = {
  field_id?: string;
  month?: string;
};

type FieldFallbackRow = {
  field_id: string;
};

function loginGate(nextPath: string): string {
  return `
<div style="max-width:560px;margin:64px auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;font-family:-apple-system,system-ui,sans-serif;">
  <h2 style="margin-top:0;">月次 site evidence report は管理者専用</h2>
  <p style="color:#555;font-size:14px;">Aikan実証の補助資料を扱うため、アナリストまたは管理者ロールでログインしてください。</p>
  <p style="font-size:13px;"><a href="/login?next=${encodeURIComponent(nextPath)}">ログインへ</a></p>
</div>`;
}

function emptyState(message: string): string {
  return `
<main style="max-width:960px;margin:40px auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <h1 style="margin:0 0 12px;font-size:28px;">月次 site evidence report</h1>
  <p style="margin:0;color:#6b7280;">${escapeHtml(message)}</p>
</main>`;
}

function currentMonthLabel(now = new Date()): string {
  return monthPeriod(null, now).label;
}

function normalizeMonth(month: string | undefined): string {
  return monthPeriod(month, new Date()).label;
}

async function resolveFieldId(requestedFieldId: string | undefined): Promise<string | null> {
  const fieldId = requestedFieldId?.trim();
  if (fieldId) return fieldId;

  const pool = getPool();
  const aikan = await pool.query<FieldFallbackRow>(
    `select field_id::text as field_id
       from observation_fields
      where certification_id = $1
      order by updated_at desc
      limit 1`,
    [AIKAN_CERTIFICATION_ID],
  );
  if (aikan.rows[0]?.field_id) return aikan.rows[0].field_id;

  const latest = await pool.query<FieldFallbackRow>(
    `select field_id::text as field_id
       from observation_fields
      order by updated_at desc
      limit 1`,
  );
  return latest.rows[0]?.field_id ?? null;
}

function metricCard(label: string, value: number | string, note: string): string {
  return `
<div class="se-card">
  <div class="se-card-label">${escapeHtml(label)}</div>
  <div class="se-card-value">${escapeHtml(String(value))}</div>
  <div class="se-card-note">${escapeHtml(note)}</div>
</div>`;
}

function renderTopTaxa(report: SiteEvidenceReport): string {
  const rows = report.evidenceLayers.machineObservations.topTaxa;
  if (rows.length === 0) {
    return `<p class="se-muted">machine observation の分類候補はまだありません。</p>`;
  }
  return `
<table class="se-table">
  <thead><tr><th>taxon</th><th>count</th><th>review status</th></tr></thead>
  <tbody>
    ${rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.count}</td><td>${escapeHtml(row.reviewStatus)}</td></tr>`).join("")}
  </tbody>
</table>`;
}

function renderMethods(report: SiteEvidenceReport): string {
  const rows = report.evidenceLayers.machineObservations.methods;
  if (rows.length === 0) {
    return `<p class="se-muted">passive audio などの機械観測メソッドはまだ記録されていません。</p>`;
  }
  return `
<table class="se-table">
  <thead><tr><th>method</th><th>count</th></tr></thead>
  <tbody>
    ${rows.map((row) => `<tr><td>${escapeHtml(row.method)}</td><td>${row.count}</td></tr>`).join("")}
  </tbody>
</table>`;
}

function renderCalibrationAudit(report: SiteEvidenceReport): string {
  const rows = report.evidenceLayers.machineObservations.calibrationAudit;
  if (rows.length === 0) {
    return `<p class="se-muted">calibration registry 未適用: default threshold 0.9</p>`;
  }
  return `
<table class="se-table">
  <thead><tr><th>source</th><th>threshold</th><th>region</th><th>taxon</th><th>count</th></tr></thead>
  <tbody>
    ${rows.map((row) => {
      const sourceLabel = row.source === "registry" ? "registry" : "default threshold 0.9";
      return `<tr><td>${escapeHtml(sourceLabel)}</td><td>${row.threshold.toFixed(2)}</td><td>${escapeHtml(row.regionKey)}</td><td>${escapeHtml(row.taxonName)}</td><td>${row.count}</td></tr>`;
    }).join("")}
  </tbody>
</table>`;
}

function renderReadiness(report: SiteEvidenceReport): string {
  const blockers = report.readiness.blockers;
  const body = blockers.length === 0
    ? `<p class="se-ok">月次補助資料としての最低条件は満たしています。</p>`
    : `<ul class="se-list">${blockers.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join("")}</ul>`;
  return `
<section class="se-section">
  <h2>readiness / blockers</h2>
  ${body}
</section>`;
}

function renderClaimBoundary(report: SiteEvidenceReport): string {
  return `
<section class="se-section">
  <h2>claim boundary</h2>
  <div class="se-two">
    <div>
      <h3>言えること</h3>
      <ul class="se-list">${report.claimBoundary.canSay.map((claim) => `<li>${escapeHtml(claim)}</li>`).join("")}</ul>
    </div>
    <div>
      <h3>まだ言わないこと</h3>
      <ul class="se-list">${report.claimBoundary.cannotSayYet.map((claim) => `<li>${escapeHtml(claim)}</li>`).join("")}</ul>
    </div>
  </div>
</section>`;
}

function renderControls(report: SiteEvidenceReport, month: string): string {
  return `
<form class="se-controls" method="get" action="/admin/site-evidence">
  <label>field_id <input name="field_id" value="${escapeHtml(report.field.fieldId)}" /></label>
  <label>month <input name="month" value="${escapeHtml(month)}" pattern="\\d{4}-\\d{2}" /></label>
  <button type="submit">表示</button>
  <a href="${escapeHtml(report.printUrl)}">印刷用HTML</a>
  <a href="${escapeHtml(report.fieldSnapshotUrl)}">field snapshot JSON</a>
</form>`;
}

function renderReportBody(report: SiteEvidenceReport, month: string): string {
  const human = report.evidenceLayers.humanObservations;
  const machine = report.evidenceLayers.machineObservations;
  return `
<main class="se-wrap">
  <header class="se-hero">
    <div>
      <p class="se-eyebrow">Aikan Monthly Site Evidence Package</p>
      <h1>月次 site evidence report</h1>
      <p class="se-muted">用途: 補助資料。AI候補、reviewer検証済み、活動指標を分離して確認します。</p>
    </div>
    <div class="se-period">${escapeHtml(report.period.label)}</div>
  </header>
  ${renderControls(report, month)}
  <section class="se-section">
    <h2>${escapeHtml(report.field.name)}</h2>
    <p class="se-muted">${escapeHtml(report.field.locationLabel)} / verification: ${escapeHtml(report.field.verificationLevel)}</p>
  </section>
  <section class="se-grid">
    ${metricCard("人間観察", human.observations, `${human.visits} visits / ${human.uniqueTaxa} taxa`)}
    ${metricCard("機械観測", machine.observations, `${machine.uniqueMachineTaxa} machine taxa`)}
    ${metricCard("AI候補", machine.aiCandidates, "確定記録候補とは分けて扱う")}
    ${metricCard("reviewer検証済み", machine.reviewerVerified, "外部資料化の候補")}
    ${metricCard("却下", machine.rejected, "レビュー履歴として保持")}
    ${metricCard("passive audio", machine.passiveAudio, "音響由来の活動指標")}
    ${metricCard("machine effort metadata", machine.effortMetadata, "機械観測の努力量/稼働状態")}
    ${metricCard("活動指標", report.activityIndicators.seasonsCovered, `${report.activityIndicators.seasonLabels.join(", ") || "seasonなし"}`)}
    ${metricCard("human effort metadata", `${Math.round(human.effortCompletionRate * 100)}%`, "努力量の入力率")}
  </section>
  ${renderReadiness(report)}
  <section class="se-section">
    <h2>machine observation methods</h2>
    ${renderMethods(report)}
  </section>
  <section class="se-section">
    <h2>machine taxon lanes</h2>
    ${renderTopTaxa(report)}
  </section>
  <section class="se-section">
    <h2>calibration audit</h2>
    ${renderCalibrationAudit(report)}
  </section>
  ${renderClaimBoundary(report)}
</main>`;
}

function renderPrintBody(report: SiteEvidenceReport): string {
  const human = report.evidenceLayers.humanObservations;
  const machine = report.evidenceLayers.machineObservations;
  return `
<main class="se-print">
  <header>
    <p class="se-eyebrow">用途: 補助資料</p>
    <h1>月次 site evidence report</h1>
    <p>${escapeHtml(report.field.name)} / ${escapeHtml(report.period.label)}</p>
  </header>
  <section class="se-print-grid">
    ${metricCard("人間観察", human.observations, `${human.visits} visits / ${human.uniqueTaxa} taxa`)}
    ${metricCard("機械観測", machine.observations, `${machine.uniqueMachineTaxa} machine taxa`)}
    ${metricCard("AI候補", machine.aiCandidates, "活動指標")}
    ${metricCard("reviewer検証済み", machine.reviewerVerified, "確定記録候補")}
    ${metricCard("passive audio", machine.passiveAudio, "機械観測")}
    ${metricCard("machine effort metadata", machine.effortMetadata, "機械観測")}
    ${metricCard("blockers", report.readiness.blockers.length, report.readiness.blockers.join(", ") || "なし")}
  </section>
  <section>
    <h2>readiness</h2>
    ${renderReadiness(report)}
  </section>
  <section>
    <h2>calibration audit</h2>
    ${renderCalibrationAudit(report)}
  </section>
  ${renderClaimBoundary(report)}
</main>`;
}

const SITE_EVIDENCE_STYLES = `
.se-wrap{max-width:1120px;margin:32px auto;padding:0 18px 56px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827}
.se-hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:20px}
.se-hero h1,.se-print h1{margin:0;font-size:30px;line-height:1.25}
.se-eyebrow{margin:0 0 6px;color:#0f766e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.se-muted{color:#6b7280;font-size:14px}
.se-period{font-size:28px;font-weight:700;color:#0f766e}
.se-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:18px 0 24px;padding:14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
.se-controls label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#6b7280}
.se-controls input{min-width:220px;border:1px solid #d1d5db;border-radius:6px;padding:8px;font-size:14px}
.se-controls button,.se-controls a{height:38px;display:inline-flex;align-items:center;border:1px solid #0f766e;border-radius:6px;padding:0 12px;background:#0f766e;color:#fff;font-size:14px;text-decoration:none}
.se-controls a{background:#fff;color:#0f766e}
.se-section{margin:18px 0;padding:18px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
.se-section h2{margin:0 0 12px;font-size:18px}
.se-section h3{margin:0 0 8px;font-size:14px;color:#374151}
.se-grid,.se-print-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.se-card{border:1px solid #e5e7eb;border-radius:8px;background:#fff;padding:14px}
.se-card-label{font-size:12px;color:#6b7280}
.se-card-value{font-size:28px;font-weight:700;color:#111827}
.se-card-note{font-size:12px;color:#6b7280}
.se-table{width:100%;border-collapse:collapse;font-size:13px}
.se-table th,.se-table td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left}
.se-table th{font-size:11px;color:#6b7280;text-transform:uppercase;background:#f9fafb}
.se-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.se-list{margin:0;padding-left:18px;color:#374151;font-size:13px}
.se-ok{color:#047857;font-weight:600}
.se-print{max-width:190mm;margin:0 auto;padding:0;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
@media print{
  @page{size:A4 portrait;margin:14mm}
  body{background:#fff!important}
  .site-header,.site-footer,.bottom-nav,.global-record-launcher{display:none!important}
  .shell{padding:0!important}
  .se-print{max-width:none}
  .se-section,.se-card{break-inside:avoid}
}
`;

async function renderReportForQuery(query: SiteEvidenceQuery): Promise<{ report: SiteEvidenceReport | null; month: string; fieldId: string | null }> {
  const month = normalizeMonth(query.month ?? currentMonthLabel());
  const fieldId = await resolveFieldId(query.field_id);
  if (!fieldId) return { report: null, month, fieldId: null };
  const report = await getSiteEvidenceReport(fieldId, { month });
  return { report, month, fieldId };
}

export async function registerAdminSiteEvidenceRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: SiteEvidenceQuery }>("/admin/site-evidence", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "月次 site evidence report — ikimon.life",
        extraStyles: SITE_EVIDENCE_STYLES,
        body: loginGate("/admin/site-evidence"),
      });
    }

    const { report, month, fieldId } = await renderReportForQuery(request.query);
    if (!report) {
      reply.code(fieldId ? 404 : 200);
      return renderSiteDocument({
        basePath: "",
        title: "月次 site evidence report — ikimon.life",
        extraStyles: SITE_EVIDENCE_STYLES,
        body: emptyState(fieldId ? "指定fieldのレポートを生成できませんでした。" : "表示できるfieldがまだありません。"),
      });
    }

    return renderSiteDocument({
      basePath: "",
      title: "月次 site evidence report — ikimon.life",
      extraStyles: SITE_EVIDENCE_STYLES,
      body: renderReportBody(report, month),
    });
  });

  app.get<{ Querystring: SiteEvidenceQuery }>("/admin/site-evidence/print", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "月次 site evidence report 印刷 — ikimon.life",
        extraStyles: SITE_EVIDENCE_STYLES,
        body: loginGate("/admin/site-evidence/print"),
      });
    }

    const { report, fieldId } = await renderReportForQuery(request.query);
    if (!report) {
      reply.code(fieldId ? 404 : 200);
      return renderSiteDocument({
        basePath: "",
        title: "月次 site evidence report 印刷 — ikimon.life",
        extraStyles: SITE_EVIDENCE_STYLES,
        shellClassName: "print-surface",
        body: emptyState(fieldId ? "指定fieldの印刷用レポートを生成できませんでした。" : "表示できるfieldがまだありません。"),
      });
    }

    return renderSiteDocument({
      basePath: "",
      title: "月次 site evidence report 印刷 — ikimon.life",
      extraStyles: SITE_EVIDENCE_STYLES,
      shellClassName: "print-surface",
      body: renderPrintBody(report),
    });
  });
}
