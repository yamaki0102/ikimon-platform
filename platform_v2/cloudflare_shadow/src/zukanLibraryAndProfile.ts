import { renderOtayoriFloatingButton } from "./otayori";
import type { ZukanTopPageData } from "./zukanTopPage";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type ZukanShellNavKey = "library" | "events" | "places" | "profile";

export function renderZukanCommonShell(options: {
  lang: "ja" | "en" | "es" | "pt-br";
  title: string;
  activeNav: ZukanShellNavKey;
  authenticated: boolean;
  displayName?: string | null;
  searchAction?: string;
  searchQuery?: string;
  bodyHtml: string;
  pathname?: string;
}): string {
  const isEn = options.lang === "en";
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const homeLabel = options.authenticated ? (isEn ? "Library" : "ライブラリ") : (isEn ? "Home" : "ホーム");
  const cur = (key: ZukanShellNavKey) => (options.activeNav === key ? ' aria-current="page"' : "");
  const searchHtml = options.searchAction
    ? `<form class="zt-search" method="get" action="${escapeHtml(options.searchAction)}">
        <input type="search" name="q" value="${escapeHtml(options.searchQuery ?? "")}" placeholder="${isEn ? "Search species or places" : "生きものや場所を探す"}" aria-label="${isEn ? "Search" : "検索"}">
      </form>`
    : "";
  const accountHtml = options.authenticated
    ? `<a class="zt-avatar" href="${escapeHtml(`${prefix}/profile`)}">${escapeHtml((options.displayName || (isEn ? "Me" : "自分")).slice(0, 8))}</a>`
    : `<a class="zt-login-btn" href="${escapeHtml(`${prefix}/login`)}">${isEn ? "Sign in" : "ログイン"}</a>`;

  return `<!doctype html>
<html lang="${escapeHtml(options.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(options.title)} — ZUKAN</title>
  <style>
    :root{color-scheme:light;--bg:#ffffff;--surface:#f6f7f6;--ink:#17251b;--muted:#485a4e;--green:#245c3a;--capture:#b94f18;--line:#dce3dd}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans JP",system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.5}
    a,a:visited{color:var(--green)}
    .zt-shell{min-height:100vh;padding-bottom:76px}
    .zt-topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;justify-content:space-between;padding:10px 16px;background:var(--bg);border-bottom:1px solid var(--line)}
    .zt-logo,.zt-logo:visited{font-weight:800;font-size:18px;letter-spacing:.04em;color:var(--green);text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
    .zt-login-btn,.zt-login-btn:visited,.zt-avatar,.zt-avatar:visited{min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;color:var(--green);font-weight:700;text-decoration:none;border-radius:999px}
    .zt-avatar{background:var(--surface);border:1px solid var(--line)}
    .zt-search{flex:1;max-width:460px}
    .zt-search input{width:100%;min-height:44px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:var(--surface);font:inherit;font-size:14px}
    .zt-main{max-width:1120px;margin:0 auto;padding:16px;display:grid;grid-template-columns:minmax(0,1fr);gap:24px}
    .zt-main>*,.zt-shell>*{min-width:0}
    .zt-group{display:grid;gap:10px}
    .zt-group-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .zt-group-head h2{margin:0;font-size:16px;font-weight:700}
    .zt-lib-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
    @media(min-width:900px){.zt-lib-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
    .zt-lib-thumb,.zt-lib-thumb:visited{display:block;aspect-ratio:1/1;border-radius:6px;overflow:hidden;background:var(--surface);text-decoration:none;color:var(--ink)}
    .zt-lib-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .zt-lib-fallback{display:flex;align-items:center;justify-content:center;height:100%;padding:6px;font-size:14px;text-align:center}
    .zt-pair-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    .zt-pair-card,.zt-pair-card:visited{display:grid;gap:4px;text-decoration:none;color:var(--ink);font-size:14px;font-weight:700}
    .zt-pair-card img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}
    .zt-btn-capture,.zt-btn-capture:visited{min-height:44px;padding:10px 18px;border-radius:8px;background:var(--capture);color:#fff;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
    .zt-btn-outline,.zt-btn-outline:visited{min-height:44px;padding:10px 18px;border-radius:8px;background:#fff;color:var(--green);border:1px solid var(--green);font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:15px}
    .zt-hub-card{padding:20px;border:1px solid var(--line);border-radius:14px;background:var(--surface);display:grid;gap:12px}
    .zt-hub-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}
    .zt-hub-dest,.zt-hub-dest:visited{display:grid;gap:4px;padding:16px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);text-decoration:none}
    .zt-hub-dest strong{color:var(--green);font-size:16px}
    .zt-hub-dest span{color:var(--muted);font-size:14px}
    .zt-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:30;display:grid;grid-template-columns:repeat(5,1fr);background:#fff;border-top:1px solid var(--line);padding:4px 6px}
    .zt-nav-item,.zt-nav-item:visited{min-height:48px;display:flex;align-items:center;justify-content:center;text-decoration:none;color:var(--muted);font-size:14px;font-weight:700;border-radius:8px}
    .zt-nav-item[aria-current="page"],.zt-nav-item[aria-current="page"]:visited{color:var(--green)}
    .zt-nav-capture,.zt-nav-capture:visited{background:var(--capture);color:#fff}
    .zt-sidebar{display:none}
    @media(min-width:960px){
      .zt-shell{display:grid;grid-template-columns:220px 1fr;padding-bottom:0}
      .zt-sidebar{display:flex;flex-direction:column;gap:8px;padding:16px;border-right:1px solid var(--line);background:#fff;position:sticky;top:0;height:100vh}
      .zt-bottom-nav{display:none}
    }
  </style>
</head>
<body>
  <div class="zt-shell">
    <aside class="zt-sidebar" aria-label="${isEn ? "Navigation" : "ナビ"}">
      <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/record`)}">${isEn ? "Capture" : "撮る"}</a>
      <a class="zt-nav-item" href="${escapeHtml(`${prefix}/library`)}"${cur("library")}>${escapeHtml(homeLabel)}</a>
      <a class="zt-nav-item" href="${escapeHtml(`${prefix}/community/events`)}"${cur("events")}>${isEn ? "Events" : "イベント"}</a>
      <a class="zt-nav-item" href="${escapeHtml(`${prefix}/map`)}"${cur("places")}>${isEn ? "Places" : "場所"}</a>
      <a class="zt-nav-item" href="${escapeHtml(`${prefix}/profile`)}"${cur("profile")}>${isEn ? "Me" : "自分"}</a>
    </aside>
    <div>
      <header class="zt-topbar">
        <a class="zt-logo" href="${escapeHtml(`${prefix}/`)}">ZUKAN</a>
        ${searchHtml}
        ${accountHtml}
      </header>
      <main class="zt-main">
        ${options.bodyHtml}
      </main>
    </div>
  </div>
  <nav class="zt-bottom-nav" aria-label="${isEn ? "Menu" : "メニュー"}">
    <a class="zt-nav-item" href="${escapeHtml(`${prefix}/library`)}"${cur("library")}>${escapeHtml(homeLabel)}</a>
    <a class="zt-nav-item" href="${escapeHtml(`${prefix}/community/events`)}"${cur("events")}>${isEn ? "Events" : "イベント"}</a>
    <a class="zt-nav-item zt-nav-capture" href="${escapeHtml(`${prefix}/record`)}">${isEn ? "Capture" : "撮る"}</a>
    <a class="zt-nav-item" href="${escapeHtml(`${prefix}/map`)}"${cur("places")}>${isEn ? "Places" : "場所"}</a>
    <a class="zt-nav-item" href="${escapeHtml(`${prefix}/profile`)}"${cur("profile")}>${isEn ? "Me" : "自分"}</a>
  </nav>
  ${renderOtayoriFloatingButton({ lang: isEn ? "en" : "ja", pathname: options.pathname ?? `${prefix}/` })}
