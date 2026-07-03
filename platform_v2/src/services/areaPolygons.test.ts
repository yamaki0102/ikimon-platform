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
  bboxForTiles,
  featureTouchesBbox,
  isCompleteFreshLiveCache,
  filterAreaFeaturesBySources,
  prioritizeLiveOsmFeaturesForRequest,
  normalizeAreaLayerSource,
  isRenderableStoredAreaPolygon,
  isApproximateSchoolBoundary,
  approximateSchoolBoundaryLabel,
  approximateSchoolSourceConfidence,
  approximateRadiusBoundaryLabel,
  canUseRadiusFallbackAreaSource,
  radiusFallbackMeters,
  radiusFallbackGeometry,
  isDisplayableAreaFeature,
  shouldFetchLiveOsm,
  shouldSupplementLiveOsm,
  hasRequestedLiveOsmSourceCoverage,
  hasFreshLiveOsmCacheCoverage,
  areaLayerSourceSortSql,
  normalizeGuideStop,
  toBiodiversityGroups,
  BIODIVERSITY_BADGE_WINDOW_MONTHS,
  LIVE_OSM_EMPTY_TTL_HOURS,
  LIVE_OSM_ENDPOINTS,
  LIVE_OSM_TILE_FETCH_LIMIT,
  SOURCE_LABEL,
} = __test__;

test("defaultSourcesForZoom widens with zoom level", () => {
  // Under z8 only broad admin context is requested. At z>=9 registered
  // human-scale areas are included so mobile users can discover parks/schools
  // before zooming to a single block.
  const zLow = defaultSourcesForZoom(5);
  const zMid = defaultSourcesForZoom(9);
  const zHigh = defaultSourcesForZoom(13);

  assert.ok(zLow.includes("admin_country"));
  assert.ok(!zLow.includes("protected_area"));

  assert.ok(zMid.includes("protected_area"));
  assert.ok(zMid.includes("nature_symbiosis_site"));
  assert.ok(zMid.includes("osm_park"));
  assert.ok(zMid.includes("school"));

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
  assert.match(query, /playground/);
  assert.match(query, /recreation_ground/);
  assert.match(query, /landuse"\="grass"\]\["name"\]/);
  assert.match(query, /amenity/);
  assert.match(query, /kindergarten/);
  assert.match(query, /landuse/);
  assert.match(query, /building/);
});

test("buildLiveOsmAreaQuery can scope expensive live fallback by requested source", () => {
  const schoolQuery = buildLiveOsmAreaQuery([137.39, 34.73, 137.43, 34.75], ["school"]);
  assert.match(schoolQuery, /amenity/);
  assert.match(schoolQuery, /building/);
  assert.doesNotMatch(schoolQuery, /leisure/);
  assert.doesNotMatch(schoolQuery, /recreation_ground/);

  const parkQuery = buildLiveOsmAreaQuery([137.39, 34.73, 137.43, 34.75], ["osm_park"]);
  assert.match(parkQuery, /leisure/);
  assert.match(parkQuery, /playground/);
  assert.doesNotMatch(parkQuery, /amenity/);
  assert.doesNotMatch(parkQuery, /building/);
});

test("liveElementToFeature treats playground polygons as park areas", () => {
  const feature = liveElementToFeature({
    type: "way",
    id: 263321118,
    tags: { name: "西伊場第三公園", leisure: "playground" },
    geometry: [
      { lat: 34.6961, lon: 137.6997 },
      { lat: 34.6961, lon: 137.7005 },
      { lat: 34.6966, lon: 137.7005 },
    ],
  });

  assert.equal(feature?.properties.source, "osm_park");
  assert.equal(feature?.properties.name, "西伊場第三公園");
  assert.equal(feature?.properties.entity_key, "osm:way:263321118");
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
    tags: { name: "浜松第一小学校", amenity: "school", website: "https://example.test/school" },
    geometry: [
      { lat: 34.73, lon: 137.39 },
      { lat: 34.73, lon: 137.40 },
      { lat: 34.74, lon: 137.40 },
    ],
  });
  assert.equal(feature?.properties.source, "school");
  assert.equal(feature?.properties.source_label, "学校・キャンパス (OSM live)");
  assert.equal(feature?.properties.entity_key, "osm:way:789");
  assert.equal(feature?.properties.source_confidence, 0.75);
  assert.equal(feature?.properties.verification_level, "unverified");
  assert.equal(feature?.properties.verification_label, "公式ページ候補あり");
});

