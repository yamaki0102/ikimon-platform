import assert from "node:assert/strict";
import test from "node:test";
import {
  FRONTEND_FOUNDATION_CSS,
  FRONTEND_FOUNDATION_PATTERNS,
  FRONTEND_FOUNDATION_V1,
} from "./frontendFoundation.js";

test("frontend foundation exposes bounded v1 tokens", () => {
  assert.equal(FRONTEND_FOUNDATION_V1.version, "1.1.0");
  assert.equal(FRONTEND_FOUNDATION_V1.motion.fast, "160ms");
  assert.equal(FRONTEND_FOUNDATION_V1.motion.normal, "220ms");
  assert.equal(FRONTEND_FOUNDATION_V1.motion.slow, "320ms");
  assert.equal(FRONTEND_FOUNDATION_V1.spacing.md, "12px");
  assert.equal(FRONTEND_FOUNDATION_V1.spacing.xl, "24px");
  assert.equal(FRONTEND_FOUNDATION_V1.tapTarget, "44px");
});

test("frontend foundation keeps the initial pattern set intentionally small", () => {
  assert.equal(FRONTEND_FOUNDATION_PATTERNS.length, 15);
  assert.ok(FRONTEND_FOUNDATION_PATTERNS.includes("async-action"));
  assert.ok(FRONTEND_FOUNDATION_PATTERNS.includes("confirmation"));
});

test("frontend foundation includes focus, spacing and reduced-motion safeguards", () => {
  assert.match(FRONTEND_FOUNDATION_CSS, /:focus-visible/);
  assert.match(FRONTEND_FOUNDATION_CSS, /prefers-reduced-motion: reduce/);
  assert.match(FRONTEND_FOUNDATION_CSS, /--ik-motion-fast/);
  assert.match(FRONTEND_FOUNDATION_CSS, /--ik-radius-md/);
  assert.match(FRONTEND_FOUNDATION_CSS, /--ik-space-md: 12px/);
});
