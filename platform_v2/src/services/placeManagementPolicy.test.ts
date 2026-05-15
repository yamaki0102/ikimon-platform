import assert from "node:assert/strict";
import test from "node:test";

import { normalizePlaceManagementPolicyInput } from "./placeManagementPolicy.js";

test("place management policy input is bounded for field advice", () => {
  const policy = normalizePlaceManagementPolicyInput({
    managementGoal: "invasive_watch",
    weedTolerance: "high",
    invasiveResponse: "controlled_removal",
    mowingFrequency: "seasonal",
    notes: `  花壇脇は残す\n\n通路は短くする  ${"x".repeat(800)}`,
  });

  assert.equal(policy.managementGoal, "invasive_watch");
  assert.equal(policy.weedTolerance, "high");
  assert.equal(policy.invasiveResponse, "controlled_removal");
  assert.equal(policy.mowingFrequency, "seasonal");
  assert.ok(policy.notes.length <= 600);
  assert.doesNotMatch(policy.notes, /\n/);
});

test("invalid policy enums fall back to conservative defaults", () => {
  const policy = normalizePlaceManagementPolicyInput({
    managementGoal: "remove_everything",
    weedTolerance: "zero",
    invasiveResponse: "dump_elsewhere",
    mowingFrequency: "daily",
  });

  assert.equal(policy.managementGoal, "balanced");
  assert.equal(policy.weedTolerance, "medium");
  assert.equal(policy.invasiveResponse, "ask_first");
  assert.equal(policy.mowingFrequency, "as_needed");
});
