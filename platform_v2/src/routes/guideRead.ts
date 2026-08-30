import type { FastifyInstance } from "fastify";
import { getShortCopy } from "../content/index.js";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import {
  listMyGuideUnlocks,
  type GuideUnlockListItem,
} from "../services/guideUnlocks.js";
import {
  getPublishedGuideProgramDetail,
  listPublishedGuideProgramsForPublic,
  type GuideProgramPublicDetail,
  type GuideProgramPublicSpot,
} from "../services/guidePrograms.js";
import {
  buildGuideProgramStaticMapLayout,
  type GuideProgramStaticMapLayout,
} from "../services/guideProgramStaticMap.js";
import { GUIDE_FLOW_STYLES, renderGuideFlow } from "../ui/guideFlow.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

const GUIDE_ENTRY_STYLES = `
  .guide-loop-panel { margin-top: 18px; }
  .guide-loop-card {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(260px, .85fr);
    gap: 16px;
    align-items: stretch;
    padding: 24px;
    border-radius: 24px;
    border: 1px solid rgba(16,185,129,.16);
    background: linear-gradient(135deg, rgba(236,253,245,.9), rgba(255,255,255,.96) 58%, rgba(240,249,255,.82));
    box-shadow: 0 16px 38px rgba(15,23,42,.06);
  }
  .guide-loop-card h2 { margin: 6px 0 0; color: #10251a; font-size: clamp(24px, 3vw, 34px); line-height: 1.2; letter-spacing: 0; }
  .guide-loop-card p { margin: 10px 0 0; color: #475569; line-height: 1.75; font-weight: 720; }
  .guide-loop-steps { display: grid; gap: 8px; }
  .guide-loop-step {
    min-height: 54px;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding: 10px;
    border-radius: 14px;
    background: rgba(255,255,255,.82);
    border: 1px solid rgba(16,185,129,.12);
    color: #334155;
    font-size: 13px;
    line-height: 1.45;
    font-weight: 780;
  }
  .guide-loop-step b {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #047857;
    color: #fff;
    font-size: 12px;
  }
  .guide-loop-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  @media (max-width: 820px) {
    .guide-loop-card { grid-template-columns: 1fr; padding: 18px; border-radius: 20px; }
  }
`;

function renderGuideLoopPanel(basePath: string, lang: SiteLang): string {
  const href = (path: string) => escapeHtml(appendLangToHref(withBasePath(basePath, path), lang));
  const copy = lang === "ja"
    ? {
        eyebrow: "loop",
        title: "ガイドで見たことを、記録と成果確認につなげる",
        body: "ライブガイドはその場で終わらせず、気づきは記録へ、歩いた足跡は成果確認へ、場所の変化はマップへ戻します。写真・動画・ガイド・観察レコードが別々の体験にならないよう、ここから一巡できます。",
        record: "写真・動画を記録する",
        outcomes: "ガイド成果を見る",
        map: "マップで場所を見る",
        aria: "ガイド後の流れ",
        steps: [
          "その場でガイドを開始して、環境の手がかりを残す",
          "残したい発見は写真・動画つきの記録にする",
          "ガイド成果で今日できたことと次の一歩を見る",
          "マップと記録ライブラリから、次に歩く場所へ戻る",
        ],
      }
    : {
        eyebrow: "loop",
        title: "Turn Guide traces into records and outcomes",
        body: "Live Guide should not end in the moment. Save discoveries as records, review the walked trace as outcomes, and return to the map for the next place.",
        record: "Record photo or video",
        outcomes: "Review Guide outcomes",
        map: "Open map",
        aria: "After Guide flow",
        steps: [
          "Start Guide and save field context",
          "Turn important discoveries into photo or video records",
          "Review route traces and representative cards",
          "Return to the map and notebook for the next walk",
        ],
      };
  return `<section class="section guide-loop-panel">
    <div class="guide-loop-card">
      <div>
        <div class="eyebrow">${escapeHtml(copy.eyebrow)}</div>
        <h2>${escapeHtml(copy.title)}</h2>
        <p>${escapeHtml(copy.body)}</p>
        <div class="guide-loop-actions">
          <a class="btn btn-solid" href="${href("/record")}">${escapeHtml(copy.record)}</a>
          <a class="btn btn-ghost" href="${href("/guide/outcomes")}">${escapeHtml(copy.outcomes)}</a>
          <a class="btn btn-ghost" href="${href("/map")}">${escapeHtml(copy.map)}</a>
        </div>
      </div>
      <div class="guide-loop-steps" aria-label="${escapeHtml(copy.aria)}">
        ${copy.steps.map((step, index) => `<div class="guide-loop-step"><b>${index + 1}</b><span>${escapeHtml(step)}</span></div>`).join("")}
      </div>
    </div>
  </section>`;
}

