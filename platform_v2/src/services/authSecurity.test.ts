import assert from "node:assert/strict";
import test from "node:test";
import { safeRedirectPath } from "./authSecurity.js";

test("safeRedirectPath accepts same-origin paths only", () => {
  assert.equal(safeRedirectPath("/record?x=1"), "/record?x=1");
  assert.equal(safeRedirectPath("https://evil.test/record"), "/record");
  assert.equal(safeRedirectPath("//evil.test/record"), "/record");
  assert.equal(safeRedirectPath("/\\evil"), "/record");
});
