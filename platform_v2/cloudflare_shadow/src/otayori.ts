import { ZUKAN_SHELL_CSS, renderZukanChrome } from "./zukanShellChrome";

export const OTAYORI_STATUSES = [
  "received",
  "triaging",
  "in_progress",
  "waiting_user",
  "replied",
  "resolved",
  "closed",
] as const;

export type OtayoriStatus = (typeof OTAYORI_STATUSES)[number];

export const OTAYORI_STATUS_LABELS: Record<OtayoriStatus, string> = {
  received: "受付済み",
  triaging: "確認中",
  in_progress: "対応中",
  waiting_user: "お返事待ち",
  replied: "お返事あり",
  resolved: "対応完了",
  closed: "終了",
};

export interface OtayoriLetterRow {
  letter_id: string;
  user_id: string;
  sender_name: string;
  body: string;
  page_path: string;
  status: OtayoriStatus;
  reply_text: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export function normalizeOtayoriStatus(raw: unknown): OtayoriStatus | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return (OTAYORI_STATUSES as readonly string[]).includes(trimmed) ? (trimmed as OtayoriStatus) : null;
}

/**
 * NOCOSIL おたより仕様: 通知は「お返事あり (replied)」のときだけ送る。
 */
export function shouldNotifyOtayoriStatus(status: OtayoriStatus): boolean {
  return status === "replied";
}

export function shouldShowOtayoriButton(context: {
  pathname?: string;
  isCamera?: boolean;
  isFullscreenMap?: boolean;
}): boolean {
  if (context.isCamera || context.isFullscreenMap) return false;
  const pathname = (context.pathname ?? "").replace(/^\/(ja|en|es|pt-br)(?=\/|$)/, "") || "/";
  if (pathname === "/record" || pathname.startsWith("/record/")) return false;
  if (pathname === "/map" || pathname.startsWith("/map/")) return false;
  return true;
}

export function renderOtayoriFloatingButton(_options: {
  lang?: string;
  pathname?: string;
  isCamera?: boolean;
  isFullscreenMap?: boolean;
} = {}): string {
  // Floating FAB removed by owner decision (11/25): placed in PC sidebar and mobile profile/menu instead.
  return "";
}

