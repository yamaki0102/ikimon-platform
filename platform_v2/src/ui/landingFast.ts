import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { LandingStats } from "../services/readModels.js";
import { escapeHtml } from "./siteShell.js";

export type LandingFastDocumentOptions = {
  basePath: string;
  lang: SiteLang;
  currentPath: string;
  title: string;
  description: string;
  stats: LandingStats;
  isLoggedIn: boolean;
  lowerContentEndpoint: string;
};

type FastHeroCopy = {
  eyebrow: string;
  heading: string;
  lead: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchButton: string;
  recordLabel: string;
  mapLabel: string;
  communityLabel: string;
  learnLabel: string;
  loginLabel: string;
  stats: Array<{ key: keyof LandingStats; label: string }>;
  loadingTitle: string;
  loadingBody: string;
  noscript: string;
};

function landingHref(basePath: string, lang: SiteLang, href: string): string {
  return appendLangToHref(withBasePath(basePath, href), lang);
}

function fastHeroCopy(lang: SiteLang): FastHeroCopy {
  const localized: Record<SiteLang, FastHeroCopy> = {
    ja: {
      eyebrow: "ikimon.life",
      heading: "今日見つけた生きものを、名前が分からなくても残せる。",
      lead: "写真・動画・音・場所・ひとことを先に残せます。名前や根拠は、AI候補と人の確認であとから観察レコードへ育てます。",
      searchLabel: "場所や生きものを検索",
      searchPlaceholder: "場所・生きものを探す",
      searchButton: "検索",
      recordLabel: "記録する",
      mapLabel: "地図を見る",
      communityLabel: "みんなで観察",
      learnLabel: "読み物",
      loginLabel: "ログイン",
      stats: [
        { key: "observationCount", label: "観察" },
        { key: "speciesCount", label: "種" },
        { key: "placeCount", label: "場所" },
      ],
      loadingTitle: "みんなの記録とエリアを読み込んでいます",
      loadingBody: "最初の表示を速くするため、写真一覧・周辺エリア・個人欄は少し遅れて表示します。",
      noscript: "JavaScript が無効でも、記録・地図・読み物ページは利用できます。",
    },
    en: {
      eyebrow: "ikimon.life",
      heading: "Save what you found today, even before you know the name.",
      lead: "Keep the photo, video, sound, place, and short note first. AI hints and human review can help the record grow later.",
      searchLabel: "Search species or places",
      searchPlaceholder: "Search species or places",
      searchButton: "Search",
      recordLabel: "Post",
      mapLabel: "Map",
      communityLabel: "Community",
      learnLabel: "Learn",
      loginLabel: "Log in",
      stats: [
        { key: "observationCount", label: "records" },
        { key: "speciesCount", label: "species" },
        { key: "placeCount", label: "places" },
      ],
      loadingTitle: "Loading posts and places",
      loadingBody: "Posts, nearby areas, and personal sections load after the first view stays fast.",
      noscript: "Record, Map, and Learn pages remain available without JavaScript.",
    },
    es: {
      eyebrow: "ikimon.life",
      heading: "Guarda lo que encontraste hoy, aunque no sepas el nombre.",
      lead: "Guarda primero foto, video, sonido, lugar y una nota breve. Las pistas de IA y la revision humana pueden ayudar despues.",
      searchLabel: "Buscar especies o lugares",
      searchPlaceholder: "Buscar especies o lugares",
      searchButton: "Buscar",
      recordLabel: "Guardar",
      mapLabel: "Mapa",
      communityLabel: "Comunidad",
      learnLabel: "Leer",
      loginLabel: "Entrar",
      stats: [
        { key: "observationCount", label: "registros" },
        { key: "speciesCount", label: "especies" },
        { key: "placeCount", label: "lugares" },
      ],
      loadingTitle: "Cargando registros y lugares",
      loadingBody: "Las listas, areas cercanas y secciones personales se cargan despues para mantener rapida la primera vista.",
      noscript: "Registro, Mapa y Lecturas siguen disponibles sin JavaScript.",
    },
    "pt-BR": {
      eyebrow: "ikimon.life",
      heading: "Salve o que encontrou hoje, mesmo antes de saber o nome.",
      lead: "Guarde primeiro foto, video, som, lugar e uma nota curta. Dicas de IA e revisao humana ajudam o registro depois.",
      searchLabel: "Buscar especies ou lugares",
      searchPlaceholder: "Buscar especies ou lugares",
      searchButton: "Buscar",
      recordLabel: "Salvar",
      mapLabel: "Mapa",
      communityLabel: "Comunidade",
      learnLabel: "Ler",
      loginLabel: "Entrar",
      stats: [
        { key: "observationCount", label: "registros" },
        { key: "speciesCount", label: "especies" },
        { key: "placeCount", label: "lugares" },
      ],
      loadingTitle: "Carregando registros e lugares",
      loadingBody: "Listas, areas proximas e secoes pessoais carregam depois para manter a primeira tela rapida.",
      noscript: "Registro, Mapa e Leituras continuam disponiveis sem JavaScript.",
    },
  };
  return localized[lang] ?? localized.ja;
}

