import assert from "node:assert/strict";
import test from "node:test";
import { computeBbox } from "./geoJsonBbox.js";

test("computeBbox handles a simple GeoJSON Polygon", () => {
  const polygon = {
    type: "Polygon",
    coordinates: [[
      [137.0, 34.0],
      [137.5, 34.0],
      [137.5, 34.5],
      [137.0, 34.5],
      [137.0, 34.0],
    ]],
  };
  const bbox = computeBbox(polygon);
  assert.deepEqual(bbox, { minLat: 34.0, maxLat: 34.5, minLng: 137.0, maxLng: 137.5 });
});

test("computeBbox handles MultiPolygon", () => {
  const polygon = {
    type: "MultiPolygon",
    coordinates: [
      [[[130.0, 33.0], [131.0, 33.0], [131.0, 34.0], [130.0, 33.0]]],
      [[[140.0, 35.0], [141.0, 35.0], [141.0, 36.0], [140.0, 35.0]]],
    ],
  };
  const bbox = computeBbox(polygon);
  assert.deepEqual(bbox, { minLat: 33.0, maxLat: 36.0, minLng: 130.0, maxLng: 141.0 });
});

test("computeBbox uses the bbox property when present", () => {
  const polygon = {
    type: "Feature",
    bbox: [120.5, 25.5, 145.5, 45.5],
    geometry: null,
  };
  const bbox = computeBbox(polygon);
  assert.deepEqual(bbox, { minLat: 25.5, maxLat: 45.5, minLng: 120.5, maxLng: 145.5 });
});

test("computeBbox returns null for empty / malformed input", () => {
  assert.equal(computeBbox(null), null);
  assert.equal(computeBbox({}), null);
  assert.equal(computeBbox({ type: "Polygon", coordinates: [] }), null);
  assert.equal(computeBbox({ type: "Polygon", coordinates: [[["bad", "coord"]]] }), null);
});

test("computeBbox rejects out-of-range coords (e.g. projected XY mistaken for GeoJSON)", () => {
  // Web Mercator-style coordinates should be ignored — they aren't valid GeoJSON lng/lat.
  const polygon = { type: "Polygon", coordinates: [[[1500000, 4000000], [1500001, 4000001]]] };
  assert.equal(computeBbox(polygon), null);
});
