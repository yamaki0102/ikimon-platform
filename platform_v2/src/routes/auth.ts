import type { FastifyInstance, FastifyRequest } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { detectLangFromUrl, type SiteLang } from "../i18n.js";
import { buildClearedSessionCookie, issueSession, readSessionTokenFromCookie, revokeSession } from "../services/authSession.js";
import { authenticateWithPassword, findOrCreateOAuthUser, registerWithPassword } from "../services/authUsers.js";
import {
  assertAuthRateLimit,
  assertSameOriginRequest,
  normalizeEmail,
  safeRedirectPath,
} from "../services/authSecurity.js";
import {
  buildClearedOAuthStateCookie,
  buildOAuthStart,
  exchangeOAuthCode,
  oauthProviderEnabled,
  oauthRedirectUri,
  readOAuthState,
  type OAuthProvider,
} from "../services/oauthFlow.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

type AuthBody = {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
  redirect?: unknown;
};

function requestUrl(request: FastifyRequest): string {
  return String(request.raw.url ?? request.url ?? "");
}

function requestBasePath(request: FastifyRequest): string {
  return getForwardedBasePath(request.headers as Record<string, unknown>);
}

function providerFromParam(value: unknown): OAuthProvider {
  if (value === "google" || value === "twitter") {
    return value;
  }
  throw new Error("oauth_provider_invalid");
}

function apiErrorStatus(error: unknown): number {
  if (!(error instanceof Error)) {
    return 400;
  }
  if (error.message === "rate_limited") {
    return 429;
  }
  if (error.message === "same_origin_required") {
    return 403;
  }
  if (error.message === "account_disabled") {
    return 401;
  }
  if (error.message === "email_already_registered") {
    return 409;
  }
  return 400;
}

function publicAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "auth_failed";
  }
  if (error.message === "rate_limited") {
    return "rate_limited";
  }
  if (error.message === "same_origin_required") {
    return "same_origin_required";
  }
  if (error.message === "account_disabled") {
    return "account_disabled";
  }
  if (error.message === "email_already_registered") {
    return "email_already_registered";
  }
  if (["display_name_required", "invalid_email", "password_too_short"].includes(error.message)) {
    return error.message;
  }
  return "invalid_credentials";
}

const AUTH_STYLES = `
  .auth-wrap { max-width: 980px; margin: 24px auto 0; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(280px, .95fr); gap: 22px; align-items: start; }
  .auth-panel, .auth-note { border-radius: 24px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 18px 42px rgba(15,23,42,.07); padding: 24px; }
  .auth-panel h2 { margin: 6px 0 4px; font-size: 28px; line-height: 1.25; color: #0f172a; }
  .auth-panel p, .auth-note p { color: #64748b; line-height: 1.75; }
  .auth-tabs { display: inline-flex; gap: 6px; padding: 4px; border-radius: 999px; background: #f1f5f9; margin-bottom: 18px; }
  .auth-tab { min-height: 38px; padding: 8px 14px; border-radius: 999px; font-weight: 850; font-size: 13px; color: #475569; }
  .auth-tab.is-active { background: #fff; color: #047857; box-shadow: 0 5px 12px rgba(15,23,42,.06); }
  .auth-form { display: grid; gap: 14px; margin-top: 18px; }
  .auth-field { display: grid; gap: 7px; }
  .auth-field span { font-weight: 850; color: #0f172a; font-size: 13px; }
  .auth-field input { width: 100%; min-height: 48px; border-radius: 14px; border: 1px solid rgba(15,23,42,.12); padding: 0 14px; font: inherit; background: #fff; }
  .auth-status { min-height: 22px; color: #b91c1c; font-weight: 800; font-size: 13px; }
  .auth-submit { width: 100%; justify-content: center; }
  .auth-social { display: grid; gap: 10px; margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(15,23,42,.08); }
  .auth-social a, .auth-social .auth-social-disabled { display: flex; align-items: center; justify-content: center; min-height: 46px; border-radius: 14px; border: 1px solid rgba(15,23,42,.12); background: #fff; font-weight: 850; }
  .auth-social-disabled { color: #94a3b8; background: #f8fafc; }
  .auth-note { display: grid; gap: 14px; background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(240,249,255,.94)); }
  .auth-note h3 { margin: 0; color: #0f172a; font-size: 22px; line-height: 1.35; }
  .auth-note ul { margin: 0; padding-left: 20px; color: #475569; line-height: 1.8; }
  @media (max-width: 820px) { .auth-wrap { grid-template-columns: 1fr; } }
`;