const MY_GUIDES_STYLES = `
  .my-guides-page { display: grid; gap: 18px; width: min(1040px, calc(100vw - var(--ikimon-desktop-sidebar-w, 0px) - 64px)); margin: 0 auto; padding: 26px 0 54px; }
  .my-guides-hero { display: grid; gap: 10px; padding: 18px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .my-guides-hero span { color: #047857; font-size: 11px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .my-guides-hero h1 { margin: 0; color: #0f172a; font-size: clamp(24px, 4vw, 38px); line-height: 1.12; letter-spacing: 0; }
  .my-guides-hero p { max-width: 760px; margin: 0; color: #475569; font-size: 14px; line-height: 1.8; font-weight: 720; }
  .my-guides-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .my-guides-actions a,
  .my-guide-card button { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(15,23,42,.10); background: #fff; color: #0f172a; font: inherit; font-size: 12px; font-weight: 900; text-decoration: none; cursor: pointer; }
  .my-guides-actions a:first-child,
  .my-guide-card button { background: #0f766e; color: #fff; border-color: #0f766e; }
  .my-guides-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
  .my-guide-card { display: grid; gap: 11px; padding: 14px; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: #fff; box-shadow: 0 12px 30px rgba(15,23,42,.05); }
  .my-guide-card header { display: grid; gap: 5px; }
  .my-guide-card header span { color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .my-guide-card h2 { margin: 0; color: #0f172a; font-size: 17px; line-height: 1.35; letter-spacing: 0; }
  .my-guide-card p { margin: 0; color: #475569; font-size: 13px; line-height: 1.7; font-weight: 700; }
  .my-guide-card ul { margin: 0; padding-left: 18px; color: #334155; font-size: 12.5px; line-height: 1.65; font-weight: 720; }
  .my-guide-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .my-guide-meta span { display: inline-flex; min-height: 24px; align-items: center; padding: 3px 8px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 10.5px; font-weight: 950; }
  .my-guide-sources { display: flex; flex-wrap: wrap; gap: 6px; }
  .my-guide-sources a { color: #0f766e; font-size: 11px; font-weight: 850; text-decoration: none; }
  .my-guide-empty { padding: 18px; border-radius: 8px; background: #fff7ed; border: 1px solid rgba(245,158,11,.18); color: #7c2d12; font-weight: 800; line-height: 1.7; }
  .guide-program-list { display: grid; gap: 12px; }
  .guide-program-card { display: grid; gap: 10px; padding: 15px; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: #fff; box-shadow: 0 12px 30px rgba(15,23,42,.05); }
  .guide-program-card h2 { margin: 0; color: #0f172a; font-size: 18px; line-height: 1.35; letter-spacing: 0; }
  .guide-program-card p { margin: 0; color: #475569; font-size: 13px; line-height: 1.7; font-weight: 720; }
  .guide-program-progress { display: grid; gap: 6px; }
  .guide-program-progress-row { display: flex; justify-content: space-between; gap: 10px; color: #334155; font-size: 12px; font-weight: 900; }
  .guide-program-progress-track { height: 9px; border-radius: 999px; background: #e2e8f0; overflow: hidden; }
  .guide-program-progress-track span { display: block; height: 100%; background: #0f766e; border-radius: inherit; }
  .guide-program-action-deck { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .guide-program-action-link { min-width: 0; display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: start; padding: 14px; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: #fff; color: #0f172a; text-decoration: none; box-shadow: 0 12px 30px rgba(15,23,42,.05); }
  .guide-program-action-link b { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 950; }
  .guide-program-action-link strong { display: block; color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 950; }
  .guide-program-action-link span { display: block; margin-top: 3px; color: #475569; font-size: 12px; line-height: 1.55; font-weight: 760; }
  .guide-program-action-link[data-primary="true"] { background: #ecfdf5; border-color: rgba(16,185,129,.22); }
  .guide-program-action-link[data-primary="true"] b { background: #047857; color: #fff; }
  .guide-program-spot-list { display: grid; gap: 9px; }
  .guide-program-spot { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 10px; align-items: start; padding: 10px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); }
  .guide-program-spot b { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; background: #e2e8f0; color: #0f172a; font-size: 12px; }
  .guide-program-spot[data-unlocked="true"] b { background: #0f766e; color: #fff; }
  .guide-program-spot strong { display: block; color: #0f172a; font-size: 14px; line-height: 1.35; }
  .guide-program-spot p { margin: 3px 0 0; color: #475569; font-size: 12.5px; line-height: 1.55; font-weight: 700; }
  .guide-program-next { padding: 14px; border-radius: 8px; background: #ecfdf5; border: 1px solid rgba(16,185,129,.20); color: #064e3b; font-weight: 800; line-height: 1.65; }
  .guide-program-map { position: relative; justify-self: center; width: min(100%, 720px); aspect-ratio: 4 / 3; min-height: 0; overflow: hidden; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: #dff4f0; box-shadow: 0 12px 30px rgba(15,23,42,.05); }
  .guide-program-map-fallback { position: absolute; inset: 0; }
  .guide-program-map-fallback { z-index: 2; background: #dff4f0; overflow: hidden; }
  .guide-program-map-fallback::after { content: ""; position: absolute; inset: 0; z-index: 1; background: linear-gradient(180deg, rgba(236,253,245,.08), rgba(236,253,245,.20)); pointer-events: none; }
  .guide-program-map-static { position: absolute; inset: 0; z-index: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); filter: saturate(.96) contrast(.98); }
  .guide-program-map-static img { display: block; width: 100%; height: 100%; object-fit: fill; }
  .guide-program-map-head { position: absolute; left: 14px; top: 14px; right: 14px; z-index: 3; display: flex; justify-content: space-between; gap: 10px; align-items: start; pointer-events: none; }
  .guide-program-map-head strong { display: block; color: #0f172a; font-size: 13px; line-height: 1.35; }
  .guide-program-map-head span { display: block; margin-top: 2px; color: #475569; font-size: 11px; font-weight: 800; }
  .guide-program-map-head > div { padding: 9px 11px; border-radius: 8px; background: rgba(255,255,255,.88); box-shadow: 0 10px 22px rgba(15,23,42,.08); backdrop-filter: blur(8px); }
  .guide-program-map-head a { pointer-events: auto; flex: 0 0 auto; min-height: 36px; display: inline-flex; align-items: center; justify-content: center; padding: 8px 11px; border-radius: 8px; background: rgba(15,23,42,.88); color: #fff; font-size: 11px; font-weight: 900; text-decoration: none; box-shadow: 0 10px 22px rgba(15,23,42,.18); }
  .guide-program-map-pin { position: absolute; z-index: 2; left: var(--pin-x); top: var(--pin-y); transform: translate(-50%, -50%); display: grid; gap: 5px; justify-items: center; max-width: 190px; text-decoration: none; color: #0f172a; }
  .guide-program-map-pin i { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 999px; background: #0f766e; color: #fff; font-style: normal; font-size: 12px; font-weight: 950; box-shadow: 0 12px 24px rgba(15,118,110,.28); border: 2px solid #fff; }
  .guide-program-map-pin span { display: block; max-width: 190px; padding: 6px 9px; border-radius: 8px; background: rgba(255,255,255,.94); box-shadow: 0 10px 22px rgba(15,23,42,.10); font-size: 11px; font-weight: 900; line-height: 1.35; text-align: center; }
  .guide-program-map-pin[data-unlocked="true"] i { background: #047857; }
  .guide-program-map-marker { width: 32px; height: 32px; border-radius: 999px; border: 2px solid #fff; background: #0f766e; color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 950; box-shadow: 0 12px 24px rgba(15,118,110,.30); cursor: pointer; }
  .guide-program-map-marker[data-unlocked="true"] { background: #047857; }
  .guide-program-map-popup { margin: 0; color: #0f172a; font-size: 12px; line-height: 1.45; font-weight: 800; }
  .guide-program-map-note { position: absolute; left: 14px; bottom: 14px; z-index: 3; max-width: min(520px, calc(100% - 28px)); padding: 7px 10px; border-radius: 8px; background: rgba(255,255,255,.9); color: #475569; font-size: 11px; font-weight: 820; line-height: 1.45; box-shadow: 0 10px 22px rgba(15,23,42,.08); backdrop-filter: blur(8px); }
  .guide-program-audience-note { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: #fff; color: #475569; font-size: 12.5px; line-height: 1.6; font-weight: 760; }
  .guide-program-audience-note strong { color: #0f172a; }
  .guide-program-audience-note a { flex: 0 0 auto; min-height: 36px; display: inline-flex; align-items: center; justify-content: center; padding: 7px 10px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(15,23,42,.10); color: #0f172a; font-size: 12px; font-weight: 900; text-decoration: none; }
  @media (max-width: 620px) {
    .my-guides-page { width: min(100% - 20px, 1040px); padding-top: 12px; }
    .my-guides-hero h1 { font-size: 25px; }
    .my-guides-grid { grid-template-columns: 1fr; }
    .guide-program-action-deck { grid-template-columns: 1fr; }
    .guide-program-map { width: 100%; min-height: 0; }
    .guide-program-map-head { display: flex; }
    .guide-program-map-pin span { max-width: 150px; }
    .guide-program-map-note { top: 64px; right: 14px; bottom: auto; max-width: none; }
  }
`;

