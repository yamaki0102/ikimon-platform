import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveDetectionSemantic,
  detectionClaimBoundary,
  detectionSemanticAllowsNoDetectionClaim,
  detectionSemanticDataGapReasons,
  hasDetectionDenominator,
} from "./absenceSemantics.js";

test("absence semantics keep absent status from becoming non-detection without a denominator", () => {
  const semantic = deriveDetectionSemantic({
    occurrenceStatus: "absent",
    effortMinutes: null,
    targetTaxaScope: null,
    completeChecklistFlag: false,
  });

  assert.equal(semantic, "insufficient_coverage");
  assert.equal(detectionSemanticAllowsNoDetectionClaim(semantic), false);
  assert.ok(detectionSemanticDataGapReasons(semantic).includes("non_detection_requires_effort_target_scope_and_complete_checklist"));
});

test("absence semantics promote only scoped effort to non-detection", () => {
  const input = {
    occurrenceStatus: "absent",
    effortMinutes: 12,
    targetTaxaScope: "birds",
    completeChecklistFlag: true,
  };

  assert.equal(hasDetectionDenominator(input), true);
  assert.equal(deriveDetectionSemantic(input), "non_detection");
  assert.equal(detectionSemanticAllowsNoDetectionClaim("non_detection"), true);
  assert.match(detectionClaimBoundary("non_detection"), /不在証明ではありません/);
});

test("absence semantics reserve absence for reviewed scoped records", () => {
  const semantic = deriveDetectionSemantic({
    occurrenceStatuses: ["absent"],
    effortMinutes: 25,
    targetTaxaScope: "plants",
    completeChecklistFlag: true,
    reviewStatus: "verified",
  });

  assert.equal(semantic, "absence");
  assert.equal(detectionSemanticAllowsNoDetectionClaim(semantic), true);
});

test("absence semantics treat present records as not evaluated for non-detection", () => {
  assert.equal(deriveDetectionSemantic({
    occurrenceStatus: "present",
    effortMinutes: 10,
    targetTaxaScope: "plants",
    completeChecklistFlag: true,
  }), "not_evaluated");
});
