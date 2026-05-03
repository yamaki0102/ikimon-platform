import type {
  FixedPointStation,
  FixedPointStationAction,
  FixedPointStationVisit,
  FixedPointStationYearBucket,
} from "../services/fixedPointStation.js";
import { escapeHtml } from "./siteShell.js";

const METRIC_KIND_LABEL: Record<string, string> = {
  ndvi_mean: "NDVI 平均",
  ndvi_max: "NDVI 最大",
  forest_pct: "森林率",
  water_pct: "水域率",
  impervious_pct: "不透水面率",
  urban_pct: "市街地率",
  cropland_pct: "農地率",
};

function metricLabel(kind: string): string {
  return METRIC_KIND_LABEL[kind] ?? kind;
}

function fmtMetricValue(value: number, kind: string): string {
  if (kind.endsWith("_pct")) return `${Math.round(value)}%`;
  if (kind.startsWith("ndvi")) return value.toFixed(2);
  return String(value);
}

function fmtDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

function actionLabel(kind: string): string {
  const labels: Record<string, string> = {
    cleanup: "清掃",
    mowing: "草刈り",
    invasive_removal: "外来種対応",
    patrol: "巡回",
    signage: "看板",
    monitoring: "モニタリング",
    restoration: "修復",
    community_engagement: "参加促進",
    other: "その他",
  };
  return labels[kind] ?? kind;
}

function visitCard(visit: FixedPointStationVisit, basePath: string): string {
  const taxa = visit.taxa.length > 0
    ? visit.taxa.map((name) => `<span>${escapeHtml(name)}</span>`).join("")
    : "<span>名前未確定</span>";
  const media = [
    visit.photoCount > 0 ? `写真${visit.photoCount}` : "",
    visit.videoCount > 0 ? `動画${visit.videoCount}` : "",
    visit.visitMode === "survey" ? "しっかり記録" : "",
    visit.contextLabel ?? "",
  ].filter(Boolean).join(" · ");
  return `<article class="fps-visit">
    <time>${escapeHtml(fmtDate(visit.observedAt))}</time>
    <div>
      <div class="fps-chip-row">${taxa}</div>
      <p>${escapeHtml(visit.revisitReason || visit.note || "この日の記録メモは未入力です。")}</p>
      <small>${escapeHtml(media || "証拠メディアなし")}</small>
    </div>
    <a href="${escapeHtml(`${basePath}/observations/${encodeURIComponent(visit.visitId)}`)}">開く</a>
  </article>`;
}

/** 横並び year cards で「同じ場所の年単位スナップショット」を一望できるグリッド。
 *  各 card は 1 年分の (観察 / 写真+動画 / 種 / 管理行為 / 環境指標) を集約。 */
function yearlyTimelineSection(buckets: FixedPointStationYearBucket[]): string {
  if (!buckets.length) {
    return `<section class="fps-section">
      <div class="fps-section-head"><span>Year over year</span><h2>同じ場所の年比較</h2></div>
      <article class="fps-empty">この場所の累積記録はまだ少なく、年比較はまだ表示できません。</article>
    </section>`;
  }
  const cards = buckets.map((b) => {
    const taxa = b.dominantTaxa.length
      ? b.dominantTaxa.slice(0, 3).map((n) => `<span>${escapeHtml(n)}</span>`).join("")
      : "<span>-</span>";
    const envItems = Object.entries(b.environmentDigest)
      .slice(0, 3)
      .map(([kind, m]) => `<li><span>${escapeHtml(metricLabel(kind))}</span><strong>${escapeHtml(fmtMetricValue(m.value, kind))}</strong></li>`)
      .join("");
    const env = envItems
      ? `<ul class="fps-year-env">${envItems}</ul>`
      : `<p class="fps-year-env-empty">衛星指標はまだこの年に届いていません。</p>`;
    const media = (b.photoCount + b.videoCount) > 0
      ? `写真${b.photoCount} · 動画${b.videoCount}`
      : "メディアなし";
    return `<article class="fps-year-card">
      <header><strong>${escapeHtml(String(b.year))}</strong><span>${escapeHtml(media)}</span></header>
      <dl class="fps-year-stats">
        <div><dt>観察</dt><dd>${b.visitCount}</dd></div>
        <div><dt>種</dt><dd>${b.uniqueTaxa}</dd></div>
        <div><dt>管理</dt><dd>${b.stewardshipCount}</dd></div>
      </dl>
      <div class="fps-year-taxa">${taxa}</div>
      ${env}
    </article>`;
  }).join("");
  return `<section class="fps-section">
    <div class="fps-section-head"><span>Year over year</span><h2>同じ場所の年比較</h2></div>
    <p class="fps-section-lead">写真・動画・観察種・管理行為・衛星指標を年ごとに 1 枚に集約。横スクロールで「去年の今と比べる」「5 年前と比べる」を即座に。</p>
    <div class="fps-year-row">${cards}</div>
  </section>`;
}