function guideDistanceBandLabel(band: GuideUnlockListItem["distanceBand"]): string {
  if (band === "same_place") return "すぐ近くで解放";
  if (band === "nearby") return "近くで解放";
  return "エリア内で解放";
}

function renderMyGuideCard(basePath: string, guide: GuideUnlockListItem): string {
  const points = guide.storyPoints.length
    ? `<ul>${guide.storyPoints.slice(0, 3).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>`
    : "";
  const sources = guide.sourceLinks.length
    ? `<div class="my-guide-sources">${guide.sourceLinks.slice(0, 3).map((link) =>
        `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(link.label)}</a>`,
      ).join("")}</div>`
    : "";
  return `<article class="my-guide-card" id="guide-${escapeHtml(guide.guideSpotId)}" data-guide-script="${escapeHtml(guide.script)}" data-guide-spot-id="${escapeHtml(guide.guideSpotId)}">
    <header>
      <span>${escapeHtml(guide.programTitle ?? "マイガイド")}</span>
      <h2>${escapeHtml(guide.guideTitle)}</h2>
      <p>${escapeHtml(guide.guideSubtitle || guide.preview)}</p>
    </header>
    <div class="my-guide-meta">
      <span>${escapeHtml(guideDistanceBandLabel(guide.distanceBand))}</span>
      <span>本人用</span>
      <span>後から再生可</span>
    </div>
    <p>${escapeHtml(guide.preview)}</p>
    ${points}
    <div class="my-guides-actions">
      <button type="button" data-my-guide-play>聞く</button>
      ${guide.programSlug ? `<a href="${escapeHtml(withBasePath(basePath, `/guide-programs/${guide.programSlug}`))}">企画を見る</a>` : ""}
      <a href="${escapeHtml(withBasePath(basePath, "/map"))}">マップで見る</a>
    </div>
    ${sources}
  </article>`;
}

