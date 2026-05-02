import assert from "node:assert/strict";
import test from "node:test";
import { assessLegacyObservationQuality } from "./observationQualityGate.js";

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

