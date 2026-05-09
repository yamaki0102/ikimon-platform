import assert from "node:assert/strict";
import test from "node:test";
import { AI_MODEL_PRICING, CURATOR_DEFAULT_MODEL, estimateAiCostUsd } from "./aiModelPricing.js";
import { CURATOR_DEEPSEEK_MODEL } from "./aiModels.js";

test("curator default pricing uses Gemini 3.1 Flash-Lite official rate", () => {
  assert.equal(CURATOR_DEFAULT_MODEL, "gemini-3.1-flash-lite");
  assert.equal(AI_MODEL_PRICING[CURATOR_DEFAULT_MODEL]?.inputUsdPer1M, 0.25);
  assert.equal(AI_MODEL_PRICING[CURATOR_DEFAULT_MODEL]?.outputUsdPer1M, 1.5);
});

test("DeepSeek V4 Flash pricing uses cache miss and cache hit rates separately", () => {
  assert.equal(AI_MODEL_PRICING[CURATOR_DEEPSEEK_MODEL]?.inputUsdPer1M, 0.14);
  assert.equal(AI_MODEL_PRICING[CURATOR_DEEPSEEK_MODEL]?.cacheHitInputUsdPer1M, 0.0028);
  assert.equal(AI_MODEL_PRICING[CURATOR_DEEPSEEK_MODEL]?.outputUsdPer1M, 0.28);
  assert.equal(estimateAiCostUsd({
    model: CURATOR_DEEPSEEK_MODEL,
    cacheHitInputTokens: 1_000_000,
    cacheMissInputTokens: 1_000_000,
    outputTokens: 1_000_000,
  }), 0.4228);
});