</body>
</html>`;
}

export function renderZukanLibraryPage(
  data: Pick<ZukanTopPageData, "libraryGroups" | "oneYearPair">,
  options: {
    lang: "ja" | "en" | "es" | "pt-br";
    authenticated: boolean;
    displayName?: string | null;
    searchQuery?: string;
  }
): string {
  const isEn = options.lang === "en";
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const groupsHtml = data.libraryGroups.length > 0
    ? data.libraryGroups
        .map(
          (group) => `<section class="zt-group" data-library-group="${escapeHtml(group.groupKey)}">
            <div class="zt-group-head">
              <h2>${escapeHtml(group.headerLabel)}（${group.photos.length}）</h2>
              <a class="zt-btn-outline" href="${escapeHtml(`${prefix}/records?view=mine`)}">${group.published ? (isEn ? "Published" : "公開中・確認") : (isEn ? "Review & publish" : "まとめて確認・公開")}</a>
            </div>
            <div class="zt-lib-grid">
              ${group.photos
                .map((item) =>
                  `<a class="zt-lib-thumb" href="${escapeHtml(`${prefix}/observations/${encodeURIComponent(item.observationId)}`)}">${
                    item.photoUrl
                      ? `<img src="${escapeHtml(item.photoUrl)}" alt="${escapeHtml(item.title)}" loading="lazy">`
                      : `<span class="zt-lib-fallback">${escapeHtml(item.title)}</span>`
                  }</a>`
                )
                .join("")}
            </div>
          </section>`
        )
        .join("")
    : `<section class="zt-hub-card" data-library-empty="1">
        <h2>${isEn ? "Your library is empty" : "まだ記録がありません"}</h2>
        <p>${isEn ? "Capture a photo or note to start building your library." : "1枚撮って残すと、日付と場所ごとにここへ並びます。"}</p>
        <div><a class="zt-btn-capture" href="${escapeHtml(`${prefix}/record`)}">${isEn ? "Capture" : "撮る"}</a></div>
      </section>`;

  const pairHtml = data.oneYearPair && data.oneYearPair.photos.length > 0
    ? `<section class="zt-group" data-library-one-year-pair="1">
        <div class="zt-group-head"><h2>${isEn ? "One year ago today" : "去年の今日"} · ${escapeHtml(data.oneYearPair.placeName)}</h2></div>
        <div class="zt-pair-grid">
          ${data.oneYearPair.photos
            .map(
              (p) => `<a class="zt-pair-card" href="${escapeHtml(p.href)}">
                <img src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(p.monthLabel)}">
                <span>${escapeHtml(p.monthLabel)}</span>
              </a>`
            )
            .join("")}
        </div>
      </section>`
    : "";

  const bodyHtml = `<header class="zt-hub-card">
      <h1>${isEn ? "Library" : "ライブラリ"}</h1>
      <p>${isEn ? "Your saved observations grouped by date and place." : "撮った記録を日付と場所ごとにまとめて見返せます。"}</p>
    </header>
    ${pairHtml}
    ${groupsHtml}`;

  return renderZukanCommonShell({
    lang: options.lang,
    title: isEn ? "Library" : "ライブラリ",
    activeNav: "library",
    authenticated: options.authenticated,
    displayName: options.displayName,
    searchAction: `${prefix}/library`,
    searchQuery: options.searchQuery,
    bodyHtml,
    pathname: `${prefix}/library`,
  });
}

export function renderZukanProfileHubPage(options: {
  lang: "ja" | "en" | "es" | "pt-br";
  displayName: string;
}): string {
  const isEn = options.lang === "en";
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const bodyHtml = `<section class="zt-hub-card" data-testid="self-control-hub">
      <h1 data-testid="profile-heading">${escapeHtml(options.displayName)}</h1>
      <p>${isEn ? "Review your library, joined events, and account settings." : "自分のライブラリや参加中の観察会、アカウント設定を確認できます。"}</p>
      <div class="zt-hub-grid">
        <a class="zt-hub-dest" href="${escapeHtml(`${prefix}/library`)}">
          <strong>${isEn ? "Library" : "ライブラリ"}</strong>
          <span>${isEn ? "View your saved records by date and place" : "残した記録を日付・場所ごとに見る"}</span>
        </a>
        <a class="zt-hub-dest" href="${escapeHtml(`${prefix}/records?view=mine`)}">
          <strong>${isEn ? "My records" : "自分の記録一覧"}</strong>
          <span>${isEn ? "Review and manage visibility" : "記録の公開範囲や詳細を確認する"}</span>
        </a>
        <a class="zt-hub-dest" href="${escapeHtml(`${prefix}/community/events`)}">
          <strong>${isEn ? "Events" : "参加先を探す"}</strong>
          <span>${isEn ? "Browse observation events" : "イベントや活動の一覧を見る"}</span>
        </a>
        <a class="zt-hub-dest" href="${escapeHtml(`${prefix}/profile/settings`)}">
          <strong>${isEn ? "Settings & withdrawal" : "設定・退会"}</strong>
          <span>${isEn ? "Language settings and account withdrawal" : "表示言語と退会の確認"}</span>
        </a>
      </div>
    </section>`;

  return renderZukanCommonShell({
    lang: options.lang,
    title: isEn ? "My Page" : "自分",
    activeNav: "profile",
    authenticated: true,
    displayName: options.displayName,
    bodyHtml,
    pathname: `${prefix}/profile`,
  });
}
