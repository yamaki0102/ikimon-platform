const PRODUCTION_CANONICAL_ORIGIN = "https://zukan.earth";
const PRODUCTION_LEGACY_ORIGIN = "https://ikimon.life";
const STAGING_CANONICAL_ORIGIN = "https://staging.zukan.earth";

const PUBLIC_HOST_TO_CANONICAL_ORIGIN: Readonly<Record<string, string>> = Object.freeze({
  "zukan.earth": PRODUCTION_CANONICAL_ORIGIN,
  "ikimon.life": PRODUCTION_CANONICAL_ORIGIN,
  "www.ikimon.life": PRODUCTION_CANONICAL_ORIGIN,
  "staging.zukan.earth": STAGING_CANONICAL_ORIGIN,
  "staging.ikimon.life": STAGING_CANONICAL_ORIGIN,
});

const PUBLIC_HOSTS = new Set(Object.keys(PUBLIC_HOST_TO_CANONICAL_ORIGIN));
const CONFIGURED_ORIGINS = new Set([
  PRODUCTION_CANONICAL_ORIGIN,
  PRODUCTION_LEGACY_ORIGIN,
  STAGING_CANONICAL_ORIGIN,
  "https://staging.ikimon.life",
]);

function firstHeaderValue(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? (raw.split(",", 1)[0] ?? "").trim() : "";
}

export function normalizePublicHost(value: unknown): string {
  return firstHeaderValue(value).toLowerCase().replace(/:\d+$/, "");
}

export function isZukanPublicHost(value: unknown): boolean {
  return PUBLIC_HOSTS.has(normalizePublicHost(value));
}

/**
 * The browser-facing host remains the request host for OAuth and CSRF checks.
 * Public hosts are HTTPS-only; local/test hosts keep their forwarded protocol.
 */
export function requestOriginFromHeaders(
  headers: Record<string, unknown>,
  fallback = "http://localhost:3200",
): string {
  const host = normalizePublicHost(headers["x-forwarded-host"] ?? headers.host);
  if (!host) return fallback;
  if (isZukanPublicHost(host)) return `https://${host}`;
  const proto = firstHeaderValue(headers["x-forwarded-proto"] ?? "https") || "https";
  return `${proto}://${host}`;
}

/**
 * Canonical SEO origin. Old production hosts intentionally resolve to the new
 * production origin, while the old host remains routable for rollback.
 */
export function canonicalPublicOriginForHost(value: unknown, fallback = PRODUCTION_LEGACY_ORIGIN): string {
  return PUBLIC_HOST_TO_CANONICAL_ORIGIN[normalizePublicHost(value)] ?? fallback;
}

export function canonicalPublicOriginFromHeaders(
  headers: Record<string, unknown>,
  fallback = resolveConfiguredPublicOrigin(),
): string {
  const host = normalizePublicHost(headers["x-forwarded-host"] ?? headers.host);
  return host ? canonicalPublicOriginForHost(host, fallback) : fallback;
}

export function resolveConfiguredPublicOrigin(
  configuredOrigin: string | undefined = process.env.ZUKAN_PUBLIC_ORIGIN,
): string {
  const normalized = String(configuredOrigin ?? "").trim().replace(/\/+$/, "");
  return CONFIGURED_ORIGINS.has(normalized) ? normalized : PRODUCTION_LEGACY_ORIGIN;
}

function normalizedPathname(value: string): string {
  const path = value.startsWith("/") ? value : `/${value}`;
  const localized = path.match(/^\/(?:ja|en|es|pt-br)(?=\/|$)/i);
  return localized ? path.slice(localized[0].length) || "/" : path;
}

/**
 * Redirects are intentionally limited to navigable page paths. API, media,
 * auth, callback, webhook, operations, static, and PWA surfaces stay on the
 * host that received the request so cookies and non-HTML contracts survive a
 * staged cutover.
 */
export function isSafeLegacyPagePath(pathname: string): boolean {
  const path = normalizedPathname(pathname);
  if (!path.startsWith("/") || path.includes("\\") || path.includes("\u0000")) return false;
  if (path.split("/").at(-1)?.includes(".")) return false;
  if ([
    "/favicon.ico",
    "/manifest.webmanifest",
    "/robots.txt",
    "/sitemap.xml",
    "/offline.html",
    "/app-sw.js",
    "/sw.js",
    "/sw.php",
  ].includes(path)) return false;
  return ![
    "/api/",
    "/assets/",
    "/media/",
    "/uploads/",
    "/thumb/",
    "/auth/",
    "/auth",
    "/oauth/",
    "/login",
    "/register",
    "/callback/",
    "/webhook/",
    "/ops/",
    "/internal/",
    "/.well-known/",
  ].some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix));
}

export function isSafeLegacyPageRequest(method: string, pathname: string): boolean {
  return (method === "GET" || method === "HEAD") && isSafeLegacyPagePath(pathname);
}

export const ZUKAN_PUBLIC_ORIGIN_CONTRACT = Object.freeze({
  productionCanonicalOrigin: PRODUCTION_CANONICAL_ORIGIN,
  productionLegacyOrigin: PRODUCTION_LEGACY_ORIGIN,
  stagingCanonicalOrigin: STAGING_CANONICAL_ORIGIN,
  productionHosts: ["zukan.earth", "ikimon.life", "www.ikimon.life"],
  stagingHosts: ["staging.zukan.earth", "staging.ikimon.life"],
  redirectExclusions: [
    "/api/",
    "/assets/",
    "/media/",
    "/uploads/",
    "/thumb/",
    "/auth/",
    "/oauth/",
    "/login",
    "/register",
    "/callback/",
    "/webhook/",
    "/ops/",
    "/internal/",
    "/.well-known/",
  ],
});
