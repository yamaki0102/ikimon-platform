import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./areaPolygons.js";

const {
  cacheKey,
  defaultSourcesForZoom,
  buildLiveOsmAreaQuery,
  liveElementToFeature,
  tileForLngLat,
  tilesForBbox,
  featureTouchesBbox,
  SOURCE_LABEL,
} = __test__;

test("defaultSourcesForZoom widens with zoom level", () => {
  // Phase 1: under z8 only the heavy admin layers (still a placeholder set
  // since admin polygons land in Phase 2). At z>=10 every source is enabled.
  const zLow = defaultSourcesForZoom(5);
  const zMid = defaultSourcesForZoom(9);
  const zHigh = defaultSourcesForZoom(13);

  assert.ok(zLow.includes("admin_country"));
  assert.ok(!zLow.includes("protected_area"));

  assert.ok(zMid.includes("protected_area"));
  assert.ok(zMid.includes("nature_symbiosis_site"));
  assert.ok(!zMid.includes("osm_park"));

  assert.ok(zHigh.includes("osm_park"));
  assert.ok(zHigh.includes("admin_municipality"));
});

test("cacheKey keeps high-precision bbox so small park click targets are not reused from nearby viewports", () => {
  const a = cacheKey({ bbox: [137.501, 34.601, 137.502, 34.602], zoom: 12, sources: ["protected_area"] });
  const b = cacheKey({ bbox: [137.504, 34.604, 137.503, 34.605], zoom: 12.4, sources: ["protected_area"] });
  assert.notEqual(a, b);
});

test("cacheKey distinguishes different sources", () => {
  const a = cacheKey({ bbox: [137, 34, 138, 35], zoom: 10, sources: ["protected_area"] });
  const b = cacheKey({ bbox: [137, 34, 138, 35], zoom: 10, sources: ["osm_park"] });
  assert.notEqual(a, b);
});

test("cacheKey distinguishes different limits", () => {
  const a = cacheKey({ bbox: [137, 34, 138, 35], zoom: 10, sources: ["osm_park"], limit: 10 });
  const b = cacheKey({ bbox: [137, 34, 138, 35], zoom: 10, sources: ["osm_park"], limit: 100 });
  assert.notEqual(a, b);
});

test("buildLiveOsmAreaQuery uses Overpass south,west,north,east order", () => {
  const query = buildLiveOsmAreaQuery([137.39, 34.73, 137.43, 34.75]);
  assert.match(query, /\(34\.73,137\.39,34\.75,137\.43\)/);
  assert.match(query, /leisure/);
});

test("liveElementToFeature converts OSM way into transient area feature", () => {
  const feature = liveElementToFeature({
    type: "way",
    id: 123,
    tags: { name: "亀城公園", leisure: "park" },
    geometry: [
      { lat: 34.73, lon: 137.39 },
      { lat: 34.73, lon: 137.40 },
      { lat: 34.74, lon: 137.40 },
    ],
  });
  assert.equal(feature?.properties.field_id, "osm-live:way:123");
  assert.equal(feature?.properties.transient, true);
  assert.equal(feature?.properties.name, "亀城公園");
  assert.equal(feature?.geometry?.type, "Polygon");
});

test("tilesForBbox returns bounded web mercator tile keys", () => {
  const tiles = tilesForBbox([137.39, 34.73, 137.43, 34.75]);
  assert.ok(tiles.length > 0);
  assert.ok(tiles.length <= 24);
  assert.ok(tiles.every((tile) => tile.z === 14));
  const one = tileForLngLat(137.41, 34.74);
  assert.ok(tiles.some((tile) => tile.x === one.x && tile.y === one.y));
});

test("featureTouchesBbox keeps cached tile features local to the current viewport", () => {
  const feature = liveElementToFeature({
    type: "way",
    id: 456,
    tags: { name: "Viewport Park", leisure: "park" },
    geometry: [
      { lat: 34.739, lon: 137.409 },
      { lat: 34.739, lon: 137.411 },
      { lat: 34.741, lon: 137.411 },
    ],
  });
  assert.equal(feature ? featureTouchesBbox(feature, [137.40, 34.73, 137.42, 34.75]) : false, true);
  assert.equal(feature ? featureTouchesBbox(feature, [138.00, 35.00, 138.02, 35.02]) : true, false);
});

test("SOURCE_LABEL covers every supported source", () => {
  const required = [
    "user_defined", "nature_symbiosis_site", "tsunag", "protected_area", "oecm",
    "osm_park", "admin_municipality", "admin_prefecture", "admin_country",
  ] as const;
  for (const src of required) {
    assert.ok(SOURCE_LABEL[src] && SOURCE_LABEL[src].length > 0, `missing label for ${src}`);
  }
});
