import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, supportedLanguages, type SiteLang } from "../i18n.js";
import { getShortCopy } from "../content/index.js";
import { listPagesByLane, listPagesByVisibility, sitePageLabel, type RouteLane, type SitePageDefinition } from "../siteMap.js";

export type SiteAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

export type SiteHero = {
  eyebrow: string;
  heading: string;
  headingHtml?: string;
  lead: string;
  actions?: SiteAction[];
  mediaHtml?: string;
  supplementHtml?: string;
  afterActionsHtml?: string;
  tone?: "dark" | "light";
  align?: "left" | "center";
};

export type SiteShellOptions = {
  basePath: string;
  title: string;
  body: string;
  hero?: SiteHero;
  /** HTML slot rendered inside <main> between the hero and body (e.g. quick nav chips). */
  belowHeroHtml?: string;
  /** CSS appended after the base shell styles (scoped via class names). */
  extraStyles?: string;
  activeNav?: string;
  footerNote?: string;
  lang?: SiteLang;
  currentPath?: string;
  shellClassName?: string;
};

type ShellCopy = {
  brandTagline: string;
  skipToContent: string;
  searchPlaceholder: string;
  searchLabel: string;
  menu: string;
  nav: Record<string, string>;
  record: string;
  footer: {
    tagline: string;
    start: string;
    startLinks: {
      discover: string;
      record: string;
      places: string;
    };
    learn: string;
    learnLinks: {
      guides: string;
      about: string;
      faq: string;
      updates: string;
    };
    trust: string;
    trustLinks: {
      business: string;
      contact: string;
      terms: string;
      privacy: string;
    };
    copyright: string;
    revisit: string;
  };
};

function shellCopyFor(lang: SiteLang): ShellCopy {
  return getShortCopy<ShellCopy>(lang, "shared", "shell");
}

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildNavLinks(basePath: string, lang: SiteLang, activeNav?: string): string {
  return listPagesByVisibility("header")
    .map((page) => {
      const label = sitePageLabel(page, lang);
      const activeClass = activeNav === label ? " is-active" : "";
      const href = withBasePath(basePath, page.path);
      return `<a class="site-nav-link${activeClass}" href="${escapeHtml(appendLangToHref(href, lang))}">${escapeHtml(label)}</a>`;
    })
    .join("");
}

function renderSearchForm(basePath: string, copy: ShellCopy, className = ""): string {
  const classes = ["site-search"];
  if (className) {
    classes.push(className);
  }

  return `<form class="${classes.join(" ")}" role="search" action="${escapeHtml(withBasePath(basePath, "/explore"))}" method="get" aria-label="${escapeHtml(copy.searchLabel)}">
    <span class="site-search-icon" aria-hidden="true">🔍</span>
    <input class="site-search-input" type="search" name="q" placeholder="${escapeHtml(copy.searchPlaceholder)}" aria-label="${escapeHtml(copy.searchLabel)}" />
  </form>`;
}

function renderLangSwitch(currentPath: string, lang: SiteLang, className = ""): string {
  const classes = ["lang-switch"];
  if (className) {
    classes.push(className);
  }

  return `<div class="${classes.join(" ")}" aria-label="Language switcher">${supportedLanguages
    .map((language) => {
      const activeClass = language.code === lang ? " is-active" : "";
      return `<a class="lang-switch-link${activeClass}" href="${escapeHtml(appendLangToHref(currentPath, language.code))}" hreflang="${escapeHtml(language.code)}" lang="${escapeHtml(language.code)}">${escapeHtml(language.shortLabel)}</a>`;
    })
    .join("")}</div>`;
}

function nav(basePath: string, lang: SiteLang, currentPath: string, activeNav?: string): string {
  const copy = shellCopyFor(lang);
  const brandMarkSrc = "/assets/img/icon-192.png";
  const navLinks = buildNavLinks(basePath, lang, activeNav);
  const desktopSearch = renderSearchForm(basePath, copy, "site-search-desktop");
  const mobileSearch = renderSearchForm(basePath, copy, "site-search-mobile");
  const desktopLangSwitch = renderLangSwitch(currentPath, lang, "lang-switch-desktop");
  const mobileLangSwitch = renderLangSwitch(currentPath, lang, "lang-switch-mobile");
  const recordHref = escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang));
  const loginHref = escapeHtml(appendLangToHref(withBasePath(basePath, "/login?redirect=/profile"), lang));

  return `<header class="site-header">
    <div class="site-header-inner">
      <a class="brand" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/"), lang))}">
        <span class="brand-mark"><img src="${escapeHtml(brandMarkSrc)}" alt="ikimon icon" /></span>
        <span>
          <strong>ikimon</strong>
          <small>${escapeHtml(copy.brandTagline)}</small>
        </span>
      </a>
      <nav class="site-nav site-nav-desktop">${navLinks}</nav>
      ${desktopSearch}
      <div class="site-header-actions site-header-actions-desktop">
        ${desktopLangSwitch}
        <a class="btn btn-ghost site-login-link" href="${loginHref}">ログイン</a>
        <a class="btn btn-solid site-record-link" href="${recordHref}">${escapeHtml(copy.record)}</a>
      </div>
      <div class="site-header-actions site-header-actions-mobile">
        <a class="btn btn-ghost site-login-link" href="${loginHref}">ログイン</a>
        <a class="btn btn-solid site-record-link" href="${recordHref}">${escapeHtml(copy.record)}</a>
        <details class="site-mobile-menu">
          <summary class="site-mobile-menu-toggle">
            <span class="site-mobile-menu-icon" aria-hidden="true"></span>
            <span>${escapeHtml(copy.menu)}</span>
          </summary>
          <div class="site-mobile-menu-panel">
            ${mobileSearch}
            <nav class="site-nav site-nav-mobile">${navLinks}</nav>
            <div class="site-mobile-menu-meta">
              ${mobileLangSwitch}
            </div>
          </div>
        </details>
      </div>
    </div>
  </header>`;
}

