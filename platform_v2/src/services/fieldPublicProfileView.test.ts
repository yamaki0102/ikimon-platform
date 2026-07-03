import test from "node:test";
import assert from "node:assert/strict";
import type { ObservationField, FieldStats } from "./observationFieldRegistry.js";
import type { AreaPlaceSnapshot } from "./areaPlaceSnapshot.js";
import { buildFieldPublicProfileView } from "./fieldPublicProfileView.js";

function field(): ObservationField {
  return {
    fieldId: "field-1",
    source: "osm_park",
    adminLevel: "osm_park",
    name: "牧志公園",
    nameKana: "",
    summary: "",
    prefecture: "沖縄県",
    city: "那覇市",
    lat: 26.2179484,
    lng: 127.6918878,
    radiusM: 80,
    polygon: null,
    areaHa: null,
    certificationId: "",
    certifiedAt: null,
    officialUrl: "",
    ownerUrl: "",
    storyUrl: "",
    certificationUrl: "",
    sourceConfidence: 0.9,
    verificationLevel: "page_verified",
    verificationMethod: "",
    verificationLabel: "",
    verificationUpdatedAt: null,
    ownerUserId: null,
    profileStatus: "public_summary",
    defaultPublicLocationMode: "site",
    publicProfileEnabled: true,
    profilePolicyVersion: "site_intelligence_p0_v1",
    profileNotes: "",
    payload: { area_encyclopedia: { tags: ["街区公園", "樹木", "草地"] } },
    createdAt: "2026-05-01",
    updatedAt: "2026-05-01",
  };
}

function stats(): FieldStats {
  return {
    fieldId: "field-1",
    totalSessions: 0,
    liveSessions: 0,
    totalObservations: 12,
    uniqueSpeciesCount: 4,
    totalAbsences: 0,
    totalParticipants: 0,
    topTaxa: [
      { name: "ヤマトシジミ", count: 4 },
      { name: "シロツメクサ", count: 3 },
    ],
    recentSessions: [],
  };
}

function snapshot(): AreaPlaceSnapshot {
  return {
    field: { fieldId: "field-1" },
    observationSummary: {
      totalObservations: 12,
      totalVisits: 9,
      totalEvents: 0,
      liveEvents: 0,
      uniqueTaxa: 4,
      latestObservedAt: "2026-06-20T10:00:00.000Z",
      taxonRankCount: 2,
      seasonsCovered: 2,
      seasonCoverageCap: 4,
      seasonLabels: ["春", "夏"],
      effortCompletionRate: 0,
      reviewAcceptedRate: 1,
      nativeCount: 0,
      exoticCount: 0,
      unknownOriginCount: 12,
      absentRecords: 0,
      stewardshipActionCount: 0,
      topTaxa: [],
    },
    relationshipScore: { score: { totalScore: 20 } },
    observationGallery: [],
    seasonalCoverage: [
      { season: "spring", label: "春", observations: 8, isCurrentSeason: false },
      { season: "summer", label: "夏", observations: 4, isCurrentSeason: true },
      { season: "autumn", label: "秋", observations: 0, isCurrentSeason: false },
    ],
    yearlyTimeline: [],
    effortIndicators: {
      effortReportedRate: 0,
      completeChecklistRate: 0,
      temporalSpreadIndex: 0,
      observerDiversity: 0.7,
      nonDetectionRate: 0,
      effortIndex: 0,
      observerCount: 4,
      topObserverShare: 0.4,
      yearsCovered: 1,
      monthsCovered: 3,
      seasonsCovered: 2,
    },
    sensitiveMasking: { totalRare: 0, maskedSpecies: 0, viewerCanSeeExact: false },
  } as unknown as AreaPlaceSnapshot;
}

test("field public profile view builds an exact-pin-free profile and public brief", () => {
  const view = buildFieldPublicProfileView({ field: field(), stats: stats(), snapshot: snapshot() });

  assert.equal(view.profile.confidence.canPublishDetails, true);
  assert.equal(view.profile.publicLocation.mode, "site");
  assert.equal(view.profile.publicLocation.radiusM, 80);
  assert.equal("exactLat" in view.profile.publicLocation, false);
  assert.equal(view.profile.confirmedTaxa[0]?.name, "ヤマトシジミ");
  assert.ok(view.publicBrief.sections.some((section) => section.title === "この場所で言えること"));
  assert.deepEqual(view.publicBrief.gaps, []);
});

test("field public profile view suppresses details when source records are too thin", () => {
  const thinStats = { ...stats(), totalObservations: 2, topTaxa: [{ name: "スズメ", count: 1 }] };
  const thinSnapshot = {
    ...snapshot(),
    observationSummary: { ...snapshot().observationSummary, totalObservations: 2, totalVisits: 1 },
    effortIndicators: { ...snapshot().effortIndicators, observerCount: 1, monthsCovered: 1 },
  } as AreaPlaceSnapshot;
  const view = buildFieldPublicProfileView({ field: field(), stats: thinStats, snapshot: thinSnapshot });

  assert.equal(view.profile.confidence.canPublishDetails, false);
  assert.deepEqual(view.profile.confirmedTaxa, []);
  assert.match(view.profile.limitations[0]?.label ?? "", /確認記録が少ない/);
});
