import assert from "node:assert/strict";
import test from "node:test";
import {
  projectKubiakaAreaCoverage,
  type KubiakaAreaCoverageInput,
} from "./kubiakaAreaCoverage.js";

const target: KubiakaAreaCoverageInput["target"] = {
  minimumSurveyUsableRecords: 4,
  minimumUniqueSurveyDays: 3,
  minimumRepeatObservedUnits: 2,
  agingAfterDays: 30,
  revisitAfterDays: 60,
  minimumKnownTargetCoverageRatio: 0.6,
};

function baseInput(overrides: Partial<KubiakaAreaCoverageInput> = {}): KubiakaAreaCoverageInput {
  return {
    recordCount: 0,
    photoCount: 0,
    screenableRecordCount: 0,
    surveyUsableRecordCount: 0,
    uniqueSurveyDays: 0,
    uniqueObservedUnits: 0,
    repeatObservedUnits: 0,
    lastObservedAt: null,
    lastSurveyUsableAt: null,
    asOf: "2026-07-29T00:00:00.000Z",
    publicMinRecords: 3,
    target,
    denominator: null,
    ...overrides,
  };
}

test("an empty aggregate cell says only that no records exist", () => {
  const projection = projectKubiakaAreaCoverage(baseInput());

  assert.equal(projection.publicState, "no_observations");
  assert.equal(projection.level, "none");
  assert.equal(projection.targetMet, false);
  assert.equal(projection.claimBoundary, "monitoring_effort_not_species_absence");
  assert.deepEqual(projection.nextNeeds, ["first_record"]);
});

test("small non-zero cells remain privacy suppressed even when internal criteria are strong", () => {
  const projection = projectKubiakaAreaCoverage(baseInput({
    recordCount: 2,
    photoCount: 10,
    screenableRecordCount: 2,
    surveyUsableRecordCount: 2,
    uniqueSurveyDays: 2,
    uniqueObservedUnits: 2,
    repeatObservedUnits: 1,
    lastObservedAt: "2026-07-28T00:00:00.000Z",
    lastSurveyUsableAt: "2026-07-28T00:00:00.000Z",
    denominator: {
      kind: "registered_target_units",
      totalTargetUnits: 2,
      observedTargetUnits: 2,
    },
  }));

  assert.equal(projection.publicState, "privacy_suppressed");
  assert.equal(projection.privacySuppressed, true);
  assert.equal(projection.canShowKnownTargetPercentage, false);
});

test("many ordinary photos cannot satisfy a survey target without survey-usable records", () => {
  const projection = projectKubiakaAreaCoverage(baseInput({
    recordCount: 20,
    photoCount: 60,
    screenableRecordCount: 0,
    surveyUsableRecordCount: 0,
    uniqueSurveyDays: 5,
    uniqueObservedUnits: 10,
    repeatObservedUnits: 4,
    lastObservedAt: "2026-07-28T00:00:00.000Z",
  }));

  assert.equal(projection.targetMet, false);
  assert.equal(projection.level, "sparse");
  assert.equal(projection.publicState, "more_observation_useful");
  assert.ok(projection.missingConditions.includes("survey_usable_records"));
  assert.ok(projection.nextNeeds.includes("more_survey_usable_records"));
});

test("partially completed protocol criteria produce a progressing state and concrete gaps", () => {
  const projection = projectKubiakaAreaCoverage(baseInput({
    recordCount: 8,
    photoCount: 24,
    screenableRecordCount: 6,
    surveyUsableRecordCount: 2,
    uniqueSurveyDays: 2,
    uniqueObservedUnits: 4,
    repeatObservedUnits: 1,
    lastObservedAt: "2026-07-25T00:00:00.000Z",
    lastSurveyUsableAt: "2026-07-25T00:00:00.000Z",
  }));

  assert.equal(projection.level, "developing");
  assert.equal(projection.publicState, "observation_progressing");
  assert.equal(projection.targetMet, false);
  assert.deepEqual(projection.missingConditions, [
    "survey_usable_records",
    "unique_survey_days",
    "repeat_observed_units",
  ]);
  assert.deepEqual(projection.nextNeeds, [
    "more_survey_usable_records",
    "another_survey_day",
    "repeat_same_unit",
  ]);
});

