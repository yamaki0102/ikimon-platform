const PUBLIC_HOST_ROOTS = ["zukan.earth", "ikimon.life"] as const;
const PRODUCTION_HOSTS = new Set(["zukan.earth", "ikimon.life", "www.ikimon.life"]);

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

export function isCanonicalOrLegacyPublicHost(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return PUBLIC_HOST_ROOTS.some((root) => normalized === root || normalized.endsWith(`.${root}`));
}

export function isCanonicalOrLegacyProductionHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.has(normalizeHostname(hostname));
}

export function isCanonicalOrLegacyHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:"
      && parsed.username === ""
      && parsed.password === ""
      && isCanonicalOrLegacyPublicHost(parsed.hostname);
  } catch {
    return false;
  }
}
