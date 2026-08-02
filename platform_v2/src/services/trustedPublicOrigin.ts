export const PRODUCTION_PUBLIC_ORIGIN = "https://ikimon.life";
export const STAGING_PUBLIC_ORIGIN = "https://staging.ikimon.life";
export const RUNTIME_PUBLIC_ORIGIN_HEADER = "x-ikimon-runtime-public-origin";

const ALLOWED_PUBLIC_ORIGINS = new Set([
  PRODUCTION_PUBLIC_ORIGIN,
  STAGING_PUBLIC_ORIGIN,
]);

const PUBLIC_ORIGIN_BY_HOST = new Map([
  ["ikimon.life", PRODUCTION_PUBLIC_ORIGIN],
  ["www.ikimon.life", PRODUCTION_PUBLIC_ORIGIN],
  ["staging.ikimon.life", STAGING_PUBLIC_ORIGIN],
]);

export type PublicOriginRequest = {
  headers: Record<string, unknown>;
  protocol?: string;
};

function headerFirst(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? "").split(",")[0]?.trim() ?? "";
}

function normalizedHostname(value: unknown): string {
  const raw = headerFirst(value);
  if (!raw) return "";
  try {
    return new URL(`https://${raw}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeExplicitPublicOrigin(value: unknown): string {
  const normalized = String(value ?? "").trim().replace(/\/+$/, "");
  return ALLOWED_PUBLIC_ORIGINS.has(normalized) ? normalized : "";
}

export function publicOriginFromHost(value: unknown): string {
  return PUBLIC_ORIGIN_BY_HOST.get(normalizedHostname(value)) ?? "";
}

function localDevelopmentOrigin(request: PublicOriginRequest): string {
  const host = headerFirst(request.headers.host);
  const hostname = normalizedHostname(host);
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1") return "";
  const protocol = request.protocol === "https" ? "https" : "http";
  return `${protocol}://${host}`;
}

function runtimePublicOrigin(request: PublicOriginRequest): string {
  return normalizeExplicitPublicOrigin(request.headers[RUNTIME_PUBLIC_ORIGIN_HEADER]);
}

export function resolveTrustedPublicOrigin(
  request: PublicOriginRequest,
  options: {
    explicitOrigin?: unknown;
    allowLocalDevelopment?: boolean;
  } = {},
): string | null {
  const explicitOrigin = normalizeExplicitPublicOrigin(options.explicitOrigin);
  if (explicitOrigin) return explicitOrigin;

  // The origin runtime is bound to localhost and reached through nginx. nginx
  // overwrites this header with the server block's fixed public origin, so it
  // takes precedence over a client-controlled Host on the origin-facing hop.
  const boundRuntimeOrigin = runtimePublicOrigin(request);
  if (boundRuntimeOrigin) return boundRuntimeOrigin;

  // At the public Worker edge, the actual public Host remains authoritative.
  const directOrigin = publicOriginFromHost(request.headers.host);
  if (directOrigin) return directOrigin;

  if (options.allowLocalDevelopment) {
    const localOrigin = localDevelopmentOrigin(request);
    if (localOrigin) return localOrigin;
  }

  // Forwarded host and the legacy fallback marker are intentionally ignored.
  // They are ordinary HTTP headers and cannot establish a trust boundary when
  // the public origin IP is directly reachable.
  return null;
}