function programProgressLabel(program: GuideProgramPublicDetail): string {
  const progress = program.progress;
  if (progress.state === "signed_out") return "ログインすると自分の進捗が表示されます";
  if (progress.totalRequired === 0) return "自由参加";
  if (progress.state === "complete") return "完了";
  if (progress.state === "not_started") return "未開始";
  return "進行中";
}

function renderProgramProgress(program: GuideProgramPublicDetail): string {
  const progress = program.progress;
  const countLabel = progress.totalRequired === 0
    ? `${progress.unlockedSpots}/${progress.totalSpots} 任意`
    : `${progress.unlockedRequired}/${progress.totalRequired} 解放`;
  return `<div class="guide-program-progress" aria-label="ガイドリレー進捗">
    <div class="guide-program-progress-row">
      <span>${escapeHtml(programProgressLabel(program))}</span>
      <strong>${escapeHtml(countLabel)}</strong>
    </div>
    <div class="guide-program-progress-track" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, progress.percent))}%"></span></div>
  </div>`;
}

function renderProgramActionDeck(basePath: string, program: GuideProgramPublicDetail): string {
  const mapHref = guideProgramMapHref(basePath, program);
  return `<section class="guide-program-action-deck" aria-label="参加者の次の行動">
    <a class="guide-program-action-link" data-primary="true" href="${escapeHtml(withBasePath(basePath, "/record"))}">
      <b>1</b>
      <div>
        <strong>近くで記録する</strong>
        <span>この企画の地点に近い観察記録を残すと、本人用ガイドが開きます。</span>
      </div>
    </a>
    <a class="guide-program-action-link" href="${escapeHtml(mapHref)}">
      <b>2</b>
      <div>
        <strong>地点を地図で確認</strong>
        <span>来訪できるガイド地点を地図で見て、次に歩く場所を決めます。</span>
      </div>
    </a>
    <a class="guide-program-action-link" href="${escapeHtml(withBasePath(basePath, "/my-guides"))}">
      <b>3</b>
      <div>
        <strong>あとからMy Guide</strong>
        <span>解放したガイドは公開投稿にせず、本人用に保存して見返せます。</span>
      </div>
    </a>
  </section>`;
}