export function renderOtayoriPage(options: {
  lang?: string;
  authenticated: boolean;
  letters: OtayoriLetterRow[];
  fromPath?: string;
  sent?: boolean;
  error?: string | null;
  displayName?: string | null;
}): string {
  const lang = options.lang === "ja" ? "ja" : "en";
  const chromeLang = options.lang === "es" || options.lang === "pt-br" || options.lang === "en" ? options.lang : "ja";
  const chrome = renderZukanChrome({
    lang: chromeLang,
    activeNav: "profile",
    authenticated: options.authenticated,
    displayName: options.displayName,
    pathname: `/${chromeLang}/otayori`,
  });
  const statusHtml = options.sent
    ? `<p class="otayori-status-line" role="status">${lang === "en" ? "Thanks, we received your feedback. We will notify you only when there is a reply." : "ご要望を受け取りました。お返事があるときだけお知らせします。"}</p>`
    : options.error === "empty"
      ? `<p class="otayori-status-line otayori-status-error" role="alert">${lang === "en" ? "Please enter your feedback." : "内容を入力してください。"}</p>`
      : "";
  const lettersHtml = options.letters.length
    ? `<ul class="otayori-list">${options.letters
        .map((row) => {
          const badge = OTAYORI_STATUS_LABELS[row.status] ?? row.status;
          const replyHtml = row.reply_text
            ? `<div class="otayori-reply"><strong>${lang === "en" ? "Reply" : "お返事"}:</strong> ${escapeHtml(row.reply_text)}</div>`
            : "";
          return `<li class="otayori-item" data-otayori-id="${escapeHtml(row.letter_id)}">
            <div class="otayori-meta"><span class="otayori-status" data-status="${escapeHtml(row.status)}">${escapeHtml(badge)}</span><time>${escapeHtml(row.created_at.slice(0, 10))}</time></div>
            <p>${escapeHtml(row.body)}</p>
            ${replyHtml}
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="otayori-empty">${lang === "en" ? "No feedback sent yet." : "まだ送ったご要望はありません。"}</p>`;

  const formHtml = options.authenticated
    ? `<form class="otayori-form" method="post" action="/api/v1/otayori" data-otayori-form>
        <label for="otayori-body">${lang === "en" ? "Feedback details" : "ご要望の内容"}</label>
        <textarea id="otayori-body" name="body" rows="4" maxlength="1000" required placeholder="${lang === "en" ? "Share your feedback or improvement request..." : "気づいたことや改善のご要望をどうぞ"}"></textarea>
        <input type="hidden" name="pagePath" value="${escapeHtml(options.fromPath ?? "/")}">
        <button type="submit">${lang === "en" ? "Send feedback" : "改善のご要望を送る"}</button>
      </form>`
    : `<p class="otayori-login">${lang === "en" ? "Please sign in to send feedback and receive replies." : "改善のご要望を送ってお返事を受け取るにはログインが必要です。"} <a href="/ja/login?redirect=%2Fja%2Fotayori">${lang === "en" ? "Sign in" : "ログインする"}</a></p>`;

  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${lang === "en" ? "Feedback" : "改善のご要望"} | ZUKAN</title>
  <style>
    ${ZUKAN_SHELL_CSS}
    .otayori-col{max-width:720px;margin:0 auto;padding:6px 0 32px;display:grid;gap:18px}
    .otayori-status-line{margin:0;padding:10px 12px;border-radius:10px;background:#eef7f1;color:#245c3a;font-weight:700}
    .otayori-status-error{background:#fdeeee;color:#8a1f1f}
    .otayori-card{background:#fff;border:1px solid #d7dfd8;border-radius:14px;padding:18px;display:grid;gap:12px}
    .otayori-form{display:grid;gap:10px}
    .otayori-form textarea{width:100%;padding:10px 12px;border:1px solid #c5d1c8;border-radius:10px;font:inherit}
    .otayori-form button{min-height:44px;padding:0 18px;border:0;border-radius:10px;background:#245c3a;color:#fff;font:inherit;font-weight:800;cursor:pointer;justify-self:start}
    .otayori-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
    .otayori-item{padding:12px 14px;border:1px solid #e1e8e2;border-radius:10px;background:#fafcf9;display:grid;gap:6px}
    .otayori-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;color:#55615a}
    .otayori-status{display:inline-flex;padding:2px 8px;border-radius:999px;background:#e8f2ec;color:#245c3a;font-weight:800}
    .otayori-reply{padding:8px 10px;border-radius:8px;background:#eef7f1;font-size:14px}
    .otayori-note{margin:0;font-size:14px;color:#55615a}
    .otayori-col>*,.otayori-card>*,.otayori-list>*,.otayori-item>*{min-width:0}.otayori-item p{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}
  </style>
</head>
<body>
  <div class="zt-shell">
  ${chrome.sidebarHtml}
  <div>
  ${chrome.topbarHtml}
  <main class="zt-main" data-zukan-otayori-page="1"><div class="otayori-col">
    <section class="otayori-card">
      ${statusHtml}
      <h1>${lang === "en" ? "Feedback" : "改善のご要望"}</h1>
      <p class="otayori-note">${lang === "en" ? "Notifications are sent only when there is a reply." : "確認中・対応中などの途中経過では通知せず、お返事があるときだけ通知します。"}</p>
      ${formHtml}
    </section>
    <section class="otayori-card">
      <h2>${lang === "en" ? "Your feedback" : "これまでの改善のご要望"}</h2>
      ${lettersHtml}
    </section>
  </div></main>
  </div>
  </div>
  ${chrome.bottomNavHtml}
</body>
</html>`;
}