function oauthLink(basePath: string, provider: OAuthProvider, redirect: string, label: string): string {
  if (!oauthProviderEnabled(provider)) {
    return `<span class="auth-social-disabled">${escapeHtml(label)} は設定中</span>`;
  }
  const href = withBasePath(basePath, `/auth/oauth/${provider}/start?redirect=${encodeURIComponent(redirect)}`);
  return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function renderAuthPage(options: {
  mode: "login" | "register";
  basePath: string;
  lang: SiteLang;
  redirect: string;
}): string {
  const isLogin = options.mode === "login";
  const title = isLogin ? "ログイン | ikimon" : "新規登録 | ikimon";
  const endpoint = withBasePath(options.basePath, isLogin ? "/api/v1/auth/login" : "/api/v1/auth/register");
  const switchHref = withBasePath(
    options.basePath,
    `${isLogin ? "/register" : "/login"}?redirect=${encodeURIComponent(options.redirect)}`,
  );
  const loginHref = withBasePath(options.basePath, `/login?redirect=${encodeURIComponent(options.redirect)}`);
  const registerHref = withBasePath(options.basePath, `/register?redirect=${encodeURIComponent(options.redirect)}`);
  const displayNameField = isLogin
    ? ""
    : `<label class="auth-field"><span>表示名</span><input name="displayName" type="text" autocomplete="name" required /></label>`;
  const socialLogin = `<div class="auth-social" aria-label="ソーシャルログイン">
    ${oauthLink(options.basePath, "google", options.redirect, "Google で続ける")}
    ${oauthLink(options.basePath, "twitter", options.redirect, "X(Twitter) で続ける")}
  </div>`;
  const body = `<div class="auth-wrap">
    <section class="auth-panel">
      <div class="auth-tabs" aria-label="認証切替">
        <a class="auth-tab${isLogin ? " is-active" : ""}" href="${escapeHtml(loginHref)}">ログイン</a>
        <a class="auth-tab${!isLogin ? " is-active" : ""}" href="${escapeHtml(registerHref)}">新規登録</a>
      </div>
      <div class="eyebrow">${isLogin ? "sign in" : "create account"}</div>
      <h2>${isLogin ? "記録を続ける" : "記録用アカウントを作る"}</h2>
      <p>${isLogin ? "ログインすると、そのまま投稿画面へ戻ります。" : "登録後すぐに投稿画面へ進みます。"}</p>
      <form class="auth-form" data-auth-form data-endpoint="${escapeHtml(endpoint)}" data-redirect="${escapeHtml(options.redirect)}">
        ${displayNameField}
        <label class="auth-field"><span>メールアドレス</span><input name="email" type="email" autocomplete="email" required /></label>
        <label class="auth-field"><span>パスワード</span><input name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" minlength="8" required /></label>
        <button class="btn btn-solid auth-submit" type="submit">${isLogin ? "ログインして記録する" : "登録して記録する"}</button>
        <div class="auth-status" data-auth-status aria-live="polite"></div>
      </form>
      ${socialLogin}
    </section>
    <aside class="auth-note">
      <div class="eyebrow">record lane</div>
      <h3>ログイン後は PHP ではなく v2 の投稿画面へ進みます。</h3>
      <p>投稿、写真アップロード、同定参加は v2 の session cookie で扱います。</p>
      <ul>
        <li>cookie は HttpOnly / SameSite=Lax / production Secure</li>
        <li>メール有無が分からない失敗表示</li>
        <li>外部 origin からの書き込みを拒否</li>
      </ul>
      <a class="btn btn-ghost" href="${escapeHtml(switchHref)}">${isLogin ? "新しく登録する" : "既存アカウントでログイン"}</a>
    </aside>
  </div>
  <script>
(() => {
  const form = document.querySelector('[data-auth-form]');
  if (!form) return;
  const status = form.querySelector('[data-auth-status]');
  const messages = {
    invalid_credentials: 'メールアドレスまたはパスワードが違います。',
    account_disabled: 'このアカウントは現在利用できません。',
    email_already_registered: 'このメールアドレスは既に登録されています。',
    invalid_email: 'メールアドレスの形式を確認してください。',
    password_too_short: 'パスワードは8文字以上にしてください。',
    display_name_required: '表示名を入力してください。',
    rate_limited: '試行回数が多すぎます。少し待ってから再試行してください。',
    same_origin_required: 'ページを再読み込みしてからもう一度試してください。'
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (status) status.textContent = '確認中...';
    const data = new FormData(form);
    const payload = {
      displayName: String(data.get('displayName') || ''),
      email: String(data.get('email') || ''),
      password: String(data.get('password') || ''),
      redirect: form.getAttribute('data-redirect') || '/record'
    };
    try {
      const response = await fetch(form.getAttribute('data-endpoint') || '', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'invalid_credentials');
      }
      location.assign(result.redirect || '/record');
    } catch (error) {
      const key = error && error.message ? error.message : 'invalid_credentials';
      if (status) status.textContent = messages[key] || '認証に失敗しました。';
    }
  });
})();
  </script>`;

  return renderSiteDocument({
    basePath: options.basePath,
    title,
    activeNav: "記録する",
    lang: options.lang,
    currentPath: withBasePath(options.basePath, isLogin ? "/login" : "/register"),
    extraStyles: AUTH_STYLES,
    hero: {
      eyebrow: "account",
      heading: isLogin ? "ログインして記録する" : "新しく登録して記録する",
      lead: "足もとの発見を、自分の記録として残すための入口です。",
      tone: "light",
      align: "center",
    },
    body,
    footerNote: "認証後は v2 の投稿導線へ戻ります。",
  });
}

async function issueUserSession(request: FastifyRequest, userId: string) {
  return issueSession({
    userId,
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"] ?? null,
  });
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/login", async (request, reply) => {
    const basePath = requestBasePath(request);
    const url = new URL(requestUrl(request), "https://ikimon.local");
    const redirect = safeRedirectPath(url.searchParams.get("redirect"));
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return renderAuthPage({ mode: "login", basePath, lang, redirect });
  });

  app.get("/register", async (request, reply) => {
    const basePath = requestBasePath(request);
    const url = new URL(requestUrl(request), "https://ikimon.local");
    const redirect = safeRedirectPath(url.searchParams.get("redirect"));
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return renderAuthPage({ mode: "register", basePath, lang, redirect });
  });

  app.get("/logout", async (request, reply) => {
    const result = await revokeSession(readSessionTokenFromCookie(request.headers.cookie));
    reply.header("set-cookie", result.clearedCookie);
    reply.code(303).redirect(withBasePath(requestBasePath(request), "/"));
  });

  app.post<{ Body: AuthBody }>("/api/v1/auth/login", async (request, reply) => {
    try {
      assertSameOriginRequest(request);
      const email = normalizeEmail(request.body?.email);
      assertAuthRateLimit(["login", request.ip, email || "blank"]);
      const user = await authenticateWithPassword(email, request.body?.password);
      const session = await issueUserSession(request, user.userId);
      const redirect = safeRedirectPath(request.body?.redirect);
      reply.header("set-cookie", session.cookie);
      return { ok: true, redirect, session: session.session };
    } catch (error) {
      reply.code(apiErrorStatus(error));
      return { ok: false, error: publicAuthError(error) };
    }
  });

  app.post<{ Body: AuthBody }>("/api/v1/auth/register", async (request, reply) => {
    try {
      assertSameOriginRequest(request);
      const email = normalizeEmail(request.body?.email);
      assertAuthRateLimit(["register", request.ip, email || "blank"], 5, 10 * 60 * 1000);
      const user = await registerWithPassword({
        displayName: request.body?.displayName,
        email,
        password: request.body?.password,
      });
      const session = await issueUserSession(request, user.userId);
      const redirect = safeRedirectPath(request.body?.redirect);
      reply.header("set-cookie", session.cookie);
      return { ok: true, redirect, session: session.session };
    } catch (error) {
      reply.code(apiErrorStatus(error));
      return { ok: false, error: publicAuthError(error) };
    }
  });

  app.get<{ Params: { provider: string } }>("/auth/oauth/:provider/start", async (request, reply) => {
    try {
      const provider = providerFromParam(request.params.provider);
      const redirect = (request.query as { redirect?: unknown } | undefined)?.redirect;
      const start = buildOAuthStart(provider, request, redirect);
      reply.header("set-cookie", start.cookie);
      reply.code(303).redirect(start.authorizationUrl);
    } catch {
      reply.code(303).redirect(withBasePath(requestBasePath(request), "/login?error=oauth"));
    }
  });

  app.get<{ Params: { provider: string } }>("/auth/oauth/:provider/callback", async (request, reply) => {
    const provider = providerFromParam(request.params.provider);
    const state = readOAuthState(request.headers.cookie);
    try {
      const query = request.query as { state?: string; code?: string; error?: string };
      if (!state || state.provider !== provider || state.state !== query.state || !query.code || query.error) {
        throw new Error("oauth_state_invalid");
      }
      const profile = await exchangeOAuthCode(provider, query.code, oauthRedirectUri(request, provider), state.codeVerifier);
      const user = await findOrCreateOAuthUser(profile);
      const session = await issueUserSession(request, user.userId);
      reply.header("set-cookie", [session.cookie, buildClearedOAuthStateCookie()]);
      reply.code(303).redirect(withBasePath(requestBasePath(request), state.redirect));
    } catch {
      reply.header("set-cookie", [buildClearedSessionCookie(), buildClearedOAuthStateCookie()]);
      reply.code(303).redirect(withBasePath(requestBasePath(request), "/login?error=oauth"));
    }
  });
}
