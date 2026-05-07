import assert from "node:assert/strict";
import test from "node:test";
import { buildVideoFrameUrl, selectVideoFrameTimesMs } from "./reassessFromVideoThumb.js";

test("video reassess samples multiple frames across normal clips", () => {
  const frames = selectVideoFrameTimesMs(60_000);

  assert.equal(frames.length, 5);
  assert.deepEqual(frames, [...frames].sort((a, b) => a - b));
  assert.ok(frames[0]! >= 800);
  assert.ok(frames[frames.length - 1]! <= 59_500);
});

test("video reassess keeps useful fallback frames when duration is unknown", () => {
  assert.deepEqual(selectVideoFrameTimesMs(null), [1000, 2000, 4000]);
});

test("video frame URLs replace thumbnail time while preserving height", () => {
  const url = buildVideoFrameUrl("https://customer.example/abc/thumbnails/thumbnail.jpg?time=1s&height=360", 2500);

  assert.equal(url, "https://customer.example/abc/thumbnails/thumbnail.jpg?time=2.5s&height=360");
});
