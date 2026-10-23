export interface RateLimitStatement {
  bind(...values: (string | number | null)[]): RateLimitStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface RateLimitDatabase {
  prepare(sql: string): RateLimitStatement;
}

export type RateLimitInput = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export type RateLimitResult = { allowed: true; resetAt: number } | { allowed: false; resetAt: number };

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Atomic D1 fixed-window counter; only digests of caller identifiers are persisted. */
export async function consumeDurableRateLimit(db: RateLimitDatabase, input: RateLimitInput): Promise<RateLimitResult> {
  if (!input.scope.trim() || !input.key.trim() || !Number.isInteger(input.limit) || input.limit < 1
    || !Number.isFinite(input.windowMs) || input.windowMs < 1) {
    throw new Error("invalid_rate_limit");
  }
  const now = input.now ?? Date.now();
  const resetAt = now + input.windowMs;
  const bucketKey = await digest(`${input.scope.trim().toLowerCase()}\0${input.key.trim().toLowerCase()}`);
  const row = await db.prepare(
    `INSERT INTO durable_rate_limits (bucket_key, count, reset_at_ms)
     VALUES (?, 1, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET
       count = CASE WHEN durable_rate_limits.reset_at_ms <= ? THEN 1 ELSE durable_rate_limits.count + 1 END,
       reset_at_ms = CASE WHEN durable_rate_limits.reset_at_ms <= ? THEN excluded.reset_at_ms ELSE durable_rate_limits.reset_at_ms END
     WHERE durable_rate_limits.reset_at_ms <= ? OR durable_rate_limits.count < ?
     RETURNING reset_at_ms`
  ).bind(bucketKey, resetAt, now, now, now, input.limit).first<{ reset_at_ms: number }>();

  if (Math.random() < 1 / 128) {
    // Cleanup is opportunistic and bounded; enforcement never depends on it.
    await db.prepare(
      `DELETE FROM durable_rate_limits WHERE bucket_key IN
       (SELECT bucket_key FROM durable_rate_limits WHERE reset_at_ms <= ? ORDER BY reset_at_ms LIMIT 256)`
    ).bind(now - 24 * 60 * 60 * 1000).run().catch(() => undefined);
  }
  if (row) return { allowed: true, resetAt: row.reset_at_ms };
  const current = await db.prepare("SELECT reset_at_ms FROM durable_rate_limits WHERE bucket_key = ?")
    .bind(bucketKey).first<{ reset_at_ms: number }>();
  return { allowed: false, resetAt: current?.reset_at_ms ?? resetAt };
}

export function trustedClientIp(request: Request): string | null {
  const value = request.headers.get("cf-connecting-ip")?.trim();
  return value && !value.includes(",") ? value.toLowerCase() : null;
}
