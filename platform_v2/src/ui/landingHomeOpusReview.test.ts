import assert from "node:assert/strict";
import test from "node:test";
import { getStrings } from "../i18n/index.js";
import type { LandingObservation, LandingSnapshot } from "../services/readModels.js";
import { LANDING_HOME_STATE_STYLES, renderLandingHomeState } from "./landingHomeState.js";

function publicProof(overrides: Partial<LandingObservation> = {}): LandingObservation {
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

function snapshot(publicProofFeed: LandingObservation[]): LandingSnapshot {
  return {
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
}

function render(publicProofFeed: LandingObservation[]): string {
  const strings = getStrings("ja");
  const result = renderLandingHomeState({
    basePath: "",
    lang: "ja",
    copy: strings.landing,
    snapshot: snapshot(publicProofFeed),
    isLoggedIn: false,
  });
  return `${result.heroHtml}${result.bodyHtml}`;
}

test("canonical public-proof records render even when the adapter omitted duplicate gate fields", () => {
  const html = render([publicProof()]);
  assert.match(html, /home-guest-proof is-count-1/);
  assert.match(html, /data-home-public-record="public-proof"/);
  assert.match(html, /\/media\/public-proof\.jpg/);
  assert.doesNotMatch(html, /home-guest-proof is-count-0 is-empty/);
});

test("explicitly blocked public-proof records remain fail-closed", () => {
  const html = render([publicProof({ publicFeedEligible: false, publicFeedGateStatus: "blocked_public" })]);
  assert.match(html, /home-guest-proof is-count-0 is-empty/);
  assert.doesNotMatch(html, /data-home-public-record="public-proof"/);
});

test("Home focus and category labels use the accessible dark-green token", () => {
  assert.match(LANDING_HOME_STATE_STYLES, /home-category-index\{color:var\(--home-green\)/);
  assert.match(LANDING_HOME_STATE_STYLES, /focus-visible\{outline:3px solid var\(--home-green\)/);
  assert.doesNotMatch(LANDING_HOME_STATE_STYLES, /home-category-index\{color:var\(--home-leaf\)/);
  assert.doesNotMatch(LANDING_HOME_STATE_STYLES, /focus-visible\{outline:3px solid var\(--home-yellow\)/);
});