function actionCard(action: FixedPointStationAction): string {
  return `<article class="fps-action">
    <span>${escapeHtml(actionLabel(action.actionKind))}</span>
    <strong>${escapeHtml(fmtDate(action.occurredAt))}</strong>
    <p>${escapeHtml(action.description ?? "管理行為の説明は未入力です。")}</p>
  </article>`;
}

export function renderFixedPointStationBody(station: FixedPointStation, basePath = ""): string {
  const location = [station.place.municipality, station.place.prefecture].filter(Boolean).join(" / ")
    || station.place.localityLabel
    || station.place.placeId;
  const env = station.environmentEvidence.length > 0
    ? station.environmentEvidence.map((item) => `<article class="fps-env">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
        <small>${escapeHtml([item.source, item.limitation].filter(Boolean).join(" · "))}</small>
      </article>`).join("")
    : `<article class="fps-empty">衛星・地図の環境手がかりはまだありません。取り込み worker で NDVI・水域・不透水面を追加できます。</article>`;
  const visits = station.visits.length > 0
    ? station.visits.map((visit) => visitCard(visit, basePath)).join("")
    : `<article class="fps-empty">この場所の再記録はまだありません。</article>`;
  const actions = station.stewardshipActions.length > 0
    ? station.stewardshipActions.map(actionCard).join("")
    : `<article class="fps-empty">草刈り・清掃・管理行為の記録はまだありません。</article>`;
  const recordParams = new URLSearchParams({
    recordMode: "survey",
    activityIntent: "revisit",
    revisitReason: `${station.place.name}を同じ構図で比べる`,
  });
  if (station.place.latitude != null && station.place.longitude != null) {
    recordParams.set("latitude", String(station.place.latitude));
    recordParams.set("longitude", String(station.place.longitude));
  }
  if (station.place.municipality) recordParams.set("municipality", station.place.municipality);
  if (station.place.prefecture) recordParams.set("prefecture", station.place.prefecture);
  if (station.place.localityLabel || station.place.name) recordParams.set("localityNote", station.place.localityLabel || station.place.name);
  const recordHref = `${basePath}/record?${recordParams.toString()}`;
  return `<main class="fps-shell">
    <section class="fps-hero">
      <div>
        <span>定点ページ</span>
        <h1>${escapeHtml(station.place.name)}</h1>
        <p>${escapeHtml(location)}。同じ場所の写真・動画・管理行為・衛星/地図の変化を、あとで比べるためのページです。</p>
      </div>
      <a href="${escapeHtml(recordHref)}">この場所を再記録</a>
    </section>
    <section class="fps-grid fps-grid-3">
      <div><strong>${escapeHtml(String(station.visits.length))}</strong><span>再記録</span></div>
      <div><strong>${escapeHtml(String(station.environmentEvidence.length))}</strong><span>環境手がかり</span></div>
      <div><strong>${escapeHtml(String(station.stewardshipActions.length))}</strong><span>管理行為</span></div>
    </section>
    ${yearlyTimelineSection(station.yearlyTimeline)}
    <section class="fps-section">
      <div class="fps-section-head"><span>Satellite / Map</span><h2>衛星・地図で見える変化</h2></div>
      <div class="fps-grid fps-grid-3">${env}</div>
    </section>
    <section class="fps-section">
      <div class="fps-section-head"><span>Timeline</span><h2>同じ場所の記録</h2></div>
      <div class="fps-timeline">${visits}</div>
    </section>
    <section class="fps-section">
      <div class="fps-section-head"><span>Stewardship</span><h2>管理行為と前後比較</h2></div>
      <div class="fps-grid fps-grid-3">${actions}</div>
    </section>
  </main>`;
}

