import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIA_ROLE_VALUES, normalizeMediaRole } from "./mediaRole.js";

test("keeps supported media roles", () => {
  for (const role of MEDIA_ROLE_VALUES) {
    assert.equal(normalizeMediaRole(role), role);
  }
});

test("falls back to primary_subject for missing or unsupported media roles", () => {
  assert.equal(normalizeMediaRole(null), "primary_subject");
  assert.equal(normalizeMediaRole(undefined), "primary_subject");
  assert.equal(normalizeMediaRole(""), "primary_subject");
  assert.equal(normalizeMediaRole("unknown"), "primary_subject");
});
