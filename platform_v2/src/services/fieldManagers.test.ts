import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./fieldManagers.js";

const { isFieldManagerRole } = __test__;

test("isFieldManagerRole accepts the three documented roles only", () => {
  assert.equal(isFieldManagerRole("owner"), true);
  assert.equal(isFieldManagerRole("steward"), true);
  assert.equal(isFieldManagerRole("viewer_exact"), true);
  assert.equal(isFieldManagerRole("admin"), false);
  assert.equal(isFieldManagerRole(""), false);
  assert.equal(isFieldManagerRole(null), false);
  assert.equal(isFieldManagerRole(undefined), false);
});