function formatNumber(lang: SiteLang, value: number): string {
  const locale = lang === "ja" ? "ja-JP" : lang === "pt-BR" ? "pt-BR" : lang;
  return new Intl.NumberFormat(locale).format(Math.max(0, value || 0));
}

function renderStats(copy: FastHeroCopy, lang: SiteLang, stats: LandingStats): string {
  return copy.stats
    .map((item) => `<div class="fast-stat"><strong>${escapeHtml(formatNumber(lang, stats[item.key]))}</strong><span>${escapeHtml(item.label)}</span></div>`)
    .join("");
}

function renderCriticalCss(): string {
  return `<style>
    :root { color-scheme: light; --ink:#10251a; --muted:#587066; --line:rgba(16,37,26,.12); --green:#047857; --soft:#ecfdf5; --sky:#0ea5e9; }
    * { box-sizing: border-box; }
    html { min-height: 100%; background:#f7fffb; }
    body { margin:0; min-height:100%; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:linear-gradient(180deg,#fff 0%,#f7fffb 62%,#edf9f2 100%); }
    a { color: inherit; }
    .fast-shell { min-height:100vh; display:grid; grid-template-rows:auto 1fr; }
    .fast-header { position:sticky; top:0; z-index:5; display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:58px; padding:0 max(18px,calc((100vw - 1120px)/2)); border-bottom:1px solid var(--line); background:rgba(255,255,255,.88); backdrop-filter:blur(14px); }
    .fast-brand { display:inline-flex; align-items:center; gap:10px; text-decoration:none; font-weight:950; letter-spacing:0; }
    .fast-brand-mark { width:30px; height:30px; display:grid; place-items:center; border-radius:10px; background:#10251a; color:#fff; font-size:14px; }
    .fast-nav { display:flex; align-items:center; gap:6px; }
    .fast-nav a { min-height:40px; display:inline-flex; align-items:center; justify-content:center; padding:0 12px; border-radius:999px; text-decoration:none; font-size:13px; font-weight:850; color:#244235; }
    .fast-nav a.is-primary { background:#10251a; color:#fff; }
    .fast-main { width:min(1120px, calc(100vw - 32px)); margin:0 auto; padding:clamp(24px,5vw,58px) 0 72px; }
    .fast-hero { display:grid; grid-template-columns:minmax(0,1fr) minmax(260px,380px); align-items:end; gap:clamp(24px,5vw,64px); }
    .fast-eyebrow { margin:0 0 12px; color:#047857; font-size:12px; font-weight:950; text-transform:uppercase; letter-spacing:.08em; }
    h1 { max-width:13em; margin:0; font-size:clamp(36px,6.2vw,72px); line-height:1.02; letter-spacing:0; font-weight:950; }
    .fast-lead { max-width:48em; margin:18px 0 0; color:#475569; font-size:clamp(15px,2vw,19px); line-height:1.75; font-weight:680; }
    .fast-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:22px; }
    .fast-btn { min-height:52px; display:inline-flex; align-items:center; justify-content:center; padding:0 18px; border:1px solid var(--line); border-radius:999px; background:#fff; text-decoration:none; font-size:15px; font-weight:950; box-shadow:0 14px 34px rgba(15,23,42,.06); }
    .fast-btn.is-primary { background:linear-gradient(135deg,#047857,#10b981); border-color:transparent; color:#fff; }
    .fast-search { margin-top:16px; max-width:620px; min-height:56px; display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px; padding:7px; border:1px solid rgba(16,185,129,.2); border-radius:999px; background:#fff; box-shadow:0 18px 46px rgba(15,23,42,.08); }
    .fast-search input { min-width:0; border:0; outline:0; padding:0 12px; background:transparent; color:var(--ink); font:700 15px/1.2 inherit; }
    .fast-search button { min-height:42px; border:0; border-radius:999px; padding:0 16px; background:#10251a; color:#fff; font-weight:950; }
    .fast-panel { display:grid; gap:12px; padding:16px; border:1px solid rgba(16,185,129,.18); border-radius:22px; background:rgba(255,255,255,.78); box-shadow:0 24px 70px rgba(15,23,42,.08); }
    .fast-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
    .fast-stat { min-height:88px; display:grid; align-content:center; gap:4px; padding:12px; border-radius:16px; background:#f0fdf4; }
    .fast-stat strong { font-size:clamp(25px,4vw,38px); line-height:1; font-weight:950; }
    .fast-stat span { color:#587066; font-size:12px; font-weight:900; }
    .fast-panel-note { margin:0; color:#64748b; font-size:13px; line-height:1.65; font-weight:700; }
    .fast-lower { margin-top:clamp(28px,6vw,72px); min-height:280px; }
    .fast-placeholder { display:grid; gap:14px; padding:20px; border:1px solid var(--line); border-radius:20px; background:rgba(255,255,255,.72); }
    .fast-placeholder strong { font-size:18px; }
    .fast-placeholder span { max-width:46em; color:#64748b; font-size:14px; line-height:1.7; font-weight:700; }
    .fast-skeleton { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .fast-skeleton i { height:128px; border-radius:16px; background:linear-gradient(90deg,#ecfdf5,#fff,#e0f2fe); background-size:220% 100%; animation:pulse 1.6s ease-in-out infinite; }
    @keyframes pulse { 0%{background-position:0 0} 100%{background-position:-220% 0} }
    .fast-noscript { display:block; margin-top:16px; color:#64748b; font-size:13px; font-weight:750; }
    @media (max-width: 780px) {
      .fast-header { padding:0 14px; }
      .fast-nav a:not(.is-primary) { display:none; }
      .fast-main { width:min(100vw - 28px, 1120px); padding-top:24px; }
      .fast-hero { grid-template-columns:1fr; gap:20px; }
      h1 { font-size:clamp(34px,11vw,50px); }
      .fast-panel { padding:12px; }
      .fast-skeleton { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .fast-skeleton i { height:112px; }
    }
  </style>`;
}