function hero(basePath: string, content?: SiteHero): string {
  if (!content) {
    return "";
  }

  const actions = (content.actions ?? []).map((action) => {
    const className = action.variant === "secondary" ? "btn btn-ghost-on-dark" : "btn btn-solid";
    return `<a class="${className}" href="${escapeHtml(withBasePath(basePath, action.href))}">${escapeHtml(action.label)}</a>`;
  }).join("");

  return `<section class="hero-panel${content.mediaHtml ? " has-media" : ""}${content.tone === "light" ? " is-light" : ""}${content.align === "center" ? " is-center" : ""}">
    <div class="hero-copy">
      <div class="hero-badge"><span class="hero-badge-dot"></span>${escapeHtml(content.eyebrow)}</div>
      <h1>${content.headingHtml ?? escapeHtml(content.heading)}</h1>
      <p>${escapeHtml(content.lead)}</p>
      ${content.supplementHtml ? `<div class="hero-supplement">${content.supplementHtml}</div>` : ""}
      ${actions ? `<div class="actions">${actions}</div>` : ""}
      ${content.afterActionsHtml ? `<div class="hero-after-actions">${content.afterActionsHtml}</div>` : ""}
    </div>
    ${content.mediaHtml ? `<div class="hero-media">${content.mediaHtml}</div>` : ""}
  </section>`;
}

function footerGroupPages(lanes: RouteLane[], limit: number): SitePageDefinition[] {
  return lanes.flatMap((lane) => listPagesByLane(lane, "footer")).slice(0, limit);
}

function renderFooterLinks(basePath: string, lang: SiteLang, pages: SitePageDefinition[]): string {
  return pages
    .map((page) => {
      const href = appendLangToHref(withBasePath(basePath, page.path), lang);
      return `<a href="${escapeHtml(href)}">${escapeHtml(sitePageLabel(page, lang))}</a>`;
    })
    .join("");
}

function footer(basePath: string, lang: SiteLang, _footerNote?: string): string {
  const copy = shellCopyFor(lang);
  const startPages = footerGroupPages(["start"], 5);
  const learnPages = footerGroupPages(["learn"], 5);
  const areaPages = footerGroupPages(["group", "business", "research"], 5);
  const trustPages = footerGroupPages(["trust"], 5);
  return `<footer class="site-footer">
    <div class="footer-inner">
      <section class="footer-hero" aria-label="フッター案内">
        <div class="footer-brand-panel">
          <div>
          <div class="brand brand-footer">
            <span class="brand-mark"><img src="/assets/img/icon-192.png" alt="ikimon icon" /></span>
            <span>
              <strong>ikimon</strong>
              <small>${escapeHtml(copy.footer.tagline)}</small>
            </span>
          </div>
            <div class="footer-kicker">見つける、確かめる、残す、また歩く。</div>
            <h2>足もとの一枚を、<br>世界につながる自然記録へ。</h2>
            <p>身近な自然を見つけ、確かめ、残し、また歩くための自然観察基盤。個人の発見を、地域と世界の記録につなげる。</p>
            <div class="footer-actions">
              <a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}">${escapeHtml(copy.record)}</a>
              <a class="btn btn-ghost-on-dark" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">読み物を見る</a>
            </div>
          </div>
          <div class="footer-chip-row" aria-label="ikimon の価値">
            <span>名前が分からなくても残せる</span>
            <span>公開範囲を安全側で制御</span>
            <span>学校・研究・地域活動へ接続</span>
          </div>
        </div>
        <div class="footer-mini-map" aria-label="観察ルートのイメージ">
          <div class="footer-route"></div>
          <span class="footer-pin one"></span>
          <span class="footer-pin two"></span>
          <span class="footer-pin three"></span>
          <span class="footer-pin four"></span>
          <div class="footer-map-copy">
            <span>次の一歩</span>
            <strong>いつもの道が、観察ルートになる。</strong>
            <p>散歩、通学路、旅先、庭先。どこから始めても、記録はあとから育てられる。</p>
          </div>
        </div>
      </section>

      <section class="footer-directory" aria-label="サイト内リンク">
        <div class="footer-group">
          <strong><i>REC</i>使う</strong>
          <nav class="footer-links" aria-label="使う">
            ${renderFooterLinks(basePath, lang, startPages)}
          </nav>
        </div>
        <div class="footer-group">
          <strong><i>READ</i>${escapeHtml(copy.footer.learn)}</strong>
          <nav class="footer-links" aria-label="${escapeHtml(copy.footer.learn)}">
            ${renderFooterLinks(basePath, lang, learnPages)}
          </nav>
        </div>
        <div class="footer-group">
          <strong><i>AREA</i>広げる</strong>
          <nav class="footer-links" aria-label="広げる">
            ${renderFooterLinks(basePath, lang, areaPages)}
          </nav>
        </div>
        <div class="footer-group">
          <strong><i>SAFE</i>確認する</strong>
          <nav class="footer-links" aria-label="確認する">
            ${renderFooterLinks(basePath, lang, trustPages)}
          </nav>
        </div>
      </section>

      <div class="footer-bottom">
        <span>ikimon.life｜自然を見つけ、確かめ、残し、また歩く。</span>
        <span><a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn/updates"), lang))}">${escapeHtml(copy.footer.learnLinks.updates)}</a>・<a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/contact"), lang))}">${escapeHtml(copy.footer.trustLinks.contact)}</a></span>
      </div>
    </div>
  </footer>`;
}

function normalizePathname(path: string): string {
  try {
    return new URL(path, "https://ikimon.local").pathname;
  } catch {
    return path.split("?")[0] || "/";
  }
}

function shouldRenderGlobalRecordEntry(currentPath: string): boolean {
  const pathname = normalizePathname(currentPath);
  return !(
    pathname === "/record" ||
    pathname.startsWith("/record/") ||
    pathname === "/guide" ||
    pathname.startsWith("/guide/") ||
    pathname === "/login" ||
    pathname === "/register"
  );
}

