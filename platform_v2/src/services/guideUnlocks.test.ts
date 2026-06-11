import assert from "node:assert/strict";
import test from "node:test";
import { findGuideUnlockCandidatesForPoint, parseCaptureAccuracyM } from "./guideUnlocks.js";

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
