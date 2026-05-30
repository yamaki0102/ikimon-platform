import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMapVisitedPlaceName } from "./mapVisitedPlaces.js";

test("normalizeMapVisitedPlaceName replaces broad prefecture titles with the municipality", () => {
  assert.equal(
    normalizeMapVisitedPlaceName({
      placeName: "愛知県",
      municipality: "浜松市浜名区",
    }),
    "浜松市浜名区",
  );
});

test("normalizeMapVisitedPlaceName keeps real place names", () => {
  assert.equal(
    normalizeMapVisitedPlaceName({
      placeName: "都田公園",
      municipality: "浜松市浜名区",
    }),
    "都田公園",
  );
});