function globalRecordEntry(basePath: string, lang: SiteLang, currentPath: string): string {
  if (!shouldRenderGlobalRecordEntry(currentPath)) {
    return "";
  }
  const photoHref = appendLangToHref(withBasePath(basePath, "/record?start=photo"), lang);
  const videoHref = appendLangToHref(withBasePath(basePath, "/record?start=video"), lang);
  const galleryHref = appendLangToHref(withBasePath(basePath, "/record?start=gallery"), lang);
  const guideHref = appendLangToHref(withBasePath(basePath, "/guide"), lang);
  return `<nav class="global-record-launcher" aria-label="すぐ記録する">
    <a class="global-record-choice is-primary" href="${escapeHtml(photoHref)}" data-kpi-action="global_record_photo">
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg></span>
      <span>写真</span>
    </a>
    <a class="global-record-choice" href="${escapeHtml(videoHref)}" data-kpi-action="global_record_video">
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="3" y="6" width="13" height="12" rx="2"/></svg></span>
      <span>動画</span>
    </a>
    <a class="global-record-choice" href="${escapeHtml(galleryHref)}" data-kpi-action="global_record_gallery">
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>
      <span>選ぶ</span>
    </a>
    <a class="global-record-choice" href="${escapeHtml(guideHref)}" data-kpi-action="global_record_guide">
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0"/><path d="M12 4v4"/><path d="M6.3 6.3 9 9"/><path d="M17.7 6.3 15 9"/><path d="M3 13h4"/><path d="M17 13h4"/><path d="M9 17h6"/><path d="M10 21h4"/></svg></span>
      <span>ガイド</span>
    </a>
  </nav>`;
}

function authNavHydrationScript(basePath: string, lang: SiteLang): string {
  const sessionEndpoint = withBasePath(basePath, "/api/v1/auth/session");
  const profileHref = appendLangToHref(withBasePath(basePath, "/profile"), lang);
  return `<script>
(function () {
  const endpoint = ${JSON.stringify(sessionEndpoint)};
  const profileHref = ${JSON.stringify(profileHref)};
  const applySignedInState = (session) => {
    if (!session || !session.userId) return;
    document.documentElement.dataset.auth = 'signed-in';
    document.querySelectorAll('.site-login-link').forEach((link) => {
      link.textContent = 'マイページ';
      link.setAttribute('href', profileHref);
      link.setAttribute('aria-label', (session.displayName || 'マイページ') + ' のマイページ');
      link.classList.add('is-authenticated');
    });
  };
  fetch(endpoint, {
    method: 'GET',
    headers: { accept: 'application/json' },
    credentials: 'same-origin'
  })
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => applySignedInState(payload && payload.ok ? payload.session : null))
    .catch(() => undefined);
})();
</script>`;
}

