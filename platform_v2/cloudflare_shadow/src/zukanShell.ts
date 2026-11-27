import {
  ZUKAN_SHELL_CSS as ZUKAN_CHROME_CSS,
  ZUKAN_SHELL_ICONS,
  renderZukanChrome,
  zukanChromePrefix,
  type ZukanChromeOptions,
  type ZukanShellNavKey,
} from "./zukanShellChrome";

export { ZUKAN_SHELL_ICONS, renderZukanChrome, zukanChromePrefix, type ZukanChromeOptions, type ZukanShellNavKey };

export type ZukanLang = "ja" | "en" | "es" | "pt-br";
export type ZukanStatusTone = "info" | "success" | "warn" | "error";

export const ZUKAN_SHELL_TOKENS = {
  colors: {
    bg: "#ffffff",
    surface: "#f7f7f3",
    surfaceAlt: "#e8efea",
    ink: "#17211b",
    muted: "#55615a",
    green: "#143F2E",
    greenHover: "#0f3023",
    line: "#dde2dc",
    control: "#68746c",
    link: "#0055ad",
    danger: "#b3261e",
    dangerBg: "#fdeceb",
  },
  typography: {
    fontSans: '"Noto Sans JP",system-ui,-apple-system,sans-serif',
    xs: "12px",
    sm: "14px",
    base: "16px",
    lg: "18px",
    xl: "24px",
    xxl: "28px",
  },
  radii: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    pill: "999px",
  },
  motion: {
    fastMs: 120,
    midMs: 240,
    slowMs: 360,
    easing: "cubic-bezier(.2,0,0,1)",
  },
} as const;

const esc = (value: string): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function safeInternalHref(href: string | undefined, fallback: string): string {
  if (!href) return fallback;
  return href.startsWith("/") && !href.startsWith("//") ? href : fallback;
}

export const ZUKAN_SHELL_FOUNDATION_CSS = `
    :root{
      --font-sans:"Noto Sans JP",system-ui,-apple-system,sans-serif;
      --text-xs:12px;--text-sm:14px;--text-base:16px;--text-lg:18px;--text-xl:24px;--text-2xl:28px;
      --radius-sm:8px;--radius-md:12px;--radius-lg:16px;--radius-xl:20px;--radius-pill:999px;
      --motion-fast:120ms;--motion-mid:240ms;--motion-slow:360ms;--motion-ease:cubic-bezier(.2,0,0,1);
      --danger:#b3261e;--danger-bg:#fdeceb
    }
    .zt-btn-capture,.zt-btn-outline,.zt-nav-item,.zt-hub-dest{transition:transform var(--motion-fast) var(--motion-ease),background-color var(--motion-fast) var(--motion-ease)}
    .zt-sheet{border:1px solid var(--line);border-radius:var(--radius-xl);padding:20px;max-width:440px;width:92vw;background:var(--bg);color:var(--ink);box-shadow:0 16px 40px rgba(20,63,46,.16)}
    .zt-sheet::backdrop{background:rgba(23,33,27,.45)}
    .zt-sheet[open]{animation:zt-sheet-in var(--motion-mid) var(--motion-ease)}
    @media(max-width:719px){.zt-sheet{margin:auto 0 0;width:100%;max-width:none;border-radius:var(--radius-xl) var(--radius-xl) 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom))}}
    .zt-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px}
    .zt-sheet-head h2{margin:0;font-size:var(--text-lg);line-height:1.4}
    .zt-sheet-body{display:grid;gap:12px}
    .zt-sheet-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px}
    .zt-status-band{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;border-radius:var(--radius-md);border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:var(--text-sm)}
    .zt-status-band[data-tone="info"]{background:var(--surface-2)}
    .zt-status-band[data-tone="success"]{background:var(--surface-2);border-color:var(--green)}
    .zt-status-band[data-tone="warn"]{background:#fff8e6;border-color:#e0c26b}
    .zt-status-band[data-tone="error"]{background:var(--danger-bg);border-color:#e3b9b5;color:var(--danger)}
    .zt-status-copy{display:grid;gap:2px;min-width:0}
    .zt-status-copy strong{font-size:var(--text-sm);line-height:1.4}
    .zt-status-copy span{font-size:var(--text-xs);color:var(--muted)}
    .zt-status-act,.zt-status-act:visited{min-height:44px;padding:0 14px;border-radius:var(--radius-pill);border:1.5px solid var(--green);background:#fff;color:var(--green);font-weight:700;font-size:var(--text-sm);text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
    .zt-skeleton-list{display:grid;gap:14px}
    .zt-skeleton-card{display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--bg)}
    .zt-skeleton,.zt-skeleton-line,.zt-skeleton-thumb{border-radius:var(--radius-sm);background:linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%);background-size:200% 100%;animation:zt-shimmer var(--motion-slow) linear infinite}
    .zt-skeleton-thumb{aspect-ratio:16/9;border-radius:var(--radius-md)}
    .zt-skeleton-line{height:14px;width:80%}
    .zt-skeleton-line.is-short{width:48%}
    .zt-state-card{display:grid;justify-items:center;gap:12px;text-align:center;padding:28px 20px;border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--surface)}
    .zt-state-ic{width:64px;height:64px;border-radius:var(--radius-pill);background:var(--surface-2);color:var(--green);display:grid;place-items:center}
    .zt-state-ic.is-error{background:var(--danger-bg);color:var(--danger)}
    .zt-state-card h2,.zt-state-card h3{margin:0;font-size:var(--text-lg);line-height:1.4}
    .zt-state-card p{margin:0;color:var(--muted);font-size:var(--text-sm);line-height:1.7;max-width:30em}
    .zt-state-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;width:100%}
    @keyframes zt-sheet-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
    @keyframes zt-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
    @media(prefers-reduced-motion:reduce){
      :root{--motion-fast:0ms;--motion-mid:0ms;--motion-slow:0ms}
      .zt-sheet,.zt-skeleton,.zt-skeleton-line,.zt-skeleton-thumb,.zt-btn-capture,.zt-btn-outline,.zt-nav-item,.zt-hub-dest{animation:none!important;transition:none!important}
    }
`;

