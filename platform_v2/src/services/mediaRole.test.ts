import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIA_ROLE_VALUES, deriveMediaRoleSuggestion, normalizeMediaRole } from "./mediaRole.js";

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

test("suggests primary_subject from confident primary regions without changing saved role", () => {
  const suggestion = deriveMediaRoleSuggestion({
    mediaType: "image",
    primaryRegionConfidence: 0.82,
    secondaryCandidateConfidence: 0.91,
    totalMediaCount: 3,
  });

  assert.equal(suggestion.suggestedMediaRole, "primary_subject");
  assert.equal(suggestion.suggestedMediaRoleConfidence, 0.82);
  assert.equal(suggestion.suggestedMediaRoleSource, "ai_region");
});

test("suggests secondary_candidate from confident candidate evidence", () => {
  const suggestion = deriveMediaRoleSuggestion({
    mediaType: "image",
    primaryRegionConfidence: 0.49,
    secondaryCandidateConfidence: 0.68,
    totalMediaCount: 2,
  });

  assert.equal(suggestion.suggestedMediaRole, "secondary_candidate");
  assert.equal(suggestion.suggestedMediaRoleConfidence, 0.68);
  assert.equal(suggestion.suggestedMediaRoleSource, "ai_candidate");
});

test("suggests video as sound_motion and auxiliary photos as context", () => {
  assert.equal(deriveMediaRoleSuggestion({ mediaType: "video" }).suggestedMediaRole, "sound_motion");
  assert.equal(
    deriveMediaRoleSuggestion({
      mediaType: "image",
      primaryRegionConfidence: null,
      secondaryCandidateConfidence: null,
      totalMediaCount: 2,
    }).suggestedMediaRole,
    "context",
  );
});
