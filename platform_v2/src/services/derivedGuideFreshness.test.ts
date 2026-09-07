import assert from "node:assert/strict";
import test from "node:test";
import { DERIVED_GUIDE_FRESHNESS_SCHEMA, assessDerivedGuideFreshness, type DerivedGuideFreshnessInput } from "./derivedGuideFreshness.js";

const input = (overrides: Partial<DerivedGuideFreshnessInput> = {}): DerivedGuideFreshnessInput => ({
  source: { sourceId: "place-1", sourceVersion: "public-v3", visibility: "PUBLIC", approved: true },
  derivative: { sourceId: "place-1", sourceVersion: "public-v3", language: "ja", format: "EASY_JAPANESE", visibility: "PUBLIC" },
  ...overrides,
});

test("marks multilingual/easy-Japanese/audio metadata current when bound to the current public source", () => {
  assert.deepEqual(assessDerivedGuideFreshness(input()), { schema: DERIVED_GUIDE_FRESHNESS_SCHEMA, status: "CURRENT", reason: "CURRENT_SOURCE_VERSION", sourceId: "place-1", sourceVersion: "public-v3", derivative: { language: "ja", format: "EASY_JAPANESE" }, publication: "NOT_DECIDED" });
  assert.equal(assessDerivedGuideFreshness(input({ derivative: { ...input().derivative, language: "en", format: "AUDIO" } })).status, "CURRENT");
});
test("invalidates a derivative when the canonical public source version changes", () => {
  assert.equal(assessDerivedGuideFreshness(input({ derivative: { ...input().derivative, sourceVersion: "public-v2" } })).reason, "SOURCE_VERSION_CHANGED");
  assert.equal(assessDerivedGuideFreshness(input({ derivative: { ...input().derivative, sourceVersion: "public-v2" } })).status, "STALE");
});
test("refuses private or unapproved material and mismatched source identity", () => {
  assert.equal(assessDerivedGuideFreshness(input({ source: { ...input().source, visibility: "PRIVATE" } })).reason, "PRIVATE_SOURCE_FORBIDDEN");
  assert.equal(assessDerivedGuideFreshness(input({ source: { ...input().source, approved: false } })).reason, "UNAPPROVED_SOURCE");
  assert.equal(assessDerivedGuideFreshness(input({ derivative: { ...input().derivative, sourceId: "other-place" } })).reason, "SOURCE_MISMATCH");
});
test("keeps publication outside the freshness decision", () => {
  const result = assessDerivedGuideFreshness(input());
  assert.equal(result.publication, "NOT_DECIDED");
  assert.equal("publish" in result, false);
});
