import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeInvasiveResponseFromRaw,
  normalizeNoveltyHintFromRaw,
  normalizeSizeAssessmentFromRaw,
  pickParsedFromRawJson,
} from "./observationAiAssessment.js";

test("pickParsedFromRawJson reads { raw, parsed } envelope", () => {
  const out = pickParsedFromRawJson({ raw: "...", parsed: { size_assessment: { typical_size_cm: 5 } } });
  assert.ok(out);
  assert.deepEqual((out as Record<string, unknown>).size_assessment, { typical_size_cm: 5 });
});

test("pickParsedFromRawJson falls back to top-level when parsed missing", () => {
  const out = pickParsedFromRawJson({ size_assessment: { typical_size_cm: 5 } });
  assert.ok(out);
});

test("pickParsedFromRawJson returns null for legacy raw_json without lens fields", () => {
  const out = pickParsedFromRawJson({ raw: "...", other: 1 });
  assert.equal(out, null);
});

test("normalizeNoveltyHintFromRaw drops scores below 0.5", () => {
  assert.equal(normalizeNoveltyHintFromRaw({ is_potentially_novel: true, novelty_score: 0.3 }), null);
  assert.equal(normalizeNoveltyHintFromRaw({ is_potentially_novel: false, novelty_score: 0.9 }), null);
});

test("normalizeNoveltyHintFromRaw keeps high-confidence with hedge fallback", () => {
  const out = normalizeNoveltyHintFromRaw({ is_potentially_novel: true, novelty_score: 0.7, reasoning: "形態が独特" });
  assert.ok(out);
  assert.equal(out!.noveltyScore, 0.7);
  assert.match(out!.hedge, /AI/);
});

test("normalizeInvasiveResponseFromRaw drops is_invasive=false", () => {
  assert.equal(normalizeInvasiveResponseFromRaw({ is_invasive: false }), null);
});

test("normalizeInvasiveResponseFromRaw validates enum values", () => {
  const out = normalizeInvasiveResponseFromRaw({
    is_invasive: true,
    mhlw_category: "priority",
    recommended_action: "observe_and_report",
    action_basis: "重点対策外来種",
    legal_warning: "",
    regional_caveat: "",
    hedge: "",
  });
  assert.ok(out);
  assert.equal(out!.mhlwCategory, "priority");
  assert.equal(out!.recommendedAction, "observe_and_report");
});

test("normalizeInvasiveResponseFromRaw rejects unknown enum values", () => {
  const out = normalizeInvasiveResponseFromRaw({
    is_invasive: true,
    mhlw_category: "garbage",
    recommended_action: "delete_species",
    action_basis: "",
    legal_warning: "",
    regional_caveat: "",
    hedge: "",
  });
  assert.ok(out);
  assert.equal(out!.mhlwCategory, null);
  assert.equal(out!.recommendedAction, null);
});

test("normalizeSizeAssessmentFromRaw returns null when all fields empty", () => {
  assert.equal(normalizeSizeAssessmentFromRaw({}), null);
});

test("normalizeSizeAssessmentFromRaw passes basic fields", () => {
  const out = normalizeSizeAssessmentFromRaw({
    typical_size_cm: 12.5,
    observed_size_estimate_cm: 28,
    size_class: "large",
    ranking_hint: "大きい部類",
    basis: "手指から推定",
    hedge: "AI推定",
  });
  assert.ok(out);
  assert.equal(out!.sizeClass, "large");
  assert.equal(out!.observedSizeEstimateCm, 28);
});

test("normalizeSizeAssessmentFromRaw rejects invalid size_class", () => {
  const out = normalizeSizeAssessmentFromRaw({ typical_size_cm: 5, size_class: "huge" });
  assert.ok(out);
  assert.equal(out!.sizeClass, null);
});
