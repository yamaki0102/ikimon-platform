import assert from "node:assert/strict";
import test from "node:test";
import { getStrings } from "../i18n/index.js";
import type { LandingObservation, LandingSnapshot } from "../services/readModels.js";
import { renderLandingHomeState } from "./landingHomeState.js";

function proof(overrides: Partial<LandingObservation> = {}): LandingObservation {
  return {
    occurrenceId: "occ-public-proof",
    visitId: "public-proof",
    detailId: "public-proof",
    displayName: "公開済みの写真",
    observedAt: "2026-07-20T08:30:00.000Z",
    observerName: "observer",
    placeName: "private source place",
    municipality: "浜松市",
    publicLocation: {
      label: "浜松市",
      scope: "municipality",
      cellId: null,
      gridM: null,
      radiusM: null,
      centroidLat: null,
      centroidLng: null,
      displayMode: "area",
    },
    photoUrl: "/media/public-proof.jpg",
    identificationCount: 0,
    latitude: null,
    longitude: null,
    observerUserId: null,
    observerAvatarUrl: null,
    entryType: "observation",
    librarySourceKind: "photo",
    ...overrides,
  };
}

function render(publicProofFeed: LandingObservation[]): string {
  const snapshot: LandingSnapshot = {
    viewerUserId: null,
    stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
    feed: [],
    publicProofFeed,
    myFeed: [],
    myPlaces: [],
    nearbyFields: [],
    nearbyEvents: [],
    mapPreviewCells: [],
    ambient: [],
    habit: null,
    dailyDashboard: null,
  };
  const result = renderLandingHomeState({
    basePath: "",
    lang: "ja",
    copy: getStrings("ja").landing,
    snapshot,
    isLoggedIn: false,
  });
  return `${result.heroHtml}${result.bodyHtml}`;
}

function assertHidden(record: LandingObservation): void {
  const html = render([record]);
  assert.match(html, /home-guest-proof is-count-0 is-empty/);
  assert.doesNotMatch(html, /data-home-public-record="public-proof"/);
  assert.doesNotMatch(html, /\/media\/public-proof\.jpg/);
}

test("guest Home requires an explicit successful public-feed gate", () => {
  assertHidden(proof());

  const html = render([proof({ publicFeedEligible: true, publicFeedGateStatus: "public_eligible" })]);
  assert.match(html, /home-guest-proof is-count-1/);
  assert.match(html, /data-home-public-record="public-proof"/);
});

test("private, blurred, and blocked_public records never reach guest Home", () => {
  assertHidden(proof({ publicFeedEligible: false, publicFeedGateStatus: "blocked_public" }));
  assertHidden(proof({
    publicFeedEligible: true,
    publicFeedGateStatus: "public_eligible",
    publicLocation: {
      label: "",
      scope: "blurred",
      cellId: null,
      gridM: null,
      radiusM: null,
      centroidLat: null,
      centroidLng: null,
      displayMode: "area",
    },
  }));
  assertHidden(proof({ publicFeedEligible: true, publicFeedGateStatus: "blocked_public" }));
});