function renderRuntimeScript(options: LandingFastDocumentOptions): string {
  return `<script>
(function () {
  var lower = document.querySelector('[data-landing-lower]');
  var endpoint = ${JSON.stringify(options.lowerContentEndpoint)};
  var loaded = false;
  function runScripts(scriptHtml) {
    if (!scriptHtml) return;
    var template = document.createElement('template');
    template.innerHTML = scriptHtml;
    template.content.querySelectorAll('script').forEach(function (oldScript) {
      var script = document.createElement('script');
      Array.prototype.slice.call(oldScript.attributes).forEach(function (attr) { script.setAttribute(attr.name, attr.value); });
      script.text = oldScript.textContent || '';
      document.body.appendChild(script);
    });
  }
  function loadLower() {
    if (loaded || !lower) return;
    loaded = true;
    fetch(endpoint, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : Promise.reject(new Error('landing_sections_failed')); })
      .then(function (data) {
        if (data && typeof data.html === 'string') {
          lower.innerHTML = data.html;
          lower.removeAttribute('aria-busy');
          runScripts(data.scripts);
        }
      })
      .catch(function () {
        loaded = false;
        lower.removeAttribute('aria-busy');
      });
  }
  function idle(callback) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(callback, { timeout: 1800 });
      return;
    }
    window.setTimeout(callback, 900);
  }
  if ('IntersectionObserver' in window && lower) {
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting || entry.intersectionRatio > 0; })) {
        observer.disconnect();
        loadLower();
      }
    }, { rootMargin: '480px 0px' });
    observer.observe(lower);
  }
  idle(loadLower);

  var endpointKpi = '/api/v1/ui-kpi/events';
  function postEvent(eventName, actionKey, routeKey, metadata) {
    var payload = {
      eventName: eventName,
      pagePath: location.pathname + location.search,
      actionKey: actionKey || 'unknown_action',
      routeKey: routeKey || '',
      metadata: Object.assign({ lang: document.documentElement.lang || 'ja', ts: new Date().toISOString() }, metadata || {})
    };
    fetch(endpointKpi, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'same-origin'
    }).catch(function () {});
    if (window.ikimonExternalAnalytics && typeof window.ikimonExternalAnalytics.track === 'function') {
      window.ikimonExternalAnalytics.track(eventName, payload);
    }
  }
  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element ? event.target.closest('a,button') : null;
    if (!target) return;
    var action = target.getAttribute('data-kpi-action') || (target.textContent || target.tagName).trim().slice(0, 80);
    var href = target.tagName.toLowerCase() === 'a' ? target.getAttribute('href') || '' : '';
    postEvent(target.getAttribute('data-kpi-event') || 'first_action', action, href && href.charAt(0) === '/' ? href : '', {
      funnel: target.getAttribute('data-kpi-funnel') || '',
      target: target.getAttribute('data-kpi-target') || ''
    });
  }, { capture: true, passive: true });

  function loadAnalytics() {
    var host = window.location.hostname;
    if (host !== 'ikimon.life' && host !== 'www.ikimon.life') return;
    if (window.ikimonAnalyticsLoaded) return;
    window.ikimonAnalyticsLoaded = true;
    var googleTagId = 'G-NCL0M1VJZ2';
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', googleTagId);
    window.ikimonExternalAnalytics = {
      track: function (eventName, payload) {
        try {
          window.gtag('event', String(eventName || 'ui_action').replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 40), {
            action_key: String(payload && payload.actionKey || 'unknown_action').slice(0, 100),
            page_path: String(payload && payload.pagePath || location.pathname).slice(0, 100),
            funnel: String(payload && payload.metadata && payload.metadata.funnel || '').slice(0, 100),
            target: String(payload && payload.metadata && payload.metadata.target || '').slice(0, 100)
          });
        } catch (_) {}
      }
    };
    var googleScript = document.createElement('script');
    googleScript.async = true;
    googleScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(googleTagId);
    document.head.appendChild(googleScript);
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    var clarityScript = document.createElement('script');
    clarityScript.async = true;
    clarityScript.src = 'https://www.clarity.ms/tag/wl2ezvfqbh';
    document.head.appendChild(clarityScript);
  }
  window.addEventListener('load', function () { idle(loadAnalytics); }, { once: true });
})();
  </script>`;
}

