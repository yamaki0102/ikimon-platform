export const PRODUCTION_PUBLIC_ORIGIN = "https://ikimon.life";
export const STAGING_PUBLIC_ORIGIN = "https://staging.ikimon.life";

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

function hasTrustedWorkerFallbackMarker(request: PublicOriginRequest): boolean {
  return headerFirst(request.headers["x-ikimon-cloudflare-fallback"]).toLowerCase() === "origin";
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

  // A public or local Host is authoritative. Forwarded host is accepted only
  // on the Worker-owned fallback hop, where the Worker overwrites both the
  // marker and X-Forwarded-Host from the public request URL.
  const directOrigin = publicOriginFromHost(request.headers.host);
  if (directOrigin) return directOrigin;

  if (options.allowLocalDevelopment) {
    const localOrigin = localDevelopmentOrigin(request);
    if (localOrigin) return localOrigin;
  }

  if (!hasTrustedWorkerFallbackMarker(request)) return null;
  const forwardedOrigin = publicOriginFromHost(request.headers["x-forwarded-host"]);
  return forwardedOrigin || null;
}
