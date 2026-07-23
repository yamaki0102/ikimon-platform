import assert from "node:assert/strict";
import test from "node:test";
import {
  bboxForPlaceGeometry,
  classifyOsmPlaceKind,
  collectOsmPlaceNames,
  decideRecordPlaceMembership,
  dedupePlaceCandidates,
  defaultPlacePolicy,
  initialCanonicalPlaceId,
  isDiscoverableNamedArea,
  normalizePlaceSearchText,
  pointInPlaceGeometry,
  publicMembershipProjection,
  type PlaceCandidate,
  type PlaceGeometry,
} from "./placeDomain.js";

const square: PlaceGeometry = {
  type: "Polygon",
  coordinates: [[
    [137.0, 34.0],
    [137.01, 34.0],
    [137.01, 34.01],
    [137.0, 34.01],
    [137.0, 34.0],
  ]],
};

test("classifies the generic named-area families without mixing source and kind", () => {
  assert.equal(classifyOsmPlaceKind({ tourism: "theme_park" }), "theme_park");
  assert.equal(classifyOsmPlaceKind({ shop: "mall" }), "shopping_mall");
  assert.equal(classifyOsmPlaceKind({ shop: "shopping_centre" }), "shopping_mall");
  assert.equal(classifyOsmPlaceKind({ landuse: "retail" }), "commercial_complex");
  assert.equal(classifyOsmPlaceKind({ tourism: "museum" }), "museum");
  assert.equal(classifyOsmPlaceKind({ tourism: "zoo" }), "zoo");
  assert.equal(classifyOsmPlaceKind({ tourism: "aquarium" }), "aquarium");
  assert.equal(classifyOsmPlaceKind({ leisure: "stadium" }), "stadium");
  assert.equal(classifyOsmPlaceKind({ leisure: "sports_centre" }), "sports_facility");
  assert.equal(classifyOsmPlaceKind({ amenity: "marketplace" }), "market");
  assert.equal(classifyOsmPlaceKind({ landuse: "orchard" }), "farm");
  assert.equal(classifyOsmPlaceKind({ amenity: "place_of_worship" }), "temple_shrine");
  assert.equal(classifyOsmPlaceKind({ tourism: "attraction" }), "other_named_area");
  assert.equal(classifyOsmPlaceKind({ building: "retail" }), null);
});

test("name selection keeps display name and aliases separate", () => {
  const names = collectOsmPlaceNames({
    name: "JUNGLIA OKINAWA",
    "name:ja": "ジャングリア沖縄",
    "name:en": "Junglia Okinawa",
    alt_name: "ジャングリア;JUNGLIA",
    old_name: "旧計画名",
  });
  assert.equal(names.canonicalName, "ジャングリア沖縄");
  assert.ok(names.aliases.includes("JUNGLIA OKINAWA"));
  assert.ok(names.aliases.includes("ジャングリア"));
  assert.ok(names.aliases.includes("JUNGLIA"));
  assert.equal(names.multilingualNames.en, "Junglia Okinawa");
});

test("specific facility name beats a localized tag that is only the brand", () => {
  const names = collectOsmPlaceNames({
    name: "イオンモール浜松市野",
    "name:ja": "イオン",
    brand: "イオン",
    "brand:en": "AEON",
  });
  assert.equal(names.canonicalName, "イオンモール浜松市野");
  assert.equal(names.canonicalNameSource, "name");
  assert.ok(names.aliases.includes("イオン"));
});

test("search normalization resolves explicit aliases without changing canonical display", () => {
  assert.equal(normalizePlaceSearchText("JUNGLIA OKINAWA"), "jungliaokinawa");
  assert.equal(normalizePlaceSearchText("ＪＵＮＧＬＩＡ　ＯＫＩＮＡＷＡ"), "jungliaokinawa");
  assert.notEqual(normalizePlaceSearchText("常盤公園"), normalizePlaceSearchText("常磐公園"));
});

