import assert from "node:assert/strict";
import test from "node:test";
import {
  circleToPolygon,
  entityKeyForUserField,
  normalizeFieldName,
  validateAreaPolygon,
} from "./observationEventAreaGeometry.js";

test("area polygon validation accepts closed generated polygons", () => {
  const polygon = circleToPolygon(34.6984, 137.7043, 300);
  const result = validateAreaPolygon(polygon);
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.areaHa && result.areaHa > 1);
  assert.ok(result.center);
});

test("area polygon validation rejects unbounded or malformed polygons", () => {
  assert.equal(validateAreaPolygon({ type: "Polygon", coordinates: [[[200, 95], [201, 95], [200, 96], [200, 95]]] }).ok, false);
  const huge = {
    type: "Polygon",
    coordinates: [[[130, 30], [145, 30], [145, 40], [130, 40], [130, 30]]],
  };
  assert.equal(validateAreaPolygon(huge).errors.includes("polygon_too_large"), true);
});

test("user field entity keys normalize same-name nearby identity", () => {
  assert.equal(normalizeFieldName("そよら 浜松西伊場（公園側）"), "そよら浜松西伊場公園側");
  assert.equal(
    entityKeyForUserField({ ownerUserId: "u1", name: "そよら 浜松西伊場", geohash6: "xn76ur" }),
    entityKeyForUserField({ ownerUserId: "u1", name: "そよら浜松西伊場", geohash6: "xn76ur" }),
  );
});
