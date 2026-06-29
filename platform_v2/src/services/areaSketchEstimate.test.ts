import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateAreaSketch,
  findForbiddenAreaSketchClaims,
} from "./areaSketchEstimate.js";

test("area sketch estimate calculates green ratio and TSUNAG guide thresholds", () => {
  const result = estimateAreaSketch({
    totalAreaHa: 1,
    policyVersion: "tsunag_2026_current",
    landCover: [
      { category: "trees_planting", areaHa: 0.12 },
      { category: "grassland", areaHa: 0.1 },
      { category: "building", areaHa: 0.2 },
    ],
  });

  assert.equal(result.greenCandidateAreaHa, 0.22);
  assert.equal(result.greenRatio, 0.22);
  assert.equal(result.greenRatioPercent, 22);
  assert.equal(result.thresholds.find((row) => row.label === "10%")?.reached, true);
  assert.equal(result.thresholds.find((row) => row.label === "20%")?.reached, true);
  assert.equal(result.thresholds.find((row) => row.label === "30%")?.reached, false);
  assert.equal(result.unknownAreaHa, 0.58);
});

test("area sketch estimate keeps yard or experience space conditional until evidence is supplied", () => {
  const result = estimateAreaSketch({
    totalAreaHa: 0.5,
    landCover: [
      { category: "yard_experience_space", areaHa: 0.2 },
      { category: "trees_planting", areaHa: 0.05 },
    ],
  });

  assert.equal(result.greenCandidateAreaHa, 0.05);
  assert.equal(result.conditionalGreenCandidateAreaHa, 0.2);
  assert.equal(result.evidenceChecklist.some((item) => item.key === "conditional_green_basis"), true);
});

test("area sketch estimate separates 2026 and planned 2027 absolute area thresholds", () => {
  const current = estimateAreaSketch({
    totalAreaHa: 0.052,
    policyVersion: "tsunag_2026_current",
    landCover: [{ category: "trees_planting", areaHa: 0.02 }],
  });
  const planned = estimateAreaSketch({
    totalAreaHa: 0.052,
    policyVersion: "tsunag_2027_planned",
    landCover: [{ category: "trees_planting", areaHa: 0.02 }],
  });

  assert.equal(current.absoluteArea.thresholdHa, 0.1);
  assert.equal(current.absoluteArea.status, "below");
  assert.equal(planned.absoluteArea.thresholdHa, 0.05);
  assert.equal(planned.absoluteArea.status, "near_threshold");
  assert.equal(planned.evidenceChecklist.some((item) => item.key === "area_threshold_confirmation"), true);
});

test("area sketch claim scanner detects phrases that cross the responsibility boundary", () => {
  const phrases = findForbiddenAreaSketchClaims("この区域はTSUNAGに申請できます。認定されます。");

  assert.deepEqual(phrases, ["申請できます", "認定されます"]);
});
