import type { Env } from "./core/env";
import { assertSameOriginRequest, escapeHtml, html } from "./core/http";
import { publicLangFromPath, readCompatibleSession } from "./core/shared";

export type ZukanMaintenance = { startsAt: string; endsAt: string; message?: string };
export type ZukanNoticeItem = { id: string; title: string; summary: string; href?: string };
export type ZukanNotices = { maintenance: ZukanMaintenance | null; items: ZukanNoticeItem[] };

export const NOTICES_KEY = "zukan-notices/current.json";
export const CONSENT_VERSION = "2026-11-25";
export const CONSENT_LATER_COOKIE = "zukan_consent_later";

const MAINTENANCE_ANNOUNCE_DAYS = 7;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export const ZUKAN_NOTICE_STYLES = `
:root{--zk-g:#143f2e;--zk-ink:#17251b;--zk-muted:#5a6a60;--zk-line:#e4e8e2;--zk-fast:120ms;--zk-std:240ms;--zk-out:cubic-bezier(.2,0,0,1);--zk-sheet:cubic-bezier(.32,.72,0,1)}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--zk-ink);font-family:"Noto Sans JP",system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6}
.nc-top{padding:14px 20px}
.nc-logo,.nc-logo:visited{color:var(--zk-g);font-weight:800;font-size:22px;letter-spacing:.04em;text-decoration:none}
.nc-page{max-width:520px;margin:0 auto;padding:0 16px 48px}
.nc-warn{display:flex;gap:14px;margin:8px 0 24px;padding:18px 18px;border-radius:20px;background:#fdf1e2;color:#8a4b0a}
.nc-warn svg{flex:none;margin-top:3px}
.nc-warn strong{display:block;margin-bottom:2px}
.nc-warn p{margin:0}
.nc-warn a,.nc-warn a:visited{color:#8a4b0a;font-weight:800}
.nc-page h2{margin:0 0 6px;font-size:19px}
.nc-list{margin:0 0 24px;padding:0;list-style:none}
.nc-item,.nc-item:visited{display:flex;align-items:center;gap:12px;padding:16px 0;border-bottom:1px solid var(--zk-line);color:inherit;text-decoration:none}
.nc-item strong{display:block;font-size:18px}
.nc-item small{display:block;color:var(--zk-muted);font-size:15px}
.nc-item svg{margin-left:auto;flex:none;color:#9aa5a0}
.nc-empty{margin:0 0 24px;color:var(--zk-muted)}
.nc-btn,.nc-btn:visited{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border:0;border-radius:16px;background:var(--zk-g);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer;transition:transform var(--zk-fast) var(--zk-out)}
.nc-btn:active{transform:scale(.98)}
.nc-later,.nc-later:visited{display:block;width:100%;min-height:44px;padding-top:10px;text-align:center;color:var(--zk-g);font-weight:800;text-decoration:none}
.nc-hero{height:min(58vh,560px);background:#1c2a20;position:relative;overflow:hidden}
.nc-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.nc-hero-copy{padding:22px 20px 0;max-width:560px;margin:0 auto}
.nc-hero-copy h1{margin:0 0 8px;font-size:26px;line-height:1.4}
.nc-hero-copy p{margin:0;color:var(--zk-muted)}
.nc-shade{position:fixed;inset:0;background:rgba(20,30,25,.45);pointer-events:none}
.nc-sheet{position:fixed;left:0;right:0;bottom:0;max-width:560px;margin:0 auto;padding:12px 20px 24px;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,.18);animation:nc-up var(--zk-std) var(--zk-sheet) both}
.nc-grab{width:40px;height:4px;border-radius:2px;background:#d4dad6;margin:0 auto 12px}
.nc-sheet h2{margin:6px 0 4px;font-size:20px}
.nc-sheet p{margin:0 0 6px;color:var(--zk-muted);font-size:15px}
.nc-check{display:flex;align-items:center;gap:14px;min-height:56px;border-bottom:1px solid var(--zk-line);font-weight:800;cursor:pointer}
.nc-check input{position:absolute;opacity:0;pointer-events:none}
.nc-box{flex:none;width:26px;height:26px;border-radius:7px;border:2px solid #aab3ad;background:#fff;display:grid;place-items:center;color:#fff}
.nc-check input:checked+.nc-box{background:var(--zk-g);border-color:var(--zk-g)}
.nc-check input:focus-visible+.nc-box{outline:3px solid #8fb9a0;outline-offset:2px}
.nc-check a,.nc-check a:visited{color:inherit}
.nc-err{margin:10px 0 0;color:#b3261e;font-weight:800;font-size:14px}
.nc-sheet .nc-btn{margin-top:14px}
.nc-card{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 4px;padding:14px 16px;border-radius:16px;background:#f3f6f3;color:var(--zk-ink)}
.nc-card.warn{background:#fdf1e2;color:#8a4b0a}
.nc-card a,.nc-card a:visited{min-height:44px;display:inline-flex;align-items:center;font-weight:800;color:var(--zk-g)}
.nc-card.warn a,.nc-card.warn a:visited{color:#8a4b0a}
@keyframes nc-up{from{transform:translateY(100%)}to{transform:none}}
@media(min-width:900px){.nc-hero{height:420px}.nc-sheet{bottom:auto;top:50%;transform:translateY(-50%);border-radius:24px;animation:none}}
@media(prefers-reduced-motion:reduce){*{transition-duration:.01ms!important;animation-duration:.01ms!important}}
`;

