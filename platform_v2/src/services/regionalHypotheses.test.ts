import assert from "node:assert/strict";
import test from "node:test";
import { buildRegionalHypothesesForMesh, type RegionalHypothesisMeshSource } from "./regionalHypotheses.js";

function baseSource(overrides: Partial<RegionalHypothesisMeshSource> = {}): RegionalHypothesisMeshSource {
  return {
    meshKey: "35.0000:137.0000",
    guideRecordCount: 2,
    contributorCount: 1,
    vegetationCounts: { "湿性草地": 1.4, "ヨシ群落": 0.8 },
    landformCounts: { "水路沿い": 1.2 },
    structureCounts: { "草刈り跡": 0.7, "道路際": 0.4 },
    soundCounts: {},
    sampleRecordIds: ["11111111-1111-4111-8111-111111111111"],
    firstSeenAt: "2026-04-30T09:00:00.000Z",
    lastSeenAt: "2026-04-30T09:12:00.000Z",
    visitCount: 0,
    occurrenceCount: 0,
    absentOccurrenceCount: 0,
    completeChecklistCount: 0,
    effortVisitCount: 0,
    coordinateUncertaintyKnownCount: 0,
    audioSegmentCount: 0,
    correctionCount: 0,
    knowledgeCardIds: ["hamamatsu-water-card"],
    ...overrides,
  };
}

test("regional hypotheses produce hypothesis candidates, not ecological assertions", () => {
  const drafts = buildRegionalHypothesesForMesh(baseSource());

  assert.ok(drafts.length >= 3);
  assert.ok(drafts.some((draft) => draft.claimType === "habitat"));
  assert.ok(drafts.some((draft) => draft.claimType === "management_effect"));
  assert.ok(drafts.every((draft) => draft.confidence <= 0.72));
  assert.ok(drafts.every((draft) => draft.biasWarnings.includes("guide_records_are_opportunistic")));
  assert.ok(drafts.some((draft) => draft.missingData.includes("complete_checklist")));
  assert.ok(drafts.some((draft) => draft.nextSamplingProtocol.includes("occurrence_status=absent")));
});

test("regional hypotheses keep effort and absence limitations visible even with stronger samples", () => {
  const drafts = buildRegionalHypothesesForMesh(baseSource({
    guideRecordCount: 5,
    contributorCount: 3,
    visitCount: 4,
    effortVisitCount: 2,
    coordinateUncertaintyKnownCount: 2,
  }));

  const first = drafts[0];
  assert.ok(first);
  assert.equal(first.claimType, "effort_bias");
  assert.ok(first.missingData.includes("complete_checklist"));
  assert.ok(first.missingData.includes("explicit_non_detection"));
  assert.ok(first.biasWarnings.includes("absence_cannot_be_inferred_without_scope"));
});
