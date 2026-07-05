import assert from "node:assert/strict";
import test from "node:test";
import { chooseSchool, chooseSchools, pointInGeometry, scoreSchoolCandidates } from "./enhanceSchoolFieldBoundaries.js";

const squareBoundary = {
  feature: {
    type: "Feature" as const,
    properties: { name: "静岡県立浜松西高等学校", osm_type: "way", osm_id: 194423248 },
    geometry: null,
  },
  name: "静岡県立浜松西高等学校",
  geometry: {
    type: "Polygon",
    coordinates: [[
      [137.700, 34.690],
      [137.712, 34.690],
      [137.712, 34.703],
      [137.700, 34.703],
      [137.700, 34.690],
    ]],
  },
  bbox: { minLat: 34.690, maxLat: 34.703, minLng: 137.700, maxLng: 137.712 },
  center: { lat: 34.6965, lng: 137.706 },
  areaHa: 12,
  radiusM: 900,
};

const containedSchool = {
  field_id: "fbe4dccc-83b9-4833-ac88-1b0a2cb68d90",
  name: "静岡県立浜松西高等学校",
  lat: 34.701,
  lng: 137.709,
  prefecture: "静岡県",
  city: "浜松市",
  radius_m: "160",
  area_ha: null,
  bbox_min_lat: null,
  bbox_max_lat: null,
  bbox_min_lng: null,
  bbox_max_lng: null,
  polygon_json: null,
  payload_json: "{}",
  payload: {},
  updated_at: "2026-07-05T00:00:00Z",
};

const smallBoundary = {
  ...squareBoundary,
  geometry: {
    type: "Polygon",
    coordinates: [[
      [137.7050, 34.6960],
      [137.7070, 34.6960],
      [137.7070, 34.6980],
      [137.7050, 34.6980],
      [137.7050, 34.6960],
    ]],
  },
  bbox: { minLat: 34.6960, maxLat: 34.6980, minLng: 137.7050, maxLng: 137.7070 },
  center: { lat: 34.6970, lng: 137.7060 },
  areaHa: 0.04,
  radiusM: 120,
};

test("school boundary matching accepts point-in-polygon containment", () => {
  assert.equal(pointInGeometry(34.701, 137.709, squareBoundary.geometry), true);
  const chosen = chooseSchool(squareBoundary, [containedSchool], {
    allowDistanceFallback: false,
    maxDistanceM: 150,
  });

  assert.equal(chosen?.school.field_id, containedSchool.field_id);
  assert.equal(chosen?.method, "containment");
  assert.equal(chosen?.contains, true);
});

test("school boundary matching accepts multiple contained school rows for shared campus polygons", () => {
  const juniorHigh = {
    ...containedSchool,
    field_id: "818da461-166c-4395-89ff-739ffe4c2951",
    name: "静岡県立浜松西高等学校中等部",
    lat: 34.7005,
    lng: 137.7085,
  };

  const chosen = chooseSchools(squareBoundary, [containedSchool, juniorHigh], {
    allowDistanceFallback: false,
    maxDistanceM: 150,
  });

  assert.deepEqual(chosen.map((item) => item.school.field_id).sort(), [
    "818da461-166c-4395-89ff-739ffe4c2951",
    "fbe4dccc-83b9-4833-ac88-1b0a2cb68d90",
  ]);
  assert.equal(chosen.every((item) => item.method === "containment"), true);
});

test("school boundary matching rejects nearby distance-only candidates by default", () => {
  const nearbyOutside = {
    ...containedSchool,
    field_id: "nearby-school",
    lat: 34.704,
    lng: 137.709,
  };
  const chosen = chooseSchool(squareBoundary, [nearbyOutside], {
    allowDistanceFallback: false,
    maxDistanceM: 500,
  });

  assert.equal(chosen, null);
});

test("distance fallback requires explicit opt-in and strong name match", () => {
  const nearbyStrongName = {
    ...containedSchool,
    field_id: "nearby-strong-name",
    lat: 34.6982,
    lng: 137.706,
  };
  const nearbyWeakName = {
    ...nearbyStrongName,
    field_id: "nearby-weak-name",
    name: "別の学校",
  };

  const candidates = scoreSchoolCandidates(smallBoundary, [nearbyStrongName, nearbyWeakName], {
    allowDistanceFallback: true,
    maxDistanceM: 150,
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.school.field_id, nearbyStrongName.field_id);
  assert.equal(candidates[0]?.method, "distance_fallback");
  assert.equal(candidates[0]?.contains, false);
});