const ICON_WARN = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>`;
const ICON_CHEV = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`;
const ICON_TICK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

function pageDoc(title: string, lang: string, body: string): string {
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} — ZUKAN</title>
<style>${ZUKAN_NOTICE_STYLES}</style>
</head>
<body>${body}</body>
</html>`;
}

const jstParts = (iso: string) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + 9 * 3600000);
  return {
    day: `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`,
    date: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WEEKDAYS[d.getUTCDay()]}）`,
    time: `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
  };
};

export function formatMaintenanceRange(startsAt: string, endsAt: string): string {
  const s = jstParts(startsAt);
  const e = jstParts(endsAt);
  if (!s || !e) return "";
  return s.day === e.day ? `${s.date}${s.time}〜${e.time}` : `${s.date}${s.time}〜${e.date}${e.time}`;
}

export function maintenanceMessage(m: ZukanMaintenance): string {
  if (m.message) return m.message;
  return `${formatMaintenanceRange(m.startsAt, m.endsAt)} のあいだ、一部の機能が使えません。撮った写真は端末に保存され、終わると自動で送られます。`;
}

const isSafeHref = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");

export function parseNotices(raw: unknown, nowMs: number): ZukanNotices {
  const empty: ZukanNotices = { maintenance: null, items: [] };
  if (!raw || typeof raw !== "object") return empty;
  const source = raw as { maintenance?: unknown; items?: unknown };
  let maintenance: ZukanMaintenance | null = null;
  const m = source.maintenance as Partial<ZukanMaintenance> | null | undefined;
  if (m && typeof m.startsAt === "string" && typeof m.endsAt === "string") {
    const start = Date.parse(m.startsAt);
    const end = Date.parse(m.endsAt);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && nowMs < end && nowMs >= start - MAINTENANCE_ANNOUNCE_DAYS * 86400000) {
      maintenance = {
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        ...(typeof m.message === "string" && m.message.trim() ? { message: m.message.trim().slice(0, 200) } : {}),
      };
    }
  }
  const items: ZukanNoticeItem[] = [];
  if (Array.isArray(source.items)) {
    for (const entry of source.items.slice(0, 10)) {
      const it = entry as Partial<ZukanNoticeItem> | null;
      if (!it || typeof it.title !== "string" || !it.title.trim()) continue;
      items.push({
        id: typeof it.id === "string" ? it.id.slice(0, 64) : String(items.length),
        title: it.title.trim().slice(0, 60),
        summary: typeof it.summary === "string" ? it.summary.trim().slice(0, 100) : "",
        ...(isSafeHref(it.href) ? { href: it.href } : {}),
      });
    }
  }
  return { maintenance, items };
}

export async function loadZukanNotices(env: Env, nowMs = Date.now()): Promise<ZukanNotices> {
  try {
    const obj = await env.ASSET_BUCKET.get(NOTICES_KEY);
    if (!obj) return { maintenance: null, items: [] };
    return parseNotices(await new Response(obj.body).json().catch(() => null), nowMs);
  } catch {
    return { maintenance: null, items: [] };
  }
}

export function renderNoticesPage(options: { lang: string; notices: ZukanNotices; backHref: string }): string {
  const prefix = `/${options.lang}`;
  const { notices } = options;
  const banner = notices.maintenance
    ? `<div class="nc-warn" data-zukan-maintenance="k5">${ICON_WARN}<div><strong>メンテナンスのお知らせ</strong><p>${escapeHtml(maintenanceMessage(notices.maintenance))}</p></div></div>`
    : "";
  const list = notices.items.length > 0
    ? `<ul class="nc-list">${notices.items
        .map((item) => {
          const inner = `<span><strong>${escapeHtml(item.title)}</strong>${item.summary ? `<small>${escapeHtml(item.summary)}</small>` : ""}</span>${item.href ? ICON_CHEV : ""}`;
          return item.href
            ? `<li><a class="nc-item" href="${escapeHtml(item.href)}">${inner}</a></li>`
            : `<li><div class="nc-item">${inner}</div></li>`;
        })
        .join("")}</ul>`
    : `<p class="nc-empty">${notices.maintenance ? "ほかのお知らせは、いまはありません。" : "いまのところ、お知らせはありません。"}</p>`;
  return pageDoc(
    "お知らせ",
    options.lang,
    `<div class="nc-top"><a class="nc-logo" href="${prefix}/">ZUKAN</a></div>
