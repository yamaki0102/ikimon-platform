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
  isCompleteFreshLiveCache,
  filterAreaFeaturesBySources,
  hasFreshLiveOsmCacheCoverage,
  hasRequestedLiveOsmSourceCoverage,
  normalizeAreaLayerSource,
  isRenderableStoredAreaPolygon,
  toBiodiversityGroups,
  BIODIVERSITY_BADGE_WINDOW_MONTHS,
  LIVE_OSM_EMPTY_TTL_HOURS,
  LIVE_OSM_ENDPOINTS,
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
  assert.ok(zHigh.includes("school"));
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
  assert.match(query, /amenity/);
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

test("liveElementToFeature converts OSM schools into transient school areas", () => {
  const feature = liveElementToFeature({
    type: "way",
    id: 789,
    tags: { name: "浜松第一小学校", amenity: "school" },
    geometry: [
      { lat: 34.73, lon: 137.39 },
      { lat: 34.73, lon: 137.40 },
      { lat: 34.74, lon: 137.40 },
    ],
  });
  assert.equal(feature?.properties.source, "school");
  assert.equal(feature?.properties.source_label, "学校・キャンパス (OSM live)");
  assert.equal(feature?.properties.entity_key, "osm:way:789");
  assert.equal(feature?.properties.source_confidence, 0.45);
  assert.equal(feature?.properties.verification_level, "unverified");
  assert.equal(feature?.properties.verification_label, "未確認");
});

test("live OSM fallback respects selected area sources", () => {
  const park = liveElementToFeature({
    type: "way",
    id: 123,
    tags: { name: "亀城公園", leisure: "park" },
    geometry: [
      { lat: 34.73, lon: 137.39 },
      { lat: 34.73, lon: 137.40 },
      { lat: 34.74, lon: 137.40 },
    ],
  });
  const school = liveElementToFeature({
    type: "way",
    id: 456,
    tags: { name: "浜松小学校", amenity: "school" },
    geometry: [
      { lat: 34.71, lon: 137.72 },
      { lat: 34.71, lon: 137.73 },
      { lat: 34.72, lon: 137.73 },
    ],
  });

  assert.deepEqual(
    filterAreaFeaturesBySources([park!, school!], ["school"]).map((feature) => feature.properties.source),
    ["school"],
  );
  assert.deepEqual(
    filterAreaFeaturesBySources([park!, school!], ["protected_area", "oecm", "osm_park", "user_defined"]).map((feature) => feature.properties.source),
    ["osm_park"],
  );
});

test("stored school point-buffer fallbacks are not rendered as real area polygons", () => {
  assert.equal(isRenderableStoredAreaPolygon("school", {
    boundary_approximation: "point_buffer",
    boundary_radius_m: 160,
  }), false);
});

test("stored school polygons enriched with an actual boundary still render", () => {
  assert.equal(isRenderableStoredAreaPolygon("school", {
    boundary_approximation: "point_buffer",
    school_boundary: { source: "osm", matched_name: "浜松第一小学校" },
  }), true);
});

test("stored school point-buffer circles stay hidden even if metadata says boundary matched", () => {
  const center = { lat: 34.7235934, lng: 137.7120329 };
  const radiusM = 160;
  const ring: number[][] = [];
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = 111_320 * Math.cos(center.lat * Math.PI / 180);
  for (let i = 0; i < 28; i += 1) {
    const angle = (2 * Math.PI * i) / 28;
    ring.push([
      Number((center.lng + (Math.cos(angle) * radiusM) / metersPerDegreeLng).toFixed(7)),
      Number((center.lat + (Math.sin(angle) * radiusM) / metersPerDegreeLat).toFixed(7)),
    ]);
  }
  ring.push(ring[0]!.slice());

  assert.equal(isRenderableStoredAreaPolygon("school", {
    boundary_approximation: "point_buffer",
    school_boundary: { source: "osm", matched_name: "静岡県立浜松商業高等学校" },
  }, { type: "Polygon", coordinates: [ring] }), false);
  assert.equal(isRenderableStoredAreaPolygon("school", null, { type: "Polygon", coordinates: [ring] }), false);
});

test("stored school point-buffer rows render when the geometry is no longer a generated circle", () => {
  assert.equal(isRenderableStoredAreaPolygon("school", {
    boundary_approximation: "point_buffer",
    school_boundary: { source: "osm", matched_name: "浜松第一小学校" },
  }, {
    type: "Polygon",
    coordinates: [[
      [137.39, 34.73],
      [137.401, 34.731],
      [137.402, 34.738],
      [137.394, 34.739],
      [137.39, 34.73],
    ]],
  }), true);
});

