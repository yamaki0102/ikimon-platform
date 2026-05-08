import test from "node:test";
import assert from "node:assert/strict";
import { __test__ } from "./areaSnapshotVisitScope.js";

const square = {
  type: "Polygon",
  coordinates: [[
    [137.0, 34.0],
    [138.0, 34.0],
    [138.0, 35.0],
    [137.0, 35.0],
    [137.0, 34.0],
  ]],
};

const field = {
  fieldId: "11111111-1111-4111-8111-111111111111",
  lat: 34.5,
  lng: 137.5,
  radiusM: 500,
  polygon: square,
};

test("visitMatchesAreaScope rejects geolocated records outside a polygon even when field_id matches", () => {
  assert.equal(__test__.visitMatchesAreaScope(field, {
    point_latitude: 35.2,
    point_longitude: 137.5,
    source_field_id: field.fieldId,
    resolved_match: false,
  }), false);
});

test("visitMatchesAreaScope rejects geolocated records outside a polygon even when pre-resolved", () => {
  assert.equal(__test__.visitMatchesAreaScope(field, {
    point_latitude: 35.2,
    point_longitude: 137.5,
    source_field_id: null,
    resolved_match: true,
  }), false);
});

test("visitMatchesAreaScope accepts geolocated records inside the polygon", () => {
  assert.equal(__test__.visitMatchesAreaScope(field, {
    point_latitude: 34.5,
    point_longitude: 137.5,
    source_field_id: null,
    resolved_match: false,
  }), true);
});

test("visitMatchesAreaScope accepts pre-resolved field matches without rechecking coordinates", () => {
  assert.equal(__test__.visitMatchesAreaScope(field, {
    point_latitude: null,
    point_longitude: null,
    source_field_id: null,
    resolved_match: true,
  }), true);
});