test("known target units allow an explicit bounded percentage and target-met state", () => {
  const projection = projectKubiakaAreaCoverage(baseInput({
    recordCount: 10,
    photoCount: 30,
    screenableRecordCount: 8,
    surveyUsableRecordCount: 4,
    uniqueSurveyDays: 3,
    uniqueObservedUnits: 6,
    repeatObservedUnits: 2,
    lastObservedAt: "2026-07-20T00:00:00.000Z",
    lastSurveyUsableAt: "2026-07-20T00:00:00.000Z",
    denominator: {
      kind: "registered_target_units",
      totalTargetUnits: 10,
      observedTargetUnits: 6,
      sourceId: "tree-register-1",
      sourceUpdatedAt: "2026-07-01T00:00:00.000Z",
    },
  }));

  assert.equal(projection.basis, "registered_target_units");
  assert.equal(projection.knownTargetCoverageRatio, 0.6);
  assert.equal(projection.canShowKnownTargetPercentage, true);
  assert.equal(projection.targetMet, true);
  assert.equal(projection.level, "target_met");
  assert.equal(projection.publicState, "current_target_met");
  assert.deepEqual(projection.missingConditions, []);
  assert.deepEqual(projection.nextNeeds, []);
});

test("effort-only cells can meet an explicit protocol target but never expose a fake coverage percentage", () => {
  const projection = projectKubiakaAreaCoverage(baseInput({
    recordCount: 10,
    photoCount: 30,
    screenableRecordCount: 8,
    surveyUsableRecordCount: 4,
    uniqueSurveyDays: 3,
    uniqueObservedUnits: 6,
    repeatObservedUnits: 2,
    lastObservedAt: "2026-07-20T00:00:00.000Z",
    lastSurveyUsableAt: "2026-07-20T00:00:00.000Z",
  }));

  assert.equal(projection.basis, "effort_only");
  assert.equal(projection.targetMet, true);
  assert.equal(projection.publicState, "current_target_met");
  assert.equal(projection.knownTargetCoverageRatio, null);
  assert.equal(projection.canShowKnownTargetPercentage, false);
});

test("stale survey evidence makes a cell revisit-due even when a newer casual photo exists", () => {
  const projection = projectKubiakaAreaCoverage(baseInput({
    recordCount: 12,
    photoCount: 32,
    screenableRecordCount: 9,
    surveyUsableRecordCount: 4,
    uniqueSurveyDays: 3,
    uniqueObservedUnits: 6,
    repeatObservedUnits: 2,
    lastObservedAt: "2026-07-28T00:00:00.000Z",
    lastSurveyUsableAt: "2026-05-20T00:00:00.000Z",
  }));

  assert.equal(projection.daysSinceRelevantObservation, 70);
  assert.equal(projection.freshness, "revisit_due");
  assert.equal(projection.targetMet, false);
  assert.equal(projection.publicState, "revisit_due");
  assert.ok(projection.missingConditions.includes("freshness"));
  assert.ok(projection.nextNeeds.includes("revisit_due"));
});

test("known denominator below its threshold remains incomplete even when effort criteria pass", () => {
  const projection = projectKubiakaAreaCoverage(baseInput({
    recordCount: 10,
    photoCount: 30,
    screenableRecordCount: 8,
    surveyUsableRecordCount: 4,
    uniqueSurveyDays: 3,
    uniqueObservedUnits: 5,
    repeatObservedUnits: 2,
    lastObservedAt: "2026-07-20T00:00:00.000Z",
    lastSurveyUsableAt: "2026-07-20T00:00:00.000Z",
    denominator: {
      kind: "registered_target_units",
      totalTargetUnits: 10,
      observedTargetUnits: 5,
    },
  }));

  assert.equal(projection.knownTargetCoverageRatio, 0.5);
  assert.equal(projection.targetMet, false);
  assert.equal(projection.publicState, "observation_progressing");
  assert.ok(projection.missingConditions.includes("known_target_coverage"));
  assert.ok(projection.nextNeeds.includes("more_target_units"));
});
