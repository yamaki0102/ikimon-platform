import runtime from "./runtime.js";

const upstream = runtime as Record<string, unknown> & {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizedPath(pathname: string): string {
  return pathname.replace(/^\/(?:ja|en)(?=\/)/, "") || "/";
}

function htmlHeaders(source: Response): Headers {
  const headers = new Headers(source.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  return headers;
}

function nonceFromHtml(html: string): string {
  return html.match(/<script\b[^>]*\bnonce=["']([^"']+)["']/i)?.[1] ?? "";
}

function scriptNonceAttr(html: string): string {
  const nonce = nonceFromHtml(html);
  return nonce ? ` nonce="${escapeHtml(nonce)}"` : "";
}

function replaceMain(html: string, main: string): string {
  if (/<main\b[^>]*>[\s\S]*?<\/main>/i.test(html)) {
    return html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, main);
  }
  return html.replace(/<\/body>/i, `${main}</body>`);
}

function injectBeforeBody(html: string, fragment: string): string {
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${fragment}</body>`) : `${html}${fragment}`;
}

function qaFixtureText(value: string): boolean {
  return /\bpr\s*\d+[\s_-]*(?:(?:prod|production|staging)[\s_-]*)?(?:rally|smoke|test)\b/i.test(value);
}

export function filterLegacyQaEventCards(html: string): string {
  const filter = (block: string): string => qaFixtureText(stripTags(block)) ? "" : block;
  let result = html.replace(/<article\b[^>]*>[\s\S]*?<\/article>/gi, filter);
  result = result.replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, filter);
  result = result.replace(/<div\b[^>]*class=["'][^"']*(?:event-card|evt-card)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, filter);
  return result;
}

async function runtimeFetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
  return await upstream.fetch(request, env, ctx);
}

async function authenticatedSession(request: Request, env: unknown, ctx: unknown): Promise<boolean> {
  const url = new URL(request.url);
  url.pathname = "/api/v1/auth/session";
  url.search = "?optional=1";
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  headers.set("accept", "application/json");
  try {
    const response = await runtimeFetch(new Request(url.toString(), { headers }), env, ctx);
    if (!response.ok) return false;
    const payload = await response.json() as { ok?: boolean; session?: { userId?: string } | null };
    return Boolean(payload.ok && payload.session?.userId);
  } catch {
    return false;
  }
}

function sessionIdFromJoinHtml(html: string): string {
  const match = html.match(/\/events\/([^/"'?#]+)\/(?:live|rally|recap|console|checkin)/i)
    ?? html.match(/data-session-id=["']([^"']+)["']/i);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function titleFromJoinHtml(html: string): string {
  const raw = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "観察会に参加";
  return decodeHtml(stripTags(raw)) || "観察会に参加";
}

function joinEnhancementScript(sessionId: string, eventCode: string, authenticated: boolean): string {
  return String.raw`
(() => {
  const root = document.querySelector("[data-renri-checkin-root]");
  if (!root) return;
  const sessionId = ${JSON.stringify(sessionId)};
  const eventCode = ${JSON.stringify(eventCode)};
  const authenticated = ${authenticated ? "true" : "false"};
  const form = root.querySelector("[data-evt-checkin-form]");
  const status = root.querySelector("[data-evt-checkin-status]");
  const submit = root.querySelector("[data-evt-checkin-submit]");
  const displayName = form?.querySelector('input[name="display_name"]');
  const shareLocation = form?.querySelector('input[name="share_location"]');
  const isMinor = form?.querySelector('input[name="is_minor"]');
  const guardianConsent = form?.querySelector('input[name="guardian_location_consent"]');
  const guardianRow = root.querySelector("[data-guardian-consent-row]");
  const guestKey = "evt-guest-token:" + sessionId;
  const draftKey = "evt-checkin-draft:" + sessionId;
  const eventCodeKey = "evt-event-code:" + sessionId;

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message || "";
    status.style.color = kind === "error" ? "#b91c1c" : kind === "success" ? "#047857" : "";
  }
  function syncGuardian() {
    const required = Boolean(isMinor?.checked && shareLocation?.checked);
    if (guardianRow) {
      guardianRow.hidden = !required;
      guardianRow.style.display = required ? "flex" : "none";
    }
    if (!required && guardianConsent) guardianConsent.checked = false;
  }
  function draft() {
    return {
      displayName: String(displayName?.value || "").trim(),
      shareLocation: Boolean(shareLocation?.checked),
      isMinor: Boolean(isMinor?.checked),
      guardianConsent: Boolean(guardianConsent?.checked),
    };
  }
  function saveDraft() {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft()));
      sessionStorage.setItem(eventCodeKey, eventCode);
      localStorage.setItem(eventCodeKey, eventCode);
    } catch {}
  }
  function restoreDraft() {
    try {
      const value = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (!value || typeof value !== "object") return;
      if (displayName && typeof value.displayName === "string") displayName.value = value.displayName;
      if (shareLocation) shareLocation.checked = value.shareLocation === true;
      if (isMinor) isMinor.checked = value.isMinor === true;
      if (guardianConsent) guardianConsent.checked = value.guardianConsent === true;
    } catch {}
  }
  function guestToken() {
    if (authenticated) return null;
    let token = "";
    try { token = localStorage.getItem(guestKey) || ""; } catch {}
    if (!token) {
      token = "g_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
      try { localStorage.setItem(guestKey, token); } catch {}
    }
    return token;
  }

  isMinor?.addEventListener("change", syncGuardian);
  shareLocation?.addEventListener("change", syncGuardian);
  restoreDraft();
  syncGuardian();
  try {
    sessionStorage.setItem(eventCodeKey, eventCode);
    localStorage.setItem(eventCodeKey, eventCode);
  } catch {}
  root.querySelectorAll("[data-evt-register-link], [data-evt-login-link]").forEach(link => link.addEventListener("click", saveDraft));

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit?.disabled) return;
    const name = String(displayName?.value || "").trim();
    if (!name) {
      setStatus("参加名を入力してください。", "error");
      displayName?.focus();
      return;
    }
    if (isMinor?.checked && shareLocation?.checked && !guardianConsent?.checked) {
      setStatus("位置情報を共有する場合は、保護者または引率者の同意を確認してください。共有しない設定でも参加できます。", "error");
      guardianConsent?.focus();
      return;
    }
    const token = guestToken();
    const payload = {
      display_name: name,
      team_id: null,
      share_location: Boolean(shareLocation?.checked),
      is_minor: Boolean(isMinor?.checked),
      guardian_location_consent: Boolean(guardianConsent?.checked),
      location_share_consent_type: isMinor?.checked ? (guardianConsent?.checked ? "guardian" : null) : (shareLocation?.checked ? "self" : null),
      guest_token: token,
    };
    if (submit) submit.disabled = true;
    setStatus("参加情報を確認しています…", "info");
    try {
      const response = await fetch("/api/v1/observation-events/" + encodeURIComponent(sessionId) + "/checkin", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setStatus("チェックインできませんでした。通信状況を確認して、もう一度お試しください。入力内容は残っています。", "error");
        return;
      }
      try { sessionStorage.removeItem(draftKey); } catch {}
      setStatus("参加できました。観察画面を開きます。", "success");
      window.setTimeout(() => {
        window.location.href = "/events/" + encodeURIComponent(sessionId) + "/rally" + (token ? "?token=" + encodeURIComponent(token) : "");
      }, 250);
    } catch {
      setStatus("通信が途切れました。電波が戻ったら、同じボタンでもう一度お試しください。", "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  });
})();`;
}

async function renderEnhancedJoin(request: Request, env: unknown, ctx: unknown, eventCode: string): Promise<Response> {
  const source = await runtimeFetch(request, env, ctx);
  if (!source.ok || !source.headers.get("content-type")?.includes("text/html")) return source;
  let html = await source.text();
  const sessionId = sessionIdFromJoinHtml(html);
  if (!sessionId) return new Response(html, { status: source.status, headers: htmlHeaders(source) });
  const title = titleFromJoinHtml(html);
  const isAuthenticated = await authenticatedSession(request, env, ctx);
  const returnPath = `/community/events/${encodeURIComponent(eventCode)}/join`;
  const registerHref = `/register?redirect=${encodeURIComponent(returnPath)}`;
  const loginHref = `/login?redirect=${encodeURIComponent(returnPath)}`;
  const accountCopy = isAuthenticated
    ? `<p class="evt-lead">ログイン済みアカウントで参加します。このイベント用のゲストIDは作りません。</p>`
    : `<div class="evt-card" style="display:grid;gap:8px;padding:12px"><p class="evt-lead" style="margin:0">すぐ始める場合は、登録なしのゲスト参加です。この端末にイベント専用IDを保存し、ふり返りへ戻れるようにします。</p><p class="evt-lead" style="margin:0">観察を自分の記録として残す方は、<a data-evt-register-link href="${escapeHtml(registerHref)}">無料アカウントを作って参加</a>。登録済みの方は<a data-evt-login-link href="${escapeHtml(loginHref)}">ログイン</a>すると、この観察会へ戻ります。入力した参加情報も同じ端末に復元します。</p></div>`;
  const main = `<main><section class="evt-checkin-shell" data-renri-checkin-root data-session-id="${escapeHtml(sessionId)}" data-event-code="${escapeHtml(eventCode)}" data-authenticated="${isAuthenticated ? "true" : "false"}" style="max-width:720px;margin:0 auto;padding:24px 16px 120px;display:grid;gap:16px"><header><span class="evt-eyebrow">観察会チェックイン</span><h1 class="evt-heading">${escapeHtml(title)}</h1><p class="evt-lead">家族・グループは、スマホ1台で参加できます。代表者のニックネームや「○○家」で進めてください。</p></header><aside class="evt-card" style="display:grid;gap:6px;padding:14px"><strong>名前が分からなくても、写真だけで大丈夫です</strong><span class="evt-lead">位置情報を共有しなくても観察・投稿できます。終了後のふり返りURLも同じ端末に残ります。</span></aside><form class="evt-checkin-form" data-evt-checkin-form novalidate style="display:grid;gap:14px"><label>参加名（家族・グループ名でもOK）<input type="text" name="display_name" required maxlength="32" autocomplete="nickname" placeholder="例: やまき家 / たかし" style="display:block;width:100%;min-height:48px;margin-top:6px"></label><label style="display:flex;gap:8px;align-items:flex-start;min-height:44px"><input type="checkbox" name="share_location" checked style="margin-top:4px"><span>開催中だけ、主催者におおよその現在地を共有<small style="display:block;color:#64748b">終了時刻を過ぎると自動で停止します。共有しなくても参加・投稿できます。</small></span></label><label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" name="is_minor"><span>参加者に未成年が含まれます</span></label><label data-guardian-consent-row hidden style="display:none;gap:8px;align-items:flex-start;min-height:44px;padding:12px;border:1px solid rgba(15,23,42,.12);border-radius:12px;background:#f8fafc"><input type="checkbox" name="guardian_location_consent" style="margin-top:4px"><span>未成年の位置共有について、保護者または引率者が同意しています</span></label>${accountCopy}<p class="evt-lead" data-evt-checkin-status role="status" aria-live="polite" style="min-height:22px;margin:0"></p><button type="submit" class="evt-btn evt-btn-primary" data-evt-checkin-submit style="min-height:56px">✨ 観察を始める</button></form></section></main>`;
  html = replaceMain(html, main);
  html = injectBeforeBody(html, `<script${scriptNonceAttr(html)}>${joinEnhancementScript(sessionId, eventCode, isAuthenticated)}</script>`);
  return new Response(html, { status: source.status, headers: htmlHeaders(source) });
}

