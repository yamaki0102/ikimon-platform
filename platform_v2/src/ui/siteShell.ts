import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, supportedLanguages, type SiteLang } from "../i18n.js";
import { getShortCopy } from "../content/index.js";
import { APP_LAUNCH_BACKGROUND_COLOR, APP_THEME_COLOR, appInstallCopy } from "../appInstall.js";
import { BRAND_ASSETS } from "../brandAssets.js";
import { IKIMON_CLARITY_PROJECT_ID, IKIMON_GA4_MEASUREMENT_ID } from "../services/analyticsConfig.js";
import { getCspNonce } from "../services/cspNonce.js";
import { PRODUCTION_PUBLIC_ORIGIN } from "../services/trustedPublicOrigin.js";
import {
  getSiteShellLayoutForPath,
  listPagesByLane,
  sitePageLabel,
  type RouteLane,
  type SitePageDefinition,
  type SiteShellLayoutKind,
} from "../siteMap.js";

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
  description?: string;
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
  canonicalPath?: string;
  alternateLangs?: SiteLang[];
  noindex?: boolean;
  structuredDataHtml?: string;
  shellClassName?: string;
  /** Suppress the fixed quick-record launcher on surfaces that already have dense task controls. */
  hideGlobalRecordLauncher?: boolean;
  /** Skip the global site footer. Immersive surfaces also suppress it
   *  automatically so primary circulation stays in the header/side menu. */
  hideFooter?: boolean;
  minimalChrome?: boolean;
  /** State-aware home header. Both safe shells are emitted so the Cloudflare materialized runtime can switch without JS. */
  homeChrome?: "guest" | "member";
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

function applyCspNonceToScripts(html: string): string {
  const nonce = getCspNonce();
  if (!nonce) {
    return html;
  }
  const nonceAttribute = ` nonce="${escapeHtml(nonce)}"`;
  return html
    .replace(/<script\b([^>]*?)\snonce=(?:"[^"]*"|'[^']*'|[^\s>]+)([^>]*)>/g, `<script$1${nonceAttribute}$2>`)
    .replace(/<script\b(?![^>]*\bnonce=)/g, `<script${nonceAttribute}`);
}

function recordsSearchState(currentPath: string): { query: string; view: string } {
  try {
    const url = new URL(currentPath || "/", "https://ikimon.local");
    if (!url.pathname.replace(/\/+$/, "").endsWith("/records")) {
      return { query: "", view: "" };
    }
    return {
      query: (url.searchParams.get("q") ?? "").trim().slice(0, 80),
      view: (url.searchParams.get("view") ?? "").trim().slice(0, 40),
    };
  } catch {
    return { query: "", view: "" };
  }
}

function renderSearchForm(basePath: string, lang: SiteLang, copy: ShellCopy, className = "", currentPath = ""): string {
  const classes = ["site-search"];
  if (className) {
    classes.push(className);
  }
  const searchState = recordsSearchState(currentPath);

  return `<form class="${classes.join(" ")}" role="search" action="${escapeHtml(appendLangToHref(withBasePath(basePath, "/records"), lang))}" method="get" aria-label="${escapeHtml(copy.searchLabel)}">
    <span class="site-search-icon" aria-hidden="true">🔍</span>
    <input type="hidden" name="view" value="${escapeHtml(searchState.view || "public")}" />
    <input class="site-search-input" type="search" name="q" placeholder="${escapeHtml(copy.searchPlaceholder)}" value="${escapeHtml(searchState.query)}" aria-label="${escapeHtml(copy.searchLabel)}" />
  </form>`;
}

function desktopSideNavIcon(key: string): string {
  const paths: Record<string, string> = {
    home: '<path d="m3 10 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    record: '<path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/>',
    observations: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    identify: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="m8.4 11.2 2.1 2.1 4-4.2"/>',
    map: '<path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
    notes: '<path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h8"/><path d="M8 11h8"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    guide: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
    learn: '<path d="M22 10 12 5 2 10l10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    community: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    business: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    notifications: '<path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z"/>',
    explore: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="m13.5 8.5-2 5-2.5 1 1-2.5 5-2z"/>',
    language: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
  };
  return `<svg class="desktop-side-nav-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[key] ?? paths.home}</svg>`;
}

function siteAccountIcon(basePath: string, lang: SiteLang, key: string, href: string, label: string, dataAttribute: string): string {
  const safeLabel = escapeHtml(label);
  const safeHref = escapeHtml(appendLangToHref(withBasePath(basePath, href), lang));
  return `<a class="site-account-icon" href="${safeHref}" title="${safeLabel}" aria-label="${safeLabel}" ${dataAttribute}>${desktopSideNavIcon(key)}</a>`;
}

type AccountUiCopy = {
  login: string;
  profile: string;
  profileSuffix: string;
  settings: string;
  accountNav: string;
  notifications: string;
  markAllRead: string;
  guestNotificationEmpty: string;
};

function accountUiCopy(lang: SiteLang): AccountUiCopy {
  const copy: Record<SiteLang, AccountUiCopy> = {
    ja: {
      login: "ログイン",
      profile: "マイページ",
      profileSuffix: " のマイページ",
      settings: "設定",
      accountNav: "アカウント",
      notifications: "通知",
      markAllRead: "すべて既読",
      guestNotificationEmpty: "ログインすると通知を確認できます。",
    },
    en: {
      login: "Sign in",
      profile: "My page",
      profileSuffix: "'s page",
      settings: "Settings",
      accountNav: "Account",
      notifications: "Notifications",
      markAllRead: "Mark all read",
      guestNotificationEmpty: "Sign in to check notifications.",
    },
    es: {
      login: "Iniciar sesion",
      profile: "Mi pagina",
      profileSuffix: " - mi pagina",
      settings: "Ajustes",
      accountNav: "Cuenta",
      notifications: "Notificaciones",
      markAllRead: "Marcar leidas",
      guestNotificationEmpty: "Inicia sesion para ver notificaciones.",
    },
    "pt-BR": {
      login: "Entrar",
      profile: "Minha pagina",
      profileSuffix: " - minha pagina",
      settings: "Configuracoes",
      accountNav: "Conta",
      notifications: "Notificacoes",
      markAllRead: "Marcar como lidas",
      guestNotificationEmpty: "Entre para ver notificacoes.",
    },
  };
  return copy[lang] ?? copy.ja;
}

function siteNotificationMenu(basePath: string, lang: SiteLang): string {
  const accountCopy = accountUiCopy(lang);
  const loginHref = escapeHtml(appendLangToHref(withBasePath(basePath, "/login?redirect=/home"), lang));
  return `<div class="site-notification-menu" data-notification-menu>
    <button class="site-account-icon site-notification-button" type="button" title="${escapeHtml(accountCopy.notifications)}" aria-label="${escapeHtml(accountCopy.notifications)}" aria-expanded="false" data-account-alerts data-notification-toggle data-login-href="${loginHref}">
      ${desktopSideNavIcon("notifications")}
      <span class="site-notification-badge" data-notification-badge hidden>0</span>
    </button>
    <div class="site-notification-panel" data-notification-panel hidden>
      <div class="site-notification-head">
        <strong>${escapeHtml(accountCopy.notifications)}</strong>
        <button type="button" data-notification-read-all hidden>${escapeHtml(accountCopy.markAllRead)}</button>
        <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/home"), lang))}">${escapeHtml(accountCopy.profile)}</a>
      </div>
      <div class="site-notification-list" data-notification-list>
        <div class="site-notification-empty">${escapeHtml(accountCopy.guestNotificationEmpty)}</div>
      </div>
    </div>
  </div>`;
}

function stripLangPrefixFromPathname(pathname: string): string {
  const codes = new Set(supportedLanguages.map((language) => language.code));
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && codes.has(segments[0] as SiteLang)) {
    return `/${segments.slice(1).join("/")}` || "/";
  }
  return pathname || "/";
}

function normalizeSitePath(path: string): string {
  try {
    return stripLangPrefixFromPathname(new URL(path, "https://ikimon.local").pathname);
  } catch {
    return stripLangPrefixFromPathname(path.split("?", 1)[0] || "/");
  }
}

function normalizeSitePathWithSearch(path: string): string {
  try {
    const url = new URL(path, "https://ikimon.local");
    return `${stripLangPrefixFromPathname(url.pathname)}${url.search}`;
  } catch {
    const hashless = path.split("#", 1)[0] || "/";
    const prefixed = hashless.startsWith("/") ? hashless : `/${hashless}`;
    const [pathname, search = ""] = prefixed.split("?", 2);
    return `${stripLangPrefixFromPathname(pathname || "/")}${search ? `?${search}` : ""}`;
  }
}

function siteNavMatch(currentPath: string, normalizedPath: string, target: string): boolean {
  const targetWithSearch = normalizeSitePathWithSearch(target);
  if (targetWithSearch.includes("?")) {
    return normalizeSitePathWithSearch(currentPath) === targetWithSearch;
  }
  const targetPath = normalizeSitePath(target);
  return normalizedPath === targetPath || (targetPath !== "/" && normalizedPath.startsWith(`${targetPath}/`));
}

type SideNavPrimaryItem = {
  key: string;
  href: string;
  match: string[];
  exclude?: string[];
};

type SideNavTextItem = {
  href: string;
  label: string;
  match?: string[];
  className?: string;
};

type SideNavGroup = {
  title: string;
  items: SideNavTextItem[];
  className?: string;
  afterHtml?: string;
  /** true のとき低頻度グループとして折りたたみ表示（現在ページを含む場合は開く）。 */
  collapsible?: boolean;
};

type SideNavDirectoryCopy = {
  primaryTitle: string;
  groups: {
    guest: string;
    signedIn: string;
    personalized: string;
    find: string;
    learn: string;
    local: string;
    updates: string;
  };
  links: {
    register: string;
    login: string;
    howTo: string;
    myPage: string;
    notes: string;
    guideOutcomes: string;
    needsId: string;
    nearbyAreas: string;
    identifyQueue: string;
    taxaSearch: string;
    explore: string;
    observations: string;
    lens: string;
    guide: string;
    events: string;
    updates: string;
  };
  personalizedEmpty: string;
  legalTagline: string;
};

function sideNavDirectoryCopy(lang: SiteLang): SideNavDirectoryCopy {
  const localized: Record<SiteLang, SideNavDirectoryCopy> = {
    ja: {
      primaryTitle: "今日使う",
      groups: {
        guest: "はじめる",
        signedIn: "今日の続き",
        personalized: "フォロー中",
        find: "探す・見る",
        learn: "読み物",
        local: "地域・みんな",
        updates: "更新・連絡",
      },
      links: {
        register: "新しく登録",
        login: "ログイン",
        howTo: "使い方を見る",
        myPage: "マイページ",
        notes: "記録を見る",
        guideOutcomes: "ガイド成果",
        needsId: "名前を待つ記録",
        nearbyAreas: "近くの観察エリア",
        identifyQueue: "名前を待つ記録",
        taxaSearch: "分類群を探す",
        explore: "見つける",
        observations: "記録を見る",
        lens: "その場で見る",
        guide: "ライブガイド",
        events: "観察会",
        updates: "更新情報",
      },
      personalizedEmpty: "ログインすると、フォロー中の分類群や観察エリアをここに固定します。",
      legalTagline: "皆で作る地域図鑑",
    },
    en: {
      primaryTitle: "Daily",
      groups: {
        guest: "Start",
        signedIn: "Continue",
        personalized: "Following",
        find: "Find and view",
        learn: "Read",
        local: "Community",
        updates: "Updates and contact",
      },
      links: {
        register: "Create account",
        login: "Sign in",
        howTo: "How it works",
        myPage: "My page",
        notes: "Observation library",
        guideOutcomes: "Guide outcomes",
        needsId: "Records needing a name",
        nearbyAreas: "Nearby areas",
        identifyQueue: "Records needing a name",
        taxaSearch: "Search taxa",
        explore: "Explore",
        observations: "All observations",
        lens: "Look on site",
        guide: "Live guide",
        events: "Events",
        updates: "Updates",
      },
      personalizedEmpty: "Sign in to pin followed taxa and observation areas here.",
      legalTagline: "Regional Field Guide",
    },
    es: {
      primaryTitle: "Diario",
      groups: {
        guest: "Empezar",
        signedIn: "Continuar",
        personalized: "Siguiendo",
        find: "Buscar y ver",
        learn: "Leer",
        local: "Comunidad",
        updates: "Novedades y contacto",
      },
      links: {
        register: "Crear cuenta",
        login: "Entrar",
        howTo: "Como funciona",
        myPage: "Mi pagina",
        notes: "Biblioteca",
        guideOutcomes: "Resultados de guia",
        needsId: "Registros sin nombre",
        nearbyAreas: "Areas cercanas",
        identifyQueue: "Registros sin nombre",
        taxaSearch: "Buscar taxones",
        explore: "Explorar",
        observations: "Observaciones",
        lens: "Ver en campo",
        guide: "Guia en vivo",
        events: "Eventos",
        updates: "Novedades",
      },
      personalizedEmpty: "Entra para fijar taxones y areas de observacion.",
      legalTagline: "Guia regional",
    },
    "pt-BR": {
      primaryTitle: "Diario",
      groups: {
        guest: "Comecar",
        signedIn: "Continuar",
        personalized: "Seguindo",
        find: "Buscar e ver",
        learn: "Ler",
        local: "Comunidade",
        updates: "Novidades e contato",
      },
      links: {
        register: "Criar conta",
        login: "Entrar",
        howTo: "Como funciona",
        myPage: "Minha pagina",
        notes: "Biblioteca",
        guideOutcomes: "Resultados do guia",
        needsId: "Registros sem nome",
        nearbyAreas: "Areas proximas",
        identifyQueue: "Registros sem nome",
        taxaSearch: "Buscar taxons",
        explore: "Explorar",
        observations: "Observacoes",
        lens: "Ver no campo",
        guide: "Guia ao vivo",
        events: "Eventos",
        updates: "Novidades",
      },
      personalizedEmpty: "Entre para fixar taxons e areas de observacao.",
      legalTagline: "Guia regional",
    },
  };
  return localized[lang] ?? localized.ja;
}

function sideNavPageItems(lanes: RouteLane[], lang: SiteLang, limit = 8): SideNavTextItem[] {
  const seen = new Set<string>();
  return lanes
    .flatMap((lane) => listPagesByLane(lane))
    .filter((page) => !page.path.includes(":") && page.auth !== "admin" && page.auth !== "system")
    .filter((page) => {
      if (seen.has(page.path)) return false;
      seen.add(page.path);
      return true;
    })
    .slice(0, limit)
    .map((page) => ({ href: page.path, label: sitePageLabel(page, lang), match: [page.path] }));
}

function sideNavSelectedPageItems(lane: RouteLane, paths: string[], lang: SiteLang): SideNavTextItem[] {
  const index = new Map(paths.map((path, order) => [path, order]));
  return sideNavPageItems([lane], lang, 80)
    .filter((item) => index.has(item.href))
    .sort((a, b) => (index.get(a.href) ?? 0) - (index.get(b.href) ?? 0));
}

function renderDesktopSideNavLink(
  basePath: string,
  lang: SiteLang,
  currentPath: string,
  normalizedPath: string,
  item: SideNavPrimaryItem,
  label: string,
): string {
  const isExcluded = (item.exclude ?? []).some((path) => siteNavMatch(currentPath, normalizedPath, path));
  const isActive = !isExcluded && item.match.some((path) => siteNavMatch(currentPath, normalizedPath, path));
  const activeClass = isActive ? " is-active" : "";
  const href = escapeHtml(appendLangToHref(withBasePath(basePath, item.href), lang));
  const safeLabel = escapeHtml(label);
  const authClass = item.key === "account" ? " site-login-link" : "";
  return `<a class="desktop-side-nav-link${authClass}${activeClass}" href="${href}" title="${safeLabel}">${desktopSideNavIcon(item.key)}<span class="desktop-side-nav-label">${safeLabel}</span></a>`;
}

function renderSideNavTextLinks(basePath: string, lang: SiteLang, currentPath: string, normalizedPath: string, items: SideNavTextItem[]): string {
  return items
    .map((item) => {
      const match = item.match ?? [normalizeSitePath(item.href)];
      const isActive = match.some((path) => siteNavMatch(currentPath, normalizedPath, path));
      const activeClass = isActive ? " is-active" : "";
      const className = item.className ? ` ${item.className}` : "";
      const href = escapeHtml(appendLangToHref(withBasePath(basePath, item.href), lang));
      return `<a class="desktop-side-nav-text-link${className}${activeClass}" href="${href}">${escapeHtml(item.label)}</a>`;
    })
    .join("");
}

function renderSideNavDirectory(basePath: string, lang: SiteLang, currentPath: string, mode: "desktop" | "mobile"): string {
  const normalizedPath = normalizeSitePath(currentPath);
  const directoryCopy = sideNavDirectoryCopy(lang);
  const labels: Record<SiteLang, Record<string, string>> = {
    ja: {
      home: "ホーム",
      profile: "マイページ",
      record: "記録",
      observations: "記録を見る",
      identify: "同定",
      map: "マップ",
      notes: "記録を見る",
      guide: "ガイド",
      learn: "学ぶ",
      community: "地域",
      business: "法人",
      account: "ログイン",
    },
    en: {
      home: "Home",
      profile: "My page",
      record: "Record",
      observations: "Observations",
      identify: "Identify",
      map: "Map",
      notes: "Library",
      guide: "Guide",
      learn: "Learn",
      community: "Community",
      business: "Business",
      account: "Sign in",
    },
    es: {
      home: "Inicio",
      profile: "Mi pagina",
      record: "Registro",
      observations: "Observaciones",
      identify: "Identificar",
      map: "Mapa",
      notes: "Biblioteca",
      guide: "Guia",
      learn: "Aprender",
      community: "Comunidad",
      business: "Empresa",
      account: "Entrar",
    },
    "pt-BR": {
      home: "Inicio",
      profile: "Minha pagina",
      record: "Registrar",
      observations: "Observacoes",
      identify: "Identificar",
      map: "Mapa",
      notes: "Biblioteca",
      guide: "Guia",
      learn: "Aprender",
      community: "Comunidade",
      business: "Empresa",
      account: "Entrar",
    },
  };
  const copy = labels[lang] ?? labels.ja;
  const primaryItems: SideNavPrimaryItem[] = [
    ...(mode === "mobile" ? [{ key: "profile", href: "/profile", match: ["/profile", "/home"] }] : []),
    ...(mode === "mobile" ? [{ key: "notes", href: "/records?view=mine", match: ["/records?view=mine"] }] : []),
    { key: "home", href: "/", match: ["/"] },
    { key: "observations", href: "/records", match: ["/records", "/observations"] },
    { key: "map", href: "/map", match: ["/map"] },
    { key: "guide", href: "/guide", match: ["/guide"] },
  ];
  const personalizedLinksHtml = `<div class="desktop-side-nav-personalized-list" data-side-nav-personalized-list>
          ${renderSideNavTextLinks(basePath, lang, currentPath, normalizedPath, [
            { href: "/map", label: directoryCopy.links.nearbyAreas, match: ["/map"] },
            { href: "/records?view=needs_id", label: directoryCopy.links.identifyQueue, match: ["/records?view=needs_id"] },
            { href: "/records?view=public", label: directoryCopy.links.taxaSearch, match: ["/records?view=public"] },
          ])}
        </div>`;
  const groups: SideNavGroup[] = [
    {
      title: directoryCopy.groups.guest,
      className: "desktop-side-nav-section--guest",
      items: [
        { href: "/register?redirect=/profile", label: directoryCopy.links.register, match: ["/register"] },
        { href: "/login?redirect=/profile", label: directoryCopy.links.login, match: ["/login"] },
        { href: "/learn/field-loop", label: directoryCopy.links.howTo, match: ["/learn/field-loop"] },
      ],
    },
    {
      title: directoryCopy.groups.signedIn,
      className: "desktop-side-nav-section--signed-in",
      items: [
        { href: "/profile", label: directoryCopy.links.myPage, match: ["/profile", "/home"] },
        { href: "/records?view=mine", label: directoryCopy.links.notes, match: ["/records?view=mine"] },
        { href: "/guide/outcomes", label: directoryCopy.links.guideOutcomes, match: ["/guide/outcomes"] },
        { href: "/records?view=needs_id", label: directoryCopy.links.needsId, match: ["/records?view=needs_id"] },
      ],
    },
    {
      title: directoryCopy.groups.personalized,
      className: "desktop-side-nav-section--personalized",
      items: [],
      afterHtml: personalizedLinksHtml,
    },
    {
      title: directoryCopy.groups.find,
      items: [
        { href: "/records?view=public", label: directoryCopy.links.observations, match: ["/records?view=public"] },
        { href: "/lens", label: directoryCopy.links.lens, match: ["/lens"] },
        { href: "/community/events", label: directoryCopy.links.events, match: ["/community/events"] },
      ],
    },
    {
      title: directoryCopy.groups.learn,
      collapsible: true,
      items: sideNavSelectedPageItems(
        "learn",
        ["/learn", "/learn/field-loop", "/learn/identification-basics", "/learn/glossary", "/learn/wellbeing"],
        lang,
      ),
    },
    { title: directoryCopy.groups.local, items: sideNavPageItems(["group"], lang, 3) },
    {
      title: directoryCopy.groups.updates,
      collapsible: true,
      items: [
        { href: "/learn/updates", label: directoryCopy.links.updates, match: ["/learn/updates"] },
        ...sideNavPageItems(["trust"], lang, 8),
      ],
    },
  ];
  const rootClass = mode === "desktop" ? "desktop-side-nav-directory" : "site-mobile-menu-directory";
  const primaryClass = mode === "desktop" ? "desktop-side-nav-section desktop-side-nav-section--primary" : "site-mobile-menu-section";
  const secondaryClass = mode === "desktop" ? "desktop-side-nav-section desktop-side-nav-section--secondary" : "site-mobile-menu-section";
  const primary = `<section class="${primaryClass}">
        ${primaryItems
          .map((item) => renderDesktopSideNavLink(basePath, lang, currentPath, normalizedPath, item, copy[item.key] ?? item.key))
          .join("")}
      </section>`;
  const secondary = groups
    .map((group) => {
      const linksHtml = group.items.length
        ? `<div class="desktop-side-nav-text-links">${renderSideNavTextLinks(basePath, lang, currentPath, normalizedPath, group.items)}</div>`
        : "";
      if (group.collapsible) {
        const containsCurrent = group.items.some((item) => {
          const match = item.match ?? [normalizeSitePath(item.href)];
          return match.some((path) => siteNavMatch(currentPath, normalizedPath, path));
        });
        return `<section class="${secondaryClass}${group.className ? ` ${group.className}` : ""}">
        <details class="side-nav-collapsible"${containsCurrent ? " open" : ""}>
          <summary class="desktop-side-nav-section-title side-nav-collapsible-summary">${escapeHtml(group.title)}</summary>
          ${linksHtml}
          ${group.afterHtml ?? ""}
        </details>
      </section>`;
      }
      return `<section class="${secondaryClass}${group.className ? ` ${group.className}` : ""}">
        <h2 class="desktop-side-nav-section-title">${escapeHtml(group.title)}</h2>
        ${linksHtml}
        ${group.afterHtml ?? ""}
      </section>`;
    })
    .join("");
  const legal = `<div class="desktop-side-nav-legal">
    <span>ZUKAN</span>
    <span>${escapeHtml(directoryCopy.legalTagline)}</span>
  </div>`;
  return `<div class="${rootClass}">${primary}${secondary}${legal}</div>`;
}

function desktopSideNavLinks(basePath: string, lang: SiteLang, currentPath: string): string {
  return renderSideNavDirectory(basePath, lang, currentPath, "desktop");
}

function renderLangSwitch(currentPath: string, lang: SiteLang, availableLangs: SiteLang[], className = ""): string {
  const classes = ["lang-switch"];
  if (className) {
    classes.push(className);
  }
  const available = new Set(availableLangs);
  const switchCopy: Record<SiteLang, string> = {
    ja: "言語",
    en: "Language",
    es: "Idioma",
    "pt-BR": "Idioma",
  };

  const currentLanguage = supportedLanguages.find((language) => language.code === lang);
  const currentShortLabel = currentLanguage?.shortLabel ?? lang.toUpperCase();

  return `<div class="${classes.join(" ")}" aria-label="${escapeHtml(switchCopy[lang])}">
    <span class="lang-switch-label">${desktopSideNavIcon("language")}<span class="lang-switch-current">${escapeHtml(currentShortLabel)}</span></span>
    <div class="lang-switch-options">${supportedLanguages
    .map((language) => {
      const activeClass = language.code === lang ? " is-active" : "";
      const targetPath = available.has(language.code) ? currentPath : "/";
      const current = language.code === lang ? ` aria-current="true"` : "";
      return `<a class="lang-switch-link${activeClass}" href="${escapeHtml(appendLangToHref(targetPath, language.code))}" hreflang="${escapeHtml(language.code)}" lang="${escapeHtml(language.code)}" title="${escapeHtml(language.label)}"${current}><span class="lang-switch-code">${escapeHtml(language.shortLabel)}</span><span class="lang-switch-name">${escapeHtml(language.label)}</span></a>`;
    })
    .join("")}</div>
  </div>`;
}

function renderHeaderCoreNavigation(basePath: string, lang: SiteLang, currentPath: string, authState?: "guest" | "member"): string {
  if (!shouldRenderGlobalRecordEntry(currentPath)) return "";
  const copy = globalRecordEntryCopy(lang);
  const pathname = normalizePathname(currentPath);
  const placesHref = appendLangToHref(withBasePath(basePath, "/map?tab=places"), lang);
  const memberRecordsHref = appendLangToHref(withBasePath(basePath, "/records?view=mine"), lang);
  const memberSelfHref = appendLangToHref(withBasePath(basePath, "/profile"), lang);
  const guestRecordsHref = appendLangToHref(withBasePath(basePath, "/login?redirect=%2Frecords%3Fview%3Dmine"), lang);
  const guestSelfHref = appendLangToHref(withBasePath(basePath, "/login?redirect=%2Fprofile"), lang);
  const recordsHref = authState === "member" ? memberRecordsHref : guestRecordsHref;
  const selfHref = authState === "member" ? memberSelfHref : guestSelfHref;
  const current = (matched: boolean): string => matched ? ' aria-current="page"' : "";
  return `<nav class="site-nav site-nav-desktop site-core-nav" aria-label="${escapeHtml(copy.navLabel)}">
    <button type="button" class="site-core-nav-link is-capture" data-global-record-trigger="photo" data-kpi-event="capture_nav_tap" data-kpi-action="header_capture" aria-haspopup="dialog">${escapeHtml(copy.photo)}</button>
    <a class="site-core-nav-link" href="${escapeHtml(placesHref)}"${current(pathname === "/map" || pathname.startsWith("/map/"))}>${escapeHtml(copy.places)}</a>
    <a class="site-core-nav-link" href="${escapeHtml(recordsHref)}" data-bottom-nav-auth data-auth-guest-href="${escapeHtml(guestRecordsHref)}" data-auth-member-href="${escapeHtml(memberRecordsHref)}"${current(pathname === "/records" || pathname.startsWith("/records/") || pathname.startsWith("/observations/"))}>${escapeHtml(copy.records)}</a>
    <a class="site-core-nav-link" href="${escapeHtml(selfHref)}" data-bottom-nav-auth data-auth-guest-href="${escapeHtml(guestSelfHref)}" data-auth-member-href="${escapeHtml(memberSelfHref)}"${current(pathname === "/profile" || pathname.startsWith("/profile/"))}>${escapeHtml(copy.self)}</a>
  </nav>`;
}

