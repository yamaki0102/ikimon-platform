import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRecordPageNearbyGuideShelf, findGuideUnlockCandidatesForPoint, parseCaptureAccuracyM } from "./guideUnlocks.js";

test("nearby records unlock the owner-verified Lenri guide without requiring public posting", () => {
  const candidates = findGuideUnlockCandidatesForPoint({
    latitude: 34.81436,
    longitude: 137.73271,
    sourcePayload: {
      public_visibility: "private",
      location_accuracy_m: 35,
    },
  });

  const lenri = candidates.find((candidate) => candidate.spot.id === "aikan-renri-lenri-tree");
  assert.ok(lenri);
  assert.equal(lenri.spot.approvalState, "owner_verified");
  assert.equal(lenri.spot.landownerConsent, true);
  assert.equal(lenri.program?.id, "aikan-renri-guide-relay");
  assert.equal(lenri.distanceBand, "same_place");
});

test("unlock candidate matching uses a capped GPS accuracy buffer", () => {
  const nearWithCoarseGps = findGuideUnlockCandidatesForPoint({
    latitude: 34.8158,
    longitude: 137.7327,
    sourcePayload: { accuracyM: 500 },
  });

  assert.ok(nearWithCoarseGps.some((candidate) => candidate.spot.id === "aikan-renri-lenri-tree"));
  assert.equal(parseCaptureAccuracyM({ locationAccuracyM: "42" }), 42);
});

test("guide unlock runtime resolves DB-authored programs without duplicating coordinates", () => {
  const source = readFileSync(join(process.cwd(), "src", "services", "guideUnlocks.ts"), "utf8");
  assert.match(source, /findActiveGuideProgramForSpot/);
  assert.match(source, /listGuideProgramRefs/);
  assert.match(source, /programSlug/);
  assert.match(source, /runtimeProgram\?\.id/);
  assert.doesNotMatch(source, /guide_unlocks[\s\S]*latitude/);
  assert.doesNotMatch(source, /guide_unlocks[\s\S]*longitude/);
});

test("record pages can surface nearby guide cards without exposing source coordinates", () => {
  const shelf = buildRecordPageNearbyGuideShelf({
    latitude: 34.81436,
    longitude: 137.73271,
    sourcePayload: { public_visibility: "private" },
  });

  assert.ok(shelf);
  assert.ok(shelf.cards.length <= 2);
  assert.equal(shelf.cards[0]?.guideSpotId, "aikan-renri-lenri-tree");
  assert.equal(shelf.cards[0]?.href, "/guide-programs/aikan-renri-guide-relay");
  assert.equal(shelf.cards[0]?.publicLocationMode, "exact");
  assert.equal(shelf.cards[0]?.subjectLocationMode, "same_as_visit_anchor");
  assert.doesNotMatch(JSON.stringify(shelf), /34\.81436|137\.73271/);
});
