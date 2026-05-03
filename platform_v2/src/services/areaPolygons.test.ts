import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./areaPolygons.js";

const { cacheKey, defaultSourcesForZoom, SOURCE_LABEL } = __test__;

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

test("cacheKey rounds bbox to 0.1° so panning bursts hit the cache", () => {
  const a = cacheKey({ bbox: [137.501, 34.601, 137.502, 34.602], zoom: 12, sources: ["protected_area"] });
  const b = cacheKey({ bbox: [137.504, 34.604, 137.503, 34.605], zoom: 12.4, sources: ["protected_area"] });
  assert.equal(a, b);
});

test("cacheKey distinguishes different sources", () => {
  const a = cacheKey({ bbox: [137, 34, 138, 35], zoom: 10, sources: ["protected_area"] });
  const b = cacheKey({ bbox: [137, 34, 138, 35], zoom: 10, sources: ["osm_park"] });
  assert.notEqual(a, b);
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
