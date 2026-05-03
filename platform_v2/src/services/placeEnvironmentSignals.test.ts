import assert from "node:assert/strict";
import test from "node:test";
import { environmentEvidenceFromSiteSignals } from "./placeEnvironmentSignals.js";

test("environmentEvidenceFromSiteSignals turns map and elevation clues into bounded evidence", () => {
  const evidence = environmentEvidenceFromSiteSignals({
    landcover: ["tree_cover"],
    nearbyLandcover: ["grassland"],
    waterDistanceM: 90,
    elevationM: 24,
  });

  assert.equal(evidence.length, 3);
  assert.equal(evidence[0]?.label, "地図上の土地被覆");
  assert.equal(evidence[0]?.value, "樹林・草地");
  assert.equal(evidence[1]?.label, "水辺との距離");
  assert.equal(evidence[1]?.value, "約90m");
  assert.match(evidence.map((item) => item.limitation).join(" "), /現地/);
});

test("environmentEvidenceFromSiteSignals returns an empty list when every signal is missing", () => {
  const evidence = environmentEvidenceFromSiteSignals({
    landcover: [],
    nearbyLandcover: [],
    waterDistanceM: null,
    elevationM: null,
  });

  assert.deepEqual(evidence, []);
});
