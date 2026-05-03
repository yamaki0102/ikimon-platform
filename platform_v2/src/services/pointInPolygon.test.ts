import assert from "node:assert/strict";
import test from "node:test";
import { pointInGeoJsonPolygon } from "./pointInPolygon.js";

test("Polygon: simple inside / outside", () => {
  const square = {
    type: "Polygon",
    coordinates: [[
      [137.0, 34.0], [138.0, 34.0], [138.0, 35.0], [137.0, 35.0], [137.0, 34.0],
    ]],
  };
  assert.equal(pointInGeoJsonPolygon(137.5, 34.5, square), true);
  assert.equal(pointInGeoJsonPolygon(136.0, 34.5, square), false);
  assert.equal(pointInGeoJsonPolygon(137.5, 36.0, square), false);
});

test("Polygon with hole: hole excludes inside", () => {
  const ring = {
    type: "Polygon",
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[3, 3], [3, 7], [7, 7], [7, 3], [3, 3]],
    ],
  };
  assert.equal(pointInGeoJsonPolygon(1, 1, ring), true);   // outside the hole
  assert.equal(pointInGeoJsonPolygon(5, 5, ring), false);  // inside the hole
});

test("MultiPolygon: any matching ring counts", () => {
  const mp = {
    type: "MultiPolygon",
    coordinates: [
      [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]],
    ],
  };
  assert.equal(pointInGeoJsonPolygon(0.5, 0.5, mp), true);
  assert.equal(pointInGeoJsonPolygon(10.5, 10.5, mp), true);
  assert.equal(pointInGeoJsonPolygon(5, 5, mp), false);
});

test("Feature wrapper unwraps to geometry", () => {
  const feature = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
  };
  assert.equal(pointInGeoJsonPolygon(0.5, 0.5, feature), true);
});

test("Malformed input never throws and returns false", () => {
  assert.equal(pointInGeoJsonPolygon(0, 0, null), false);
  assert.equal(pointInGeoJsonPolygon(0, 0, {}), false);
  assert.equal(pointInGeoJsonPolygon(0, 0, { type: "Polygon", coordinates: "bad" }), false);
});
