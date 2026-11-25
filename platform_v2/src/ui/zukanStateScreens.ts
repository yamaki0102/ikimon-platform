import { BRAND_ASSETS } from "../brandAssets.js";

export type ZukanStateKind = "loading" | "error" | "offline" | "no-access";

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export const ZUKAN_STATE_STYLES = `
html body[data-zukan-design]{display:block;min-height:0;padding:0;background:#fff}
.st-wrap{width:min(520px,100%);margin:0 auto;padding:56px 20px 40px;text-align:center;display:grid;gap:14px}
.st-circle{width:76px;height:76px;margin:0 auto 6px;border-radius:50%;background:#edf2ee;color:#143f2e;display:grid;place-items:center}
.st-circle.warn{background:#fdeceb;color:#b3261e}
.st-wrap h1{margin:6px 0 0;font-size:22px;line-height:1.35}
.st-wrap p{margin:0;color:#5a6a60;line-height:1.8}
.st-btn,.st-btn:visited{display:flex;align-items:center;justify-content:center;gap:10px;min-height:52px;margin-top:10px;padding:0 18px;border:0;border-radius:16px;background:#143f2e;color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer;transition:transform 120ms cubic-bezier(.2,0,0,1)}
.st-btn:active{transform:scale(.98)}
.st-btn.sub,.st-btn.sub:visited{background:#fff;color:#143f2e;border:1px solid #143f2e;margin-top:2px}
.st-link,.st-link:visited{display:block;width:100%;min-height:44px;padding-top:10px;border:0;background:none;font:inherit;color:#143f2e;font-weight:800;text-decoration:none;cursor:pointer}
.st-sec{margin:22px 0 0;text-align:left;font-size:17px;font-weight:800}
.st-row,.st-row:visited{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #e4e8e2;text-align:left;color:inherit;text-decoration:none}
.st-row .st-ic{flex:none;width:46px;height:46px;border-radius:14px;background:#edf2ee;color:#143f2e;display:grid;place-items:center}
.st-row strong{display:block;font-size:17px;color:#17251b}
.st-row small{display:block;color:#5a6a60;font-size:14px;line-height:1.6}
.st-row .st-chev{margin-left:auto;color:#9aa5a0}
.st-logo{display:block;width:150px;height:auto;margin:0 auto 24px}
.st-spin{width:38px;height:38px;margin:0 auto 6px;border:4px solid #dfe5e0;border-top-color:#143f2e;border-radius:50%;animation:st-rot 900ms linear infinite}
@keyframes st-rot{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.st-spin{animation-duration:3s}.st-btn{transition:none}}
`;

const ICON = {
  warn: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>`,
  wifiOff: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M8.5 16.2a5 5 0 017 0"/><path d="M5 12.6a10 10 0 015-2.6M19 12.6a10 10 0 00-3.3-2.2"/><path d="M12 20h.01"/></svg>`,
  lock: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>`,
  camera: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/></svg>`,
  photo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/></svg>`,
  search: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/></svg>`,
  chev: `<svg class="st-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`,
};

function savedRecordsRow(prefix: string): string {
  return `<h2 class="st-sec">いま見られるもの</h2>
<a class="st-row" href="${esc(prefix)}/records?view=mine"><span class="st-ic">${ICON.photo}</span><span><strong>保存済みの記録</strong><small>通信なしでも、この端末にある記録は見られます</small></span>${ICON.chev}</a>`;
}

export function renderZukanStateBody(
  kind: ZukanStateKind,
  options: { prefix: string; retryHref?: string }
): string {
  const prefix = options.prefix;
  const retry = esc(options.retryHref && options.retryHref.startsWith("/") && !options.retryHref.startsWith("//") ? options.retryHref : `${prefix}/library`);
  switch (kind) {
    case "loading":
      return `<main class="st-wrap" data-zukan-state="k1" aria-busy="true">
<img class="st-logo" src="${BRAND_ASSETS.lockupBlack}" alt="ZUKAN" width="150" height="40">
<div class="st-spin" aria-hidden="true"></div>
<h1>読み込んでいます</h1>
<p>通信状態によっては、少し時間がかかります。</p>
</main>`;
    case "error":
      return `<main class="st-wrap" data-zukan-state="k2">
<div class="st-circle warn">${ICON.warn}</div>
<h1>読み込めませんでした</h1>
<p>通信に失敗しました。<br>場所を変えて、もう一度お試しください。</p>
<a class="st-btn" href="${retry}">もう一度</a>
${savedRecordsRow(prefix)}
<a class="st-link" href="${esc(prefix)}/library">ライブラリへ戻る</a>
</main>`;
    case "offline":
      return offlineStateMain(prefix);
    case "no-access":
      return `<main class="st-wrap" data-zukan-state="k4">
<div class="st-circle">${ICON.lock}</div>
<h1>このページは見られません</h1>
<p>公開が取り消されたか、リンクの期限が切れている可能性があります。<br>心当たりがあれば、送ってくれた人に新しいリンクを聞いてみてください。</p>
<a class="st-btn" href="${esc(prefix)}/">トップへ戻る</a>
<a class="st-btn sub" href="${esc(prefix)}/map">${ICON.search}探す</a>
</main>`;
  }
}

export function offlineStateMain(prefix: string): string {
  return `<main class="offline st-wrap" data-zukan-state="k3">
<div class="st-circle">${ICON.wifiOff}</div>
<h1>オフラインです</h1>
<p>いまは通信できません。<br>撮った写真は端末に保存され、通信が戻ると自動で送られます。</p>
<a class="st-btn" href="${esc(prefix)}/record">${ICON.camera}撮る（オフラインでも撮れます）</a>
${savedRecordsRow(prefix)}
<button class="st-link" type="button" data-offline-retry>再接続を試す</button>
</main>`;
}

const STATE_TITLES: Record<ZukanStateKind, string> = {
  loading: "読み込んでいます",
  error: "読み込めませんでした",
  offline: "オフラインです",
  "no-access": "このページは見られません",
};

export function renderZukanStateDocument(
  kind: ZukanStateKind,
  options: { prefix: string; retryHref?: string }
): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#245c3a">
<title>${STATE_TITLES[kind]} — ZUKAN</title>
<style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#17251b;font-family:"Noto Sans JP",system-ui,-apple-system,sans-serif;font-size:16px}${ZUKAN_STATE_STYLES}</style>
</head>
<body>${renderZukanStateBody(kind, options)}</body>
</html>`;
}