function renderProgramCard(basePath: string, program: GuideProgramPublicDetail): string {
  return `<article class="guide-program-card">
    <h2>${escapeHtml(program.title)}</h2>
    <p>${escapeHtml(program.publicSummary ?? "近くで記録を残すと、現地ガイドが本人用に解放される企画です。")}</p>
    ${renderProgramProgress(program)}
    <div class="my-guide-meta">
      <span>${program.spots.length}ガイド</span>
      <span>${program.participationMode === "ordered" ? "順番あり" : "どこからでも"}</span>
      <span>位置は本人用</span>
    </div>
    <div class="my-guides-actions">
      <a href="${escapeHtml(withBasePath(basePath, `/guide-programs/${program.slug}`))}">詳細を見る</a>
      <a href="${escapeHtml(withBasePath(basePath, "/record"))}">近くで記録する</a>
    </div>
  </article>`;
}

function renderProgramSpot(spot: GuideProgramPublicSpot, index: number): string {
  return `<article class="guide-program-spot" data-unlocked="${spot.unlocked ? "true" : "false"}">
    <b>${spot.unlocked ? "済" : String(index + 1)}</b>
    <div>
      <strong>${escapeHtml(spot.title)}</strong>
      <p>${escapeHtml(spot.subtitle || spot.preview)}</p>
      <p>${escapeHtml(spot.visitAnchorLabel)}</p>
    </div>
  </article>`;
}

function guideProgramMapHref(
  basePath: string,
  program: GuideProgramPublicDetail,
  layout: GuideProgramStaticMapLayout<GuideProgramPublicSpot> | null = buildGuideProgramStaticMapLayout(program.spots),
): string {
  const mapBase = withBasePath(basePath, "/map");
  if (!layout) return mapBase;
  const params = new URLSearchParams({
    lat: layout.centerLat.toFixed(6),
    lng: layout.centerLng.toFixed(6),
    z: String(layout.zoom),
    guideProgram: program.slug,
  });
  return `${mapBase}?${params.toString()}`;
}

function renderGuideProgramStaticTiles(layout: GuideProgramStaticMapLayout<GuideProgramPublicSpot>): string {
  const tiles = layout.tiles.map((tile) => `<img
      data-guide-static-tile="true"
      data-guide-static-tile-x="${tile.x}"
      data-guide-static-tile-y="${tile.y}"
      src="${escapeHtml(tile.url)}"
      alt=""
      loading="lazy"
      decoding="async"
      width="256"
      height="256">`);
  return `<div class="guide-program-map-static"
      data-guide-static-map="gsi-std"
      data-guide-static-map-zoom="${layout.zoom}"
      data-guide-static-map-tile-cols="${layout.tileCols}"
      data-guide-static-map-tile-rows="${layout.tileRows}"
      data-guide-static-map-origin-x="${layout.tileOriginX}"
      data-guide-static-map-origin-y="${layout.tileOriginY}"
      aria-hidden="true">${tiles.join("")}</div>`;
}

