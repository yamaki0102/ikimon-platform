import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRelationshipScore,
  classifyClimate,
  seasonCoverageCap,
  seasonForMonth,
  type RelationshipScoreInputs,
} from "./relationshipScore.js";

function inputs(overrides: Partial<RelationshipScoreInputs> = {}): RelationshipScoreInputs {
  return {
    accessStatus: "public",
    safetyNotesPresent: true,
    visitsCount: 12,
    seasonsCovered: 3,
    repeatObserverCount: 2,
    notesCompletionRate: 0.5,
    identificationAttemptRate: 0.6,
    taxonRankDistinctCount: 5,
    reviewReplyCount: 1,
    stewardshipActionCount: 6,
    stewardshipActionLinkedRate: 0.5,
    acceptedReviewRate: 0.4,
    effortCompletionRate: 0.4,
    auditTrailPresent: true,
    centerLatitude: 35.7, // 東京付近 -> subtropical_n
    ...overrides,
  };
}

test("classifyClimate returns expected zones for major latitudes", () => {
  assert.equal(classifyClimate(70).climate, "subarctic_n");
  assert.equal(classifyClimate(40).climate, "temperate_n");
  assert.equal(classifyClimate(28).climate, "subtropical_n");
  assert.equal(classifyClimate(10).climate, "tropical");
  assert.equal(classifyClimate(-10).climate, "tropical");
  assert.equal(classifyClimate(-40).climate, "temperate_s");
  assert.equal(classifyClimate(-70).climate, "subarctic_s");
  assert.equal(classifyClimate(null).climate, "temperate_n");
});

test("seasonCoverageCap is climate-aware", () => {
  assert.equal(seasonCoverageCap("temperate_n"), 4);
  assert.equal(seasonCoverageCap("temperate_s"), 4);
  assert.equal(seasonCoverageCap("subarctic_n"), 3);
  assert.equal(seasonCoverageCap("subtropical_n"), 3);
  assert.equal(seasonCoverageCap("tropical"), 2);
});

test("seasonForMonth respects southern hemisphere shift", () => {
  // Northern temperate: 4月=春, 7月=夏
  assert.equal(seasonForMonth(4, "temperate_n", "north"), 0);
  assert.equal(seasonForMonth(7, "temperate_n", "north"), 1);
  // Southern temperate: 4月は北半球の10月相当 = 秋
  assert.equal(seasonForMonth(4, "temperate_s", "south"), 2);
  // Tropical: 6月 = 雨季
  assert.equal(seasonForMonth(6, "tropical", "north"), 0);
});

test("calculateRelationshipScore returns full marks at boundaries", () => {
  const result = calculateRelationshipScore(inputs());
  assert.equal(result.totalScore, 100);
  assert.equal(result.axes.access.score, 20);
  assert.equal(result.axes.engagement.score, 20);
  assert.equal(result.axes.learning.score, 20);
  assert.equal(result.axes.stewardship.score, 20);
  assert.equal(result.axes.evidence.score, 20);
});

test("Engagement drops to 10 just below the visits threshold", () => {
  const r = calculateRelationshipScore(inputs({ visitsCount: 11 }));
  assert.equal(r.axes.engagement.score, 10);
});

test("Engagement is 0 with only single visit", () => {
  const r = calculateRelationshipScore(inputs({ visitsCount: 2, seasonsCovered: 1, repeatObserverCount: 0 }));
  assert.equal(r.axes.engagement.score, 0);
});

test("Access requires both public status and safety notes for full marks", () => {
  const r = calculateRelationshipScore(inputs({ accessStatus: "public", safetyNotesPresent: false }));
  assert.equal(r.axes.access.score, 10);

  const r2 = calculateRelationshipScore(inputs({ accessStatus: "private", safetyNotesPresent: true }));
  assert.equal(r2.axes.access.score, 0);

  const r3 = calculateRelationshipScore(inputs({ accessStatus: null, safetyNotesPresent: false }));
  assert.equal(r3.axes.access.score, 0);
});

test("Stewardship requires linked rate for full marks", () => {
  const r = calculateRelationshipScore(
    inputs({ stewardshipActionCount: 6, stewardshipActionLinkedRate: 0.49 })
  );
  assert.equal(r.axes.stewardship.score, 10);
});

test("Evidence drops when effort completion rate falls below threshold", () => {
  const r = calculateRelationshipScore(inputs({ effortCompletionRate: 0.39 }));
  assert.equal(r.axes.evidence.score, 10);
});

test("Learning requires both id rate AND taxon ranks AND a review reply for full marks", () => {
  const r = calculateRelationshipScore(inputs({ reviewReplyCount: 0 }));
  assert.equal(r.axes.learning.score, 10);

  const r2 = calculateRelationshipScore(
    inputs({ identificationAttemptRate: 0.59, taxonRankDistinctCount: 5, reviewReplyCount: 1 })
  );
  assert.equal(r2.axes.learning.score, 10);
});

test("nextActionAxis selects axis with highest priority among non-full axes", () => {
  // Access 0、その他は満点 → cost_factor 低めだが gap 最大なので Access が選ばれるはず
  const r = calculateRelationshipScore(
    inputs({
      accessStatus: null,
      safetyNotesPresent: false,
    })
  );
  assert.equal(r.axes.access.score, 0);
  assert.equal(r.nextActionAxis, "access");
});

test("Tropical site: full season coverage requires only 2 distinct seasons", () => {
  // 熱帯サイト (lat=5)、cap=2、ceil(2*0.75)=2、3/4 季節必要なくなる
  // visits 12, seasons=2, repeat=2 で full
  const r = calculateRelationshipScore(
    inputs({ centerLatitude: 5, seasonsCovered: 2 })
  );
  assert.equal(r.climate, "tropical");
  assert.equal(r.seasonCoverageCap, 2);
  assert.equal(r.axes.engagement.score, 20);
});

test("Southern hemisphere temperate site is recognized", () => {
  // -42 (Tasmania 相当) は abs=42 で temperate 範囲
  const r = calculateRelationshipScore(inputs({ centerLatitude: -42 }));
  assert.equal(r.climate, "temperate_s");
  assert.equal(r.hemisphere, "south");
});

test("Subtropical south boundary: -33.9 (Sydney) classified as subtropical_s", () => {
  const r = calculateRelationshipScore(inputs({ centerLatitude: -33.9 }));
  assert.equal(r.climate, "subtropical_s");
  assert.equal(r.hemisphere, "south");
});
