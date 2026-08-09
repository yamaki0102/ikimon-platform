import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  getLenriAreaIntelligenceSnapshotWithLiveEffort,
  type LenriAreaIntelligenceSnapshot,
} from "../services/lenriAreaIntelligence.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function loginGate(nextPath: string): string {
  return `
<div class="lai-login">
  <h2>Lenri area intelligence は管理者専用</h2>
  <p>PDI契約判断と有料レポート補助情報を含むため、アナリストまたは管理者ロールでログインしてください。</p>
  <p><a href="/login?next=${encodeURIComponent(nextPath)}">ログインへ</a></p>
</div>`;
}

function metricCard(label: string, value: string | number, note: string): string {
  return `
<div class="lai-card">
  <span>${escapeHtml(label)}</span>
  <strong>${escapeHtml(String(value))}</strong>
  <small>${escapeHtml(note)}</small>
</div>`;
}

function renderList(items: string[]): string {
  return `<ul class="lai-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderRings(snapshot: LenriAreaIntelligenceSnapshot): string {
  return `
<div class="lai-rings">
  ${snapshot.rings
    .map(
      (ring) => `
    <section class="lai-ring">
      <div>
        <h3>${escapeHtml(ring.label)}</h3>
        <b>${ring.radiusM}m</b>
      </div>
      <p>${escapeHtml(ring.purpose)}</p>
      <small>${escapeHtml(ring.pdiCellPlan)}</small>
    </section>`,
    )
    .join("")}
</div>`;
}

function renderContextSignals(snapshot: LenriAreaIntelligenceSnapshot): string {
  const rows = snapshot.openDataProxy.contextSignals
    .map(
      (signal) => `
    <tr>
      <td><code>${escapeHtml(signal.category)}</code></td>
      <td>${signal.count}</td>
      <td>${escapeHtml(signal.interpretation)}</td>
    </tr>`,
    )
    .join("");
  return `
<table class="lai-table">
  <thead><tr><th>signal</th><th>count</th><th>use</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

function renderNamedSignals(snapshot: LenriAreaIntelligenceSnapshot): string {
  return `
<div class="lai-named">
  ${snapshot.openDataProxy.namedSignals
    .map(
      (signal) => `
    <article>
      <span>${escapeHtml(signal.signalType)}</span>
      <h3>${escapeHtml(signal.name)}</h3>
      <p>${escapeHtml(signal.useInIkimon)}</p>
    </article>`,
    )
    .join("")}
</div>`;
}

function readinessStatusLabel(status: "ready" | "thin" | "missing"): string {
  if (status === "ready") return "ready";
  if (status === "thin") return "thin";
  return "missing";
}

function renderEffortReadiness(snapshot: LenriAreaIntelligenceSnapshot): string {
  const effort = snapshot.effortReadiness;
  const rows = effort.items
    .map(
      (item) => `
    <tr>
      <td>
        <span class="lai-status is-${item.status}">${readinessStatusLabel(item.status)}</span>
        <code>${escapeHtml(item.dimension)}</code>
        <b>${escapeHtml(item.label)}</b>
      </td>
      <td>${escapeHtml(item.currentEvidence)}</td>
      <td>${escapeHtml(item.monitoringMinimum)}</td>
      <td>${escapeHtml(item.gap)}</td>
      <td>${escapeHtml(item.nextAction)}</td>
    </tr>`,
    )
    .join("");
  const planCards = effort.nextSurveyPlan
    .map(
      (plan) => `
    <article class="lai-plan">
      <header>
        <span>#${plan.priority}</span>
        <h3>${escapeHtml(plan.target)}</h3>
      </header>
      <p><b>${escapeHtml(plan.effortUnit)}</b></p>
      <p>${escapeHtml(plan.suggestedProtocol)}</p>
      <small>${escapeHtml(plan.why)}</small>
      <em>${escapeHtml(plan.claimUnlocked)}</em>
    </article>`,
    )
    .join("");
  const definitions = effort.metricDefinitions
    .map((item) => `<li><code>${escapeHtml(item.key)}</code> <b>${escapeHtml(item.label)}</b> ${escapeHtml(item.whyItMatters)}</li>`)
    .join("");
  return `
<section class="lai-section lai-effort">
  <div class="lai-section-head">
    <h2>effort readiness</h2>
    <span>${escapeHtml(effort.schemaVersion)} / ${escapeHtml(effort.summary.monitoringUse)}</span>
  </div>
  <section class="lai-grid">
    ${metricCard("readiness", `${effort.summary.readinessScore}/100`, `status ${effort.summary.status}`)}
    ${metricCard("trend claim", effort.summary.trendClaimReady ? "ready" : "not ready", "増減・absenceはまだ不可")}
    ${metricCard("next surveys", effort.nextSurveyPlan.length, "優先順の現地努力量")}
    ${metricCard("evidence mode", "proxy", effort.summary.currentEvidenceMode)}
  </section>
  <p class="lai-muted">${escapeHtml(effort.summary.currentIkimonNotes.join(" / "))}</p>
  <table class="lai-table lai-effort-table">
    <thead><tr><th>dimension</th><th>current</th><th>minimum</th><th>gap</th><th>next action</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>

<section class="lai-section">
  <div class="lai-section-head">
    <h2>next survey plan</h2>
    <span>effort units for Lenri micro POC</span>
  </div>
  <div class="lai-plans">${planCards}</div>
</section>

<section class="lai-two">
  <div class="lai-section">
    <h2>metric definitions</h2>
    <ul class="lai-list">${definitions}</ul>
  </div>
  <div class="lai-section">
    <h2>effort guardrails</h2>
    ${renderList(effort.guardrails)}
  </div>
</section>`;
}

function pctLabel(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function renderLiveEffort(snapshot: LenriAreaIntelligenceSnapshot): string {
  const live = snapshot.liveEffort;
  if (!live) return "";
  const summary = live.summary;
  const topTaxa = summary.topTaxa.length > 0
    ? summary.topTaxa.map((taxon) => `<li>${escapeHtml(taxon.name)} <b>${taxon.count}</b></li>`).join("")
    : `<li>top taxa はまだありません。</li>`;
  const gaps = live.gaps.length > 0
    ? live.gaps.map((gap) => `<span>${escapeHtml(gap)}</span>`).join("")
    : `<span>major gaps not detected</span>`;
  const actions = live.nextActions.length > 0
    ? live.nextActions
      .map(
        (action) => `
      <article>
        <span>${escapeHtml(action.kind)}</span>
        <h3>${escapeHtml(action.title)}</h3>
        <p>${escapeHtml(action.body)}</p>
      </article>`,
      )
      .join("")
    : `<article><span>proxy</span><h3>live action not loaded</h3><p>まずはnext survey planに沿って努力量つき記録を作ります。</p></article>`;
  return `
<section class="lai-section lai-live">
  <div class="lai-section-head">
    <h2>live effort ledger</h2>
    <span>${escapeHtml(live.schemaVersion)} / ${escapeHtml(live.status)} / ${escapeHtml(live.fieldId)}</span>
  </div>
  <section class="lai-grid">
    ${metricCard("visits", summary.totalVisits, "実DB由来")}
    ${metricCard("observations", summary.totalObservations, `${summary.uniqueTaxa} taxa`)}
    ${metricCard("effort filled", pctLabel(summary.effortCompletionRate), "effort_minutes / distance")}
    ${metricCard("seasons", `${summary.seasonsCovered}/${summary.seasonCoverageCap}`, summary.seasonLabels.join(" ") || "no season labels")}
    ${metricCard("non-detection", summary.absentRecords, "absent / complete checklist")}
    ${metricCard("machine effort", summary.machineEffortMetadata, `${summary.passiveAudioCount} passive audio`)}
  </section>
  <div class="lai-gap-row">${gaps}</div>
  <div class="lai-live-grid">
    <div>
      <h3>top taxa</h3>
      <ul class="lai-list">${topTaxa}</ul>
    </div>
    <div>
      <h3>next actions from place snapshot</h3>
      <div class="lai-live-actions">${actions}</div>
    </div>
  </div>
</section>`;
}

function renderBody(snapshot: LenriAreaIntelligenceSnapshot): string {
  const field = snapshot.field;
  const budget = snapshot.budgetGuard;
  const pdi = snapshot.pdiAccess;
  return `
<main class="lai-wrap">
  <header class="lai-hero">
    <div>
      <p class="lai-eyebrow">IKIMON Area Intelligence / PDI-ready proxy</p>
      <h1>連理の木の下で 周辺インテリジェンス</h1>
      <p class="lai-muted">PDI本契約前に、無料データで都田周辺の文脈を作り、PDIが予算内で使える場合に差し替えるための管理面です。</p>
    </div>
    <a class="lai-api" href="/api/v1/admin/lenri-area-intelligence">JSON</a>
  </header>

  <section class="lai-grid">
    ${metricCard("PDI recurring", `$${budget.currentRecurringCostUsd}/mo`, "現時点は未契約")}
    ${metricCard("budget cap", `$${budget.approvedMonthlyBudgetUsd}/mo`, budget.allowedPaidCondition)}
    ${metricCard("OSM elements", snapshot.openDataProxy.uniqueElementCount, `${snapshot.openDataProxy.radiusM}m snapshot`)}
    ${metricCard("site area", `${field.areaHa}ha`, `${field.radiusM}m core`)}
  </section>

  <section class="lai-section lai-warning">
    <h2>contract guard</h2>
    <p>${escapeHtml(budget.stoppedAction)}</p>
    <p>${escapeHtml(pdi.commercialBoundary)}</p>
  </section>

  <section class="lai-section">
    <div class="lai-section-head">
      <h2>${escapeHtml(field.name)}</h2>
      <span>${escapeHtml(field.addressEvidence)}</span>
    </div>
    <p class="lai-muted">lat ${field.lat} / lng ${field.lng} / bbox ${field.bbox.west},${field.bbox.south} - ${field.bbox.east},${field.bbox.north}</p>
    ${renderRings(snapshot)}
  </section>

  ${renderLiveEffort(snapshot)}

  ${renderEffortReadiness(snapshot)}

  <section class="lai-section">
    <div class="lai-section-head">
      <h2>PDI swap-in</h2>
      <span>${escapeHtml(pdi.status)}</span>
    </div>
    <p class="lai-muted">${escapeHtml(pdi.productName)} / ${escapeHtml(pdi.requestedGeography)}</p>
    <p>${escapeHtml(pdi.swapInCondition)}</p>
    ${renderList(pdi.intendedUse)}
  </section>

  <section class="lai-section">
    <div class="lai-section-head">
      <h2>open data proxy</h2>
      <span>${escapeHtml(snapshot.openDataProxy.sourceLabel)} / ${escapeHtml(snapshot.openDataProxy.collectedAt)}</span>
    </div>
    ${renderContextSignals(snapshot)}
  </section>

  <section class="lai-section">
    <h2>nearby named signals</h2>
    ${renderNamedSignals(snapshot)}
  </section>

  <section class="lai-two">
    <div class="lai-section">
      <h2>adopt when</h2>
      ${renderList(snapshot.decisionPolicy.adoptWhen)}
    </div>
    <div class="lai-section">
      <h2>do not adopt when</h2>
      ${renderList(snapshot.decisionPolicy.doNotAdoptWhen)}
    </div>
  </section>

  <section class="lai-two">
    <div class="lai-section">
      <h2>can say</h2>
      ${renderList(snapshot.claimBoundary.canSay)}
    </div>
    <div class="lai-section">
      <h2>cannot say yet</h2>
      ${renderList(snapshot.claimBoundary.cannotSayYet)}
    </div>
  </section>
</main>`;
}

const LENRI_AREA_INTELLIGENCE_STYLES = `
.lai-wrap{max-width:1180px;margin:32px auto;padding:0 18px 56px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827}
.lai-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:18px}
.lai-hero h1{margin:0;font-size:30px;line-height:1.22}
.lai-eyebrow{margin:0 0 6px;color:#0f766e;font-size:12px;font-weight:800;text-transform:uppercase}
.lai-muted{margin:4px 0 0;color:#6b7280;font-size:13px}
.lai-api{display:inline-flex;align-items:center;min-height:38px;border:1px solid #0f766e;border-radius:6px;padding:0 12px;color:#0f766e;text-decoration:none;font-size:13px;font-weight:800;background:#fff}
.lai-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:18px 0}
.lai-card{display:grid;gap:5px;border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#fff}
.lai-card span,.lai-card small{color:#6b7280;font-size:12px}
.lai-card strong{font-size:26px;line-height:1.1}
.lai-section{margin:16px 0;padding:18px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}
.lai-warning{border-color:#fed7aa;background:#fff7ed}
.lai-section h2{margin:0 0 12px;font-size:18px}
.lai-section-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}
.lai-section-head span{color:#6b7280;font-size:12px;text-align:right}
.lai-rings,.lai-named,.lai-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.lai-ring,.lai-named article{border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#f9fafb}
.lai-ring>div{display:flex;justify-content:space-between;gap:10px;align-items:center}
.lai-ring h3,.lai-named h3{margin:0;font-size:15px}
.lai-ring b{color:#0f766e}
.lai-ring p,.lai-named p{margin:8px 0;color:#374151;font-size:13px}
.lai-ring small,.lai-named span{color:#6b7280;font-size:12px}
.lai-table{width:100%;border-collapse:collapse;font-size:13px}
.lai-table th,.lai-table td{padding:9px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
.lai-table th{color:#6b7280;background:#f9fafb;font-size:11px;text-transform:uppercase}
.lai-table code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.lai-effort{border-color:#99f6e4;background:#f0fdfa}
.lai-effort-table td:first-child{min-width:170px}
.lai-effort-table td:first-child b{display:block;margin-top:5px;color:#111827;font-size:13px}
.lai-status{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800;text-transform:uppercase}
.lai-status.is-ready{background:#dcfce7;color:#166534}
.lai-status.is-thin{background:#fef3c7;color:#92400e}
.lai-status.is-missing{background:#fee2e2;color:#991b1b}
.lai-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.lai-plan{display:grid;gap:8px;border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#fff}
.lai-plan header{display:flex;gap:10px;align-items:center}
.lai-plan header span{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:#0f766e;color:#fff;font-size:12px;font-weight:900}
.lai-plan h3{margin:0;font-size:15px}
.lai-plan p{margin:0;color:#374151;font-size:13px}
.lai-plan small{color:#6b7280;font-size:12px}
.lai-plan em{color:#0f766e;font-size:12px;font-style:normal;font-weight:800}
.lai-live{border-color:#bfdbfe;background:#eff6ff}
.lai-gap-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}
.lai-gap-row span{border:1px solid #bfdbfe;border-radius:999px;padding:5px 9px;background:#fff;color:#1d4ed8;font-size:12px;font-weight:800}
.lai-live-grid{display:grid;grid-template-columns:minmax(180px,0.7fr) minmax(260px,1.3fr);gap:16px}
.lai-live-grid h3{margin:0 0 8px;font-size:14px}
.lai-live-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.lai-live-actions article{border:1px solid #dbeafe;border-radius:8px;padding:12px;background:#fff}
.lai-live-actions span{color:#2563eb;font-size:11px;font-weight:900;text-transform:uppercase}
.lai-live-actions h3{margin:5px 0;font-size:14px}
.lai-live-actions p{margin:0;color:#374151;font-size:13px}
.lai-list{margin:0;padding-left:18px;color:#374151;font-size:13px}
.lai-list li{margin:6px 0}
.lai-login{max-width:560px;margin:64px auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.lai-login h2{margin-top:0}
.lai-login p{color:#555;font-size:14px}
@media(max-width:720px){
  .lai-hero{align-items:flex-start;flex-direction:column}
  .lai-section-head{align-items:flex-start;flex-direction:column}
  .lai-section-head span{text-align:left}
  .lai-live-grid{grid-template-columns:1fr}
}
`;

export async function registerAdminLenriAreaIntelligenceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/lenri-area-intelligence", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "Lenri area intelligence — ZUKAN",
        extraStyles: LENRI_AREA_INTELLIGENCE_STYLES,
        body: loginGate("/admin/lenri-area-intelligence"),
        noindex: true,
      });
    }

    return renderSiteDocument({
      basePath: "",
      title: "Lenri area intelligence — ZUKAN",
      extraStyles: LENRI_AREA_INTELLIGENCE_STYLES,
      body: renderBody(await getLenriAreaIntelligenceSnapshotWithLiveEffort()),
      noindex: true,
    });
  });

  app.get("/api/v1/admin/lenri-area-intelligence", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return { ok: false, error: "forbidden" };
    }
    return { ok: true, model: await getLenriAreaIntelligenceSnapshotWithLiveEffort() };
  });
}

export const adminLenriAreaIntelligenceRouteContract = {
  path: "/admin/lenri-area-intelligence",
  apiPath: "/api/v1/admin/lenri-area-intelligence",
  guard: "admin_or_analyst_session",
  writesData: false,
  externalCalls: false,
  pdiSubscriptionAllowedWithoutBudgetProof: false,
  effortReadinessSchema: "lenri_effort_readiness/v0",
  liveEffortSchema: "lenri_live_effort/v0",
} as const;