test("initial place ID is independent of OSM IDs", () => {
  const first = initialCanonicalPlaceId({
    canonicalName: "ジャングリア沖縄",
    localityLabel: "沖縄県 今帰仁村",
    placeKind: "theme_park",
  });
  const second = initialCanonicalPlaceId({
    canonicalName: "ジャングリア沖縄",
    localityLabel: "沖縄県 今帰仁村",
    placeKind: "theme_park",
  });
  assert.equal(first, second);
  assert.match(first, /^plc_[0-9a-f]{16}$/);
  assert.doesNotMatch(first, /1281984233/);
});

test("commercial named areas require high zoom in viewport but remain searchable", () => {
  const input = {
    osmType: "way",
    tags: { name: "イオンモール", shop: "mall" },
    geometry: square,
    areaHa: 3,
  };
  assert.equal(isDiscoverableNamedArea({ ...input, zoom: 11, context: "viewport" }), false);
  assert.equal(isDiscoverableNamedArea({ ...input, zoom: 13, context: "viewport" }), true);
  assert.equal(isDiscoverableNamedArea({ ...input, zoom: 11, context: "search" }), true);
  assert.equal(isDiscoverableNamedArea({ ...input, osmType: "node", zoom: 15, context: "search" }), false);
});

test("mall and retail polygons merge into one canonical candidate", () => {
  const bbox = bboxForPlaceGeometry(square);
  const candidates: PlaceCandidate[] = [
    {
      candidateId: "mall",
      canonicalName: "イオンモール浜松市野",
      aliases: ["イオン"],
      placeKind: "shopping_mall",
      geometry: square,
      bbox,
      areaHa: 8,
      sourceType: "osm_way",
      sourceId: "way:1",
      sourceConfidence: 0.82,
      verificationStatus: "source_verified",
      tags: { name: "イオンモール浜松市野", brand: "イオン", shop: "mall" },
    },
    {
      candidateId: "retail",
      canonicalName: "イオンモール浜松市野",
      aliases: ["AEON"],
      placeKind: "commercial_complex",
      geometry: square,
      bbox,
      areaHa: 10,
      sourceType: "osm_way",
      sourceId: "way:2",
      sourceConfidence: 0.7,
      verificationStatus: "unverified",
      tags: { name: "イオンモール浜松市野", brand: "イオン", landuse: "retail" },
    },
  ];
  const merged = dedupePlaceCandidates(candidates);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.placeKind, "shopping_mall");
  assert.equal(merged[0]?.sourceReferences.length, 2);
  assert.deepEqual(merged[0]?.mergedCandidateIds, ["retail"]);
});

test("same-name places with disjoint geometry never merge", () => {
  const farGeometry: PlaceGeometry = {
    type: "Polygon",
    coordinates: [[
      [139.0, 35.0],
      [139.01, 35.0],
      [139.01, 35.01],
      [139.0, 35.01],
      [139.0, 35.0],
    ]],
  };
  const base = {
    aliases: [],
    placeKind: "park" as const,
    areaHa: 1,
    sourceType: "osm_way",
    sourceConfidence: 0.7,
    verificationStatus: "unverified",
  };
  assert.equal(dedupePlaceCandidates([
    { ...base, candidateId: "a", canonicalName: "常磐公園", geometry: square, bbox: bboxForPlaceGeometry(square), sourceId: "way:1" },
    { ...base, candidateId: "b", canonicalName: "常磐公園", geometry: farGeometry, bbox: bboxForPlaceGeometry(farGeometry), sourceId: "way:2" },
  ]).length, 2);
});

test("OSM access never becomes photography or public-posting permission", () => {
  const publicPark = defaultPlacePolicy({ placeKind: "park", osmAccess: "yes" });
  assert.equal(publicPark.recordingPolicy, "check_rules");
  assert.equal(publicPark.contributionCtaMode, "check_rules");
  assert.equal(publicPark.reason, "osm_access_supports_browsing_only");

  const school = defaultPlacePolicy({ placeKind: "school", osmAccess: "yes" });
  assert.equal(school.recordingPolicy, "permission_required");
  assert.equal(school.contributionCtaMode, "suppressed");

  const mall = defaultPlacePolicy({ placeKind: "shopping_mall", osmAccess: "public" });
  assert.equal(mall.recordingPolicy, "check_rules");
  assert.equal(mall.contributionCtaMode, "check_rules");
});

