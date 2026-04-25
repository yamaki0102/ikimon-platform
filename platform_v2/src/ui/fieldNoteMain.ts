import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { JA_PUBLIC_SHARED_COPY } from "../copy/jaPublic.js";
import type { LandingSnapshot } from "../services/readModels.js";
import { renderObservationCard } from "./observationCard.js";
import {
  buildOfficialNoticeClientRenderer,
  getOfficialNoticeRenderCopy,
  OFFICIAL_NOTICE_CARD_STYLES,
} from "./officialNoticeCard.js";
import { buildPlaceRecordHref, formatShortDate, pickPlaceFocus } from "./placeRevisit.js";
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
  hypothesisLabel: string;
  hypothesisLoading: string;
  hypothesisChecksLabel: string;
  hypothesisCapturesLabel: string;
  hypothesisReasonsLabel: string;
  walkLabel: string;
  walkNoActivity: string;
  walkDistUnit: string;
  placeFirstVisit: string;
  placeComparedOn: (date: string) => string;
  placeNextLook: (focus: string) => string;
  placeNextFallback: string;
  placeRecordLabel: string;
};

const mainCopy: Record<SiteLang, MainCopy> = {
  ja: {
    eyebrow: "あなたのノート",
    heading: "見つけたことを、あとで見返せる",
    lead: "歩いて見つけたことを 1 冊のノートに残します。読み返すたび、同じ道が少し違って見えてきます。",
    myNotebookLabel: "最近の記録",
    myNotebookEmpty: "まだ何も書かれていません。最初の 1 件を残すと、ここから積み上がります。",
    myPlacesLabel: "よく歩く場所",
    nearbyLabel: "近くで見つかっているもの",
    nearbyEmpty: "近くの記録はまだありません。あなたの 1 件が、この場所の最初のページになります。",
    ctaLoggedIn: JA_PUBLIC_SHARED_COPY.cta.openNotebook,
    ctaGuest: JA_PUBLIC_SHARED_COPY.cta.record,
    ambientLabel: "同じ場所を歩いている人",
    ambientEmpty: "まだ誰も書いていません。あなたが 1 件目になれます。",
    seeMore: JA_PUBLIC_SHARED_COPY.cta.openNotebook,
    hypothesisLabel: "この場所で見てみる",
    hypothesisLoading: "現在地を読み解き中…",
    hypothesisChecksLabel: "現地で確かめる",
    hypothesisCapturesLabel: "撮るなら",
    hypothesisReasonsLabel: "根拠",
    walkLabel: "今日の記録",
    walkNoActivity: "まだ今日の記録がありません",
    walkDistUnit: "m",
    placeFirstVisit: "この場所の最初のページ",
    placeComparedOn: (date) => `前回 ${date}`,
    placeNextLook: (focus) => `次は ${focus}`,
    placeNextFallback: "次の散歩で小さな変化を 1 件残す",
    placeRecordLabel: "ここで記録",
  },
  en: {
    eyebrow: "Your notebook",
    heading: "📖 Field Note",
    lead: "Stack your walks, nearby finds, and identifications you gave on others' observations into one notebook. The more you re-read it, the more the same path changes.",
    myNotebookLabel: "Your recent pages (observations + identifications)",
    myNotebookEmpty: "The notebook is blank. Write the first page and it will start stacking here.",
    myPlacesLabel: "Places you walk often",
    nearbyLabel: "Nearby finds",
    nearbyEmpty: "No nearby finds yet. Your first record will start the notebook for this area.",
    ctaLoggedIn: "Keep writing",
    ctaGuest: "Start your notebook",
    ambientLabel: "People walking the same places",
    ambientEmpty: "No one else has opened a page yet. You can be the first.",
    seeMore: "Open the full notebook",
    hypothesisLabel: "Today's hypothesis",
    hypothesisLoading: "Reading your location…",
    hypothesisChecksLabel: "Check on the ground",
    hypothesisCapturesLabel: "If you shoot",
    hypothesisReasonsLabel: "Why",
    walkLabel: "Today's walk",
    walkNoActivity: "No walk recorded today yet",
    walkDistUnit: "m",
    placeFirstVisit: "First page for this place",
    placeComparedOn: (date) => `Last time ${date}`,
    placeNextLook: (focus) => `Next: ${focus}`,
    placeNextFallback: "Leave one small change next walk",
    placeRecordLabel: "Record here",
  },
  es: {
    eyebrow: "Tu cuaderno",
    heading: "📖 Cuaderno de campo",
    lead: "Apila en un cuaderno lo que encuentras en tus paseos. Cuanto más lo relees, más cambia el mismo camino.",
    myNotebookLabel: "Tus páginas recientes",
    myNotebookEmpty: "El cuaderno está en blanco. Escribe la primera página y empezará a apilarse aquí.",
    myPlacesLabel: "Lugares que caminas a menudo",
    nearbyLabel: "Hallazgos cercanos",
    nearbyEmpty: "Aún no hay hallazgos cercanos. Tu primer registro abrirá el cuaderno de esta zona.",
    ctaLoggedIn: "Seguir escribiendo",
    ctaGuest: "Comenzar tu cuaderno",
    ambientLabel: "Personas caminando por los mismos lugares",
    ambientEmpty: "Nadie ha abierto una página todavía. Puedes ser la primera persona.",
    seeMore: "Abrir el cuaderno completo",
    hypothesisLabel: "Hipótesis de hoy",
    hypothesisLoading: "Leyendo tu ubicación…",
    hypothesisChecksLabel: "Verifica en el sitio",
    hypothesisCapturesLabel: "Si disparas",
    hypothesisReasonsLabel: "Por qué",
    walkLabel: "Caminata de hoy",
    walkNoActivity: "No hay registro de caminata hoy",
    walkDistUnit: "m",
    placeFirstVisit: "Primera página de este lugar",
    placeComparedOn: (date) => `Última vez ${date}`,
    placeNextLook: (focus) => `Próximo: ${focus}`,
    placeNextFallback: "Deja un cambio pequeño en la próxima caminata",
    placeRecordLabel: "Registrar aquí",
  },
  "pt-BR": {
    eyebrow: "Seu caderno",
    heading: "📖 Caderno de campo",
    lead: "Empilhe em um caderno o que encontra nas caminhadas. Quanto mais você relê, mais o mesmo caminho muda.",
    myNotebookLabel: "Suas páginas recentes",
    myNotebookEmpty: "O caderno está em branco. Escreva a primeira página e ela começará a se acumular aqui.",
    myPlacesLabel: "Lugares que caminha com frequência",
    nearbyLabel: "Descobertas por perto",
    nearbyEmpty: "Ainda não há descobertas por perto. Seu primeiro registro abrirá o caderno desta área.",
    ctaLoggedIn: "Continuar escrevendo",
    ctaGuest: "Começar seu caderno",
    ambientLabel: "Pessoas caminhando pelos mesmos lugares",
    ambientEmpty: "Ninguém abriu uma página ainda. Você pode ser a primeira pessoa.",
    seeMore: "Abrir o caderno completo",
    hypothesisLabel: "Hipótese de hoje",
    hypothesisLoading: "Lendo sua localização…",
    hypothesisChecksLabel: "Verifique no campo",
    hypothesisCapturesLabel: "Se for fotografar",
    hypothesisReasonsLabel: "Por quê",
    walkLabel: "Caminhada de hoje",
    walkNoActivity: "Nenhum registro de caminhada hoje",
    walkDistUnit: "m",
    placeFirstVisit: "Primeira página deste lugar",
    placeComparedOn: (date) => `Última vez ${date}`,
    placeNextLook: (focus) => `Próximo: ${focus}`,
    placeNextFallback: "Registre uma pequena mudança na próxima caminhada",
    placeRecordLabel: "Registrar aqui",
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
      .map((obs) => renderObservationCard(basePath, lang, obs, { compact: true, locationMode: "owner" }))
      .join("");
    return `<div class="fn-subhead"><h3>${escapeHtml(copy.myNotebookLabel)}</h3></div>
      <div class="fn-grid fn-grid-compact">${cards}</div>`;
  })();

  const myPlacesSection = (() => {
    if (!isLoggedIn || snapshot.myPlaces.length === 0) return "";
    const items = snapshot.myPlaces
      .slice(0, 6)
      .map((place) => {
        const compareLabel = place.previousObservedAt
          ? copy.placeComparedOn(formatShortDate(place.previousObservedAt, lang === "ja" ? "ja-JP" : "en-US"))
          : copy.placeFirstVisit;
        const focus = pickPlaceFocus(place);
        const nextLabel = focus ? copy.placeNextLook(focus) : copy.placeNextFallback;
        const recordPlaceHref = buildPlaceRecordHref(basePath, lang, snapshot.viewerUserId, place);
        return `<a class="fn-place-chip" href="${escapeHtml(recordPlaceHref)}" data-kpi-action="fieldnote:place-record">
          <strong>${escapeHtml(place.placeName)}</strong>
          <span>${escapeHtml(place.municipality || "")}${place.municipality ? " · " : ""}${escapeHtml(String(place.visitCount))}回</span>
          <span class="fn-place-detail">${escapeHtml(compareLabel)}</span>
          <span class="fn-place-detail">${escapeHtml(nextLabel)}</span>
          <span class="fn-place-cta">${escapeHtml(copy.placeRecordLabel)}</span>
        </a>`;
      })
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
      .map((obs) => renderObservationCard(basePath, lang, obs, { compact: true, locationMode: "public", showEvidenceTier: false }))
      .join("");
    return `<div class="fn-subhead"><h3>${escapeHtml(copy.nearbyLabel)}</h3></div>
      <div class="fn-grid fn-grid-nearby">${cards}</div>`;
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

  const apiSiteBrief = withBasePath(basePath, "/api/v1/map/site-brief");
  const apiWalkToday = withBasePath(basePath, "/api/v1/walk/today");
  const briefLang = lang === "en" ? "en" : "ja";
  const noticeCopy = getOfficialNoticeRenderCopy(lang);

  return `<section class="section fn-main" aria-labelledby="fn-main-heading"
    data-api-site-brief="${escapeHtml(apiSiteBrief)}"
    data-api-walk-today="${escapeHtml(apiWalkToday)}"
    data-brief-lang="${escapeHtml(briefLang)}"
    data-copy-loading="${escapeHtml(copy.hypothesisLoading)}"
    data-copy-checks="${escapeHtml(copy.hypothesisChecksLabel)}"
    data-copy-captures="${escapeHtml(copy.hypothesisCapturesLabel)}"
    data-copy-reasons="${escapeHtml(copy.hypothesisReasonsLabel)}"
    data-copy-walk-label="${escapeHtml(copy.walkLabel)}"
    data-copy-walk-no-activity="${escapeHtml(copy.walkNoActivity)}"
    data-copy-walk-dist-unit="${escapeHtml(copy.walkDistUnit)}">
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
      <div class="fn-hypothesis-wrap" id="fn-hypothesis-wrap">
        <div class="fn-subhead"><h3>${escapeHtml(copy.hypothesisLabel)}</h3></div>
        <div class="fn-hypothesis-card is-loading" id="fn-hypothesis-card">${escapeHtml(copy.hypothesisLoading)}</div>
        <div class="fn-official-notice-slot" id="fn-official-notice-slot" style="display:none"></div>
      </div>
      ${isLoggedIn ? `<div class="fn-walk-wrap" id="fn-walk-wrap" style="display:none">
        <div class="fn-subhead"><h3 id="fn-walk-label">${escapeHtml(copy.walkLabel)}</h3></div>
        <div class="fn-walk-card" id="fn-walk-card"></div>
      </div>` : ""}
      ${myFeedSection}
      ${myPlacesSection}
      ${nearbySection}
      ${ambientSection}
    </div>
  </section>
  <script>
  (function () {
    var section = document.querySelector('.fn-main[data-api-site-brief]');
    if (!section || !navigator.geolocation) { var w = document.getElementById('fn-hypothesis-wrap'); if (w) w.style.display = 'none'; return; }
    var api = section.getAttribute('data-api-site-brief');
    var briefLang = section.getAttribute('data-brief-lang') || 'ja';
    var copyChecks = section.getAttribute('data-copy-checks') || '';
    var copyCaptures = section.getAttribute('data-copy-captures') || '';
    var copyReasons = section.getAttribute('data-copy-reasons') || '';
    var card = document.getElementById('fn-hypothesis-card');
    var noticeSlot = document.getElementById('fn-official-notice-slot');
    ${buildOfficialNoticeClientRenderer("renderFieldNoteOfficialNotices", noticeCopy, { kpiNamespace: "fieldnote" })}
    function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
    function renderBrief(brief) {
      if (!brief || !brief.hypothesis) { var w = document.getElementById('fn-hypothesis-wrap'); if (w) w.style.display = 'none'; return; }
      var h = brief.hypothesis;
      var confPct = Math.round((h.confidence || 0) * 100);
      var checks = (brief.checks || []).map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('');
      var caps = (brief.captureHints || []).map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('');
      var reasons = (brief.reasons || []).slice(0, 2).map(function(r){ return '<li>' + esc(r) + '</li>'; }).join('');
      if (card) card.innerHTML =
        '<div class="fn-hyp-head"><span class="fn-hyp-label">' + esc(h.label) + '</span><span class="fn-hyp-conf">' + confPct + '%</span></div>' +
        (checks ? '<div class="fn-hyp-section"><div class="fn-hyp-sublabel">' + esc(copyChecks) + '</div><ul>' + checks + '</ul></div>' : '') +
        (caps ? '<div class="fn-hyp-section"><div class="fn-hyp-sublabel">' + esc(copyCaptures) + '</div><ul>' + caps + '</ul></div>' : '') +
        (reasons ? '<div class="fn-hyp-section fn-hyp-reasons"><div class="fn-hyp-sublabel">' + esc(copyReasons) + '</div><ul>' + reasons + '</ul></div>' : '');
      if (card) card.classList.remove('is-loading');
      if (noticeSlot) {
        var noticeHtml = renderFieldNoteOfficialNotices(brief.officialNotices || []);
        noticeSlot.innerHTML = noticeHtml;
        noticeSlot.style.display = noticeHtml ? '' : 'none';
      }
    }
    navigator.geolocation.getCurrentPosition(function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      fetch(api + '?lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lng) + '&lang=' + encodeURIComponent(briefLang), { credentials: 'same-origin' })
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(renderBrief)
        .catch(function(){ var w = document.getElementById('fn-hypothesis-wrap'); if (w) w.style.display = 'none'; });
    }, function() {
      var w = document.getElementById('fn-hypothesis-wrap');
      if (w) w.style.display = 'none';
    }, { timeout: 8000, maximumAge: 60000 });
  })();

  // Walk today widget
  (function () {
    var section = document.querySelector('.fn-main[data-api-walk-today]');
    if (!section) return;
    var walkApi = section.getAttribute('data-api-walk-today');
    var noActivity = section.getAttribute('data-copy-walk-no-activity') || '';
    var distUnit = section.getAttribute('data-copy-walk-dist-unit') || 'm';
    var wrap = document.getElementById('fn-walk-wrap');
    var card = document.getElementById('fn-walk-card');
    if (!wrap || !card || !walkApi) return;
    fetch(walkApi, { credentials: 'same-origin' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data || data.sessionCount === 0) {
          card.textContent = noActivity;
          return;
        }
        var dist = data.totalDistanceM >= 1000
          ? (data.totalDistanceM / 1000).toFixed(1) + ' km'
          : Math.round(data.totalDistanceM) + ' ' + distUnit;
        var species = (data.topSpecies || []).slice(0, 3).join(' · ');
        card.innerHTML =
          '<div class="fn-walk-stats">' +
          '<span class="fn-walk-stat">🚶 ' + dist + '</span>' +
          '<span class="fn-walk-stat">🔍 ' + data.totalDetections + '</span>' +
          '</div>' +
          (species ? '<div class="fn-walk-species">' + species + '</div>' : '');
        wrap.style.display = '';
      })
      .catch(function() {});
  })();
  </script>`;
}

export const FIELD_NOTE_MAIN_STYLES = `
  .fn-main { margin-top: 24px; }
  .fn-main-card { position: relative; padding: 32px 32px 28px; border-radius: 32px; background: linear-gradient(180deg,#ffffff 0%, #f8fafc 100%); border: 1px solid rgba(15,23,42,.05); box-shadow: 0 26px 64px rgba(15,23,42,.07); overflow: hidden; }
  .fn-main-card::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0, transparent 40px, rgba(14,165,233,.05) 41px, transparent 42px); pointer-events: none; }
  .fn-main-card::after { content: ""; position: absolute; inset: 0 auto 0 22px; width: 2px; background: linear-gradient(180deg, rgba(239,68,68,.24), rgba(239,68,68,.1)); pointer-events: none; }
  .fn-main-card > * { position: relative; z-index: 1; }
  .fn-main-head { display: flex; flex-direction: column; gap: 16px; align-items: flex-start; justify-content: flex-start; margin-bottom: 22px; padding-left: 18px; }
  .fn-main-head-copy { max-width: 640px; }
  .fn-main-eyebrow { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(16,185,129,.1); color: #059669; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .fn-main-heading { margin: 12px 0 10px; font-family: "Zen Kaku Gothic New","Inter","Noto Sans JP",sans-serif; font-size: clamp(26px,3.2vw,36px); font-weight: 900; letter-spacing: -.02em; line-height: 1.28; color: #0f172a; }
  .fn-main-lead { margin: 0; font-size: 15px; line-height: 1.85; color: #475569; max-width: 60ch; }
  .fn-main-head-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-width: 0; width: 100%; }
  .fn-main-head-actions .btn { padding: 13px 22px; }
  .fn-subhead { margin-top: 26px; margin-bottom: 12px; padding-left: 18px; }
  .fn-subhead h3 { margin: 0; font-family: "Zen Kaku Gothic New","Inter","Noto Sans JP",sans-serif; font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; display: inline-flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 2px solid rgba(16,185,129,.28); }
  .fn-grid { display: grid; grid-template-columns: 1fr; gap: 14px; padding-left: 18px; }
  .fn-grid-compact { grid-template-columns: 1fr; }
  .fn-grid-nearby { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); align-items: start; }
  .fn-grid-nearby .obs-card-media { aspect-ratio: 4 / 3; }
  .fn-empty { margin-left: 18px; padding: 18px 22px; border-radius: 18px; background: rgba(248,250,252,.8); color: #64748b; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .fn-empty p { margin: 0; flex: 1 1 240px; }
  .fn-empty .btn { flex-shrink: 0; }
  .fn-hypothesis-wrap { margin-top: 20px; padding-left: 18px; }
  .fn-hypothesis-card { padding: 16px 18px; border-radius: 18px; background: linear-gradient(135deg, rgba(16,185,129,.06) 0%, rgba(14,165,233,.06) 100%); border: 1px solid rgba(16,185,129,.18); font-size: 13px; }
  .fn-hypothesis-card.is-loading { color: #94a3b8; font-style: italic; }
  .fn-official-notice-slot { margin-top: 12px; }
  .fn-hyp-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .fn-hyp-label { font-size: 14px; font-weight: 800; color: #0f172a; }
  .fn-hyp-conf { font-size: 11px; font-weight: 700; color: #059669; background: rgba(16,185,129,.1); padding: 2px 8px; border-radius: 999px; }
  .fn-hyp-section { margin-bottom: 10px; }
  .fn-hyp-reasons { opacity: 0.7; }
  .fn-hyp-sublabel { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
  .fn-hyp-section ul { margin: 0; padding-left: 16px; }
  .fn-hyp-section li { margin-bottom: 2px; color: #334155; line-height: 1.6; }
  .fn-walk-wrap { margin-top: 20px; padding-left: 18px; }
  .fn-walk-card { padding: 14px 16px; border-radius: 16px; background: linear-gradient(135deg, rgba(14,165,233,.06), rgba(16,185,129,.06)); border: 1px solid rgba(14,165,233,.18); font-size: 13px; }
  .fn-walk-stats { display: flex; gap: 16px; margin-bottom: 6px; }
  .fn-walk-stat { font-size: 13px; font-weight: 800; color: #0f172a; }
  .fn-walk-species { font-size: 11px; color: #047857; font-weight: 700; }
  .fn-place-row { display: grid; grid-template-columns: 1fr; gap: 10px; padding-left: 18px; }
  .fn-place-chip { padding: 10px 14px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.06); box-shadow: 0 6px 14px rgba(15,23,42,.04); display: flex; flex-direction: column; gap: 2px; text-decoration: none; color: inherit; font-size: 12px; transition: transform .15s ease; }
  .fn-place-chip:hover { transform: translateY(-2px); }
  .fn-place-chip strong { font-size: 14px; font-weight: 800; color: #0f172a; }
  .fn-place-chip span { color: #64748b; font-weight: 600; }
  .fn-place-detail { color: #475569 !important; line-height: 1.45; }
  .fn-place-cta { margin-top: 6px; color: #0f172a !important; font-weight: 800 !important; }
  .fn-ambient { margin-top: 28px; padding-top: 20px; padding-left: 18px; border-top: 1px dashed rgba(15,23,42,.08); }
  .fn-ambient-label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; margin-bottom: 10px; }
  .fn-ambient-row { display: grid; grid-template-columns: 1fr; gap: 10px; }
  .fn-ambient-item { display: inline-flex; align-items: center; gap: 10px; padding: 10px 14px 10px 10px; border-radius: 18px; background: #fff; border: 1px solid rgba(15,23,42,.05); text-decoration: none; color: inherit; transition: transform .15s ease, border-color .15s ease; }
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
  }
  ${OFFICIAL_NOTICE_CARD_STYLES}
`;
