/** Shared, dependency-free chrome for materialized pages and native Worker readers. */
export function isAppExperiencePath(path: string): boolean {
  const pathname = (path.split(/[?#]/, 1)[0] ?? "/").replace(/^\/(ja|en|es|pt-br)(?=\/|$)/i, "") || "/";
  return /^\/(?:$|home\/?$|records(?:\/|$)|observations\/|record(?:\/|$)|map(?:\/|$)|profile(?:\/|$)|community\/events(?:\/|$))/.test(pathname);
}

const labels = {
  ja: ["ホーム", "記録", "撮る", "場所", "参加", "自分", "本文へ", "主なページ"],
  en: ["Home", "Records", "Capture", "Places", "Join", "Account", "Skip to content", "Main pages"],
  es: ["Inicio", "Registros", "Capturar", "Lugares", "Participar", "Cuenta", "Ir al contenido", "Páginas principales"],
  "pt-br": ["Início", "Registros", "Capturar", "Lugares", "Participar", "Conta", "Ir ao conteúdo", "Páginas principais"],
};
const loginLabels: Record<keyof typeof labels, string> = {
  ja: "ログイン",
  en: "Sign in",
  es: "Iniciar sesión",
  "pt-br": "Entrar",
};
const langSwitchMeta = [
  { code: "ja", short: "JP", label: "日本語", aria: "言語" },
  { code: "en", short: "EN", label: "English", aria: "Language" },
  { code: "es", short: "ES", label: "Español", aria: "Idioma" },
  { code: "pt-br", short: "PT", label: "Português", aria: "Idioma" },
] as const;
const icons = [
  '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
  '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  '<path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/>',
  '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h5"/>',
];

function normalizeAppLang(lang: string): keyof typeof labels {
  const lower = lang.toLowerCase();
  return (lower in labels ? lower : "ja") as keyof typeof labels;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function localizedSwitchHref(targetLang: string, currentPath?: string): string {
  if (!currentPath) return `/${targetLang}/`;
  const [rawPath, rawSearch = ""] = currentPath.split("?", 2);
  const stripped = (rawPath || "/").replace(/^\/(ja|en|es|pt-br)(?=\/|$)/i, "") || "/";
  const normalizedPath = stripped.startsWith("/") ? stripped : `/${stripped}`;
  return `/${targetLang}${normalizedPath}${rawSearch ? `?${rawSearch}` : ""}`;
}

export function appExperienceActiveIndex(path: string): number {
  const pathname = (path.split(/[?#]/, 1)[0] ?? "/").replace(/^\/(ja|en|es|pt-br)(?=\/|$)/i, "") || "/";
  if (pathname === "/" || pathname === "/home") return 0;
  if (pathname === "/records" || pathname.startsWith("/records/") || pathname.startsWith("/observations/")) return 1;
  if (pathname === "/record" || pathname.startsWith("/record/")) return 2;
  if (pathname === "/map" || pathname.startsWith("/map/") || pathname.startsWith("/places/")) return 3;
  if (pathname === "/community/events" || pathname.startsWith("/community/events/")) return 4;
  return -1;
}

export function renderAppExperienceLanguageSwitch(lang: string, currentPath?: string): string {
  const language = normalizeAppLang(lang);
  const currentMeta = langSwitchMeta.find((item) => item.code === language) ?? langSwitchMeta[0];
  const links = langSwitchMeta.map((item) => {
    const active = item.code === language;
    const href = escapeAttr(localizedSwitchHref(item.code, currentPath));
    return `<a class="lang-switch-link${active ? " is-active" : ""}" href="${href}" hreflang="${item.code}" lang="${item.code}"${active ? ' aria-current="true"' : ""}><span class="lang-switch-code">${item.short}</span><span class="lang-switch-name">${item.label}</span></a>`;
  }).join("");
  return `<details class="lang-switch lang-switch-desktop zukan-app-lang" data-language-disclosure><summary class="lang-switch-label" aria-label="${escapeAttr(`${currentMeta.aria}: ${currentMeta.label}`)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg><span class="lang-switch-current">${currentMeta.short}</span></summary><div class="lang-switch-options">${links}</div></details>`;
}

export function renderAppExperienceNavigation(lang: string, active: number, placement: "header" | "bottom", member = false): string {
  const language = normalizeAppLang(lang);
  const copy = labels[language];
  const prefix = `/${language}`;
  const guestRecordsPath = `${prefix}/records?view=public`;
  const memberRecordsPath = `${prefix}/records?view=mine`;
  const paths = [`${prefix}/`, member ? memberRecordsPath : guestRecordsPath, `${prefix}/record`, `${prefix}/map?tab=places`, `${prefix}/community/events`];
  const order = placement === "header" ? [0, 1, 3, 4, 2] : [0, 1, 2, 3, 4];
  const navClass = placement === "bottom" ? "zukan-app-nav is-bottom global-record-launcher" : "zukan-app-nav is-header";
  return `<nav class="${navClass}" aria-label="${copy[7]}">${order.map((index) => {
    const isActive = active === index;
    const isCapture = index === 2;
    const classes = placement === "bottom"
      ? `global-record-choice${isActive ? " is-active" : ""}${isCapture ? " is-primary is-capture" : ""} ik-ui-action`
      : `ik-ui-action${isCapture ? " is-capture" : ""}`;
    const authAttrs = index === 1
      ? ` data-bottom-nav-auth data-auth-guest-href="${escapeAttr(guestRecordsPath)}" data-auth-member-href="${escapeAttr(memberRecordsPath)}"`
      : "";
    const captureAttrs = isCapture && !isActive
      ? ` data-global-record-trigger="photo" data-kpi-event="capture_nav_tap" data-kpi-action="${placement === "bottom" ? "capture_nav" : "header_capture"}"`
      : "";
    const iconHtml = placement === "bottom"
      ? `<span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[index]}</svg></span>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[index]}</svg>`;
    return `<a class="${classes}" href="${escapeAttr(paths[index] ?? "")}"${authAttrs}${captureAttrs}${isActive ? ' aria-current="page"' : ""}>${iconHtml}<span>${copy[index]}</span></a>`;
  }).join("")}</nav>`;
}

export function renderAppExperienceHeader(
  lang: string,
  active: number,
  member = false,
  mainId = "main-content",
  options?: {
    currentPath?: string;
    authControlsHtml?: string;
    extraHeaderClass?: string;
    headerAttrs?: string;
    brandLockupSrc?: string;
  },
): string {
  const language = normalizeAppLang(lang);
  const copy = labels[language];
  const prefix = `/${language}`;
  const headerClass = options?.extraHeaderClass ? `${options.extraHeaderClass} zukan-app-header` : "zukan-app-header";
  const headerAttrs = options?.headerAttrs ? ` ${options.headerAttrs}` : "";
  const brandSrc = options?.brandLockupSrc ? escapeAttr(options.brandLockupSrc) : "/assets/brand/zukan-lockup.svg";
  const loginRedirect = options?.currentPath ?? `${prefix}/profile`;
  const defaultAccountHtml = member
    ? `<a class="ik-ui-action zukan-app-account" href="${prefix}/profile">${copy[5]}</a>`
    : `<a class="ik-ui-action zukan-app-account home-header-login site-login-link" href="${prefix}/login?redirect=${encodeURIComponent(loginRedirect)}">${loginLabels[language]}</a>`;
  const accountHtml = options?.authControlsHtml ?? defaultAccountHtml;
  return `<a class="zukan-app-skip" href="#${escapeAttr(mainId)}">${copy[6]}</a><header class="${headerClass}"${headerAttrs}><div><a class="brand zukan-app-brand" href="${prefix}/" aria-label="ZUKAN" data-kpi-event="logo_home_tap" data-kpi-action="logo_home"><img src="${brandSrc}" alt="" width="132" height="32"></a>${renderAppExperienceNavigation(lang, active, "header", member)}<div class="zukan-app-header-tools">${renderAppExperienceLanguageSwitch(lang, options?.currentPath)}${accountHtml}</div></div></header>`;
}

/**
 * Shared visual foundation for ZUKAN's materialized Node pages and native
 * Worker readers. Keep this dependency-free: individual renderers retain
 * their layout and state semantics, while consuming the same visual meaning.
 */
export const ZUKAN_DESIGN_FOUNDATION_STYLES = `
:root{
  color-scheme:light;
  --zukan-action-primary:#245c3a;
  --zukan-action-hover:#1c492e;
  --zukan-action-active:#153923;
  --zukan-action-capture:#b94f18;
  --zukan-action-capture-hover:#963f13;
  --zukan-action-capture-active:#78320f;
  --zukan-on-action-primary:#ffffff;
  --zukan-text-primary:#17251b;
  --zukan-text-secondary:#40564a;
  --zukan-surface-base:#fff9ec;
  --zukan-surface-subtle:#fff9ec;
  --zukan-border-control:#52685a;
  --zukan-border-decorative:#dde2dc;
  --zukan-link:#245c3a;
  --zukan-link-visited:#663399;
  --zukan-status-success:#146c43;
  --zukan-status-warning:#8a4b00;
  --zukan-status-error:#b42318;
  --zukan-status-info:#0055ad;
  --zukan-focus-yellow-300:#ffffff;
  --zukan-focus-outline:#087f7c;
  --zukan-font-sans:"Noto Sans JP","Hiragino Sans","Yu Gothic UI",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --zukan-space-1:4px;
  --zukan-space-2:8px;
  --zukan-space-3:12px;
  --zukan-space-4:16px;
  --zukan-space-6:24px;
  --zukan-space-8:32px;
  --zukan-space-10:40px;
  --zukan-space-14:56px;
  --zukan-radius-control:4px;
  --zukan-radius-content:8px;
  --zukan-control-min:44px;
  --zukan-content-max:1200px;
}
:root[data-zukan-theme="dark"]{
  color-scheme:dark;
  --zukan-action-primary:#86d9a2;
  --zukan-action-hover:#66e6f2;
  --zukan-action-active:#66e6f2;
  --zukan-action-capture:#b94f18;
  --zukan-action-capture-hover:#963f13;
  --zukan-action-capture-active:#78320f;
  --zukan-on-action-primary:#082014;
  --zukan-text-primary:#f2f8f3;
  --zukan-text-secondary:#c3d5c7;
  --zukan-surface-base:#111a14;
  --zukan-surface-subtle:#1b261e;
  --zukan-border-control:#91a096;
  --zukan-border-decorative:#39463d;
  --zukan-link:#a7f3c0;
  --zukan-link-visited:#a7f3c0;
  --zukan-status-success:#69d09a;
  --zukan-status-warning:#ffc36b;
  --zukan-status-error:#ff8b82;
  --zukan-status-info:#8abfff;
  --zukan-focus-yellow-300:#111a14;
  --zukan-focus-outline:#66e6f2;
}
[data-zukan-theme="dark"] :is(.zukan-app-brand img,.brand-lockup-img){content:url("/assets/brand/zukan-lockup-dark.svg")}
[data-zukan-theme="dark"] :is(.site-header,.zukan-app-header){background:var(--zukan-surface-base)!important}
body[data-zukan-design],body[data-zukan-app-experience]{
  background:var(--zukan-surface-base);
  color:var(--zukan-text-primary);
  font-family:var(--zukan-font-sans);
  font-size:16px;
  line-height:1.7;
}
body[data-zukan-design] *,body[data-zukan-app-experience] *{box-sizing:border-box}
body[data-zukan-design] :is(button,input,textarea,select),body[data-zukan-app-experience] :is(button,input,textarea,select){font:inherit}
body[data-zukan-design] :is(button,[role=button],input:not([type=hidden],[type=checkbox],[type=radio]),select,textarea,summary),body[data-zukan-app-experience] :is(button,[role=button],input:not([type=hidden],[type=checkbox],[type=radio]),select,textarea,summary){min-height:var(--zukan-control-min)}
body[data-zukan-design] :is(h1,h2,h3),body[data-zukan-app-experience] :is(h1,h2,h3){overflow-wrap:anywhere;text-wrap:balance;line-height:1.35}
body[data-zukan-design] :is(a,button,input,textarea,select,summary):focus-visible,body[data-zukan-app-experience] :is(a,button,input,textarea,select,summary):focus-visible{outline:2px solid var(--zukan-focus-outline);outline-offset:2px;box-shadow:0 0 0 4px var(--zukan-focus-yellow-300)}
body[data-zukan-design] a:not([class]),body[data-zukan-app-experience] a:not([class]){color:var(--zukan-link);text-decoration-thickness:max(1px,.08em);text-underline-offset:.15em}
body[data-zukan-design] a:not([class]):visited,body[data-zukan-app-experience] a:not([class]):visited{color:var(--zukan-link-visited)}
body[data-zukan-design] :is([role=status],[role=alert],[data-zukan-ui-state]){display:block;border-inline-start:4px solid var(--zukan-status-info);padding:var(--zukan-space-3);border-radius:var(--zukan-radius-content);background:var(--zukan-surface-subtle)}
body[data-zukan-design] [role=alert],body[data-zukan-design] [data-zukan-ui-state=error]{border-inline-start-color:var(--zukan-status-error)}
body[data-zukan-design] [data-zukan-ui-state=warning],body[data-zukan-design] [data-zukan-ui-state=permission]{border-inline-start-color:var(--zukan-status-warning)}
body[data-zukan-design] [data-zukan-ui-state=success]{border-inline-start-color:var(--zukan-status-success)}
@media(forced-colors:active){body[data-zukan-design] :focus-visible,body[data-zukan-app-experience] :focus-visible{outline:2px solid CanvasText;outline-offset:2px;box-shadow:none}}
@media(prefers-reduced-motion:reduce){body[data-zukan-design] *,body[data-zukan-app-experience] *{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
`;

export const APP_EXPERIENCE_LAYOUT_STYLES = `
/* Adopted app surface: one primary navigation at each viewport. */
body[data-zukan-app-experience]{--zukan-green:var(--zukan-action-primary);--zukan-ink:var(--zukan-text-primary);--zukan-muted:var(--zukan-text-secondary);--zukan-line:var(--zukan-border-decorative);--zukan-paper:var(--zukan-surface-subtle);color:var(--zukan-ink);background:var(--zukan-surface-base);font-size:16px;line-height:1.7}
body[data-zukan-app-experience] *{box-sizing:border-box}
body[data-zukan-app-experience] :is(h1,h2,h3){text-wrap:balance;overflow-wrap:anywhere;line-height:1.3}
body[data-zukan-app-experience] h1{letter-spacing:-.025em}
body[data-zukan-app-experience] [hidden]{display:none!important}
body[data-zukan-app-experience] .site-shell{padding-left:0;padding-right:0}
body[data-zukan-app-experience] .site-shell>.shell{margin-left:auto;margin-right:auto;width:100%;max-width:1200px}
body[data-zukan-app-experience] .site-header{position:sticky;top:0;z-index:80;background:var(--zukan-surface-base);border-bottom:1px solid var(--zukan-line);backdrop-filter:none}
body[data-zukan-app-experience] .site-header-inner{display:flex!important;align-items:center;justify-content:space-between;height:72px;max-width:1248px;margin:auto;padding:0 24px;gap:24px}
body[data-zukan-app-experience] .home-header-actions.is-member{display:none}
body[data-zukan-app-experience] .home-header-login{min-height:var(--zukan-control-min);display:inline-flex;align-items:center;justify-content:center;padding-inline:12px}
body[data-zukan-app-experience] [data-home-auth-state=member] .home-header-actions.is-member{display:flex}
body[data-zukan-app-experience] [data-home-auth-state=member] .home-header-actions.is-guest{display:none}
html[data-auth=signed-in] body[data-zukan-app-experience] .home-header-actions.is-member{display:flex}
html[data-auth=signed-in] body[data-zukan-app-experience] .home-header-actions.is-guest{display:none}
body[data-zukan-app-experience] .zukan-app-language .lang-switch-desktop{display:flex!important}
body[data-zukan-app-experience] .zukan-app-language{margin-left:auto}
body[data-zukan-app-experience] .site-brand-cluster{flex:0 0 auto;width:auto;min-width:0}
body[data-zukan-app-experience] .site-core-nav{display:flex;margin:auto;gap:6px}
body[data-zukan-app-experience] .site-core-nav-link{min-height:44px;padding:10px 16px;font-size:15px;font-weight:650;color:var(--zukan-muted);border-radius:8px}
body[data-zukan-app-experience] .site-core-nav-link[aria-current=page]{color:var(--zukan-green);background:#edf3ee}
body[data-zukan-app-experience] .site-core-nav-link.is-capture{color:#fff;background:var(--zukan-action-capture)}
.zukan-app-header{position:sticky;top:0;z-index:80;background:var(--zukan-surface-base);border-bottom:1px solid var(--zukan-line)}
.zukan-app-header>div{display:flex;align-items:center;justify-content:space-between;gap:24px;max-width:1248px;height:72px;margin:auto;padding:0 24px}
.zukan-app-brand{display:inline-flex;align-items:center;gap:8px;min-height:44px;flex-shrink:0}.zukan-app-brand img{object-fit:contain}
.zukan-app-header-tools{display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0}
.zukan-app-lang{position:relative}
.zukan-app-lang summary{list-style:none;display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:44px;min-height:44px;padding:0 10px;border:1px solid var(--zukan-line);border-radius:999px;background:#fff;color:var(--zukan-ink);font-size:13px;font-weight:700;cursor:pointer}
.zukan-app-lang summary::-webkit-details-marker{display:none}
.zukan-app-lang summary svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.zukan-app-lang .lang-switch-options{display:none;position:absolute;right:0;top:calc(100% + 6px);z-index:95;min-width:176px;padding:6px;border:1px solid var(--zukan-line);border-radius:12px;background:#fff;box-shadow:0 14px 32px rgba(15,23,42,.16)}
.zukan-app-lang[open] .lang-switch-options,.lang-switch[open] .lang-switch-options{display:grid;gap:4px}
.zukan-app-lang .lang-switch-link{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 12px;border-radius:8px;color:var(--zukan-ink);text-decoration:none;font-size:14px;font-weight:650}
.zukan-app-lang .lang-switch-link:hover,.zukan-app-lang .lang-switch-link:focus-visible{background:#edf3ee}
.zukan-app-lang .lang-switch-link.is-active{background:#edf3ee;color:var(--zukan-green)}
.zukan-app-lang .lang-switch-code{font-size:12px;font-weight:800;opacity:.75;min-width:22px}
.zukan-app-account{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 12px;color:var(--zukan-green);font-size:14px;text-decoration:none;white-space:nowrap}
.zukan-app-nav{display:flex;gap:6px}.zukan-app-nav a{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 16px;text-decoration:none;color:var(--zukan-muted);font-size:15px;font-weight:650;border-radius:8px}.zukan-app-nav a[aria-current=page]{color:var(--zukan-green);background:#edf3ee}.zukan-app-nav a.is-capture{background:var(--zukan-action-capture);color:#fff}.zukan-app-nav a.is-capture:hover{background:var(--zukan-action-capture-hover)}.zukan-app-nav a.is-capture:active{background:var(--zukan-action-capture-active)}.zukan-app-nav svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linejoin:round;stroke-linecap:round;flex-shrink:0}.zukan-app-nav.is-header svg{display:none}.zukan-app-nav.is-bottom{display:none}
.zukan-app-nav.is-bottom .global-record-choice-icon{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px}
.zukan-app-nav.is-bottom a.is-capture .global-record-choice-icon{width:32px;height:24px;border-radius:999px;background:var(--zukan-action-capture-hover)}
.zukan-app-skip{position:fixed;top:-120px;left:16px;z-index:200;padding:12px 20px;background:#fff;color:var(--zukan-green)}.zukan-app-skip:focus{top:8px}
body[data-zukan-app-experience] .home-state-view{gap:56px;padding-top:32px}
/* Guest Home is composed independently from the member workspace.
   The empty editorial slot remains honest; never substitute unapproved media. */
body[data-zukan-app-experience] .home-state-view.is-guest{grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--zukan-space-10);padding-block:var(--zukan-space-14) var(--zukan-space-6)}
body[data-zukan-app-experience] .home-state-view.is-guest> :not(.home-place-section,.home-community-section){grid-column:1/-1;min-width:0}
body[data-zukan-app-experience] .home-guest-hero{min-height:0;gap:var(--zukan-space-10);padding-block:0 var(--zukan-space-4);align-items:center}
body[data-zukan-app-experience] .home-guest-hero.has-visual{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
body[data-zukan-app-experience] .home-guest-hero-copy{gap:var(--zukan-space-6);max-width:42rem}
body[data-zukan-app-experience] .home-guest-hero h1{font-size:clamp(2rem,3.5vw,3rem);line-height:1.4;letter-spacing:-.025em;margin:0}
body[data-zukan-app-experience] .home-guest-hero-copy>p:not(.home-invite-note){font-size:1rem;line-height:1.8;max-width:38em;margin:0}
body[data-zukan-app-experience] .home-guest-hero .home-invite-note{font-size:.875rem!important;font-weight:400;line-height:1.7;margin:0!important}
body[data-zukan-app-experience] .home-guest-proof{min-height:0;aspect-ratio:4/3;grid-template-columns:1fr;grid-template-rows:1fr;border-radius:var(--zukan-radius-content)}
body[data-zukan-app-experience] .home-guest-proof .is-item-1{grid-column:1;grid-row:1}
body[data-zukan-app-experience] .home-guest-hero:has([data-home-empty-proof]){grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);align-items:center}
body[data-zukan-app-experience] .home-guest-proof.is-empty{aspect-ratio:auto;border:0;border-inline-start:2px solid var(--zukan-line);border-radius:0;background:transparent;grid-template-rows:auto;box-shadow:none}
body[data-zukan-app-experience] .home-empty-proof-copy{display:grid;padding:var(--zukan-space-2) 0 var(--zukan-space-2) var(--zukan-space-6);gap:var(--zukan-space-3);background:none;text-align:start}
body[data-zukan-app-experience] .home-empty-proof-copy strong{font-size:1rem;line-height:1.7;font-weight:700;color:var(--zukan-text-primary)}
body[data-zukan-app-experience] .home-guest-proof.is-empty .home-empty-proof-copy p{font-size:1rem!important;font-weight:400;line-height:1.8;text-align:start;padding:0;max-width:none;color:var(--zukan-text-secondary)}
body[data-zukan-app-experience] .home-state-view.is-guest :is(.home-place-section,.home-community-section){display:block;min-width:0;overflow:visible;border:0;border-top:1px solid var(--zukan-line);border-radius:0;background:transparent;padding:var(--zukan-space-6) 0 0;box-shadow:none}
body[data-zukan-app-experience] .home-place-section>div:last-child{padding:0}
body[data-zukan-app-experience] .home-state-view.is-guest :is(.home-place-section>div,.home-community-section){display:grid;align-content:start;justify-items:start;gap:var(--zukan-space-4)}
body[data-zukan-app-experience] .home-state-view.is-guest .home-product-kicker{font-size:.875rem;letter-spacing:.08em;font-weight:700;color:var(--zukan-text-secondary)}
body[data-zukan-app-experience] .home-state-view.is-guest .home-section h2{font-size:1.5rem;line-height:1.45;margin:0}
body[data-zukan-app-experience] .home-state-view.is-guest .home-section p{font-size:1rem;line-height:1.8;margin:0;max-width:45em}
body[data-zukan-app-experience] .home-state-view.is-guest :is(.home-primary-button,.home-secondary-button){display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:var(--zukan-space-2) var(--zukan-space-6);font-size:1rem;line-height:1.5;font-weight:700;border-radius:var(--zukan-radius-control);box-shadow:none;text-decoration:none}
body[data-zukan-app-experience] .home-state-view.is-guest .home-primary-button{background:var(--zukan-action-capture);color:#fff}
body[data-zukan-app-experience] .home-state-view.is-guest .home-secondary-button{border:1px solid var(--zukan-border-control);color:var(--zukan-action-primary);background:var(--zukan-surface-base)}
body[data-zukan-app-experience] .home-state-view.is-guest .home-secondary-link{font-size:1rem;font-weight:700;min-height:44px;display:inline-flex;align-items:center;text-underline-offset:.25em}
body[data-zukan-app-experience] .home-state-view.is-guest .home-privacy-section{display:grid;grid-template-columns:24px minmax(0,1fr);align-items:start;gap:var(--zukan-space-4);padding:var(--zukan-space-6);border:0;background:var(--zukan-surface-subtle);border-radius:var(--zukan-radius-content)}
body[data-zukan-app-experience] .home-state-view.is-guest .home-privacy-section h2{font-size:1.125rem;margin:0 0 var(--zukan-space-2)}
body[data-zukan-app-experience] .home-state-view.is-guest .home-privacy-icon{width:24px;height:24px;margin:2px 0 0}
body[data-zukan-app-experience] .home-state-view.is-guest .home-privacy-icon svg{width:24px;height:24px}
body[data-zukan-app-experience] .home-state-view.is-guest .home-final-section{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--zukan-space-6);padding:0;border:0;text-align:start}
body[data-zukan-app-experience] .home-state-view.is-guest .home-operator-statement{font-size:.875rem;line-height:1.7;margin:0;padding-top:var(--zukan-space-6);border-top:1px solid var(--zukan-line);color:var(--zukan-text-secondary)}
@media(hover:hover){body[data-zukan-app-experience] .home-state-view.is-guest .home-primary-button:hover{background:var(--zukan-action-capture-hover)}body[data-zukan-app-experience] .home-state-view.is-guest .home-secondary-button:hover{background:var(--zukan-surface-subtle)}body[data-zukan-app-experience] .home-state-view.is-guest .home-secondary-link:hover{text-decoration:underline}}
body[data-zukan-app-experience] .home-member-primary{border-radius:16px}
body[data-zukan-app-experience] .home-member-primary.is-memory{grid-template-columns:1fr 1fr}
body[data-zukan-app-experience] .home-member-primary-media .home-card-media{min-height:0;aspect-ratio:4/3;height:auto}
body[data-zukan-app-experience] .home-recent-grid{display:grid;grid-auto-flow:row;grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible;gap:20px}
body[data-zukan-app-experience] .home-recent-card .home-card-media{aspect-ratio:4/3;min-height:0}
body[data-zukan-app-experience] .cf-record-shell{max-width:680px;margin-block:32px 64px}
body[data-zukan-app-experience] :is(.cf-record-form,.cf-record-pick){box-shadow:none;border-color:var(--zukan-line);border-radius:12px}
body[data-zukan-app-experience] .cf-record-submit button{background:var(--zukan-green);color:var(--zukan-on-action-primary)}
body[data-zukan-app-experience] .cf-record-coordinates{background:var(--zukan-paper)}
body[data-zukan-app-experience] .cf-record-status{color:var(--zukan-green);font-weight:600}
body[data-zukan-app-experience] .cf-recovery-card{background:#fff;border:1px solid var(--zukan-line);border-radius:12px;box-shadow:none}
body[data-zukan-app-experience] .cf-recovery-actions .primary{background:var(--zukan-green);color:var(--zukan-on-action-primary)}
body[data-zukan-app-experience] .of-header{position:static;border:0;max-width:1160px;margin:auto;height:auto;padding:12px 24px}
body[data-zukan-app-experience] .of-page{max-width:1160px;margin:0 auto}
body[data-zukan-app-experience] .of-layout{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)}
body[data-zukan-app-experience] .of-media-column{top:88px}
body[data-zukan-app-experience] .of-media-stage{min-height:0;background:var(--zukan-paper);border-radius:12px;overflow:hidden}
body[data-zukan-app-experience] .of-media-slide{min-height:0;aspect-ratio:4/3}
body[data-zukan-app-experience] .of-media-slide :is(img,video){width:100%;height:100%;max-height:65vh;object-fit:contain}
body[data-zukan-app-experience] .of-panel{padding:0 24px 32px;border:0;min-height:0}
body[data-zukan-app-experience] .of-record-info h1{font-size:30px}
body[data-zukan-app-experience] :is(.of-summary,.of-scene,.of-environment,.of-comparison,.of-note,.of-manage,.of-capture){border-radius:8px;box-shadow:none}
body[data-zukan-app-experience] .of-note{background:#fff;border:0;border-block:1px solid var(--zukan-line);border-radius:0;padding:20px 0}
body[data-zukan-app-experience] .of-meta{font-size:14px}
@media(min-width:1161px){body[data-zukan-app-experience] .global-record-launcher{display:none!important}body[data-zukan-app-experience] .site-shell.has-global-record-launcher{padding-bottom:24px}}
@media(max-width:1160px){
 body[data-zukan-app-experience]{padding-bottom:calc(76px + env(safe-area-inset-bottom))}
 body[data-zukan-app-experience] .site-header-inner,.zukan-app-header>div{height:64px;padding:0 12px;gap:10px}
 body[data-zukan-app-experience] .site-core-nav,.zukan-app-nav.is-header{display:none!important}
 body[data-zukan-app-experience] .global-record-launcher,.zukan-app-nav.is-bottom{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));position:fixed;z-index:85;left:0;right:0;bottom:0;width:100%;max-width:none;transform:none;gap:4px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));border:0;border-top:1px solid var(--zukan-line);border-radius:0;background:#fff;box-shadow:none}
 .zukan-app-nav.is-bottom a,.zukan-app-nav.is-bottom .global-record-choice{flex-direction:column;gap:3px;font-size:12px;min-height:56px;padding:5px 2px;border-radius:8px;line-height:1.15;text-align:center}
 body[data-zukan-app-experience] .site-shell.has-global-record-launcher{padding-bottom:calc(112px + max(0px, env(safe-area-inset-bottom)))}
 body[data-zukan-app-experience] .home-recent-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 body[data-zukan-app-experience] .of-media-column{top:80px}
}
@media(max-width:767px){
 body[data-zukan-app-experience] .home-state-view{gap:36px;padding-top:16px}
 body[data-zukan-app-experience] .home-guest-hero.has-visual,body[data-zukan-app-experience] .home-member-primary.is-memory{grid-template-columns:1fr}
 body[data-zukan-app-experience] .home-state-view.is-guest{grid-template-columns:1fr;gap:var(--zukan-space-8);padding-block:var(--zukan-space-8) var(--zukan-space-4)}
 body[data-zukan-app-experience] .home-guest-hero:has([data-home-empty-proof]){grid-template-columns:1fr;gap:var(--zukan-space-6)}
 body[data-zukan-app-experience] .home-guest-hero h1{font-size:clamp(1.875rem,8vw,2.125rem)}
 body[data-zukan-app-experience] .home-guest-hero-copy{gap:var(--zukan-space-4)}
 body[data-zukan-app-experience] .home-state-view.is-guest .home-privacy-section{padding:var(--zukan-space-4)}
 body[data-zukan-app-experience] .home-recent-grid{grid-template-columns:1fr;gap:12px}
 body[data-zukan-app-experience] .home-recent-card{grid-template-columns:104px minmax(0,1fr);gap:14px;align-items:center}
 body[data-zukan-app-experience] .home-recent-card .home-card-media{aspect-ratio:1}
 body[data-zukan-app-experience] .of-layout{display:grid;grid-template-columns:1fr}
 body[data-zukan-app-experience] .of-panel{display:contents}
 body[data-zukan-app-experience] .of-record-info{grid-row:1;padding:8px 16px 16px}
 body[data-zukan-app-experience] .of-media-column{position:static;grid-row:2;padding:0 16px 16px}
 body[data-zukan-app-experience] .of-panel> :not(.of-record-info){margin:0 16px 16px}
 body[data-zukan-app-experience] .of-record-info h1{font-size:26px}
 body[data-zukan-app-experience] .of-observation-details[open],body[data-zukan-app-experience] .of-manage[open]{position:static;inset:auto;overflow:visible;padding:16px;border-radius:8px}
 body[data-zukan-app-experience] .of-header{padding:8px 16px}
}
@media(prefers-reduced-motion:reduce){body[data-zukan-app-experience] *{scroll-behavior:auto!important}}
@media(max-width:430px){body[data-zukan-app-experience] .site-header-inner{gap:8px}body[data-zukan-app-experience] .site-header-home .site-header-inner{width:100%;gap:4px}body[data-zukan-app-experience] .zukan-app-language .lang-switch-label{padding-inline:0}body[data-zukan-app-experience] .home-header-login{padding-inline:4px;white-space:nowrap;flex-shrink:0}}
`;

export const APP_EXPERIENCE_STYLES = `${ZUKAN_DESIGN_FOUNDATION_STYLES}\n${APP_EXPERIENCE_LAYOUT_STYLES}`;