export const ZUKAN_SHELL_CSS = `${ZUKAN_CHROME_CSS}${ZUKAN_SHELL_FOUNDATION_CSS}`;

export function renderZukanSheet(options: {
  id: string;
  titleId: string;
  title: string;
  bodyHtml: string;
  actionsHtml?: string;
  formId?: string;
  className?: string;
}): string {
  const cls = options.className ? `zt-sheet ${esc(options.className)}` : "zt-sheet";
  const inner = `<div class="zt-sheet-head"><h2 id="${esc(options.titleId)}">${esc(options.title)}</h2></div>
    <div class="zt-sheet-body">${options.bodyHtml}</div>
    ${options.actionsHtml ? `<div class="zt-sheet-actions">${options.actionsHtml}</div>` : ""}`;
  return `<dialog class="${cls}" id="${esc(options.id)}" aria-labelledby="${esc(options.titleId)}">
    ${options.formId ? `<form method="dialog" id="${esc(options.formId)}">${inner}</form>` : inner}
  </dialog>`;
}

export function renderZukanStatusBand(options: {
  tone?: ZukanStatusTone;
  title: string;
  detail?: string;
  actionHref?: string;
  actionLabel?: string;
}): string {
  const tone = options.tone ?? "info";
  const action =
    options.actionHref && options.actionLabel
      ? `<a class="zt-status-act" href="${esc(safeInternalHref(options.actionHref, "/ja/"))}">${esc(options.actionLabel)}</a>`
      : "";
  return `<div class="zt-status-band" data-tone="${esc(tone)}" role="status">
    <div class="zt-status-copy"><strong>${esc(options.title)}</strong>${options.detail ? `<span>${esc(options.detail)}</span>` : ""}</div>
    ${action}
  </div>`;
}