test("official policy can allow, restrict, or prohibit recording with source", () => {
  const prohibited = defaultPlacePolicy({
    placeKind: "theme_park",
    officialRecordingPolicy: "prohibited",
    officialRuleUrl: "https://example.test/rules",
  });
  assert.equal(prohibited.recordingPolicy, "prohibited");
  assert.equal(prohibited.contributionCtaMode, "suppressed");
  assert.equal(prohibited.ruleSource, "official");
  assert.equal(prohibited.ruleUrl, "https://example.test/rules");
});

test("Polygon and MultiPolygon holes are respected", () => {
  const withHole: PlaceGeometry = {
    type: "Polygon",
    coordinates: [
      [
        [137.0, 34.0],
        [137.02, 34.0],
        [137.02, 34.02],
        [137.0, 34.02],
        [137.0, 34.0],
      ],
      [
        [137.005, 34.005],
        [137.015, 34.005],
        [137.015, 34.015],
        [137.005, 34.015],
        [137.005, 34.005],
      ],
    ],
  };
  assert.equal(pointInPlaceGeometry({ lat: 34.002, lng: 137.002 }, withHole), true);
  assert.equal(pointInPlaceGeometry({ lat: 34.01, lng: 137.01 }, withHole), false);
  assert.equal(pointInPlaceGeometry({ lat: 35, lng: 139 }, {
    type: "MultiPolygon",
    coordinates: [square.coordinates, [[
      [138.99, 34.99],
      [139.01, 34.99],
      [139.01, 35.01],
      [138.99, 35.01],
      [138.99, 34.99],
    ]]],
  }), true);
});

test("membership is multi-place, uncertainty-aware, and picks the deepest primary", () => {
  const decisions = decideRecordPlaceMembership({
    point: { lat: 34.005, lng: 137.005 },
    uncertaintyM: 2,
    boundaries: [
      { placeId: "city", geometry: square, confidence: 0.95, precision: "exact", hierarchyDepth: 0, areaHa: 200 },
      { placeId: "facility", geometry: square, confidence: 0.9, precision: "exact", hierarchyDepth: 1, areaHa: 8 },
      { placeId: "approximate", geometry: square, confidence: 0.7, precision: "approximate", hierarchyDepth: 2, areaHa: 1 },
    ],
  });
  assert.equal(decisions.filter((decision) => decision.state === "confirmed").length, 2);
  assert.equal(decisions.find((decision) => decision.placeId === "facility")?.primary, true);
  assert.equal(decisions.find((decision) => decision.placeId === "approximate")?.state, "candidate");
  assert.deepEqual(publicMembershipProjection(decisions[1]!), {
    placeId: "facility",
    membershipState: "confirmed",
    publicPrecision: "place",
    primary: true,
  });
});

test("boundary-edge uncertainty remains a candidate instead of a false confirmation", () => {
  const decisions = decideRecordPlaceMembership({
    point: { lat: 34.005, lng: 137.01001 },
    uncertaintyM: 15,
    boundaries: [
      { placeId: "facility", geometry: square, confidence: 0.9, precision: "exact" },
    ],
  });
  assert.equal(decisions[0]?.state, "candidate");
  assert.equal(decisions[0]?.membershipType, "near_boundary");
  assert.equal(decisions[0]?.primary, false);
});

test("equivalent overlapping sibling boundaries remain candidates", () => {
  const decisions = decideRecordPlaceMembership({
    point: { lat: 34.005, lng: 137.005 },
    uncertaintyM: 2,
    boundaries: [
      { placeId: "sibling-a", geometry: square, confidence: 0.9, precision: "exact", hierarchyDepth: 1, areaHa: 8 },
      { placeId: "sibling-b", geometry: square, confidence: 0.92, precision: "exact", hierarchyDepth: 1, areaHa: 8.5 },
    ],
  });
  assert.equal(decisions.every((decision) => decision.state === "candidate"), true);
  assert.equal(decisions.some((decision) => decision.primary), false);
  assert.equal(decisions[0]?.reason, "equivalent_overlapping_boundaries");
});