test("liveElementToFeature rejects building-only OSM fragments", () => {
  const schoolBuilding = liveElementToFeature({
    type: "way",
    id: 603994619,
    tags: { building: "school", source: "GSImaps/ort" },
    geometry: [
      { lat: 34.73, lon: 137.39 },
      { lat: 34.73, lon: 137.40 },
      { lat: 34.74, lon: 137.40 },
    ],
  });
  const kindergartenBuilding = liveElementToFeature({
    type: "way",
    id: 714620742,
    tags: { building: "kindergarten" },
    geometry: [
      { lat: 34.73, lon: 137.39 },
      { lat: 34.73, lon: 137.40 },
      { lat: 34.74, lon: 137.40 },
    ],
  });

  assert.equal(schoolBuilding, null);
  assert.equal(kindergartenBuilding, null);
});

test("liveElementToFeature treats OSM education landuse and named education buildings as school", () => {
  const educationLanduse = liveElementToFeature({
    type: "way",
    id: 790,
    tags: { name: "西伊場こども園", landuse: "education" },
    geometry: [
      { lat: 34.73, lon: 137.39 },
      { lat: 34.73, lon: 137.40 },
      { lat: 34.74, lon: 137.40 },
    ],
  });
  const schoolBuilding = liveElementToFeature({
    type: "way",
    id: 791,
    tags: { name: "浜松小学校 校舎", building: "school" },
    geometry: [
      { lat: 34.71, lon: 137.72 },
      { lat: 34.71, lon: 137.73 },
      { lat: 34.72, lon: 137.73 },
    ],
  });

  assert.equal(educationLanduse?.properties.source, "school");
  assert.equal(schoolBuilding?.properties.source, "school");
  assert.equal(schoolBuilding?.properties.verification_level, "unverified");
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

test("stored school point-buffer fallbacks are not rendered as area polygons", () => {
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

test("stored school point-buffer circles are filtered even when metadata is weak", () => {
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

  const pointBufferPayload = {
    boundary_approximation: "point_buffer",
    school_boundary: { source: "osm", matched_name: "静岡県立浜松商業高等学校" },
  };

  assert.equal(isRenderableStoredAreaPolygon("school", pointBufferPayload, { type: "Polygon", coordinates: [ring] }), false);
  assert.equal(isApproximateSchoolBoundary("school", pointBufferPayload, { type: "Polygon", coordinates: [ring] }), true);
  assert.equal(isRenderableStoredAreaPolygon("school", null, { type: "Polygon", coordinates: [ring] }), false);
  assert.equal(isApproximateSchoolBoundary("school", null, { type: "Polygon", coordinates: [ring] }), true);
});

test("approximate school trust metadata stays conservative", () => {
  assert.equal(approximateSchoolSourceConfidence(0), 0);
  assert.equal(approximateSchoolSourceConfidence(0.2), 0.2);
  assert.equal(approximateSchoolSourceConfidence(0.75), 0.35);
  assert.equal(approximateSchoolSourceConfidence(Number.NaN), 0);
  assert.equal(approximateSchoolBoundaryLabel(""), "境界未確認・代表点からの仮範囲");
  assert.equal(
    approximateSchoolBoundaryLabel("公式ページ候補あり"),
    "境界未確認・代表点からの仮範囲 / 公式ページ候補あり",
  );
});

test("default z9 park and school visibility does not trigger live OSM fallback", () => {
  const query = { bbox: [137.3, 34.6, 137.8, 34.9] as [number, number, number, number], zoom: 9 };
  const sources = defaultSourcesForZoom(query.zoom);
  assert.ok(sources.includes("osm_park"));
  assert.ok(sources.includes("school"));
  assert.equal(shouldFetchLiveOsm(query, sources), false);
  assert.equal(shouldFetchLiveOsm({ ...query, zoom: 13, bbox: [137.3, 34.6, 137.8, 34.9] }, sources), false);
  assert.equal(shouldFetchLiveOsm({ ...query, zoom: 13, bbox: [137.7, 34.7, 137.75, 34.75] }, sources), true);
});

test("live OSM supplement continues when stored park or school coverage is partial", () => {
  const query = { bbox: [137.70, 34.69, 137.72, 34.71] as [number, number, number, number], zoom: 16 };
  const sources = ["school", "osm_park"] as const;
  const storedSchool = liveElementToFeature({
    type: "way",
    id: 777,
    tags: { name: "浜松第一小学校", amenity: "school" },
    geometry: [
      { lat: 34.70, lon: 137.70 },
      { lat: 34.70, lon: 137.71 },
      { lat: 34.71, lon: 137.71 },
    ],
  });
  assert.ok(storedSchool);
  assert.equal(shouldSupplementLiveOsm(query, [...sources], [storedSchool], 50), true);
  assert.equal(shouldSupplementLiveOsm(query, ["protected_area"], [storedSchool], 50), false);
  assert.equal(shouldSupplementLiveOsm({ ...query, zoom: 12 }, [...sources], [storedSchool], 50), false);
  const fullFeatures = Array.from({ length: 50 }, (_, i) => ({
    ...storedSchool,
    properties: {
      ...storedSchool.properties,
      field_id: `stored-school:${i}`,
      entity_key: `stored-school:${i}`,
    },
  }));
  assert.equal(shouldSupplementLiveOsm(query, [...sources], fullFeatures, 50), false);
});

test("fresh live OSM cache must cover each requested live source before skipping fetch", () => {
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
  const approximateStoredSchool = {
    ...school,
    properties: { ...school.properties, approximate_boundary: true },
  };

  assert.equal(hasRequestedLiveOsmSourceCoverage(["school", "osm_park"], [park]), false);
  assert.equal(hasRequestedLiveOsmSourceCoverage(["school", "osm_park"], [park, approximateStoredSchool]), false);
  assert.equal(hasRequestedLiveOsmSourceCoverage(["school", "osm_park"], [park, school]), true);
  assert.equal(hasRequestedLiveOsmSourceCoverage(["osm_park"], [park]), true);
});

test("fresh live OSM cache coverage is decided only from cached live features", () => {
  const storedPark = liveElementToFeature({
    type: "way",
    id: 263321118,
    tags: { name: "西伊場第三公園", leisure: "playground" },
    geometry: [
      { lat: 34.6961, lon: 137.6997 },
      { lat: 34.6961, lon: 137.7005 },
      { lat: 34.6966, lon: 137.7005 },
    ],
  });
  assert.ok(storedPark);

  assert.equal(hasRequestedLiveOsmSourceCoverage(["osm_park"], [storedPark]), true);
  assert.equal(hasFreshLiveOsmCacheCoverage(["osm_park"], [], true), false);
  assert.equal(hasFreshLiveOsmCacheCoverage(["osm_park"], [storedPark], false), false);
  assert.equal(hasFreshLiveOsmCacheCoverage(["osm_park"], [storedPark], true), true);
});

test("live OSM request priority keeps schools from being starved by earlier park results", () => {
  const parkA = liveElementToFeature({
    type: "way",
    id: 263321118,
    tags: { name: "西伊場第三公園", leisure: "playground" },
    geometry: [
      { lat: 34.6961, lon: 137.6997 },
      { lat: 34.6961, lon: 137.7005 },
      { lat: 34.6966, lon: 137.7005 },
    ],
  });
  const parkB = liveElementToFeature({
    type: "way",
    id: 263321119,
    tags: { name: "西伊場第一公園", leisure: "park" },
    geometry: [
      { lat: 34.6971, lon: 137.7017 },
      { lat: 34.6971, lon: 137.7025 },
      { lat: 34.6976, lon: 137.7025 },
    ],
  });
  const school = liveElementToFeature({
    type: "way",
    id: 194423250,
    tags: { name: "浜松市立鴨江小学校", amenity: "school" },
    geometry: [
      { lat: 34.701, lon: 137.704 },
      { lat: 34.701, lon: 137.705 },
      { lat: 34.702, lon: 137.705 },
    ],
  });
  assert.ok(parkA);
  assert.ok(parkB);
  assert.ok(school);

  const prioritized = prioritizeLiveOsmFeaturesForRequest([parkA, parkB, school], ["school", "osm_park"], 2);
  assert.deepEqual(prioritized.map((feature) => feature.properties.source), ["school", "osm_park"]);
  assert.equal(prioritized[0]?.properties.name, "浜松市立鴨江小学校");
});

test("live OSM supplements stored school and park rows at high zoom", () => {
  const query = { bbox: [137.70, 34.70, 137.75, 34.75] as [number, number, number, number], zoom: 13 };
  const storedSchool = liveElementToFeature({
    type: "way",
    id: 101,
    tags: { name: "Stored school equivalent", amenity: "school" },
    geometry: [
      { lat: 34.72, lon: 137.72 },
      { lat: 34.72, lon: 137.73 },
      { lat: 34.73, lon: 137.73 },
    ],
  });
  assert.ok(storedSchool);
  assert.equal(shouldSupplementLiveOsm(query, ["school", "osm_park"], [storedSchool!], 20), true);
  assert.equal(shouldSupplementLiveOsm(query, ["school", "osm_park"], [storedSchool!], 1), false);
  assert.equal(shouldSupplementLiveOsm({ ...query, zoom: 10 }, ["school", "osm_park"], [storedSchool!], 20), false);
});

test("area layer SQL prioritizes human-scale school and park areas before admin layers", () => {
  const orderSql = areaLayerSourceSortSql();
  assert.match(orderSql, /WHEN 'school' THEN 0/);
  assert.match(orderSql, /WHEN 'osm_park' THEN 1/);
  assert.match(orderSql, /WHEN 'admin_municipality' THEN 7/);
  assert.ok(orderSql.indexOf("WHEN 'school' THEN 0") < orderSql.indexOf("WHEN 'admin_municipality' THEN 7"));
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

test("non-school certified areas without polygons can render as conservative radius areas", () => {
  const geometry = radiusFallbackGeometry(139.774, 35.683, 200);

  assert.equal(canUseRadiusFallbackAreaSource("nature_symbiosis_site"), true);
  assert.equal(canUseRadiusFallbackAreaSource("tsunag"), true);
  assert.equal(canUseRadiusFallbackAreaSource("protected_area"), true);
  assert.equal(canUseRadiusFallbackAreaSource("oecm"), true);
  assert.equal(canUseRadiusFallbackAreaSource("school"), false);
  assert.equal(canUseRadiusFallbackAreaSource("user_defined"), false);
  assert.ok(geometry);
  assert.equal(geometry?.type, "Polygon");
  assert.equal(radiusFallbackMeters(10), 80);
  assert.equal(radiusFallbackMeters(99999), 2500);
  assert.equal(approximateRadiusBoundaryLabel(""), "中心点からの概略範囲");
  assert.equal(approximateRadiusBoundaryLabel("認定情報と一致"), "中心点からの概略範囲 / 認定情報と一致");

  assert.equal(isDisplayableAreaFeature({
    type: "Feature",
    geometry,
    properties: {
      field_id: "tsunag-radius",
      name: "TSUNAG サンプル",
      source: "tsunag",
      source_label: "TSUNAG",
      admin_level: "tsunag",
      prefecture: "東京都",
      city: "中央区",
      area_ha: 0.8,
      official_url: "",
      owner_url: "",
      story_url: "",
      certification_url: "",
      source_confidence: 0.75,
      verification_level: "registry_matched",
      verification_label: "中心点からの概略範囲",
      center: [139.774, 35.683],
      approximate_boundary: true,
      boundary_approximation: "radius",
    },
  }), true);
});

test("displayable area feature filter keeps named OSM school polygons visible but unverified", () => {
  const weakUnnamedSchool = liveElementToFeature({
    type: "way",
    id: 1234,
    tags: { amenity: "school" },
    geometry: [
      { lat: 34.73, lon: 137.39 },
      { lat: 34.73, lon: 137.40 },
      { lat: 34.74, lon: 137.40 },
    ],
  });
  const namedSchoolWithoutOfficialUrl = liveElementToFeature({
    type: "way",
    id: 1236,
    tags: { name: "西伊場小学校", amenity: "school" },
    geometry: [
      { lat: 34.73, lon: 137.39 },
      { lat: 34.73, lon: 137.40 },
      { lat: 34.74, lon: 137.40 },
    ],
  });
  const namedSchoolBuildingWithoutAmenity = liveElementToFeature({
    type: "way",
    id: 1237,
    tags: { name: "西伊場小学校 校舎", building: "school" },
    geometry: [
      { lat: 34.731, lon: 137.391 },
      { lat: 34.731, lon: 137.392 },
      { lat: 34.732, lon: 137.392 },
    ],
  });
  const officialSchool = liveElementToFeature({
    type: "way",
    id: 1235,
    tags: { name: "公式小学校", amenity: "school", website: "https://example.test/school" },
    geometry: [
      { lat: 34.73, lon: 137.39 },
      { lat: 34.73, lon: 137.40 },
      { lat: 34.74, lon: 137.40 },
    ],
  });

  assert.equal(weakUnnamedSchool ? isDisplayableAreaFeature(weakUnnamedSchool) : true, false);
  assert.equal(namedSchoolWithoutOfficialUrl ? isDisplayableAreaFeature(namedSchoolWithoutOfficialUrl) : false, true);
  assert.equal(namedSchoolWithoutOfficialUrl?.properties.source_confidence, 0.45);
  assert.equal(namedSchoolWithoutOfficialUrl?.properties.verification_level, "unverified");
  assert.equal(namedSchoolWithoutOfficialUrl?.properties.osm_named, true);
  assert.equal(weakUnnamedSchool?.properties.osm_named, false);
  assert.equal(namedSchoolBuildingWithoutAmenity?.properties.source, "school");
  assert.equal(namedSchoolBuildingWithoutAmenity ? isDisplayableAreaFeature(namedSchoolBuildingWithoutAmenity) : false, true);
  assert.equal(officialSchool ? isDisplayableAreaFeature(officialSchool) : false, true);
  assert.equal(isDisplayableAreaFeature({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [] },
    properties: {
      field_id: "approx",
      name: "仮範囲",
      source: "school",
      source_label: "学校",
      admin_level: "school",
      prefecture: "",
      city: "",
      area_ha: null,
      official_url: "",
      owner_url: "",
      story_url: "",
      certification_url: "",
      source_confidence: 0.35,
      verification_level: "registry_matched",
      verification_label: "境界未確認・代表点からの仮範囲",
      center: [137.39, 34.73],
      approximate_boundary: true,
      boundary_approximation: "point_buffer",
    },
  }), false);
});

test("normalizeGuideStop keeps approved location guide stops bounded for map delivery", () => {
  const stop = normalizeGuideStop({
    enabled: true,
    title: " 連理の木とLENRIの物語 ",
    preview: " 現地で聞く場所ストーリー ",
    script: " 連理の木、れんり農園、LENRIのつながりを紹介します。 ",
    story_points: ["食と農", "", "自然共生", "設備技術"],
    variants: {
      ja: {
        language: "ja",
        title: "Cafe & Restaurant LENRIと連理の木",
        preview: "現地で聞く場所ストーリー",
        script: "カフェアンドレストランレンリの物語です。",
        tts_script: "カフェアンドレストランレンリの物語です。",
        audio_url: "/assets/audio/guides/lenri/lenri-guide-ja.mp3",
        audio_provider: "irodori-tts",
        audio_voice: "lenri-guide",
        story_points: ["読み方を固定"],
      },
      "zh-TW": {
        language: "zh-TW",
        title: "Cafe & Restaurant LENRI 與連理木",
        preview: "靠近時播放",
        script: "這裡是連理木的故事。",
        audio_url: "/assets/audio/guides/lenri/lenri-guide-zh-TW.mp3",
        story_points: ["繁體中文"],
      },
      xx: {
        language: "xx",
        title: "drop",
        preview: "drop",
        script: "drop",
        story_points: [],
      },
    },
    source_links: [
      { label: "愛管株式会社: 生物多様性", url: "https://i-kan.co.jp/company/biodiversity/" },
      { label: "", url: "https://example.com/empty-label" },
      { label: "不正なURL", url: "javascript:alert(1)" },
    ],
    trigger_radius_m: 900,
    unlocked_radius_m: 3,
    approved_by: "愛管株式会社",
    approval_state: "owner_verified",
  });

  assert.equal(stop?.title, "連理の木とLENRIの物語");
  assert.equal(stop?.approval_state, "owner_verified");
  assert.equal(stop?.trigger_radius_m, 300);
  assert.equal(stop?.unlocked_radius_m, 20);
  assert.deepEqual(stop?.story_points, ["食と農", "自然共生", "設備技術"]);
  assert.equal(stop?.variants?.ja?.audio_provider, "irodori-tts");
  assert.equal(stop?.variants?.ja?.tts_script, "カフェアンドレストランレンリの物語です。");
  assert.equal(stop?.variants?.["zh-TW"]?.audio_url, "/assets/audio/guides/lenri/lenri-guide-zh-TW.mp3");
  assert.equal(stop?.variants?.xx, undefined);
  assert.deepEqual(stop?.source_links, [
    { label: "愛管株式会社: 生物多様性", url: "https://i-kan.co.jp/company/biodiversity/" },
  ]);
});

test("normalizeGuideStop rejects disabled or content-empty guide stops", () => {
  assert.equal(normalizeGuideStop({ enabled: false, title: "x", preview: "x" }), undefined);
  assert.equal(normalizeGuideStop({ enabled: true, title: "x" }), undefined);
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

test("bboxForTiles expands live cache fetches to complete tile coverage", () => {
  const viewport: [number, number, number, number] = [137.6998, 34.6958, 137.7010, 34.6968];
  const tiles = tilesForBbox(viewport);
  const bbox = bboxForTiles(tiles);

  assert.ok(bbox);
  assert.ok(bbox[0] <= viewport[0]);
  assert.ok(bbox[1] <= viewport[1]);
  assert.ok(bbox[2] >= viewport[2]);
  assert.ok(bbox[3] >= viewport[3]);
  assert.ok(LIVE_OSM_TILE_FETCH_LIMIT >= 300);
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
