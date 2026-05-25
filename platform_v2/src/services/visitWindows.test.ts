import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTINUOUS_VISIT_GAP_MS,
  countContinuousVisitWindows,
} from "./visitWindows.js";

test("countContinuousVisitWindows treats records inside the continuous gap as one visit", () => {
  const base = Date.parse("2026-05-24T09:00:00.000Z");

  assert.equal(countContinuousVisitWindows([
    { observedAt: new Date(base + 10 * 60 * 1000) },
    { observedAt: new Date(base) },
    { observedAt: new Date(base + CONTINUOUS_VISIT_GAP_MS) },
  ]), 1);
});

test("countContinuousVisitWindows splits records after the continuous gap", () => {
  const base = Date.parse("2026-05-24T09:00:00.000Z");

  assert.equal(countContinuousVisitWindows([
    { observedAt: new Date(base) },
    { observedAt: new Date(base + CONTINUOUS_VISIT_GAP_MS + 1) },
    { observedAt: new Date(base + CONTINUOUS_VISIT_GAP_MS + 30 * 60 * 1000) },
  ]), 2);
});

test("countContinuousVisitWindows ignores invalid timestamps", () => {
  assert.equal(countContinuousVisitWindows([
    { observedAt: "not-a-date" },
    { observedAt: "2026-05-24T09:00:00.000Z" },
  ]), 1);
});
