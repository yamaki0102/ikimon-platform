export function normalizeBasePath(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "/") {
    return "";
  }
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

export function getForwardedBasePath(headers: Record<string, unknown>): string {
  const raw = headers["x-forwarded-prefix"];
  if (Array.isArray(raw)) {
    return normalizeBasePath(raw[0]);
  }
  return normalizeBasePath(typeof raw === "string" ? raw : "");
}

export function withBasePath(basePath: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!basePath) {
    return normalizedPath;
  }
  return `${basePath}${normalizedPath}`;
}
