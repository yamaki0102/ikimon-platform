import assert from "node:assert/strict";
import test from "node:test";
import { buildVideoFrameUrl, selectVideoFrameTimesMs } from "./reassessFromVideoThumb.js";
import {
  adaptiveCandidateFrameTimesMs,
  selectAdaptiveVideoFramesFromFeatures,
} from "./videoAdaptiveFrameSelection.js";

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

test("video frame URLs replace thumbnail time and set requested height", () => {
  const url = buildVideoFrameUrl("https://customer.example/abc/thumbnails/thumbnail.jpg?time=1s&height=360", 2500);

  assert.equal(url, "https://customer.example/abc/thumbnails/thumbnail.jpg?time=2.5s&height=720");
});

test("adaptive video sampling scores a variable number of changed scenes", () => {
  const selections = selectAdaptiveVideoFramesFromFeatures([
    { frameTimeMs: 500, brightness: 0.5, edgeScore: 0.2, diffScore: 0, colorDiffScore: 0, qualityScore: 0.72 },
    { frameTimeMs: 1500, brightness: 0.48, edgeScore: 0.28, diffScore: 0.42, colorDiffScore: 0.31, qualityScore: 0.78 },
    { frameTimeMs: 2500, brightness: 0.49, edgeScore: 0.24, diffScore: 0.04, colorDiffScore: 0.03, qualityScore: 0.74 },
    { frameTimeMs: 4200, brightness: 0.56, edgeScore: 0.32, diffScore: 0.48, colorDiffScore: 0.38, qualityScore: 0.82 },
    { frameTimeMs: 5100, brightness: 0.22, edgeScore: 0.08, diffScore: 0.1, colorDiffScore: 0.07, qualityScore: 0.28 },
  ], { maxSelected: 6, minGapMs: 1000 });

  assert.deepEqual(selections.map((frame) => frame.frameTimeMs), [1500, 4200]);
  assert.ok(selections.every((frame) => frame.selectionReason.length > 0));
});

test("adaptive candidate generation caps scoring frames for long videos", () => {
  const candidates = adaptiveCandidateFrameTimesMs(180_000);

  assert.ok(candidates.length <= 36);
  assert.ok(candidates.length > 5);
  assert.deepEqual(candidates, [...candidates].sort((a, b) => a - b));
});
