export type ZukanShellNavKey = "library" | "events" | "places" | "profile";
type Lang = "ja" | "en" | "es" | "pt-br";

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ZUKAN_SHELL_ICONS = {
  library: svg('<rect x="3.5" y="4" width="17" height="16" rx="3"/><circle cx="9" cy="9.5" r="1.6"/><path d="m4 17 5-4.5 3.5 3L15 13.5l5 4.5"/>'),
  events: svg('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>'),
  camera: svg('<path d="M14.5 5h-5L8 7H5.5A2.5 2.5 0 0 0 3 9.5v8A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-8A2.5 2.5 0 0 0 18.5 7H16z"/><circle cx="12" cy="13" r="3.4"/>'),
  places: svg('<path d="M19 10.2c0 5-7 10.8-7 10.8S5 15.2 5 10.2a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>'),
  profile: svg('<circle cx="12" cy="8.2" r="3.6"/><path d="M5 20c.6-3.7 3.4-5.6 7-5.6s6.4 1.9 7 5.6"/>'),
  book: svg('<path d="M6 3.5h11.5A1.5 1.5 0 0 1 19 5v14.5H7.500A1.5 1.5 0 0 1 6 18z"/><path d="M6 18a1.5 1.5 0 0 1 1.5-1.5H19"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
};

export const ZUKAN_SHELL_CSS = `
    :root{color-scheme:light;--bg:#fff;--surface:#f7f7f3;--surface-2:#e8efea;--ink:#17211b;--muted:#55615a;--green:#143f2e;--green-hover:#0f3023;--capture:#143f2e;--line:#dde2dc;--control:#68746c;--link:#0055ad}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans JP",system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6}
    a,a:visited{color:var(--green)}
    .zt-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
    .zt-shell{min-height:100vh;padding-bottom:calc(84px + env(safe-area-inset-bottom))}
    .zt-topbar{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:12px 20px 4px;background:var(--bg)}
    .zt-logo,.zt-logo:visited{display:inline-flex;align-items:center;min-height:44px;text-decoration:none}
    .zt-logo img{display:block;height:26px;width:auto}
    .zt-login-btn,.zt-login-btn:visited{min-height:44px;flex:none;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;padding:0 22px;border:2px solid var(--green);border-radius:999px;color:var(--green);font-weight:700;font-size:16px;text-decoration:none;background:#fff}
    .zt-avatar,.zt-avatar:visited{width:44px;height:44px;min-width:44px;min-height:44px;flex:none;aspect-ratio:1/1;line-height:1;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:var(--green);color:#fff;font-weight:700;font-size:18px;text-decoration:none;overflow:hidden}
    .zt-search{position:relative;display:block;width:100%;max-width:560px}
    .zt-search input{width:100%;min-height:48px;padding:8px 16px 8px 48px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink);font:inherit;font-size:16px;box-shadow:0 1px 2px rgba(20,63,46,.06)}
    .zt-search input::placeholder{color:#3d4a42;opacity:1}
    .zt-search>svg{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}
    .zt-main{max-width:1120px;margin:0 auto;padding:12px 20px 24px;display:grid;grid-template-columns:minmax(0,1fr);gap:28px}
    .zt-main>*,.zt-shell>*{min-width:0}
    .zt-main h1{margin:0;font-size:28px;line-height:1.35;font-weight:700}
    .zt-main h2{line-height:1.4}
    .zt-group{display:grid;gap:12px}
    .zt-group-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .zt-group-head h2{margin:0;font-size:18px;font-weight:700}
    .zt-lib-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    @media(min-width:900px){.zt-lib-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
    .zt-lib-thumb,.zt-lib-thumb:visited{display:block;aspect-ratio:1/1;border-radius:8px;overflow:hidden;background:var(--surface);text-decoration:none;color:var(--ink)}
    .zt-lib-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .zt-lib-fallback{display:flex;align-items:center;justify-content:center;height:100%;padding:6px;font-size:14px;text-align:center}
    .zt-pair-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    .zt-pair-card,.zt-pair-card:visited{display:grid;gap:4px;text-decoration:none;color:var(--ink);font-size:14px;font-weight:700}
    .zt-pair-card img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px}
    .zt-btn-capture,.zt-btn-capture:visited{min-height:52px;padding:12px 22px;border:0;border-radius:999px;background:var(--green);color:#fff;font-weight:700;font-size:16px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}
    .zt-btn-capture svg{width:20px;height:20px}
    .zt-btn-outline,.zt-btn-outline:visited{min-height:48px;padding:10px 20px;border-radius:999px;background:#fff;color:var(--green);border:2px solid var(--green);font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:16px}
    .zt-link-cancel,.zt-link-cancel:visited{justify-self:start;min-height:44px;display:inline-flex;align-items:center;color:#b3261e;font-size:14px;font-weight:700;text-decoration:none}
    .zt-hub-card{padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--surface);display:grid;gap:12px}
    .zt-hub-card h1,.zt-hub-card h2,.zt-hub-card p{margin:0}
    .zt-hub-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}
    .zt-hub-dest,.zt-hub-dest:visited{display:grid;gap:4px;padding:16px;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);text-decoration:none}
    .zt-hub-dest strong{color:var(--green);font-size:16px}
    .zt-hub-dest span{color:var(--muted);font-size:14px}
    .zt-feedback-foot{justify-self:center}
    .zt-feedback-foot a,.zt-feedback-foot a:visited{min-height:44px;display:inline-flex;align-items:center;color:var(--muted);font-size:14px;font-weight:700;text-decoration:underline}
    .zt-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:end;background:#fff;border-top:1px solid var(--line);padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
    .zt-nav-item,.zt-nav-item:visited{min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:3px;text-decoration:none;color:var(--muted);font-size:12px;line-height:1.2;text-align:center;padding:4px 2px;font-weight:500}
    .zt-nav-item svg{width:26px;height:26px;flex:none}
    .zt-nav-item[aria-current="page"],.zt-nav-item[aria-current="page"]:visited{color:var(--green);font-weight:700}
    .zt-nav-item[aria-current="page"] svg{stroke-width:2.2}
    .zt-nav-capture,.zt-nav-capture:visited{color:var(--green);font-weight:700}
    .zt-nav-capture .zt-nav-cap{width:52px;height:52px;margin-top:-24px;margin-bottom:-1px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--green);color:#fff;border:4px solid #fff;box-shadow:0 2px 10px rgba(20,63,46,.28)}
    .zt-nav-capture .zt-nav-cap svg{width:24px;height:24px}
    .zt-sidebar{display:none}
    @media(min-width:960px){
      .zt-shell{padding-bottom:0}
      .zt-shell:has(>.zt-sidebar){display:grid;grid-template-columns:236px minmax(0,1fr)}
      .zt-sidebar{display:flex;flex-direction:column;gap:6px;padding:20px 16px;border-right:1px solid var(--line);background:#fff;position:sticky;top:0;height:100vh}
      .zt-side-logo{display:inline-flex;align-items:center;min-height:44px;margin:0 0 14px 8px}
      .zt-side-logo img{display:block;height:24px;width:auto}
      .zt-sidebar .zt-btn-capture{width:100%;min-height:48px;border-radius:12px;margin-bottom:10px}
      .zt-sidebar .zt-nav-item{flex-direction:row;justify-content:flex-start;gap:14px;min-height:46px;padding:0 14px;border-radius:12px;font-size:15px;font-weight:500;color:var(--ink)}
      .zt-sidebar .zt-nav-item svg{width:22px;height:22px;color:var(--muted)}
      .zt-sidebar .zt-nav-item[aria-current="page"]{background:var(--surface-2);font-weight:700;color:var(--green)}
      .zt-sidebar .zt-nav-item[aria-current="page"] svg{color:var(--green)}
      .zt-sidebar .zt-nav-feedback{margin-top:auto;font-size:14px;color:var(--muted)}
      .zt-side-me,.zt-side-me:visited{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px;color:var(--ink);font-weight:700;text-decoration:none;border-top:1px solid var(--line)}
      .zt-side-me>span:last-child{min-width:0;overflow-wrap:anywhere}
      .zt-side-me .zt-avatar{width:36px;height:36px;min-width:36px;min-height:36px;font-size:15px}
      .zt-topbar.zt-topbar-member{display:none}
      .zt-topbar{padding:16px 32px 0}
      .zt-main{padding:20px 32px 32px}
      .zt-bottom-nav,.zt-feedback-foot{display:none}
    }
`;

export type ZukanChromeOptions = {
  lang: Lang;
  activeNav: ZukanShellNavKey;
  authenticated: boolean;
  displayName?: string | null;
  searchAction?: string;
  searchQuery?: string;
  pathname?: string;
  homeHref?: string;
};

export function zukanChromePrefix(lang: Lang): string {
  return lang === "ja" ? "/ja" : `/${lang}`;
}

export function renderZukanChrome(options: ZukanChromeOptions): {
  sidebarHtml: string;
  topbarHtml: string;
  searchHtml: string;
  bottomNavHtml: string;
  feedbackFootHtml: string;
} {
  const isEn = options.lang === "en";
  const prefix = zukanChromePrefix(options.lang);
  const homeHref = options.homeHref ?? `${prefix}/library`;
  const homeLabel = options.authenticated ? (isEn ? "Library" : "ライブラリ") : (isEn ? "Home" : "ホーム");
  const cur = (key: ZukanShellNavKey) => (options.activeNav === key ? ' aria-current="page"' : "");
  const initial = esc(Array.from(options.displayName || (isEn ? "Me" : "自分"))[0] ?? "");
  const feedbackHref = esc(`${prefix}/otayori?from=${encodeURIComponent(options.pathname ?? `${prefix}/`)}`);
  const feedbackLabel = isEn ? "Feedback" : "改善のご要望";
  const logoImg = `<img src="/assets/brand/zukan-lockup.svg" alt="ZUKAN" width="121" height="26">`;
  const meLabel = esc(options.displayName || (isEn ? "Me" : "自分"));
  const captureLabel = isEn ? "Capture" : "撮る";
  const items: Array<[ZukanShellNavKey, string, string, string]> = [
    ["library", homeHref, homeLabel, ZUKAN_SHELL_ICONS.library],
    ["events", `${prefix}/community/events`, isEn ? "Events" : "イベント", ZUKAN_SHELL_ICONS.events],
    ["places", `${prefix}/map`, isEn ? "Places" : "場所", ZUKAN_SHELL_ICONS.places],
    ["profile", `${prefix}/profile`, isEn ? "Me" : "自分", ZUKAN_SHELL_ICONS.profile],
  ];
  const sideItem = (it: (typeof items)[number]) => `<a class="zt-nav-item" href="${esc(it[1])}"${cur(it[0])}>${it[3]}<span>${esc(it[2])}</span></a>`;
  const sidebarHtml = `<aside class="zt-sidebar" aria-label="${isEn ? "Navigation" : "ナビ"}">
      <a class="zt-side-logo" href="${esc(`${prefix}/`)}">${logoImg}</a>
      <a class="zt-btn-capture" href="${esc(`${prefix}/record`)}">${ZUKAN_SHELL_ICONS.camera}${captureLabel}</a>
      ${items.map(sideItem).join("\n      ")}
      <a class="zt-nav-item zt-nav-feedback" data-zukan-otayori-sidebar="1" href="${feedbackHref}">${feedbackLabel}</a>
      ${options.authenticated ? `<a class="zt-side-me" href="${esc(`${prefix}/profile`)}"><span class="zt-avatar" aria-hidden="true">${initial}</span><span>${meLabel}</span></a>` : ""}
    </aside>`;
  const topbarHtml = options.authenticated
    ? `<header class="zt-topbar zt-topbar-member">
        <a class="zt-logo" href="${esc(`${prefix}/`)}">${logoImg}</a>
        <a class="zt-avatar" href="${esc(`${prefix}/profile`)}" aria-label="${isEn ? "Me" : "自分"}">${initial}</a>
      </header>`
    : `<header class="zt-topbar">
        <a class="zt-logo" href="${esc(`${prefix}/`)}">${logoImg}</a>
        <a class="zt-login-btn" href="${esc(`${prefix}/login`)}">${isEn ? "Sign in" : "ログイン"}</a>
      </header>`;
  const searchHtml = options.searchAction
    ? `<form class="zt-search" method="get" action="${esc(options.searchAction)}" role="search">${ZUKAN_SHELL_ICONS.search}<input type="search" name="q" value="${esc(options.searchQuery ?? "")}" placeholder="${isEn ? "Festival, river, last autumn" : "祭り・川・去年の秋で探す"}" aria-label="${isEn ? "Search" : "検索"}"></form>`
    : "";
  const bottomNavHtml = `<nav class="zt-bottom-nav" aria-label="${isEn ? "Menu" : "メニュー"}">
    <a class="zt-nav-item" href="${esc(items[0]![1])}"${cur("library")}>${items[0]![3]}<span>${esc(homeLabel)}</span></a>
    <a class="zt-nav-item" href="${esc(items[1]![1])}"${cur("events")}>${items[1]![3]}<span>${esc(items[1]![2])}</span></a>
    <a class="zt-nav-item zt-nav-capture" href="${esc(`${prefix}/record`)}"><span class="zt-nav-cap">${ZUKAN_SHELL_ICONS.camera}</span><span>${captureLabel}</span></a>
    <a class="zt-nav-item" href="${esc(items[2]![1])}"${cur("places")}>${items[2]![3]}<span>${esc(items[2]![2])}</span></a>
    <a class="zt-nav-item" href="${esc(items[3]![1])}"${cur("profile")}>${items[3]![3]}<span>${esc(items[3]![2])}</span></a>
  </nav>`;
  const feedbackFootHtml = `<p class="zt-feedback-foot"><a data-zukan-otayori-menu="1" href="${feedbackHref}">${feedbackLabel}</a></p>`;
  return { sidebarHtml, topbarHtml, searchHtml, bottomNavHtml, feedbackFootHtml };
}