function rallyEnhancementScript(sessionId: string): string {
  return String.raw`
(() => {
  const sessionId = ${JSON.stringify(sessionId)};
  const eventCodeKey = "evt-event-code:" + sessionId;
  const guestKey = "evt-guest-token:" + sessionId;
  const urlToken = new URL(location.href).searchParams.get("token") || "";
  if (urlToken) {
    try {
      localStorage.setItem(guestKey, urlToken);
      localStorage.removeItem("evt-guest-token");
    } catch {}
  }
  async function authenticated() {
    try {
      const response = await fetch("/api/v1/auth/session?optional=1", { credentials: "include", headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => null);
      return Boolean(response.ok && payload?.ok && payload?.session?.userId);
    } catch { return false; }
  }
  function eventCode() {
    try { return sessionStorage.getItem(eventCodeKey) || localStorage.getItem(eventCodeKey) || ""; } catch { return ""; }
  }
  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-rally-action="record"], [data-rally-action="scan"]') : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const params = new URLSearchParams();
    const code = eventCode();
    if (code) params.set("event", code);
    params.set("eventSessionId", sessionId);
    params.set("rally", "1");
    params.set("activityIntent", "share");
    params.set("start", "photo");
    if (target.getAttribute("data-rally-action") === "scan") params.set("fieldScanMode", "site_snapshot");
    const recordPath = "/record?" + params.toString();
    if (await authenticated()) {
      location.href = recordPath;
    } else {
      location.href = "/register?redirect=" + encodeURIComponent(recordPath);
    }
  }, true);
})();`;
}