<main class="nc-page" data-zukan-notices="k5">
${banner}
<h2>${notices.maintenance ? "そのほかのお知らせ" : "お知らせ"}</h2>
${list}
<a class="nc-btn" href="${escapeHtml(options.backHref)}">分かりました</a>
</main>`
  );
}

export function renderConsentPage(options: { lang: string; next: string; error: boolean }): string {
  const prefix = `/${options.lang}`;
  const check = (name: string, label: string) =>
    `<label class="nc-check"><input type="checkbox" name="${name}" value="1"><span class="nc-box">${ICON_TICK}</span><span>${label}</span></label>`;
  return pageDoc(
    "はじめる前に",
    options.lang,
    `<div class="nc-hero"><img src="/assets/event-discovery/ryuyo-photo-path-0177adc2de81.webp" alt=""></div>
<div class="nc-hero-copy"><h1>撮った写真は、<br>場所と日付でたまります</h1><p>カメラで撮るだけ。あとから見返したり、その場所の図鑑に載せたりできます。</p></div>
<div class="nc-shade"></div>
<form class="nc-sheet" method="post" action="${prefix}/welcome/consent" data-zukan-consent="k6" role="dialog" aria-labelledby="nc-t">
<div class="nc-grab"></div>
<h2 id="nc-t">はじめる前に</h2>
<p>写真の場所の情報は、その場所の記録のために使います。公開する範囲は、毎回あなたが選べます。</p>
${check("terms", `<a href="${prefix}/terms">利用規約</a>に同意します`)}
${check("privacy", `<a href="${prefix}/privacy">プライバシーポリシー</a>に同意します`)}
${options.error ? `<p class="nc-err" role="alert">2つとも確認して、チェックを入れてください。</p>` : ""}
<input type="hidden" name="next" value="${escapeHtml(options.next)}">
<button class="nc-btn" type="submit">同意してはじめる</button>
<a class="nc-later" href="${prefix}/welcome/consent/later?next=${encodeURIComponent(options.next)}">あとで</a>
</form>`
  );
}

export function renderMaintenanceBanner(prefix: string, maintenance: ZukanMaintenance): string {
  return `<div class="nc-card warn" data-library-maintenance="1"><span><strong>メンテナンスのお知らせ</strong><br>${escapeHtml(formatMaintenanceRange(maintenance.startsAt, maintenance.endsAt))}</span><a href="${prefix}/notices">くわしく</a></div>`;
}

export function renderConsentPrompt(prefix: string): string {
  return `<div class="nc-card" data-library-consent-prompt="1"><span><strong>はじめる前に</strong><br>利用規約とプライバシーポリシーの確認をお願いします。</span><a href="${prefix}/welcome/consent">確認する</a></div>`;
}

const consentKey = (userId: string): string => `zukan-consent/${encodeURIComponent(userId)}.json`;

function readCookie(request: Request, name: string): string {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return "";
}

export async function hasAcceptedConsent(env: Env, userId: string): Promise<boolean> {
  try {
    const obj = await env.ASSET_BUCKET.get(consentKey(userId));
    if (!obj) return false;
    const record = (await new Response(obj.body).json().catch(() => null)) as { version?: string; termsAt?: string; privacyAt?: string } | null;
    return Boolean(record?.version && record.termsAt && record.privacyAt);
  } catch {
    return false;
  }
}

export async function loadLibraryNoticeHtml(
  request: Request,
  env: Env,
  session: { userId: string; banned?: boolean } | null,
  prefix: string
): Promise<string> {
  const parts: string[] = [];
  const notices = await loadZukanNotices(env);
  if (notices.maintenance) parts.push(renderMaintenanceBanner(prefix, notices.maintenance));
  if (session && !session.banned && readCookie(request, CONSENT_LATER_COOKIE) !== "1" && !(await hasAcceptedConsent(env, session.userId))) {
    parts.push(renderConsentPrompt(prefix));
  }
  return parts.join("");
}

const safeNext = (value: string, fallback: string): string =>
  value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value.slice(0, 200) : fallback;

export async function handleZukanNoticesAndConsentRoute(
  request: Request,
  env: Env,
  url: URL,
  nativePathname: string
): Promise<Response | null> {
  if (nativePathname !== "/notices" && nativePathname !== "/welcome/consent" && nativePathname !== "/welcome/consent/later") return null;
  const lang = publicLangFromPath(url.pathname) ?? "ja";
  const prefix = `/${lang}`;
  const headers = { "cache-control": "private, no-store" };
  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (nativePathname === "/notices") {
    if (request.method === "POST") return new Response("Method Not Allowed", { status: 405 });
    const session = await readCompatibleSession(request, env).catch(() => null);
    const notices = await loadZukanNotices(env);
    const backHref = session && !session.banned ? `${prefix}/library` : `${prefix}/`;
    return html(renderNoticesPage({ lang, notices, backHref }), 200, headers);
  }

  const session = await readCompatibleSession(request, env).catch(() => null);
  const fallback = `${prefix}/record`;
  if (!session || session.banned) {
    return new Response(null, {
      status: 302,
      headers: { location: `${prefix}/login?next=${encodeURIComponent(url.pathname + url.search)}`, "cache-control": "no-store" },
    });
  }

  if (nativePathname === "/welcome/consent/later" && request.method !== "POST") {
    const next = safeNext(url.searchParams.get("next") ?? "", `${prefix}/library`);
    return new Response(null, {
      status: 302,
      headers: {
        location: next,
        "cache-control": "no-store",
        "set-cookie": `${CONSENT_LATER_COOKIE}=1; Path=/; Max-Age=${3 * 86400}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (nativePathname === "/welcome/consent" && request.method !== "POST") {
    const next = safeNext(url.searchParams.get("next") ?? "", fallback);
    return html(renderConsentPage({ lang, next, error: false }), 200, headers);
  }

  if (nativePathname === "/welcome/consent" && request.method === "POST") {
    const blocked = assertSameOriginRequest(request);
    if (blocked) return blocked;
    const form = await request.formData().catch(() => null);
    const next = safeNext(typeof form?.get("next") === "string" ? (form!.get("next") as string) : "", fallback);
    if (!form || form.get("terms") !== "1" || form.get("privacy") !== "1") {
      return html(renderConsentPage({ lang, next, error: true }), 400, headers);
    }
    const now = new Date().toISOString();
    await env.ASSET_BUCKET.put(
      consentKey(session.userId),
      JSON.stringify({ version: CONSENT_VERSION, termsAt: now, privacyAt: now }),
      { httpMetadata: { contentType: "application/json; charset=utf-8" } }
    );
    return new Response(null, {
      status: 303,
      headers: {
        location: next,
        "cache-control": "no-store",
        "set-cookie": `${CONSENT_LATER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  return null;
}
