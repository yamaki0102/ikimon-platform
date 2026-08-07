const PRODUCTION_ORIGIN = "https://ikimon.life";
const STAGING_ORIGIN = "https://staging.ikimon.life";
const PRODUCTION_HOSTS = new Set(["ikimon.life", "www.ikimon.life"]);
const STAGING_HOSTS = new Set(["staging.ikimon.life"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const BROWSER_OAUTH_START_PATH = /^\/auth\/oauth\/(google|twitter)\/start\/?$/u;
const APP_OAUTH_START_PATH = /^\/app_oauth_start\.php\/?$/u;

export type OAuthBoundaryEnv = {
  ENVIRONMENT?: unknown;
};

export type OAuthStartKind = "browser" | "app" | null;

function environmentName(env: OAuthBoundaryEnv): string {
  return String(env.ENVIRONMENT ?? "").trim().toLowerCase();
}

function strictHostHeader(request: Request): string | null {
  const value = request.headers.get("host");
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized && !normalized.includes(",") ? normalized : null;
}

function safeErrorOrigin(request: Request, env: OAuthBoundaryEnv): string {
  const environment = environmentName(env);
  if (environment === "production") return PRODUCTION_ORIGIN;
  if (environment === "staging") return STAGING_ORIGIN;

  const url = new URL(request.url);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (LOCAL_HOSTS.has(hostname)
      || (url.protocol === "https:"
        && !url.port
        && (PRODUCTION_HOSTS.has(hostname) || STAGING_HOSTS.has(hostname)))) {
    return url.origin;
  }
  return PRODUCTION_ORIGIN;
}

export function oauthStartKind(request: Request): OAuthStartKind {
  const pathname = new URL(request.url).pathname;
  if (BROWSER_OAUTH_START_PATH.test(pathname)) return "browser";
  if (APP_OAUTH_START_PATH.test(pathname)) return "app";
  return null;
}

export function oauthErrorResponse(
  request: Request,
  env: OAuthBoundaryEnv,
  kind: OAuthStartKind = oauthStartKind(request),
): Response {
  let location: string;
  if (kind === "app") {
    const target = new URL("ikimonfieldscan://auth/callback");
    target.searchParams.set("error", "oauth");
    target.searchParams.set("message", "ソーシャルログインに失敗した");
    location = target.toString();
  } else {
    location = new URL("/login?error=oauth", safeErrorOrigin(request, env)).toString();
  }

  return new Response(null, {
    status: 303,
    headers: {
      location,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function authorizeOAuthStart(
  request: Request,
  env: OAuthBoundaryEnv,
  kind: OAuthStartKind = oauthStartKind(request),
): boolean {
  if (kind === null) return true;

  const url = new URL(request.url);
  const environment = environmentName(env);
  const urlHostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const rawHost = strictHostHeader(request);
  if (!rawHost || rawHost !== url.host.toLowerCase()) return false;

  if (environment === "production") {
    return url.protocol === "https:" && !url.port && PRODUCTION_HOSTS.has(urlHostname);
  }
  if (environment === "staging") {
    return url.protocol === "https:" && !url.port && STAGING_HOSTS.has(urlHostname);
  }

  if (LOCAL_HOSTS.has(urlHostname)) {
    return url.protocol === "http:" || url.protocol === "https:";
  }
  return url.protocol === "https:"
    && !url.port
    && (PRODUCTION_HOSTS.has(urlHostname) || STAGING_HOSTS.has(urlHostname));
}
