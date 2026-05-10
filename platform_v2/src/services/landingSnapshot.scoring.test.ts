import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLandingTopShelves,
  isKnownLandingDummyObservation,
  isLandingFixtureObservation,
  isLandingHeroCandidateEligible,
  resolveLandingDisplayName,
  scoreLandingHeroCandidate,
  type LandingHeroCandidate,
  type LandingHeroScoreContext,
} from "./landingSnapshot.js";
import type { LandingObservation, LandingTopGuideItem } from "./readModels.js";

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
    photoBytes: 220_000,
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

function topObservation(index: number, overrides: Partial<LandingObservation> = {}): LandingObservation {
  const userIndex = Math.floor(index / 2);
  return {
    occurrenceId: `top-occ-${index}`,
    visitId: `top-visit-${index}`,
    displayName: `発見 ${index}`,
    observedAt: `2026-04-${String((index % 20) + 1).padStart(2, "0")}T09:00:00.000Z`,
    observerName: `Observer ${userIndex}`,
    placeName: `Field ${index % 5}`,
    municipality: `Area ${index % 5}`,
    publicLocation: {
      label: `Area ${index % 5}`,
      scope: "municipality",
      cellId: `3000:${index % 5}:${index % 3}`,
      gridM: 3000,
      radiusM: 3000,
      centroidLat: 34.7 + (index % 5) * 0.01,
      centroidLng: 137.7 + (index % 5) * 0.01,
      displayMode: "area",
    },
    photoUrl: `/uploads/top-${index}.jpg`,
    photoUrls: [`/uploads/top-${index}.jpg`],
    photoCount: 1,
    identificationCount: index % 4,
    latitude: 34.7,
    longitude: 137.7,
    observerUserId: `user-${userIndex}`,
    observerAvatarUrl: null,
    librarySourceKind: "photo",
    hasVideo: false,
    entryType: "observation",
    evidenceTier: 2,
    ...overrides,
  };
}

