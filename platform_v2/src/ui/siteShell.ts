import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, supportedLanguages, type SiteLang } from "../i18n.js";

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
};

type ShellCopy = {
  brandTagline: string;
  searchPlaceholder: string;
  searchLabel: string;
  nav: {
    home: string;
    explore: string;
    learn: string;
    business: string;
  };
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

const shellCopy: Record<SiteLang, ShellCopy> = {
  ja: {
    brandTagline: "Enjoy Nature",
    searchPlaceholder: "生きもの・場所を探す",
    searchLabel: "サイト内検索",
    nav: {
      home: "ホーム",
      explore: "みつける",
      learn: "読む",
      business: "法人向け",
    },
    record: "記録する",
    footer: {
      tagline: "見つけたことが、あとで自分やほかの人につながっていく。",
      start: "はじめる",
      startLinks: {
        discover: "みつける",
        record: "記録する",
        places: "自分の場所",
      },
      learn: "読む",
      learnLinks: {
        guides: "ガイド一覧",
        about: "ikimon について",
        faq: "よくある質問",
        updates: "アップデート",
      },
      trust: "安心と案内",
      trustLinks: {
        business: "法人向け",
        contact: "お問い合わせ",
        terms: "利用規約",
        privacy: "プライバシー",
      },
      copyright: "© 2024-2026 ikimon Project.",
      revisit: "",
    },
  },
  en: {
    brandTagline: "Let nearby finds connect later, for you and for others.",
    searchPlaceholder: "Search species or places",
    searchLabel: "Site search",
    nav: {
      home: "Home",
      explore: "Explore",
      learn: "Learn",
      business: "For Business",
    },
    record: "Record",
    footer: {
      tagline: "Let what you notice nearby connect later.",
      start: "Start",
      startLinks: {
        discover: "Explore",
        record: "Record",
        places: "My Places",
      },
      learn: "Learn",
      learnLinks: {
        guides: "Guides",
        about: "About",
        faq: "FAQ",
        updates: "Updates",
      },
      trust: "Trust",
      trustLinks: {
        business: "For Business",
        contact: "Contact",
        terms: "Terms",
        privacy: "Privacy",
      },
      copyright: "© 2024-2026 ikimon Project.",
      revisit: "",
    },
  },
  es: {
    brandTagline: "Deja que lo que encuentras cerca se conecte después.",
    searchPlaceholder: "Buscar especie o lugar",
    searchLabel: "Búsqueda del sitio",
    nav: {
      home: "Inicio",
      explore: "Explorar",
      learn: "Aprender",
      business: "Para organizaciones",
    },
    record: "Registrar",
    footer: {
      tagline: "Deja que lo que notas cerca conecte más tarde.",
      start: "Empezar",
      startLinks: {
        discover: "Explorar",
        record: "Registrar",
        places: "Mis lugares",
      },
      learn: "Aprender",
      learnLinks: {
        guides: "Guías",
        about: "Acerca de",
        faq: "Preguntas frecuentes",
        updates: "Actualizaciones",
      },
      trust: "Confianza",
      trustLinks: {
        business: "Para organizaciones",
        contact: "Contacto",
        terms: "Términos",
        privacy: "Privacidad",
      },
      copyright: "© 2024-2026 ikimon Project.",
      revisit: "",
    },
  },
  "pt-BR": {
    brandTagline: "Deixe o que encontra por perto se conectar depois.",
    searchPlaceholder: "Buscar espécie ou lugar",
    searchLabel: "Busca no site",
    nav: {
      home: "Início",
      explore: "Explorar",
      learn: "Aprender",
      business: "Para organizações",
    },
    record: "Registrar",
    footer: {
      tagline: "Deixe o que você nota por perto se conectar depois.",
      start: "Começar",
      startLinks: {
        discover: "Explorar",
        record: "Registrar",
        places: "Meus lugares",
      },
      learn: "Aprender",
      learnLinks: {
        guides: "Guias",
        about: "Sobre",
        faq: "Perguntas frequentes",
        updates: "Atualizações",
      },
      trust: "Confiança",
      trustLinks: {
        business: "Para organizações",
        contact: "Contato",
        terms: "Termos",
        privacy: "Privacidade",
      },
      copyright: "© 2024-2026 ikimon Project.",
      revisit: "",
    },
  },
};

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nav(basePath: string, lang: SiteLang, currentPath: string, activeNav?: string): string {
  const copy = shellCopy[lang];
  const brandMarkSrc = "/assets/img/icon-192.png";
  const links = [
    { href: withBasePath(basePath, "/"), label: copy.nav.home },
    { href: withBasePath(basePath, "/explore"), label: copy.nav.explore },
    { href: withBasePath(basePath, "/learn"), label: copy.nav.learn },
    { href: withBasePath(basePath, "/for-business"), label: copy.nav.business },
  ];

  return `<header class="site-header">
    <div class="site-header-inner">
      <a class="brand" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/"), lang))}">
        <span class="brand-mark"><img src="${escapeHtml(brandMarkSrc)}" alt="ikimon icon" /></span>
        <span>
          <strong>ikimon</strong>
          <small>${escapeHtml(copy.brandTagline)}</small>
        </span>
      </a>
      <nav class="site-nav">${links
        .map((link) => {
          const activeClass = activeNav === link.label ? " is-active" : "";
          return `<a class="site-nav-link${activeClass}" href="${escapeHtml(appendLangToHref(link.href, lang))}">${escapeHtml(link.label)}</a>`;
        })
        .join("")}</nav>
      <form class="site-search" role="search" action="${escapeHtml(withBasePath(basePath, "/explore"))}" method="get" aria-label="${escapeHtml(copy.searchLabel)}">
        <span class="site-search-icon" aria-hidden="true">🔍</span>
        <input class="site-search-input" type="search" name="q" placeholder="${escapeHtml(copy.searchPlaceholder)}" aria-label="${escapeHtml(copy.searchLabel)}" />
      </form>
      <div class="site-header-actions">
        <div class="lang-switch" aria-label="Language switcher">${supportedLanguages
          .map((language) => {
            const activeClass = language.code === lang ? " is-active" : "";
            return `<a class="lang-switch-link${activeClass}" href="${escapeHtml(appendLangToHref(currentPath, language.code))}" hreflang="${escapeHtml(language.code)}" lang="${escapeHtml(language.code)}">${escapeHtml(language.shortLabel)}</a>`;
          })
          .join("")}</div>
        <a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}">${escapeHtml(copy.record)}</a>
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

function footer(basePath: string, lang: SiteLang, footerNote?: string): string {
  const copy = shellCopy[lang];
  const note = footerNote ?? copy.footer.tagline;
  return `<footer class="site-footer">
    <div class="site-footer-inner">
      <div class="site-footer-top">
        <section class="site-footer-brand">
          <div class="brand brand-footer">
            <span class="brand-mark"><img src="/assets/img/icon-192.png" alt="ikimon icon" /></span>
            <span>
              <strong>ikimon</strong>
              <small>${escapeHtml(copy.footer.tagline)}</small>
            </span>
          </div>
          <p class="meta">${escapeHtml(note)}</p>
        </section>
        <section class="site-footer-links-group">
          <div class="eyebrow">${escapeHtml(copy.footer.start)}</div>
          <div class="footer-links">
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/explore"), lang))}">${escapeHtml(copy.footer.startLinks.discover)}</a>
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}">${escapeHtml(copy.footer.startLinks.record)}</a>
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/home"), lang))}">${escapeHtml(copy.footer.startLinks.places)}</a>
          </div>
        </section>
        <section class="site-footer-links-group">
          <div class="eyebrow">${escapeHtml(copy.footer.learn)}</div>
          <div class="footer-links">
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">${escapeHtml(copy.footer.learnLinks.guides)}</a>
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/about"), lang))}">${escapeHtml(copy.footer.learnLinks.about)}</a>
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/faq"), lang))}">${escapeHtml(copy.footer.learnLinks.faq)}</a>
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn/updates"), lang))}">${escapeHtml(copy.footer.learnLinks.updates)}</a>
          </div>
        </section>
        <section class="site-footer-links-group">
          <div class="eyebrow">${escapeHtml(copy.footer.trust)}</div>
          <div class="footer-links">
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/for-business"), lang))}">${escapeHtml(copy.footer.trustLinks.business)}</a>
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/contact"), lang))}">${escapeHtml(copy.footer.trustLinks.contact)}</a>
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/terms"), lang))}">${escapeHtml(copy.footer.trustLinks.terms)}</a>
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/privacy"), lang))}">${escapeHtml(copy.footer.trustLinks.privacy)}</a>
          </div>
        </section>
      </div>
      <div class="site-footer-bottom">
        <p>${escapeHtml(copy.footer.copyright)}</p>
        ${copy.footer.revisit ? `<p>${escapeHtml(copy.footer.revisit)}</p>` : ""}
      </div>
    </div>
  </footer>`;
}

export function renderSiteDocument(options: SiteShellOptions): string {
  const lang = options.lang ?? "ja";
  const currentPath = options.currentPath ?? withBasePath(options.basePath, "/");
  const uiKpiEndpoint = withBasePath(options.basePath, "/api/v1/ui-kpi/events");
  const skipLabel =
    lang === "ja"
      ? "本文へスキップ"
      : lang === "es"
        ? "Saltar al contenido"
        : lang === "pt-BR"
          ? "Pular para o conteúdo"
          : "Skip to content";
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
  const ambientCueScript = `<script>
(function () {
  const endpoint = ${JSON.stringify(uiKpiEndpoint)};
  const pagePath = location.pathname + location.search;
  const send = (eventName, card, acted) => {
    if (!card) return;
    const cueKind = card.getAttribute('data-cue-kind') || '';
    const basisType = card.getAttribute('data-basis-type') || '';
    const surface = card.getAttribute('data-cue-surface') || pagePath;
    const cueId = card.getAttribute('data-cue-id') || cueKind || 'cue';
    const seenKey = 'ikimon:v2:cue:' + eventName + ':' + pagePath + ':' + cueId;
    if (eventName === 'cue_seen') {
      try {
        if (sessionStorage.getItem(seenKey) === '1') return;
        sessionStorage.setItem(seenKey, '1');
      } catch (_) {}
    }
    const payload = {
      eventName,
      pagePath,
      routeKey: surface,
      actionKey: cueKind || eventName,
      metadata: {
        cueKind,
        basisType,
        surface,
        acted,
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

  const cards = Array.from(document.querySelectorAll('[data-cue-kind]'));
  if (cards.length === 0) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          send('cue_seen', entry.target, false);
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.45 });
    cards.forEach((card) => observer.observe(card));
  } else {
    cards.forEach((card) => send('cue_seen', card, false));
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-cue-action]') : null;
    if (!target) return;
    const card = target.closest('[data-cue-kind]');
    const action = target.getAttribute('data-cue-action') || 'cue_opened';
    send(action, card, action !== 'cue_dismissed');
    if (action === 'cue_dismissed' && card instanceof HTMLElement) {
      card.style.display = 'none';
    }
  }, { capture: true });
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
    .md-hidden { display: none; }
    .site-header { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(16px); background: rgba(249,255,254,.9); border-bottom: 1px solid rgba(0,0,0,.04); }
    .site-header-inner { max-width: 1180px; margin: 0 auto; padding: 12px 24px; display: flex; align-items: center; gap: 18px; justify-content: space-between; flex-wrap: wrap; }
    .brand { display: inline-flex; align-items: center; gap: 12px; min-width: 220px; }
    .brand-mark { width: 40px; height: 40px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 10px 24px rgba(15,23,42,.08); background: white; }
    .brand-mark img { width: 100%; height: 100%; display: block; }
    .brand strong { display: block; font-size: 15px; font-weight: 900; }
    .brand small { display: block; margin-top: 2px; color: var(--muted); }
    .site-nav { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .site-nav-link { display: inline-flex; align-items: center; min-height: 44px; padding: 11px 10px; border-radius: 10px; background: transparent; border: 0; font-weight: 700; font-size: 14px; color: #475569; }
    .site-nav-link:hover { background: rgba(15,23,42,.04); }
    .site-nav-link.is-active { color: #0f172a; background: rgba(16,185,129,.08); }
    .site-header-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .site-search {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 4px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,.92);
      border: 1px solid rgba(148,163,184,.32);
      box-shadow: 0 6px 14px rgba(15,23,42,.04);
      flex: 1 1 200px;
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
      min-width: 44px;
      min-height: 44px;
      padding: 0 12px;
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
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px; border-radius: 999px; font-weight: 800; border: 1px solid transparent; }
    .btn-solid { background: linear-gradient(135deg, #10b981, #0ea5e9); color: white; box-shadow: 0 10px 24px rgba(14,165,233,.18); }
    .btn-solid-on-light { background: linear-gradient(135deg, #10b981, #0ea5e9); color: white; box-shadow: 0 12px 26px rgba(14,165,233,.18); }
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
    .hero-copy { position: relative; z-index: 1; max-width: 760px; }
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
      font-size: clamp(30px, 4.4vw, 54px);
      line-height: 1.34;
      letter-spacing: -.03em;
      font-weight: 900;
      max-width: 13ch;
      text-wrap: balance;
    }
    .hero-emphasis { color: #bbf7d0; }
    .hero-panel p {
      margin: 22px 0 0;
      max-width: 34ch;
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
    .hero-panel.is-center .hero-copy { text-align: center; margin-inline: auto; }
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
    .section-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-end; }
    .section-header h2 { margin: 0; font-size: 22px; letter-spacing: -.02em; }
    .section-header p { margin: 8px 0 0; color: var(--muted); }
    .grid, .actions { display: flex; flex-wrap: wrap; gap: 14px; }
    .grid { margin-top: 12px; }
    .card {
      flex: 1 1 260px;
      min-width: 240px;
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
    .site-footer { margin-top: 48px; border-top: 1px solid rgba(0,0,0,.04); background: #f8fafc; }
    .site-footer-inner { max-width: 1120px; margin: 0 auto; padding: 40px 24px 28px; }
    .site-footer-top {
      display: grid;
      gap: 28px;
      grid-template-columns: 1.4fr 1fr 1fr 1fr;
      padding-bottom: 28px;
      border-bottom: 1px solid rgba(148,163,184,.22);
    }
    .site-footer-brand { max-width: 340px; }
    .brand-footer { min-width: 0; }
    .site-footer-links-group { min-width: 0; }
    .footer-links { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .footer-links a { color: var(--muted); font-weight: 700; }
    .site-footer-bottom {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding-top: 18px;
      color: #64748b;
      font-size: 12px;
    }
    @media (max-width: 900px) {
      .site-footer-top { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 720px) {
      .md-hidden { display: inline; }
      .shell { padding: 20px 18px 18px; }
      .site-header-inner { padding: 12px 18px; }
      .hero-panel { padding: 48px 24px 36px; border-radius: 26px; }
      .hero-panel h1 { font-size: clamp(28px, 9vw, 40px); line-height: 1.28; max-width: 11ch; }
      .hero-panel p { font-size: 16px; line-height: 1.85; max-width: 28ch; margin-top: 18px; }
      .hero-panel.has-media { grid-template-columns: 1fr; }
      .hero-media { grid-template-columns: 1fr; }
      .hero-panel.is-light .hero-media { margin-top: 20px; }
      .hero-photo.tall { grid-row: auto; min-height: 220px; }
      .photo-grid { grid-template-columns: 1fr; }
      .site-footer-inner { padding: 28px 18px 24px; }
      .site-footer-top { grid-template-columns: 1fr; }
      .site-footer-bottom { flex-direction: column; }
      .row { flex-direction: column; }
      .field-note-card { padding: 18px 18px 18px 20px; }
      .field-note-card h3 { font-size: 20px; }
      .mentor-inline { padding: 20px 20px; }
      .mentor-inline h2 { font-size: 21px; }
    }
    ${options.extraStyles ?? ""}
  </style>
</head>
<body>
  <a class="skip-link" href="#main-content">${escapeHtml(skipLabel)}</a>
  <div class="site-shell">
    ${nav(options.basePath, lang, currentPath, options.activeNav)}
    <main id="main-content" class="shell" tabindex="-1">
      ${hero(options.basePath, options.hero)}
      ${options.belowHeroHtml ?? ""}
      ${options.body}
    </main>
    ${footer(options.basePath, lang, options.footerNote)}
  </div>
  ${uiKpiScript}
  ${ambientCueScript}
</body>
</html>`;
}
