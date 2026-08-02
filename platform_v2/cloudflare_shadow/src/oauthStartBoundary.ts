const PRODUCTION_HOSTS = new Set(["ikimon.life", "www.ikimon.life"]);
const STAGING_HOSTS = new Set(["staging.ikimon.life"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const OAUTH_START_PATH = /^\/auth\/oauth\/(google|twitter)\/start\/?$/u;

export type OAuthBoundaryEnv = {
  ENVIRONMENT?: unknown;
};

function strictHostHeader(request: Request): string | null {
  const value = request.headers.get("host");
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized && !normalized.includes(",") ? normalized : null;
}

export function isBrowserOAuthStart(request: Request): boolean {
  return OAUTH_START_PATH.test(new URL(request.url).pathname);
}

export function oauthErrorRedirect(request: Request): Response {
  const target = new URL("/login?error=oauth", request.url);
  return new Response(null, {
    status: 303,
    headers: {
      location: target.toString(),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function authorizeBrowserOAuthStart(
  request: Request,
  env: OAuthBoundaryEnv,
): boolean {
  if (!isBrowserOAuthStart(request)) return true;

  const url = new URL(request.url);
  const environment = String(env.ENVIRONMENT ?? "").trim().toLowerCase();
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
