import assert from "node:assert/strict";
import test from "node:test";
import {
  haversineDistanceMeters,
  isObservationWithinRallyStation,
} from "./observationRallyAutoMatch.js";

test("haversine distance is zero for the same point", () => {
  assert.equal(
    haversineDistanceMeters(
      { lat: 34.7108, lng: 137.7261 },
      { lat: 34.7108, lng: 137.7261 },
    ),
    0,
  );
});

test("station matching respects the configured radius", () => {
  const station = { lat: 34.7108, lng: 137.7261, radiusM: 100 };
  const near = isObservationWithinRallyStation(
    { lat: 34.71125, lng: 137.7261 },
    station,
  );
  const boundary = isObservationWithinRallyStation(
    { lat: 34.7116993, lng: 137.7261 },
    station,
  );
  const far = isObservationWithinRallyStation(
    { lat: 34.713, lng: 137.7261 },
    station,
  );

  assert.equal(near.matched, true);
  assert.ok(near.distanceM > 40 && near.distanceM < 60);
  assert.ok(boundary.distanceM > 99 && boundary.distanceM < 101);
  assert.equal(boundary.matched, true);
  assert.equal(far.matched, false);
  assert.ok(far.distanceM > 200);
});

test("station matching rejects an observation just outside the radius", () => {
  const result = isObservationWithinRallyStation(
    { lat: 34.71171, lng: 137.7261 },
    { lat: 34.7108, lng: 137.7261, radiusM: 100 },
  );

  assert.ok(result.distanceM > 100);
  assert.equal(result.matched, false);
});
