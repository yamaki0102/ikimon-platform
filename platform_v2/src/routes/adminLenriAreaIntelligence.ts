import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  getLenriAreaIntelligenceSnapshot,
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
.lai-list{margin:0;padding-left:18px;color:#374151;font-size:13px}
.lai-list li{margin:6px 0}
.lai-login{max-width:560px;margin:64px auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.lai-login h2{margin-top:0}
.lai-login p{color:#555;font-size:14px}
@media(max-width:720px){
  .lai-hero{align-items:flex-start;flex-direction:column}
  .lai-section-head{align-items:flex-start;flex-direction:column}
  .lai-section-head span{text-align:left}
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
        title: "Lenri area intelligence — ikimon.life",
        extraStyles: LENRI_AREA_INTELLIGENCE_STYLES,
        body: loginGate("/admin/lenri-area-intelligence"),
        noindex: true,
      });
    }

    return renderSiteDocument({
      basePath: "",
      title: "Lenri area intelligence — ikimon.life",
      extraStyles: LENRI_AREA_INTELLIGENCE_STYLES,
      body: renderBody(getLenriAreaIntelligenceSnapshot()),
      noindex: true,
    });
  });

  app.get("/api/v1/admin/lenri-area-intelligence", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!session || session.banned || !isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
      reply.code(403);
      return { ok: false, error: "forbidden" };
    }
    return { ok: true, model: getLenriAreaIntelligenceSnapshot() };
  });
}

export const adminLenriAreaIntelligenceRouteContract = {
  path: "/admin/lenri-area-intelligence",
  apiPath: "/api/v1/admin/lenri-area-intelligence",
  guard: "admin_or_analyst_session",
  writesData: false,
  externalCalls: false,
  pdiSubscriptionAllowedWithoutBudgetProof: false,
} as const;