export const FIXED_POINT_STATION_STYLES = `
.fps-shell { max-width: 1120px; margin: 0 auto; padding: 26px 16px 64px; color: #0f172a; }
.fps-hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: end; padding: clamp(22px, 4vw, 38px); border-radius: 18px; background: linear-gradient(135deg, #ecfdf5, #eff6ff); border: 1px solid rgba(15,23,42,.08); }
.fps-hero span, .fps-section-head span { color: #047857; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.fps-hero h1 { margin: 8px 0 8px; font-size: clamp(30px, 5vw, 52px); line-height: 1.08; letter-spacing: 0; }
.fps-hero p { margin: 0; color: #475569; line-height: 1.75; font-weight: 700; }
.fps-hero a { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; padding: 0 18px; border-radius: 8px; background: #047857; color: #fff; text-decoration: none; font-weight: 900; }
.fps-grid { display: grid; gap: 12px; margin-top: 14px; }
.fps-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.fps-grid > div, .fps-env, .fps-action, .fps-empty { padding: 16px; border-radius: 8px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 10px 26px rgba(15,23,42,.05); }
.fps-grid strong { display: block; color: #064e3b; font-size: 28px; line-height: 1; }
.fps-grid span, .fps-env span, .fps-action span { display: block; color: #047857; font-size: 12px; font-weight: 900; }
.fps-section { margin-top: 26px; }
.fps-section-head { display: flex; justify-content: space-between; gap: 12px; align-items: end; margin-bottom: 10px; }
.fps-section-head h2 { margin: 4px 0 0; font-size: clamp(22px, 3vw, 34px); line-height: 1.15; letter-spacing: 0; }
.fps-env strong, .fps-action strong { margin-top: 6px; font-size: 22px; }
.fps-env small, .fps-action p, .fps-visit small { color: #64748b; line-height: 1.55; font-weight: 700; }
.fps-timeline { display: grid; gap: 10px; }
.fps-visit { display: grid; grid-template-columns: 120px minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 14px; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: #fff; }
.fps-visit time { color: #047857; font-size: 12px; font-weight: 900; }
.fps-visit p { margin: 6px 0; color: #0f172a; line-height: 1.6; }
.fps-visit a { color: #047857; font-weight: 900; text-decoration: none; }
.fps-chip-row { display: flex; flex-wrap: wrap; gap: 5px; }
.fps-chip-row span { padding: 4px 7px; border-radius: 999px; background: #ecfdf5; color: #065f46; font-size: 11px; font-weight: 900; }
.fps-section-lead { margin: 0 0 12px; color: #475569; font-size: 13px; line-height: 1.6; }
.fps-year-row {
  display: grid; grid-auto-flow: column; grid-auto-columns: minmax(220px, 240px); gap: 12px;
  overflow-x: auto; scroll-snap-type: x mandatory; padding: 4px 2px 12px; margin: 0 -2px;
}
.fps-year-card {
  scroll-snap-align: start;
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px; border-radius: 12px;
  background: linear-gradient(180deg, #f0fdf4, #ffffff);
  border: 1px solid rgba(15,118,110,.15);
  box-shadow: 0 6px 16px rgba(15,118,110,.08);
}
.fps-year-card header { display: flex; align-items: baseline; justify-content: space-between; }
.fps-year-card header strong { font-size: 22px; color: #064e3b; line-height: 1; }
.fps-year-card header span { font-size: 11px; color: #475569; font-weight: 700; }
.fps-year-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 0; }
.fps-year-stats div { padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,.7); border: 1px solid rgba(15,23,42,.06); text-align: center; }
.fps-year-stats dt { display: block; font-size: 10px; font-weight: 800; color: #047857; letter-spacing: .04em; }
.fps-year-stats dd { margin: 2px 0 0; font-size: 18px; font-weight: 800; color: #0f172a; }
.fps-year-taxa { display: flex; flex-wrap: wrap; gap: 4px; }
.fps-year-taxa span { padding: 3px 7px; border-radius: 999px; background: #ecfdf5; color: #065f46; font-size: 10px; font-weight: 800; }
.fps-year-env { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; border-top: 1px dashed rgba(15,118,110,.2); padding-top: 8px; }
.fps-year-env li { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; }
.fps-year-env li span { color: #475569; font-weight: 700; }
.fps-year-env li strong { color: #0f172a; font-weight: 800; }
.fps-year-env-empty { margin: 0; padding-top: 8px; border-top: 1px dashed rgba(15,118,110,.2); font-size: 11px; color: #94a3b8; }

@media (max-width: 760px) {
  .fps-hero, .fps-visit { grid-template-columns: 1fr; }
  .fps-grid-3 { grid-template-columns: 1fr; }
  .fps-year-row { grid-auto-columns: minmax(85vw, 85vw); }
}
`;
