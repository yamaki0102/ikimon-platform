import assert from "node:assert/strict";
import test from "node:test";

import { __test__ } from "./observationReassess.js";

test("reassess media region normalizer accepts current Gemini region schema", () => {
  const region = __test__.normalizeRectCandidate({
    asset_index: 1,
    rect: { x: 0, y: 0.38, width: 1, height: 0.34 },
    frame_time_ms: 0,
    confidence: 0.9,
    note: "植栽されたサツキの群落",
  }, 4);

  assert.deepEqual(region, {
    assetIndex: 1,
    frameTimeMs: 0,
    confidence: 0.9,
    note: "植栽されたサツキの群落",
    rect: { x: 0, y: 0.38, width: 1, height: 0.34 },
  });
});

test("reassess media region normalizer tolerates common alternate model shapes", () => {
  assert.deepEqual(__test__.normalizeRectCandidate({
    assetIndex: 0,
    bounding_box: { left: 12, top: 18, right: 54, bottom: 69 },
    confidence_score: 0.72,
  }, 1)?.rect, { x: 0.12, y: 0.18, width: 0.42, height: 0.51 });

  assert.deepEqual(__test__.normalizeRectCandidate({
    bbox: [10, 20, 30, 40],
  }, 1)?.rect, { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
});

test("reassess media region normalizer defaults missing asset index only for one image", () => {
  assert.equal(__test__.normalizeRectCandidate({
    rect: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
  }, 2), null);

  assert.equal(__test__.normalizeRectCandidate({
    rect: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
  }, 1)?.assetIndex, 0);
});
