const LEGACY_PRODUCTION_HOSTS = new Set(["ikimon.life", "www.ikimon.life"]);
const CANONICAL_PRODUCTION_ORIGIN = "https://zukan.earth";

export type LegacyDomainRedirectEnv = {
  ENVIRONMENT?: unknown;
  LEGACY_HOST_REDIRECT_MODE?: unknown;
};

function normalizedEnvValue(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizedPathname(value: string): string {
  const path = value.startsWith("/") ? value : `/${value}`;
  const localized = path.match(/^\/(?:ja|en|es|pt-br)(?=\/|$)/i);
  return localized ? path.slice(localized[0].length) || "/" : path;
}

export function isSafeLegacyPublicPagePath(pathname: string): boolean {
  const path = normalizedPathname(pathname);
  if (!path.startsWith("/") || path.includes("\\") || path.includes("\u0000")) return false;
  if (path.split("/").at(-1)?.includes(".")) return false;

  // Legacy host-only sessions are intentionally not moved between domains.
  // Keep account, capture, personalized guide and administration surfaces on
  // the receiving host until an explicit session-migration contract exists.
  return ![
    "/api",
    "/assets",
    "/media",
    "/uploads",
    "/thumb",
    "/auth",
    "/oauth",
    "/login",
    "/register",
    "/callback",
    "/webhook",
    "/ops",
    "/internal",
    "/.well-known",
    "/home",
    "/record",
    "/profile",
    "/account",
    "/settings",
    "/notifications",
    "/guide",
    "/app",
    "/debug",
    "/admin",
    "/specialist",
    "/me",
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function legacyDomainRedirect(request: Request, env: LegacyDomainRedirectEnv): Response | null {
  if (normalizedEnvValue(env.ENVIRONMENT) !== "production") return null;
  if (normalizedEnvValue(env.LEGACY_HOST_REDIRECT_MODE) !== "enabled") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  const hostHeader = request.headers.get("host")?.trim().toLowerCase() ?? "";
  if (url.protocol !== "https:" || url.port || !LEGACY_PRODUCTION_HOSTS.has(url.hostname.toLowerCase())) return null;
  if (!hostHeader || hostHeader !== url.host.toLowerCase()) return null;
  if (!isSafeLegacyPublicPagePath(url.pathname)) return null;

  const target = new URL(`${url.pathname}${url.search}`, CANONICAL_PRODUCTION_ORIGIN);
  return new Response(null, {
    status: 308,
    headers: {
      location: target.toString(),
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
