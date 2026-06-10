import assert from "node:assert/strict";
import test from "node:test";
import { classifyPlaceFirstRecordState } from "./placeFirstRecordState.js";

test("place-first state keeps named subjects as present occurrences", () => {
  const policy = classifyPlaceFirstRecordState({
    subjectCount: 1,
    hasTaxonName: true,
    hasMedia: true,
  });

  assert.equal(policy.state, "present_occurrence");
  assert.equal(policy.publicSurface, "standard_card");
  assert.equal(policy.exportLane, "occurrence");
});

test("place-first state treats media without a subject as a place clue", () => {
  const policy = classifyPlaceFirstRecordState({
    hasMedia: true,
  });

  assert.equal(policy.state, "media_no_subject");
  assert.equal(policy.publicLabel, "場所の手がかり");
  assert.equal(policy.exportLane, "scene_visit");
  assert.ok(policy.blockers.includes("subject_not_detected_or_not_selected"));
});

test("place-first state does not upgrade absent status without denominator", () => {
  const policy = classifyPlaceFirstRecordState({
    occurrenceStatus: "absent",
    hasNote: true,
  });

  assert.equal(policy.state, "insufficient_coverage");
  assert.equal(policy.detectionSemantic, "insufficient_coverage");
  assert.equal(policy.exportLane, "not_export_ready");
  assert.ok(policy.blockers.includes("target_scope_effort_and_checklist_required"));
});

test("place-first state routes scoped non-detection to monitoring, not the public feed", () => {
  const policy = classifyPlaceFirstRecordState({
    occurrenceStatus: "absent",
    visitMode: "survey",
    completeChecklistFlag: true,
    targetTaxaScope: "frogs",
    effortMinutes: 15,
  });

  assert.equal(policy.state, "valid_non_detection");
  assert.equal(policy.detectionSemantic, "non_detection");
  assert.equal(policy.publicSurface, "hidden_from_public_feed");
  assert.equal(policy.ownerSurface, "non_detection");
  assert.equal(policy.monitoringSurface, "non_detection");
  assert.equal(policy.exportLane, "monitoring_non_detection");
});

test("place-first state keeps FieldScan summaries as scene/visit records", () => {
  const policy = classifyPlaceFirstRecordState({
    isFieldScanSession: true,
    hasMedia: true,
    effortMinutes: 10,
  });

  assert.equal(policy.state, "fieldscan_session_summary");
  assert.equal(policy.publicLabel, "場所のセッション");
  assert.equal(policy.exportLane, "scene_visit");
});
