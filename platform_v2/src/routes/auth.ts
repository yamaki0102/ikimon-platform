import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getSessionFromCookie, issueSession, readSessionTokenFromCookie, revokeSession } from "../services/authSession.js";
import { authenticateWithPassword, findOrCreateOAuthUser, registerWithPassword } from "../services/authUsers.js";
import { consumeAppOAuthExchangeCode, createAppOAuthExchangeCode } from "../services/appOAuthExchange.js";
import {
  assertAuthRateLimit,
  assertSameOriginRequest,
  normalizeEmail,
  safeRedirectPath,
} from "../services/authSecurity.js";
import {
  buildAppOAuthStart,
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

type MobileAuthBody = AuthBody & {
  install_id?: unknown;
  platform?: unknown;
  app_version?: unknown;
  device?: unknown;
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

function postAuthRedirect(input: unknown): string {
  const redirect = safeRedirectPath(input);
  const path = redirect.split(/[?#]/, 1)[0] ?? "";
  const normalizedRedirect = path === "/login" || path === "/register" ? "/record" : redirect;
  return normalizedRedirect === "/record" ? "/record?start=photo" : normalizedRedirect;
}

const AUTH_STYLES = `
  .auth-wrap { max-width: var(--ikimon-content-max); margin: 24px auto 0; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(280px, .95fr); gap: 22px; align-items: start; }
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

type AuthPageCopy = {
  titleLogin: string;
  titleRegister: string;
  tabAria: string;
  loginTab: string;
  registerTab: string;
  socialAria: string;
  disabledSuffix: string;
  google: string;
  twitter: string;
  profileLoginHeading: string;
  profileRegisterHeading: string;
  recordLoginHeading: string;
  recordRegisterHeading: string;
  profileLead: string;
  recordLoginLead: string;
  recordRegisterLead: string;
  displayName: string;
  email: string;
  password: string;
  profileLoginSubmit: string;
  profileRegisterSubmit: string;
  recordLoginSubmit: string;
  recordRegisterSubmit: string;
  noteEyebrow: string;
  profileNoteHeading: string;
  recordNoteHeading: string;
  profileNoteLead: string;
  recordNoteLead: string;
  safetyCookie: string;
  safetyFailure: string;
  safetyOrigin: string;
  switchToRegister: string;
  switchToLogin: string;
  heroEyebrow: string;
  profileHeroLogin: string;
  profileHeroRegister: string;
  recordHeroLogin: string;
  recordHeroRegister: string;
  profileHeroLead: string;
  recordHeroLead: string;
  footerNote: string;
  statusChecking: string;
  fallbackError: string;
  errors: Record<string, string>;
};

function authPageCopy(lang: SiteLang): AuthPageCopy {
  const localized: Record<SiteLang, AuthPageCopy> = {
    ja: {
      titleLogin: "ログイン | ZUKAN",
      titleRegister: "新規登録 | ZUKAN",
      tabAria: "認証切替",
      loginTab: "ログイン",
      registerTab: "新規登録",
      socialAria: "ソーシャルログイン",
      disabledSuffix: "は設定中",
      google: "Google で続ける",
      twitter: "X(Twitter) で続ける",
      profileLoginHeading: "マイページへ入る",
      profileRegisterHeading: "マイページを作る",
      recordLoginHeading: "記録を続ける",
      recordRegisterHeading: "記録用アカウントを作る",
      profileLead: "ログインすると、自分の記録と場所をまとめて見返せます。",
      recordLoginLead: "ログインすると、そのまま記録画面へ戻ります。",
      recordRegisterLead: "登録後すぐに記録画面へ進みます。",
      displayName: "表示名",
      email: "メールアドレス",
      password: "パスワード",
      profileLoginSubmit: "ログインしてマイページへ",
      profileRegisterSubmit: "登録してマイページへ",
      recordLoginSubmit: "ログインして記録する",
      recordRegisterSubmit: "登録して記録する",
      noteEyebrow: "ZUKAN",
      profileNoteHeading: "自分の記録を、いつでも見返せます。",
      recordNoteHeading: "撮った続きから始められます。",
      profileNoteLead: "写真、メモ、場所を一つの記録としてまとめて見られます。",
      recordNoteLead: "撮った写真を失わず、そのまま記録を続けられます。",
      safetyCookie: "公開する範囲は、記録ごとに選べます",
      safetyFailure: "登録済みの場合は、同じ記録へ戻れます",
      safetyOrigin: "名前が分からなくても、あとから見直せます",
      switchToRegister: "新しく登録する",
      switchToLogin: "既存アカウントでログイン",
      heroEyebrow: "ZUKAN",
      profileHeroLogin: "ログインしてマイページへ",
      profileHeroRegister: "新しく登録してマイページへ",
      recordHeroLogin: "ログインして記録する",
      recordHeroRegister: "新しく登録して記録する",
      profileHeroLead: "自分の写真、メモ、場所を見返すための入口です。",
      recordHeroLead: "足もとの発見を、自分の記録として残すための入口です。",
      footerNote: "ログイン後は、開こうとしていた画面へ戻ります。",
      statusChecking: "確認中...",
      fallbackError: "認証に失敗しました。",
      errors: {
        invalid_credentials: "メールアドレスまたはパスワードが違います。",
        account_disabled: "このアカウントは現在利用できません。",
        email_already_registered: "このメールアドレスは既に登録されています。",
        invalid_email: "メールアドレスの形式を確認してください。",
        password_too_short: "パスワードは8文字以上にしてください。",
        display_name_required: "表示名を入力してください。",
        rate_limited: "試行回数が多すぎます。少し待ってから再試行してください。",
        same_origin_required: "ページを再読み込みしてからもう一度試してください。",
      },
    },
    en: {
      titleLogin: "Log in | ZUKAN",
      titleRegister: "Create account | ZUKAN",
      tabAria: "Authentication switch",
      loginTab: "Log in",
      registerTab: "Create account",
      socialAria: "Social login",
      disabledSuffix: "is being set up",
      google: "Continue with Google",
      twitter: "Continue with X",
      profileLoginHeading: "Open your My page",
      profileRegisterHeading: "Create your My page",
      recordLoginHeading: "Continue recording",
      recordRegisterHeading: "Create a recording account",
      profileLead: "Log in to revisit your places and records in one page.",
      recordLoginLead: "Log in and return directly to the recording screen.",
      recordRegisterLead: "Create an account and start recording right away.",
      displayName: "Display name",
      email: "Email address",
      password: "Password",
      profileLoginSubmit: "Log in to My page",
      profileRegisterSubmit: "Create My page",
      recordLoginSubmit: "Log in and record",
      recordRegisterSubmit: "Create account and record",
      noteEyebrow: "ZUKAN",
      profileNoteHeading: "After login, you will continue to My page.",
      recordNoteHeading: "After login, you will return to the recording screen.",
      profileNoteLead: "Your page keeps your places and recent observations together.",
      recordNoteLead: "Your photos and notes stay connected to your ZUKAN account.",
      safetyCookie: "Your session stays protected on this device",
      safetyFailure: "If you already have an account, continue from login",
      safetyOrigin: "Your records are saved only after you confirm them",
      switchToRegister: "Create a new account",
      switchToLogin: "Log in with an existing account",
      heroEyebrow: "ZUKAN",
      profileHeroLogin: "Log in to My page",
      profileHeroRegister: "Create your My page",
      recordHeroLogin: "Log in and record",
      recordHeroRegister: "Create account and record",
      profileHeroLead: "Return to the places and records you have collected.",
      recordHeroLead: "The entrance for saving what you found underfoot as your own record.",
      footerNote: "After authentication, you will return to the recording flow.",
      statusChecking: "Checking...",
      fallbackError: "Authentication failed.",
      errors: {
        invalid_credentials: "The email address or password is incorrect.",
        account_disabled: "This account is not available right now.",
        email_already_registered: "This email address is already registered.",
        invalid_email: "Check the email address format.",
        password_too_short: "Use at least 8 characters for the password.",
        display_name_required: "Enter a display name.",
        rate_limited: "Too many attempts. Please wait and try again.",
        same_origin_required: "Reload the page and try again.",
      },
    },
    es: {
      titleLogin: "Iniciar sesion | ZUKAN",
      titleRegister: "Crear cuenta | ZUKAN",
      tabAria: "Cambiar autenticacion",
      loginTab: "Iniciar sesion",
      registerTab: "Crear cuenta",
      socialAria: "Inicio de sesion social",
      disabledSuffix: "esta en configuracion",
      google: "Continuar con Google",
      twitter: "Continuar con X",
      profileLoginHeading: "Abrir mi pagina",
      profileRegisterHeading: "Crear mi pagina",
      recordLoginHeading: "Continuar registrando",
      recordRegisterHeading: "Crear cuenta para registrar",
      profileLead: "Inicia sesion para volver a tus lugares y registros en una sola pagina.",
      recordLoginLead: "Inicia sesion y vuelve directamente a la pantalla de registro.",
      recordRegisterLead: "Crea una cuenta y empieza a registrar de inmediato.",
      displayName: "Nombre visible",
      email: "Correo electronico",
      password: "Contrasena",
      profileLoginSubmit: "Iniciar sesion en mi pagina",
      profileRegisterSubmit: "Crear mi pagina",
      recordLoginSubmit: "Iniciar sesion y registrar",
      recordRegisterSubmit: "Crear cuenta y registrar",
      noteEyebrow: "ZUKAN",
      profileNoteHeading: "Despues de iniciar sesion, continuaras a mi pagina.",
      recordNoteHeading: "Despues de iniciar sesion, volveras a la pantalla de registro.",
      profileNoteLead: "Mi pagina reune tus lugares y observaciones recientes.",
      recordNoteLead: "Tus fotos y notas quedan vinculadas a tu cuenta de ZUKAN.",
      safetyCookie: "Tu sesion permanece protegida en este dispositivo",
      safetyFailure: "Si ya tienes una cuenta, continua desde iniciar sesion",
      safetyOrigin: "Tus registros se guardan solo despues de confirmarlos",
      switchToRegister: "Crear una cuenta nueva",
      switchToLogin: "Iniciar sesion con una cuenta existente",
      heroEyebrow: "ZUKAN",
      profileHeroLogin: "Iniciar sesion en mi pagina",
      profileHeroRegister: "Crear mi pagina",
      recordHeroLogin: "Iniciar sesion y registrar",
      recordHeroRegister: "Crear cuenta y registrar",
      profileHeroLead: "Vuelve a los lugares y registros que has reunido.",
      recordHeroLead: "La entrada para guardar lo que encontraste como tu propio registro.",
      footerNote: "Despues de autenticarte, volveras al flujo de registro.",
      statusChecking: "Comprobando...",
      fallbackError: "No se pudo autenticar.",
      errors: {
        invalid_credentials: "El correo o la contrasena no son correctos.",
        account_disabled: "Esta cuenta no esta disponible ahora.",
        email_already_registered: "Este correo ya esta registrado.",
        invalid_email: "Revisa el formato del correo.",
        password_too_short: "Usa al menos 8 caracteres para la contrasena.",
        display_name_required: "Ingresa un nombre visible.",
        rate_limited: "Demasiados intentos. Espera y vuelve a intentar.",
        same_origin_required: "Recarga la pagina y vuelve a intentar.",
      },
    },
    "pt-BR": {
      titleLogin: "Entrar | ZUKAN",
      titleRegister: "Criar conta | ZUKAN",
      tabAria: "Alternar autenticacao",
      loginTab: "Entrar",
      registerTab: "Criar conta",
      socialAria: "Login social",
      disabledSuffix: "esta em configuracao",
      google: "Continuar com Google",
      twitter: "Continuar com X",
      profileLoginHeading: "Abrir minha pagina",
      profileRegisterHeading: "Criar minha pagina",
      recordLoginHeading: "Continuar registrando",
      recordRegisterHeading: "Criar conta para registrar",
      profileLead: "Entre para rever seus locais e registros em uma unica pagina.",
      recordLoginLead: "Entre e volte direto para a tela de registro.",
      recordRegisterLead: "Crie uma conta e comece a registrar imediatamente.",
      displayName: "Nome exibido",
      email: "E-mail",
      password: "Senha",
      profileLoginSubmit: "Entrar na minha pagina",
      profileRegisterSubmit: "Criar minha pagina",
      recordLoginSubmit: "Entrar e registrar",
      recordRegisterSubmit: "Criar conta e registrar",
      noteEyebrow: "ZUKAN",
      profileNoteHeading: "Depois de entrar, voce continua para minha pagina.",
      recordNoteHeading: "Depois de entrar, voce volta para a tela de registro.",
      profileNoteLead: "Minha pagina reune seus locais e observacoes recentes.",
      recordNoteLead: "Suas fotos e notas ficam ligadas a sua conta do ZUKAN.",
      safetyCookie: "Sua sessao permanece protegida neste dispositivo",
      safetyFailure: "Se voce ja tem uma conta, continue pela entrada",
      safetyOrigin: "Seus registros sao salvos somente depois da confirmacao",
      switchToRegister: "Criar uma nova conta",
      switchToLogin: "Entrar com uma conta existente",
      heroEyebrow: "ZUKAN",
      profileHeroLogin: "Entrar na minha pagina",
      profileHeroRegister: "Criar minha pagina",
      recordHeroLogin: "Entrar e registrar",
      recordHeroRegister: "Criar conta e registrar",
      profileHeroLead: "Volte aos locais e registros que voce reuniu.",
      recordHeroLead: "A entrada para salvar o que voce encontrou como seu proprio registro.",
      footerNote: "Depois da autenticacao, voce volta ao fluxo de registro.",
      statusChecking: "Verificando...",
      fallbackError: "Falha na autenticacao.",
      errors: {
        invalid_credentials: "O e-mail ou a senha esta incorreto.",
        account_disabled: "Esta conta nao esta disponivel agora.",
        email_already_registered: "Este e-mail ja esta registrado.",
        invalid_email: "Confira o formato do e-mail.",
        password_too_short: "Use pelo menos 8 caracteres na senha.",
        display_name_required: "Digite um nome exibido.",
        rate_limited: "Muitas tentativas. Aguarde e tente de novo.",
        same_origin_required: "Recarregue a pagina e tente novamente.",
      },
    },
  };
  return localized[lang] ?? localized.ja;
}

function localizedAuthHref(basePath: string, path: string, lang: SiteLang): string {
  return appendLangToHref(withBasePath(basePath, path), lang);
}

function oauthLink(basePath: string, provider: OAuthProvider, redirect: string, label: string, copy: AuthPageCopy, lang: SiteLang): string {
  if (!oauthProviderEnabled(provider)) {
    return `<span class="auth-social-disabled">${escapeHtml(`${label} ${copy.disabledSuffix}`)}</span>`;
  }
  const href = localizedAuthHref(basePath, `/auth/oauth/${provider}/start?redirect=${encodeURIComponent(redirect)}`, lang);
  return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function renderAuthPage(options: {
  mode: "login" | "register";
  basePath: string;
  lang: SiteLang;
  redirect: string;
}): string {
  const isLogin = options.mode === "login";
  const copy = authPageCopy(options.lang);
  const redirectPath = options.redirect.split(/[?#]/, 1)[0] ?? "";
  const isProfileRedirect = redirectPath === "/profile" || redirectPath.startsWith("/profile/");
  const title = isLogin ? copy.titleLogin : copy.titleRegister;
  const endpoint = withBasePath(options.basePath, isLogin ? "/api/v1/auth/login" : "/api/v1/auth/register");
  const switchHref = localizedAuthHref(
    options.basePath,
    `${isLogin ? "/register" : "/login"}?redirect=${encodeURIComponent(options.redirect)}`,
    options.lang,
  );
  const loginHref = localizedAuthHref(options.basePath, `/login?redirect=${encodeURIComponent(options.redirect)}`, options.lang);
  const registerHref = localizedAuthHref(options.basePath, `/register?redirect=${encodeURIComponent(options.redirect)}`, options.lang);
  const displayNameField = isLogin
    ? ""
    : `<label class="auth-field"><span>${escapeHtml(copy.displayName)}</span><input name="displayName" type="text" autocomplete="name" required /></label>`;
  const socialLogin = `<div class="auth-social" aria-label="${escapeHtml(copy.socialAria)}">
    ${oauthLink(options.basePath, "google", options.redirect, copy.google, copy, options.lang)}
    ${oauthLink(options.basePath, "twitter", options.redirect, copy.twitter, copy, options.lang)}
  </div>`;
  const body = `<div class="auth-wrap">
    <section class="auth-panel">
      <div class="auth-tabs" aria-label="${escapeHtml(copy.tabAria)}">
        <a class="auth-tab${isLogin ? " is-active" : ""}" href="${escapeHtml(loginHref)}">${escapeHtml(copy.loginTab)}</a>
        <a class="auth-tab${!isLogin ? " is-active" : ""}" href="${escapeHtml(registerHref)}">${escapeHtml(copy.registerTab)}</a>
      </div>
      <div class="eyebrow">${escapeHtml(copy.heroEyebrow)}</div>
      <h2>${escapeHtml(isProfileRedirect ? (isLogin ? copy.profileLoginHeading : copy.profileRegisterHeading) : (isLogin ? copy.recordLoginHeading : copy.recordRegisterHeading))}</h2>
      <p>${escapeHtml(isProfileRedirect ? copy.profileLead : (isLogin ? copy.recordLoginLead : copy.recordRegisterLead))}</p>
      <form class="auth-form" data-auth-form data-endpoint="${escapeHtml(endpoint)}" data-redirect="${escapeHtml(options.redirect)}">
        ${displayNameField}
        <label class="auth-field"><span>${escapeHtml(copy.email)}</span><input name="email" type="email" autocomplete="email" required /></label>
        <label class="auth-field"><span>${escapeHtml(copy.password)}</span><input name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" minlength="8" required /></label>
        <button class="btn btn-solid auth-submit" type="submit">${escapeHtml(isProfileRedirect ? (isLogin ? copy.profileLoginSubmit : copy.profileRegisterSubmit) : (isLogin ? copy.recordLoginSubmit : copy.recordRegisterSubmit))}</button>
        <div class="auth-status" data-auth-status aria-live="polite"></div>
      </form>
      ${socialLogin}
    </section>
    <aside class="auth-note">
      <div class="eyebrow">${escapeHtml(copy.noteEyebrow)}</div>
      <h3>${escapeHtml(isProfileRedirect ? copy.profileNoteHeading : copy.recordNoteHeading)}</h3>
      <p>${escapeHtml(isProfileRedirect ? copy.profileNoteLead : copy.recordNoteLead)}</p>
      <ul>
        <li>${escapeHtml(copy.safetyCookie)}</li>
        <li>${escapeHtml(copy.safetyFailure)}</li>
        <li>${escapeHtml(copy.safetyOrigin)}</li>
      </ul>
      <a class="btn btn-ghost" href="${escapeHtml(switchHref)}">${escapeHtml(isLogin ? copy.switchToRegister : copy.switchToLogin)}</a>
    </aside>
  </div>
  <script>
(() => {
  const form = document.querySelector('[data-auth-form]');
  if (!form) return;
  const status = form.querySelector('[data-auth-status]');
  const messages = ${JSON.stringify(copy.errors)};
  const checkingMessage = ${JSON.stringify(copy.statusChecking)};
  const fallbackErrorMessage = ${JSON.stringify(copy.fallbackError)};
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (status) status.textContent = checkingMessage;
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
      if (status) status.textContent = messages[key] || fallbackErrorMessage;
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
      eyebrow: copy.heroEyebrow,
      heading: isProfileRedirect ? (isLogin ? copy.profileHeroLogin : copy.profileHeroRegister) : (isLogin ? copy.recordHeroLogin : copy.recordHeroRegister),
      lead: isProfileRedirect ? copy.profileHeroLead : copy.recordHeroLead,
      tone: "light",
      align: "center",
    },
    body,
    footerNote: copy.footerNote,
  });
}

async function issueUserSession(request: FastifyRequest, userId: string) {
  return issueSession({
    userId,
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"] ?? null,
  });
}

async function handleOAuthCallback(
  request: FastifyRequest<{
    Params?: { provider?: string };
    Querystring?: { provider?: unknown; state?: string; code?: string; error?: string };
  }>,
  reply: FastifyReply,
  providerInput: unknown,
) {
  let failureStage = "provider";
  try {
    const provider = providerFromParam(providerInput);
    failureStage = "state";
    const state = readOAuthState(request.headers.cookie);
    const query = request.query as { state?: string; code?: string; error?: string };
    if (!state || state.provider !== provider || state.state !== query.state || !query.code || query.error) {
      throw new Error("oauth_state_invalid");
    }
    failureStage = "exchange_oauth_code";
    const profile = await exchangeOAuthCode(provider, query.code, oauthRedirectUri(request, provider), state.codeVerifier);
    failureStage = "find_or_create_user";
    const user = await findOrCreateOAuthUser(profile);
    failureStage = "issue_session";
    const session = await issueUserSession(request, user.userId);
    reply.header("set-cookie", [session.cookie, buildClearedOAuthStateCookie()]);
    if (state.appReturnUri) {
      const exchange = await createAppOAuthExchangeCode({
        userId: user.userId,
        displayName: user.displayName,
        email: user.email,
        rawToken: session.rawToken,
      });
      const appUrl = new URL(state.appReturnUri);
      appUrl.searchParams.set("code", exchange.code);
      appUrl.searchParams.set("code_expires_at", exchange.expiresAt);
      appUrl.searchParams.set("user_id", user.userId);
      appUrl.searchParams.set("name", user.displayName);
      if (user.email) appUrl.searchParams.set("email", user.email);
      appUrl.searchParams.set("message", "ZUKAN アカウントでログインしました");
      reply.code(303).redirect(appUrl.toString());
      return;
    }
    reply.code(303).redirect(withBasePath(requestBasePath(request), state.redirect));
  } catch (error) {
    request.log.warn({
      err: error,
      failureStage,
      providerInput: typeof providerInput === "string" ? providerInput : null,
      hasOAuthStateCookie: String(request.headers.cookie ?? "").includes("ikimon_oauth_state="),
    }, "oauth callback failed");
    reply.header("set-cookie", buildClearedOAuthStateCookie());
    reply.code(303).redirect(withBasePath(requestBasePath(request), "/login?error=oauth"));
  }
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  if (!app.hasContentTypeParser("application/x-www-form-urlencoded")) {
    app.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string" },
      (_request, body, done) => {
        done(null, Object.fromEntries(new URLSearchParams(String(body))));
      },
    );
  }
  app.get("/login", async (request, reply) => {
    const basePath = requestBasePath(request);
    const url = new URL(requestUrl(request), "https://ikimon.local");
    const redirect = postAuthRedirect(url.searchParams.get("redirect"));
    const session = await getSessionFromCookie(request.headers.cookie).catch(() => null);
    if (session && !session.banned) {
      return reply.code(303).redirect(withBasePath(basePath, redirect));
    }
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return renderAuthPage({ mode: "login", basePath, lang, redirect });
  });

  app.get("/register", async (request, reply) => {
    const basePath = requestBasePath(request);
    const url = new URL(requestUrl(request), "https://ikimon.local");
    const redirect = postAuthRedirect(url.searchParams.get("redirect"));
    const session = await getSessionFromCookie(request.headers.cookie).catch(() => null);
    if (session && !session.banned) {
      return reply.code(303).redirect(withBasePath(basePath, redirect));
    }
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return renderAuthPage({ mode: "register", basePath, lang, redirect });
  });

  app.post("/logout", async (request, reply) => {
    assertSameOriginRequest(request);
    const result = await revokeSession(readSessionTokenFromCookie(request.headers.cookie));
    reply.header("set-cookie", result.clearedCookie);
    reply.code(303).redirect(withBasePath(requestBasePath(request), "/"));
  });

  app.post<{ Body: AuthBody }>("/api/v1/auth/login", async (request, reply) => {
    try {
      assertSameOriginRequest(request);
      const email = normalizeEmail(request.body?.email);
      await assertAuthRateLimit(["login", request.ip, email || "blank"]);
      const user = await authenticateWithPassword(email, request.body?.password);
      const session = await issueUserSession(request, user.userId);
      const redirect = postAuthRedirect(request.body?.redirect);
      reply.header("set-cookie", session.cookie);
      return { ok: true, redirect, session: session.session };
    } catch (error) {
      reply.code(apiErrorStatus(error));
      return { ok: false, error: publicAuthError(error) };
    }
  });

  app.post<{ Body: MobileAuthBody }>("/api/v1/mobile/auth/login", async (request, reply) => {
    try {
      const email = normalizeEmail(request.body?.email);
      await assertAuthRateLimit(["mobile-login", request.ip, email || "blank"]);
      const user = await authenticateWithPassword(email, request.body?.password);
      const session = await issueUserSession(request, user.userId);
      return {
        ok: true,
        data: {
          token: session.rawToken,
          session: session.session,
          user: {
            userId: session.session.userId,
            displayName: session.session.displayName,
            roleName: session.session.roleName,
            rankLabel: session.session.rankLabel,
          },
          installId: typeof request.body?.install_id === "string" ? request.body.install_id : null,
          platform: typeof request.body?.platform === "string" ? request.body.platform : "android",
          appVersion: typeof request.body?.app_version === "string" ? request.body.app_version : null,
        },
      };
    } catch (error) {
      reply.code(apiErrorStatus(error));
      return { ok: false, error: publicAuthError(error) };
    }
  });

  app.post<{ Body: { code?: unknown } }>("/api/v1/mobile/auth/oauth/exchange", async (request, reply) => {
    try {
      await assertAuthRateLimit(["app-oauth-exchange", request.ip], 20, 10 * 60 * 1000);
      const exchange = await consumeAppOAuthExchangeCode(request.body?.code);
      return {
        ok: true,
        success: true,
        data: {
          token: exchange.token,
          user: {
            userId: exchange.userId,
            displayName: exchange.displayName,
          },
          email: exchange.email,
          message: "ZUKAN アカウントでログインしました",
        },
      };
    } catch (error) {
      reply.code(error instanceof Error && error.message === "rate_limited" ? 429 : 400);
      return {
        ok: false,
        success: false,
        error: error instanceof Error ? error.message : "oauth_exchange_failed",
      };
    }
  });

  app.post<{ Body: AuthBody }>("/api/v1/auth/register", async (request, reply) => {
    try {
      assertSameOriginRequest(request);
      const email = normalizeEmail(request.body?.email);
      await assertAuthRateLimit(["register", request.ip, email || "blank"], 5, 10 * 60 * 1000);
      const user = await registerWithPassword({
        displayName: request.body?.displayName,
        email,
        password: request.body?.password,
      });
      const session = await issueUserSession(request, user.userId);
      const redirect = postAuthRedirect(request.body?.redirect);
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

  app.get("/app_oauth_start.php", async (request, reply) => {
    try {
      const query = request.query as {
        provider?: unknown;
        return_uri?: unknown;
        install_id?: unknown;
        platform?: unknown;
        app_version?: unknown;
      };
      const provider = providerFromParam(query.provider);
      const start = buildAppOAuthStart(provider, request, {
        returnUri: query.return_uri,
        installId: query.install_id,
        platform: query.platform,
        appVersion: query.app_version,
      });
      reply.header("set-cookie", start.cookie);
      reply.code(303).redirect(start.authorizationUrl);
    } catch {
      const errorUrl = new URL("ikimonfieldscan://auth/callback");
      errorUrl.searchParams.set("error", "oauth");
      errorUrl.searchParams.set("message", "ソーシャルログインに失敗した");
      reply.code(303).redirect(errorUrl.toString());
    }
  });

  app.get<{ Params: { provider: string } }>("/auth/oauth/:provider/callback", async (request, reply) => {
    await handleOAuthCallback(request, reply, request.params.provider);
  });

  app.get<{ Querystring: { provider?: unknown; state?: string; code?: string; error?: string } }>("/oauth_callback.php", async (request, reply) => {
    await handleOAuthCallback(request, reply, request.query.provider);
  });
}