function renderGuideProgramMap(basePath: string, program: GuideProgramPublicDetail): string {
  const layout = buildGuideProgramStaticMapLayout(program.spots);
  if (!layout) return "";
  const mapHref = guideProgramMapHref(basePath, program, layout);
  const staticTiles = renderGuideProgramStaticTiles(layout);
  const fallbackPins = layout.pins.map((pin, index) => `<a class="guide-program-map-pin"
      href="${escapeHtml(mapHref)}"
      data-unlocked="${pin.spot.unlocked ? "true" : "false"}"
      style="--pin-x:${pin.xPct.toFixed(2)}%;--pin-y:${pin.yPct.toFixed(2)}%;"
      aria-label="${escapeHtml(`${pin.spot.title} の来訪地点をマップで見る`)}">
      <i>${pin.spot.unlocked ? "済" : String(index + 1)}</i>
      <span>${escapeHtml(pin.spot.title)}</span>
    </a>`).join("");
  return `<section class="guide-program-map" data-guide-program-map-preview="static-gsi" aria-label="ガイドスポットの来訪地点">
    <div class="guide-program-map-fallback">${staticTiles}${fallbackPins}</div>
    <div class="guide-program-map-head">
      <div>
        <strong>ガイドの来訪地点</strong>
        <span>${escapeHtml(program.spots.length === 1 ? "実際の地図上に来訪地点を表示しています" : "企画内のガイドスポットを実際の地図上に表示しています")}</span>
      </div>
      <a href="${escapeHtml(mapHref)}">大きいマップ</a>
    </div>
    <div class="guide-program-map-note">表示は来訪承諾または公開情報で案内できるガイド地点です。あなたの記録位置や解放地点は公開しません。地図画像: 国土地理院「地理院タイル（標準地図）」</div>
  </section>`;
}

function renderProgramDetail(basePath: string, program: GuideProgramPublicDetail, canManage = false): string {
  const next = program.nextSpot
    ? `<section class="guide-program-next">次に解放しやすいガイド: ${escapeHtml(program.nextSpot.title)}。近くで観察記録を残すと、本人用に保存されます。</section>`
    : program.progress.state === "complete"
      ? `<section class="guide-program-next">この企画の必須ガイドはすべて解放済みです。あとから何度でも聞き直せます。</section>`
      : `<section class="guide-program-next">ログインして近くで記録すると、自分の進捗がここに表示されます。</section>`;
  return `<main class="my-guides-page">
    <section class="my-guides-hero">
      <span>Guide relay</span>
      <h1>${escapeHtml(program.title)}</h1>
      <p>${escapeHtml(program.publicSummary ?? "近くで記録を残すと、現地ガイドが本人用に解放される企画です。")}</p>
      <div class="my-guides-actions">
        <a href="${escapeHtml(withBasePath(basePath, "/record"))}">近くで記録する</a>
        <a href="${escapeHtml(withBasePath(basePath, "/map"))}">マップで見る</a>
        <a href="${escapeHtml(withBasePath(basePath, "/my-guides"))}">マイガイド</a>
        ${canManage ? `<a href="${escapeHtml(withBasePath(basePath, `/admin/guide-programs/${program.programId}/recap`))}">運営recap</a>` : ""}
      </div>
    </section>
    <section class="guide-program-card">
      ${renderProgramProgress(program)}
      <div class="my-guide-meta">
        <span>${program.spots.length}ガイド</span>
        <span>${program.participationMode === "ordered" ? "順番あり" : "どこからでも"}</span>
        <span>公開投稿不要</span>
      </div>
    </section>
    ${renderProgramActionDeck(basePath, program)}
    ${next}
    ${renderGuideProgramMap(basePath, program)}
    <section class="guide-program-spot-list">${program.spots.map(renderProgramSpot).join("")}</section>
  </main>`;
}

function myGuidesBootScript(basePath: string): string {
  const listenedApi = withBasePath(basePath, "/api/v1/guides/unlocks/__GUIDE_SPOT_ID__/listened");
  return `<script>
(() => {
  const listenedApi = ${JSON.stringify(listenedApi)};
  function postListened(id) {
    const url = listenedApi.replace('__GUIDE_SPOT_ID__', encodeURIComponent(id));
    fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
  }
  document.querySelectorAll('[data-my-guide-play]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('[data-guide-script]');
      const script = card ? String(card.getAttribute('data-guide-script') || '') : '';
      const id = card ? String(card.getAttribute('data-guide-spot-id') || '') : '';
      if (!script || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(script);
      utterance.lang = 'ja-JP';
      window.speechSynthesis.speak(utterance);
      if (id) postListened(id);
    });
  });
})();
</script>`;
}

