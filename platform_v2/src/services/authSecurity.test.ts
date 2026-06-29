import assert from "node:assert/strict";
import test from "node:test";
import { assertAuthRateLimit, resetAuthRateLimitForTests, safeRedirectPath } from "./authSecurity.js";

test("safeRedirectPath accepts same-origin paths only", () => {
  assert.equal(safeRedirectPath("/record?x=1"), "/record?x=1");
  assert.equal(safeRedirectPath("https://evil.test/record"), "/record");
  assert.equal(safeRedirectPath("//evil.test/record"), "/record");
  assert.equal(safeRedirectPath("/\\evil"), "/record");
});

test("assertAuthRateLimit falls back safely when the shared store is unavailable", async () => {
  resetAuthRateLimitForTests();
  await assertAuthRateLimit(["test", "203.0.113.200"], 2, 60_000);
  await assertAuthRateLimit(["test", "203.0.113.200"], 2, 60_000);
  await assert.rejects(
    () => assertAuthRateLimit(["test", "203.0.113.200"], 2, 60_000),
    /rate_limited/,
  );
  resetAuthRateLimitForTests();
});
