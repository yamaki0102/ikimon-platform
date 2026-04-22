import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { LandingSnapshot } from "../services/readModels.js";
import { renderObservationCard } from "./observationCard.js";
import { escapeHtml } from "./siteShell.js";

type MainCopy = {
  eyebrow: string;
  heading: string;
  lead: string;
  myNotebookLabel: string;
  myNotebookEmpty: string;
  myPlacesLabel: string;
  nearbyLabel: string;
  nearbyEmpty: string;
  ctaLoggedIn: string;
  ctaGuest: string;
  ambientLabel: string;
  ambientEmpty: string;
  seeMore: string;
};

const mainCopy: Record<SiteLang, MainCopy> = {
  ja: {
    eyebrow: "あなたの 1 冊",
    heading: "📖 フィールドノート",
    lead: "歩いて見つけた生きものや場所、ほかの人の観察につけた同定も、1 冊のノートに積み上げる。あとで見返すと、同じ道でも少し違う面が見えてくる。",
    myNotebookLabel: "あなたの最近のページ (観察 + 同定)",
    myNotebookEmpty: "まだノートは真っ白。観察の記録、もしくは他の人の観察への同定を書き込むと、ここに積み上がり始めます。",
    myPlacesLabel: "よく歩く場所",
    nearbyLabel: "近くで見つかっているもの",
    nearbyEmpty: "近くの観察はまだ少なめです。最初の 1 件が、この場所をあとで見比べる手がかりになります。",
    ctaLoggedIn: "続きを書く",
    ctaGuest: "あなたのノートを始める",
    ambientLabel: "同じ場所を歩いている人たち",
    ambientEmpty: "まだこのあたりの記録は少なめです。ここから最初の 1 枚が始まるかもしれません。",
    seeMore: "ノート全体を開く",
  },
  en: {
    eyebrow: "Your notebook",
    heading: "📖 Field Note",
    lead: "Stack your walks, nearby finds, and identifications you added to other observations into one notebook. Looking back later makes the same path feel richer.",
    myNotebookLabel: "Your recent pages (observations + identifications)",
    myNotebookEmpty: "The notebook is blank. Write the first page and it will start stacking here.",
    myPlacesLabel: "Places you walk often",
    nearbyLabel: "Nearby finds",
    nearbyEmpty: "Nearby pages are still sparse. A first page here becomes something to compare later.",
    ctaLoggedIn: "Keep writing",
    ctaGuest: "Start your notebook",
    ambientLabel: "People walking the same places",
    ambientEmpty: "There are still only a few pages here. This could become one of the first.",
    seeMore: "Open the full notebook",
  },
  es: {
    eyebrow: "Tu cuaderno",
    heading: "📖 Cuaderno de campo",
    lead: "Apila en un cuaderno lo que encuentras en tus paseos. Al releerlo después, el mismo camino se vuelve más rico.",
    myNotebookLabel: "Tus páginas recientes",
    myNotebookEmpty: "El cuaderno está en blanco. Escribe la primera página y empezará a apilarse aquí.",
    myPlacesLabel: "Lugares que caminas a menudo",
    nearbyLabel: "Hallazgos cercanos",
    nearbyEmpty: "Aún hay pocos hallazgos cercanos. La primera página aquí ya sirve para comparar después.",
    ctaLoggedIn: "Seguir escribiendo",
    ctaGuest: "Comenzar tu cuaderno",
    ambientLabel: "Personas caminando por los mismos lugares",
    ambientEmpty: "Todavía hay pocas páginas aquí. Esta podría ser una de las primeras.",
    seeMore: "Abrir el cuaderno completo",
  },
  "pt-BR": {
    eyebrow: "Seu caderno",
    heading: "📖 Caderno de campo",
    lead: "Empilhe em um caderno o que encontra nas caminhadas. Quando você volta depois, o mesmo caminho ganha novas camadas.",
    myNotebookLabel: "Suas páginas recentes",
    myNotebookEmpty: "O caderno está em branco. Escreva a primeira página e ela começará a se acumular aqui.",
    myPlacesLabel: "Lugares que caminha com frequência",
    nearbyLabel: "Descobertas por perto",
    nearbyEmpty: "Ainda há poucas descobertas por perto. A primeira página aqui já ajuda a comparar depois.",
    ctaLoggedIn: "Continuar escrevendo",
    ctaGuest: "Começar seu caderno",
    ambientLabel: "Pessoas caminhando pelos mesmos lugares",
    ambientEmpty: "Ainda há poucas páginas aqui. Esta pode ser uma das primeiras.",
    seeMore: "Abrir o caderno completo",
  },
};

