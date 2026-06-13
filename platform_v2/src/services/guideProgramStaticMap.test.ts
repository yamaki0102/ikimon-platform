import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGuideProgramStaticMapLayout,
  guideProgramWorldPixel,
} from "./guideProgramStaticMap.js";
import { MAP_GUIDE_SPOTS } from "./mapGuideSpots.js";

test("guide program static map projects pins against the selected GSI tile grid", () => {
  const spot = {
    id: "aikan-renri-lenri-tree",
    displayLat: 34.81435,
    displayLng: 137.7327,
  };
  const layout = buildGuideProgramStaticMapLayout([spot]);
  assert.ok(layout);
  assert.equal(layout.zoom, 16);
  assert.equal(layout.tiles.length, 12);
  assert.equal(layout.tileCols, 4);
  assert.equal(layout.tileRows, 3);

  const pixel = guideProgramWorldPixel(spot.displayLat, spot.displayLng, layout.zoom);
  const expectedX = ((pixel.x - layout.tileOriginX * 256) / (layout.tileCols * 256)) * 100;
  const expectedY = ((pixel.y - layout.tileOriginY * 256) / (layout.tileRows * 256)) * 100;
  assert.equal(layout.pins[0]?.spot.id, spot.id);
  assert.ok(Math.abs((layout.pins[0]?.xPct ?? 0) - expectedX) < 0.000001);
  assert.ok(Math.abs((layout.pins[0]?.yPct ?? 0) - expectedY) < 0.000001);
  assert.match(layout.tiles[0]?.url ?? "", /https:\/\/cyberjapandata\.gsi\.go\.jp\/xyz\/std\/16\/\d+\/\d+\.png/);
});

test("guide program static map lowers zoom so every multi-point program spot fits", () => {
  const heritageSpots = MAP_GUIDE_SPOTS
    .filter((spot) => (spot.guideProgramIds ?? []).includes("hamamatsu-heritage-guide-relay"))
    .map((spot) => ({
      id: spot.id,
      displayLat: spot.lat,
      displayLng: spot.lng,
    }));

  const layout = buildGuideProgramStaticMapLayout(heritageSpots);
  assert.ok(layout);
  assert.ok(layout.zoom < 16);
  assert.equal(layout.pins.length, heritageSpots.length);
  for (const pin of layout.pins) {
    assert.ok(pin.xPct > 6 && pin.xPct < 94, `${pin.spot.id} x=${pin.xPct}`);
    assert.ok(pin.yPct > 6 && pin.yPct < 94, `${pin.spot.id} y=${pin.yPct}`);
  }
});

test("guide program static map ignores spots without finite display coordinates", () => {
  const layout = buildGuideProgramStaticMapLayout([
    { displayLat: Number.NaN, displayLng: 137.7 },
    { displayLat: 34.71, displayLng: Number.POSITIVE_INFINITY },
  ]);
  assert.equal(layout, null);
});