function topGuideItem(index: number, overrides: Partial<LandingTopGuideItem> = {}): LandingTopGuideItem {
  return {
    topItemType: "guide",
    guideRecordId: `guide-record-${index}`,
    sessionId: `guide-session-${index}`,
    displayName: `ガイド発見 ${index}`,
    summary: `ガイドで見た環境 ${index}`,
    observedAt: `2026-04-${String((index % 20) + 1).padStart(2, "0")}T09:30:00.000Z`,
    observerName: `Guide Observer ${index}`,
    observerUserId: `guide-user-${index}`,
    observerAvatarUrl: null,
    placeName: `Guide Area ${index % 3}`,
    municipality: null,
    publicLocation: {
      label: "位置をぼかしています",
      scope: "blurred",
      cellId: `3000:${index % 3}:${index % 4}`,
      gridM: 3000,
      radiusM: 3000,
      centroidLat: 34.7 + index * 0.001,
      centroidLng: 137.7 + index * 0.001,
      displayMode: "area",
    },
    photoUrl: `/uploads/guide-${index}.jpg`,
    latitude: 34.7,
    longitude: 137.7,
    librarySourceKind: "guide",
    detectedSpecies: [`ガイド種 ${index}`],
    identificationCount: 0,
    isAiCandidate: false,
    href: "/guide/outcomes",
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

test("isLandingHeroCandidateEligible rejects over-compressed photos for the oversized landing slot", () => {
  assert.equal(isLandingHeroCandidateEligible(candidate({
    photoWidthPx: 1245,
    photoHeightPx: 1117,
    photoBytes: 27_806,
  })), false);
  assert.equal(isLandingHeroCandidateEligible(candidate({
    photoWidthPx: 1440,
    photoHeightPx: 1920,
    photoBytes: 182_240,
  })), true);
});

test("resolveLandingDisplayName ignores unresolved placeholders and uses identification fallback", () => {
  assert.equal(resolveLandingDisplayName("Unresolved", "モンシロチョウ", null), "モンシロチョウ");
  assert.equal(resolveLandingDisplayName("同定待ち", "Awaiting ID", "AI候補の花"), "AI候補の花");
  assert.equal(resolveLandingDisplayName("", null, null), "同定待ち");
});

test("known winter dummy observations stay out of landing surfaces", () => {
  assert.equal(isKnownLandingDummyObservation({
    displayName: "アブラゼミ",
    observedAt: "2026-02-17T09:00:00.000Z",
  }), true);
  assert.equal(isKnownLandingDummyObservation({
    displayName: "アジサイ",
    observedAt: "2026-01-10T09:00:00.000Z",
  }), true);
  assert.equal(isKnownLandingDummyObservation({
    displayName: "アブラゼミ",
    observedAt: "2026-07-17T09:00:00.000Z",
  }), false);
  assert.equal(isKnownLandingDummyObservation({
    displayName: "モンシロチョウ",
    observedAt: "2026-02-17T09:00:00.000Z",
  }), false);
});

test("landing fixture observations stay out of public landing shelves", () => {
  assert.equal(isLandingFixtureObservation({
    photoUrl: "/thumb/md/v2-observations/record-1778023706920/smoke-ui-local-1778023704507-photo.jpg",
  }), true);
  assert.equal(isLandingFixtureObservation({
    observerName: "候補UIスモーク smoke-ui-local-1778023704507",
  }), true);
  assert.equal(isLandingFixtureObservation({
    occurrenceId: "occ-a",
    visitId: "visit-a",
    displayName: "トクサ",
    observerName: "山田",
    placeName: "水路沿い",
    municipality: "浜松市",
    photoUrl: "/uploads/photos/real-observation.jpg",
  }), false);
});

test("landing top shelf selection caps repeated observers per shelf and across the top", () => {
  const heavyUser = Array.from({ length: 100 }, (_, index) => topObservation(index, {
    observerUserId: "power-user",
    observerName: "Power User",
    librarySourceKind: index % 3 === 0 ? "video" : "photo",
    hasVideo: index % 3 === 0,
    identificationCount: index % 5 === 0 ? 0 : 2,
  }));
  const otherUsers = Array.from({ length: 20 }, (_, index) => topObservation(200 + index, {
    observerUserId: `other-${index}`,
    observerName: `Other ${index}`,
    librarySourceKind: index % 4 === 0 ? "guide" : index % 4 === 1 ? "scan" : index % 4 === 2 ? "video" : "photo",
    hasVideo: index % 4 === 2,
    identificationCount: index % 3 === 0 ? 0 : 2,
  }));

  const { shelves, overflowSummaries } = buildLandingTopShelves([...heavyUser, ...otherUsers], {
    now: new Date("2026-04-24T00:00:00.000Z"),
    preferredMunicipalities: ["Area 1", "Area 2"],
  });

  for (const shelf of shelves) {
    const powerUserCount = shelf.items.filter((item) => item.observerUserId === "power-user").length;
    assert.ok(powerUserCount <= 1, `${shelf.kind} should include the heavy user at most once`);
  }
  const allItems = shelves.flatMap((shelf) => shelf.items);
  assert.ok(allItems.filter((item) => item.observerUserId === "power-user").length <= 3);
  assert.ok(overflowSummaries.some((summary) => summary.observerUserId === "power-user" && summary.count >= 97));
});

test("landing top shelves keep content modes distinct and keep CTA shelves unfilled by photos", () => {
  const observations = [
    topObservation(1, { librarySourceKind: "photo", hasVideo: false }),
    topObservation(2, { librarySourceKind: "video", hasVideo: true }),
    topObservation(6, { librarySourceKind: "video", hasVideo: true }),
    topObservation(3, { librarySourceKind: "guide", hasVideo: false }),
    topObservation(4, { librarySourceKind: "scan", hasVideo: false }),
    topObservation(5, { identificationCount: 0, librarySourceKind: "photo", hasVideo: false }),
  ];
  const { shelves } = buildLandingTopShelves(observations, {
    now: new Date("2026-04-24T00:00:00.000Z"),
  });
  const evidenceShelf = shelves.find((shelf) => shelf.kind === "photo");
  assert.equal(evidenceShelf?.title, "写真と動画");
  assert.equal(shelves.some((shelf) => shelf.kind === "video"), false);
  assert.ok(evidenceShelf?.items.some((item) => "occurrenceId" in item && (item.hasVideo || item.librarySourceKind === "video")));
  assert.ok(shelves.find((shelf) => shelf.kind === "guide")?.items.every((item) => item.librarySourceKind === "guide"));
  assert.ok(shelves.find((shelf) => shelf.kind === "scan")?.items.every((item) => item.librarySourceKind === "scan"));

  const photoOnly = buildLandingTopShelves([topObservation(10), topObservation(11)], {
    now: new Date("2026-04-24T00:00:00.000Z"),
  });
  assert.equal(photoOnly.shelves.some((shelf) => shelf.kind === "video"), false);
  assert.equal(photoOnly.shelves.find((shelf) => shelf.kind === "guide")?.items.length, 0);
  assert.equal(photoOnly.shelves.find((shelf) => shelf.kind === "scan")?.items.length, 0);
});

test("landing top guide shelf accepts guide records outside observation feed", () => {
  const guideItem = topGuideItem(1);
  const { shelves } = buildLandingTopShelves([topObservation(1)], {
    now: new Date("2026-04-24T00:00:00.000Z"),
    extraItems: [guideItem],
  });

  const guideShelf = shelves.find((shelf) => shelf.kind === "guide");
  assert.ok(guideShelf);
  assert.ok(guideShelf.items.some((item) => item.topItemType === "guide" && item.guideRecordId === guideItem.guideRecordId));

  const observationOnly = shelves
    .flatMap((shelf) => shelf.items)
    .filter((item) => "occurrenceId" in item);
  assert.ok(observationOnly.every((item) => item.occurrenceId.startsWith("top-occ-")));
});
