export function normalizeBasePath(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "/") {
    return "";
  }
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function configuredBasePath(): string {
  if (typeof process === "undefined") {
    return "";
  }

  const explicit = normalizeBasePath(process.env.APP_BASE_PATH);
  if (process.env.APP_BASE_PATH !== undefined) {
    return explicit;
  }

  // Default is "" (root). Set APP_BASE_PATH=/v2 only when proxied under /v2/.
  // After staging cutover (v2 -> / on staging.ikimon.life), no prefix is required.
  return "";
}

export function getForwardedBasePath(headers: Record<string, unknown>): string {
  const raw = headers["x-forwarded-prefix"];
  if (Array.isArray(raw)) {
    return normalizeBasePath(raw[0]) || configuredBasePath();
  }
  return normalizeBasePath(typeof raw === "string" ? raw : "") || configuredBasePath();
}

export function withBasePath(basePath: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!basePath) {
    return normalizedPath;
  }
  return `${basePath}${normalizedPath}`;
}