export async function registerGuideReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/guide-programs", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const programs = await listPublishedGuideProgramsForPublic(session?.userId ?? null).catch(() => []);
    const body = `<main class="my-guides-page">
      <section class="my-guides-hero">
        <span>For participants</span>
        <h1>近くで記録すると、現地ガイドが開く</h1>
        <p>ここは参加者向けのページです。ガイドのあるエリアで観察記録を残すと、その場所の見どころや背景をあとから本人用に見返せます。</p>
        <div class="my-guides-actions">
          <a href="${escapeHtml(withBasePath(basePath, "/record"))}">近くで記録する</a>
          <a href="${escapeHtml(withBasePath(basePath, "/my-guides"))}">マイガイド</a>
        </div>
      </section>
      <section class="guide-program-audience-note">
        <span><strong>自治体・企業・DMOの方へ:</strong> 企画づくり、観察会、匿名recapの説明は別ページに分けました。</span>
        <a href="${escapeHtml(withBasePath(basePath, "/for-business/field-programs"))}">導入向け説明を見る</a>
      </section>
      ${programs.length
        ? `<section class="guide-program-list">${programs.map((program) => renderProgramCard(basePath, program)).join("")}</section>`
        : `<section class="my-guide-empty">公開中のガイドリレー企画はまだありません。</section>`}
    </main>`;
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: "ガイドリレー企画 | ZUKAN",
      activeNav: "guide",
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, "/guide-programs"), lang),
      extraStyles: MY_GUIDES_STYLES,
      body,
      footerNote: "ガイドリレー企画は、記録をきっかけに本人用ガイドを解放します。",
    });
  });

  app.get<{ Params: { slug: string } }>("/guide-programs/:slug", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const program = await getPublishedGuideProgramDetail(request.params.slug, session?.userId ?? null).catch(() => null);
    if (!program) {
      reply.code(404).type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        title: "ガイドリレー企画が見つかりません | ZUKAN",
        activeNav: "guide",
        lang,
        currentPath: appendLangToHref(withBasePath(basePath, "/guide-programs"), lang),
        extraStyles: MY_GUIDES_STYLES,
        body: `<main class="my-guides-page"><section class="my-guide-empty">このガイドリレー企画は公開されていないか、期間外です。</section></main>`,
        footerNote: "公開中の企画だけを表示します。",
      });
    }
    reply.type("text/html; charset=utf-8");
    const canManage = Boolean(session && !session.banned && isAdminOrAnalystRole(session.roleName, session.rankLabel));
    return renderSiteDocument({
      basePath,
      title: `${program.title} | ZUKAN`,
      activeNav: "guide",
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, `/guide-programs/${program.slug}`), lang),
      extraStyles: MY_GUIDES_STYLES,
      body: renderProgramDetail(basePath, program, canManage),
      footerNote: "進捗は本人用です。正確な記録位置は公開しません。",
    });
  });

  app.get("/my-guides", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const guides = session?.userId ? await listMyGuideUnlocks(session.userId).catch(() => []) : [];
    const body = `<main class="my-guides-page">
      <section class="my-guides-hero">
        <span>My guides</span>
        <h1>解放した現地ガイド</h1>
        <p>近くで記録を残した時に解放されたガイドだけを、本人用に保存します。公開投稿や正確な位置共有を条件にしないので、あとから落ち着いて聞き直せます。</p>
        <div class="my-guides-actions">
          <a href="${escapeHtml(withBasePath(basePath, "/map"))}">マップを開く</a>
          <a href="${escapeHtml(withBasePath(basePath, "/record"))}">近くで記録する</a>
        </div>
      </section>
      ${!session?.userId
        ? `<section class="my-guide-empty">ログインすると、記録で解放されたガイドがここに保存されます。</section>`
        : guides.length
          ? `<section class="my-guides-grid">${guides.map((guide) => renderMyGuideCard(basePath, guide)).join("")}</section>`
          : `<section class="my-guide-empty">まだ解放済みガイドはありません。ガイドのあるエリアの近くで観察記録を残すと、ここに保存されます。</section>`}
    </main>${myGuidesBootScript(basePath)}`;
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: "マイガイド | ZUKAN",
      activeNav: "guide",
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, "/my-guides"), lang),
      extraStyles: MY_GUIDES_STYLES,
      body,
      footerNote: "解放済みガイドは本人用の台帳です。",
    });
  });

  app.get("/guide", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const guidePageCopy = getShortCopy<any>(lang, "public", "read.guide");
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: guidePageCopy.title,
      activeNav: guidePageCopy.activeNav,
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, "/guide"), lang),
      extraStyles: `${GUIDE_FLOW_STYLES}\n${GUIDE_ENTRY_STYLES}`,
      body: `${renderGuideFlow(basePath, lang)}${renderGuideLoopPanel(basePath, lang)}`,
      footerNote: guidePageCopy.footerNote,
    });
  });
}
