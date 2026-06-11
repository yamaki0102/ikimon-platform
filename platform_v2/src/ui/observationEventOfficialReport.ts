import type { ObservationEventOfficialReport } from "../services/observationEventOfficialReport.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function renderObservationEventOfficialReportBody(report: ObservationEventOfficialReport): string {
  const rows = report.speciesRecords.slice(0, 200).map((record) => `
    <tr>
      <td>${escapeHtml(formatDateTime(record.observedAt))}</td>
      <td><strong>${escapeHtml(record.taxonName)}</strong></td>
      <td>${escapeHtml(record.teamId ?? "-")}</td>
      <td>${escapeHtml(record.evidenceRef ?? "-")}</td>
    </tr>
  `).join("");

  const topTaxa = report.topTaxa.length
    ? report.topTaxa.slice(0, 12).map((item) => `<span class="evt-badge evt-mode-discovery">${escapeHtml(item.taxonName)} x${item.count}</span>`).join(" ")
    : `<p class="evt-lead">公式出力対象の観察記録はまだありません。</p>`;

  return `
<section class="evt-recap-shell">
  <article class="evt-result-card">
    <span class="evt-result-eyebrow">official report v1 • ${escapeHtml(formatDateTime(report.generatedAt))}</span>
    <h2>${escapeHtml(report.session.title || "観察会")} 公式出力</h2>
    <p style="margin:0; color:rgba(236,253,245,.86);">セッションに明示的に紐づいた記録だけを集計。半径内にあっただけの第三者記録は含めません。</p>
    <div class="evt-result-stats evt-stagger">
      <div><strong>${report.stats.officialObservationCount}</strong><span>公式観察</span></div>
      <div><strong>${report.stats.uniqueTaxaCount}</strong><span>分類群</span></div>
      <div><strong>${report.stats.guideSceneCount}</strong><span>ガイド</span></div>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:18px;">
      <a class="evt-btn evt-btn-primary" href="/api/v1/observation-events/${escapeHtml(report.session.sessionId)}/species.csv">CSV をダウンロード</a>
      <a class="evt-btn evt-btn-on-dark" href="/events/${escapeHtml(report.session.sessionId)}/recap">振り返りへ戻る</a>
    </div>
  </article>

  <section class="evt-recap-section">
    <h2 class="evt-heading">よく記録された分類群</h2>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;">${topTaxa}</div>
  </section>

  <section class="evt-recap-section">
    <h2 class="evt-heading">出力境界</h2>
    <div class="evt-stagger" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); gap:12px;">
      <article class="evt-card">
        <span class="evt-eyebrow">使ってよい表現</span>
        <ul class="evt-lead">${report.claimBoundary.canSay.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
      <article class="evt-card">
        <span class="evt-eyebrow">まだ言わない表現</span>
        <ul class="evt-lead">${report.claimBoundary.cannotSay.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>
      <article class="evt-card">
        <span class="evt-eyebrow">位置情報</span>
        <p class="evt-lead">CSVには正確な座標を含めません。希少種・配慮対象種は主催者確認後に個別判断します。</p>
      </article>
    </div>
  </section>

  <section class="evt-recap-section">
    <h2 class="evt-heading">公式種リスト</h2>
    <div style="overflow:auto;">
      <table style="width:100%; border-collapse:collapse; min-width:680px;">
        <thead>
          <tr>
            <th style="text-align:left; padding:10px; border-bottom:1px solid var(--evt-line);">時刻</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid var(--evt-line);">分類群</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid var(--evt-line);">班</th>
            <th style="text-align:left; padding:10px; border-bottom:1px solid var(--evt-line);">証拠ID</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="4" style="padding:12px;">公式出力対象の観察記録はまだありません。</td></tr>`}
        </tbody>
      </table>
    </div>
  </section>
</section>`;
}
