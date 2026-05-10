import assert from "node:assert/strict";
import test from "node:test";
import {
  getAiModelRoleChain,
  parseAiModelRoleChainOverride,
} from "./aiModels.js";

test("AI model role chains can be overridden with provider-qualified env values", () => {
  const chain = getAiModelRoleChain("taxonInsights", {
    AI_MODEL_CHAIN_TAXON_INSIGHTS: "gemini:gemini-3.1-flash-lite,deepseek:deepseek-v4-flash",
  });
  assert.deepEqual(chain, [
    { provider: "gemini", model: "gemini-3.1-flash-lite" },
    { provider: "deepseek", model: "deepseek-v4-flash" },
  ]);
});

test("AI model role chain overrides accept catalog aliases", () => {
  assert.deepEqual(parseAiModelRoleChainOverride("geminiFlashLite,deepseekFlash"), [
    { provider: "gemini", model: "gemini-3.1-flash-lite" },
    { provider: "deepseek", model: "deepseek-v4-flash" },
  ]);
});

test("AI model role chains support Vertex and observation visual roles", () => {
  assert.deepEqual(parseAiModelRoleChainOverride("vertex:gemini-3.1-flash-image,openai:gpt-5.1-mini"), [
    { provider: "vertex", model: "gemini-3.1-flash-image" },
    { provider: "openai-compatible", model: "gpt-5.1-mini" },
  ]);
  assert.equal(getAiModelRoleChain("observationVisualExtract")[0]?.model, "gemini-3.1-flash-image");
  assert.equal(getAiModelRoleChain("observationVisualSummary")[0]?.model, "gemini-3.1-flash-lite");
  assert.equal(getAiModelRoleChain("guideScene")[0]?.model, "gemini-3.1-flash-image");
  assert.equal(getAiModelRoleChain("guideScene")[1]?.model, "gemini-2.5-flash-lite");
});

test("regional story keeps the legacy single-model env override", () => {
  assert.deepEqual(getAiModelRoleChain("regionalStory", {
    REGIONAL_STORY_GEMINI_MODEL: "gemini-custom-regional",
  }), [
    { provider: "gemini", model: "gemini-custom-regional" },
  ]);
});

test("AI model role chain overrides require a provider for unknown ids", () => {
  assert.throws(
    () => parseAiModelRoleChainOverride("custom-model"),
    /ai_model_override_requires_provider/,
  );
});
