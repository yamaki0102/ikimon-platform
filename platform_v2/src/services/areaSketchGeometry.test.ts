import assert from "node:assert/strict";
import test from "node:test";
import {
  hasPolygonSelfIntersection,
  normalizeAreaSketchPolygon,
} from "./areaSketchGeometry.js";
import { circleToPolygon } from "./observationEventAreaGeometry.js";

test("area sketch normalization closes rough lines and removes near-duplicate points", () => {
  const result = normalizeAreaSketchPolygon([
    [137.7043, 34.6984],
    [137.70430001, 34.69840001],
    [137.706, 34.6984],
    [137.706, 34.6996],
    [137.7043, 34.6996],
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.isValidForAreaEstimate, true);
  assert.ok(result.polygon);
  const ring = result.polygon.coordinates[0]!;
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  assert.ok(result.cleanedPointCount < result.originalPointCount + 1);
  assert.ok(result.validation.areaHa && result.validation.areaHa > 0);
});

test("area sketch normalization treats self-intersection as a hard error", () => {
  const result = normalizeAreaSketchPolygon([
    [137.7043, 34.6984],
    [137.706, 34.6996],
    [137.706, 34.6984],
    [137.7043, 34.6996],
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.isValidForAreaEstimate, false);
  assert.equal(result.errors.includes("polygon_self_intersection"), true);
  assert.ok(result.polygon);
  assert.equal(hasPolygonSelfIntersection(result.polygon), true);
});

test("area sketch normalization reduces dense sketches to the configured point budget", () => {
  const dense = circleToPolygon(34.6984, 137.7043, 280, 48);
  const ring = dense.coordinates[0]!;
  const withExtraMidpoints = ring.flatMap((point, index) => {
    const next = ring[index + 1];
    if (!next) return [point];
    return [point, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2] as [number, number]];
  });

  const result = normalizeAreaSketchPolygon({ type: "Polygon", coordinates: [withExtraMidpoints] }, { maxPoints: 40 });

  assert.equal(result.ok, true);
  assert.ok(result.cleanedPointCount <= 40);
  assert.ok(result.removedPointCount > 0);
});