function nav(basePath: string, lang: SiteLang, currentPath: string, _activeNav: string | undefined, availableLangs: SiteLang[], minimalChrome = false, homeChrome?: "guest" | "member"): string {
  const copy = shellCopyFor(lang);
  const accountCopy = accountUiCopy(lang);
  const brandMarkSrc = BRAND_ASSETS.mark192;
  const brandWordmarkSrc = BRAND_ASSETS.wordmarkBlack;
  const navLinks = renderHeaderCoreNavigation(basePath, lang, currentPath, homeChrome);
  const desktopSearch = renderSearchForm(basePath, lang, copy, "site-search-desktop", currentPath);
  const mobileSearch = renderSearchForm(basePath, lang, copy, "site-search-mobile", currentPath);
  const desktopLangSwitch = renderLangSwitch(currentPath, lang, availableLangs, "lang-switch-desktop");
  const mobileLangSwitch = renderLangSwitch(currentPath, lang, availableLangs, "lang-switch-mobile");
  const loginHref = escapeHtml(appendLangToHref(withBasePath(basePath, "/login?redirect=/profile"), lang));
  const profileHref = escapeHtml(appendLangToHref(withBasePath(basePath, "/profile"), lang));
  const myRecordsHref = escapeHtml(appendLangToHref(withBasePath(basePath, "/records?view=mine"), lang));
  const mobileQuickLabels: Record<SiteLang, { profile: string; records: string }> = {
    ja: { profile: "マイページ", records: "自分の記録" },
    en: { profile: "My page", records: "My records" },
    es: { profile: "Mi pagina", records: "Mis registros" },
    "pt-BR": { profile: "Minha pagina", records: "Meus registros" },
  };
  const mobileQuick = mobileQuickLabels[lang] ?? mobileQuickLabels.ja;
  const profileIcon = siteAccountIcon(basePath, lang, "account", "/login?redirect=/profile", accountCopy.profile, "data-account-profile");
  const notificationIcon = siteNotificationMenu(basePath, lang);
  const settingsIcon = siteAccountIcon(basePath, lang, "settings", "/login?redirect=/profile/settings", accountCopy.settings, "data-account-settings");

  if (homeChrome) {
    const homeProfileIcon = siteAccountIcon(basePath, lang, "account", "/profile", accountCopy.profile, "data-account-profile");
    return `<header class="site-header site-header-home" data-home-header data-home-auth-state="${homeChrome}">
    <div class="site-header-inner">
      <div class="site-brand-cluster">
        <a class="brand" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/"), lang))}" data-kpi-event="logo_home_tap" data-kpi-action="logo_home">
          <span class="brand-logo-lockup"><span class="brand-mark"><img src="${escapeHtml(brandMarkSrc)}" alt="" /></span><span class="brand-wordmark" aria-label="ZUKAN"><img class="brand-wordmark-img" src="${escapeHtml(brandWordmarkSrc)}" alt="" /></span></span>
        </a>
      </div>
      ${navLinks}
      <div class="home-header-actions is-guest"><a class="home-header-login" href="${loginHref}">${escapeHtml(accountCopy.login)}</a></div>
      <nav class="home-header-actions is-member" aria-label="${escapeHtml(accountCopy.accountNav)}">${notificationIcon}${homeProfileIcon}</nav>
    </div>
  </header>`;
  }

  if (minimalChrome) {
    return `<header class="site-header site-header-minimal">
    <div class="site-header-inner">
      <div class="site-brand-cluster">
        <a class="brand" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/"), lang))}" data-kpi-event="logo_home_tap" data-kpi-action="logo_home">
          <span class="brand-logo-lockup">
            <span class="brand-mark"><img src="${escapeHtml(brandMarkSrc)}" alt="" /></span>
            <span class="brand-wordmark" aria-label="ZUKAN">
              <img class="brand-wordmark-img" src="${escapeHtml(brandWordmarkSrc)}" alt="" />
            </span>
          </span>
        </a>
      </div>
      ${navLinks}
      <div class="site-header-actions site-header-actions-desktop">
        ${desktopLangSwitch}
        <a class="btn btn-solid site-login-link" href="${loginHref}">${escapeHtml(accountCopy.login)}</a>
      </div>
      <div class="site-header-actions site-header-actions-mobile">
        <a class="btn btn-solid site-login-link" href="${loginHref}">${escapeHtml(accountCopy.login)}</a>
      </div>
    </div>
  </header>`;
  }

  const desktopSideNav = desktopSideNavLinks(basePath, lang, currentPath);
  const mobileSideNav = renderSideNavDirectory(basePath, lang, currentPath, "mobile");

  return `<header class="site-header">
    <div class="site-header-inner">
      <div class="site-brand-cluster">
        <button class="desktop-side-nav-toggle" type="button" aria-label="左メニューを切り替える" aria-pressed="false" data-desktop-side-nav-toggle>
          <span class="desktop-side-nav-toggle-lines" aria-hidden="true"></span>
        </button>
        <a class="brand" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/"), lang))}" data-kpi-event="logo_home_tap" data-kpi-action="logo_home">
          <span class="brand-logo-lockup">
            <span class="brand-mark"><img src="${escapeHtml(brandMarkSrc)}" alt="" /></span>
            <span class="brand-wordmark" aria-label="ZUKAN">
              <img class="brand-wordmark-img" src="${escapeHtml(brandWordmarkSrc)}" alt="" />
            </span>
          </span>
        </a>
      </div>
      ${navLinks}
      ${desktopSearch}
      <div class="site-header-actions site-header-actions-desktop">
        ${desktopLangSwitch}
        <nav class="site-account-icons" aria-label="${escapeHtml(accountCopy.accountNav)}">${profileIcon}${notificationIcon}${settingsIcon}</nav>
      </div>
      <div class="site-header-actions site-header-actions-mobile">
        <details class="site-mobile-menu">
          <summary class="site-mobile-menu-toggle" aria-label="${escapeHtml(copy.menu)}" title="${escapeHtml(copy.menu)}">
            <span class="site-mobile-menu-icon" aria-hidden="true"></span>
          </summary>
          <div class="site-mobile-menu-panel">
            ${mobileSearch}
            <div class="site-mobile-account-row">
              <a class="site-mobile-menu-account site-login-link" href="${loginHref}">${escapeHtml(accountCopy.login)}</a>
              <nav class="site-mobile-account-actions" aria-label="${escapeHtml(accountCopy.accountNav)}">${profileIcon}${notificationIcon}${settingsIcon}</nav>
            </div>
            <div class="site-mobile-return-links" aria-label="${escapeHtml(accountCopy.accountNav)}">
              <a class="site-mobile-return-link" href="${profileHref}">${desktopSideNavIcon("profile")}<span>${escapeHtml(mobileQuick.profile)}</span></a>
              <a class="site-mobile-return-link" href="${myRecordsHref}">${desktopSideNavIcon("notes")}<span>${escapeHtml(mobileQuick.records)}</span></a>
            </div>
            <nav class="site-nav site-nav-mobile">${mobileSideNav}</nav>
            <div class="site-mobile-menu-meta">
              ${mobileLangSwitch}
            </div>
          </div>
        </details>
      </div>
    </div>
  </header>
  <aside class="desktop-side-nav" aria-label="PC primary navigation">
    <nav class="desktop-side-nav-inner">${desktopSideNav}</nav>
  </aside>`;
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

function operatorStatement(lang: SiteLang): string {
  const copy: Record<SiteLang, string> = {
    ja: "ZUKANはIKIMON株式会社が運営しています。現在はzukan.earthで提供しています。",
    en: "ZUKAN is operated by IKIMON Inc. and is currently available at zukan.earth.",
    es: "ZUKAN es operado por IKIMON Inc. y actualmente se ofrece en zukan.earth.",
    "pt-BR": "O ZUKAN é operado pela IKIMON Inc. e atualmente está disponível em zukan.earth.",
  };
  return copy[lang];
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
            <span class="brand-mark"><img src="${BRAND_ASSETS.mark192}" alt="ZUKAN symbol" /></span>
            <span>
              <strong>ZUKAN</strong>
              <small>${escapeHtml(copy.footer.tagline)}</small>
            </span>
          </div>
            <div class="footer-kicker">生きものを楽しむ。暮らしを楽しむ。</div>
            <h2>小さな発見を、<br>観察レコードへ。</h2>
            <p>身近な生きものを見つけ、記録し、対象ごとの観察レコードへ育て、また歩くための生物多様性プラットフォーム。個人の発見を、地域や企業の次のアクションにつなげる。</p>
            <div class="footer-actions">
              <a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}">${escapeHtml(copy.record)}</a>
              <a class="btn btn-ghost-on-dark" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">読み物を見る</a>
            </div>
          </div>
          <p class="footer-operator">${escapeHtml(operatorStatement(lang))}</p>
          <div class="footer-chip-row" aria-label="ZUKAN の価値">
            <span>名前が分からなくても残せる</span>
            <span>公開範囲を安全側で制御</span>
            <span>学校・研究・企業活動へ接続</span>
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
            <p>散歩、通学路、旅先、庭先。どこから始めても、記録はあとから対象ごとの観察レコードへ育てられる。</p>
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
        <span>ZUKAN｜皆で作る地域図鑑</span>
        <span><a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn/updates"), lang))}">${escapeHtml(copy.footer.learnLinks.updates)}</a>・<a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/contact"), lang))}">${escapeHtml(copy.footer.trustLinks.contact)}</a></span>
      </div>
    </div>
  </footer>`;
}

function normalizePathname(path: string): string {
  try {
    return stripLangPrefixFromPathname(new URL(path, "https://ikimon.local").pathname);
  } catch {
    return stripLangPrefixFromPathname(path.split("?")[0] || "/");
  }
}

function shouldRenderGlobalRecordEntry(currentPath: string): boolean {
  const pathname = normalizePathname(currentPath);
  return !(
    pathname === "/guide" ||
    (pathname.startsWith("/guide/") && pathname !== "/guide/outcomes") ||
    pathname === "/record" ||
    pathname.startsWith("/record/") ||
    pathname === "/debug" ||
    pathname.startsWith("/debug/") ||
    pathname === "/login" ||
    pathname === "/register"
  );
}

function isReadingSurface(currentPath: string): boolean {
  const pathname = normalizePathname(currentPath);
  if (pathname.startsWith("/observations/")) {
    return true;
  }
  return (getSiteShellLayoutForPath(currentPath) ?? fallbackSiteShellLayoutKind(currentPath)) === "reading";
}

function fallbackSiteShellLayoutKind(currentPath: string): SiteShellLayoutKind {
  const pathname = normalizePathname(currentPath);
  if (pathname === "/") {
    return "home";
  }
  if (pathname === "/record" || pathname === "/login" || pathname === "/register" || pathname === "/profile/settings") {
    return "narrow";
  }
  if (
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/learn" ||
    pathname.startsWith("/learn/") ||
    pathname === "/about" ||
    pathname === "/faq" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/contact"
  ) {
    return "reading";
  }
  if (
    pathname === "/records" ||
    pathname === "/observations" ||
    pathname.startsWith("/observations/") ||
    pathname === "/community" ||
    pathname === "/for-business" ||
    pathname === "/guide"
  ) {
    return "wide";
  }
  return "standard";
}

function siteShellLayoutKind(currentPath: string, shellClassName: string): SiteShellLayoutKind {
  if (/\b(?:shell-map|shell-notes-library|shell-immersive)\b/.test(shellClassName)) {
    return "immersive";
  }
  return getSiteShellLayoutForPath(currentPath) ?? fallbackSiteShellLayoutKind(currentPath);
}

type GlobalRecordEntryCopy = {
  navLabel: string;
  photo: string;
  photoMode: string;
  captureAria: string;
  places: string;
  records: string;
  self: string;
  video: string;
  gallery: string;
  guide: string;
  sheetLabel: string;
  sheetTitle: string;
  sheetHelp: string;
  close: string;
  previewAlt: string;
  empty: string;
  trayZero: string;
  trayHelp: string;
  actionLabel: string;
  start: string;
  capture: string;
  trimTitle: string;
  trimStart: string;
  trimEnd: string;
  errorTitle: string;
  errorBody: string;
  permissionBody: string;
  retry: string;
  cancel: string;
};

function globalRecordEntryCopy(lang: SiteLang): GlobalRecordEntryCopy {
  type LegacyCopy = Omit<GlobalRecordEntryCopy, "navLabel" | "photo" | "photoMode" | "captureAria" | "places" | "records" | "self" | "gallery" | "errorTitle" | "errorBody" | "permissionBody" | "retry" | "cancel">;
  const copy: Record<SiteLang, LegacyCopy> = {
    ja: {
      video: "動画",
      guide: "ガイド",
      sheetLabel: "撮影して記録する",
      sheetTitle: "撮影して記録",
      sheetHelp: "",
      close: "閉じる",
      previewAlt: "撮影プレビュー",
      empty: "カメラを起動すると、ここにプレビューが出ます。",
      trayZero: "写真0枚",
      trayHelp: "最大6枚まで同じ記録にまとめます",
      actionLabel: "撮影操作",
      start: "カメラを起動",
      capture: "撮影する",
      trimTitle: "記録に残す最大60秒を選ぶ",
      trimStart: "開始",
      trimEnd: "終了",
    },
    en: {
      video: "Video",
      guide: "Guide",
      sheetLabel: "Capture and record",
      sheetTitle: "Capture a record",
      sheetHelp: "Pick one main subject. The surroundings can also become useful clues.",
      close: "Close",
      previewAlt: "Capture preview",
      empty: "Start the camera to see a preview here.",
      trayZero: "0 photos",
      trayHelp: "Keep up to 6 photos in the same record",
      actionLabel: "Capture actions",
      start: "Start camera",
      capture: "Capture",
      trimTitle: "Choose up to 60 seconds",
      trimStart: "Start",
      trimEnd: "End",
    },
    es: {
      video: "Video",
      guide: "Guia",
      sheetLabel: "Capturar y registrar",
      sheetTitle: "Captura un registro",
      sheetHelp: "Elige un sujeto principal. El entorno tambien puede servir como pista.",
      close: "Cerrar",
      previewAlt: "Vista previa",
      empty: "Inicia la camara para ver la vista previa aqui.",
      trayZero: "0 fotos",
      trayHelp: "Agrupa hasta 6 fotos en el mismo registro",
      actionLabel: "Acciones de captura",
      start: "Iniciar camara",
      capture: "Capturar",
      trimTitle: "Elige hasta 60 segundos",
      trimStart: "Inicio",
      trimEnd: "Fin",
    },
    "pt-BR": {
      video: "Video",
      guide: "Guia",
      sheetLabel: "Capturar e registrar",
      sheetTitle: "Capture um registro",
      sheetHelp: "Escolha um sujeito principal. O entorno tambem pode virar pista.",
      close: "Fechar",
      previewAlt: "Previa da captura",
      empty: "Inicie a camera para ver a previa aqui.",
      trayZero: "0 fotos",
      trayHelp: "Agrupe ate 6 fotos no mesmo registro",
      actionLabel: "Acoes de captura",
      start: "Iniciar camera",
      capture: "Capturar",
      trimTitle: "Escolha ate 60 segundos",
      trimStart: "Inicio",
      trimEnd: "Fim",
    },
  };
  const bottomNav = getShortCopy<{
    ariaLabel: string;
    capture: string;
    captureAria: string;
    places: string;
    records: string;
    self: string;
  }>(lang, "shared", "bottomNav");
  const cameraCapture = getShortCopy<{
    photo: string;
    video: string;
    errorTitle: string;
    errorBody: string;
    permissionBody: string;
    retry: string;
    gallery: string;
    cancel: string;
  }>(lang, "shared", "cameraCapture");
  return {
    ...(copy[lang] ?? copy.ja),
    navLabel: bottomNav.ariaLabel,
    photo: bottomNav.capture,
    photoMode: cameraCapture.photo,
    video: cameraCapture.video,
    captureAria: bottomNav.captureAria,
    places: bottomNav.places,
    records: bottomNav.records,
    self: bottomNav.self,
    gallery: cameraCapture.gallery,
    errorTitle: cameraCapture.errorTitle,
    errorBody: cameraCapture.errorBody,
    permissionBody: cameraCapture.permissionBody,
    retry: cameraCapture.retry,
    cancel: cameraCapture.cancel,
  };
}

function globalRecordEntry(basePath: string, lang: SiteLang, currentPath: string, authState?: "guest" | "member"): string {
  if (!shouldRenderGlobalRecordEntry(currentPath)) {
    return "";
  }
  const copy = globalRecordEntryCopy(lang);
  const pathname = normalizePathname(currentPath);
  const placesHref = appendLangToHref(withBasePath(basePath, "/map?tab=places"), lang);
  const memberRecordsHref = appendLangToHref(withBasePath(basePath, "/records?view=mine"), lang);
  const memberSelfHref = appendLangToHref(withBasePath(basePath, "/profile"), lang);
  const guestRecordsHref = appendLangToHref(withBasePath(basePath, "/login?redirect=%2Frecords%3Fview%3Dmine"), lang);
  const guestSelfHref = appendLangToHref(withBasePath(basePath, "/login?redirect=%2Fprofile"), lang);
  const recordsHref = authState === "member" ? memberRecordsHref : guestRecordsHref;
  const selfHref = authState === "member" ? memberSelfHref : guestSelfHref;
  const placesCurrent = pathname === "/map" || pathname.startsWith("/map/");
  const recordsCurrent = pathname === "/records" || pathname.startsWith("/records/") || pathname.startsWith("/observations/");
  const selfCurrent = pathname === "/profile" || pathname.startsWith("/profile/");
  return `<nav class="global-record-launcher" aria-label="${escapeHtml(copy.navLabel)}">
    <input class="global-record-input" data-global-record-input="gallery" type="file" accept="image/*" multiple hidden />
    <button type="button" class="global-record-choice is-primary" data-global-record-trigger="photo" data-kpi-event="capture_nav_tap" data-kpi-action="capture_nav" aria-haspopup="dialog" aria-label="${escapeHtml(copy.captureAria)}">
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg></span>
      <span>${escapeHtml(copy.photo)}</span>
    </button>
    <a class="global-record-choice${placesCurrent ? " is-active" : ""}" href="${escapeHtml(placesHref)}"${placesCurrent ? ' aria-current="page"' : ""}>
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></svg></span>
      <span>${escapeHtml(copy.places)}</span>
    </a>
    <a class="global-record-choice${recordsCurrent ? " is-active" : ""}" href="${escapeHtml(recordsHref)}" data-bottom-nav-auth data-auth-guest-href="${escapeHtml(guestRecordsHref)}" data-auth-member-href="${escapeHtml(memberRecordsHref)}"${recordsCurrent ? ' aria-current="page"' : ""}>
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg></span>
      <span>${escapeHtml(copy.records)}</span>
    </a>
    <a class="global-record-choice${selfCurrent ? " is-active" : ""}" href="${escapeHtml(selfHref)}" data-bottom-nav-auth data-auth-guest-href="${escapeHtml(guestSelfHref)}" data-auth-member-href="${escapeHtml(memberSelfHref)}"${selfCurrent ? ' aria-current="page"' : ""}>
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.6-4 3-6 7-6s6.4 2 7 6"/></svg></span>
      <span>${escapeHtml(copy.self)}</span>
    </a>
  </nav>
  <div class="global-record-camera-backdrop" data-global-record-camera-close hidden></div>
  <section class="global-record-camera-sheet" data-global-record-camera-sheet hidden aria-label="${escapeHtml(copy.sheetLabel)}">
    <div class="global-record-camera-head">
      <div>
        <strong data-global-record-camera-title>${escapeHtml(copy.sheetTitle)}</strong>
        <p data-global-record-camera-help>${escapeHtml(copy.sheetHelp)}</p>
        <div class="global-record-camera-modes" aria-label="${escapeHtml(copy.actionLabel)}">
          <button type="button" data-global-record-trigger="photo" data-global-record-mode="photo" aria-pressed="true">${escapeHtml(copy.photoMode)}</button>
          <button type="button" data-global-record-trigger="video" data-global-record-mode="video" aria-pressed="false">${escapeHtml(copy.video)}</button>
        </div>
      </div>
      <button type="button" class="global-record-camera-close" data-global-record-camera-close aria-label="${escapeHtml(copy.close)}">×</button>
    </div>
    <div class="global-record-camera-preview" data-global-record-camera-preview>
      <video data-global-record-camera-video playsinline muted></video>
      <img data-global-record-camera-image alt="${escapeHtml(copy.previewAlt)}" hidden />
      <div class="global-record-camera-empty" data-global-record-camera-empty>${escapeHtml(copy.empty)}</div>
      <div class="global-record-camera-zoom" data-global-record-camera-zoom hidden>
        <label>
          <span>ズーム <output data-global-record-camera-zoom-value>1.0x</output></span>
          <input data-global-record-camera-zoom-range type="range" min="1" max="1" step="0.1" value="1" />
        </label>
        <button type="button" data-global-record-camera-zoom-max>最大</button>
        <label class="global-record-camera-focus" data-global-record-camera-focus hidden>
          <span>手動ピント <output data-global-record-camera-focus-value>--</output></span>
          <input data-global-record-camera-focus-range type="range" min="0" max="1" step="0.01" value="0" />
        </label>
        <button type="button" data-global-record-camera-focus-auto hidden>AF</button>
      </div>
    </div>
    <div class="global-record-photo-tray" data-global-record-photo-tray hidden>
      <div class="global-record-photo-tray-head">
        <strong data-global-record-photo-tray-count>${escapeHtml(copy.trayZero)}</strong>
        <span>${escapeHtml(copy.trayHelp)}</span>
      </div>
      <div class="global-record-photo-grid" data-global-record-photo-grid></div>
    </div>
    <div class="global-record-camera-actions" aria-label="${escapeHtml(copy.actionLabel)}">
      <button type="button" class="global-record-camera-action is-primary" data-global-record-camera-start>${escapeHtml(copy.start)}</button>
      <button type="button" class="global-record-camera-action" data-global-record-camera-capture hidden>${escapeHtml(copy.capture)}</button>
    </div>
    <button type="button" class="global-record-gallery-select" data-global-record-gallery-select>${escapeHtml(copy.gallery)}</button>
    <div class="global-record-camera-error" data-global-record-camera-error role="alert" hidden>
      <strong>${escapeHtml(copy.errorTitle)}</strong>
      <p data-global-record-camera-error-body>${escapeHtml(copy.errorBody)}</p>
      <div>
        <button type="button" data-global-record-camera-retry>${escapeHtml(copy.retry)}</button>
        <button type="button" data-global-record-gallery-select>${escapeHtml(copy.gallery)}</button>
        <button type="button" data-global-record-camera-cancel>${escapeHtml(copy.cancel)}</button>
      </div>
    </div>
    <div class="global-record-camera-status" data-global-record-camera-status aria-live="polite"></div>
    <div class="global-record-video-trim" data-global-record-video-trim hidden>
      <div class="global-record-video-trim-head">
        <strong>${escapeHtml(copy.trimTitle)}</strong>
        <span data-global-record-video-trim-duration>0.0秒</span>
      </div>
      <div class="global-record-video-trim-controls">
        <label>
          <span>${escapeHtml(copy.trimStart)} <output data-global-record-video-trim-start-label>0.0秒</output></span>
          <input data-global-record-video-trim-start type="range" min="0" max="0" step="0.1" value="0" />
        </label>
        <label>
          <span>${escapeHtml(copy.trimEnd)} <output data-global-record-video-trim-end-label>0.0秒</output></span>
          <input data-global-record-video-trim-end type="range" min="0" max="0" step="0.1" value="0" />
        </label>
      </div>
    </div>
  </section>`;
}

function globalRecordEntryScript(basePath: string, lang: SiteLang): string {
  const cameraCopy = globalRecordEntryCopy(lang);
  const recordTargets = {
    photo: appendLangToHref(withBasePath(basePath, "/record?start=photo"), lang),
    video: appendLangToHref(withBasePath(basePath, "/record?start=video"), lang),
    gallery: appendLangToHref(withBasePath(basePath, "/record?start=gallery"), lang),
  };
  return `<script>
(function () {
  const BASE_PATH = ${JSON.stringify(basePath.replace(/\/$/, ""))};
  const CAMERA_COPY = ${JSON.stringify(cameraCopy)};
  const RECORD_TARGETS = ${JSON.stringify(recordTargets)};
  const DB_NAME = 'ikimon-record-draft';
  const STORE_NAME = 'drafts';
  const GUEST_DRAFT_TOKEN_KEY = 'ikimon:record-draft-guest-token-v1';
  const MAX_PHOTO_DRAFT_FILES = 6;
  const PHOTO_UPLOAD_MAX_EDGE = 2560;
  const PHOTO_UPLOAD_JPEG_QUALITY = 0.88;
  const PHOTO_UPLOAD_CONCURRENCY = 2;
  const CAMERA_PHOTO_IDEAL_WIDTH = 2560;
  const CAMERA_PHOTO_IDEAL_HEIGHT = 1920;
  const CAMERA_VIDEO_IDEAL_WIDTH = 1280;
  const CAMERA_VIDEO_IDEAL_HEIGHT = 720;
  const VIDEO_MAX_SECONDS = 60;
  let activeKind = '';
  let activeStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let discardRecording = false;
  let recordingStartedAt = 0;
  let recordingTimer = null;
  let directPostInFlight = false;
  let latestCaptureLocation = null;
  let latestCaptureLocationAt = 0;
  let captureLocationRequest = null;
  let photoDraftRetryDetailId = '';
  let photoDraftRetryVisitId = '';
  let photoDraftRetryHasUploadedPhoto = false;
  let photoDraftSubmitConfirmUntil = 0;
  let cameraStartInFlight = false;
  let cameraRequestId = 0;
  let cameraZoomTrack = null;
  let cameraZoomMin = 1;
  let cameraZoomMax = 1;
  let cameraZoomStep = 0.1;
  let cameraZoomCurrent = 1;
  let cameraFocusTrack = null;
  let cameraFocusMin = 0;
  let cameraFocusMax = 1;
  let cameraFocusStep = 0.01;
  let cameraFocusCurrent = 0;
  let cameraFocusAutoMode = '';
  let cameraPinchStartDistance = 0;
  let cameraPinchStartZoom = 1;
  let cameraPinchActive = false;
  const cameraPreviewPointers = new Map();
  const visitIdFromObservationTargetId = (targetId) => {
    const value = String(targetId || '').trim();
    const match = value.match(/^occ:([^:]+):\d+$/);
    return match && match[1] ? match[1] : value;
  };
  const normalizeSavedObservationVisitId = (json, fallbackId) => {
    const visitId = json && typeof json.visitId === 'string' ? json.visitId.trim() : '';
    if (visitId) return visitId;
    return visitIdFromObservationTargetId(fallbackId);
  };
  const normalizeSavedObservationTargetId = (json, fallbackId) => {
    const occurrenceId = json && typeof json.occurrenceId === 'string' ? json.occurrenceId.trim() : '';
    if (occurrenceId) return occurrenceId;
    const occurrenceIds = json && Array.isArray(json.occurrenceIds) ? json.occurrenceIds : [];
    const firstOccurrenceId = occurrenceIds.map((id) => String(id || '').trim()).find(Boolean) || '';
    if (firstOccurrenceId) return firstOccurrenceId;
    const visitId = json && typeof json.visitId === 'string' ? json.visitId.trim() : '';
    if (visitId) return visitId;
    return String(fallbackId || '').trim();
  };
  const formatPhotoUploadFailureReason = (error) => {
    const message = String(error || '').trim();
    if (!message) return '写真の通信確認に失敗しました。';
    if (message === 'observation_not_found' || message.indexOf('observation not found:') === 0 || message === 'observation_not_owned') {
      return '保存した記録への写真の紐づけを確認できませんでした。';
    }
    if (isDatabaseTemporarilyUnavailable(message)) {
      return '保存先の準備が一時的に追いついていません。写真はこの画面に残しています。少し待ってもう一度押してください。';
    }
    if (message === 'Internal Server Error' || message === 'internal_server_error' || /^5\d\d$/.test(message)) {
      return '保存先で一時的なエラーが起きました。写真はこの画面に残しています。少し待ってもう一度試してください。';
    }
    return message;
  };
  const isDatabaseTemporarilyUnavailable = (message) => {
    const text = String(message || '');
    return text.indexOf('57P03') >= 0
      || text.indexOf('データベースシステムはまだ接続を受け付けていません') >= 0
      || text.toLowerCase().indexOf('database system is starting up') >= 0
      || text.toLowerCase().indexOf('database system is not yet accepting connections') >= 0;
  };
  const formatRecordSaveFailureReason = (error) => {
    const message = String(error || '').trim();
    if (!message || message === 'observation_upsert_failed') {
      return '記録の保存に失敗しました。写真はこの画面に残しています。通信状態を確認してもう一度試してください。';
    }
    if (isDatabaseTemporarilyUnavailable(message)) {
      return '保存先の準備が一時的に追いついていません。写真はこの画面に残しています。少し待ってもう一度押してください。';
    }
    if (message === 'Internal Server Error' || message === 'internal_server_error' || /^5\d\d$/.test(message)) {
      return '保存先で一時的なエラーが起きました。写真はこの画面に残しています。少し待ってもう一度試してください。';
    }
    return message;
  };
  let capturedReviewFile = null;
  let capturedPhotoFiles = [];
  let capturedPhotoObjectUrls = [];
  let capturedReviewMeta = null;
  let reviewObjectUrl = '';
  let sheetVideoTrimState = null;
  let sheetOpenedAt = 0;
  let capturePressedAt = 0;
  const sheet = document.querySelector('[data-global-record-camera-sheet]');
  const backdrop = document.querySelector('[data-global-record-camera-close].global-record-camera-backdrop');
  const cameraPreview = document.querySelector('[data-global-record-camera-preview]');
  const cameraVideo = document.querySelector('[data-global-record-camera-video]');
  const cameraImage = document.querySelector('[data-global-record-camera-image]');
  const empty = document.querySelector('[data-global-record-camera-empty]');
  const title = document.querySelector('[data-global-record-camera-title]');
  const help = document.querySelector('[data-global-record-camera-help]');
  const status = document.querySelector('[data-global-record-camera-status]');
  const photoTray = document.querySelector('[data-global-record-photo-tray]');
  const photoTrayCount = document.querySelector('[data-global-record-photo-tray-count]');
  const photoGrid = document.querySelector('[data-global-record-photo-grid]');
  const startButton = document.querySelector('[data-global-record-camera-start]');
  const captureButton = document.querySelector('[data-global-record-camera-capture]');
  const cameraError = document.querySelector('[data-global-record-camera-error]');
  const cameraErrorBody = document.querySelector('[data-global-record-camera-error-body]');
  const cameraRetryButton = document.querySelector('[data-global-record-camera-retry]');
  const cameraCancelButton = document.querySelector('[data-global-record-camera-cancel]');
  const zoomWrap = document.querySelector('[data-global-record-camera-zoom]');
  const zoomRange = document.querySelector('[data-global-record-camera-zoom-range]');
  const zoomValue = document.querySelector('[data-global-record-camera-zoom-value]');
  const zoomMaxButton = document.querySelector('[data-global-record-camera-zoom-max]');
  const focusWrap = document.querySelector('[data-global-record-camera-focus]');
  const focusRange = document.querySelector('[data-global-record-camera-focus-range]');
  const focusValue = document.querySelector('[data-global-record-camera-focus-value]');
  const focusAutoButton = document.querySelector('[data-global-record-camera-focus-auto]');
  const trimWrap = document.querySelector('[data-global-record-video-trim]');
  const trimStart = document.querySelector('[data-global-record-video-trim-start]');
  const trimEnd = document.querySelector('[data-global-record-video-trim-end]');
  const trimStartLabel = document.querySelector('[data-global-record-video-trim-start-label]');
  const trimEndLabel = document.querySelector('[data-global-record-video-trim-end-label]');
  const trimDurationLabel = document.querySelector('[data-global-record-video-trim-duration]');
  const labels = {
    photo: {
      title: '写真を撮る',
      help: '',
      start: 'カメラを起動',
      capture: '写真を撮る',
    },
    video: {
      title: '動画を撮る',
      help: '',
      start: 'カメラを起動',
      capture: '録画開始',
    },
  };
  const apiPath = (path) => BASE_PATH + path;
  const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
  const durationSince = (startedAt) => Math.max(0, Math.round(nowMs() - Number(startedAt || 0)));
  const requestCaptureLocation = (forceFresh = false) => {
    if (captureLocationRequest) return captureLocationRequest;
    const cacheAgeMs = Date.now() - Number(latestCaptureLocationAt || 0);
    if (!forceFresh && latestCaptureLocation && cacheAgeMs >= 0 && cacheAgeMs <= 15000) {
      return Promise.resolve(latestCaptureLocation);
    }
    if (!(navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function')) {
      return Promise.resolve(null);
    }
    captureLocationRequest = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = Number(position && position.coords && position.coords.latitude);
          const longitude = Number(position && position.coords && position.coords.longitude);
          latestCaptureLocation = Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { latitude, longitude, accuracy: Number(position.coords.accuracy) || null }
            : null;
          latestCaptureLocationAt = latestCaptureLocation ? Date.now() : 0;
          resolve(latestCaptureLocation);
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: forceFresh ? 0 : 15000 },
      );
    }).finally(() => {
      captureLocationRequest = null;
    });
    return captureLocationRequest;
  };
  const sendGlobalRecordKpi = (metricName, durationMs, metadata) => {
    try {
      const payload = {
        eventName: 'funnel_step',
        pagePath: location.pathname + location.search,
        routeKey: 'global_record_capture',
        actionKey: String(metricName || 'global_record_metric').slice(0, 128),
        metadata: Object.assign({
          funnel: 'global_record_capture_latency',
          metricName,
          durationMs: Math.round(Number(durationMs) || 0),
          kind: activeKind || '',
          photoCount: selectedPhotoDraftFiles().length,
          lang: document.documentElement.lang || 'ja',
          ts: new Date().toISOString(),
        }, metadata || {}),
      };
      fetch(apiPath('/api/v1/ui-kpi/events'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => undefined);
      if (window.ikimonExternalAnalytics && typeof window.ikimonExternalAnalytics.track === 'function') {
        window.ikimonExternalAnalytics.track(payload.eventName, payload);
      }
    } catch (_) {}
  };
  const sendGlobalRecordEvent = (eventName, actionKey, metadata) => {
    try {
      const payload = {
        eventName: String(eventName || 'ui_action').slice(0, 64),
        pagePath: location.pathname + location.search,
        routeKey: 'global_record_capture',
        actionKey: String(actionKey || eventName || 'global_record_action').slice(0, 128),
        metadata: Object.assign({
          kind: activeKind || '',
          lang: document.documentElement.lang || 'ja',
          ts: new Date().toISOString(),
        }, metadata || {}),
      };
      fetch(apiPath('/api/v1/ui-kpi/events'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => undefined);
      if (window.ikimonExternalAnalytics && typeof window.ikimonExternalAnalytics.track === 'function') {
        window.ikimonExternalAnalytics.track(payload.eventName, payload);
      }
    } catch (_) {}
  };
  const sendGlobalRecordErrorKpi = (actionKey, message, metadata) => {
    try {
      const payload = {
        eventName: 'funnel_error',
        pagePath: location.pathname + location.search,
        routeKey: 'global_record_capture',
        actionKey: String(actionKey || 'global_record_error').slice(0, 128),
        metadata: Object.assign({
          funnel: 'global_record_capture_latency',
          error: String(message || 'unknown_error').slice(0, 160),
          kind: activeKind || '',
          photoCount: selectedPhotoDraftFiles().length,
          lang: document.documentElement.lang || 'ja',
          ts: new Date().toISOString(),
        }, metadata || {}),
      };
      fetch(apiPath('/api/v1/ui-kpi/events'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => undefined);
      if (window.ikimonExternalAnalytics && typeof window.ikimonExternalAnalytics.track === 'function') {
        window.ikimonExternalAnalytics.track(payload.eventName, payload);
      }
    } catch (_) {}
  };
  const cameraVideoConstraints = () => activeKind === 'video'
    ? {
        facingMode: { ideal: 'environment' },
        width: { ideal: CAMERA_VIDEO_IDEAL_WIDTH },
        height: { ideal: CAMERA_VIDEO_IDEAL_HEIGHT },
      }
    : {
        facingMode: { ideal: 'environment' },
        width: { ideal: CAMERA_PHOTO_IDEAL_WIDTH },
        height: { ideal: CAMERA_PHOTO_IDEAL_HEIGHT },
      };
  const openDraftDb = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('indexeddb_unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
  });
  const secureGuestDraftToken = () => {
    if (!(window.crypto && typeof window.crypto.getRandomValues === 'function')) {
      throw new Error('secure_random_unavailable');
    }
    if (typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  };
  const guestDraftToken = () => {
    let token = '';
    try {
      token = String(sessionStorage.getItem(GUEST_DRAFT_TOKEN_KEY) || '');
      if (!token) {
        token = secureGuestDraftToken();
        sessionStorage.setItem(GUEST_DRAFT_TOKEN_KEY, token);
      }
    } catch (_) {
      token = secureGuestDraftToken();
    }
    return token.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96);
  };
  const draftOwnerContext = async () => {
    try {
      const userId = await getCurrentSessionUserId();
      return { draftKey: 'latest:user:' + userId, ownerKey: 'user:' + userId, continuationToken: '' };
    } catch (_) {
      const token = guestDraftToken();
      return { draftKey: 'latest:guest:' + token, ownerKey: 'guest:' + token, continuationToken: token };
    }
  };
  const saveDraft = async (draft) => {
    const context = await draftOwnerContext();
    const draftKey = context.draftKey;
    const storedDraft = Object.assign({}, draft, {
      ownerKey: context.ownerKey,
      continuationToken: context.continuationToken || null,
    });
    const db = await openDraftDb();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(storedDraft, draftKey);
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error || new Error('indexeddb_write_failed'));
      });
      if (window.ikimonAppOutbox && typeof window.ikimonAppOutbox.enqueue === 'function') {
        window.ikimonAppOutbox.enqueue({
          id: 'record:' + draftKey,
          source: 'record',
          kind: 'draft',
          sourceId: draftKey,
          status: 'queued',
          payloadMeta: {
            kind: storedDraft && storedDraft.kind || null,
            fileCount: storedDraft && Array.isArray(storedDraft.files) ? storedDraft.files.length : (storedDraft && storedDraft.file ? 1 : 0),
            savedAt: storedDraft && storedDraft.savedAt || Date.now()
          }
        }).catch(() => undefined);
      }
      return context;
    } finally {
      db.close();
    }
  };
  const setStatus = (message) => {
    if (status) status.textContent = message || '';
  };
  const hideCameraError = () => {
    if (cameraError) cameraError.hidden = true;
    if (sheet) sheet.removeAttribute('data-camera-error');
  };
  const showCameraError = (permissionDenied) => {
    stopActiveStream();
    if (cameraErrorBody) cameraErrorBody.textContent = permissionDenied ? CAMERA_COPY.permissionBody : CAMERA_COPY.errorBody;
    if (cameraError) cameraError.hidden = false;
    if (sheet) sheet.setAttribute('data-camera-error', 'true');
    if (startButton) {
      startButton.hidden = true;
      startButton.disabled = false;
    }
    if (captureButton) captureButton.hidden = true;
    setFooterActionMode('start');
    setStatus('');
  };
  const escapeStatusHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] || char);
  const setStatusHtml = (html) => {
    if (status) status.innerHTML = html || '';
  };
  const savedRecordActionsHtml = (message) => {
    const lang = document.documentElement && document.documentElement.lang ? document.documentElement.lang : 'ja';
    const langPrefix = lang && lang !== 'ja' ? '/' + encodeURIComponent(lang) : '';
    const labels = {
      ja: { records: '自分の記録', profile: 'マイページ', map: '地図' },
      en: { records: 'My records', profile: 'My page', map: 'Map' },
      es: { records: 'Mis registros', profile: 'Mi pagina', map: 'Mapa' },
      'pt-BR': { records: 'Meus registros', profile: 'Minha pagina', map: 'Mapa' },
    };
    const copy = labels[lang] || labels.ja;
    const recordsHref = BASE_PATH + langPrefix + '/records?view=mine&source=record_saved';
    const profileHref = BASE_PATH + langPrefix + '/profile?source=record_saved';
    const mapHref = BASE_PATH + langPrefix + '/map?tab=places&source=record_saved';
    return '<span class="global-record-saved-text">' + escapeStatusHtml(message || '') + '</span>'
      + '<span class="global-record-saved-actions">'
      + '<a href="' + recordsHref + '" data-global-record-saved-action="records">' + escapeStatusHtml(copy.records) + '</a>'
      + '<a href="' + profileHref + '" data-global-record-saved-action="profile">' + escapeStatusHtml(copy.profile) + '</a>'
      + '<a href="' + mapHref + '" data-global-record-saved-action="map">' + escapeStatusHtml(copy.map) + '</a>'
      + '</span>';
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const formatZoom = (value) => {
    const number = Number(value);
    return (Number.isFinite(number) ? number : 1).toFixed(1) + 'x';
  };
  const syncVisualViewportVars = () => {
    if (!document.documentElement) return;
    const viewport = window.visualViewport;
    const layoutWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const layoutHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const left = viewport ? Math.max(0, viewport.offsetLeft || 0) : 0;
    const right = viewport ? Math.max(0, layoutWidth - ((viewport.offsetLeft || 0) + (viewport.width || layoutWidth))) : 0;
    const top = viewport ? Math.max(0, viewport.offsetTop || 0) : 0;
    const bottom = viewport ? Math.max(0, layoutHeight - ((viewport.offsetTop || 0) + (viewport.height || layoutHeight))) : 0;
    const height = viewport ? Math.max(320, viewport.height || layoutHeight) : layoutHeight;
    document.documentElement.style.setProperty('--global-record-visual-left', left.toFixed(1) + 'px');
    document.documentElement.style.setProperty('--global-record-visual-right', right.toFixed(1) + 'px');
    document.documentElement.style.setProperty('--global-record-visual-top', top.toFixed(1) + 'px');
    document.documentElement.style.setProperty('--global-record-visual-bottom', bottom.toFixed(1) + 'px');
    document.documentElement.style.setProperty('--global-record-visual-height', height.toFixed(1) + 'px');
  };
  const resetVisualViewportVars = () => {
    document.documentElement.style.removeProperty('--global-record-visual-left');
    document.documentElement.style.removeProperty('--global-record-visual-right');
    document.documentElement.style.removeProperty('--global-record-visual-top');
    document.documentElement.style.removeProperty('--global-record-visual-bottom');
    document.documentElement.style.removeProperty('--global-record-visual-height');
  };
  const setCameraLiveLayout = (enabled) => {
    if (!sheet) return;
    if (enabled) {
      sheet.setAttribute('data-camera-active', 'true');
      syncVisualViewportVars();
    } else {
      sheet.removeAttribute('data-camera-active');
    }
  };
  const resetCameraZoomUi = () => {
    cameraZoomTrack = null;
    cameraZoomMin = 1;
    cameraZoomMax = 1;
    cameraZoomStep = 0.1;
    cameraZoomCurrent = 1;
    cameraFocusTrack = null;
    cameraFocusMin = 0;
    cameraFocusMax = 1;
    cameraFocusStep = 0.01;
    cameraFocusCurrent = 0;
    cameraFocusAutoMode = '';
    cameraPinchStartDistance = 0;
    cameraPinchStartZoom = 1;
    cameraPinchActive = false;
    cameraPreviewPointers.clear();
    if (zoomWrap) zoomWrap.hidden = true;
    if (zoomRange) {
      zoomRange.min = '1';
      zoomRange.max = '1';
      zoomRange.step = '0.1';
      zoomRange.value = '1';
    }
    if (zoomValue) zoomValue.textContent = '1.0x';
    if (zoomMaxButton) zoomMaxButton.disabled = true;
    if (focusWrap) focusWrap.hidden = true;
    if (focusRange) {
      focusRange.min = '0';
      focusRange.max = '1';
      focusRange.step = '0.01';
      focusRange.value = '0';
    }
    if (focusValue) focusValue.textContent = '--';
    if (focusAutoButton) {
      focusAutoButton.hidden = true;
      focusAutoButton.disabled = true;
    }
  };
  const updateCameraZoomUi = (value) => {
    cameraZoomCurrent = clamp(Number(value) || cameraZoomMin, cameraZoomMin, cameraZoomMax);
    if (zoomRange) zoomRange.value = String(cameraZoomCurrent);
    if (zoomValue) zoomValue.textContent = formatZoom(cameraZoomCurrent);
  };
  const applyCameraZoom = async (value) => {
    if (!cameraZoomTrack || !cameraZoomTrack.applyConstraints) return;
    const next = clamp(Number(value) || cameraZoomMin, cameraZoomMin, cameraZoomMax);
    updateCameraZoomUi(next);
    try {
      await cameraZoomTrack.applyConstraints({ advanced: [{ zoom: next }] });
    } catch (_) {}
  };
  const formatFocus = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || cameraFocusMax <= cameraFocusMin) return '--';
    const percent = Math.round(((number - cameraFocusMin) / (cameraFocusMax - cameraFocusMin)) * 100);
    return String(clamp(percent, 0, 100)) + '%';
  };
  const updateCameraFocusUi = (value) => {
    cameraFocusCurrent = clamp(Number(value) || cameraFocusMin, cameraFocusMin, cameraFocusMax);
    if (focusRange) focusRange.value = String(cameraFocusCurrent);
    if (focusValue) focusValue.textContent = formatFocus(cameraFocusCurrent);
  };
  const applyCameraFocusDistance = async (value) => {
    if (!cameraFocusTrack || !cameraFocusTrack.applyConstraints) return;
    const next = clamp(Number(value) || cameraFocusMin, cameraFocusMin, cameraFocusMax);
    updateCameraFocusUi(next);
    const manualConstraint = { focusDistance: next };
    const capabilities = cameraFocusTrack.getCapabilities ? cameraFocusTrack.getCapabilities() : {};
    const modes = Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [];
    if (modes.indexOf('manual') >= 0) manualConstraint.focusMode = 'manual';
    try {
      await cameraFocusTrack.applyConstraints({ advanced: [manualConstraint] });
      setStatus('手動ピントを調整しました。');
    } catch (_) {}
  };
  const restoreCameraAutoFocus = async () => {
    if (!cameraFocusTrack || !cameraFocusTrack.applyConstraints || !cameraFocusAutoMode) return;
    try {
      await cameraFocusTrack.applyConstraints({ advanced: [{ focusMode: cameraFocusAutoMode }] });
      setStatus(cameraFocusAutoMode === 'continuous' ? '自動ピントに戻しました。' : 'AFを1回実行しました。');
    } catch (_) {}
  };
  const setupCameraZoom = async (stream) => {
    resetCameraZoomUi();
    const track = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
    const capabilities = track && track.getCapabilities ? track.getCapabilities() : null;
    const zoom = capabilities && capabilities.zoom ? capabilities.zoom : null;
    if (!track) return;
    const settings = track.getSettings ? track.getSettings() : {};
    let hasControl = false;
    if (zoom && Number.isFinite(Number(zoom.max)) && Number(zoom.max) > 1) {
      cameraZoomTrack = track;
      cameraZoomMin = Number.isFinite(Number(zoom.min)) ? Number(zoom.min) : 1;
      cameraZoomMax = Number(zoom.max);
      cameraZoomStep = Number.isFinite(Number(zoom.step)) && Number(zoom.step) > 0 ? Number(zoom.step) : 0.1;
      cameraZoomCurrent = clamp(Number(settings.zoom) || cameraZoomMin, cameraZoomMin, cameraZoomMax);
      if (zoomRange) {
        zoomRange.min = String(cameraZoomMin);
        zoomRange.max = String(cameraZoomMax);
        zoomRange.step = String(cameraZoomStep);
        zoomRange.value = String(cameraZoomCurrent);
      }
      updateCameraZoomUi(cameraZoomCurrent);
      if (zoomMaxButton) zoomMaxButton.disabled = false;
      hasControl = true;
    }
    const focusDistance = capabilities && capabilities.focusDistance ? capabilities.focusDistance : null;
    const focusModes = capabilities && Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [];
    if (focusDistance && Number.isFinite(Number(focusDistance.max)) && Number(focusDistance.max) > Number(focusDistance.min ?? 0)) {
      cameraFocusTrack = track;
      cameraFocusMin = Number.isFinite(Number(focusDistance.min)) ? Number(focusDistance.min) : 0;
      cameraFocusMax = Number(focusDistance.max);
      cameraFocusStep = Number.isFinite(Number(focusDistance.step)) && Number(focusDistance.step) > 0 ? Number(focusDistance.step) : Math.max(0.01, (cameraFocusMax - cameraFocusMin) / 100);
      cameraFocusCurrent = clamp(Number(settings.focusDistance) || cameraFocusMin, cameraFocusMin, cameraFocusMax);
      cameraFocusAutoMode = focusModes.indexOf('continuous') >= 0 ? 'continuous' : (focusModes.indexOf('single-shot') >= 0 ? 'single-shot' : '');
      if (focusRange) {
        focusRange.min = String(cameraFocusMin);
        focusRange.max = String(cameraFocusMax);
        focusRange.step = String(cameraFocusStep);
        focusRange.value = String(cameraFocusCurrent);
      }
      updateCameraFocusUi(cameraFocusCurrent);
      if (focusWrap) focusWrap.hidden = false;
      if (focusAutoButton) {
        focusAutoButton.hidden = !cameraFocusAutoMode;
        focusAutoButton.disabled = !cameraFocusAutoMode;
      }
      hasControl = true;
    }
    if (zoomWrap) zoomWrap.hidden = !hasControl;
  };
  const cameraPinchDistance = () => {
    const points = Array.from(cameraPreviewPointers.values());
    if (points.length < 2) return 0;
    const [a, b] = points;
    return Math.hypot(Number(a.x || 0) - Number(b.x || 0), Number(a.y || 0) - Number(b.y || 0));
  };
  const updateCameraPinchZoom = () => {
    if (!cameraZoomTrack || cameraZoomMax <= cameraZoomMin) return;
    const distance = cameraPinchDistance();
    if (!distance || !cameraPinchStartDistance) return;
    const ratio = distance / cameraPinchStartDistance;
    void applyCameraZoom(cameraPinchStartZoom * ratio);
  };
  const applyCameraFocusAt = async (clientX, clientY) => {
    const track = cameraZoomTrack || (activeStream && activeStream.getVideoTracks ? activeStream.getVideoTracks()[0] : null);
    if (!track || !track.applyConstraints || !cameraPreview) return false;
    const rect = cameraPreview.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const point = {
      x: clamp((Number(clientX) - rect.left) / rect.width, 0, 1),
      y: clamp((Number(clientY) - rect.top) / rect.height, 0, 1),
    };
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    const modes = Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [];
    const attempts = [];
    if (modes.indexOf('single-shot') >= 0) attempts.push({ focusMode: 'single-shot', pointsOfInterest: [point] });
    attempts.push({ pointsOfInterest: [point] });
    if (modes.indexOf('continuous') >= 0) attempts.push({ focusMode: 'continuous', pointsOfInterest: [point] });
    for (const constraint of attempts) {
      try {
        await track.applyConstraints({ advanced: [constraint] });
        if (focusValue) focusValue.textContent = 'AF';
        setStatus('タップした位置にフォーカスを合わせました。');
        return true;
      } catch (_) {}
    }
    return false;
  };
  const photoDraftSubmitLabel = () => {
    const count = selectedPhotoDraftFiles().length;
    return count > 0 ? 'この' + String(count) + '枚を記録' : '写真を撮る';
  };
  const resetPhotoDraftSubmitConfirm = () => {
    photoDraftSubmitConfirmUntil = 0;
    if (captureButton && activeKind === 'photo' && selectedPhotoDraftFiles().length > 0 && !activeStream && !directPostInFlight) {
      captureButton.textContent = photoDraftSubmitLabel();
    }
  };
  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
  const sha256Hex = async (value) => {
    if (!(window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined')) return '';
    const bytes = new TextEncoder().encode(String(value || ''));
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };
  const mapWithConcurrency = async (items, limit, worker) => {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index], index);
      }
    }));
    return results;
  };
  const canvasToJpegDataUrl = (canvas, quality) => new Promise((resolve) => {
    if (!canvas || typeof canvas.toBlob !== 'function') {
      resolve(canvas.toDataURL('image/jpeg', quality));
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(canvas.toDataURL('image/jpeg', quality));
        return;
      }
      readFileAsDataUrl(blob).then(resolve).catch(() => resolve(canvas.toDataURL('image/jpeg', quality)));
    }, 'image/jpeg', quality);
  });
  const loadImageElementForUpload = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('photo_decode_failed'));
    };
    image.src = url;
  });
  const loadImageForUpload = async (file) => {
    const createBitmap = typeof window.createImageBitmap === 'function'
      ? window.createImageBitmap.bind(window)
      : (typeof createImageBitmap === 'function' ? createImageBitmap : null);
    if (createBitmap) {
      try {
        return await createBitmap(file, { imageOrientation: 'from-image' });
      } catch (_) {
        try {
          return await createBitmap(file);
        } catch (_) {
          // Fall back to HTMLImageElement decoding below.
        }
      }
    }
    return await loadImageElementForUpload(file);
  };
  const preparePhotoUpload = async (file) => {
    const originalType = String(file && file.type || 'image/jpeg').toLowerCase();
    if (originalType === 'image/gif') {
      return {
        filename: file.name || 'upload.gif',
        mimeType: originalType,
        base64Data: await readFileAsDataUrl(file),
      };
    }
    try {
      const image = await loadImageForUpload(file);
      const width = Number(image.naturalWidth || image.width || 0);
      const height = Number(image.naturalHeight || image.height || 0);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('photo_decode_failed');
      const scale = Math.min(1, PHOTO_UPLOAD_MAX_EDGE / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('photo_canvas_unavailable');
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      if (image && typeof image.close === 'function') image.close();
      const base64Data = await canvasToJpegDataUrl(canvas, PHOTO_UPLOAD_JPEG_QUALITY);
      const safeName = String(file.name || 'upload.jpg').replace(/\.[A-Za-z0-9]+$/, '') || 'upload';
      return {
        filename: safeName + '.jpg',
        mimeType: 'image/jpeg',
        base64Data,
        facePrivacy: { detector: 'server_async_face_privacy', status: 'pending', faceCount: 0, error: null },
      };
    } catch (_) {
      return {
        filename: file.name || 'upload.jpg',
        mimeType: file.type || 'image/jpeg',
        base64Data: await readFileAsDataUrl(file),
        facePrivacy: { detector: 'server_async_face_privacy', status: 'pending', faceCount: 0, error: 'photo_canvas_fallback' },
      };
    }
  };
  const getCurrentSessionUserId = async () => {
    const response = await fetch(apiPath('/api/v1/auth/session'), {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'include',
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.ok || !json.session || !json.session.userId) {
      throw new Error('session_required');
    }
    return String(json.session.userId);
  };
  const withDraftParams = (href, kind, source, continuationToken) => {
    let target = String(href || '/record?start=' + encodeURIComponent(kind || 'gallery'));
    const recoverySource = ['location_denied', 'login_required', 'draft_restore', 'media_retry', 'upload_failed', 'global_capture'].includes(String(source || ''))
      ? String(source)
      : 'draft_restore';
    try {
      const url = new URL(target, window.location.origin);
      url.searchParams.set('draft', '1');
      url.searchParams.set('source', recoverySource);
      if (continuationToken) url.searchParams.set('draft_token', String(continuationToken));
      return url.pathname + url.search + url.hash;
    } catch (_) {
      const separator = target.indexOf('?') >= 0 ? '&' : '?';
      return target + separator + 'draft=1&source=' + encodeURIComponent(recoverySource)
        + (continuationToken ? '&draft_token=' + encodeURIComponent(String(continuationToken)) : '');
    }
  };
  const stopRecordingTimer = () => {
    if (recordingTimer) window.clearInterval(recordingTimer);
    recordingTimer = null;
  };
  const formatVideoSeconds = (seconds) => {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return '0.0秒';
    return value.toFixed(1) + '秒';
  };
  const resetSheetVideoTrim = () => {
    sheetVideoTrimState = null;
    if (trimWrap) trimWrap.hidden = true;
    if (trimStart) {
      trimStart.max = '0';
      trimStart.value = '0';
    }
    if (trimEnd) {
      trimEnd.max = '0';
      trimEnd.value = '0';
    }
    if (trimStartLabel) trimStartLabel.textContent = '0.0秒';
    if (trimEndLabel) trimEndLabel.textContent = '0.0秒';
    if (trimDurationLabel) trimDurationLabel.textContent = '0.0秒';
  };
  const syncSheetVideoTrim = (changed) => {
    if (!sheetVideoTrimState || !trimStart || !trimEnd) return;
    const duration = Number(sheetVideoTrimState.duration || 0);
    let start = Number(trimStart.value);
    let end = Number(trimEnd.value);
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end)) end = Math.min(duration, VIDEO_MAX_SECONDS);
    start = Math.max(0, Math.min(start, Math.max(0, duration - 0.1)));
    end = Math.max(0.1, Math.min(end, duration));
    if (end <= start + 0.2) {
      if (changed === 'start') end = Math.min(duration, start + 0.2);
      else start = Math.max(0, end - 0.2);
    }
    if (end - start > VIDEO_MAX_SECONDS) {
      if (changed === 'start') end = Math.min(duration, start + VIDEO_MAX_SECONDS);
      else start = Math.max(0, end - VIDEO_MAX_SECONDS);
    }
    sheetVideoTrimState.start = start;
    sheetVideoTrimState.end = end;
    trimStart.value = String(start);
    trimEnd.value = String(end);
    if (trimStartLabel) trimStartLabel.textContent = formatVideoSeconds(start);
    if (trimEndLabel) trimEndLabel.textContent = formatVideoSeconds(end);
    if (trimDurationLabel) trimDurationLabel.textContent = formatVideoSeconds(end - start);
    if (cameraVideo && Math.abs(Number(cameraVideo.currentTime || 0) - start) > 0.4) {
      cameraVideo.currentTime = start;
    }
  };
  const setPhotoDraftLayout = (enabled) => {
    if (!sheet) return;
    if (enabled) sheet.setAttribute('data-photo-draft', 'true');
    else sheet.removeAttribute('data-photo-draft');
  };
  const setSheetKind = (kind) => {
    if (!sheet) return;
    if (kind) sheet.setAttribute('data-active-kind', kind);
    else sheet.removeAttribute('data-active-kind');
    document.querySelectorAll('[data-global-record-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', button.getAttribute('data-global-record-mode') === kind ? 'true' : 'false');
    });
  };
  const setPrimaryAction = (button, enabled) => {
    if (!button) return;
    if (enabled) button.classList.add('is-primary');
    else button.classList.remove('is-primary');
  };
  const setFooterActionMode = (mode) => {
    if (mode === 'submit') {
      setPrimaryAction(startButton, false);
      setPrimaryAction(captureButton, true);
      return;
    }
    if (mode === 'capture') {
      setPrimaryAction(startButton, false);
      setPrimaryAction(captureButton, true);
      return;
    }
    setPrimaryAction(startButton, true);
    setPrimaryAction(captureButton, false);
  };
  const clearReview = () => {
    setPhotoDraftLayout(false);
    photoDraftSubmitConfirmUntil = 0;
    capturedReviewFile = null;
    capturedPhotoFiles = [];
    capturedPhotoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    capturedPhotoObjectUrls = [];
    photoDraftRetryDetailId = '';
    photoDraftRetryVisitId = '';
    photoDraftRetryHasUploadedPhoto = false;
    capturedReviewMeta = null;
    resetSheetVideoTrim();
    if (photoTray) photoTray.hidden = true;
    if (photoGrid) photoGrid.innerHTML = '';
    if (photoTrayCount) photoTrayCount.textContent = '写真0枚';
    if (reviewObjectUrl) {
      URL.revokeObjectURL(reviewObjectUrl);
      reviewObjectUrl = '';
    }
    if (cameraImage) {
      cameraImage.hidden = true;
      cameraImage.removeAttribute('src');
    }
    if (cameraVideo) {
      cameraVideo.removeAttribute('src');
      cameraVideo.controls = false;
      cameraVideo.muted = true;
      cameraVideo.loop = false;
      cameraVideo.load();
    }
  };
  const stopActiveStream = () => {
    stopRecordingTimer();
    resetCameraZoomUi();
    setCameraLiveLayout(false);
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      discardRecording = true;
      try { mediaRecorder.stop(); } catch (_) {}
    }
    mediaRecorder = null;
    recordedChunks = [];
    if (activeStream) activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
    if (cameraVideo) {
      cameraVideo.pause();
      cameraVideo.srcObject = null;
    }
    if (empty) empty.hidden = false;
    if (captureButton) captureButton.hidden = true;
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = false;
    }
  };
  const normalizeDraftFiles = (files) => (Array.isArray(files) ? files : [files]).filter((file) => file instanceof File);
  const selectedPhotoDraftFiles = () => capturedPhotoFiles.filter((file) => file instanceof File);
  const renderPhotoTray = () => {
    const files = selectedPhotoDraftFiles();
    if (photoTray) photoTray.hidden = files.length === 0;
    if (photoTrayCount) photoTrayCount.textContent = '写真' + String(files.length) + '枚';
    if (photoGrid) {
      photoGrid.innerHTML = '';
      files.forEach((file, index) => {
        const cell = document.createElement('div');
        cell.className = 'global-record-photo-cell';
        const img = document.createElement('img');
        const url = capturedPhotoObjectUrls[index] || URL.createObjectURL(file);
        capturedPhotoObjectUrls[index] = url;
        img.src = url;
        img.alt = '撮影写真 ' + String(index + 1);
        const badge = document.createElement('span');
        badge.textContent = String(index + 1);
        const controls = document.createElement('div');
        controls.className = 'global-record-photo-cell-actions';
        const left = document.createElement('button');
        left.type = 'button';
        left.textContent = '←';
        left.setAttribute('aria-label', '前へ移動');
        left.setAttribute('data-global-record-photo-move', String(index));
        left.setAttribute('data-direction', '-1');
        left.disabled = index === 0;
        const right = document.createElement('button');
        right.type = 'button';
        right.textContent = '→';
        right.setAttribute('aria-label', '後ろへ移動');
        right.setAttribute('data-global-record-photo-move', String(index));
        right.setAttribute('data-direction', '1');
        right.disabled = index === files.length - 1;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', '写真を外す');
        remove.setAttribute('data-global-record-photo-remove', String(index));
        controls.appendChild(left);
        controls.appendChild(right);
        controls.appendChild(remove);
        cell.appendChild(img);
        cell.appendChild(badge);
        cell.appendChild(controls);
        photoGrid.appendChild(cell);
      });
    }
  };
  const syncPhotoDraftControls = (message) => {
    const files = selectedPhotoDraftFiles();
    const [primaryFile] = files;
    capturedReviewFile = primaryFile || null;
    photoDraftSubmitConfirmUntil = 0;
    renderPhotoTray();
    setPhotoDraftLayout(files.length > 0 && activeKind === 'photo' && !activeStream);
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = files.length >= MAX_PHOTO_DRAFT_FILES;
      startButton.textContent = files.length >= MAX_PHOTO_DRAFT_FILES ? '最大6枚です' : (files.length > 0 ? 'もう1枚撮る' : 'カメラを起動');
    }
    if (captureButton) {
      captureButton.hidden = files.length === 0;
      captureButton.disabled = false;
      captureButton.textContent = photoDraftSubmitLabel();
    }
    if (files.length > 0) {
      setFooterActionMode('submit');
    } else {
      setFooterActionMode('start');
    }
    if (files.length === 0) {
      if (cameraImage) {
        cameraImage.hidden = true;
        cameraImage.removeAttribute('src');
      }
      if (empty) {
        empty.textContent = '写真を追加すると、ここにプレビューが出ます。';
        empty.hidden = false;
      }
    }
    if (message) setStatus(message);
  };
  const movePhotoDraft = (index, direction) => {
    const from = Number(index);
    const to = from + Number(direction);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= capturedPhotoFiles.length || to >= capturedPhotoFiles.length) return;
    const [file] = capturedPhotoFiles.splice(from, 1);
    capturedPhotoFiles.splice(to, 0, file);
    const [url] = capturedPhotoObjectUrls.splice(from, 1);
    capturedPhotoObjectUrls.splice(to, 0, url);
    syncPhotoDraftControls('写真の順番を変更しました。');
  };
  const removePhotoDraft = (index) => {
    const target = Number(index);
    if (!Number.isInteger(target) || target < 0 || target >= capturedPhotoFiles.length) return;
    capturedPhotoFiles.splice(target, 1);
    const [url] = capturedPhotoObjectUrls.splice(target, 1);
    if (url) URL.revokeObjectURL(url);
    if (capturedPhotoFiles.length === 0) {
      photoDraftRetryDetailId = '';
      photoDraftRetryVisitId = '';
      photoDraftRetryHasUploadedPhoto = false;
    }
    syncPhotoDraftControls(capturedPhotoFiles.length > 0 ? '写真を外しました。' : '写真をすべて外しました。');
  };
  const keepOnlyPhotoDraftIndexes = (indexes) => {
    const keep = new Set(indexes.map((index) => Number(index)).filter((index) => Number.isInteger(index) && index >= 0));
    const nextFiles = [];
    const nextUrls = [];
    capturedPhotoFiles.forEach((file, index) => {
      const url = capturedPhotoObjectUrls[index] || '';
      if (keep.has(index)) {
        nextFiles.push(file);
        nextUrls.push(url);
      } else if (url) {
        URL.revokeObjectURL(url);
      }
    });
    capturedPhotoFiles = nextFiles;
    capturedPhotoObjectUrls = nextUrls;
    capturedReviewFile = nextFiles[0] || null;
  };
  const resetPhotoDraftAfterDirectPost = (message) => {
    capturedReviewFile = null;
    capturedPhotoFiles = [];
    capturedPhotoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    capturedPhotoObjectUrls = [];
    photoDraftRetryDetailId = '';
    photoDraftRetryVisitId = '';
    photoDraftRetryHasUploadedPhoto = false;
    capturedReviewMeta = null;
    renderPhotoTray();
    setPhotoDraftLayout(false);
    if (cameraImage) {
      cameraImage.hidden = true;
      cameraImage.removeAttribute('src');
    }
    if (cameraVideo) cameraVideo.hidden = true;
    if (empty) {
      empty.textContent = '続けて写真を撮れます。';
      empty.hidden = false;
    }
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = false;
      startButton.textContent = '次の写真を撮る';
    }
    if (captureButton) {
      captureButton.hidden = true;
      captureButton.disabled = false;
      captureButton.textContent = '写真を撮る';
    }
    setFooterActionMode('start');
    setStatusHtml(savedRecordActionsHtml(message));
  };
  const directPostPhotoDraft = async () => {
    if (directPostInFlight) return;
    const files = selectedPhotoDraftFiles();
    if (!files.length) return;
    const directPostStartedAt = nowMs();
    directPostInFlight = true;
    if (captureButton) {
      captureButton.disabled = true;
      captureButton.textContent = '記録中...';
    }
    if (startButton) startButton.disabled = true;
    const metadata = capturedReviewMeta || {};
    if (!photoDraftRetryDetailId && !photoDraftRetryVisitId && !(metadata.location && Number.isFinite(Number(metadata.location.latitude)) && Number.isFinite(Number(metadata.location.longitude)))) {
      setStatus('撮影地点を確認しています...');
      const resolvedLocation = await requestCaptureLocation(true) || metadata.location;
      if (resolvedLocation) {
        metadata.location = resolvedLocation;
        metadata.locationPending = false;
      }
    }
    if (!photoDraftRetryDetailId && !photoDraftRetryVisitId && !(metadata.location && Number.isFinite(Number(metadata.location.latitude)) && Number.isFinite(Number(metadata.location.longitude)))) {
      setStatus('位置情報を取得できなかったため、写真を保持して記録画面へ移動します。');
      await navigateWithDraft(files, 'photo', metadata, 'location_denied');
      return;
    }
    try {
      setStatus('写真を記録用に整えています...');
      let preparedCount = 0;
      const prepareStartedAt = nowMs();
      const totalInputBytes = files.reduce((sum, file) => sum + Number(file && file.size || 0), 0);
      const preparedUploads = await mapWithConcurrency(files, PHOTO_UPLOAD_CONCURRENCY, async (file) => {
        const filePrepareStartedAt = nowMs();
        const upload = await preparePhotoUpload(file);
        sendGlobalRecordKpi('photo_prepare_file_ms', durationSince(filePrepareStartedAt), {
          fileSizeBytes: Number(file && file.size || 0),
          outputBytesApprox: String(upload.base64Data || '').length,
        });
        const hash = await sha256Hex(upload.base64Data);
        preparedCount += 1;
        setStatus('写真を記録用に整えています... ' + String(preparedCount) + '/' + String(files.length));
        return {
          upload,
          hash: hash || [upload.filename, upload.mimeType, String(file && file.size || 0)].join(':'),
        };
      });
      const uploads = preparedUploads.map((item) => item.upload);
      const uploadHashes = preparedUploads.map((item) => item.hash);
      sendGlobalRecordKpi('photo_prepare_ms', durationSince(prepareStartedAt), {
        fileCount: files.length,
        totalInputBytes,
        totalOutputBytesApprox: uploads.reduce((sum, upload) => sum + String(upload.base64Data || '').length, 0),
        concurrency: PHOTO_UPLOAD_CONCURRENCY,
      });
      let detailId = photoDraftRetryDetailId;
      let photoUploadTargetId = photoDraftRetryVisitId || photoDraftRetryDetailId;
      if (!detailId) {
        const location = metadata.location || null;
        if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
          throw new Error('location_required');
        }
        const userId = await getCurrentSessionUserId();
        const observedAt = String(metadata.capturedAt || new Date().toISOString());
        const submissionSeed = [
          userId,
          observedAt,
          Number(location.latitude).toFixed(6),
          Number(location.longitude).toFixed(6),
          uploadHashes.join(','),
        ].join('|');
        const clientSubmissionId = 'global-photo:' + ((await sha256Hex(submissionSeed)) || String(Date.now()));
        const observationId = 'record-' + Date.now();
        setStatus('記録を保存しています...');
        const upsertStartedAt = nowMs();
        const observationResponse = await fetch(apiPath('/api/v1/observations/upsert'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            observationId,
            legacyObservationId: observationId,
            clientSubmissionId,
            userId,
            observedAt,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            prefecture: '',
            municipality: '',
            localityNote: '',
            note: '',
            visitMode: 'manual',
            completeChecklistFlag: false,
            sourcePayload: {
              source: 'global_photo_tray',
              record_mode: 'quick',
              quick_capture_state: 'present',
              media_count: files.length,
              subject_inference: 'ai',
              client_submission_id: clientSubmissionId,
              client_photo_sha256s: uploadHashes,
            },
            taxon: null,
          }),
        });
        const observationJson = await observationResponse.json().catch(() => ({}));
        sendGlobalRecordKpi('observation_upsert_ms', durationSince(upsertStartedAt), {
          status: observationResponse.status,
          ok: Boolean(observationResponse.ok && observationJson.ok),
          fileCount: files.length,
        });
        if (!observationResponse.ok || !observationJson.ok) {
          throw new Error(observationJson.message || observationJson.error || observationJson.code || String(observationResponse.status || '') || 'observation_upsert_failed');
        }
        photoUploadTargetId = normalizeSavedObservationVisitId(observationJson, observationId);
        detailId = normalizeSavedObservationTargetId(observationJson, photoUploadTargetId || observationId);
        if (!detailId) {
          throw new Error('observation_target_missing');
        }
        photoDraftRetryDetailId = detailId;
        photoDraftRetryVisitId = photoUploadTargetId || visitIdFromObservationTargetId(detailId);
      }
      if (!photoUploadTargetId) {
        photoUploadTargetId = photoDraftRetryVisitId || visitIdFromObservationTargetId(detailId);
      }
      const retryHadUploadedPhoto = photoDraftRetryHasUploadedPhoto;
      let completedUploads = 0;
      setStatus('写真を保存しています... 0/' + String(uploads.length));
      const uploadBatchStartedAt = nowMs();
      const uploadResults = await mapWithConcurrency(uploads, PHOTO_UPLOAD_CONCURRENCY, async (upload, index) => {
        let photoResponse = null;
        let photoJson = {};
        const uploadStartedAt = nowMs();
        try {
          photoResponse = await fetch(apiPath('/api/v1/observations/' + encodeURIComponent(photoUploadTargetId) + '/photos/upload'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              filename: upload.filename,
              mimeType: upload.mimeType,
              base64Data: upload.base64Data,
              mediaRole: !retryHadUploadedPhoto && index === 0 ? 'primary_subject' : 'context',
              facePrivacy: upload.facePrivacy || null,
            }),
          });
          photoJson = await photoResponse.json().catch(() => ({}));
        } catch (error) {
          sendGlobalRecordErrorKpi('photo_upload_failed', String(error && error.message || 'photo_upload_network_failed'), {
            durationMs: durationSince(uploadStartedAt),
            index,
          });
          return {
            index,
            error: formatPhotoUploadFailureReason(error && error.message || 'photo_upload_network_failed'),
          };
        } finally {
          completedUploads += 1;
          setStatus('写真を保存しています... ' + String(completedUploads) + '/' + String(uploads.length));
        }
        sendGlobalRecordKpi('photo_upload_ms', durationSince(uploadStartedAt), {
          status: photoResponse ? photoResponse.status : 0,
          ok: Boolean(photoResponse && photoResponse.ok && photoJson.ok),
          index,
          fileCount: uploads.length,
        });
        if (!photoResponse.ok || !photoJson.ok) {
          return {
            index,
            error: formatPhotoUploadFailureReason(photoJson.error || photoResponse.status || 'photo_upload_failed'),
          };
        }
        return { index };
      });
      const failedUploads = uploadResults.filter((item) => item && item.error);
      const uploadedIndexes = uploadResults.filter((item) => item && !item.error).map((item) => item.index);
      sendGlobalRecordKpi('photo_upload_batch_ms', durationSince(uploadBatchStartedAt), {
        fileCount: uploads.length,
        succeeded: uploadedIndexes.length,
        failed: failedUploads.length,
        concurrency: PHOTO_UPLOAD_CONCURRENCY,
      });
      if (uploadedIndexes.length > 0) {
        photoDraftRetryHasUploadedPhoto = true;
      }
      if (failedUploads.length > 0) {
        keepOnlyPhotoDraftIndexes(failedUploads.map((item) => item.index));
        syncPhotoDraftControls();
        const saved = uploadedIndexes.length;
        const failed = failedUploads.length;
        const reason = failedUploads[0] && failedUploads[0].error ? ' 理由: ' + formatPhotoUploadFailureReason(failedUploads[0].error) : '';
        if (captureButton) captureButton.textContent = '失敗した' + String(failed) + '枚を再送';
        setStatus('記録本体は保存済みです。写真は' + String(uploads.length) + '枚中' + String(saved) + '枚を確認できました。失敗した写真は残しています。もう一度押すと同じ記録に再送します。' + reason);
        return;
      }
      resetPhotoDraftAfterDirectPost('記録を保存しました。AIが写真を見て主役と周囲を整理します。続けて撮れます。');
      sendGlobalRecordEvent('capture_saved', 'capture_saved', { mediaType: 'photo', fileCount: uploads.length });
      sendGlobalRecordKpi('direct_post_total_ms', durationSince(directPostStartedAt), {
        fileCount: uploads.length,
        detailId,
      });
    } catch (error) {
      sendGlobalRecordErrorKpi('direct_post_failed', error && error.message ? String(error.message) : 'direct_post_failed', {
        durationMs: durationSince(directPostStartedAt),
        fileCount: files.length,
      });
      throw error;
    } finally {
      directPostInFlight = false;
      if (startButton) startButton.disabled = false;
      if (captureButton && selectedPhotoDraftFiles().length > 0 && captureButton.textContent === '記録中...') {
        captureButton.textContent = photoDraftSubmitLabel();
      }
    }
  };
  const addPhotoDraftFiles = (files, metadata) => {
    const incoming = normalizeDraftFiles(files).filter((file) => file.type && file.type.indexOf('image/') === 0);
    if (!incoming.length) return;
    const available = Math.max(0, MAX_PHOTO_DRAFT_FILES - capturedPhotoFiles.length);
    const accepted = incoming.slice(0, available);
    capturedPhotoFiles = capturedPhotoFiles.concat(accepted);
    const [primaryFile] = capturedPhotoFiles;
    capturedReviewFile = primaryFile || null;
    if (!capturedReviewMeta && metadata) capturedReviewMeta = metadata;
    renderPhotoTray();
    if (reviewObjectUrl) {
      URL.revokeObjectURL(reviewObjectUrl);
      reviewObjectUrl = '';
    }
    if (cameraImage) {
      cameraImage.hidden = true;
      cameraImage.removeAttribute('src');
    }
    if (cameraVideo) cameraVideo.hidden = true;
    if (empty) empty.hidden = true;
    syncPhotoDraftControls();
    const dropped = incoming.length - accepted.length;
    setStatus((metadata && metadata.location ? '撮影地点も保存しました。' : '位置を確認しています。') + ' 写真' + String(capturedPhotoFiles.length) + '枚。右で記録、左でもう1枚撮れます。' + (dropped > 0 ? ' 上限を超えた分は外しました。' : ''));
  };
  const navigateWithDraft = async (files, kind, metadata, source) => {
    const href = RECORD_TARGETS[kind] || RECORD_TARGETS.photo;
    const draftFiles = normalizeDraftFiles(files);
    const metadataValue = metadata && typeof metadata === 'object' ? metadata : {};
    const recoverySource = source || (kind === 'photo' && !metadataValue.location ? 'location_denied' : 'draft_restore');
    const metadataWithRole = Object.assign({}, metadataValue, {
      mediaRole: kind === 'video' ? 'sound_motion' : 'primary_subject',
      recoverySource,
    });
    try {
      const [primaryDraftFile = null] = draftFiles;
      const draftContext = await saveDraft({ file: primaryDraftFile, files: draftFiles, kind, savedAt: Date.now(), metadata: metadataWithRole });
      window.location.href = withDraftParams(href, kind, recoverySource, draftContext && draftContext.continuationToken);
    } catch (_) {
      window.location.href = href;
    }
  };
  const clickFallbackInput = (kind) => {
    const input = document.querySelector('[data-global-record-input="' + kind + '"]');
    if (input && typeof input.click === 'function') input.click();
  };
  const closeSheet = () => {
    cameraRequestId += 1;
    cameraStartInFlight = false;
    stopActiveStream();
    clearReview();
    if (sheet) sheet.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.documentElement.classList.remove('global-record-camera-open');
    activeKind = '';
    setSheetKind('');
    resetVisualViewportVars();
    hideCameraError();
    setStatus('');
  };
  const openSheet = (kind, options) => {
    if (activeKind && activeKind !== kind) {
      cameraRequestId += 1;
      cameraStartInFlight = false;
      stopActiveStream();
    }
    hideCameraError();
    if (!(options && options.keepReview)) clearReview();
    sheetOpenedAt = nowMs();
    activeKind = kind;
    setSheetKind(kind);
    setPhotoDraftLayout(kind === 'photo' && selectedPhotoDraftFiles().length > 0 && !activeStream);
    const label = labels[kind] || labels.photo;
    if (title) title.textContent = label.title;
    if (help) help.textContent = label.help;
    if (startButton) {
      startButton.textContent = label.start;
      startButton.hidden = false;
    }
    if (captureButton) {
      captureButton.textContent = label.capture;
      captureButton.hidden = true;
    }
    setFooterActionMode('start');
    if (empty) {
      empty.textContent = 'カメラを起動すると、ここにプレビューが出ます。';
      empty.hidden = false;
    }
    if (sheet) sheet.hidden = false;
    if (backdrop) backdrop.hidden = false;
    document.documentElement.classList.add('global-record-camera-open');
    syncVisualViewportVars();
    setStatus(kind === 'photo' && options && options.reviewOnly ? '写真を確認しています。追加撮影してから記録へ進めます。' : 'カメラを起動しています...');
    if (kind === 'photo') {
      latestCaptureLocation = null;
      latestCaptureLocationAt = 0;
      void requestCaptureLocation(true);
    }
    if (!(options && options.reviewOnly)) void startCamera();
  };
  const startCamera = async () => {
    if (!activeKind) return;
    if (cameraStartInFlight) return;
    const cameraStartedAt = nowMs();
    setPhotoDraftLayout(false);
    if (!(activeKind === 'photo' && selectedPhotoDraftFiles().length > 0)) clearReview();
    hideCameraError();
    if (window.isSecureContext === false || !(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')) {
      showCameraError(false);
      sendGlobalRecordEvent('camera_unavailable', 'camera_unavailable', { reason: window.isSecureContext === false ? 'insecure_context' : 'unsupported' });
      sendGlobalRecordErrorKpi('camera_start_failed', 'media_devices_unavailable', {
        durationMs: durationSince(cameraStartedAt),
      });
      return;
    }
    const requestId = cameraRequestId + 1;
    cameraRequestId = requestId;
    cameraStartInFlight = true;
    if (startButton) {
      startButton.disabled = true;
      startButton.textContent = '起動中...';
    }
    try {
      stopActiveStream();
      if (startButton) {
        startButton.disabled = true;
        startButton.textContent = '起動中...';
      }
      if (cameraVideo) cameraVideo.hidden = false;
      if (cameraImage) cameraImage.hidden = true;
      const constraints = {
        video: cameraVideoConstraints(),
        audio: activeKind === 'video',
      };
      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (requestId !== cameraRequestId || !activeKind || (sheet && sheet.hidden)) {
        activeStream.getTracks().forEach((track) => track.stop());
        activeStream = null;
        setCameraLiveLayout(false);
        resetCameraZoomUi();
        return;
      }
      if (cameraVideo) {
        cameraVideo.srcObject = activeStream;
        cameraVideo.muted = true;
        cameraVideo.playsInline = true;
        await cameraVideo.play().catch(() => undefined);
      }
      setCameraLiveLayout(true);
      await setupCameraZoom(activeStream);
      if (empty) empty.hidden = true;
      if (captureButton) {
        captureButton.hidden = false;
        captureButton.textContent = activeKind === 'video' ? '録画開始' : '写真を撮る';
      }
      if (startButton) startButton.hidden = true;
      setFooterActionMode('capture');
      const controlHelp = [
        cameraZoomTrack ? 'ピンチまたはスライダーで最大' + formatZoom(cameraZoomMax) + 'まで使えます。' : '',
        cameraFocusTrack ? '手動ピントも調整できます。' : '',
      ].filter(Boolean).join(' ');
      setStatus(activeKind === 'video'
        ? '動画記録は最大60秒。録画後に見せたい区間を選べます。 ' + controlHelp
        : '構図を確認してから撮影できます。 ' + controlHelp);
      sendGlobalRecordKpi('camera_start_ms', durationSince(cameraStartedAt), {
        fromSheetOpenMs: sheetOpenedAt ? durationSince(sheetOpenedAt) : null,
        constraintsKind: activeKind,
      });
      sendGlobalRecordEvent('camera_open_success', 'camera_open_success', { kind: activeKind });
    } catch (error) {
      setCameraLiveLayout(false);
      resetCameraZoomUi();
      const errorName = String(error && error.name || '');
      const permissionDenied = errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || errorName === 'SecurityError';
      showCameraError(permissionDenied);
      sendGlobalRecordEvent(permissionDenied ? 'camera_permission_denied' : 'camera_unavailable', permissionDenied ? 'camera_permission_denied' : 'camera_unavailable', {
        reason: permissionDenied ? 'permission_denied' : 'get_user_media_failed',
      });
      sendGlobalRecordErrorKpi('camera_start_failed', permissionDenied ? 'permission_denied' : 'get_user_media_failed', {
        durationMs: durationSince(cameraStartedAt),
      });
    } finally {
      if (requestId === cameraRequestId) cameraStartInFlight = false;
    }
  };
  const buildCaptureMetadata = () => ({
    capturedAt: new Date().toISOString(),
    location: latestCaptureLocation,
    locationPending: !latestCaptureLocation,
  });
  const prepareSheetVideoTrim = (file) => {
    resetSheetVideoTrim();
    if (!file || !trimWrap || !trimStart || !trimEnd || !cameraVideo) return;
    const setup = () => {
      const duration = Number(cameraVideo.duration || 0);
      if (!Number.isFinite(duration) || duration <= 0) return;
      sheetVideoTrimState = { sourceFile: file, duration, start: 0, end: Math.min(duration, VIDEO_MAX_SECONDS) };
      trimStart.max = String(duration);
      trimEnd.max = String(duration);
      trimStart.value = '0';
      trimEnd.value = String(Math.min(duration, VIDEO_MAX_SECONDS));
      trimWrap.hidden = false;
      syncSheetVideoTrim();
    };
    if (cameraVideo.readyState >= 1) setup();
    else cameraVideo.addEventListener('loadedmetadata', setup, { once: true });
  };
  const createSheetTrimmedVideoFile = () => new Promise((resolve, reject) => {
    if (!sheetVideoTrimState || !sheetVideoTrimState.sourceFile) {
      reject(new Error('video_trim_source_missing'));
      return;
    }
    const start = Number(sheetVideoTrimState.start || 0);
    const end = Number(sheetVideoTrimState.end || 0);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > VIDEO_MAX_SECONDS + 0.5) {
      reject(new Error('video_trim_range_invalid'));
      return;
    }
    const sourceFile = sheetVideoTrimState.sourceFile;
    const sourceUrl = URL.createObjectURL(sourceFile);
    const sourceVideo = document.createElement('video');
    const cleanup = () => {
      URL.revokeObjectURL(sourceUrl);
      sourceVideo.pause();
      sourceVideo.removeAttribute('src');
      sourceVideo.load();
    };
    const captureStream = () => {
      const capture = sourceVideo.captureStream || sourceVideo.mozCaptureStream;
      return capture ? capture.call(sourceVideo) : null;
    };
    sourceVideo.preload = 'auto';
    sourceVideo.playsInline = true;
    sourceVideo.src = sourceUrl;
    sourceVideo.onerror = () => {
      cleanup();
      reject(new Error('video_trim_failed'));
    };
    sourceVideo.onloadedmetadata = async () => {
      try {
        sourceVideo.currentTime = start;
        await new Promise((seekResolve, seekReject) => {
          if (Math.abs(Number(sourceVideo.currentTime || 0) - start) < 0.05) {
            seekResolve(true);
            return;
          }
          const timer = window.setTimeout(() => seekReject(new Error('video_trim_seek_failed')), 8000);
          sourceVideo.onseeked = () => {
            window.clearTimeout(timer);
            seekResolve(true);
          };
        });
        const stream = captureStream();
        if (!stream || typeof MediaRecorder === 'undefined') {
          cleanup();
          reject(new Error('video_trim_unsupported'));
          return;
        }
        const mimeType = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : '';
        const chunks = [];
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        let settled = false;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          stream.getTracks().forEach((track) => track.stop());
          cleanup();
          if (error) {
            reject(error);
            return;
          }
          const type = chunks[0] ? chunks[0].type || 'video/webm' : 'video/webm';
          const blob = new Blob(chunks, { type });
          resolve(new File([blob], 'ikimon-video-trim-' + Date.now() + '.webm', { type, lastModified: Date.now() }));
        };
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => finish(new Error('video_trim_failed'));
        recorder.onstop = () => finish(null);
        recorder.start(1000);
        await sourceVideo.play();
        const safetyTimer = window.setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, Math.ceil((end - start + 2) * 1000));
        const timer = window.setInterval(() => {
          if (sourceVideo.currentTime >= end || sourceVideo.ended) {
            window.clearInterval(timer);
            window.clearTimeout(safetyTimer);
            if (recorder.state === 'recording') recorder.stop();
          }
        }, 100);
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error('video_trim_failed'));
      }
    };
  });
  const buildVideoDraftFromSheet = async () => {
    if (!capturedReviewFile || !sheetVideoTrimState) return capturedReviewFile;
    const duration = Number(sheetVideoTrimState.duration || 0);
    const start = Number(sheetVideoTrimState.start || 0);
    const end = Number(sheetVideoTrimState.end || 0);
    const needsClip = duration > VIDEO_MAX_SECONDS + 0.5 || start > 0.15 || end < duration - 0.15;
    if (!needsClip) return capturedReviewFile;
    setStatus('選んだ最大60秒の動画を作成中です...');
    return await createSheetTrimmedVideoFile();
  };
  const showCapturedReview = (file, kind, metadata) => {
    stopActiveStream();
    if (kind === 'photo') {
      if (cameraImage) {
        const latestUrl = URL.createObjectURL(file);
        if (reviewObjectUrl) URL.revokeObjectURL(reviewObjectUrl);
        reviewObjectUrl = latestUrl;
        cameraImage.src = latestUrl;
        cameraImage.hidden = false;
      }
      if (cameraVideo) cameraVideo.hidden = true;
      if (empty) empty.hidden = true;
      if (!capturedReviewMeta && metadata) capturedReviewMeta = metadata || {};
      addPhotoDraftFiles([file], metadata);
      return;
    }
    capturedReviewFile = file;
    capturedReviewMeta = metadata || {};
    reviewObjectUrl = URL.createObjectURL(file);
    if (empty) empty.hidden = true;
    if (kind === 'video') {
      if (cameraImage) cameraImage.hidden = true;
      if (cameraVideo) {
        cameraVideo.srcObject = null;
        cameraVideo.src = reviewObjectUrl;
        cameraVideo.controls = true;
        cameraVideo.muted = true;
        cameraVideo.loop = true;
        cameraVideo.play().catch(() => undefined);
      }
      prepareSheetVideoTrim(file);
      setStatus(metadata && metadata.location ? '撮影地点も保存しました。必要なら使う区間だけ選べます。' : '必要なら使う区間だけ選べます。位置は記録画面で確認します。');
      if (captureButton) captureButton.textContent = 'この内容で記録画面へ';
    } else {
      if (cameraVideo) cameraVideo.hidden = true;
      if (cameraImage) {
        cameraImage.src = reviewObjectUrl;
        cameraImage.hidden = false;
      }
      setStatus(metadata && metadata.location ? '撮影地点も保存しました。この内容で記録画面へ進めます。' : 'この内容で記録画面へ進めます。位置は記録画面で確認します。');
      if (captureButton) captureButton.textContent = 'この内容で記録画面へ';
    }
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = false;
      startButton.textContent = '撮り直す';
    }
    if (captureButton) {
      captureButton.hidden = false;
      captureButton.disabled = false;
    }
    setFooterActionMode('submit');
  };
  const retakeCapture = () => {
    const kind = activeKind || (capturedReviewFile && capturedReviewFile.type && capturedReviewFile.type.indexOf('video/') === 0 ? 'video' : 'photo');
    if (kind !== 'photo') clearReview();
    activeKind = kind;
    if (cameraVideo) cameraVideo.hidden = false;
    startCamera();
  };
  const capturePhoto = () => {
    if (!cameraVideo || !activeStream) return;
    const captureStartedAt = capturePressedAt || nowMs();
    const encodeStartedAt = nowMs();
    const width = cameraVideo.videoWidth || 1280;
    const height = cameraVideo.videoHeight || 960;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(cameraVideo, 0, 0, width, height);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatus('写真を保存できませんでした。');
        return;
      }
      const file = new File([blob], 'ikimon-photo-' + Date.now() + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
      stopActiveStream();
      const metadata = buildCaptureMetadata();
      showCapturedReview(file, 'photo', metadata);
      sendGlobalRecordEvent('capture_completed', 'capture_completed', { mediaType: 'photo' });
      sendGlobalRecordKpi('capture_encode_ms', durationSince(encodeStartedAt), {
        width,
        height,
        blobBytes: Number(blob.size || 0),
      });
      sendGlobalRecordKpi('capture_to_review_ms', durationSince(captureStartedAt), {
        width,
        height,
        blobBytes: Number(blob.size || 0),
      });
      capturePressedAt = 0;
    }, 'image/jpeg', 0.9);
  };
  const stopVideoRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      discardRecording = false;
      mediaRecorder.stop();
      if (captureButton) captureButton.disabled = true;
    }
  };
  const startVideoRecording = () => {
    if (!activeStream || typeof MediaRecorder === 'undefined') {
      setStatus('このブラウザでは録画を開始できません。ブラウザのカメラ許可を確認してください。');
      return;
    }
    const mimeType = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';
    recordedChunks = [];
    discardRecording = false;
    mediaRecorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.onstop = async () => {
      stopRecordingTimer();
      if (discardRecording) {
        discardRecording = false;
        return;
      }
      const type = recordedChunks[0] ? recordedChunks[0].type || 'video/webm' : 'video/webm';
      const blob = new Blob(recordedChunks, { type });
      const file = new File([blob], 'ikimon-video-' + Date.now() + '.webm', { type, lastModified: Date.now() });
      if (captureButton) {
        captureButton.disabled = false;
        captureButton.textContent = '録画開始';
      }
      stopActiveStream();
      const metadata = buildCaptureMetadata();
      showCapturedReview(file, 'video', metadata);
      sendGlobalRecordEvent('capture_completed', 'capture_completed', { mediaType: 'video' });
      if (capturePressedAt) {
        sendGlobalRecordKpi('capture_to_review_ms', durationSince(capturePressedAt), {
          mediaType: 'video',
          blobBytes: Number(file.size || 0),
        });
        capturePressedAt = 0;
      }
    };
    recordingStartedAt = Date.now();
    mediaRecorder.start(1000);
    if (captureButton) captureButton.textContent = '録画停止';
    setFooterActionMode('capture');
    setStatus('録画中 0秒 / 記録は最大60秒。あとで区間を選べます');
    recordingTimer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartedAt) / 1000);
      setStatus('録画中 ' + String(elapsed) + '秒 / 記録は最大60秒。あとで区間を選べます');
    }, 500);
  };
  const captureFromSheet = async () => {
    if (activeKind === 'photo' && activeStream) {
      resetPhotoDraftSubmitConfirm();
      capturePressedAt = nowMs();
      capturePhoto();
      return;
    }
    if (activeKind === 'photo' && selectedPhotoDraftFiles().length > 0 && !activeStream) {
      if (directPostInFlight) return;
      photoDraftSubmitConfirmUntil = 0;
      if (captureButton) captureButton.disabled = true;
      try {
        await directPostPhotoDraft();
      } catch (error) {
        if (captureButton) captureButton.disabled = false;
        const message = error && error.message ? String(error.message) : '';
        if (message === 'session_required') {
          setStatus('ログイン後に続けられるよう、写真を下書きに保存しています...');
          await navigateWithDraft(selectedPhotoDraftFiles(), 'photo', capturedReviewMeta || {}, 'login_required');
          return;
        } else if (message === 'location_required') setStatus('直接記録には地点が必要です。位置情報を許可してからもう一度試してください。');
        else if (message.startsWith('photo_upload_failed_at_')) setStatus('写真の保存に失敗しました。通信状態を確認してもう一度試してください。');
        else if (photoDraftRetryDetailId) setStatus('記録本体は保存済みです。写真の通信確認だけ失敗しました。ホームに戻ると記録が見える場合があります。もう一度押すと同じ記録に再送します。');
        else setStatus(formatRecordSaveFailureReason(message));
      }
      return;
    }
    if (capturedReviewFile) {
      if (captureButton) captureButton.disabled = true;
      try {
        const file = activeKind === 'video' ? await buildVideoDraftFromSheet() : capturedReviewFile;
        await navigateWithDraft(file, activeKind || 'photo', capturedReviewMeta || {});
      } catch (error) {
        if (captureButton) captureButton.disabled = false;
        const message = error && error.message ? String(error.message) : '';
        setStatus(message === 'video_trim_unsupported'
          ? 'このブラウザではシート内カットに対応していません。60秒以内で撮り直すか、編集画面で選んでください。'
          : '動画のカットに失敗しました。区間を変えるか、撮り直してください。');
      }
      return;
    }
    if (activeKind === 'video') {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        capturePressedAt = nowMs();
        stopVideoRecording();
      } else {
        startVideoRecording();
      }
      return;
    }
    capturePressedAt = nowMs();
    capturePhoto();
  };
  document.querySelectorAll('[data-global-record-trigger]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const kind = button.getAttribute('data-global-record-trigger') || 'photo';
      openSheet(kind === 'video' ? 'video' : 'photo');
    });
  });
  document.querySelectorAll('[data-global-record-gallery-select]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      sendGlobalRecordEvent('gallery_select_tap', 'gallery_select_tap', { source: cameraError && !cameraError.hidden ? 'camera_error' : 'camera_sheet' });
      clickFallbackInput('gallery');
    });
  });
  document.querySelectorAll('[data-global-record-input]').forEach((input) => {
    input.addEventListener('change', async () => {
      const files = input.files ? Array.from(input.files) : [];
      const kind = input.getAttribute('data-global-record-input') || 'gallery';
      if (!files.length) return;
      if (kind === 'photo') {
        openSheet('photo', { reviewOnly: true, keepReview: true });
        const metadata = buildCaptureMetadata();
        addPhotoDraftFiles(files, metadata);
        input.value = '';
        return;
      }
      await navigateWithDraft(files, kind);
    });
  });
  document.querySelectorAll('[data-global-record-camera-close]').forEach((button) => {
    button.addEventListener('click', closeSheet);
  });
  if (cameraRetryButton) cameraRetryButton.addEventListener('click', () => {
    hideCameraError();
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = false;
      startButton.textContent = (labels[activeKind] || labels.photo).start;
    }
    void startCamera();
  });
  if (cameraCancelButton) cameraCancelButton.addEventListener('click', closeSheet);
  if (startButton) startButton.addEventListener('click', () => {
    resetPhotoDraftSubmitConfirm();
    if (capturedReviewFile) retakeCapture();
    else startCamera();
  });
  if (captureButton) captureButton.addEventListener('click', captureFromSheet);
  if (photoGrid) {
    photoGrid.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const removeIndex = target.getAttribute('data-global-record-photo-remove');
      if (removeIndex !== null) {
        removePhotoDraft(removeIndex);
        return;
      }
      const moveIndex = target.getAttribute('data-global-record-photo-move');
      if (moveIndex !== null) {
        movePhotoDraft(moveIndex, target.getAttribute('data-direction') || '0');
      }
    });
  }
  if (zoomRange) {
    zoomRange.addEventListener('input', () => {
      void applyCameraZoom(zoomRange.value);
    });
  }
  if (zoomMaxButton) {
    zoomMaxButton.addEventListener('click', () => {
      void applyCameraZoom(cameraZoomMax);
    });
  }
  if (focusRange) {
    focusRange.addEventListener('input', () => {
      void applyCameraFocusDistance(focusRange.value);
    });
  }
  if (focusAutoButton) {
    focusAutoButton.addEventListener('click', () => {
      void restoreCameraAutoFocus();
    });
  }
  if (cameraPreview) {
    cameraPreview.addEventListener('pointerdown', (event) => {
      if (event.target instanceof Element && event.target.closest('.global-record-camera-zoom')) return;
      if (!activeStream) return;
      cameraPreviewPointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
      if (cameraPreview.setPointerCapture) {
        try { cameraPreview.setPointerCapture(event.pointerId); } catch (_) {}
      }
      if (cameraPreviewPointers.size === 2 && cameraZoomTrack && cameraZoomMax > cameraZoomMin) {
        cameraPinchActive = true;
        cameraPinchStartDistance = cameraPinchDistance();
        cameraPinchStartZoom = cameraZoomCurrent;
      }
      event.preventDefault();
    });
    cameraPreview.addEventListener('pointermove', (event) => {
      if (!cameraPreviewPointers.has(event.pointerId)) return;
      const previous = cameraPreviewPointers.get(event.pointerId) || {};
      cameraPreviewPointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: previous.startX || event.clientX, startY: previous.startY || event.clientY });
      if (cameraPreviewPointers.size >= 2 && cameraZoomTrack && cameraZoomMax > cameraZoomMin) {
        cameraPinchActive = true;
        updateCameraPinchZoom();
        event.preventDefault();
      }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
      cameraPreview.addEventListener(type, (event) => {
        const previous = cameraPreviewPointers.get(event.pointerId) || null;
        if (type === 'pointerup' && previous && cameraPreviewPointers.size === 1 && !cameraPinchActive) {
          const moved = Math.hypot(Number(event.clientX) - Number(previous.startX || event.clientX), Number(event.clientY) - Number(previous.startY || event.clientY));
          if (moved < 12) void applyCameraFocusAt(event.clientX, event.clientY);
        }
        cameraPreviewPointers.delete(event.pointerId);
        if (cameraPreviewPointers.size < 2) {
          cameraPinchStartDistance = 0;
          cameraPinchStartZoom = cameraZoomCurrent;
          cameraPinchActive = false;
        }
      });
    });
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncVisualViewportVars);
    window.visualViewport.addEventListener('scroll', syncVisualViewportVars);
  }
  if (trimStart) trimStart.addEventListener('input', () => syncSheetVideoTrim('start'));
  if (trimEnd) trimEnd.addEventListener('input', () => syncSheetVideoTrim('end'));
  if (cameraVideo) {
    cameraVideo.addEventListener('timeupdate', () => {
      if (!sheetVideoTrimState || activeKind !== 'video' || !capturedReviewFile) return;
      const end = Number(sheetVideoTrimState.end || 0);
      if (Number(cameraVideo.currentTime || 0) > end) {
        cameraVideo.pause();
        cameraVideo.currentTime = Number(sheetVideoTrimState.start || 0);
      }
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !activeStream) return;
    stopActiveStream();
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = false;
      startButton.textContent = (labels[activeKind] || labels.photo).start;
    }
    if (captureButton) captureButton.hidden = true;
    setFooterActionMode('start');
  });
  window.addEventListener('pagehide', stopActiveStream);
})();
</script>`;
}

function authNavHydrationScript(basePath: string, lang: SiteLang): string {
  const accountCopy = accountUiCopy(lang);
  const sessionEndpoint = `${withBasePath(basePath, "/api/v1/auth/session")}?optional=1`;
  const personalizedEndpoint = withBasePath(basePath, "/api/v1/me/personalized-menu?limit=8");
  const alertsEndpoint = withBasePath(basePath, "/api/v1/me/alerts");
  const alertsReadEndpoint = withBasePath(basePath, "/api/v1/me/alerts/read");
  const reactionEndpointBase = withBasePath(basePath, "/api/v1/observations/");
  const profileHref = appendLangToHref(withBasePath(basePath, "/profile"), lang);
  const settingsHref = appendLangToHref(withBasePath(basePath, "/profile/settings"), lang);
  const notificationsHomeHref = appendLangToHref(withBasePath(basePath, "/home"), lang);
  const observationHrefBase = appendLangToHref(withBasePath(basePath, "/observations/"), lang);
  return `<script>