export function renderFieldNoteMain(
  basePath: string,
  lang: SiteLang,
  snapshot: LandingSnapshot,
): string {
  const copy = mainCopy[lang];
  const isLoggedIn = Boolean(snapshot.viewerUserId);
  const recordHref = appendLangToHref(withBasePath(basePath, "/record"), lang);
  const notesHref = appendLangToHref(withBasePath(basePath, "/notes"), lang);
  const ctaHref = isLoggedIn ? notesHref : recordHref;
  const ctaLabel = isLoggedIn ? copy.ctaLoggedIn : copy.ctaGuest;

  const myFeedSection = (() => {
    if (!isLoggedIn) return "";
    if (snapshot.myFeed.length === 0) {
      const emptyCtaLabel = lang === "ja" ? "1 ページ書く" :
        lang === "es" ? "Escribe 1 página" :
        lang === "pt-BR" ? "Escreva 1 página" : "Write 1 page";
      return `<div class="fn-empty">
        <p>${escapeHtml(copy.myNotebookEmpty)}</p>
        <a class="btn btn-solid" href="${escapeHtml(recordHref)}" data-kpi-action="fieldnote:empty-start">${escapeHtml(emptyCtaLabel)}</a>
      </div>`;
    }
    const cards = snapshot.myFeed
      .slice(0, 4)
      .map((obs) => renderObservationCard(basePath, lang, obs, { compact: true }))
      .join("");
    return `<div class="fn-subhead"><h3>${escapeHtml(copy.myNotebookLabel)}</h3></div>
      <div class="fn-grid fn-grid-compact">${cards}</div>`;
  })();

  const myPlacesSection = (() => {
    if (!isLoggedIn || snapshot.myPlaces.length === 0) return "";
    const items = snapshot.myPlaces
      .slice(0, 6)
      .map((place) => `<a class="fn-place-chip" href="${escapeHtml(appendLangToHref(withBasePath(basePath, `/profile/${encodeURIComponent(snapshot.viewerUserId ?? "")}`), lang))}">
        <strong>${escapeHtml(place.placeName)}</strong>
        <span>${escapeHtml(place.municipality || "")} · ${place.visitCount}回</span>
      </a>`)
      .join("");
    return `<div class="fn-subhead"><h3>${escapeHtml(copy.myPlacesLabel)}</h3></div>
      <div class="fn-place-row">${items}</div>`;
  })();

  const nearbySection = (() => {
    if (snapshot.feed.length === 0) {
      return `<div class="fn-subhead"><h3>${escapeHtml(copy.nearbyLabel)}</h3></div>
        <div class="fn-empty">${escapeHtml(copy.nearbyEmpty)}</div>`;
    }
    const cards = snapshot.feed
      .slice(0, 6)
      .map((obs) => renderObservationCard(basePath, lang, obs))
      .join("");
    return `<div class="fn-subhead"><h3>${escapeHtml(copy.nearbyLabel)}</h3></div>
      <div class="fn-grid">${cards}</div>`;
  })();

  const ambientSection = (() => {
    if (snapshot.ambient.length === 0) return "";
    const items = snapshot.ambient
      .slice(0, 6)
      .map((obs) => {
        const href = appendLangToHref(withBasePath(basePath, `/profile/${encodeURIComponent(obs.userId)}`), lang);
        const avatar = obs.avatarUrl
          ? `<img src="${escapeHtml(obs.avatarUrl)}" alt="" loading="lazy" />`
          : `<span class="fn-ambient-placeholder">${escapeHtml(obs.displayName.slice(0, 1))}</span>`;
        return `<a class="fn-ambient-item" href="${escapeHtml(href)}" title="${escapeHtml(obs.latestDisplayName)}">
          <span class="fn-ambient-avatar">${avatar}</span>
          <span class="fn-ambient-meta">
            <span class="fn-ambient-name">${escapeHtml(obs.displayName)}</span>
            <span class="fn-ambient-latest">${escapeHtml(obs.latestDisplayName)}</span>
          </span>
        </a>`;
      })
      .join("");
    return `<div class="fn-ambient">
      <div class="fn-ambient-label">${escapeHtml(copy.ambientLabel)}</div>
      <div class="fn-ambient-row">${items}</div>
    </div>`;
  })();

  return `<section class="section fn-main" aria-labelledby="fn-main-heading">
    <div class="fn-main-card">
      <div class="fn-main-head">
        <div class="fn-main-head-copy">
          <span class="fn-main-eyebrow">${escapeHtml(copy.eyebrow)}</span>
          <h2 id="fn-main-heading" class="fn-main-heading">${escapeHtml(copy.heading)}</h2>
          <p class="fn-main-lead">${escapeHtml(copy.lead)}</p>
        </div>
        <div class="fn-main-head-actions">
          <a class="btn btn-solid" href="${escapeHtml(ctaHref)}" data-kpi-action="fieldnote:${isLoggedIn ? "continue" : "start"}">${escapeHtml(ctaLabel)}</a>
          ${isLoggedIn ? `<a class="inline-link" href="${escapeHtml(notesHref)}">${escapeHtml(copy.seeMore)}</a>` : ""}
        </div>
      </div>
      ${myFeedSection}
      ${myPlacesSection}
      ${nearbySection}
      ${ambientSection}
    </div>
  </section>`;
}

