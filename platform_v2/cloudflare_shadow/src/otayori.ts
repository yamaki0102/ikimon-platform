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
}): string {
  const lang = options.lang === "en" ? "en" : "ja";
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
    *{box-sizing:border-box}
    body{margin:0;background:#f7f7f3;color:#17211b;font-family:"Noto Sans JP",system-ui,sans-serif;line-height:1.6}
    a,a:visited{color:#245c3a}
    main{max-width:720px;margin:0 auto;padding:24px 16px 64px;display:grid;gap:18px}
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
  </style>
</head>
<body>
  <main data-zukan-otayori-page="1">
    <section class="otayori-card">
      <h1>${lang === "en" ? "Feedback" : "改善のご要望"}</h1>
      <p class="otayori-note">${lang === "en" ? "Notifications are sent only when there is a reply." : "確認中・対応中などの途中経過では通知せず、お返事があるときだけ通知します。"}</p>
      ${formHtml}
    </section>
    <section class="otayori-card">
      <h2>${lang === "en" ? "Your feedback" : "これまでの改善のご要望"}</h2>
      ${lettersHtml}
    </section>
  </main>
</body>
</html>`;
}
