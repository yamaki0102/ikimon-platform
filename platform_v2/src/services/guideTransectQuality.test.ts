import assert from "node:assert/strict";
import test from "node:test";
import {
  coverageSlotForPoint,
  speedBandForMps,
  summarizeGuideTransectQuality,
  timeBandForIso,
} from "./guideTransectQuality.js";

test("vehicle transect quality summarizes effort, duplicate cells, and coverage slots", () => {
  const summary = summarizeGuideTransectQuality("guide-test", [
    { sessionId: "guide-test", lat: 34.7000, lng: 137.7000, observedAt: "2026-05-02T00:00:00.000Z", accuracyM: 18, speedMps: 8 },
    { sessionId: "guide-test", lat: 34.7005, lng: 137.7005, observedAt: "2026-05-02T00:02:00.000Z", accuracyM: 32, speedMps: 9 },
    { sessionId: "guide-test", lat: 34.7050, lng: 137.7050, observedAt: "2026-05-02T00:10:00.000Z", accuracyM: 120, speedMps: 13 },
  ]);

  assert.equal(summary.sessionId, "guide-test");
  assert.equal(summary.pointCount, 3);
  assert.ok(summary.distanceM > 700);
  assert.equal(summary.effortMinutes, 10);
  assert.equal(summary.avgAccuracyM, 56.7);
  assert.equal(summary.goodAccuracyRate, 0.667);
  assert.ok(summary.distinctCellCount >= 2);
  assert.ok(summary.coverageSlotCount >= 2);
  assert.ok(summary.effortQualityScore > 40);
});

test("vehicle transect coverage axes classify speed and time bands", () => {
  assert.equal(speedBandForMps(1), "slow");
  assert.equal(speedBandForMps(4), "urban_slow");
  assert.equal(speedBandForMps(10), "vehicle_transect");
  assert.equal(speedBandForMps(20), "fast_vehicle");
  assert.equal(timeBandForIso("2026-05-02T00:00:00.000Z"), "morning");

  const slot = coverageSlotForPoint({
    sessionId: "guide-test",
    lat: 34.7,
    lng: 137.7,
    observedAt: "2026-05-02T00:00:00.000Z",
    speedMps: 10,
  });
  assert.match(slot ?? "", /^guide_vehicle:/);
  assert.match(slot ?? "", /:morning:vehicle_transect$/);
});
