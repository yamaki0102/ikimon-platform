import type { FastifyRequest } from "fastify";
import { normalizeExplicitPublicOrigin, resolveTrustedPublicOrigin } from "./trustedPublicOrigin.js";

type RateBucket = {
  count: number;
  resetAt: number;
};

type HttpError = Error & { statusCode: number };

const buckets = new Map<string, RateBucket>();

function strictHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value.length === 1 ? strictHeaderValue(value[0]) : null;
  }
  if (value === undefined) return "";
  const normalized = value.trim();
  return normalized.includes(",") ? null : normalized;
}

function expectedOrigin(request: FastifyRequest): string | null {
  try {
    return resolveTrustedPublicOrigin(
      request as unknown as { headers: Record<string, unknown>; protocol?: string },
      { allowLocalDevelopment: process.env.NODE_ENV !== "production" },
    );
  } catch {
    return null;
  }
}

function sameOriginError(): HttpError {
  const error = new Error("same_origin_required") as HttpError;
  error.statusCode = 403;
  return error;
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
  const secFetchSiteValue = strictHeaderValue(request.headers["sec-fetch-site"]);
  if (secFetchSiteValue === null) {
    throw sameOriginError();
  }
  const secFetchSite = secFetchSiteValue.toLowerCase();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    throw sameOriginError();
  }

  const origin = strictHeaderValue(request.headers.origin);
  if (origin === null) {
    throw sameOriginError();
  }
  if (!origin) {
    return;
  }

  const expected = expectedOrigin(request);
  if (!expected) {
    throw sameOriginError();
  }

  let incoming: URL;
  let expectedUrl: URL;
  try {
    incoming = new URL(origin);
    expectedUrl = new URL(expected);
  } catch {
    throw sameOriginError();
  }

  const incomingCanonical = normalizeExplicitPublicOrigin(incoming.origin) || incoming.origin;
  const expectedCanonical = normalizeExplicitPublicOrigin(expectedUrl.origin) || expectedUrl.origin;
  if (incomingCanonical !== expectedCanonical) {
    throw sameOriginError();
  }
}

function rateLimitKey(keyParts: string[]): string {
  return keyParts.map((part) => part.trim().toLowerCase()).join(":");
}

function assertMemoryAuthRateLimit(key: string, maxAttempts: number, windowMs: number): void {
  const now = Date.now();
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

export async function assertAuthRateLimit(keyParts: string[], maxAttempts = 8, windowMs = 10 * 60 * 1000): Promise<void> {
  assertMemoryAuthRateLimit(rateLimitKey(keyParts), maxAttempts, windowMs);
}

export function resetAuthRateLimitForTests(): void {
  buckets.clear();
}
