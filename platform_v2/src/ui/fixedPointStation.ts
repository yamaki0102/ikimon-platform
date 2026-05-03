import type { FixedPointStation, FixedPointStationAction, FixedPointStationVisit } from "../services/fixedPointStation.js";
import { escapeHtml } from "./siteShell.js";

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
@media (max-width: 760px) {
  .fps-hero, .fps-visit { grid-template-columns: 1fr; }
  .fps-grid-3 { grid-template-columns: 1fr; }
}
`;
