import type { FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { getPool } from "../db.js";

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

function rateLimitKey(keyParts: string[]): string {
  return keyParts.map((part) => part.trim().toLowerCase()).join(":");
}

function rateLimitKeyHash(key: string): string {
  return createHash("sha256").update(key).digest("hex");
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

async function assertPostgresAuthRateLimit(keyParts: string[], maxAttempts: number, windowMs: number): Promise<void> {
  const key = rateLimitKey(keyParts);
  const scope = keyParts[0]?.trim().toLowerCase() || "auth";
  const keyHash = rateLimitKeyHash(key);
  const resetAt = new Date(Date.now() + windowMs).toISOString();
  const result = await getPool().query<{ attempts: number }>(
    `insert into auth_rate_limits (
        rate_limit_key_hash, key_scope, attempts, reset_at, updated_at
     ) values ($1, $2, 1, $3::timestamptz, now())
     on conflict (rate_limit_key_hash) do update set
        attempts = case
          when auth_rate_limits.reset_at <= now() then 1
          else auth_rate_limits.attempts + 1
        end,
        reset_at = case
          when auth_rate_limits.reset_at <= now() then excluded.reset_at
          else auth_rate_limits.reset_at
        end,
        updated_at = now()
     returning attempts`,
    [keyHash, scope, resetAt],
  );
  if ((result.rows[0]?.attempts ?? 0) > maxAttempts) {
    throw new Error("rate_limited");
  }
}

export async function assertAuthRateLimit(keyParts: string[], maxAttempts = 8, windowMs = 10 * 60 * 1000): Promise<void> {
  try {
    await assertPostgresAuthRateLimit(keyParts, maxAttempts, windowMs);
  } catch (error) {
    if (error instanceof Error && error.message === "rate_limited") {
      throw error;
    }
    assertMemoryAuthRateLimit(rateLimitKey(keyParts), maxAttempts, windowMs);
  }
}

export function resetAuthRateLimitForTests(): void {
  buckets.clear();
}