test("non-school stored polygons are unaffected by point-buffer payload metadata", () => {
  assert.equal(isRenderableStoredAreaPolygon("osm_park", {
    boundary_approximation: "point_buffer",
  }), true);
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

test("empty live OSM tile cache is not treated as complete park evidence", () => {
  assert.equal(isCompleteFreshLiveCache(4, 4, 0), false);
  assert.equal(isCompleteFreshLiveCache(3, 4, 12), false);
  assert.equal(isCompleteFreshLiveCache(4, 4, 12), true);
});

test("fresh live OSM cache must cover every requested live source before skipping fetch", () => {
  const park = liveElementToFeature({
    type: "way",
    id: 901,
    tags: { name: "伊場遺跡公園", leisure: "park" },
    geometry: [
      { lat: 34.70, lon: 137.70 },
      { lat: 34.70, lon: 137.71 },
      { lat: 34.71, lon: 137.71 },
    ],
  });
  const school = liveElementToFeature({
    type: "way",
    id: 902,
    tags: { name: "浜松第一小学校", amenity: "school" },
    geometry: [
      { lat: 34.71, lon: 137.71 },
      { lat: 34.71, lon: 137.72 },
      { lat: 34.72, lon: 137.72 },
    ],
  });

  assert.ok(park);
  assert.ok(school);
  assert.equal(hasRequestedLiveOsmSourceCoverage(["school", "osm_park"], [park]), false);
  assert.equal(hasRequestedLiveOsmSourceCoverage(["school", "osm_park"], [park, school]), true);
  assert.equal(hasFreshLiveOsmCacheCoverage(["school", "osm_park"], [park], true), false);
  assert.equal(hasFreshLiveOsmCacheCoverage(["school", "osm_park"], [park, school], true), true);
  assert.equal(hasFreshLiveOsmCacheCoverage(["school", "osm_park"], [park, school], false), false);
});

test("live OSM fetch has fallback endpoints and short empty-cache TTL", () => {
  assert.ok(LIVE_OSM_ENDPOINTS.includes("https://overpass-api.de/api/interpreter"));
  assert.ok(LIVE_OSM_ENDPOINTS.includes("https://z.overpass-api.de/api/interpreter"));
  assert.ok(LIVE_OSM_EMPTY_TTL_HOURS <= 6);
});

test("toBiodiversityGroups exposes presence-only groups inside the 24 month badge window", () => {
  const groups = toBiodiversityGroups([
    { scientific_name: "Parus minor", vernacular_name: "シジュウカラ" },
    { scientific_name: "Papilio xuthus", vernacular_name: "アゲハ" },
    { scientific_name: "Quercus serrata", vernacular_name: "コナラ" },
    { scientific_name: "Parus minor", vernacular_name: "シジュウカラ" },
  ]);
  assert.deepEqual(groups.map((item) => item.group), ["bird", "insect", "plant"]);
  assert.ok(groups.every((item) => item.window_months === BIODIVERSITY_BADGE_WINDOW_MONTHS));
  assert.ok(groups.every((item) => !("count" in item)));
});

test("SOURCE_LABEL covers every supported source", () => {
  const required = [
    "user_defined", "nature_symbiosis_site", "tsunag", "protected_area", "oecm",
    "school", "osm_park", "admin_municipality", "admin_prefecture", "admin_country",
  ] as const;
  for (const src of required) {
    assert.ok(SOURCE_LABEL[src] && SOURCE_LABEL[src].length > 0, `missing label for ${src}`);
  }
});

test("normalizeAreaLayerSource keeps certified site sources visible in map filters", () => {
  assert.equal(normalizeAreaLayerSource("nature_symbiosis_site", "symbiosis"), "nature_symbiosis_site");
  assert.equal(normalizeAreaLayerSource("protected_area", "protected"), "protected_area");
  assert.equal(normalizeAreaLayerSource("tsunag", "tsunag"), "tsunag");
});

test("normalizeAreaLayerSource uses admin-level layer ids only for admin and OSM compatibility rows", () => {
  assert.equal(normalizeAreaLayerSource("user_defined", "osm_park"), "osm_park");
  assert.equal(normalizeAreaLayerSource("user_defined", "admin_municipality"), "admin_municipality");
  assert.equal(normalizeAreaLayerSource("school", "school"), "school");
});
