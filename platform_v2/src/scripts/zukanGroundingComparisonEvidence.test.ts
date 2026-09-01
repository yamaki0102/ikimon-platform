import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(here, "../../ops/model-bench/evidence");
const blind = JSON.parse(
  fs.readFileSync(path.join(evidenceDir, "2026-08-28-blind-grounding-per-post.json"), "utf8"),
);
const comparison = JSON.parse(
  fs.readFileSync(path.join(evidenceDir, "2026-08-28-grounding-cross-model-comparison.json"), "utf8"),
);

const fixedVisitOrder = [
  "record-1784366489892",
  "record-1784430741938",
  "record-1781252770584",
  "record-1784430374598",
  "record-1784430118720",
  "record-1784431188621",
  "record-1784430530197",
];

test("blind grounding evidence keeps the fixed seven-post input", () => {
  assert.equal(blind.postCount, 7);
  assert.equal(blind.outputCount, 14);
  assert.equal(blind.rawFinalContentAvailableOutputCount, 13);
  assert.equal(blind.fixedInput.datasetSha256, "db98e2a6bd16f0cb3cf9b856dd54472d22760771d970572a3dead7bd99cfbfff");
  assert.equal(blind.fixedInput.promptSha256, "6d0cc93200ad45142713287f81a8a55d96489c0c0e9397b15098ed6b387fd9e9");
  assert.deepEqual(blind.fixedInput.visitOrder, fixedVisitOrder);
  assert.equal(blind.posts.length, 7);
  assert.equal(
    blind.posts.reduce((sum: number, post: { imageCount: number }) => sum + post.imageCount, 0),
    21,
  );
  for (const post of blind.posts) {
    assert.equal(post.imageCount, 3);
    assert.equal(post.imageSha256.length, 3);
    assert.match(post.postSha256, /^[a-f0-9]{64}$/);
    assert.equal(post.visualReviewBasis.fixedManifestImageShaVerified, true);
    assert.equal(post.outputs.length, 2);
  }
});

test("blind evidence does not expose model identity or private reasoning", () => {
  assert.equal(blind.modelNamesHidden, true);
  const serialized = JSON.stringify(blind).toLowerCase();
  for (const forbidden of [
    "gemini",
    "glm-5.3",
    "qwen",
    "luna",
    "llama",
    "reasoning_content",
    "private_reasoning",
    "authorization",
    "api_token",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  for (const post of blind.posts) {
    for (const output of post.outputs) {
      if (output.rawFinalContentStatus === "available") {
        assert.equal(typeof output.raw_final_content, "string");
        assert.ok(output.raw_final_content.length > 0);
      } else {
        assert.equal(output.raw_final_content, null);
        assert.equal(output.scores, null);
      }
      assert.deepEqual(Object.keys(output.review_fields).sort(), [
        "abstention_quality",
        "explanation_quality",
        "hallucinated_features",
        "human_reviewer_notes",
        "missing_observations",
        "taxonomic_reasonableness",
        "useful_observations",
        "visual_grounding",
      ]);
      for (const claim of output.claimAssessments) {
        assert.ok(blind.claimLabels.includes(claim.label));
      }
      if (output.scores) {
        for (const value of Object.values(output.scores) as unknown[]) {
          assert.equal(typeof value, "number");
          if (typeof value === "number") {
            assert.ok(value >= 0 && value <= 100);
          }
        }
      }
    }
  }
});

test("comparison keeps blocked canaries and non-gold verdicts explicit", () => {
  assert.equal(comparison.noModelRerun, true);
  assert.equal(comparison.verdict.BEST_GROUNDING, "NO_CLEAR_WINNER");
  assert.equal(comparison.verdict.BEST_OPERATIONAL, "gemini-3.5-flash-lite");
  assert.equal(comparison.verdict.BEST_BALANCED, "gemini-3.5-flash-lite");
  assert.equal(comparison.verdict.biologicalAccuracyWinner, null);
  assert.deepEqual(
    comparison.blockedModels.map((model: { status: string }) => model.status),
    ["CANARY_BLOCKED", "CANARY_BLOCKED", "CANARY_BLOCKED"],
  );
  assert.equal(comparison.perPost.length, 7);
});

