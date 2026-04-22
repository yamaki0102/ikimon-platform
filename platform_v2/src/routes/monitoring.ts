import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import {
  getMonitoringPocSnapshot,
  listMonitoringPlaceOptions,
  recordMonitoringPlotVisit,
  upsertMonitoringPlot,
  type MonitoringComparisonReportPayload,
  type MonitoringPocSnapshot,
  type MonitoringPlotRegistryItem,
  type MonitoringPlotVisitInput,
  type MonitoringPlotUpsertInput,
  type MonitoringVisitProtocol,
} from "../services/monitoringPoc.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }): string {
  return withBasePath(requestBasePath(request), requestUrl(request));
}

function formatDateTime(value: string | null, lang: SiteLang): string {
  if (!value) {
    return lang === "ja" ? "未記録" : "Not recorded";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const locale = lang === "ja" ? "ja-JP" : lang === "es" ? "es-ES" : lang === "pt-BR" ? "pt-BR" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function protocolLabel(protocolCode: string, lang: SiteLang): string {
  if (protocolCode === "fixed_point_scan") {
    return lang === "ja" ? "固定点スキャン" : "Fixed-point scan";
  }
  return lang === "ja" ? "固定プロット観察" : "Fixed-plot visit";
}

function renderPlotCards(snapshot: MonitoringPocSnapshot, lang: SiteLang): string {
  if (snapshot.plotRegistry.length === 0) {
    return `<div class="row"><div>${escapeHtml(lang === "ja" ? "まだ plot はありません。site を選び、最初の plot を登録してください。" : "No plots yet. Choose a site and register the first plot.")}</div></div>`;
  }

  return `<div class="monitor-grid">${snapshot.plotRegistry
    .map((plot) => renderPlotCard(plot, lang))
    .join("")}</div>`;
}

function renderPlotCard(plot: MonitoringPlotRegistryItem, lang: SiteLang): string {
  return `<article class="card is-soft">
    <div class="card-body">
      <div class="eyebrow">${escapeHtml(plot.plotCode)}</div>
      <h2>${escapeHtml(plot.plotName)}</h2>
      <p>${escapeHtml(plot.baselineForestType ?? (lang === "ja" ? "森林タイプ未設定" : "Forest type pending"))}</p>
      <div class="meta-list">
        <div><strong>${escapeHtml(lang === "ja" ? "面積" : "Area")}</strong><span>${escapeHtml(plot.areaM2 ? `${plot.areaM2}m²` : lang === "ja" ? "未設定" : "Pending")}</span></div>
        <div><strong>${escapeHtml(lang === "ja" ? "固定点" : "Fixed points")}</strong><span>${escapeHtml(plot.fixedPhotoPoints.join(" / ") || (lang === "ja" ? "未設定" : "Pending"))}</span></div>
        <div><strong>${escapeHtml(lang === "ja" ? "最新訪問" : "Latest visit")}</strong><span>${escapeHtml(formatDateTime(plot.latestVisitAt, lang))}</span></div>
        <div><strong>${escapeHtml(lang === "ja" ? "プロトコル" : "Protocol")}</strong><span>${escapeHtml(plot.latestProtocolCode ? protocolLabel(plot.latestProtocolCode, lang) : (lang === "ja" ? "未設定" : "Pending"))}</span></div>
      </div>
      <p class="meta" style="margin-top:12px">${escapeHtml(plot.imageryContext.note ?? (lang === "ja" ? "既存画像は背景文脈と位置確認に限定します。" : "Existing imagery stays in the background-context lane."))}</p>
    </div>
  </article>`;
}

function renderVisitProtocols(snapshot: MonitoringPocSnapshot, lang: SiteLang): string {
  if (snapshot.visitProtocols.length === 0) {
    return `<div class="row"><div>${escapeHtml(lang === "ja" ? "visit protocol はまだありません。plot を登録後、初回ベースラインを記録します。" : "No visit protocols yet. Record the baseline after creating a plot.")}</div></div>`;
  }

  return `<div class="list">${snapshot.visitProtocols
    .slice(0, 6)
    .map((visit) => renderVisitRow(visit, lang))
    .join("")}</div>`;
}

function renderVisitRow(visit: MonitoringVisitProtocol, lang: SiteLang): string {
  const checklist = visit.completeChecklistFlag
    ? lang === "ja" ? "チェックリスト完了" : "Checklist complete"
    : lang === "ja" ? "一部欠損あり" : "Partial evidence";
  return `<div class="row">
    <div>
      <strong>${escapeHtml(visit.plotLabel)}</strong>
      <div class="meta">${escapeHtml(formatDateTime(visit.observedAt, lang))} · ${escapeHtml(protocolLabel(visit.protocolCode, lang))} · ${escapeHtml(checklist)}</div>
      <div class="meta">${escapeHtml(visit.siteConditionSummary ?? (lang === "ja" ? "site condition 未記録" : "Site condition pending"))}</div>
    </div>
    <div class="pill">${escapeHtml(visit.targetTaxaScope ?? (lang === "ja" ? "scope 未設定" : "Scope pending"))}</div>
  </div>`;
}

function renderComparisonReports(snapshot: MonitoringPocSnapshot, lang: SiteLang): string {
  if (snapshot.comparisonReports.length === 0) {
    return `<div class="row"><div>${escapeHtml(lang === "ja" ? "比較レポートはまだありません。初回ベースライン後に表示されます。" : "No comparison report yet. It appears after the baseline visit.")}</div></div>`;
  }

  return `<div class="monitor-grid">${snapshot.comparisonReports
    .map((report) => renderComparisonCard(report, lang))
    .join("")}</div>`;
}

function renderComparisonCard(report: MonitoringComparisonReportPayload, lang: SiteLang): string {
  const statusLabel =
    report.reportStatus === "comparison_ready"
      ? lang === "ja" ? "再訪比較 ready" : "Revisit compare ready"
      : report.reportStatus === "baseline_only"
        ? lang === "ja" ? "初回ベースライン" : "Baseline only"
        : lang === "ja" ? "記録待ち" : "Waiting for visits";
  return `<article class="card">
    <div class="card-body">
      <div class="eyebrow">${escapeHtml(statusLabel)}</div>
      <h2>${escapeHtml(report.plotLabel)}</h2>
      <p>${escapeHtml(report.revisitDiff.summary)}</p>
      <div class="meta-list">
        <div><strong>${escapeHtml(lang === "ja" ? "Field note" : "Field note")}</strong><span>${escapeHtml(report.fieldEvidence.fieldNoteSummary ?? (lang === "ja" ? "未記録" : "Pending"))}</span></div>
        <div><strong>${escapeHtml(lang === "ja" ? "Field scan" : "Field scan")}</strong><span>${escapeHtml(report.fieldEvidence.fieldScanSummary ?? (lang === "ja" ? "未記録" : "Pending"))}</span></div>
        <div><strong>${escapeHtml(lang === "ja" ? "固定点写真" : "Fixed-point photo")}</strong><span>${escapeHtml(report.fieldEvidence.fixedPointPhotoNote ?? (lang === "ja" ? "未記録" : "Pending"))}</span></div>
        <div><strong>${escapeHtml(lang === "ja" ? "site condition" : "Site condition")}</strong><span>${escapeHtml(report.siteCondition.latest ?? (lang === "ja" ? "未記録" : "Pending"))}</span></div>
        <div><strong>${escapeHtml(lang === "ja" ? "前回訪問" : "Previous visit")}</strong><span>${escapeHtml(formatDateTime(report.revisitDiff.previousObservedAt, lang))}</span></div>
        <div><strong>${escapeHtml(lang === "ja" ? "次回計画" : "Next action")}</strong><span>${escapeHtml(report.nextAction ?? (lang === "ja" ? "未設定" : "Pending"))}</span></div>
      </div>
      <p class="meta" style="margin-top:12px">${escapeHtml(report.imageryContext.note ?? (lang === "ja" ? "地図・航空写真は背景文脈にのみ使用。" : "Map and air photo stay in the context lane only."))}</p>
    </div>
  </article>`;
}

function renderGuardrails(snapshot: MonitoringPocSnapshot): string {
  return `<div class="list">${snapshot.guardrails
    .map((item) => `<div class="row"><div>${escapeHtml(item)}</div></div>`)
    .join("")}</div>`;
}

function internalPageCopy(lang: SiteLang) {
  if (lang === "ja") {
    return {
      title: "Monitoring PoC Console | ikimon",
      eyebrow: "Monitoring PoC",
      heading: "固定プロット再訪モニタリングの内部 lane",
      lead: "site -> plot -> visit -> report を v2 で閉じるための最小 console。public promise は触らず、内部で比較可能性だけを育てます。",
      sourceFixture: "DB が使えないため fixture を表示中です。write は無効です。",
      sourceSchemaMissing: "DB は見えていますが monitoring schema が未適用です。migration 適用後に write を有効化します。",
      sourceReady: "DB の monitoring lane を表示中です。plot と visit をこの画面から追加できます。",
      pickSite: "対象 site",
      pickSiteLead: "まず 1 site を選び、plot registry と comparison report を同じ場所で見ます。",
      plotSection: "固定プロット台帳",
      visitSection: "訪問プロトコル",
      reportSection: "比較レポート payload",
      guardrailSection: "Guardrails",
      createPlot: "plot を追加",
      addVisit: "visit を追加",
      snapshotJson: "snapshot JSON",
      createPlotHint: "geometry は rough note で始め、固定点と imagery note を残します。",
      addVisitHint: "field note / field scan / fixed-point photo をまとめ、炭素は入れません。",
    };
  }

  return {
    title: "Monitoring PoC Console | ikimon",
    eyebrow: "Monitoring PoC",
    heading: "Internal lane for fixed-plot revisit monitoring",
    lead: "A minimal console that keeps site -> plot -> visit -> report inside v2 without turning the public promise into a carbon product.",
    sourceFixture: "Database is unavailable, so the fixture snapshot is shown. Write actions are disabled.",
    sourceSchemaMissing: "Database is reachable, but the monitoring schema is not applied yet. Enable write after running the migration.",
    sourceReady: "Monitoring data is coming from the database. Add plots and visits from this console.",
    pickSite: "Target site",
    pickSiteLead: "Choose one site, then keep the plot registry and comparison report on the same lane.",
    plotSection: "Plot registry",
    visitSection: "Visit protocol",
    reportSection: "Comparison report payload",
    guardrailSection: "Guardrails",
    createPlot: "Add plot",
    addVisit: "Add visit",
    snapshotJson: "Snapshot JSON",
    createPlotHint: "Start geometry as a rough note, then keep fixed points and imagery notes together.",
    addVisitHint: "Bundle field note / field scan / fixed-point photo. Carbon stays out of v1.",
  };
}

function renderWriteForms(
  basePath: string,
  lang: SiteLang,
  snapshot: MonitoringPocSnapshot,
): string {
  if (!snapshot.canWrite) {
    return "";
  }

  const plotOptions = snapshot.plotRegistry
    .map((plot) => `<option value="${escapeHtml(plot.plotId)}">${escapeHtml(`${plot.plotCode} / ${plot.plotName}`)}</option>`)
    .join("");
  const visitFormBody = snapshot.plotRegistry.length > 0
    ? `<form id="monitoring-visit-form" class="monitor-form stack">
        <label class="stack"><span>plotId</span><select name="plotId" required>${plotOptions}</select></label>
        <label class="stack"><span>observedAt</span><input name="observedAt" type="datetime-local" required /></label>
        <label class="stack"><span>protocolCode</span><select name="protocolCode"><option value="fixed_plot_census">fixed_plot_census</option><option value="fixed_point_scan">fixed_point_scan</option></select></label>
        <label class="stack"><span>targetTaxaScope</span><input name="targetTaxaScope" placeholder="${escapeHtml(lang === "ja" ? "植生 + 目立つ鳥類" : "Vegetation + conspicuous birds")}" /></label>
        <label class="stack"><span>observerCount</span><input name="observerCount" inputmode="numeric" placeholder="2" /></label>
        <label class="checkbox-row"><input type="checkbox" name="completeChecklistFlag" /><span>completeChecklistFlag</span></label>
        <label class="stack"><span>siteConditionSummary</span><textarea name="siteConditionSummary" rows="3" /></label>
        <label class="stack"><span>fieldNoteSummary</span><textarea name="fieldNoteSummary" rows="3" /></label>
        <label class="stack"><span>fieldScanSummary</span><textarea name="fieldScanSummary" rows="3" /></label>
        <label class="stack"><span>fixedPointPhotoNote</span><textarea name="fixedPointPhotoNote" rows="3" /></label>
        <label class="stack"><span>imagerySummary</span><textarea name="imagerySummary" rows="3" /></label>
        <label class="stack"><span>nextAction</span><textarea name="nextAction" rows="3" /></label>
        <button class="btn btn-solid" type="submit">${escapeHtml(internalPageCopy(lang).addVisit)}</button>
        <div id="monitoring-visit-status" class="meta"></div>
      </form>`
    : `<div class="monitor-form">
        <div class="eyebrow">${escapeHtml(internalPageCopy(lang).addVisit)}</div>
        <p>${escapeHtml(lang === "ja" ? "まず plot を 1 件追加すると、visit form が開きます。" : "Add the first plot to unlock the visit form.")}</p>
      </div>`;

  return `<section class="section">
    <div class="section-header">
      <div>
        <div class="eyebrow">${escapeHtml(internalPageCopy(lang).createPlot)}</div>
        <h2>${escapeHtml(internalPageCopy(lang).createPlotHint)}</h2>
      </div>
    </div>
    <div class="monitor-form-grid">
      <form id="monitoring-plot-form" class="monitor-form stack">
        <input type="hidden" name="placeId" value="${escapeHtml(snapshot.site.placeId)}" />
        <label class="stack"><span>plotCode</span><input name="plotCode" required placeholder="P-03" /></label>
        <label class="stack"><span>plotName</span><input name="plotName" placeholder="${escapeHtml(lang === "ja" ? "樹林帯の南縁" : "South edge")}" /></label>
        <label class="stack"><span>areaM2</span><input name="areaM2" inputmode="decimal" placeholder="400" /></label>
        <label class="stack"><span>baselineForestType</span><input name="baselineForestType" placeholder="${escapeHtml(lang === "ja" ? "海浜沿いの混交樹林" : "Mixed coastal woodland")}" /></label>
        <label class="stack"><span>geometryNote</span><textarea name="geometryNote" rows="3" placeholder="${escapeHtml(lang === "ja" ? "例: 北端の歩道沿い 20m x 20m" : "Example: north edge 20m x 20m")}" /></label>
        <label class="stack"><span>fixedPhotoPoints</span><textarea name="fixedPhotoPoints" rows="3" placeholder="${escapeHtml(lang === "ja" ? "1 行 1 点で入力" : "One point per line")}" /></label>
        <label class="stack"><span>imagerySummary</span><textarea name="imagerySummary" rows="3" placeholder="${escapeHtml(lang === "ja" ? "既存画像を何に使うか" : "How existing imagery is used")}" /></label>
        <button class="btn btn-solid" type="submit">${escapeHtml(internalPageCopy(lang).createPlot)}</button>
        <div id="monitoring-plot-status" class="meta"></div>
      </form>
      ${visitFormBody}
    </div>
    <script>
      (() => {
        const plotForm = document.getElementById("monitoring-plot-form");
        const plotStatus = document.getElementById("monitoring-plot-status");
        const visitForm = document.getElementById("monitoring-visit-form");
        const visitStatus = document.getElementById("monitoring-visit-status");
        const plotEndpoint = ${JSON.stringify(withBasePath(basePath, "/api/v1/monitoring/plots/upsert"))};
        const visitEndpoint = ${JSON.stringify(withBasePath(basePath, "/api/v1/monitoring/plot-visits"))};

        const reload = (placeId) => {
          const url = new URL(location.href);
          if (placeId) url.searchParams.set("placeId", placeId);
          location.href = url.toString();
        };

        const submitJson = async (endpoint, payload, statusNode, successText, placeId) => {
          if (!statusNode) return;
          statusNode.textContent = "Submitting...";
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(payload),
          });
          const json = await response.json().catch(() => ({ ok: false, error: "invalid_json" }));
          if (!response.ok || !json.ok) {
            statusNode.textContent = String(json.error || "request_failed");
            return;
          }
          statusNode.textContent = successText;
          reload(placeId);
        };

        plotForm?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const formData = new FormData(plotForm);
          const placeId = String(formData.get("placeId") || "");
          await submitJson(plotEndpoint, {
            placeId,
            plotCode: String(formData.get("plotCode") || ""),
            plotName: String(formData.get("plotName") || ""),
            areaM2: String(formData.get("areaM2") || ""),
            baselineForestType: String(formData.get("baselineForestType") || ""),
            geometryNote: String(formData.get("geometryNote") || ""),
            fixedPhotoPoints: String(formData.get("fixedPhotoPoints") || ""),
            imagerySummary: String(formData.get("imagerySummary") || ""),
          }, plotStatus, "plot saved", placeId);
        });

        visitForm?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const formData = new FormData(visitForm);
          await submitJson(visitEndpoint, {
            plotId: String(formData.get("plotId") || ""),
            observedAt: String(formData.get("observedAt") || ""),
            protocolCode: String(formData.get("protocolCode") || ""),
            targetTaxaScope: String(formData.get("targetTaxaScope") || ""),
            observerCount: String(formData.get("observerCount") || ""),
            completeChecklistFlag: formData.get("completeChecklistFlag") === "on",
            siteConditionSummary: String(formData.get("siteConditionSummary") || ""),
            fieldNoteSummary: String(formData.get("fieldNoteSummary") || ""),
            fieldScanSummary: String(formData.get("fieldScanSummary") || ""),
            fixedPointPhotoNote: String(formData.get("fixedPointPhotoNote") || ""),
            imagerySummary: String(formData.get("imagerySummary") || ""),
            nextAction: String(formData.get("nextAction") || ""),
          }, visitStatus, "visit saved", ${JSON.stringify(snapshot.site.placeId)});
        });
      })();
    </script>
  </section>`;
}

export async function registerMonitoringRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/monitoring/places", async (_request, reply) => {
    try {
      const result = await listMonitoringPlaceOptions({ allowFixture: true });
      return {
        ok: true,
        source: result.source,
        schemaReady: result.schemaReady,
        places: result.options,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "monitoring_places_failed",
      };
    }
  });

  app.get<{
    Querystring: {
      placeId?: string;
      demo?: string;
    };
  }>("/api/v1/monitoring/snapshot", async (request, reply) => {
    try {
      const snapshot = await getMonitoringPocSnapshot(request.query.placeId, {
        allowFixture: true,
        preferFixtureWhenEmpty: request.query.demo === "1",
      });
      return {
        ok: true,
        snapshot,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "monitoring_snapshot_failed",
      };
    }
  });

  app.post<{ Body: MonitoringPlotUpsertInput }>("/api/v1/monitoring/plots/upsert", async (request, reply) => {
    try {
      return await upsertMonitoringPlot(request.body);
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "monitoring_plot_upsert_failed",
      };
    }
  });

  app.post<{ Body: MonitoringPlotVisitInput }>("/api/v1/monitoring/plot-visits", async (request, reply) => {
    try {
      return await recordMonitoringPlotVisit(request.body);
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "monitoring_plot_visit_failed",
      };
    }
  });

  app.get<{
    Querystring: {
      placeId?: string;
    };
  }>("/ops/monitoring-poc", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const copy = internalPageCopy(lang);
    const placeOptions = await listMonitoringPlaceOptions({ allowFixture: true });
    const selectedPlaceId = request.query.placeId ?? placeOptions.options[0]?.placeId ?? undefined;
    const snapshot = await getMonitoringPocSnapshot(selectedPlaceId, {
      allowFixture: true,
      preferFixtureWhenEmpty: false,
    });
    const sourceNote =
      snapshot.source === "fixture"
        ? copy.sourceFixture
        : !snapshot.schemaReady
          ? copy.sourceSchemaMissing
          : copy.sourceReady;
    const selectorOptions = placeOptions.options
      .map((option) => {
        const selected = option.placeId === snapshot.site.placeId ? " selected" : "";
        const suffix = option.hasPlots ? (lang === "ja" ? " (plots あり)" : " (has plots)") : "";
        return `<option value="${escapeHtml(option.placeId)}"${selected}>${escapeHtml(option.placeName)}${escapeHtml(suffix)}</option>`;
      })
      .join("");

    const pageBody = `
      <section class="section">
        <div class="list">
          <div class="row">
            <div>
              <strong>${escapeHtml(copy.pickSite)}</strong>
              <div class="meta">${escapeHtml(copy.pickSiteLead)}</div>
            </div>
            <form method="get" action="${escapeHtml(withBasePath(basePath, "/ops/monitoring-poc"))}" class="monitor-inline-form">
              <select name="placeId">${selectorOptions}</select>
              <button class="btn btn-ghost" type="submit">Open</button>
            </form>
          </div>
          <div class="row">
            <div>
              <strong>${escapeHtml(snapshot.site.placeName)}</strong>
              <div class="meta">${escapeHtml(snapshot.site.municipality ?? "")}</div>
            </div>
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, `/api/v1/monitoring/snapshot?placeId=${encodeURIComponent(snapshot.site.placeId)}`))}">${escapeHtml(copy.snapshotJson)}</a>
          </div>
          <div class="row">
            <div>${escapeHtml(sourceNote)}</div>
          </div>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><div><div class="eyebrow">${escapeHtml(copy.plotSection)}</div><h2>${escapeHtml(copy.plotSection)}</h2></div></div>
        ${renderPlotCards(snapshot, lang)}
      </section>
      <section class="section">
        <div class="section-header"><div><div class="eyebrow">${escapeHtml(copy.visitSection)}</div><h2>${escapeHtml(copy.visitSection)}</h2></div></div>
        ${renderVisitProtocols(snapshot, lang)}
      </section>
      <section class="section">
        <div class="section-header"><div><div class="eyebrow">${escapeHtml(copy.reportSection)}</div><h2>${escapeHtml(copy.reportSection)}</h2></div></div>
        ${renderComparisonReports(snapshot, lang)}
      </section>
      ${renderWriteForms(basePath, lang, snapshot)}
      <section class="section">
        <div class="section-header"><div><div class="eyebrow">${escapeHtml(copy.guardrailSection)}</div><h2>${escapeHtml(copy.guardrailSection)}</h2></div></div>
        ${renderGuardrails(snapshot)}
      </section>
    `;

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: copy.title,
      activeNav: lang === "ja" ? "法人向け" : "For Business",
      lang,
      currentPath: requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      hero: {
        eyebrow: copy.eyebrow,
        heading: copy.heading,
        headingHtml: escapeHtml(copy.heading),
        lead: copy.lead,
        tone: "light",
        align: "center",
        afterActionsHtml: `<div class="actions">
          <a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/for-business"), lang))}">${escapeHtml(lang === "ja" ? "public promise を確認" : "Check public promise")}</a>
          <a class="btn btn-ghost" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/for-business/apply"), lang))}">${escapeHtml(lang === "ja" ? "Apply" : "Apply")}</a>
        </div>`,
      },
      body: pageBody,
      footerNote: lang === "ja" ? "Internal staging lane only. Carbon stays behind the next gate." : "Internal staging lane only. Carbon stays behind the next gate.",
      extraStyles: `
        .monitor-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
        .meta-list { display: grid; gap: 8px; margin-top: 12px; }
        .meta-list div { display: flex; justify-content: space-between; gap: 12px; }
        .meta-list strong { color: #0f172a; }
        .monitor-inline-form { display: flex; gap: 10px; align-items: center; }
        .monitor-inline-form select, .monitor-form input, .monitor-form select, .monitor-form textarea {
          width: 100%;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid #d8e6d8;
          background: #fff;
          font: inherit;
        }
        .monitor-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
        .monitor-form { padding: 18px; border: 1px solid rgba(15, 23, 42, .08); border-radius: 22px; background: rgba(255,255,255,.92); box-shadow: 0 12px 28px rgba(15, 23, 42, .05); }
        .checkbox-row { display: flex; align-items: center; gap: 10px; font-weight: 600; }
        @media (max-width: 860px) {
          .monitor-grid, .monitor-form-grid { grid-template-columns: 1fr; }
          .meta-list div { flex-direction: column; }
          .monitor-inline-form { width: 100%; flex-direction: column; align-items: stretch; }
        }
      `,
    });
  });
}
