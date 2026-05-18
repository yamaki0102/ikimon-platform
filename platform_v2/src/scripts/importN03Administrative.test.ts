import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./importN03Administrative.js";

test("importN03Administrative combines designated-city municipality and ward names", () => {
  const jobs = __test__.buildJobsForFeature({
    type: "Feature",
    properties: {
      N03_001: "静岡県",
      N03_004: "浜松市",
      N03_005: "中央区",
      N03_007: "22138",
    },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [137.7, 34.7],
        [137.8, 34.7],
        [137.8, 34.8],
        [137.7, 34.8],
        [137.7, 34.7],
      ]],
    },
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]?.city, "浜松市中央区");
  assert.equal(jobs[0]?.name, "静岡県 浜松市中央区");
});