async function renderEnhancedRally(request: Request, env: unknown, ctx: unknown, sessionId: string): Promise<Response> {
  const source = await runtimeFetch(request, env, ctx);
  if (!source.ok || !source.headers.get("content-type")?.includes("text/html")) return source;
  let html = await source.text();
  if (!html.includes("data-rally-account-note")) {
    const note = `<p class="evt-rally-consent" data-rally-account-note><strong>写真の観察記録は無料アカウントに保存します。</strong><span>未登録の場合は、入力を失わず登録してから記録画面へ進みます。</span><span>ミッションへの参加とライブ閲覧はゲストのまま使えます。</span></p>`;
    html = /<\/article>/i.test(html) ? html.replace(/<\/article>/i, `${note}</article>`) : replaceMain(html, `<main>${note}</main>`);
  }
  html = injectBeforeBody(html, `<script${scriptNonceAttr(html)}>${rallyEnhancementScript(sessionId)}</script>`);
  return new Response(html, { status: source.status, headers: htmlHeaders(source) });
}

async function fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> {
  const url = new URL(request.url);
  const path = normalizedPath(url.pathname);
  if (request.method === "GET" && path === "/community/events") {
    const source = await runtimeFetch(request, env, ctx);
    if (!source.ok || !source.headers.get("content-type")?.includes("text/html")) return source;
    return new Response(filterLegacyQaEventCards(await source.text()), { status: source.status, headers: htmlHeaders(source) });
  }
  const join = path.match(/^\/community\/events\/([^/]+)\/join\/?$/);
  const joinCode = join?.[1];
  if (request.method === "GET" && joinCode) {
    return await renderEnhancedJoin(request, env, ctx, decodeURIComponent(joinCode));
  }
  const rally = path.match(/^\/events\/([^/]+)\/rally\/?$/);
  const rallySessionId = rally?.[1];
  if (request.method === "GET" && rallySessionId) {
    return await renderEnhancedRally(request, env, ctx, decodeURIComponent(rallySessionId));
  }
  return await runtimeFetch(request, env, ctx);
}

export default {
  ...upstream,
  fetch,
};
