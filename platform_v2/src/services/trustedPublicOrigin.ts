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

const LOCAL_DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type PublicOriginRequest = {
  headers: Record<string, unknown>;
  protocol?: string;
};

type ParsedHost = {
  raw: string;
  hostname: string;
  port: string;
};

function strictHeaderValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length === 1 ? strictHeaderValue(value[0]) : "";
  }
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized && !normalized.includes(",") ? normalized : "";
}

function parsedHost(value: unknown): ParsedHost | null {
  const raw = strictHeaderValue(value);
  if (!raw || /[\/\\?#@\s]/.test(raw)) return null;
  try {
    const parsed = new URL(`https://${raw}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return null;
    }
    return {
      raw,
      hostname: parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase(),
      port: parsed.port,
    };
  } catch {
    return null;
  }
}

export function normalizeExplicitPublicOrigin(value: unknown): string {
  const normalized = String(value ?? "").trim().replace(/\/+$/, "");
  return ALLOWED_PUBLIC_ORIGINS.has(normalized) ? normalized : "";
}

export function publicOriginFromHost(value: unknown): string {
  const parsed = parsedHost(value);
  if (!parsed || parsed.port) return "";
  return PUBLIC_ORIGIN_BY_HOST.get(parsed.hostname) ?? "";
}

function localDevelopmentOrigin(request: PublicOriginRequest): string {
  const parsed = parsedHost(request.headers.host);
  if (!parsed || !LOCAL_DEVELOPMENT_HOSTS.has(parsed.hostname)) return "";
  if (request.protocol !== "http" && request.protocol !== "https") return "";
  return `${request.protocol}://${parsed.raw}`;
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

  // Fastify binds to localhost. nginx overwrites this header with the fixed
  // identity of the selected production or staging server block before the
  // request reaches the runtime, so it overrides a client-controlled Host.
  const boundRuntimeOrigin = runtimePublicOrigin(request);
  if (boundRuntimeOrigin) return boundRuntimeOrigin;

  const directOrigin = publicOriginFromHost(request.headers.host);
  if (directOrigin) return directOrigin;

  if (options.allowLocalDevelopment) {
    const localOrigin = localDevelopmentOrigin(request);
    if (localOrigin) return localOrigin;
    throw new Error("public_origin_untrusted");
  }

  return null;
}

export function resolvePresentationPublicOrigin(
  request: PublicOriginRequest,
  options: {
    explicitOrigin?: unknown;
    allowLocalDevelopment?: boolean;
  } = {},
): string | null {
  try {
    return resolveTrustedPublicOrigin(request, options);
  } catch {
    return null;
  }
}
