import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKubiakaFeedbackProjection,
  contributorStateForKubiaka,
  selectKubiakaContinuation,
  summarizeKubiakaEvidenceCoverage,
  type KubiakaEvidenceCoverageItem,
} from "./kubiakaReadModels.js";

function coverage(
  role: KubiakaEvidenceCoverageItem["role"],
  status: KubiakaEvidenceCoverageItem["status"] = "visible",
  limitations: readonly string[] = [],
): KubiakaEvidenceCoverageItem {
  return {
    role,
    status,
    sourceAssetIds: [`asset-${role}`],
    confidence: 0.9,
    assessor: "ai",
    limitations,
  };
}


test("internal workflow states remain distinct while contributor copy uses a smaller vocabulary", () => {
  assert.equal(contributorStateForKubiaka("saved"), "received");
  assert.equal(contributorStateForKubiaka("assessment_in_progress"), "checking");
  assert.equal(contributorStateForKubiaka("feedback_ready"), "feedback_ready");
  assert.equal(contributorStateForKubiaka("specialist_review_requested"), "specialist_checking");
  assert.equal(contributorStateForKubiaka("recipient_shared"), "shared");
  assert.equal(contributorStateForKubiaka("recipient_acknowledged"), "acknowledged");
});


test("member continuation prioritizes feedback, more evidence, checking, revisit, then first record", () => {
  assert.deepEqual(selectKubiakaContinuation({
    unreadFeedbackRecordIds: ["record-feedback"],
    moreEvidenceRecordIds: ["record-more"],
    checkingRecordIds: ["record-checking"],
    comparablePlaceIds: ["place-1"],
    recordCount: 3,
  }), { kind: "feedback", recordId: "record-feedback", placeId: null });

  assert.deepEqual(selectKubiakaContinuation({
    moreEvidenceRecordIds: ["record-more"],
    checkingRecordIds: ["record-checking"],
    comparablePlaceIds: ["place-1"],
  }), { kind: "more_evidence", recordId: "record-more", placeId: null });

  assert.deepEqual(selectKubiakaContinuation({ comparablePlaceIds: ["place-1"] }), {
    kind: "revisit",
    recordId: null,
    placeId: "place-1",
  });

  assert.deepEqual(selectKubiakaContinuation({ recordCount: 0 }), {
    kind: "first_record",
    recordId: null,
    placeId: null,
  });
});


test("free-form photos may support photo-scope feedback but never become survey non-detection without effort and protocol", () => {
  const items = [coverage("whole_tree"), coverage("trunk"), coverage("base")];
  const casual = summarizeKubiakaEvidenceCoverage({ photoCount: 3, items });
  assert.equal(casual.usability, "screenable_record");
  assert.equal(casual.canStatePhotoScopeNoClearSign, true);
  assert.equal(casual.canStateSurveyNonDetection, false);
  assert.ok(casual.limitations.includes("sampling_effort_not_reported"));
  assert.ok(casual.limitations.includes("protocol_not_satisfied"));

  const survey = summarizeKubiakaEvidenceCoverage({
    photoCount: 3,
    items,
    effortReported: true,
    protocolSatisfied: true,
  });
  assert.equal(survey.usability, "survey_usable");
  assert.equal(survey.canStateSurveyNonDetection, true);
});


test("a useful close-up stays screenable without supporting a broad no-clear-sign statement", () => {
  const summary = summarizeKubiakaEvidenceCoverage({
    photoCount: 1,
    items: [coverage("adult_detail")],
  });
  assert.equal(summary.usability, "screenable_record");
  assert.equal(summary.canStatePhotoScopeNoClearSign, false);
  assert.deepEqual(summary.missingCoreRoles, ["base", "trunk", "whole_tree"]);
});


test("a broad context photo remains a valid photo record even when it is not yet screenable", () => {
  const summary = summarizeKubiakaEvidenceCoverage({
    photoCount: 1,
    items: [coverage("surroundings")],
  });
  assert.equal(summary.usability, "photo_record");
  assert.equal(summary.canStatePhotoScopeNoClearSign, false);
  assert.equal(summary.canStateSurveyNonDetection, false);
});


test("feedback projection exposes photo scope rather than absence for normal records", () => {
  const feedback = buildKubiakaFeedbackProjection({
    photoCount: 4,
    coverageItems: [
      coverage("whole_tree"),
      coverage("trunk"),
      coverage("base", "partial", ["base_partly_shadowed"]),
    ],
    finding: "no_clear_sign_in_visible_scope",
    authority: "automated",
    previousComparison: "no_material_change",
  });

  assert.equal(feedback.nonDetectionScope, "photo_scope");
  assert.equal(feedback.coverage.canStateSurveyNonDetection, false);
  assert.ok(feedback.limitations.includes("base_partly_shadowed"));
  assert.deepEqual(feedback.nextActions, ["revisit_same_place", "record_another_place", "finish_for_now"]);
});


test("candidate feedback waits for specialist without claiming specialist authority", () => {
  const feedback = buildKubiakaFeedbackProjection({
    photoCount: 2,
    coverageItems: [coverage("frass"), coverage("base")],
    finding: "frass_candidate",
    authority: "automated",
  });

  assert.equal(feedback.finding, "frass_candidate");
  assert.equal(feedback.authority, "automated");
  assert.equal(feedback.nonDetectionScope, null);
  assert.deepEqual(feedback.nextActions, ["wait_for_specialist", "add_photos", "finish_for_now"]);
});