(function () {
  const endpoint = ${JSON.stringify(sessionEndpoint)};
  const personalizedEndpoint = ${JSON.stringify(personalizedEndpoint)};
  const alertsEndpoint = ${JSON.stringify(alertsEndpoint)};
  const alertsReadEndpoint = ${JSON.stringify(alertsReadEndpoint)};
  const reactionEndpointBase = ${JSON.stringify(reactionEndpointBase)};
  const profileHref = ${JSON.stringify(profileHref)};
  const settingsHref = ${JSON.stringify(settingsHref)};
  const notificationsHomeHref = ${JSON.stringify(notificationsHomeHref)};
  const observationHrefBase = ${JSON.stringify(observationHrefBase)};
  const accountCopy = ${JSON.stringify(accountCopy)};
  let signedIn = false;
  let latestAlerts = [];
  const setIconHref = (selector, href, label) => {
    document.querySelectorAll(selector).forEach((link) => {
      link.setAttribute('href', href);
      link.setAttribute('aria-label', label);
      link.setAttribute('title', label);
    });
  };
  const alertTitle = (item) => {
    const payload = item && typeof item.payload === 'object' && item.payload ? item.payload : {};
    return String(payload.title || payload.label || item.triggerKind || '新しい通知').trim().slice(0, 80);
  };
  const alertBody = (item) => {
    const payload = item && typeof item.payload === 'object' && item.payload ? item.payload : {};
    return String(payload.body || payload.summary || payload.message || item.deliveryStatus || '').trim().slice(0, 110);
  };
  const alertHref = (item) => {
    const payload = item && typeof item.payload === 'object' && item.payload ? item.payload : {};
    const payloadHref = String(payload.href || '').trim();
    if (payloadHref && payloadHref.charAt(0) === '/' && payloadHref.indexOf('//') !== 0) return payloadHref;
    const occurrenceId = item && item.occurrenceId ? String(item.occurrenceId) : '';
    return occurrenceId ? observationHrefBase + encodeURIComponent(occurrenceId) : notificationsHomeHref;
  };
  const renderAlerts = (alerts) => {
    const active = Array.isArray(alerts) ? alerts.slice(0, 3) : [];
    latestAlerts = Array.isArray(alerts) ? alerts : [];
    document.querySelectorAll('[data-notification-list]').forEach((list) => {
      list.textContent = '';
      if (!active.length) {
        const empty = document.createElement('div');
        empty.className = 'site-notification-empty';
        empty.textContent = '新しい通知はありません。';
        list.appendChild(empty);
        return;
      }
      active.forEach((item) => {
        const link = document.createElement('a');
        const deliveryId = String(item && item.deliveryId ? item.deliveryId : '');
        const unread = item && !item.acknowledgedAt;
        link.className = 'site-notification-item' + (unread ? ' is-unread' : '');
        link.href = alertHref(item);
        if (deliveryId) {
          link.setAttribute('data-notification-id', deliveryId);
        }
        const strong = document.createElement('strong');
        strong.textContent = alertTitle(item);
        const span = document.createElement('span');
        span.textContent = alertBody(item);
        link.appendChild(strong);
        link.appendChild(span);
        if (unread) {
          const mark = document.createElement('em');
          mark.textContent = '未読';
          link.appendChild(mark);
        }
        list.appendChild(link);
      });
    });
    const unreadCount = Array.isArray(alerts)
      ? alerts.filter((item) => item && !item.acknowledgedAt).length
      : 0;
    document.querySelectorAll('[data-notification-badge]').forEach((badge) => {
      if (unreadCount > 0) {
        badge.hidden = false;
        badge.textContent = String(Math.min(unreadCount, 9));
      } else {
        badge.hidden = true;
      }
    });
    document.querySelectorAll('[data-notification-read-all]').forEach((button) => {
      button.hidden = unreadCount <= 0;
    });
  };
  const markAlertReadLocally = (ids) => {
    const set = new Set((Array.isArray(ids) ? ids : []).map(String));
    latestAlerts = latestAlerts.map((item) => {
      const deliveryId = String(item && item.deliveryId ? item.deliveryId : '');
      if (!set.has(deliveryId)) return item;
      return Object.assign({}, item, { acknowledgedAt: item.acknowledgedAt || new Date().toISOString() });
    });
    renderAlerts(latestAlerts);
  };
  const readAlerts = (ids) => {
    const activeIds = Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];
    return fetch(alertsReadEndpoint, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(activeIds.length ? { ids: activeIds } : {})
    }).then((response) => response.ok ? response.json() : null);
  };
  const statText = (item) => {
    const stats = item && typeof item.stats === 'object' && item.stats ? item.stats : {};
    const parts = [];
    const observationCount = Number(stats.observationCount || 0);
    const needsIdCount = Number(stats.needsIdCount || 0);
    if (observationCount > 0) parts.push(observationCount + '件');
    if (needsIdCount > 0) parts.push('確認中' + needsIdCount + '件');
    if (stats.followed) parts.push('フォロー中');
    return parts.slice(0, 2).join(' · ');
  };
  const renderPersonalizedItems = (items, summary) => {
    const active = Array.isArray(items)
      ? items.filter((item) => item && item.label && item.href).slice(0, 8)
      : [];
    document.querySelectorAll('[data-side-nav-personalized-list]').forEach((list) => {
      if (!active.length) return;
      list.textContent = '';
      const unreadAlertCount = Number(summary && summary.unreadAlertCount ? summary.unreadAlertCount : 0);
      if (unreadAlertCount > 0) {
        const summaryNode = document.createElement('div');
        summaryNode.className = 'desktop-side-nav-mini-summary';
        summaryNode.innerHTML = '<span>新着通知</span><strong>' + String(Math.min(unreadAlertCount, 99)) + '</strong>';
        list.appendChild(summaryNode);
      }
      active.forEach((item) => {
        const link = document.createElement('a');
        link.className = 'desktop-side-nav-mini-card';
        link.href = String(item.href || '/');
        const label = document.createElement('span');
        label.className = 'desktop-side-nav-mini-label';
        label.textContent = String(item.label || 'フォロー中');
        const meta = document.createElement('span');
        meta.className = 'desktop-side-nav-mini-meta';
        meta.textContent = statText(item) || 'フォロー中';
        link.appendChild(label);
        link.appendChild(meta);
        link.setAttribute('data-kpi-action', 'personalized_menu_' + String(item.source || item.kind || 'item'));
        list.appendChild(link);
      });
    });
    if (active.length) {
      document.querySelectorAll('[data-side-nav-personalized-empty]').forEach((node) => {
        node.hidden = true;
      });
    }
  };
  const hydrateAlerts = () => {
    fetch(alertsEndpoint, {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'same-origin'
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => renderAlerts(payload && payload.ok ? payload.alerts : []))
      .catch(() => undefined);
  };
  const hydratePersonalizedMenu = () => {
    fetch(personalizedEndpoint, {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'same-origin'
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => renderPersonalizedItems(payload && payload.ok ? payload.items : [], payload && payload.ok ? payload.summary : null))
      .catch(() => undefined);
  };
  window.addEventListener('ikimon:area-followed', () => {
    if (signedIn) hydratePersonalizedMenu();
  });
  document.addEventListener('click', (event) => {
    const reactionButton = event.target instanceof Element ? event.target.closest('[data-reaction-type]') : null;
    if (reactionButton) {
      event.preventDefault();
      const bar = reactionButton.closest('[data-occurrence-id]');
      const occurrenceId = bar ? String(bar.getAttribute('data-occurrence-id') || '') : '';
      const reactionType = String(reactionButton.getAttribute('data-reaction-type') || '');
      if (!occurrenceId || !reactionType) return;
      if (!signedIn) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        return;
      }
      reactionButton.setAttribute('disabled', 'disabled');
      fetch(reactionEndpointBase + encodeURIComponent(occurrenceId) + '/reactions/' + encodeURIComponent(reactionType), {
        method: 'POST',
        headers: { accept: 'application/json' },
        credentials: 'same-origin'
      })
        .then((response) => {
          if (response.status === 401) {
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
            return null;
          }
          return response.ok ? response.json() : null;
        })
        .then((payload) => {
          if (!payload || payload.ok === false) return;
          reactionButton.classList.toggle('is-reacted', payload.added === true);
          const count = reactionButton.querySelector('.obs-reaction-count');
          if (count) {
            const current = Number(String(count.textContent || '0').replace(/,/g, '')) || 0;
            const next = Math.max(0, current + (payload.added === true ? 1 : -1));
            count.textContent = next.toLocaleString('ja-JP');
          }
        })
        .catch(() => undefined)
        .finally(() => reactionButton.removeAttribute('disabled'));
      return;
    }
    const toggle = event.target instanceof Element ? event.target.closest('[data-notification-toggle]') : null;
    const panel = document.querySelector('[data-notification-panel]');
    if (toggle) {
      if (!signedIn) {
        const loginHref = toggle.getAttribute('data-login-href') || '/login?redirect=/home';
        window.location.href = loginHref;
        return;
      }
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if (panel) panel.hidden = expanded;
      return;
    }
    const readAll = event.target instanceof Element ? event.target.closest('[data-notification-read-all]') : null;
    if (readAll) {
      const ids = latestAlerts.filter((item) => item && !item.acknowledgedAt && item.deliveryId).map((item) => item.deliveryId);
      if (!ids.length) return;
      readAll.setAttribute('disabled', 'disabled');
      readAlerts(ids)
        .then(() => {
          markAlertReadLocally(ids);
          hydratePersonalizedMenu();
        })
        .finally(() => readAll.removeAttribute('disabled'));
      return;
    }
    const alertLink = event.target instanceof Element ? event.target.closest('[data-notification-id]') : null;
    if (alertLink) {
      const id = alertLink.getAttribute('data-notification-id');
      if (id) {
        markAlertReadLocally([id]);
        readAlerts([id]).catch(() => undefined);
      }
      return;
    }
    if (panel && !panel.hidden && !(event.target instanceof Element && event.target.closest('[data-notification-menu]'))) {
      panel.hidden = true;
      document.querySelectorAll('[data-notification-toggle]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    }
  }, { capture: true });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('[data-notification-panel]').forEach((panel) => { panel.hidden = true; });
    document.querySelectorAll('[data-notification-toggle]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  });
  const hydrateBottomNavAuth = (isSignedIn) => {
    document.querySelectorAll('[data-bottom-nav-auth]').forEach((link) => {
      const target = link.getAttribute(isSignedIn ? 'data-auth-member-href' : 'data-auth-guest-href');
      if (target) link.setAttribute('href', target);
    });
  };
  const applySignedInState = (session) => {
    if (!session || !session.userId) {
      document.documentElement.dataset.auth = 'guest';
      hydrateBottomNavAuth(false);
      return;
    }
    signedIn = true;
    document.documentElement.dataset.auth = 'signed-in';
    hydrateBottomNavAuth(true);
    document.querySelectorAll('.site-login-link').forEach((link) => {
      const label = link.querySelector('.desktop-side-nav-label');
      if (label) label.textContent = accountCopy.profile;
      else link.textContent = accountCopy.profile;
      link.setAttribute('href', profileHref);
      link.setAttribute('aria-label', (session.displayName || accountCopy.profile) + accountCopy.profileSuffix);
      link.setAttribute('title', accountCopy.profile);
      link.classList.add('is-authenticated');
    });
    setIconHref('[data-account-profile]', profileHref, (session.displayName || accountCopy.profile) + accountCopy.profileSuffix);
    setIconHref('[data-account-settings]', settingsHref, accountCopy.settings);
    document.querySelectorAll('[data-account-alerts]').forEach((button) => {
      button.setAttribute('aria-label', accountCopy.notifications);
      button.setAttribute('title', accountCopy.notifications);
    });
    hydrateAlerts();
    hydratePersonalizedMenu();
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

const PUBLIC_ORIGIN = PRODUCTION_PUBLIC_ORIGIN;

function stripFragment(path: string): string {
  const hashIndex = path.indexOf("#");
  return hashIndex >= 0 ? path.slice(0, hashIndex) : path;
}

function absolutePublicUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const rooted = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_ORIGIN}${rooted}`;
}

function ogLocale(lang: SiteLang): string {
  const map: Record<SiteLang, string> = {
    ja: "ja_JP",
    en: "en_US",
    es: "es_ES",
    "pt-BR": "pt_BR",
  };
  return map[lang];
}

function displayPageTitle(title: string): string {
  return title
    .replace(/\bikimon\.life\b/gi, "ZUKAN")
    .replace(/\bikimon\b/gi, "ZUKAN");
}

export function renderSiteDocument(options: SiteShellOptions): string {
  const lang = options.lang ?? "ja";
  const pageTitle = displayPageTitle(options.title);
  const currentPath = options.currentPath ?? withBasePath(options.basePath, "/");
  const uiLangs = options.alternateLangs?.length ? options.alternateLangs : supportedLanguages.map((language) => language.code);
  const seoAlternateLangs: SiteLang[] = ["ja"];
  const description = options.description ?? options.hero?.lead ?? options.footerNote ?? shellCopyFor(lang).brandTagline;
  const canonicalPath = stripFragment(appendLangToHref(options.canonicalPath ?? currentPath, "ja"));
  const canonicalUrl = absolutePublicUrl(canonicalPath);
  const defaultOgpImageUrl = absolutePublicUrl(BRAND_ASSETS.ogpDefault);
  const structuredDataHtml = options.structuredDataHtml ?? "";
  const hasCustomOgImage = /property=["']og:image["']/.test(structuredDataHtml);
  const hasCustomTwitterCard = /name=["']twitter:card["']/.test(structuredDataHtml);
  const hasCustomTwitterImage = /name=["']twitter:image["']/.test(structuredDataHtml);
  const ogImageMeta = hasCustomOgImage
    ? ""
    : `\n  <meta property="og:image" content="${escapeHtml(defaultOgpImageUrl)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="ZUKAN" />`;
  const twitterCardMeta = hasCustomTwitterCard ? "" : `\n  <meta name="twitter:card" content="summary_large_image" />`;
  const twitterImageMeta = hasCustomTwitterImage ? "" : `\n  <meta name="twitter:image" content="${escapeHtml(defaultOgpImageUrl)}" />`;
  const alternateLinks = seoAlternateLangs
    .map((alternateLang) => {
      const href = absolutePublicUrl(stripFragment(appendLangToHref(canonicalPath, alternateLang)));
      return `  <link rel="alternate" hreflang="${escapeHtml(alternateLang)}" href="${escapeHtml(href)}" />`;
    })
    .join("\n");
  const xDefaultHref = absolutePublicUrl(stripFragment(appendLangToHref(canonicalPath, "ja")));
  const robotsMeta = options.noindex || lang !== "ja" ? `\n  <meta name="robots" content="noindex,follow" />` : "";
  const uiKpiEndpoint = withBasePath(options.basePath, "/api/v1/ui-kpi/events");
  const skipLabel = shellCopyFor(lang).skipToContent;
  const globalRecordNav = options.hideGlobalRecordLauncher ? "" : globalRecordEntry(options.basePath, lang, currentPath, options.homeChrome);
  const installCopy = appInstallCopy[lang];
  const manifestHref = `/manifest.webmanifest?lang=${encodeURIComponent(lang)}`;
  const installPromptHtml = `<div class="app-install-prompt" data-app-install-prompt hidden>
    <div class="app-install-prompt-copy">
      <strong>${escapeHtml(installCopy.installTitle)}</strong>
      <span>${escapeHtml(installCopy.installBody)}</span>
    </div>
    <div class="app-install-prompt-actions">
      <button type="button" class="app-install-primary" data-app-install-action>${escapeHtml(installCopy.installAction)}</button>
      <button type="button" class="app-install-dismiss" data-app-install-dismiss aria-label="${escapeHtml(installCopy.dismissAction)}">${escapeHtml(installCopy.dismissAction)}</button>
    </div>
  </div>`;
  const appLaunchScreenHtml = `<div class="app-launch-screen" data-app-launch-screen aria-hidden="true">
    <div class="app-launch-mark">
      <img src="${BRAND_ASSETS.mark192Maskable}" alt="" loading="eager" decoding="async" />
    </div>
  </div>`;
  const languageSuggestionHtml = `<div class="language-suggestion" data-language-suggestion hidden>
    <div class="language-suggestion-copy">
      <strong data-language-suggestion-title></strong>
      <span data-language-suggestion-body></span>
    </div>
    <div class="language-suggestion-actions">
      <a class="language-suggestion-primary" data-language-suggestion-action href="/en/"></a>
      <button type="button" class="language-suggestion-dismiss" data-language-suggestion-dismiss aria-label="閉じる"></button>
    </div>
  </div>`;
  const shellClassName = options.shellClassName ?? "";
  const shellLayoutKind = siteShellLayoutKind(currentPath, shellClassName);
  const isImmersiveSurface = shellLayoutKind === "immersive";
  const shellLayoutClassName = `shell-layout-${shellLayoutKind}`;
  const mainClassName = ["shell", shellLayoutClassName, shellClassName].filter(Boolean).map(escapeHtml).join(" ");
  const shouldRenderFooter = false;
  const isReadingPage = isReadingSurface(currentPath);
  const prefersCollapsedSideNav = isReadingPage || isImmersiveSurface || /\bshell-records-workbench\b/.test(shellClassName);
  const isMapSurface = /\bshell-map\b/.test(shellClassName);
  const minimalChrome = Boolean(options.minimalChrome);
  const defaultSrOnlyHeading = pageTitle.replace(/\s*\|\s*ZUKAN\s*$/i, "");
  const srOnlyPageHeading = isMapSurface
    ? (lang === "ja" ? "地図" : lang === "es" ? "Mapa" : lang === "pt-BR" ? "Mapa" : "Map")
    : defaultSrOnlyHeading;
  const siteShellClassName = `site-shell${globalRecordNav ? " has-global-record-launcher" : ""}${isReadingPage ? " is-reading-surface" : ""}${isImmersiveSurface ? " is-immersive-surface" : ""}${isMapSurface ? " is-map-surface" : ""}${minimalChrome ? " is-minimal-chrome" : ""}`;
  const appLaunchHeadScript = `<script>
(function () {
  try {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (!standalone) return;
    const storageKey = 'ikimon:app-launch-screen-shown-v1';
    if (sessionStorage.getItem(storageKey) === '1') return;
    sessionStorage.setItem(storageKey, '1');
    document.documentElement.classList.add('is-app-launch-screen-eligible');
  } catch (_) {}
})();
</script>`;
  const appOutboxHeadScript = `<script>
(function () {
  if (window.ikimonAppOutbox) return;
  const DB_NAME = 'ikimon-app-outbox-v1';
  const DB_VERSION = 1;
  const STORE_NAME = 'items';
  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('indexeddb_unavailable'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('source', 'source', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('app_outbox_open_failed'));
    });
  }
  function emitChange(detail) {
    try { window.dispatchEvent(new CustomEvent('ikimon-app-outbox-change', { detail })); } catch (_) {}
  }
  async function put(input) {
    const now = Date.now();
    const id = String(input && input.id || (String(input && input.source || 'app') + ':' + now));
    const item = {
      id,
      source: String(input && input.source || 'app'),
      kind: String(input && input.kind || 'item'),
      sourceId: String(input && input.sourceId || id),
      route: String(input && input.route || location.pathname + location.search),
      status: String(input && input.status || 'queued'),
      attempts: Number(input && input.attempts || 0),
      payloadMeta: input && input.payloadMeta ? input.payloadMeta : null,
      createdAt: Number(input && input.createdAt || now),
      updatedAt: now
    };
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('app_outbox_put_failed'));
      });
      emitChange({ action: 'put', item });
      return item;
    } finally {
      db.close();
    }
  }
  async function remove(id) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(String(id));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('app_outbox_delete_failed'));
      });
      emitChange({ action: 'delete', id: String(id) });
    } finally {
      db.close();
    }
  }
  async function all() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error || new Error('app_outbox_read_failed'));
      });
    } finally {
      db.close();
    }
  }
  async function count() {
    return (await all()).length;
  }
  window.ikimonAppOutbox = { put, enqueue: put, delete: remove, remove, all, count };
})();
</script>`;
  const analyticsHeadScript = `<script>
(function () {
  const host = window.location.hostname;
  if (host !== 'zukan.earth' && host !== 'www.zukan.earth' && host !== 'ikimon.life' && host !== 'www.ikimon.life') return;

  const googleTagId = ${JSON.stringify(IKIMON_GA4_MEASUREMENT_ID)};
  const sanitizeDimension = (value, fallback) => {
    const normalized = String(value || fallback || '')
      .replace(/[^a-zA-Z0-9_:\\/\\-.?=&]+/g, '_')
      .slice(0, 100);
    if (normalized) return normalized;
    return fallback === undefined ? 'unknown' : String(fallback || '').slice(0, 100);
  };
  const normalizeEventName = (eventName) => {
    const normalized = String(eventName || 'ui_action')
      .replace(/[^a-zA-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    return /^[a-zA-Z]/.test(normalized) ? normalized : 'ikimon_' + (normalized || 'ui_action');
  };
  const trackExternalAnalytics = (eventName, payload) => {
    try {
      const metadata = payload && payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
      const params = {
        action_key: sanitizeDimension(payload && payload.actionKey, 'unknown_action'),
        route_key: sanitizeDimension(payload && payload.routeKey, ''),
        page_path: sanitizeDimension(payload && payload.pagePath, window.location.pathname + window.location.search),
        funnel: sanitizeDimension(metadata.funnel, ''),
        target: sanitizeDimension(metadata.target, ''),
        lang: sanitizeDimension(metadata.lang || document.documentElement.lang || 'ja', 'ja'),
      };
      const name = normalizeEventName(eventName);
      if (typeof window.gtag === 'function') window.gtag('event', name, params);
      if (typeof window.clarity === 'function') {
        window.clarity('set', 'ikimon_event', name);
        window.clarity('set', 'ikimon_action', params.action_key);
        if (params.funnel) window.clarity('set', 'ikimon_funnel', params.funnel);
        if (params.route_key) window.clarity('set', 'ikimon_route', params.route_key);
        window.clarity('event', name);
      }
    } catch (_) {}
  };
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', googleTagId);
  window.ikimonExternalAnalytics = { track: trackExternalAnalytics };

  const googleScript = document.createElement('script');
  googleScript.async = true;
  googleScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(googleTagId);
  document.head.appendChild(googleScript);

  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments);};
    t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, 'clarity', 'script', ${JSON.stringify(IKIMON_CLARITY_PROJECT_ID)});
})();
</script>`;
  const legacyServiceWorkerCleanupScript = `<script>
(function () {
  if (!('serviceWorker' in navigator)) return;
  const legacyCachePrefixes = ['ikimon-pwa-', 'ikimon-offline-', 'ikimon-static-'];
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => {
        const scriptUrl = registration.active && registration.active.scriptURL ? registration.active.scriptURL : '';
        if (scriptUrl && !/\\/sw\\.(php|js)(?:$|[?#])/.test(scriptUrl)) return Promise.resolve(false);
        return registration.unregister();
      })))
      .then(() => {
        if (!('caches' in window)) return undefined;
        return caches.keys().then((keys) => Promise.all(keys
          .filter((key) => legacyCachePrefixes.some((prefix) => key.startsWith(prefix)))
          .map((key) => caches.delete(key))));
      })
      .catch(() => undefined);
  }, { once: true });
})();
</script>`;
  const appRuntimeScript = `<script>
(function () {
  const currentLang = ${JSON.stringify(lang)};
  const supported = { ja: 'ja', en: 'en', es: 'es', pt: 'pt-BR', 'pt-br': 'pt-BR' };
  const languageSuggestionCopy = {
    en: {
      title: 'Use ZUKAN in English?',
      body: 'You can switch the interface. Search indexing stays focused on Japanese.',
      action: 'Switch to English',
      dismiss: 'Keep Japanese'
    },
    es: {
      title: '¿Usar ZUKAN en español?',
      body: 'Puedes cambiar la interfaz. La búsqueda sigue centrada en japonés.',
      action: 'Cambiar a español',
      dismiss: 'Seguir en japonés'
    },
    'pt-BR': {
      title: 'Usar ZUKAN em português?',
      body: 'Voce pode mudar a interface. A busca continua focada em japones.',
      action: 'Mudar para português',
      dismiss: 'Manter japones'
    }
  };
  const storageKeys = {
    lang: 'ikimon:app-lang',
    localeSuggestionDismissed: 'ikimon:locale-suggestion-dismissed-v1',
    installDismissed: 'ikimon:install-dismissed-v1',
    desktopSideNavCollapsed: 'ikimon:desktop-side-nav-collapsed-v1'
  };
  function normalizeLocale(locale) {
    const value = String(locale || '').trim().toLowerCase();
    if (!value) return 'ja';
    if (value === 'pt' || value.indexOf('pt-') === 0) return 'pt-BR';
    if (value.indexOf('en') === 0) return 'en';
    if (value.indexOf('es') === 0) return 'es';
    return 'ja';
  }
  function segmentFor(lang) {
    return lang === 'pt-BR' ? 'pt-br' : lang;
  }
  function isLanguagePrefixed(pathname) {
    return /^\\/(ja|en|es|pt-br)(?:\\/|$)/.test(pathname);
  }
  function localizedRootFor(lang) {
    const params = new URLSearchParams(location.search);
    params.delete('lang');
    params.set('source', 'device_locale');
    const query = params.toString();
    return '/' + segmentFor(lang) + '/' + (query ? '?' + query : '') + location.hash;
  }
  function hideLanguageSuggestion() {
    const suggestion = document.querySelector('[data-language-suggestion]');
    if (suggestion) suggestion.hidden = true;
    document.body.classList.remove('has-language-suggestion');
  }
  function showLanguageSuggestion(deviceLang) {
    const copy = languageSuggestionCopy[deviceLang];
    const suggestion = document.querySelector('[data-language-suggestion]');
    if (!copy || !suggestion) return;
    const title = suggestion.querySelector('[data-language-suggestion-title]');
    const body = suggestion.querySelector('[data-language-suggestion-body]');
    const action = suggestion.querySelector('[data-language-suggestion-action]');
    const dismiss = suggestion.querySelector('[data-language-suggestion-dismiss]');
    if (title) title.textContent = copy.title;
    if (body) body.textContent = copy.body;
    if (action) {
      action.textContent = copy.action;
      action.setAttribute('href', localizedRootFor(deviceLang));
      action.addEventListener('click', () => {
        try {
          localStorage.setItem(storageKeys.lang, deviceLang);
          localStorage.setItem(storageKeys.localeSuggestionDismissed, '1');
        } catch (_) {}
      }, { once: true });
    }
    if (dismiss) {
      dismiss.textContent = copy.dismiss;
      dismiss.setAttribute('aria-label', copy.dismiss);
      dismiss.addEventListener('click', () => {
        hideLanguageSuggestion();
        try {
          localStorage.setItem(storageKeys.lang, currentLang);
          localStorage.setItem(storageKeys.localeSuggestionDismissed, '1');
        } catch (_) {}
      }, { once: true });
    }
    suggestion.hidden = false;
    document.body.classList.add('has-language-suggestion');
  }
  try {
    const deviceLang = normalizeLocale((navigator.languages && navigator.languages[0]) || navigator.language || '');
    document.documentElement.dataset.deviceLang = deviceLang;
    if (isLanguagePrefixed(location.pathname)) {
      localStorage.setItem(storageKeys.lang, currentLang);
    } else if (!localStorage.getItem(storageKeys.lang)) {
      localStorage.setItem(storageKeys.lang, currentLang);
    }
    const explicitLang = new URLSearchParams(location.search).has('lang');
    const suggestionDismissed = localStorage.getItem(storageKeys.localeSuggestionDismissed) === '1';
    if (!explicitLang && !suggestionDismissed && currentLang === 'ja' && location.pathname === '/' && deviceLang !== 'ja') {
      showLanguageSuggestion(deviceLang);
    }
  } catch (_) {}

  const desktopSideNavToggle = document.querySelector('[data-desktop-side-nav-toggle]');
  const isImmersiveSurface = Boolean(document.querySelector('.site-shell.is-immersive-surface'));
  const prefersCollapsedSideNav = Boolean(document.querySelector('.site-shell.is-reading-surface, .shell-records-workbench'));
  function setDesktopSideNavCollapsed(collapsed) {
    document.body.classList.toggle('is-desktop-side-nav-collapsed', collapsed);
    if (desktopSideNavToggle) {
      desktopSideNavToggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
      desktopSideNavToggle.setAttribute('title', collapsed ? '左メニューを広げる' : '左メニューを畳む');
    }
  }
  try {
    setDesktopSideNavCollapsed(isImmersiveSurface || prefersCollapsedSideNav || localStorage.getItem(storageKeys.desktopSideNavCollapsed) === '1');
  } catch (_) {
    setDesktopSideNavCollapsed(isImmersiveSurface || prefersCollapsedSideNav);
  }
  if (desktopSideNavToggle) {
    desktopSideNavToggle.addEventListener('click', () => {
      const nextCollapsed = !document.body.classList.contains('is-desktop-side-nav-collapsed');
      setDesktopSideNavCollapsed(nextCollapsed);
      try {
        if (!isImmersiveSurface) localStorage.setItem(storageKeys.desktopSideNavCollapsed, nextCollapsed ? '1' : '0');
      } catch (_) {}
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/app-sw.js', { scope: '/', updateViaCache: 'none' }).then((registration) => {
        if (registration && typeof registration.update === 'function') {
          return registration.update();
        }
        return undefined;
      }).catch(() => undefined);
      requestAppOutboxSync('startup');
    }, { once: true });
  }

  function dispatchAppOutboxSync(reason) {
    try {
      window.dispatchEvent(new CustomEvent('ikimon-app-outbox-sync', { detail: { reason: reason || 'manual' } }));
    } catch (_) {
      window.dispatchEvent(new Event('ikimon-app-outbox-sync'));
    }
  }
  function requestAppOutboxSync(reason) {
    if (!navigator.onLine) return Promise.resolve(false);
    if (!('serviceWorker' in navigator)) {
      dispatchAppOutboxSync(reason || 'fallback');
      return Promise.resolve(false);
    }
    return navigator.serviceWorker.ready.then((registration) => {
      if (registration && 'sync' in registration && registration.sync && typeof registration.sync.register === 'function') {
        return registration.sync.register('ikimon-app-outbox-sync').then(() => true);
      }
      dispatchAppOutboxSync(reason || 'startup-fallback');
      return false;
    }).catch(() => {
      dispatchAppOutboxSync(reason || 'startup-fallback');
      return false;
    });
  }
  window.ikimonRequestAppOutboxSync = requestAppOutboxSync;
  window.addEventListener('online', () => {
    void requestAppOutboxSync('online');
  });
  window.addEventListener('ikimon-app-outbox-change', () => {
    void requestAppOutboxSync('outbox-change');
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'ikimon:app-outbox-sync') {
        dispatchAppOutboxSync(event.data.reason || 'background-sync');
      }
    });
  }

  const promptEl = document.querySelector('[data-app-install-prompt]');
  const actionEl = document.querySelector('[data-app-install-action]');
  const dismissEl = document.querySelector('[data-app-install-dismiss]');
  let deferredPrompt = null;
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function normalizedInstallPath() {
    try {
      const url = new URL(window.location.href);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0 && ['ja', 'en', 'es', 'pt-br'].includes(segments[0].toLowerCase())) {
        segments.shift();
      }
      return '/' + segments.join('/');
    } catch (_) {
      return window.location.pathname || '/';
    }
  }
  function isMobileInstallSurface() {
    return window.matchMedia('(max-width: 900px) and (pointer: coarse)').matches;
  }
  function isReturnValueInstallSurface() {
    const pathname = normalizedInstallPath().replace(/\\/+$/, '') || '/';
    return pathname === '/' || pathname === '/home' || pathname === '/records' || pathname === '/map' || pathname === '/profile';
  }
  function showInstallPrompt() {
    if (!promptEl || !deferredPrompt || isStandalone() || !isMobileInstallSurface() || !isReturnValueInstallSurface()) return;
    try {
      if (localStorage.getItem(storageKeys.installDismissed) === '1') return;
    } catch (_) {}
    promptEl.hidden = false;
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    window.setTimeout(showInstallPrompt, 0);
  });
  if (dismissEl) dismissEl.addEventListener('click', () => {
    if (promptEl) promptEl.hidden = true;
    try { localStorage.setItem(storageKeys.installDismissed, '1'); } catch (_) {}
  });
  if (actionEl) actionEl.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (_) {}
    deferredPrompt = null;
    if (promptEl) promptEl.hidden = true;
  });
})();
</script>`;
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
    const postEvent = (eventName, actionKey, routeKey, metadata) => {
      const payload = {
        eventName,
        pagePath,
        actionKey,
        routeKey,
        metadata: Object.assign({
          lang: document.documentElement.lang || 'ja',
          ts: new Date().toISOString(),
        }, metadata || {}),
      };
      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => undefined);
      if (window.ikimonExternalAnalytics && typeof window.ikimonExternalAnalytics.track === 'function') {
        window.ikimonExternalAnalytics.track(eventName, payload);
      }
    };
    const sendFirstAction = (actionKey, routeKey) => {
      if (sent) return;
      sent = true;
      try { sessionStorage.setItem(key, '1'); } catch (_) {}
      postEvent('first_action', actionKey, routeKey);
    };
    const sendExplicitClick = (target, actionKey, routeKey) => {
      const eventName = target.getAttribute('data-kpi-event');
      if (!eventName) return;
      postEvent(eventName, actionKey, routeKey, {
        funnel: target.getAttribute('data-kpi-funnel') || '',
        target: target.getAttribute('data-kpi-target') || routeKey || '',
      });
    };

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('a,button') : null;
      if (!target) return;
      const tag = target.tagName.toLowerCase();
      const text = (target.textContent || '').trim().slice(0, 80);
      const href = tag === 'a' ? target.getAttribute('href') || '' : '';
      const routeKey = href && href.startsWith('/') ? href : '';
      const actionKey = target.getAttribute('data-kpi-action') || (text ? text : tag);
      sendExplicitClick(target, actionKey, routeKey);
      sendFirstAction(actionKey, routeKey);
    }, { capture: true, passive: true });
  } catch (_) {}
})();
</script>`;
  return applyCspNonceToScripts(`<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="${APP_THEME_COLOR}" />
  <meta name="application-name" content="ZUKAN" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="ZUKAN" />
  <link rel="manifest" href="${escapeHtml(manifestHref)}" />
  <link rel="apple-touch-icon" sizes="180x180" href="${BRAND_ASSETS.appleTouchIcon}" />
  <link rel="icon" type="image/png" sizes="32x32" href="${BRAND_ASSETS.favicon32}" />
  <link rel="icon" type="image/x-icon" sizes="32x32" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="192x192" href="${BRAND_ASSETS.mark192}" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}" />${robotsMeta}
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
${alternateLinks}
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(xDefaultHref)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ZUKAN" />
  <meta property="og:locale" content="${escapeHtml(ogLocale(lang))}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />${ogImageMeta}${twitterCardMeta}
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />${twitterImageMeta}
  ${structuredDataHtml}
  ${appLaunchHeadScript}
  ${appOutboxHeadScript}
  ${analyticsHeadScript}
  <style>
    :root {
      color-scheme: light;
      --bg: ${APP_LAUNCH_BACKGROUND_COLOR};
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
      --color-warn: #ea580c;
      --color-warn-soft: rgba(234,88,12,.08);
      --color-danger: #dc2626;
      --color-danger-soft: rgba(220,38,38,.08);
      --color-novelty: #a855f7;
      --color-novelty-soft: rgba(168,85,247,.08);
      --color-info: #3b82f6;
      --color-info-soft: rgba(59,130,246,.08);
      --radius-card: 14px;
      --radius-panel: 24px;
      --radius-pill: 999px;
      --shadow-card: 0 8px 24px rgba(15,23,42,.06);
      --space-card: clamp(16px, 2vw, 24px);
      --ikimon-page-max: 1480px;
      --ikimon-content-max: 1240px;
      --ikimon-reading-max: 880px;
      --ikimon-form-max: 760px;
      --ikimon-page-inline: clamp(24px, 3.4vw, 48px);
      --ikimon-desktop-sidebar-w: 0px;
      --ikimon-shell-margin-left: auto;
      --ikimon-shell-margin-right: auto;
    }
    .app-launch-screen {
      position: fixed;
      inset: 0;
      z-index: 120;
      display: none;
      place-items: center;
      padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left));
      background:
        radial-gradient(circle at 50% 44%, rgba(255,255,255,.82), rgba(255,255,255,0) 32%),
        ${APP_LAUNCH_BACKGROUND_COLOR};
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
    }
    .app-launch-mark {
      width: 76px;
      height: 76px;
      display: grid;
      place-items: center;
      border-radius: 22px;
      background: rgba(255,255,255,.7);
      box-shadow: 0 18px 42px rgba(15,23,42,.08), inset 0 0 0 1px rgba(255,255,255,.74);
    }
    .app-launch-mark img {
      width: 48px;
      height: 48px;
      display: block;
      object-fit: contain;
      opacity: .86;
    }
    .is-app-launch-screen-eligible .app-launch-screen {
      display: grid;
      animation: appLaunchScreenFade .86s ease-out both;
    }
    .is-app-launch-screen-eligible .app-launch-mark {
      animation: appLaunchMarkBreath .86s ease-out both;
    }
    @keyframes appLaunchScreenFade {
      0%, 64% { opacity: 1; visibility: visible; }
      100% { opacity: 0; visibility: hidden; }
    }
    @keyframes appLaunchMarkBreath {
      0% { opacity: .72; transform: scale(.985); }
      38% { opacity: .9; transform: scale(1.012); }
      100% { opacity: 0; transform: scale(.992); }
    }
    @media (prefers-reduced-motion: reduce) {
      .is-app-launch-screen-eligible .app-launch-screen,
      .is-app-launch-screen-eligible .app-launch-mark {
        animation: none !important;
      }
      .is-app-launch-screen-eligible .app-launch-screen {
        opacity: 0;
        visibility: hidden;
      }
    }
    .detail-card { background: var(--surface-strong); border: 1px solid var(--border); border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-card); }
    .detail-card + .detail-card { margin-top: 14px; }
    .detail-card-title { margin: 0 0 8px; font-size: 16px; font-weight: 800; color: var(--ink); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .detail-card-body { color: var(--ink); line-height: 1.65; }
    .detail-card-meta { margin-top: 8px; color: var(--muted); font-size: 13px; }
    .detail-card-hedge { margin-top: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(15,23,42,.04); color: var(--muted); font-size: 12.5px; }
    .detail-card--lens-size { border-left: 4px solid var(--color-info); }
    .detail-card--lens-novelty { border-left: 4px solid var(--color-novelty); background: linear-gradient(180deg, var(--color-novelty-soft), transparent 70%); }
    .detail-card--lens-invasive { border-left: 4px solid var(--color-danger); background: var(--color-danger-soft); }
    .detail-pill { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: var(--radius-pill); font-size: 12px; font-weight: 800; }
    .detail-pill--iaspecified { background: var(--color-danger); color: #fff; }
    .detail-pill--priority { background: var(--color-warn); color: #fff; }
    .detail-pill--industrial { background: #ca8a04; color: #fff; }
    .detail-pill--prevention { background: #6b7280; color: #fff; }
    .detail-pill--native { background: #16a34a; color: #fff; }
    .detail-pill--exceptional { background: var(--color-info); color: #fff; }
    .detail-pill--novelty { background: var(--color-novelty); color: #fff; }
    .detail-action-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    .detail-action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface-strong); color: var(--ink); font-weight: 700; font-size: 13px; text-decoration: none; cursor: pointer; }
    .detail-action-btn:hover { background: var(--accent-soft); }
    .detail-action-btn--danger { background: var(--color-danger); color: #fff; border-color: transparent; }
    .detail-action-btn--danger:hover { background: #b91c1c; }
    .detail-warning-box { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: rgba(220,38,38,.08); border: 1px solid rgba(220,38,38,.18); color: #7f1d1d; font-size: 13.5px; font-weight: 600; }
    .detail-evidence-list { margin: 6px 0 0; padding-left: 20px; }
    .detail-evidence-list li { margin: 4px 0; }
    .detail-evidence-list li.is-positive::marker { content: "\\2713  "; color: var(--accent); }
    .detail-evidence-list li.is-negative::marker { content: "\\2717  "; color: var(--color-warn); }
    /* 折りたたみ全面禁止の保険 (.detail-card 配下) */
    .detail-card details, .detail-card summary { display: revert; }
    .detail-card details { all: unset; }
    .detail-card summary { all: unset; }
    /* 同定パネル */
    .ident-panel { background: var(--surface-strong); border: 1px solid var(--border); border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-card); }
    .ident-panel-header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .ident-panel-name { margin: 0; font-size: 22px; font-weight: 900; color: var(--ink); }
    .ident-panel-sci { color: var(--muted); font-style: italic; font-size: 15px; }
    .ident-panel-band { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: var(--radius-pill); font-size: 12.5px; font-weight: 800; background: var(--accent-soft); color: var(--accent-hover); }
    .ident-panel-band.is-low { background: rgba(234,88,12,.10); color: #9a3412; }
    .ident-panel-band.is-medium { background: rgba(59,130,246,.10); color: #1e3a8a; }
    .ident-panel-section { margin-top: 14px; }
    .ident-panel-section h4 { margin: 0 0 6px; font-size: 14px; font-weight: 800; color: var(--ink); }
    .ident-panel-similar { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .ident-panel-similar-card { padding: 10px 12px; border-radius: 10px; background: rgba(15,23,42,.03); border: 1px solid var(--border); font-size: 13.5px; }
    .ident-panel-similar-card strong { display: block; font-weight: 800; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif;
      color: var(--ink);
      line-break: strict;
      background:
        radial-gradient(circle at top left, rgba(16,185,129,.07), transparent 36%),
        radial-gradient(circle at top right, rgba(14,165,233,.05), transparent 30%),
        linear-gradient(180deg, #f9fffe 0%, var(--bg) 100%);
    }
    a { color: inherit; text-decoration: none; }
    .site-shell { min-height: 100vh; }
    .shell {
      --ikimon-shell-target-max: var(--ikimon-content-max);
      width: min(var(--ikimon-shell-target-max), calc(100% - var(--ikimon-page-inline)));
      max-width: none;
      margin: 0 var(--ikimon-shell-margin-right) 0 var(--ikimon-shell-margin-left);
      padding: 28px 0 24px;
      transition: width .18s ease, margin .18s ease;
    }
    .shell.shell-layout-home,
    .shell.shell-layout-immersive {
      --ikimon-shell-target-max: var(--ikimon-page-max);
    }
    .shell.shell-layout-wide {
      --ikimon-shell-target-max: var(--ikimon-content-max);
    }
    .shell.shell-layout-reading {
      --ikimon-shell-target-max: var(--ikimon-reading-max);
    }
    .shell.shell-layout-narrow {
      --ikimon-shell-target-max: var(--ikimon-form-max);
    }
    .shell.shell-bleed {
      max-width: none;
      padding: 22px 0 24px;
    }
    .shell.shell-map {
      width: 100%;
      padding: 0;
      max-width: none;
    }
    .md-hidden { display: none; }
    .site-header { position: sticky; top: 0; z-index: 90; width: 100%; max-width: 100%; overflow: visible; backdrop-filter: blur(18px); background: rgba(249,255,254,.92); border-bottom: 1px solid rgba(15,23,42,.05); }
    .site-header-inner { width: min(var(--ikimon-page-max), calc(100% - var(--ikimon-page-inline))); max-width: none; min-width: 0; margin: 0 auto; padding: 10px 0; display: flex; align-items: center; gap: 14px; justify-content: space-between; flex-wrap: nowrap; box-sizing: border-box; transition: width .18s ease, margin .18s ease, grid-template-columns .18s ease; }
    .site-brand-cluster { display: inline-flex; align-items: center; gap: 8px; min-width: 0; transition: width .18s ease; }
    .desktop-side-nav-toggle {
      display: none;
      width: 44px;
      height: 44px;
      flex: 0 0 44px;
      place-items: center;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #0f172a;
      cursor: pointer;
      transition: background .16s ease, color .16s ease, transform .16s ease;
    }
    .desktop-side-nav-toggle:hover { background: rgba(15,23,42,.06); }
    .desktop-side-nav-toggle-lines,
    .desktop-side-nav-toggle-lines::before,
    .desktop-side-nav-toggle-lines::after {
      display: block;
      width: 18px;
      height: 2px;
      border-radius: 999px;
      background: currentColor;
    }
    .desktop-side-nav-toggle-lines { position: relative; }
    .desktop-side-nav-toggle-lines::before,
    .desktop-side-nav-toggle-lines::after {
      content: "";
      position: absolute;
      left: 0;
    }
    .desktop-side-nav-toggle-lines::before { top: -6px; }
    .desktop-side-nav-toggle-lines::after { top: 6px; }
    .brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; max-width: 300px; flex: 1 1 220px; }
    .brand-logo-lockup {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      gap: 7px;
      padding: 3px 8px 3px 2px;
      border-radius: 999px;
      color: #0f172a;
      transition: background .16s ease, transform .16s ease;
    }
    .brand:hover .brand-logo-lockup {
      background: rgba(15,23,42,.04);
    }
    .brand-mark { width: 38px; height: 38px; flex: 0 0 38px; aspect-ratio: 1 / 1; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 8px 18px rgba(15,23,42,.07); background: white; }
    .brand-mark img { width: 100%; height: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; }
    .brand-logo-lockup .brand-mark {
      width: 36px;
      height: 36px;
      flex-basis: 36px;
      border-radius: 10px;
      padding: 0;
      box-shadow: 0 7px 16px rgba(15,23,42,.10);
    }
    .brand-wordmark {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      min-width: 0;
      width: auto;
      height: 16px;
      aspect-ratio: 711 / 222;
      line-height: 1;
      white-space: nowrap;
      letter-spacing: 0;
    }
    .brand-wordmark-img {
      display: block;
      width: auto;
      height: 100%;
      max-width: none;
      object-fit: contain;
      object-position: left center;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 950;
      color: #0f172a;
    }
    .brand-domain {
      margin-left: 1px;
      font-size: 12px;
      font-weight: 850;
      color: #0f766e;
    }
    .brand > span:last-child { min-width: 0; }
    .brand strong { display: block; font-size: 15px; font-weight: 900; }
    .brand small { display: block; max-width: 100%; margin-top: 2px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .site-nav { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; flex-wrap: nowrap; }
    .site-nav-link { display: inline-flex; align-items: center; min-height: 40px; padding: 9px 9px; border-radius: 999px; background: transparent; border: 0; font-weight: 750; font-size: 13.5px; color: #475569; white-space: nowrap; }
    .site-nav-link:hover { background: rgba(15,23,42,.04); }
    .site-nav-link.is-active { color: #047857; background: #ecfdf5; }
    .site-core-nav { gap: 3px; }
    .site-core-nav-link {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 11px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #334155;
      font: inherit;
      font-size: 13px;
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
    }
    .site-core-nav-link.is-capture { min-height: 48px; padding-inline: 16px; background: #087a4d; color: #fff; box-shadow: 0 8px 18px rgba(8,122,77,.18); }
    .site-core-nav-link[aria-current="page"] { color: #065f46; box-shadow: inset 0 -3px #087a4d; }
    .site-header-actions { display: flex; gap: 8px; flex: 0 0 auto; flex-wrap: nowrap; align-items: center; }
    .site-header-actions-mobile { display: none; }
    .site-account-icons {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px;
      border-radius: 999px;
      background: rgba(255,255,255,.9);
      border: 1px solid rgba(148,163,184,.24);
      box-shadow: 0 8px 20px rgba(15,23,42,.05);
    }
    .site-account-icon {
      width: 36px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      color: #334155;
      border: 0;
      background: transparent;
      cursor: pointer;
      transition: background .16s ease, color .16s ease;
    }
    .site-account-icon:hover {
      background: #ecfdf5;
      color: #047857;
    }
    .site-account-icon .desktop-side-nav-icon {
      width: 19px;
      height: 19px;
      flex-basis: 19px;
    }
    .site-notification-menu {
      position: relative;
      display: inline-flex;
    }
    .site-notification-button[aria-expanded="true"] {
      background: #ecfdf5;
      color: #047857;
    }
    .site-notification-badge {
      position: absolute;
      top: 4px;
      right: 3px;
      min-width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border-radius: 999px;
      background: #dc2626;
      color: #fff;
      font-size: 10px;
      line-height: 1;
      font-weight: 950;
      border: 2px solid #fff;
    }
    .site-notification-badge[hidden] { display: none; }
    .site-notification-panel {
      position: absolute;
      z-index: 120;
      top: calc(100% + 10px);
      right: -46px;
      width: min(330px, calc(100vw - 24px));
      padding: 10px;
      border-radius: 14px;
      background: #ffffff;
      border: 1px solid rgba(15,23,42,.1);
      box-shadow: 0 22px 48px rgba(15,23,42,.16);
    }
    .site-notification-head {
      min-height: 34px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 4px 8px;
      border-bottom: 1px solid rgba(15,23,42,.08);
    }
    .site-notification-head strong {
      color: #0f172a;
      font-size: 14px;
      font-weight: 950;
    }
    .site-notification-head a,
    .site-notification-head button {
      color: #047857;
      font-size: 12px;
      font-weight: 900;
    }
    .site-notification-head button {
      border: 0;
      background: #ecfdf5;
      border-radius: 999px;
      min-height: 28px;
      padding: 0 10px;
      cursor: pointer;
    }
    .site-notification-head button[disabled] {
      opacity: .55;
      cursor: wait;
    }
    .site-notification-list {
      display: grid;
      gap: 6px;
      padding-top: 8px;
    }
    .site-notification-item {
      display: grid;
      gap: 3px;
      padding: 10px;
      border-radius: 10px;
      background: #f8fafc;
      color: #0f172a;
    }
    .site-notification-item:hover {
      background: #ecfdf5;
    }
    .site-notification-item.is-unread {
      border: 1px solid rgba(14,165,233,.22);
      background: #f0f9ff;
    }
    .site-notification-item strong {
      font-size: 13px;
      line-height: 1.35;
      font-weight: 950;
    }
    .site-notification-item em {
      width: fit-content;
      margin-top: 2px;
      padding: 2px 7px;
      border-radius: 999px;
      background: #dc2626;
      color: #fff;
      font-size: 10px;
      line-height: 1;
      font-style: normal;
      font-weight: 950;
    }
    .site-notification-item span,
    .site-notification-empty {
      color: #64748b;
      font-size: 12px;
      line-height: 1.45;
      font-weight: 750;
    }
    .site-notification-empty {
      padding: 12px 10px;
      border-radius: 10px;
      background: #f8fafc;
    }
    .site-login-link.is-authenticated { color: #047857; background: #ecfdf5; border-color: rgba(16,185,129,.18); }
    .site-record-link { white-space: nowrap; }
    .is-reading-surface .site-record-link { display: none; }
    .site-search {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding: 0 14px;
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
      min-height: 44px;
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
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0;
      border-radius: 999px;
      background: rgba(255,255,255,.88);
      border: 1px solid rgba(148,163,184,.24);
      box-shadow: 0 8px 20px rgba(15,23,42,.05);
    }
    .lang-switch::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 100%;
      height: 10px;
      display: none;
    }
    .lang-switch:hover::after,
    .lang-switch:focus-within::after {
      display: block;
    }
    .lang-switch-label,
    .lang-switch-options {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .lang-switch-label {
      min-height: 40px;
      padding: 0 11px;
      color: #334155;
      font-size: 12px;
      font-weight: 850;
      line-height: 1;
      white-space: nowrap;
    }
    .lang-switch-current {
      min-width: 18px;
      text-align: center;
      letter-spacing: .04em;
    }
    .lang-switch-label .desktop-side-nav-icon {
      width: 17px;
      height: 17px;
      color: #047857;
    }
    .lang-switch-options {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 20;
      display: none;
      padding: 4px;
      border: 1px solid rgba(148,163,184,.24);
      border-radius: 999px;
      background: rgba(255,255,255,.96);
      box-shadow: 0 18px 38px rgba(15,23,42,.14);
    }
    .lang-switch:hover .lang-switch-options,
    .lang-switch:focus-within .lang-switch-options {
      display: inline-flex;
    }
    .lang-switch-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 36px;
      min-height: 40px;
      padding: 0 9px;
      border-radius: 999px;
      color: #475569;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .04em;
    }
    .lang-switch-name {
      display: none;
      letter-spacing: 0;
      font-weight: 800;
    }
    .lang-switch-code {
      flex: 0 0 auto;
      white-space: nowrap;
    }
    .lang-switch-link.is-active {
      background: linear-gradient(135deg, rgba(16,185,129,.14), rgba(14,165,233,.14));
      color: #0f172a;
    }
    .site-mobile-menu { display: none; }
    .desktop-side-nav { display: none; }
    .desktop-side-nav-inner,
    .desktop-side-nav-directory {
      display: grid;
      gap: 4px;
    }
    .desktop-side-nav-section {
      display: grid;
      gap: 4px;
    }
    .desktop-side-nav-section--signed-in {
      display: none;
    }
    html[data-auth="signed-in"] .desktop-side-nav-section--signed-in {
      display: grid;
    }
    html[data-auth="signed-in"] .desktop-side-nav-section--guest {
      display: none;
    }
    .desktop-side-nav-section + .desktop-side-nav-section,
    .desktop-side-nav-legal {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(15,23,42,.08);
    }
    .desktop-side-nav-section-title {
      margin: 0;
      padding: 8px 14px 4px;
      color: #64748b;
      font-size: 11px;
      line-height: 1.3;
      font-weight: 950;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .desktop-side-nav-section--primary .desktop-side-nav-section-title {
      padding-top: 4px;
      color: #047857;
    }
    .side-nav-collapsible-summary {
      list-style: none;
      min-height: 44px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }
    .side-nav-collapsible-summary::-webkit-details-marker { display: none; }
    .side-nav-collapsible-summary::after {
      content: "";
      width: 7px;
      height: 7px;
      border-right: 2px solid #94a3b8;
      border-bottom: 2px solid #94a3b8;
      transform: rotate(-45deg);
      transition: transform .15s ease;
      flex-shrink: 0;
    }
    .side-nav-collapsible[open] > .side-nav-collapsible-summary::after { transform: rotate(45deg); }
    .side-nav-collapsible-summary:hover { color: #0f172a; }
    .desktop-side-nav-link {
      min-height: 44px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 14px;
      border-radius: 10px;
      color: #334155;
      font-size: 14px;
      font-weight: 850;
      letter-spacing: 0;
      position: relative;
      overflow: hidden;
      transition: background .16s ease, color .16s ease, box-shadow .16s ease, width .18s ease, padding .18s ease, gap .18s ease;
    }
    .desktop-side-nav-link::before {
      content: "";
      position: absolute;
      left: 6px;
      top: 10px;
      bottom: 10px;
      width: 3px;
      border-radius: 999px;
      background: #10b981;
      opacity: 0;
      transform: scaleY(.45);
      transition: opacity .16s ease, transform .16s ease;
    }
    .desktop-side-nav-link:hover { background: rgba(15,23,42,.05); }
    .desktop-side-nav-link.is-active {
      background: linear-gradient(90deg, rgba(236,253,245,.96), rgba(248,255,252,.82));
      color: #047857;
      box-shadow: inset 0 0 0 1px rgba(16,185,129,.12);
    }
    .desktop-side-nav-link.is-active::before {
      opacity: 1;
      transform: scaleY(1);
    }
    .desktop-side-nav-link.site-login-link {
      margin-top: 8px;
    }
    .desktop-side-nav-text-links {
      display: grid;
      gap: 2px;
    }
    .desktop-side-nav-text-link {
      min-height: 44px;
      display: flex;
      align-items: center;
      padding: 7px 14px;
      border-radius: 10px;
      color: #334155;
      font-size: 13px;
      line-height: 1.35;
      font-weight: 800;
      transition: background .16s ease, color .16s ease;
    }
    .desktop-side-nav-text-link:hover {
      background: rgba(15,23,42,.05);
    }
    .desktop-side-nav-text-link.is-active {
      background: #ecfdf5;
      color: #047857;
    }
    .desktop-side-nav-text-link--personalized {
      color: #0f766e;
      background: rgba(236,253,245,.72);
    }
    .desktop-side-nav-personalized-list {
      display: grid;
      gap: 5px;
    }
    .desktop-side-nav-mini-summary {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 2px 10px 2px;
      padding: 6px 9px;
      border-radius: 10px;
      background: #eff6ff;
      color: #1e3a8a;
      font-size: 11px;
      font-weight: 900;
    }
    .desktop-side-nav-mini-summary strong {
      min-width: 22px;
      height: 22px;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      background: #2563eb;
      color: #fff;
      font-size: 11px;
    }
    .desktop-side-nav-mini-card {
      display: grid;
      gap: 3px;
      min-height: 48px;
      margin: 0 8px;
      padding: 9px 10px;
      border-radius: 12px;
      background: #f0fdfa;
      border: 1px solid rgba(20,184,166,.14);
      color: #0f172a;
      transition: background .16s ease, border-color .16s ease;
    }
    .desktop-side-nav-mini-card:hover {
      background: #ecfdf5;
      border-color: rgba(5,150,105,.24);
    }
    .desktop-side-nav-mini-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      line-height: 1.25;
      font-weight: 950;
    }
    .desktop-side-nav-mini-meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #0f766e;
      font-size: 10.5px;
      line-height: 1.25;
      font-weight: 850;
    }
    .desktop-side-nav-personalized-empty {
      margin: 4px 10px 0;
      padding: 9px 10px;
      border-radius: 10px;
      background: #f8fafc;
      color: #64748b;
      font-size: 11px;
      line-height: 1.45;
      font-weight: 750;
    }
    .desktop-side-nav-legal {
      display: grid;
      gap: 3px;
      padding: 12px 14px 2px;
      color: #94a3b8;
      font-size: 11px;
      line-height: 1.45;
      font-weight: 750;
    }
    .desktop-side-nav-legal span:first-child {
      color: #64748b;
      font-weight: 950;
    }
    .desktop-side-nav-icon {
      width: 21px;
      height: 21px;
      flex: 0 0 21px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      position: relative;
      z-index: 1;
    }
    .desktop-side-nav-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      position: relative;
      z-index: 1;
      transition: opacity .12s ease;
    }
    .site-mobile-menu-account {
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.24);
      background: #ecfdf5;
      color: #047857;
      font-size: 13px;
      font-weight: 900;
    }
    .site-mobile-account-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
    }
    .site-mobile-account-actions {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.24);
      background: #ffffff;
    }
    .site-mobile-account-actions .site-account-icon {
      width: 34px;
      height: 34px;
    }
    .site-mobile-account-actions .site-notification-panel {
      right: -6px;
    }
    .site-mobile-return-links {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .site-mobile-return-link {
      min-height: 54px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      justify-content: center;
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid rgba(13,148,136,.28);
      background: linear-gradient(180deg, #f0fdfa, #ecfdf5);
      color: #0f766e;
      font-size: 13px;
      font-weight: 950;
      text-align: center;
      line-height: 1.2;
      box-shadow: 0 8px 18px rgba(15,118,110,.08);
    }
    .site-mobile-return-link .desktop-side-nav-icon {
      width: 18px;
      height: 18px;
      flex: 0 0 18px;
      color: #0f766e;
    }
    .site-mobile-menu-toggle { list-style: none; }
    .site-mobile-menu-toggle::-webkit-details-marker { display: none; }
    .site-mobile-menu-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      width: 42px;
      min-height: 40px;
      padding: 0;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.28);
      background: rgba(255,255,255,.94);
      color: #0f172a;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 8px 18px rgba(15,23,42,.06);
      transition: background .16s ease, color .16s ease, box-shadow .16s ease, transform .16s ease;
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
      z-index: 2;
      top: calc(100% + 9px);
      right: 0;
      width: min(340px, calc(100vw - 28px));
      max-height: calc(100dvh - 76px);
      padding: 12px;
      border-radius: 20px;
      border: 1px solid rgba(148,163,184,.22);
      background: #ffffff;
      box-shadow: 0 20px 42px rgba(15,23,42,.16);
      display: grid;
      gap: 12px;
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }
    .site-mobile-menu-directory {
      display: grid;
      gap: 8px;
      max-height: min(68vh, 640px);
      overflow-y: auto;
      padding-right: 2px;
    }
    .site-mobile-menu-section {
      display: grid;
      gap: 4px;
    }
    .site-mobile-menu-section.desktop-side-nav-section--signed-in {
      display: none;
    }
    html[data-auth="signed-in"] .site-mobile-menu-section.desktop-side-nav-section--signed-in {
      display: grid;
    }
    html[data-auth="signed-in"] .site-mobile-menu-section.desktop-side-nav-section--guest {
      display: none;
    }
    .site-mobile-menu-section + .site-mobile-menu-section,
    .site-mobile-menu-directory .desktop-side-nav-legal {
      margin-top: 6px;
      padding-top: 8px;
      border-top: 1px solid rgba(15,23,42,.08);
    }
    .site-mobile-menu-directory .desktop-side-nav-link {
      width: 100%;
      min-height: 42px;
      border-radius: 12px;
      background: rgba(15,23,42,.04);
    }
    .site-mobile-menu-directory .desktop-side-nav-link.is-active,
    .site-mobile-menu-directory .desktop-side-nav-text-link.is-active {
      background: #ecfdf5;
      color: #047857;
    }
    .site-mobile-menu-directory .desktop-side-nav-section-title {
      padding: 6px 10px 2px;
    }
    .site-mobile-menu-directory .desktop-side-nav-text-link {
      min-height: 36px;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(248,250,252,.9);
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
      display: grid;
      gap: 8px;
      justify-content: stretch;
    }
    .lang-switch-mobile {
      display: grid;
      justify-items: stretch;
      max-width: 100%;
      border-radius: 18px;
      background: #ffffff;
      box-shadow: none;
    }
    .lang-switch-mobile .lang-switch-label {
      justify-content: flex-start;
      min-height: 34px;
      padding: 0 6px;
    }
    .lang-switch-mobile .lang-switch-options {
      position: static;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .lang-switch-mobile .lang-switch-link {
      justify-content: flex-start;
      min-width: 0;
      padding: 0 10px;
      letter-spacing: 0;
    }
    .lang-switch-mobile .lang-switch-name {
      display: inline;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 16px; border-radius: 999px; font-weight: 850; border: 1px solid transparent; text-align: center; line-height: 1.25; }
    .btn-solid { background: #059669; color: white; box-shadow: 0 9px 20px rgba(5,150,105,.18); }
    .btn-solid-on-light { background: #059669; color: white; box-shadow: 0 10px 22px rgba(5,150,105,.18); }
    .btn-ghost { background: rgba(255,255,255,.86); border-color: var(--border); color: var(--ink); }
    .btn-ghost-on-dark { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.32); color: white; backdrop-filter: blur(4px); }
    .btn.secondary { background: rgba(255,255,255,.88); border-color: var(--border); color: var(--ink); }
    .skip-link {
      position: absolute;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      left: 12px;
      top: 0;
      transform: translateY(-150%);
      z-index: 100;
      padding: 10px 14px;
      border-radius: 10px;
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      transition: transform .15s ease;
    }
    .skip-link:focus-visible { top: 10px; transform: translateY(0); }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .site-shell.is-map-surface .site-search-desktop { display: none; }
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
      border-radius: var(--radius-panel);
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
    .hero-copy,
    .card,
    .state-card,
    .detail-card,
    .row,
    .footer-group,
    .site-mobile-menu-panel {
      overflow-wrap: anywhere;
    }
    .state-card {
      padding: var(--space-card);
      border-radius: var(--radius-panel);
      background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(240,249,255,.94));
      border: 1px solid rgba(16,185,129,.18);
      box-shadow: 0 16px 36px rgba(15,23,42,.06);
    }
    .state-card h2 {
      margin-bottom: 0;
      font-size: clamp(21px, 2.8vw, 28px);
      line-height: 1.35;
      letter-spacing: 0;
    }
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
      width: min(var(--ikimon-page-max), calc(100% - var(--ikimon-page-inline)));
      margin: 0 auto;
      display: grid;
      gap: 18px;
      padding: clamp(36px, 6vw, 72px) 0 26px;
      transition: width .18s ease, margin .18s ease;
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
      left: max(8px, env(safe-area-inset-left));
      right: max(8px, env(safe-area-inset-right));
      bottom: max(6px, env(safe-area-inset-bottom));
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
      border: 0;
      font-family: inherit;
      cursor: pointer;
    }
    .global-record-choice.is-primary {
      min-height: 66px;
      margin-top: -10px;
      margin-bottom: 2px;
      border-radius: 21px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid rgba(8,122,77,.18);
      box-shadow: 0 10px 24px rgba(8,122,77,.16);
    }
    .global-record-choice.is-active,
    .global-record-choice[aria-current="page"] {
      color: #065f46;
      background: #f0f7f2;
      box-shadow: inset 0 -3px #087a4d;
    }
    .global-record-choice > span:last-child {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
      width: 36px;
      height: 36px;
      flex-basis: 36px;
      background: #087a4d;
      color: #fff;
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
    .global-record-camera-backdrop {
      position: fixed;
      inset: 0;
      z-index: 130;
      background: rgba(15,23,42,.22);
      backdrop-filter: blur(3px);
    }
    .global-record-camera-backdrop[hidden],
    .global-record-camera-sheet[hidden] {
      display: none;
    }
    .global-record-camera-open .global-record-launcher {
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px);
    }
    .global-record-camera-sheet {
      position: fixed;
      --global-record-camera-actions-space: 104px;
      left: calc(12px + var(--global-record-visual-left, 0px));
      right: calc(12px + var(--global-record-visual-right, 0px));
      top: calc(max(12px, env(safe-area-inset-top)) + var(--global-record-visual-top, 0px));
      bottom: calc(max(12px, calc(env(safe-area-inset-bottom) + 12px)) + var(--global-record-visual-bottom, 0px));
      z-index: 131;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto auto auto auto;
      gap: 10px;
      padding: 10px 10px calc(10px + var(--global-record-camera-actions-space));
      overflow-y: auto;
      overscroll-behavior: contain;
      border-radius: 18px;
      background: rgba(255,255,255,.98);
      border: 1px solid rgba(15,23,42,.1);
      box-shadow: 0 24px 70px rgba(15,23,42,.28);
    }
    .global-record-camera-head {
      padding-right: 50px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .global-record-camera-head strong {
      display: block;
      color: #0f172a;
      font-size: 16px;
      line-height: 1.35;
    }
    .global-record-camera-head p {
      display: none;
    }
    .global-record-camera-modes {
      display: inline-flex;
      gap: 4px;
      margin-top: 6px;
      padding: 3px;
      border-radius: 999px;
      background: #eef4f0;
    }
    .global-record-camera-modes button {
      min-width: 64px;
      min-height: 36px;
      padding: 6px 12px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #475569;
      font: inherit;
      font-size: 13px;
      font-weight: 850;
      cursor: pointer;
    }
    .global-record-camera-modes button[aria-pressed="true"] {
      background: #fff;
      color: #065f46;
      box-shadow: 0 1px 5px rgba(15,23,42,.12);
    }
    .global-record-camera-close {
      position: fixed;
      top: calc(max(18px, env(safe-area-inset-top)) + var(--global-record-visual-top, 0px));
      right: calc(18px + var(--global-record-visual-right, 0px));
      z-index: 133;
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 999px;
      background: rgba(15,23,42,.82);
      color: #fff;
      font: inherit;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 12px 32px rgba(15,23,42,.28);
      backdrop-filter: blur(14px);
    }
    .global-record-camera-preview {
      position: relative;
      min-height: 0;
      height: clamp(260px, min(72dvh, calc(var(--global-record-visual-height, 100dvh) - 212px)), 760px);
      overflow: hidden;
      touch-action: none;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(239,246,255,.92));
      border: 1px solid rgba(15,23,42,.08);
    }
    .global-record-camera-preview video,
    .global-record-camera-preview img {
      width: 100%;
      height: 100%;
      min-height: 0;
      display: block;
      object-fit: contain;
      background: #020617;
    }
    .global-record-camera-preview video[hidden],
    .global-record-camera-preview img[hidden] {
      display: none;
    }
    .global-record-camera-sheet[data-active-kind="photo"] .global-record-camera-preview {
      order: 1;
    }
    .global-record-camera-sheet[data-active-kind="photo"] .global-record-photo-tray {
      order: 2;
    }
    .global-record-camera-sheet[data-camera-active="true"] {
      overflow: hidden;
    }
    .global-record-camera-sheet[data-camera-active="true"] .global-record-photo-tray {
      display: none;
    }
    .global-record-camera-sheet[data-camera-active="true"] .global-record-camera-preview {
      height: clamp(300px, min(76dvh, calc(var(--global-record-visual-height, 100dvh) - 188px)), 780px);
    }
    .global-record-camera-sheet[data-active-kind="photo"] .global-record-camera-status {
      order: 3;
    }
    .global-record-camera-sheet[data-active-kind="photo"] .global-record-inline-edit {
      order: 4;
    }
    .global-record-camera-sheet[data-photo-draft="true"] .global-record-camera-preview {
      display: none;
    }
    .global-record-camera-sheet[data-photo-draft="true"] {
      grid-template-rows: auto auto auto auto auto;
      align-content: start;
    }
    .global-record-camera-empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 22px;
      text-align: center;
      color: #475569;
      font-size: 13px;
      line-height: 1.65;
      font-weight: 850;
    }
    .global-record-camera-empty[hidden] {
      display: none;
    }
    .global-record-camera-zoom {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 12px;
      z-index: 3;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(15,23,42,.72);
      color: #fff;
      box-shadow: 0 12px 34px rgba(15,23,42,.28);
      backdrop-filter: blur(14px);
    }
    .global-record-camera-zoom[hidden] {
      display: none;
    }
    .global-record-camera-zoom label {
      display: grid;
      gap: 7px;
      font-size: 12px;
      font-weight: 950;
      line-height: 1.25;
    }
    .global-record-camera-zoom label span {
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }
    .global-record-camera-zoom input {
      width: 100%;
      accent-color: #34d399;
    }
    .global-record-camera-zoom button {
      min-width: 58px;
      min-height: 42px;
      border: 0;
      border-radius: 12px;
      background: #34d399;
      color: #052e16;
      font: inherit;
      font-size: 13px;
      font-weight: 950;
      cursor: pointer;
    }
    .global-record-camera-zoom button:disabled {
      opacity: .58;
      cursor: default;
    }
    .global-record-photo-tray {
      display: grid;
      gap: 9px;
      min-width: 0;
      padding: 10px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid rgba(15,23,42,.08);
      overflow: hidden;
    }
    .global-record-photo-tray[hidden] {
      display: none;
    }
    .global-record-photo-tray-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: #475569;
      font-size: 11px;
      line-height: 1.35;
      font-weight: 850;
    }
    .global-record-photo-tray-head strong {
      color: #0f172a;
      font-size: 13px;
      font-weight: 950;
    }
    .global-record-photo-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 7px;
      min-width: 0;
    }
    .global-record-photo-cell {
      position: relative;
      min-width: 0;
      min-height: 0;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 8px;
      background: #e2e8f0;
      border: 1px solid rgba(15,23,42,.08);
    }
    .global-record-photo-cell img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      max-width: 100%;
      object-fit: cover;
      display: block;
    }
    .global-record-photo-cell span {
      position: absolute;
      left: 4px;
      top: 4px;
      min-width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: rgba(15,23,42,.82);
      color: #fff;
      font-size: 10px;
      font-weight: 950;
    }
    .global-record-photo-cell-actions {
      position: absolute;
      left: 4px;
      right: 4px;
      bottom: 4px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 3px;
    }
    .global-record-photo-cell-actions button {
      min-width: 0;
      min-height: 24px;
      border: 0;
      border-radius: 7px;
      background: rgba(255,255,255,.92);
      color: #0f172a;
      font: inherit;
      font-size: 11px;
      line-height: 1;
      font-weight: 950;
      cursor: pointer;
    }
    .global-record-photo-cell-actions button:disabled {
      opacity: .42;
      cursor: default;
    }
    .global-record-camera-status {
      min-height: 18px;
      color: #0f766e;
      font-size: 12px;
      line-height: 1.5;
      font-weight: 850;
    }
    .global-record-saved-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .global-record-saved-actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 7px 12px;
      border-radius: 999px;
      background: #ecfdf5;
      border: 1px solid rgba(13,148,136,.24);
      color: #0f766e;
      text-decoration: none;
      font-size: 12px;
      font-weight: 950;
    }
    .global-record-inline-edit {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 16px;
      background: rgba(255,255,255,.88);
      border: 1px solid rgba(15,23,42,.1);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.65);
    }
    .global-record-inline-edit[hidden] {
      display: none;
    }
    .global-record-inline-edit-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .global-record-inline-edit-head strong {
      color: #0f172a;
      font-size: 13px;
      line-height: 1.4;
      font-weight: 950;
    }
    .global-record-inline-edit-head span {
      max-width: 58%;
      color: #047857;
      font-size: 11px;
      line-height: 1.45;
      font-weight: 900;
      text-align: right;
    }
    .global-record-inline-edit label {
      display: grid;
      gap: 6px;
      color: #334155;
      font-size: 11px;
      line-height: 1.35;
      font-weight: 900;
    }
    .global-record-media-meaning {
      display: grid;
      gap: 4px;
      padding: 10px 11px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(239,246,255,.9));
      border: 1px solid rgba(16,185,129,.2);
    }
    .global-record-media-meaning strong {
      color: #064e3b;
      font-size: 12px;
      line-height: 1.35;
      font-weight: 950;
    }
    .global-record-media-meaning span {
      color: #475569;
      font-size: 11px;
      line-height: 1.55;
      font-weight: 800;
    }
    .global-record-inline-edit input,
    .global-record-inline-edit textarea,
    .global-record-inline-edit select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(15,23,42,.14);
      border-radius: 12px;
      background: #fff;
      color: #0f172a;
      font: inherit;
      font-size: 13px;
      line-height: 1.5;
      padding: 10px 11px;
      resize: vertical;
    }
    .global-record-video-trim {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 16px;
      background: rgba(236,253,245,.86);
      border: 1px solid rgba(16,185,129,.22);
    }
    .global-record-video-trim[hidden] {
      display: none;
    }
    .global-record-video-trim-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: #064e3b;
      font-size: 12px;
      font-weight: 950;
      line-height: 1.4;
    }
    .global-record-video-trim-head span {
      flex: 0 0 auto;
      padding: 5px 9px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid rgba(16,185,129,.2);
      color: #047857;
    }
    .global-record-video-trim-controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .global-record-video-trim-controls label {
      display: grid;
      gap: 6px;
      color: #0f172a;
      font-size: 11px;
      font-weight: 900;
      line-height: 1.3;
    }
    .global-record-video-trim-controls label span {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .global-record-video-trim-controls input {
      width: 100%;
      accent-color: #047857;
    }
    .global-record-camera-actions {
      position: fixed;
      left: calc(12px + var(--global-record-visual-left, 0px));
      right: calc(12px + var(--global-record-visual-right, 0px));
      bottom: calc(max(10px, env(safe-area-inset-bottom)) + var(--global-record-visual-bottom, 0px));
      z-index: 132;
      display: flex;
      gap: 10px;
      padding: 10px;
      border-radius: 24px;
      background: rgba(255,255,255,.98);
      border: 1px solid rgba(15,23,42,.1);
      box-shadow: 0 20px 44px rgba(15,23,42,.22);
      backdrop-filter: blur(18px);
    }
    .global-record-camera-action {
      flex: 1 1 0;
      min-width: 0;
      min-height: 68px;
      border: 0;
      border-radius: 16px;
      background: rgba(248,250,252,.96);
      color: #0f172a;
      font: inherit;
      font-size: 15px;
      font-weight: 950;
      line-height: 1.2;
      cursor: pointer;
    }
    .global-record-camera-action.is-primary {
      background: #064e3b;
      color: #fff;
    }
    .global-record-camera-action[hidden] {
      display: none;
    }
    .global-record-camera-action:disabled {
      opacity: .64;
      cursor: wait;
    }
    .global-record-gallery-select {
      min-height: 44px;
      justify-self: center;
      padding: 8px 16px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #0f6846;
      font: inherit;
      font-size: 14px;
      font-weight: 850;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
    }
    .global-record-camera-error {
      display: grid;
      gap: 10px;
      padding: 16px;
      border: 1px solid #f0c8c3;
      border-radius: 14px;
      background: #fff7f5;
      color: #4a211e;
    }
    .global-record-camera-error[hidden] { display: none; }
    .global-record-camera-error p {
      margin: 0;
      color: #68413d;
      font-size: 14px;
      line-height: 1.55;
    }
    .global-record-camera-error > div {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .global-record-camera-error button {
      min-height: 44px;
      padding: 9px 12px;
      border: 1px solid rgba(15,23,42,.12);
      border-radius: 12px;
      background: #fff;
      color: #17211b;
      font: inherit;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
    }
    .global-record-camera-error button:first-child {
      border-color: #087a4d;
      background: #087a4d;
      color: #fff;
    }
    .global-record-camera-sheet[data-camera-error="true"] .global-record-camera-actions,
    .global-record-camera-sheet[data-camera-error="true"] .global-record-camera-modes,
    .global-record-camera-sheet[data-camera-error="true"] > .global-record-gallery-select,
    .global-record-camera-sheet[data-camera-error="true"] .global-record-camera-preview,
    .global-record-camera-sheet[data-camera-error="true"] .global-record-photo-tray,
    .global-record-camera-sheet[data-camera-error="true"] .global-record-camera-status,
    .global-record-camera-sheet[data-camera-error="true"] .global-record-video-trim {
      display: none;
    }
    .global-record-camera-sheet[data-camera-error="true"] {
      grid-template-rows: auto auto;
      align-content: start;
      padding-bottom: 10px;
    }
    @media (max-width: 520px) {
      .global-record-camera-sheet {
        --global-record-camera-actions-space: 108px;
        left: calc(8px + var(--global-record-visual-left, 0px));
        right: calc(8px + var(--global-record-visual-right, 0px));
        top: calc(max(8px, env(safe-area-inset-top)) + var(--global-record-visual-top, 0px));
        bottom: calc(max(8px, calc(env(safe-area-inset-bottom) + 8px)) + var(--global-record-visual-bottom, 0px));
        gap: 10px;
        padding: 10px 10px calc(10px + var(--global-record-camera-actions-space));
      }
      .global-record-camera-head {
        padding-right: 46px;
      }
      .global-record-camera-close {
        top: calc(max(12px, env(safe-area-inset-top)) + var(--global-record-visual-top, 0px));
        right: calc(12px + var(--global-record-visual-right, 0px));
      }
      .global-record-camera-preview {
        height: clamp(240px, min(70dvh, calc(var(--global-record-visual-height, 100dvh) - 214px)), 640px);
      }
      .global-record-camera-actions {
        left: calc(8px + var(--global-record-visual-left, 0px));
        right: calc(8px + var(--global-record-visual-right, 0px));
        padding: 8px;
        gap: 8px;
      }
      .global-record-camera-action {
        min-height: 70px;
        font-size: 15px;
      }
      .global-record-camera-sheet[data-active-kind="photo"]:not([data-camera-active="true"]):not([data-photo-draft="true"]):not([data-camera-error="true"]) {
        --global-record-camera-actions-space: 0px;
        grid-template-rows: auto auto auto auto;
        align-content: start;
        padding-bottom: 10px;
      }
      .global-record-camera-sheet[data-active-kind="photo"]:not([data-camera-active="true"]):not([data-photo-draft="true"]):not([data-camera-error="true"]) .global-record-camera-preview {
        display: none;
      }
      .global-record-camera-sheet[data-active-kind="photo"]:not([data-camera-active="true"]):not([data-photo-draft="true"]):not([data-camera-error="true"]) .global-record-camera-actions {
        position: static;
        left: auto;
        right: auto;
        bottom: auto;
        z-index: auto;
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        backdrop-filter: none;
      }
      .global-record-camera-sheet[data-active-kind="photo"]:not([data-camera-active="true"]):not([data-photo-draft="true"]):not([data-camera-error="true"]) .global-record-camera-action {
        min-height: 56px;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .global-record-camera-sheet[data-active-kind="photo"]:not([data-camera-active="true"]):not([data-photo-draft="true"]):not([data-camera-error="true"]) .global-record-camera-status {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .global-record-photo-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .global-record-video-trim-controls {
        grid-template-columns: 1fr;
      }
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
    @media (min-width: 1161px) {
      :root {
        --ikimon-desktop-sidebar-w: 204px;
        --ikimon-header-brand-w: max(var(--ikimon-desktop-sidebar-w), 154px);
        --ikimon-shell-margin-left: calc(var(--ikimon-desktop-sidebar-w) + 48px);
        --ikimon-shell-margin-right: 24px;
      }
      body.is-desktop-side-nav-collapsed {
        --ikimon-desktop-sidebar-w: 72px;
        --ikimon-header-brand-w: 154px;
        --ikimon-shell-margin-left: calc(var(--ikimon-desktop-sidebar-w) + 48px);
      }
      .site-header {
        background: rgba(255,255,255,.92);
      }
      .site-header-inner {
        width: calc(100% - 32px);
        min-height: 58px;
        margin: 0 16px;
        padding: 7px 0;
        display: grid;
        grid-template-columns: var(--ikimon-header-brand-w) minmax(280px, 640px) minmax(0, 1fr);
        gap: 18px;
        justify-content: stretch;
      }
      .site-brand-cluster {
        width: var(--ikimon-header-brand-w);
      }
      .desktop-side-nav-toggle {
        display: grid;
      }
      .site-header-actions-mobile {
        display: none !important;
      }
      .brand {
        flex: none;
        max-width: none;
      }
      .brand-logo-lockup {
        min-height: 44px;
        padding: 2px 8px 2px 0;
      }
      .brand-logo-lockup .brand-mark {
        width: 32px;
        height: 32px;
        flex-basis: 32px;
      }
      .site-nav-desktop {
        display: none;
      }
      .lang-switch-desktop {
        display: inline-flex;
      }
      .site-search-desktop {
        grid-column: 2;
        width: min(640px, 100%);
        max-width: none;
        justify-self: center;
        min-height: 38px;
        box-shadow: none;
      }
      .site-header-actions-desktop {
        grid-column: 3;
        justify-self: end;
      }
      .site-header-actions-desktop .btn {
        min-height: 38px;
        padding: 9px 13px;
        font-size: 13px;
      }
      .desktop-side-nav {
        position: fixed;
        z-index: 70;
        top: 67px;
        left: 16px;
        bottom: 14px;
        width: var(--ikimon-desktop-sidebar-w);
        display: block;
        padding: 8px 10px 12px 0;
        overflow-y: auto;
        border-right: 0;
        background: #ffffff;
        border: 1px solid rgba(15,23,42,.08);
        border-radius: 0 18px 18px 0;
        box-shadow: 12px 0 32px rgba(15,23,42,.10);
        backdrop-filter: none;
        scrollbar-width: thin;
        transition: width .18s ease, padding .18s ease, box-shadow .18s ease;
      }
      body.is-desktop-side-nav-collapsed .desktop-side-nav {
        padding-right: 0;
        box-shadow: 10px 0 26px rgba(15,23,42,.08);
      }
      body.is-desktop-side-nav-collapsed .desktop-side-nav-link {
        width: 48px;
        justify-content: center;
        gap: 0;
        padding: 0;
      }
      body.is-desktop-side-nav-collapsed .desktop-side-nav-link::before {
        left: 3px;
      }
      body.is-desktop-side-nav-collapsed .desktop-side-nav-label {
        display: none;
      }
      body.is-desktop-side-nav-collapsed .desktop-side-nav-section--secondary,
      body.is-desktop-side-nav-collapsed .desktop-side-nav-legal,
      body.is-desktop-side-nav-collapsed .desktop-side-nav-section--primary .desktop-side-nav-section-title {
        display: none;
      }
      body.is-desktop-side-nav-collapsed .brand-logo-lockup {
        padding-right: 0;
      }
      .shell,
      .footer-inner {
        --ikimon-shell-available-w: calc(100% - var(--ikimon-desktop-sidebar-w));
        --ikimon-shell-effective-w: min(var(--ikimon-shell-target-max), calc(var(--ikimon-shell-available-w) - 96px), calc(var(--ikimon-shell-available-w) - var(--ikimon-page-inline)));
        --ikimon-shell-side-space: max(48px, calc((var(--ikimon-shell-available-w) - var(--ikimon-shell-effective-w)) / 2));
        width: var(--ikimon-shell-effective-w);
        margin-left: calc(var(--ikimon-desktop-sidebar-w) + var(--ikimon-shell-side-space));
        margin-right: var(--ikimon-shell-side-space);
      }
      .footer-inner {
        --ikimon-shell-target-max: var(--ikimon-page-max);
      }
      .shell.shell-layout-home,
      .shell.shell-layout-home.shell-bleed,
      .footer-inner {
        width: min(var(--ikimon-page-max), calc(100% - var(--ikimon-shell-margin-left) - var(--ikimon-shell-margin-right)));
        margin-left: var(--ikimon-shell-margin-left);
        margin-right: var(--ikimon-shell-margin-right);
      }
      .shell.shell-map {
        width: calc(100% - var(--ikimon-desktop-sidebar-w) - 24px);
        margin-left: calc(var(--ikimon-desktop-sidebar-w) + 24px);
        margin-right: 0;
      }
      .site-shell.is-minimal-chrome .site-header-inner {
        width: min(var(--ikimon-page-max), calc(100% - 48px));
        margin: 0 auto;
        grid-template-columns: auto 1fr auto;
      }
      .site-shell.is-minimal-chrome .site-brand-cluster {
        width: auto;
      }
      .site-shell.is-minimal-chrome .site-header-actions-desktop {
        grid-column: 3;
      }
      .site-shell.is-minimal-chrome .shell.shell-layout-home,
      .site-shell.is-minimal-chrome .shell.shell-layout-home.shell-bleed {
        width: min(680px, calc(100% - 48px));
        margin-left: auto;
        margin-right: auto;
      }
      .footer-inner {
        margin-left: var(--ikimon-shell-margin-left);
        margin-right: var(--ikimon-shell-margin-right);
      }
      .site-shell.is-immersive-surface .site-header-inner {
        grid-template-columns: 204px minmax(280px, 640px) auto;
      }
      .site-shell.is-immersive-surface .site-brand-cluster {
        width: 204px;
      }
      body.is-desktop-side-nav-collapsed .site-shell.is-immersive-surface .brand-wordmark {
        display: inline-flex;
      }
      body.is-desktop-side-nav-collapsed .site-shell.is-immersive-surface .brand-logo-lockup {
        padding-right: 8px;
      }
      .site-shell.is-immersive-surface .desktop-side-nav {
        width: 204px;
        padding: 8px 10px 12px 0;
        background: #ffffff;
        border: 1px solid rgba(15,23,42,.08);
        backdrop-filter: none;
        transform: translateX(-112%);
        pointer-events: none;
        box-shadow: 18px 0 42px rgba(15,23,42,.16);
        transition: transform .22s ease, box-shadow .18s ease;
      }
      body:not(.is-desktop-side-nav-collapsed) .site-shell.is-immersive-surface .desktop-side-nav {
        transform: translateX(0);
        pointer-events: auto;
      }
      .site-shell.is-immersive-surface .shell,
      .site-shell.is-immersive-surface .shell.shell-bleed,
      .site-shell.is-immersive-surface .footer-inner {
        width: min(var(--ikimon-page-max), calc(100% - var(--ikimon-page-inline)));
        margin-left: auto;
        margin-right: auto;
      }
      .site-shell.is-immersive-surface .shell.shell-map {
        width: 100%;
        margin-left: 0;
        margin-right: 0;
      }
    }
    @media (min-width: 1161px) and (max-width: 1380px) {
      :root {
        --ikimon-page-inline: clamp(20px, 2.4vw, 34px);
        --ikimon-shell-margin-left: calc(var(--ikimon-desktop-sidebar-w) + 48px);
        --ikimon-shell-margin-right: 18px;
      }
      body.is-desktop-side-nav-collapsed {
        --ikimon-desktop-sidebar-w: 72px;
        --ikimon-shell-margin-left: calc(var(--ikimon-desktop-sidebar-w) + 48px);
      }
      .site-header-inner {
        grid-template-columns: var(--ikimon-desktop-sidebar-w) minmax(240px, 1fr) auto;
        gap: 12px;
      }
      .site-brand-cluster {
        width: var(--ikimon-desktop-sidebar-w);
      }
      .site-search-desktop {
        width: min(100%, 560px);
      }
      .site-header-actions-desktop {
        gap: 6px;
      }
      .site-header-actions-desktop .btn {
        padding: 9px 12px;
      }
      .lang-switch-desktop .lang-switch-label span {
        display: none;
      }
      .lang-switch-desktop .lang-switch-link {
        min-width: 34px;
        padding: 0 8px;
      }
      .shell.shell-layout-home,
      .shell.shell-layout-home.shell-bleed,
      .footer-inner {
        width: min(var(--ikimon-page-max), calc(100% - var(--ikimon-shell-margin-left) - var(--ikimon-shell-margin-right)));
        margin-left: var(--ikimon-shell-margin-left);
        margin-right: var(--ikimon-shell-margin-right);
      }
    }
    @media (min-width: 1161px) {
      body:has(.site-shell.is-reading-surface) {
        --ikimon-desktop-sidebar-w: 64px;
        --ikimon-reading-nav-safe-left: 104px;
        --ikimon-reading-safe-right: 24px;
      }
      body:has(.site-shell.is-reading-surface) .site-header-inner {
        grid-template-columns: 204px minmax(280px, 640px) auto;
      }
      body:has(.site-shell.is-reading-surface) .site-brand-cluster {
        width: 204px;
      }
      body:has(.site-shell.is-reading-surface) .site-shell::after {
        content: "";
        position: fixed;
        inset: 58px 0 0;
        z-index: 60;
        pointer-events: none;
        background: rgba(15,23,42,.18);
        opacity: 0;
        transition: opacity .18s ease;
      }
      body:has(.site-shell.is-reading-surface):not(.is-desktop-side-nav-collapsed) .site-shell::after {
        opacity: 1;
      }
      body:has(.site-shell.is-reading-surface) .shell,
      body:has(.site-shell.is-reading-surface) .shell.shell-bleed,
      body:has(.site-shell.is-reading-surface) .footer-inner {
        width: min(var(--ikimon-shell-target-max), calc(100vw - var(--ikimon-reading-nav-safe-left) - var(--ikimon-reading-safe-right)));
        margin-left: max(var(--ikimon-reading-nav-safe-left), calc((100vw - var(--ikimon-shell-target-max)) / 2));
        margin-right: auto;
      }
      body:has(.site-shell.is-reading-surface) .shell.shell-map {
        width: 100%;
        margin-left: 0;
        margin-right: 0;
      }
      body:has(.site-shell.is-reading-surface) .desktop-side-nav {
        width: 64px;
        padding-right: 0;
        box-shadow: 10px 0 26px rgba(15,23,42,.08);
      }
      body:has(.site-shell.is-reading-surface):not(.is-desktop-side-nav-collapsed) .desktop-side-nav {
        width: 204px;
        padding-right: 10px;
        box-shadow: 20px 0 46px rgba(15,23,42,.18);
      }
    }
    @media (max-width: 1160px) {
      .site-header-inner {
        padding: 10px 18px;
        gap: 10px;
      }
      .site-brand-cluster {
        flex: 1 1 auto;
      }
      .brand {
        max-width: 270px;
        flex-basis: 220px;
      }
      .site-search-desktop {
        max-width: 240px;
      }
      .site-nav-desktop,
      .site-search-desktop {
        display: none;
      }
      .site-header-actions-desktop {
        display: none;
      }
      .site-header-actions-mobile {
        display: flex;
        align-items: center;
        gap: 7px;
        min-width: 0;
      }
      .desktop-side-nav-toggle {
        display: none !important;
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
      :root { --ikimon-page-inline: 24px; }
      .shell { padding: 16px 0 18px; }
      .shell.shell-bleed { padding: 14px 0 18px; }
      .shell.shell-map { padding: 0; }
      .site-header-inner {
        padding: 9px 0;
        gap: 8px;
        flex-wrap: nowrap;
        align-items: center;
      }
      .brand {
        min-width: 0;
        flex: 1 1 auto;
        gap: 8px;
      }
      .site-brand-cluster {
        min-width: 0;
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
      .is-reading-surface .site-header-actions-mobile .site-record-link { display: none; }
      .site-shell.has-global-record-launcher { padding-bottom: calc(112px + max(0px, env(safe-area-inset-bottom))); }
      .site-shell.has-global-record-launcher.is-map-surface { padding-bottom: 0; }
      .site-shell.is-map-surface .global-record-launcher { z-index: 72; }
      .hero-panel { padding: 48px 24px 36px; border-radius: 26px; }
      .hero-panel h1 { font-size: clamp(28px, 9vw, 40px); line-height: 1.24; max-width: 18ch; }
      .hero-panel p { font-size: 16px; line-height: 1.85; max-width: 32ch; margin-top: 18px; }
      .hero-emphasis { white-space: normal; }
      .hero-panel.has-media { grid-template-columns: 1fr; }
      .hero-media { grid-template-columns: 1fr; }
      .hero-panel.is-light .hero-media { margin-top: 20px; }
      .hero-photo.tall { grid-row: auto; min-height: 220px; }
      .photo-grid { grid-template-columns: 1fr; }
      .footer-inner { padding: 30px 0 22px; }
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
    @media (min-width: 721px) and (max-width: 960px) {
      .global-record-launcher {
        display: grid;
      }
      .site-shell.has-global-record-launcher {
        padding-bottom: calc(112px + max(0px, env(safe-area-inset-bottom)));
      }
      .site-shell.has-global-record-launcher.is-map-surface {
        padding-bottom: 0;
      }
    }
    @media (min-width: 961px) {
      .site-core-nav {
        display: flex;
      }
    }
    @media (min-width: 1161px) {
      .site-header-inner:has(.site-core-nav) {
        grid-template-columns: var(--ikimon-header-brand-w) auto minmax(220px, 1fr) auto;
      }
      .site-header-inner:has(.site-core-nav) .site-core-nav {
        grid-column: 2;
        justify-self: start;
      }
      .site-header-inner:has(.site-core-nav) .site-search-desktop {
        grid-column: 3;
        width: min(520px, 100%);
      }
      .site-header-inner:has(.site-core-nav) .site-header-actions-desktop,
      .site-header-home .home-header-actions {
        grid-column: 4;
      }
    }
    @media (max-width: 430px) {
      .brand {
        flex: 1 1 auto;
        min-width: 0;
        max-width: none;
      }
      .brand-logo-lockup {
        gap: 6px;
        padding-right: 6px;
      }
      .brand-logo-lockup .brand-mark { width: 32px; height: 32px; flex-basis: 32px; }
      .brand-wordmark {
        width: auto;
        height: 15px;
        aspect-ratio: 711 / 222;
      }
      .brand-name { font-size: 16px; }
      .brand-domain { font-size: 11px; }
    }
    .language-suggestion,
    .app-install-prompt {
      position: fixed;
      left: max(14px, env(safe-area-inset-left));
      right: max(14px, env(safe-area-inset-right));
      bottom: max(14px, env(safe-area-inset-bottom));
      z-index: 70;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      max-width: 520px;
      margin: 0 auto;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid rgba(15,23,42,.1);
      background: rgba(255,255,255,.96);
      box-shadow: 0 18px 48px rgba(15,23,42,.18);
      color: #0f172a;
    }
    .language-suggestion { z-index: 74; }
    .language-suggestion[hidden],
    .app-install-prompt[hidden] { display: none; }
    .language-suggestion-copy,
    .app-install-prompt-copy { display: grid; gap: 2px; min-width: 0; }
    .language-suggestion-copy strong,
    .app-install-prompt-copy strong { font-size: 13px; line-height: 1.35; font-weight: 950; }
    .language-suggestion-copy span,
    .app-install-prompt-copy span { color: #475569; font-size: 12px; line-height: 1.45; font-weight: 750; }
    .language-suggestion-actions,
    .app-install-prompt-actions { display: flex; align-items: center; gap: 8px; }
    .language-suggestion-primary,
    .language-suggestion-dismiss,
    .app-install-primary,
    .app-install-dismiss {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      border-radius: 8px;
      border: 0;
      padding: 0 12px;
      font: inherit;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
      white-space: nowrap;
    }
    .language-suggestion-primary,
    .app-install-primary { background: #10b981; color: #fff; }
    .language-suggestion-dismiss,
    .app-install-dismiss { background: rgba(15,23,42,.06); color: #334155; }
    .has-language-suggestion .app-install-prompt {
      bottom: calc(max(14px, env(safe-area-inset-bottom)) + 88px);
    }
    @media (min-width: 768px) {
      .language-suggestion,
      .app-install-prompt {
        left: auto;
        right: 22px;
        bottom: 22px;
      }
      .has-language-suggestion .app-install-prompt { bottom: 112px; }
    }
    @media (max-width: 520px) {
      .language-suggestion,
      .app-install-prompt {
        grid-template-columns: 1fr;
      }
      .language-suggestion-actions,
      .app-install-prompt-actions {
        justify-content: stretch;
      }
      .language-suggestion-primary,
      .language-suggestion-dismiss,
      .app-install-primary,
      .app-install-dismiss {
        flex: 1 1 0;
      }
    }
    @media (max-width: 1160px) {
      .has-language-suggestion .language-suggestion {
        bottom: calc(max(14px, env(safe-area-inset-bottom)) + 88px);
      }
      .has-language-suggestion .app-install-prompt {
        bottom: calc(max(14px, env(safe-area-inset-bottom)) + 176px);
      }
    }
    ${options.extraStyles ?? ""}
  </style>
</head>
<body${prefersCollapsedSideNav ? ' class="is-desktop-side-nav-collapsed"' : ""}>
  <a class="skip-link" href="#main-content">${escapeHtml(skipLabel)}</a>
  ${appLaunchScreenHtml}
  ${languageSuggestionHtml}
  ${installPromptHtml}
  <div class="${siteShellClassName}">
    ${nav(options.basePath, lang, currentPath, options.activeNav, uiLangs, minimalChrome, options.homeChrome)}
    <main id="main-content" class="${mainClassName}" tabindex="-1">
      ${hero(options.basePath, options.hero)}
      ${!options.hero && !/<h1[\s>]/.test(`${options.belowHeroHtml ?? ""}${options.body}`) ? `<h1 class="sr-only">${escapeHtml(srOnlyPageHeading)}</h1>` : ""}
      ${options.belowHeroHtml ?? ""}
      ${options.body}
    </main>
    ${shouldRenderFooter ? footer(options.basePath, lang, options.footerNote) : ""}
    ${globalRecordNav}
  </div>
  ${legacyServiceWorkerCleanupScript}
  ${appRuntimeScript}
  ${authNavHydrationScript(options.basePath, lang)}
  ${globalRecordNav ? globalRecordEntryScript(options.basePath, lang) : ""}
  ${uiKpiScript}
</body>
</html>`);
}
