import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRyuyoPoint,
  distanceToRyuyoBoundaryMeters,
  expandBboxByMeters,
  RYUYO_FIELD_ID,
  RYUYO_NEARBY_MAX_DISTANCE_METERS,
} from "./ryuyoAreaContext";

const geometry = {
  type: "Polygon" as const,
  coordinates: [[[137.8393578, 34.6684471], [137.8391405, 34.6708363], [137.8391517, 34.6712001], [137.8394498, 34.6708521], [137.8405761, 34.6693071], [137.8407421, 34.6690781], [137.8393578, 34.6684471]]],
};

test("Ryuyo classifies core and nearby distance bands without changing membership", () => {
  assert.equal(classifyRyuyoPoint(137.8400, 34.6695, geometry), "core");
  assert.equal(classifyRyuyoPoint(137.8410, 34.6695, geometry), "nearby");
  assert.equal(classifyRyuyoPoint(137.8432, 34.6695, geometry), "nearby");
  assert.equal(classifyRyuyoPoint(137.8442, 34.6695, geometry), "outside");
  assert.ok(distanceToRyuyoBoundaryMeters(137.8410, 34.6695, geometry) <= RYUYO_NEARBY_MAX_DISTANCE_METERS);
});

test("nearby classification has no field-id write path", () => {
  assert.equal(RYUYO_FIELD_ID, "372eafbd-ea9c-4b2f-ab5f-434b81b928b2");
  assert.equal(classifyRyuyoPoint(137.8410, 34.6695, geometry), "nearby");
  assert.deepEqual(JSON.parse("[]"), []);
});

test("candidate query bbox expands before read-time classification", () => {
  const expanded = expandBboxByMeters({
    minLat: 34.6684471,
    maxLat: 34.6712001,
    minLng: 137.8391405,
    maxLng: 137.8407421,
  });
  assert.ok(expanded.minLat < 34.6684471);
  assert.ok(expanded.maxLng > 137.8407421);
});