export function renderSiteDocument(options: SiteShellOptions): string {
  const lang = options.lang ?? "ja";
  const currentPath = options.currentPath ?? withBasePath(options.basePath, "/");
  const uiKpiEndpoint = withBasePath(options.basePath, "/api/v1/ui-kpi/events");
  const skipLabel = shellCopyFor(lang).skipToContent;
  const globalRecordNav = globalRecordEntry(options.basePath, lang, currentPath);
  const siteShellClassName = `site-shell${globalRecordNav ? " has-global-record-launcher" : ""}`;
  const uiKpiScript = `<script>
(function () {
  const endpoint = ${JSON.stringify(uiKpiEndpoint)};
  const pagePath = location.pathname + location.search;
  let sent = false;
  try {
    const key = 'ikimon:v2:first_action:' + pagePath;
    if (sessionStorage.getItem(key) === '1') {
      sent = true;
    }
    const send = (actionKey, routeKey) => {
      if (sent) return;
      sent = true;
      try { sessionStorage.setItem(key, '1'); } catch (_) {}
      const payload = {
        eventName: 'first_action',
        pagePath,
        actionKey,
        routeKey,
        metadata: {
          lang: document.documentElement.lang || 'ja',
          ts: new Date().toISOString(),
        },
      };
      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => undefined);
    };

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('a,button') : null;
      if (!target) return;
      const tag = target.tagName.toLowerCase();
      const text = (target.textContent || '').trim().slice(0, 80);
      const href = tag === 'a' ? target.getAttribute('href') || '' : '';
      const routeKey = href && href.startsWith('/') ? href : '';
      const actionKey = target.getAttribute('data-kpi-action') || (text ? text : tag);
      send(actionKey, routeKey);
    }, { capture: true, passive: true });
  } catch (_) {}
})();
</script>`;
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#10b981" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/img/icon-192.png" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f9fffe;
      --surface: rgba(255,255,255,.92);
      --surface-strong: #ffffff;
      --border: rgba(0,0,0,.06);
      --ink: #1a2e1f;
      --muted: #64748b;
      --hero-a: #059669;
      --hero-b: #10b981;
      --hero-c: #0ea5e9;
      --accent: #10b981;
      --accent-hover: #059669;
      --accent-soft: #ecfdf5;
      --shadow: 0 18px 44px rgba(15, 23, 42, .07);
      --shadow-strong: 0 26px 64px rgba(15, 23, 42, .12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(16,185,129,.07), transparent 36%),
        radial-gradient(circle at top right, rgba(14,165,233,.05), transparent 30%),
        linear-gradient(180deg, #f9fffe 0%, var(--bg) 100%);
    }
    a { color: inherit; text-decoration: none; }
    .site-shell { min-height: 100vh; }
    .shell { max-width: 1140px; margin: 0 auto; padding: 28px 24px 24px; }
    .shell.shell-bleed {
      max-width: none;
      width: 100%;
      padding: 22px clamp(16px, 2.4vw, 36px) 24px;
    }
    .shell.shell-map {
      padding-top: 18px;
    }
    .md-hidden { display: none; }
    .site-header { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(18px); background: rgba(249,255,254,.92); border-bottom: 1px solid rgba(15,23,42,.05); }
    .site-header-inner { max-width: 1240px; margin: 0 auto; padding: 10px 24px; display: flex; align-items: center; gap: 14px; justify-content: space-between; flex-wrap: nowrap; }
    .brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; max-width: 300px; flex: 1 1 260px; }
    .brand-mark { width: 38px; height: 38px; flex: 0 0 38px; aspect-ratio: 1 / 1; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 8px 18px rgba(15,23,42,.07); background: white; }
    .brand-mark img { width: 100%; height: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; }
    .brand > span:last-child { min-width: 0; }
    .brand strong { display: block; font-size: 15px; font-weight: 900; }
    .brand small { display: block; max-width: 100%; margin-top: 2px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .site-nav { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; flex-wrap: nowrap; }
    .site-nav-link { display: inline-flex; align-items: center; min-height: 40px; padding: 9px 9px; border-radius: 999px; background: transparent; border: 0; font-weight: 750; font-size: 13.5px; color: #475569; white-space: nowrap; }
    .site-nav-link:hover { background: rgba(15,23,42,.04); }
    .site-nav-link.is-active { color: #047857; background: #ecfdf5; }
    .site-header-actions { display: flex; gap: 8px; flex: 0 0 auto; flex-wrap: nowrap; align-items: center; }
    .site-header-actions-mobile { display: none; }
    .site-login-link.is-authenticated { color: #047857; background: #ecfdf5; border-color: rgba(16,185,129,.18); }
    .site-record-link { white-space: nowrap; }
    .site-search {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 4px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,.92);
      border: 1px solid rgba(148,163,184,.32);
      box-shadow: 0 5px 12px rgba(15,23,42,.035);
      flex: 1 1 170px;
      min-width: 150px;
      max-width: 280px;
    }
    .site-search-icon { font-size: 14px; opacity: .7; }
    .site-search-input {
      flex: 1 1 auto;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      padding: 4px 0;
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }
    .site-search-input::placeholder { color: #94a3b8; }
    @media (max-width: 720px) { .site-search { flex: 1 1 100%; max-width: 100%; order: 3; } }
    .lang-switch {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,.88);
      border: 1px solid rgba(148,163,184,.24);
      box-shadow: 0 8px 20px rgba(15,23,42,.05);
    }
    .lang-switch-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      min-height: 40px;
      padding: 0 9px;
      border-radius: 999px;
      color: #475569;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .04em;
    }
    .lang-switch-link.is-active {
      background: linear-gradient(135deg, rgba(16,185,129,.14), rgba(14,165,233,.14));
      color: #0f172a;
    }
    .site-mobile-menu { display: none; }
    .site-mobile-menu-toggle { list-style: none; }
    .site-mobile-menu-toggle::-webkit-details-marker { display: none; }
    .site-mobile-menu-toggle {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 40px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.28);
      background: rgba(255,255,255,.94);
      color: #0f172a;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 8px 18px rgba(15,23,42,.06);
    }
    .site-mobile-menu-icon,
    .site-mobile-menu-icon::before,
    .site-mobile-menu-icon::after {
      display: block;
      width: 14px;
      height: 2px;
      border-radius: 999px;
      background: currentColor;
      transition: transform .16s ease, opacity .16s ease;
    }
    .site-mobile-menu-icon { position: relative; }
    .site-mobile-menu-icon::before,
    .site-mobile-menu-icon::after {
      content: "";
      position: absolute;
      left: 0;
    }
    .site-mobile-menu-icon::before { top: -5px; }
    .site-mobile-menu-icon::after { top: 5px; }
    .site-mobile-menu[open] .site-mobile-menu-toggle {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
    }
    .site-mobile-menu[open] .site-mobile-menu-icon { transform: rotate(45deg); }
    .site-mobile-menu[open] .site-mobile-menu-icon::before {
      transform: rotate(90deg);
      top: 0;
    }
    .site-mobile-menu[open] .site-mobile-menu-icon::after { opacity: 0; }
    .site-mobile-menu-panel {
      position: absolute;
      top: calc(100% + 9px);
      right: 0;
      width: min(340px, calc(100vw - 28px));
      padding: 12px;
      border-radius: 20px;
      border: 1px solid rgba(148,163,184,.22);
      background: rgba(255,255,255,.98);
      box-shadow: 0 20px 42px rgba(15,23,42,.16);
      display: grid;
      gap: 12px;
    }
    .site-search-mobile {
      display: inline-flex;
      width: 100%;
      max-width: none;
      min-height: 42px;
      padding: 4px 12px;
    }
    .site-nav-mobile {
      display: grid;
      gap: 6px;
    }
    .site-nav-mobile .site-nav-link {
      justify-content: flex-start;
      width: 100%;
      min-height: 42px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(15,23,42,.04);
    }
    .site-mobile-menu-meta {
      display: flex;
      justify-content: flex-start;
    }
    .lang-switch-mobile {
      max-width: 100%;
      overflow-x: auto;
    }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 10px 15px; border-radius: 999px; font-weight: 850; border: 1px solid transparent; }
    .btn-solid { background: #059669; color: white; box-shadow: 0 9px 20px rgba(5,150,105,.18); }
    .btn-solid-on-light { background: #059669; color: white; box-shadow: 0 10px 22px rgba(5,150,105,.18); }
    .btn-ghost { background: rgba(255,255,255,.86); border-color: var(--border); color: var(--ink); }
    .btn-ghost-on-dark { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.32); color: white; backdrop-filter: blur(4px); }
    .btn.secondary { background: rgba(255,255,255,.88); border-color: var(--border); color: var(--ink); }
    .skip-link {
      position: absolute;
      left: 12px;
      top: -48px;
      z-index: 100;
      padding: 10px 14px;
      border-radius: 10px;
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      transition: top .15s ease;
    }
    .skip-link:focus-visible { top: 10px; }
    a:focus-visible,
    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible,
    select:focus-visible,
    .btn:focus-visible,
    .site-nav-link:focus-visible,
    .lang-switch-link:focus-visible {
      outline: 3px solid #0284c7;
      outline-offset: 2px;
      border-radius: 10px;
    }
    .site-nav-link:focus-visible,
    .lang-switch-link:focus-visible {
      border-radius: 999px;
    }
    .hero-panel {
      position: relative;
      margin-top: 8px;
      padding: 56px 48px;
      border-radius: 32px;
      background:
        radial-gradient(ellipse at 18% 82%, rgba(255,255,255,.1), transparent 50%),
        radial-gradient(ellipse at 84% 16%, rgba(255,255,255,.14), transparent 42%),
        linear-gradient(135deg, #059669 0%, #10b981 42%, #34d399 64%, #0ea5e9 100%);
      color: white;
      box-shadow: var(--shadow-strong);
      overflow: hidden;
    }
    .hero-panel::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px);
      background-size: 24px 24px;
      pointer-events: none;
    }
    .hero-panel::after {
      content: "";
      position: absolute;
      inset: auto -6% -22% auto;
      width: 360px;
      height: 360px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14,165,233,.24), transparent 64%);
      pointer-events: none;
    }
    .hero-panel.has-media {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr);
      gap: 28px;
      align-items: stretch;
    }
    .hero-copy { position: relative; z-index: 1; max-width: 960px; }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.16);
      color: rgba(255,255,255,.88);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: none;
      box-shadow: 0 10px 24px rgba(15,23,42,.08);
    }
    .hero-badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #34d399;
      box-shadow: 0 0 0 4px rgba(52,211,153,.16);
      flex-shrink: 0;
    }
    .hero-panel h1 {
      margin: 18px 0 0;
      font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
      font-size: clamp(30px, 4vw, 50px);
      line-height: 1.34;
      letter-spacing: -.03em;
      font-weight: 900;
      max-width: 24ch;
      text-wrap: pretty;
    }
    .hero-emphasis { white-space: nowrap; }
    .hero-emphasis { color: #10b981; }
    .hero-panel p {
      margin: 22px 0 0;
      max-width: 48ch;
      color: rgba(255,255,255,.9);
      line-height: 1.95;
      font-size: 18px;
      letter-spacing: -.01em;
      text-wrap: pretty;
    }
    .hero-supplement { margin-top: 22px; }
    .hero-panel .actions { margin-top: 30px; gap: 12px; }
    .hero-metric-strip {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
      padding: 8px 18px;
      border-radius: 999px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.88);
      font-size: 14px;
      font-weight: 600;
    }
    .hero-metric strong { font-weight: 800; color: white; font-size: 15px; }
    .hero-metric-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,.4); flex-shrink: 0; }
    .hero-panel.is-center .hero-copy { text-align: center; margin-inline: auto; max-width: 1040px; }
    .hero-panel.is-center .hero-copy h1,
    .hero-panel.is-center .hero-copy p { margin-inline: auto; }
    .hero-panel.is-center .hero-badge { margin-inline: auto; }
    .hero-panel.is-center .actions { justify-content: center; }
    .hero-panel.is-light {
      background:
        radial-gradient(circle at top left, rgba(16,185,129,.12), transparent 38%),
        radial-gradient(circle at top right, rgba(14,165,233,.08), transparent 28%),
        linear-gradient(180deg, #f8fbff 0%, #ffffff 62%, #f8fbf8 100%);
      color: #0f172a;
      box-shadow: none;
      border: 0;
      border-radius: 0 0 36px 36px;
      padding: 68px 24px 52px;
    }
    .hero-panel.is-light::after { display: none; }
    .hero-panel.is-light::before { display: none; }
    .hero-panel.is-light p { color: #475569; }
    .hero-panel.is-light .eyebrow { color: #475569; opacity: 1; }
    .hero-panel.is-light .hero-badge {
      background: rgba(255,255,255,.92);
      border-color: rgba(15,23,42,.08);
      color: #475569;
    }
    .hero-panel.is-light .btn-solid-on-light { background: linear-gradient(135deg, #10b981, #0ea5e9); color: white; box-shadow: 0 12px 24px rgba(14,165,233,.16); }
    .hero-panel.is-light .btn-ghost-on-dark { background: rgba(255,255,255,.92); border-color: rgba(148,163,184,.45); color: #334155; }
    .hero-panel.is-light.has-media { display: block; }
    .hero-panel.is-light .hero-media {
      max-width: 540px;
      margin: 22px auto 0;
    }
    .hero-panel.is-light .hero-metric-strip {
      background: rgba(255,255,255,.92);
      border-color: rgba(15,23,42,.08);
      color: #475569;
      box-shadow: 0 10px 24px rgba(15,23,42,.06);
    }
    .hero-panel.is-light .hero-metric strong { color: #0f172a; }
    .hero-panel.is-light .hero-metric-dot { background: rgba(100,116,139,.38); }
    .hero-panel.is-light .hero-chip {
      background: rgba(255,255,255,.92);
      border-color: rgba(15,23,42,.08);
      color: #334155;
      box-shadow: 0 8px 18px rgba(15,23,42,.04);
    }
    .hero-after-actions {
      margin-top: 16px;
      display: flex;
      justify-content: center;
    }
    .hero-panel.is-center .hero-after-actions { justify-content: center; }
    .hero-panel.is-light .field-note-mini {
      background: linear-gradient(180deg, rgba(14,165,233,.08), rgba(16,185,129,.08));
      border-color: rgba(14,165,233,.12);
      color: #0f172a;
      box-shadow: 0 14px 28px rgba(15,23,42,.08);
    }
    .hero-panel.is-light .field-note-mini-label { color: #0ea5e9; }
    .hero-chip-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .hero-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.18);
      backdrop-filter: blur(6px);
      color: rgba(255,255,255,.92);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .01em;
    }
    .hero-media {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      min-height: 100%;
    }
    .field-note-preview { display: grid; gap: 10px; align-content: start; }
    .field-note-card {
      position: relative;
      padding: 22px 22px 20px 26px;
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255,255,255,.97), rgba(248,250,252,.94));
      border: 1px solid rgba(255,255,255,.34);
      box-shadow: 0 24px 54px rgba(15,23,42,.16);
      color: #0f172a;
      overflow: hidden;
    }
    .field-note-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          180deg,
          transparent 0,
          transparent 30px,
          rgba(14,165,233,.08) 31px,
          transparent 32px
        );
      pointer-events: none;
    }
    .field-note-card::after {
      content: "";
      position: absolute;
      inset: 0 auto 0 18px;
      width: 2px;
      background: linear-gradient(180deg, rgba(239,68,68,.28), rgba(239,68,68,.18));
      pointer-events: none;
    }
    .field-note-topline,
    .field-note-card h3,
    .field-note-card p,
    .field-note-meta,
    .field-note-tags { position: relative; z-index: 1; }
    .field-note-topline {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: .12em;
      font-weight: 800;
    }
    .field-note-kicker { color: #059669; }
    .field-note-date { color: #0ea5e9; }
    .field-note-card h3 {
      margin: 16px 0 10px;
      font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
      font-size: 24px;
      line-height: 1.35;
      letter-spacing: -.02em;
    }
    .field-note-card p {
      margin: 0;
      color: #334155;
      font-size: 14px;
      line-height: 1.8;
    }
    .field-note-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 14px;
      margin-top: 16px;
      color: #475569;
      font-size: 13px;
      font-weight: 700;
    }
    .field-note-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    .field-note-tags span {
      display: inline-flex;
      align-items: center;
      padding: 7px 12px;
      border-radius: 999px;
      background: rgba(16,185,129,.08);
      border: 1px solid rgba(16,185,129,.12);
      color: #047857;
      font-size: 12px;
      font-weight: 700;
    }
    .field-note-mini {
      padding: 14px 16px;
      border-radius: 20px;
      background: rgba(255,255,255,.94);
      border: 1px solid rgba(15,23,42,.08);
      color: #0f172a;
      backdrop-filter: blur(8px);
      box-shadow: 0 12px 28px rgba(15,23,42,.08);
    }
    .field-note-mini-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: rgba(255,255,255,.72);
    }
    .field-note-mini strong {
      display: block;
      margin-top: 6px;
      font-size: 15px;
      line-height: 1.45;
      letter-spacing: -.01em;
    }
    .field-note-mini span {
      display: block;
      margin-top: 8px;
      color: #475569;
      font-size: 13px;
      line-height: 1.7;
    }
    .hero-panel .btn-solid {
      background: #0f172a;
      color: white;
      box-shadow: 0 12px 28px rgba(15,23,42,.18);
    }
    .hero-panel .btn-solid:hover { background: #1e293b; }
    .hero-panel .btn-ghost-on-dark {
      background: rgba(255,255,255,.92);
      color: #334155;
      border-color: rgba(255,255,255,.42);
    }
    .hero-photo {
      position: relative;
      min-height: 220px;
      border-radius: 26px;
      overflow: hidden;
      box-shadow: 0 18px 38px rgba(5, 20, 11, .18);
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(255,255,255,.12);
    }
    .hero-photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      filter: saturate(1.05) contrast(1.02);
    }
    .hero-photo::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(4,16,9,0) 34%, rgba(4,16,9,.44) 100%);
      pointer-events: none;
    }
    .hero-photo-label {
      position: absolute;
      left: 14px;
      bottom: 14px;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.22);
      color: white;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      backdrop-filter: blur(10px);
    }
    .hero-photo.tall { grid-row: span 2; min-height: 100%; }
    .hero-photo.small { min-height: 148px; }
    .hero { padding: 26px; border-radius: 28px; background: linear-gradient(135deg, var(--hero-a), var(--hero-b)); color: white; box-shadow: 0 20px 46px rgba(18,61,37,.16); }
    .hero .muted, .hero .meta, .hero p { color: rgba(255,255,255,.88); }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); opacity: .9; }
    .section { margin-top: 24px; }
    .section-header { display: flex; flex-direction: column; justify-content: flex-start; gap: 8px; align-items: flex-start; }
    .section-header h2 { margin: 0; font-size: 22px; letter-spacing: -.02em; }
    .section-header p { margin: 8px 0 0; color: var(--muted); }
    .grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 14px; }
    .card {
      padding: 22px;
      border-radius: 28px;
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: 0 12px 28px rgba(15,23,42,.05);
      overflow: hidden;
      transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
    }
    .card:hover { transform: translateY(-2px); box-shadow: 0 18px 34px rgba(15,23,42,.08); border-color: rgba(14,165,233,.14); }
    .card.has-accent { border-left: 3px solid #10b981; }
    .card.is-soft {
      background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(248,250,252,.92));
      box-shadow: 0 10px 24px rgba(15,23,42,.05);
    }
    .card-body { padding: 18px; }
    .card-step {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12));
      color: #059669;
      font-size: 14px;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .card h2, .title {
      margin: 8px 0 0;
      font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
      font-size: 19px;
      line-height: 1.32;
      font-weight: 800;
      letter-spacing: -.01em;
    }
    .card p, .meta, .muted { color: var(--muted); line-height: 1.7; }
    .meta { font-size: 13px; margin-top: 6px; }
    .inline-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #047857;
      font-size: 14px;
      font-weight: 800;
    }
    .inline-link::after {
      content: "→";
      font-size: 14px;
    }
    .mentor-inline {
      padding: 22px 24px;
      background: linear-gradient(180deg, rgba(16,185,129,.05), rgba(14,165,233,.04));
      border-color: rgba(16,185,129,.12);
      box-shadow: 0 10px 24px rgba(15,23,42,.05);
    }
    .mentor-inline h2 {
      margin: 10px 0 8px;
      font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
      font-size: 24px;
      line-height: 1.3;
      letter-spacing: -.02em;
      color: #0f172a;
      max-width: 760px;
    }
    .mentor-inline p {
      margin: 0;
      max-width: 760px;
      color: #475569;
      line-height: 1.8;
      font-size: 15px;
    }
    .list { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255,255,255,.86);
      border: 1px solid #dfeadf;
    }
    .row strong { display: block; margin-bottom: 4px; }
    .pill { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 700; }
    .thumb { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: #e6eee7; }
    .visual-band {
      position: relative;
      padding: 20px;
      border-radius: 30px;
      background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(239,246,239,.92));
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
    }
    .photo-grid {
      display: grid;
      grid-template-columns: 1.25fr .95fr .95fr;
      gap: 14px;
      margin-top: 18px;
    }
    .photo-card {
      position: relative;
      min-height: 240px;
      border-radius: 26px;
      overflow: hidden;
      box-shadow: 0 20px 38px rgba(10,42,24,.12);
      background: rgba(255,255,255,.74);
    }
    .photo-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .photo-card::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(17,31,21,0) 26%, rgba(17,31,21,.52) 100%);
      pointer-events: none;
    }
    .photo-card .caption {
      position: absolute;
      left: 16px;
      right: 16px;
      bottom: 16px;
      z-index: 1;
      color: white;
    }
    .photo-card .caption strong {
      display: block;
      font-family: "Shippori Mincho", "Yu Mincho", serif;
      font-size: 24px;
      line-height: 1.15;
    }
    .photo-card .caption span {
      display: block;
      margin-top: 8px;
      color: rgba(255,255,255,.84);
      line-height: 1.55;
      font-size: 13px;
    }
    .photo-card.tall { min-height: 320px; }
    .stack { display: flex; flex-direction: column; gap: 12px; }
    input, textarea, select {
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.96);
      color: var(--ink);
      font: inherit;
    }
    code { font-family: ui-monospace, monospace; font-size: 13px; }
    .onboarding-empty { padding: 48px 32px; text-align: center; border-radius: 28px; background: linear-gradient(180deg, #f8fffc, #effaf4); border: 1px solid rgba(16,185,129,.16); }
    .onboarding-empty .eyebrow { display: inline-block; margin-bottom: 12px; }
    .onboarding-empty h3 { margin: 0 0 12px; font-size: 22px; font-weight: 800; }
    .onboarding-empty p { margin: 0 0 20px; color: #475569; max-width: 44ch; margin-inline: auto; }
    .ver-tag { font-size: 11px; font-weight: 700; color: #94a3b8; margin-right: 6px; font-family: ui-monospace, monospace; }
    .site-footer {
      position: relative;
      overflow: hidden;
      margin-top: 42px;
      border-top: 1px solid rgba(255,255,255,.1);
      background:
        linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px),
        linear-gradient(0deg, rgba(255,255,255,.05) 1px, transparent 1px),
        linear-gradient(116deg, rgba(16,185,129,.28) 0%, rgba(16,185,129,0) 34%),
        linear-gradient(244deg, rgba(14,165,233,.2) 0%, rgba(14,165,233,0) 30%),
        linear-gradient(135deg, #052e24 0%, #064e3b 48%, #075985 100%);
      background-size: 46px 46px, 46px 46px, auto, auto, auto;
      color: #ecfdf5;
    }
    .site-footer::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,0) 34%, rgba(0,0,0,.14));
      pointer-events: none;
    }
    .footer-inner {
      position: relative;
      z-index: 1;
      width: min(1480px, calc(100% - 32px));
      margin: 0 auto;
      display: grid;
      gap: 18px;
      padding: clamp(36px, 6vw, 72px) 0 26px;
    }
    .footer-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, .62fr);
      gap: 18px;
      align-items: stretch;
    }
    .footer-brand-panel,
    .footer-mini-map,
    .footer-directory,
    .footer-bottom {
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.08);
      box-shadow: 0 24px 70px rgba(0,0,0,.18);
      backdrop-filter: blur(18px);
      border-radius: 8px;
    }
    .footer-brand-panel {
      min-height: 340px;
      padding: clamp(24px, 4vw, 44px);
      display: grid;
      align-content: space-between;
      gap: 26px;
    }
    .site-footer .brand { color: #ffffff; }
    .site-footer .brand-mark {
      background: #ecfdf5;
      box-shadow: 0 12px 30px rgba(0,0,0,.16);
    }
    .site-footer .brand small { color: rgba(236,253,245,.76); }
    .footer-kicker {
      width: fit-content;
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
      padding: 6px 10px;
      border: 1px solid rgba(167,243,208,.28);
      border-radius: 999px;
      background: rgba(16,185,129,.13);
      color: #a7f3d0;
      font-size: 12px;
      font-weight: 950;
    }
    .footer-brand-panel h2 {
      margin: 18px 0 0;
      max-width: 16ch;
      color: #ffffff;
      font-size: clamp(34px, 4.2vw, 58px);
      line-height: 1.08;
      letter-spacing: 0;
      font-weight: 950;
    }
    .footer-brand-panel p {
      margin: 14px 0 0;
      max-width: 50em;
      color: rgba(236,253,245,.74);
      font-size: 14px;
      font-weight: 650;
    }
    .footer-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 22px;
    }
    .site-footer .btn-solid {
      background: #ffffff;
      color: #064e3b;
      box-shadow: 0 18px 42px rgba(0,0,0,.18);
    }
    .site-footer .btn-ghost-on-dark {
      background: rgba(255,255,255,.08);
      color: #ffffff;
      border-color: rgba(255,255,255,.24);
    }
    .global-record-launcher {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: max(10px, env(safe-area-inset-bottom));
      z-index: 36;
      display: none;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      padding: 8px;
      gap: 8px;
      border-radius: 24px;
      background: rgba(255,255,255,.96);
      border: 1px solid rgba(15,23,42,.08);
      box-shadow: 0 20px 44px rgba(15,23,42,.20);
      backdrop-filter: blur(18px);
    }
    .global-record-choice {
      min-height: 58px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 7px 6px;
      border-radius: 17px;
      background: rgba(248,250,252,.92);
      color: #0f172a;
      font-size: 11px;
      font-weight: 950;
      line-height: 1.2;
      text-decoration: none;
    }
    .global-record-choice.is-primary {
      background: #ecfdf5;
      color: #065f46;
    }
    .global-record-choice-icon {
      width: 30px;
      height: 30px;
      flex: 0 0 30px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: rgba(15,23,42,.06);
    }
    .global-record-choice.is-primary .global-record-choice-icon {
      background: rgba(16,185,129,.14);
    }
    .global-record-choice svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .footer-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .footer-chip-row span {
      min-height: 32px;
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 999px;
      background: rgba(255,255,255,.07);
      color: rgba(236,253,245,.78);
      font-size: 12px;
      font-weight: 820;
    }
    .footer-mini-map {
      min-height: 340px;
      position: relative;
      overflow: hidden;
      padding: 22px;
      display: grid;
      align-content: end;
      background:
        linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px),
        linear-gradient(0deg, rgba(255,255,255,.08) 1px, transparent 1px),
        linear-gradient(135deg, rgba(6,78,59,.58), rgba(14,165,233,.42));
      background-size: 38px 38px, 38px 38px, auto;
    }
    .footer-route {
      position: absolute;
      inset: 42px 44px 72px 42px;
      border: 2px solid rgba(167,243,208,.5);
      border-left-color: transparent;
      border-bottom-color: rgba(125,211,252,.52);
      border-radius: 45% 55% 58% 42%;
      transform: rotate(-9deg);
    }
    .footer-pin {
      position: absolute;
      width: 16px;
      height: 16px;
      border: 4px solid #fff;
      border-radius: 999px;
      background: #10b981;
      box-shadow: 0 10px 24px rgba(0,0,0,.22);
    }
    .footer-pin.one { left: 18%; top: 32%; }
    .footer-pin.two { left: 57%; top: 24%; background: #0ea5e9; }
    .footer-pin.three { left: 73%; top: 63%; background: #f59e0b; }
    .footer-pin.four { left: 36%; top: 70%; background: #34d399; }
    .footer-map-copy {
      position: relative;
      z-index: 2;
      padding: 16px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      background: rgba(5,46,36,.52);
      backdrop-filter: blur(14px);
    }
    .footer-map-copy span {
      color: #a7f3d0;
      font-size: 12px;
      font-weight: 950;
    }
    .footer-map-copy strong {
      display: block;
      margin-top: 5px;
      color: #fff;
      font-size: 22px;
      line-height: 1.25;
      font-weight: 950;
    }
    .footer-map-copy p {
      margin: 8px 0 0;
      color: rgba(236,253,245,.7);
      font-size: 12px;
      font-weight: 650;
    }
    .footer-directory {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      overflow: hidden;
      background: rgba(255,255,255,.12);
    }
    .footer-group {
      min-height: 220px;
      padding: 22px;
      background: rgba(5,46,36,.42);
    }
    .footer-group strong {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 950;
      margin-bottom: 14px;
    }
    .footer-group strong i {
      min-width: 26px;
      height: 26px;
      display: inline-grid;
      place-items: center;
      padding: 0 6px;
      border-radius: 8px;
      background: rgba(167,243,208,.14);
      color: #a7f3d0;
      font-size: 9px;
      font-style: normal;
      font-weight: 950;
    }
    .footer-links {
      display: grid;
      gap: 8px;
    }
    .footer-links a {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      width: fit-content;
      color: rgba(236,253,245,.76);
      font-weight: 760;
      transition: color .18s ease, transform .18s ease;
    }
    .footer-links a:hover {
      color: #ffffff;
      transform: translateX(2px);
    }
    .footer-bottom {
      min-height: 62px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 14px 18px;
      color: rgba(236,253,245,.7);
      font-size: 12px;
      font-weight: 700;
    }
    .footer-bottom a {
      color: #ffffff;
      font-weight: 900;
    }
    @media (max-width: 1160px) {
      .site-header-inner {
        padding: 10px 18px;
        gap: 10px;
      }
      .brand {
        max-width: 270px;
        flex-basis: 220px;
      }
      .site-search-desktop {
        max-width: 240px;
      }
      .site-header-actions-desktop {
        display: none;
      }
      .site-header-actions-mobile {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .site-record-link {
        min-height: 40px;
        padding: 10px 13px;
        font-size: 13px;
        box-shadow: 0 8px 18px rgba(5,150,105,.14);
      }
      .site-mobile-menu {
        position: relative;
        display: block;
      }
    }
    @media (max-width: 1120px) {
      .footer-hero,
      .footer-directory { grid-template-columns: 1fr 1fr; }
      .footer-brand-panel,
      .footer-mini-map { min-height: 300px; }
    }
    @media (max-width: 960px) {
      .brand {
        max-width: none;
      }
      .site-nav-desktop,
      .site-search-desktop {
        display: none;
      }
    }
    @media (max-width: 720px) {
      .md-hidden { display: inline; }
      .shell { padding: 16px 16px 18px; }
      .shell.shell-bleed,
      .shell.shell-map { padding: 14px 12px 18px; }
      .site-header-inner {
        padding: 9px 12px;
        gap: 8px;
        flex-wrap: nowrap;
        align-items: center;
      }
      .brand {
        min-width: 0;
        flex: 1 1 auto;
        gap: 8px;
      }
      .brand-mark {
        width: 36px;
        height: 36px;
        flex-basis: 36px;
        border-radius: 11px;
      }
      .brand strong { font-size: 14px; }
      .brand small { display: none; }
      .site-nav-desktop,
      .site-search-desktop,
      .site-header-actions-desktop { display: none; }
      .site-header-actions-mobile {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 7px;
      }
      .site-record-link {
        min-height: 40px;
        padding: 10px 12px;
        font-size: 13px;
        box-shadow: 0 8px 18px rgba(5,150,105,.14);
      }
      .has-global-record-launcher .site-header-actions-mobile .site-record-link { display: none; }
      .site-shell.has-global-record-launcher { padding-bottom: 88px; }
      .hero-panel { padding: 48px 24px 36px; border-radius: 26px; }
      .hero-panel h1 { font-size: clamp(28px, 9vw, 40px); line-height: 1.24; max-width: 18ch; }
      .hero-panel p { font-size: 16px; line-height: 1.85; max-width: 32ch; margin-top: 18px; }
      .hero-emphasis { white-space: normal; }
      .hero-panel.has-media { grid-template-columns: 1fr; }
      .hero-media { grid-template-columns: 1fr; }
      .hero-panel.is-light .hero-media { margin-top: 20px; }
      .hero-photo.tall { grid-row: auto; min-height: 220px; }
      .photo-grid { grid-template-columns: 1fr; }
      .footer-inner { width: min(100% - 24px, 1480px); padding: 30px 0 22px; }
      .footer-hero,
      .footer-directory { grid-template-columns: 1fr; }
      .footer-brand-panel,
      .footer-mini-map { min-height: 0; }
      .footer-brand-panel { padding: 22px; }
      .footer-mini-map { min-height: 280px; }
      .footer-group { min-height: 0; padding: 18px; }
      .footer-bottom { flex-direction: column; align-items: flex-start; }
      .row { flex-direction: column; }
      .field-note-card { padding: 18px 18px 18px 20px; }
      .field-note-card h3 { font-size: 20px; }
      .mentor-inline { padding: 20px 20px; }
      .mentor-inline h2 { font-size: 21px; }
      .global-record-launcher {
        display: grid;
      }
    }
    ${options.extraStyles ?? ""}
  </style>
</head>
<body>
  <a class="skip-link" href="#main-content">${escapeHtml(skipLabel)}</a>
  <div class="${siteShellClassName}">
    ${nav(options.basePath, lang, currentPath, options.activeNav)}
    <main id="main-content" class="shell${options.shellClassName ? ` ${escapeHtml(options.shellClassName)}` : ""}" tabindex="-1">
      ${hero(options.basePath, options.hero)}
      ${options.belowHeroHtml ?? ""}
      ${options.body}
    </main>
    ${footer(options.basePath, lang, options.footerNote)}
    ${globalRecordNav}
  </div>
  ${authNavHydrationScript(options.basePath, lang)}
  ${uiKpiScript}
</body>
</html>`;
}
