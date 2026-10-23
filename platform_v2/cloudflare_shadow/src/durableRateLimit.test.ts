import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { consumeDurableRateLimit, trustedClientIp, type RateLimitDatabase } from "./durableRateLimit.js";

function database(): RateLimitDatabase & { sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/core/0024_durable_rate_limits.sql", import.meta.url), "utf8"));
  return {
    sqlite,
    prepare(sql) {
      let values: (string | number | null)[] = [];
      return {
        bind(...bound) { values = bound; return this; },
        async first<T>() { return (sqlite.prepare(sql).get(...values) as T | undefined) ?? null; },
        async run() { return sqlite.prepare(sql).run(...values); }
      };
    }
  };
}

test("durable rate limiter enforces cap atomically and resets after expiry", async () => {
  const db = database();
  const input = { scope: "login-ip", key: "203.0.113.8", limit: 2, windowMs: 60_000, now: 1_000 };
  assert.equal((await consumeDurableRateLimit(db, input)).allowed, true);
  assert.equal((await consumeDurableRateLimit(db, input)).allowed, true);
  const denied = await consumeDurableRateLimit(db, input);
  assert.equal(denied.allowed, false);
  if (!denied.allowed) assert.equal(denied.resetAt, 61_000);
  assert.equal((await consumeDurableRateLimit(db, { ...input, now: 61_000 })).allowed, true);
});

test("normalizes scope and key, separates scopes, and stores no raw identifier", async () => {
  const db = database();
  await consumeDurableRateLimit(db, { scope: " Login-IP ", key: " A@Example.test ", limit: 1, windowMs: 1000, now: 1 });
  assert.equal((await consumeDurableRateLimit(db, { scope: "login-ip", key: "a@example.test", limit: 1, windowMs: 1000, now: 2 })).allowed, false);
  assert.equal((await consumeDurableRateLimit(db, { scope: "login-email", key: "a@example.test", limit: 1, windowMs: 1000, now: 2 })).allowed, true);
  const row = db.sqlite.prepare("SELECT bucket_key FROM durable_rate_limits WHERE bucket_key = ?")
    .get(createHash("sha256").update("login-ip\0a@example.test").digest("hex")) as { bucket_key: string } | undefined;
  assert.ok(row);
  assert.equal(JSON.stringify(row).includes("example.test"), false);
});

test("rate limiter propagates D1 errors so callers can fail closed", async () => {
  const db: RateLimitDatabase = { prepare() { throw new Error("D1 unavailable"); } };
  await assert.rejects(() => consumeDurableRateLimit(db, { scope: "post", key: "user", limit: 3, windowMs: 1000 }), /D1 unavailable/);
});

test("trusted client IP uses only a single Cloudflare connecting-IP value", () => {
  assert.equal(trustedClientIp(new Request("https://zukan.test", { headers: { "cf-connecting-ip": "203.0.113.9" } })), "203.0.113.9");
  assert.equal(trustedClientIp(new Request("https://zukan.test", { headers: { "x-forwarded-for": "203.0.113.9" } })), null);
  assert.equal(trustedClientIp(new Request("https://zukan.test", { headers: { "cf-connecting-ip": "203.0.113.9, 10.0.0.1" } })), null);
});
