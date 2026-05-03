import assert from "node:assert/strict";
import test from "node:test";
import {
  assessLegacyObservationQuality,
  PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL,
  PUBLIC_OBSERVATION_QUALITY_SQL,
  VALID_OBSERVATION_PHOTO_ASSET_SQL,
} from "./observationQualityGate.js";

test("legacy quality gate does not count zero-zero as a real location", () => {
  const result = assessLegacyObservationQuality({
    lat: 0,
    lng: 0,
    photos: [],
    taxon: null,
  });

  assert.equal(result.hasLocation, false);
  assert.ok(result.gateReasons.includes("missing_location"));
});

test("public quality gate excludes leaked test observations and smoke fixtures", () => {
  assert.match(PUBLIC_OBSERVATION_QUALITY_SQL, /e2e_test_/);
  assert.match(PUBLIC_OBSERVATION_QUALITY_SQL, /prod\[-_\]\?media/);
});

test("public photo gates reject known 1x1 placeholder assets without requiring legacy dimensions", () => {
  assert.match(VALID_OBSERVATION_PHOTO_ASSET_SQL, /coalesce\(ab\.bytes, 1024\) > 512/);
  assert.match(VALID_OBSERVATION_PHOTO_ASSET_SQL, /coalesce\(ab\.width_px, 2\) > 1/);
  assert.match(PUBLIC_OBSERVATION_HAS_VALID_PHOTO_SQL, /coalesce\(public_photo_ab\.bytes, 1024\) > 512/);
});
