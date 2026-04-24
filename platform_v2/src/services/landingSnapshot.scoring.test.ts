import assert from "node:assert/strict";
import test from "node:test";
import {
  isLandingHeroCandidateEligible,
  scoreLandingHeroCandidate,
  type LandingHeroCandidate,
  type LandingHeroScoreContext,
} from "./landingSnapshot.js";

function candidate(overrides: Partial<LandingHeroCandidate> = {}): LandingHeroCandidate {
  return {
    occurrenceId: "occ-a",
    visitId: "visit-a",
    displayName: "Seasonal flower",
    observedAt: "2026-04-20T10:00:00.000Z",
    observerName: "Observer",
    placeName: "Field",
    municipality: "Hamamatsu",
    publicLocation: {
      label: "Hamamatsu",
      scope: "municipality",
      cellId: "3000:1:1",
      gridM: 3000,
      radiusM: 3000,
      centroidLat: 34.7,
      centroidLng: 137.7,
      displayMode: "area",
    },
    photoUrl: "/assets/photo.jpg",
    identificationCount: 1,
    latitude: 34.7,
    longitude: 137.7,
    observerUserId: "user-a",
    observerAvatarUrl: null,
    evidenceTier: 2,
    photoWidthPx: 1600,
    photoHeightPx: 1100,
    qualityGrade: "research",
    ...overrides,
  };
}

function context(overrides: Partial<LandingHeroScoreContext> = {}): LandingHeroScoreContext {
  return {
    dateKey: "2026-04-24",
    now: new Date("2026-04-24T00:00:00.000Z"),
    preferredMunicipalities: ["Hamamatsu"],
    ...overrides,
  };
}

test("scoreLandingHeroCandidate rewards season, region, photo quality, evidence, and freshness", () => {
  const scored = scoreLandingHeroCandidate(candidate(), context());
  assert.equal(scored.season, 25);
  assert.equal(scored.region, 20);
  assert.equal(scored.photo, 25);
  assert.equal(scored.evidence, 12);
  assert.equal(scored.freshness, 10);
  assert.ok(scored.dailyVariation >= 0 && scored.dailyVariation <= 5);
  assert.ok(scored.total >= 92);
});

test("scoreLandingHeroCandidate is stable within the same date key and can move on another date", () => {
  const base = candidate({ occurrenceId: "occ-daily-a", visitId: "visit-daily-a" });
  const first = scoreLandingHeroCandidate(base, context({ dateKey: "2026-04-24" }));
  const second = scoreLandingHeroCandidate(base, context({ dateKey: "2026-04-24" }));
  const nextDay = scoreLandingHeroCandidate(base, context({ dateKey: "2026-04-25" }));
  assert.equal(first.dailyVariation, second.dailyVariation);
  assert.notEqual(first.dailyVariation, nextDay.dailyVariation);
});

test("isLandingHeroCandidateEligible rejects missing photos, blurred locations, and extreme aspect ratios", () => {
  assert.equal(isLandingHeroCandidateEligible(candidate()), true);
  assert.equal(isLandingHeroCandidateEligible(candidate({ photoUrl: null })), false);
  assert.equal(isLandingHeroCandidateEligible(candidate({
    publicLocation: {
      label: "Blurred",
      scope: "blurred",
      cellId: null,
      gridM: null,
      radiusM: null,
      centroidLat: null,
      centroidLng: null,
      displayMode: "area",
    },
  })), false);
  assert.equal(isLandingHeroCandidateEligible(candidate({ photoWidthPx: 3000, photoHeightPx: 800 })), false);
});
