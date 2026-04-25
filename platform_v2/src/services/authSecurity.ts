import type { FastifyRequest } from "fastify";

type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();

function headerFirst(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim() ?? "";
}

function expectedOrigin(request: FastifyRequest): string | null {
  const host = headerFirst(request.headers["x-forwarded-host"]) || headerFirst(request.headers.host);
  if (!host) {
    return null;
  }
  const proto = headerFirst(request.headers["x-forwarded-proto"]) || (request.protocol || "http");
  return `${proto}://${host}`;
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function safeRedirectPath(value: unknown, fallback = "/record"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return fallback;
  }
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("\u0000")) {
    return fallback;
  }
  try {
    const parsed = new URL(raw, "https://ikimon.local");
    if (parsed.origin !== "https://ikimon.local") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function assertSameOriginRequest(request: FastifyRequest): void {
  const secFetchSite = headerFirst(request.headers["sec-fetch-site"]).toLowerCase();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    throw new Error("same_origin_required");
  }

  const origin = headerFirst(request.headers.origin);
  if (!origin) {
    return;
  }

  const expected = expectedOrigin(request);
  if (!expected) {
    throw new Error("same_origin_required");
  }

  let incoming: URL;
  let expectedUrl: URL;
  try {
    incoming = new URL(origin);
    expectedUrl = new URL(expected);
  } catch {
    throw new Error("same_origin_required");
  }

  if (incoming.protocol !== expectedUrl.protocol || incoming.host !== expectedUrl.host) {
    throw new Error("same_origin_required");
  }
}

export function assertAuthRateLimit(keyParts: string[], maxAttempts = 8, windowMs = 10 * 60 * 1000): void {
  const now = Date.now();
  const key = keyParts.map((part) => part.trim().toLowerCase()).join(":");
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > maxAttempts) {
    throw new Error("rate_limited");
  }
}

export function resetAuthRateLimitForTests(): void {
  buckets.clear();
}