export const FIELD_NOTE_MAIN_STYLES = `
  .fn-main { margin-top: 24px; }
  .fn-main-card { position: relative; padding: 32px 32px 28px; border-radius: 32px; background: linear-gradient(180deg,#ffffff 0%, #f8fafc 100%); border: 1px solid rgba(15,23,42,.05); box-shadow: 0 26px 64px rgba(15,23,42,.07); overflow: hidden; }
  .fn-main-card::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0, transparent 40px, rgba(14,165,233,.05) 41px, transparent 42px); pointer-events: none; }
  .fn-main-card::after { content: ""; position: absolute; inset: 0 auto 0 22px; width: 2px; background: linear-gradient(180deg, rgba(239,68,68,.24), rgba(239,68,68,.1)); pointer-events: none; }
  .fn-main-card > * { position: relative; z-index: 1; }
  .fn-main-head { display: flex; flex-wrap: wrap; gap: 20px 28px; align-items: flex-end; justify-content: space-between; margin-bottom: 22px; padding-left: 18px; }
  .fn-main-head-copy { max-width: 640px; }
  .fn-main-eyebrow { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(16,185,129,.1); color: #059669; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .fn-main-heading { margin: 12px 0 10px; font-family: "Zen Kaku Gothic New","Inter","Noto Sans JP",sans-serif; font-size: clamp(26px,3.2vw,36px); font-weight: 900; letter-spacing: -.02em; line-height: 1.28; color: #0f172a; }
  .fn-main-lead { margin: 0; font-size: 15px; line-height: 1.85; color: #475569; max-width: 60ch; }
  .fn-main-head-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; min-width: 220px; }
  .fn-main-head-actions .btn { padding: 13px 22px; }
  .fn-subhead { margin-top: 26px; margin-bottom: 12px; padding-left: 18px; }
  .fn-subhead h3 { margin: 0; font-family: "Zen Kaku Gothic New","Inter","Noto Sans JP",sans-serif; font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; display: inline-flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 2px solid rgba(16,185,129,.28); }
  .fn-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; padding-left: 18px; }
  .fn-grid-compact { grid-template-columns: repeat(4, minmax(0,1fr)); }
  .fn-empty { margin-left: 18px; padding: 18px 22px; border-radius: 18px; background: rgba(248,250,252,.8); color: #64748b; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .fn-empty p { margin: 0; flex: 1 1 240px; }
  .fn-empty .btn { flex-shrink: 0; }
  .fn-place-row { display: flex; flex-wrap: wrap; gap: 10px; padding-left: 18px; }
  .fn-place-chip { padding: 10px 14px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.06); box-shadow: 0 6px 14px rgba(15,23,42,.04); display: flex; flex-direction: column; gap: 2px; text-decoration: none; color: inherit; font-size: 12px; transition: transform .15s ease; }
  .fn-place-chip:hover { transform: translateY(-2px); }
  .fn-place-chip strong { font-size: 14px; font-weight: 800; color: #0f172a; }
  .fn-place-chip span { color: #64748b; font-weight: 600; }
  .fn-ambient { margin-top: 28px; padding-top: 20px; padding-left: 18px; border-top: 1px dashed rgba(15,23,42,.08); }
  .fn-ambient-label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; margin-bottom: 10px; }
  .fn-ambient-row { display: flex; flex-wrap: wrap; gap: 10px; }
  .fn-ambient-item { display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.05); text-decoration: none; color: inherit; transition: transform .15s ease, border-color .15s ease; }
  .fn-ambient-item:hover { transform: translateY(-1px); border-color: rgba(14,165,233,.28); }
  .fn-ambient-avatar { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg,#d1fae5,#bae6fd); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .fn-ambient-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .fn-ambient-placeholder { font-size: 11px; font-weight: 800; color: #065f46; }
  .fn-ambient-meta { display: flex; flex-direction: column; line-height: 1.3; }
  .fn-ambient-name { font-size: 13px; font-weight: 800; color: #0f172a; }
  .fn-ambient-latest { font-size: 11px; color: #64748b; }
  @media (max-width: 860px) {
    .fn-main-card { padding: 24px 20px 22px; }
    .fn-main-head { padding-left: 8px; }
    .fn-subhead, .fn-grid, .fn-place-row, .fn-empty, .fn-ambient { padding-left: 0; }
    .fn-main-head-actions { align-items: flex-start; min-width: 0; width: 100%; }
    .fn-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .fn-grid-compact { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
  @media (max-width: 480px) {
    .fn-grid, .fn-grid-compact { grid-template-columns: 1fr; }
  }
`;
