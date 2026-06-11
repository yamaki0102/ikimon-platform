import assert from "node:assert/strict";
import test from "node:test";
import { listMapGuideSpotsForBbox, MAP_GUIDE_PROGRAMS, MAP_GUIDE_SPOTS } from "./mapGuideSpots.js";

test("map guide spots can appear without registered area polygons", () => {
  const collection = listMapGuideSpotsForBbox({
    bbox: [137.55, 34.67, 137.75, 34.84],
  });

  assert.ok(collection.features.length >= 5);
  assert.ok(collection.features.some((feature) => feature.properties.id === "aikan-renri-lenri-tree"));
  assert.ok(collection.features.some((feature) => feature.properties.id === "hamamatsu-shijimizuka-site"));
  assert.ok(collection.features.every((feature) => feature.geometry.type === "Point"));
  assert.ok(collection.features.every((feature) => feature.properties.sourceLinks.length > 0));
});

test("guide spot copy is sourced and summarized instead of copied as long official text", () => {
  for (const spot of MAP_GUIDE_SPOTS) {
    assert.ok(spot.script.length > 50);
    assert.ok(spot.script.length < 360);
    assert.ok(spot.sourceLinks.every((link) => /^https:\/\/www\.city\.hamamatsu\.shizuoka\.jp\//.test(link.url) || /^https:\/\/i-kan\.co\.jp\//.test(link.url)));
  }
});

test("guide spots carry P0 unlock safety and relay program metadata", () => {
  const lenri = MAP_GUIDE_SPOTS.find((spot) => spot.id === "aikan-renri-lenri-tree");
  assert.ok(lenri);
  assert.equal(lenri.visibilityStatus, "published");
  assert.equal(lenri.safetyStatus, "active");
  assert.equal(lenri.landownerConsent, true);
  assert.equal(lenri.distanceDisplayPolicy, "coarse");
  assert.ok(lenri.guideProgramIds?.includes("aikan-renri-guide-relay"));

  const program = MAP_GUIDE_PROGRAMS.find((item) => item.id === "aikan-renri-guide-relay");
  assert.ok(program);
  assert.equal(program.participationMode, "any_order");
  assert.deepEqual(program.guideSpotIds, ["aikan-renri-lenri-tree"]);
});
