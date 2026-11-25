import type { ZukanTopPageData } from "./zukanTopPage";
import { ZUKAN_LIBRARY_CSS, renderLibraryEmpty, renderLibraryGroups, renderYearPairCard } from "./zukanLibraryBlocks";
import { ZUKAN_SHELL_CSS, renderZukanChrome, type ZukanShellNavKey } from "./zukanShellChrome";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type { ZukanShellNavKey } from "./zukanShellChrome";

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
  const chrome = renderZukanChrome(options);
  return `<!doctype html>
<html lang="${escapeHtml(options.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(options.title)} — ZUKAN</title>
  <style>${ZUKAN_SHELL_CSS}${ZUKAN_LIBRARY_CSS}</style>
</head>
<body>
  <div class="zt-shell">
    ${chrome.sidebarHtml}
    <div>
      ${chrome.topbarHtml}
      <main class="zt-main">
        ${chrome.searchHtml}
        ${options.bodyHtml}
        ${chrome.feedbackFootHtml}
      </main>
    </div>
  </div>
  ${chrome.bottomNavHtml}
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
    noticeHtml?: string;
  }
): string {
  const isEn = options.lang === "en";
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const groupsHtml = data.libraryGroups.length > 0
    ? renderLibraryGroups(data.libraryGroups, { prefix, isEn, mode: "library" })
    : renderLibraryEmpty({ prefix, isEn });
  const pairHtml = data.oneYearPair && data.oneYearPair.photos.length > 0 ? renderYearPairCard(data.oneYearPair, isEn) : "";
  const bodyHtml = `<h1 class="zt-sr-only">${isEn ? "Library" : "ライブラリ"}</h1>
    ${options.noticeHtml ?? ""}
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
        <a class="zt-hub-dest" data-zukan-otayori-profile="1" href="${escapeHtml(`${prefix}/otayori?from=${encodeURIComponent(`${prefix}/profile`)}`)}">
          <strong>${isEn ? "Feedback" : "改善のご要望"}</strong>
          <span>${isEn ? "Send requests or check replies" : "気づいたことやご要望を送る・お返事を見る"}</span>
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
