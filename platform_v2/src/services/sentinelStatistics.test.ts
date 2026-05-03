import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./sentinelStatistics.js";

const { bboxAround, isoDateBack } = __test__;

test("bboxAround produces a sensible square in degrees", () => {
  const [minLng, minLat, maxLng, maxLat] = bboxAround(35.0, 137.0, 1000);
  assert.ok(maxLat > minLat && maxLng > minLng);
  const widthDeg = maxLat - minLat;
  // ~1km in latitude is ~0.009 deg
  assert.ok(widthDeg > 0.005 && widthDeg < 0.05, `lat span ${widthDeg}`);
});

test("bboxAround clamps tiny / huge radii into 50m..20km", () => {
  const tiny = bboxAround(35, 137, 5);    // -> clamped to 50m
  const huge = bboxAround(35, 137, 1e9);  // -> clamped to 20km
  assert.ok(tiny[3]! - tiny[1]! > 0);
  assert.ok(huge[3]! - huge[1]! < 0.4); // ~20km is well under 0.4 deg
});

test("isoDateBack returns YYYY-MM-DD format", () => {
  const s = isoDateBack(7);
  assert.match(s, /^\d{4}-\d{2}-\d{2}$/);
});