export function renderLandingFastDocument(options: LandingFastDocumentOptions): string {
  const copy = fastHeroCopy(options.lang);
  const recordHref = landingHref(options.basePath, options.lang, "/record");
  const mapHref = landingHref(options.basePath, options.lang, "/map");
  const communityHref = landingHref(options.basePath, options.lang, "/community");
  const learnHref = landingHref(options.basePath, options.lang, "/learn");
  const loginHref = landingHref(options.basePath, options.lang, `/login?redirect=${encodeURIComponent(options.currentPath || "/")}`);
  const searchHref = landingHref(options.basePath, options.lang, "/map");
  const canonicalHref = `https://ikimon.life${appendLangToHref("/", "ja")}`;
  const lowerId = "landing-lower-content";

  return `<!doctype html>
<html lang="${escapeHtml(options.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#047857" />
  <title>${escapeHtml(options.title)}</title>
  <meta name="description" content="${escapeHtml(options.description)}" />
  <link rel="canonical" href="${escapeHtml(canonicalHref)}" />
  <link rel="manifest" href="/manifest.webmanifest?lang=${encodeURIComponent(options.lang)}" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png" />
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ikimon" />
  <meta property="og:title" content="${escapeHtml(options.title)}" />
  <meta property="og:description" content="${escapeHtml(options.description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalHref)}" />
  <meta name="twitter:card" content="summary" />
  ${renderCriticalCss()}
</head>
<body>
  <div class="fast-shell">
    <header class="fast-header">
      <a class="fast-brand" href="${escapeHtml(landingHref(options.basePath, options.lang, "/"))}" aria-label="ikimon.life">
        <span class="fast-brand-mark" aria-hidden="true">i</span>
        <span>ikimon.life</span>
      </a>
      <nav class="fast-nav" aria-label="primary">
        <a href="${escapeHtml(learnHref)}">${escapeHtml(copy.learnLabel)}</a>
        <a href="${escapeHtml(mapHref)}">${escapeHtml(copy.mapLabel)}</a>
        <a href="${escapeHtml(communityHref)}">${escapeHtml(copy.communityLabel)}</a>
        ${options.isLoggedIn ? "" : `<a href="${escapeHtml(loginHref)}">${escapeHtml(copy.loginLabel)}</a>`}
        <a class="is-primary" href="${escapeHtml(recordHref)}" data-kpi-action="landing:fast:record" data-kpi-event="primary_cta_click" data-kpi-funnel="landing_record" data-kpi-target="${escapeHtml(recordHref)}">${escapeHtml(copy.recordLabel)}</a>
      </nav>
    </header>
    <main class="fast-main">
      <section class="fast-hero" aria-labelledby="landing-hero-heading">
        <div>
          <p class="fast-eyebrow">${escapeHtml(copy.eyebrow)}</p>
          <h1 id="landing-hero-heading">${escapeHtml(copy.heading)}</h1>
          <p class="fast-lead">${escapeHtml(copy.lead)}</p>
          <form class="fast-search" action="${escapeHtml(searchHref)}" method="get" role="search" aria-label="${escapeHtml(copy.searchLabel)}">
            <input name="q" type="search" autocomplete="off" placeholder="${escapeHtml(copy.searchPlaceholder)}" />
            <button type="submit" data-kpi-action="landing:fast:search">${escapeHtml(copy.searchButton)}</button>
          </form>
          <div class="fast-actions">
            <a class="fast-btn is-primary" href="${escapeHtml(recordHref)}" data-kpi-action="landing:fast:primary_record" data-kpi-event="primary_cta_click" data-kpi-funnel="landing_record" data-kpi-target="${escapeHtml(recordHref)}">${escapeHtml(copy.recordLabel)}</a>
            <a class="fast-btn" href="${escapeHtml(mapHref)}" data-kpi-action="landing:fast:map">${escapeHtml(copy.mapLabel)}</a>
            <a class="fast-btn" href="${escapeHtml(learnHref)}" data-kpi-action="landing:fast:learn">${escapeHtml(copy.learnLabel)}</a>
          </div>
        </div>
        <aside class="fast-panel" aria-label="ikimon.life stats">
          <div class="fast-stats">${renderStats(copy, options.lang, options.stats)}</div>
          <p class="fast-panel-note">${escapeHtml(options.description)}</p>
        </aside>
      </section>
      <section id="${lowerId}" class="fast-lower" data-landing-lower aria-busy="true">
        <div class="fast-placeholder" role="status">
          <strong>${escapeHtml(copy.loadingTitle)}</strong>
          <span>${escapeHtml(copy.loadingBody)}</span>
          <div class="fast-skeleton" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </div>
      </section>
      <noscript><span class="fast-noscript">${escapeHtml(copy.noscript)}</span></noscript>
    </main>
  </div>
  ${renderRuntimeScript(options)}
</body>
</html>`;
}
