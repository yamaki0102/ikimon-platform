import assert from "node:assert/strict";
import test from "node:test";
import { resolveLandingDisplayName } from "./landingSnapshot.js";

test("resolveLandingDisplayName ignores unresolved placeholders and uses identification fallback", () => {
  assert.equal(resolveLandingDisplayName("Unresolved", "モンシロチョウ", null), "モンシロチョウ");
  assert.equal(resolveLandingDisplayName("同定待ち", "Awaiting ID", "AI候補の花"), "AI候補の花");
  assert.equal(resolveLandingDisplayName("", null, null), "同定待ち");
});