export function renderZukanSkeleton(options: { count?: number; variant?: "cards" | "rows"; ariaLabel?: string } = {}): string {
  const count = Math.max(1, Math.min(options.count ?? 3, 8));
  const items = Array.from({ length: count }, () =>
    options.variant === "rows"
      ? `<div class="zt-skeleton-card"><div class="zt-skeleton-line"></div><div class="zt-skeleton-line is-short"></div></div>`
      : `<div class="zt-skeleton-card"><div class="zt-skeleton-thumb"></div><div class="zt-skeleton-line"></div><div class="zt-skeleton-line is-short"></div></div>`
  ).join("");
  return `<div class="zt-skeleton-list" aria-busy="true" aria-label="${esc(options.ariaLabel ?? "読み込み中")}">${items}</div>`;
}

export function renderZukanEmptyState(options: {
  iconHtml?: string;
  title: string;
  message?: string;
  actionsHtml?: string;
  dataAttr?: string;
}): string {
  const attr = options.dataAttr ?? 'data-zukan-empty="1"';
  return `<section class="zt-state-card" ${attr}>
    ${options.iconHtml ? `<span class="zt-state-ic" aria-hidden="true">${options.iconHtml}</span>` : ""}
    <h2>${esc(options.title)}</h2>
    ${options.message ? `<p>${esc(options.message)}</p>` : ""}
    ${options.actionsHtml ? `<div class="zt-state-actions">${options.actionsHtml}</div>` : ""}
  </section>`;
}

export function renderZukanErrorState(options: {
  title?: string;
  message?: string;
  retryHref?: string;
  retryLabel?: string;
  secondaryHtml?: string;
}): string {
  const title = options.title ?? "読み込めませんでした";
  const message = options.message ?? "通信に失敗しました。場所を変えて、もう一度お試しください。";
  const retryHref = safeInternalHref(options.retryHref, "/ja/");
  const retryLabel = options.retryLabel ?? "もう一度";
  const warnIcon = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>`;
  return `<section class="zt-state-card" data-zukan-fetch-error="1" role="status" aria-live="polite">
    <span class="zt-state-ic is-error" aria-hidden="true">${warnIcon}</span>
    <h2>${esc(title)}</h2>
    <p>${esc(message)}</p>
    <div class="zt-state-actions">
      <a class="zt-btn-outline" data-zukan-retry="1" href="${esc(retryHref)}">${esc(retryLabel)}</a>
      ${options.secondaryHtml ?? ""}
    </div>
  </section>`;
}

export function renderZukanShellDocument(options: {
  lang: ZukanLang;
  activeNav: ZukanShellNavKey;
  authenticated: boolean;
  displayName?: string | null;
  searchAction?: string;
  searchQuery?: string;
  pathname?: string;
  homeHref?: string;
  title?: string;
  cspNonce?: string;
  extraCss?: string;
  bodyHtml: string;
  afterShellHtml?: string;
  landing?: boolean;
  showSearch?: boolean;
  showFeedbackFoot?: boolean;
}): string {
  const prefix = zukanChromePrefix(options.lang);
  const nonceAttr = options.cspNonce ? ` nonce="${esc(options.cspNonce)}"` : "";
  const chrome = renderZukanChrome({
    lang: options.lang,
    activeNav: options.activeNav,
    authenticated: options.authenticated,
    displayName: options.displayName,
    searchAction: options.showSearch ? (options.searchAction ?? `${prefix}/`) : undefined,
    searchQuery: options.searchQuery,
    pathname: options.pathname ?? `${prefix}/`,
    homeHref: options.homeHref ?? `${prefix}/library`,
  });
  const htmlLang = options.lang === "pt-br" ? "pt-BR" : options.lang;
  return `<!doctype html>
<html lang="${esc(htmlLang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(options.title ?? "ZUKAN")}</title>
  <style${nonceAttr}>${ZUKAN_SHELL_CSS}${options.extraCss ?? ""}</style>
</head>
<body>
  <div class="zt-shell${options.landing ? " zt-landing" : ""}">
    ${options.authenticated ? chrome.sidebarHtml : ""}
    <div>
      ${chrome.topbarHtml}
      <main class="zt-main">
        ${options.showSearch ? chrome.searchHtml : ""}
        ${options.bodyHtml}
        ${options.showFeedbackFoot ? chrome.feedbackFootHtml : ""}
      </main>
    </div>
  </div>
  ${options.authenticated ? chrome.bottomNavHtml : ""}
  ${options.afterShellHtml ?? ""}
</body>
</html>`;
}
