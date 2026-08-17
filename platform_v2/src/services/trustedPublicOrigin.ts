export const PRODUCTION_PUBLIC_ORIGIN = "https://zukan.earth";
export const STAGING_PUBLIC_ORIGIN = "https://staging.zukan.earth";
export const RUNTIME_PUBLIC_ORIGIN_HEADER = "x-ikimon-runtime-public-origin";

export const PRODUCTION_PUBLIC_HOSTS = new Set([
  "zukan.earth",
  "www.zukan.earth",
  "ikimon.life",
  "www.ikimon.life",
]);

export const STAGING_PUBLIC_HOSTS = new Set([
  "staging.zukan.earth",
  "staging.ikimon.life",
]);

export const LEGACY_PRODUCTION_PUBLIC_ORIGINS = Object.freeze([
  "https://ikimon.life",
  "https://www.ikimon.life",
]);

export const LEGACY_STAGING_PUBLIC_ORIGINS = Object.freeze([
  "https://staging.ikimon.life",
]);

const ALLOWED_PUBLIC_ORIGINS = new Set([
  PRODUCTION_PUBLIC_ORIGIN,
  STAGING_PUBLIC_ORIGIN,
]);

const PUBLIC_ORIGIN_BY_HOST = new Map([
  ["zukan.earth", PRODUCTION_PUBLIC_ORIGIN],
  ["www.zukan.earth", PRODUCTION_PUBLIC_ORIGIN],
  ["staging.zukan.earth", STAGING_PUBLIC_ORIGIN],
  ["ikimon.life", PRODUCTION_PUBLIC_ORIGIN],
  ["www.ikimon.life", PRODUCTION_PUBLIC_ORIGIN],
  ["staging.ikimon.life", STAGING_PUBLIC_ORIGIN],
]);

const PUBLIC_ORIGIN_ALIASES = new Map([
  [PRODUCTION_PUBLIC_ORIGIN, PRODUCTION_PUBLIC_ORIGIN],
  ["https://www.zukan.earth", PRODUCTION_PUBLIC_ORIGIN],
  ["https://ikimon.life", PRODUCTION_PUBLIC_ORIGIN],
  ["https://www.ikimon.life", PRODUCTION_PUBLIC_ORIGIN],
  [STAGING_PUBLIC_ORIGIN, STAGING_PUBLIC_ORIGIN],
  ["https://staging.ikimon.life", STAGING_PUBLIC_ORIGIN],
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
  return PUBLIC_ORIGIN_ALIASES.get(normalized) ?? "";
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
  // Fastify binds to localhost. nginx overwrites this header with the fixed
  // identity of the selected production or staging server block before the
  // request reaches the runtime. Runtime identity therefore outranks static
  // config and a client-controlled Host, preventing cross-environment drift.
  const boundRuntimeOrigin = runtimePublicOrigin(request);
  if (boundRuntimeOrigin) return boundRuntimeOrigin;

  const explicitOrigin = normalizeExplicitPublicOrigin(options.explicitOrigin);
  if (explicitOrigin) return explicitOrigin;

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
