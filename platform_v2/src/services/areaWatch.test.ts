import assert from "node:assert/strict";
import test from "node:test";
import { buildAreaWatch, type BuildAreaWatchInput } from "./areaWatch.js";

function input(overrides: Partial<BuildAreaWatchInput> = {}): BuildAreaWatchInput {
  return {
    totalObservations: 12,
    totalVisits: 6,
    uniqueTaxa: 5,
    seasonalCoverage: [
      { season: "spring", label: "春", observations: 5, isCurrentSeason: true },
      { season: "summer", label: "夏", observations: 3, isCurrentSeason: false },
      { season: "autumn", label: "秋", observations: 2, isCurrentSeason: false },
      { season: "winter", label: "冬", observations: 0, isCurrentSeason: false },
    ],
    yearlyTimeline: [
      { year: 2026, observations: 10, uniqueTaxa: 5, visits: 5, effortVisits: 4, completeChecklists: 1 },
      { year: 2025, observations: 2, uniqueTaxa: 2, visits: 1, effortVisits: 1, completeChecklists: 0 },
    ],
    effortIndicators: {
      effortReportedRate: 0.67,
      completeChecklistRate: 0.17,
      temporalSpreadIndex: 0.42,
      observerDiversity: 0.45,
      nonDetectionRate: 0.2,
      effortIndex: 48,
      observerCount: 3,
      topObserverShare: 0.5,
      yearsCovered: 2,
      monthsCovered: 5,
      seasonsCovered: 3,
    },
    sensitiveMasking: { totalRare: 1, maskedSpecies: 1, viewerCanSeeExact: false },
    evidenceStats: {
      totalOccurrences: 12,
      photoOccurrences: 9,
      contextPhotoOccurrences: 3,
      primarySubjectPhotoOccurrences: 4,
      recent90Occurrences: 5,
      recent180Occurrences: 7,
      reviewedOccurrences: 2,
      aiCandidateOccurrences: 6,
      methodContextVisits: 3,
      latestObservedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

test("area watch describes evidence health without claiming nature quality", () => {
  const watch = buildAreaWatch(input());

  assert.equal(watch.schemaVersion, "area_watch/v0");
  assert.ok(watch.score >= 30);
  assert.ok(watch.dimensions.some((item) => item.key === "photo_clues"));
  assert.ok(watch.dimensions.some((item) => item.key === "season_clues"));
  assert.ok(watch.dimensions.some((item) => item.key === "trust_clues"));
  assert.match(watch.stewardSummary, /自然の良し悪しではなく/);
  assert.match(watch.researcherNote, /観察数・種数を成果証明にせず/);
  assert.doesNotMatch(JSON.stringify(watch), /生物多様性が良い|自然が良い|TNFD準拠を証明|自然共生サイト認定を証明/);
});

test("area watch points children and stewards toward the weakest evidence dimension", () => {
  const watch = buildAreaWatch(input({
    seasonalCoverage: [
      { season: "spring", label: "春", observations: 0, isCurrentSeason: true },
      { season: "summer", label: "夏", observations: 0, isCurrentSeason: false },
      { season: "autumn", label: "秋", observations: 0, isCurrentSeason: false },
      { season: "winter", label: "冬", observations: 0, isCurrentSeason: false },
    ],
    evidenceStats: {
      totalOccurrences: 4,
      photoOccurrences: 4,
      contextPhotoOccurrences: 1,
      primarySubjectPhotoOccurrences: 2,
      recent90Occurrences: 4,
      recent180Occurrences: 4,
      reviewedOccurrences: 1,
      aiCandidateOccurrences: 1,
      methodContextVisits: 1,
      latestObservedAt: new Date().toISOString(),
    },
  }));

  assert.equal(watch.nextAction.dimension, "season_clues");
  assert.match(watch.nextAction.body, /今の季節|春/);
  assert.ok(watch.gaps.some((gap) => gap.includes("季節の手がかり")));
});

test("area watch stays a sprout when the field is registered but evidence is empty", () => {
  const watch = buildAreaWatch(input({
    totalObservations: 0,
    totalVisits: 0,
    uniqueTaxa: 0,
    seasonalCoverage: [
      { season: "spring", label: "春", observations: 0, isCurrentSeason: true },
      { season: "summer", label: "夏", observations: 0, isCurrentSeason: false },
      { season: "autumn", label: "秋", observations: 0, isCurrentSeason: false },
      { season: "winter", label: "冬", observations: 0, isCurrentSeason: false },
    ],
    effortIndicators: {
      effortReportedRate: 0,
      completeChecklistRate: 0,
      temporalSpreadIndex: 0,
      observerDiversity: 0,
      nonDetectionRate: 0,
      effortIndex: 0,
      observerCount: 0,
      topObserverShare: 0,
      yearsCovered: 0,
      monthsCovered: 0,
      seasonsCovered: 0,
    },
    sensitiveMasking: { totalRare: 0, maskedSpecies: 0, viewerCanSeeExact: false },
    evidenceStats: {
      totalOccurrences: 0,
      photoOccurrences: 0,
      contextPhotoOccurrences: 0,
      primarySubjectPhotoOccurrences: 0,
      recent90Occurrences: 0,
      recent180Occurrences: 0,
      reviewedOccurrences: 0,
      aiCandidateOccurrences: 0,
      methodContextVisits: 0,
      latestObservedAt: null,
    },
  }));

  assert.equal(watch.status, "sprout");
  assert.match(watch.childSummary, /これから始まります/);
  assert.ok(watch.celebrations.some((item) => item.includes("エリア登録")));
});
