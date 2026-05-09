import {
  AI_MODELS,
  CURATOR_DEEPSEEK_MODEL,
  CURATOR_DEFAULT_MODEL,
} from "./aiModels.js";

export type AiPricingProvider = "gemini" | "vertex" | "deepseek";

export type AiModelPricing = {
  provider: AiPricingProvider;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  cacheHitInputUsdPer1M?: number;
  source: string;
};

export { CURATOR_DEEPSEEK_MODEL, CURATOR_DEFAULT_MODEL } from "./aiModels.js";

export const AI_MODEL_PRICING: Record<string, AiModelPricing> = {
  // Google Gemini API pricing, checked 2026-05-09.
  [CURATOR_DEFAULT_MODEL]: {
    provider: "gemini",
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    source: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  [AI_MODELS.geminiFlashImage]: {
    provider: "gemini",
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    source: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  // Kept for non-curator legacy Hot path accounting only. Do not add it to
  // curator fallback lists; quality is below the Sprint 7 bar.
  [AI_MODELS.geminiFlashLiteFallback]: {
    provider: "gemini",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.4,
    source: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  // DeepSeek V4 Flash OpenAI-compatible API pricing, checked 2026-04-29.
  [CURATOR_DEEPSEEK_MODEL]: {
    provider: "deepseek",
    inputUsdPer1M: 0.14,
    cacheHitInputUsdPer1M: 0.0028,
    outputUsdPer1M: 0.28,
    source: "https://api-docs.deepseek.com/quick_start/pricing",
  },
};

function nonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function pricingForModel(model: string): AiModelPricing {
  const pricing = AI_MODEL_PRICING[model];
  if (!pricing) {
    throw new Error(`unknown_ai_model_pricing:${model}`);
  }
  return pricing;
}

export function estimateAiCostUsd(input: {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheHitInputTokens?: number;
  cacheMissInputTokens?: number;
}): number {
  const pricing = pricingForModel(input.model);
  const outputTokens = nonNegative(input.outputTokens);
  const cacheHitTokens = nonNegative(input.cacheHitInputTokens);
  const cacheMissTokens = nonNegative(input.cacheMissInputTokens);
  const explicitInputTokens = nonNegative(input.inputTokens);
  const inferredInputTokens = cacheHitTokens + cacheMissTokens;

  const inputCost = inferredInputTokens > 0
    ? (cacheHitTokens / 1_000_000) * (pricing.cacheHitInputUsdPer1M ?? pricing.inputUsdPer1M) +
      (cacheMissTokens / 1_000_000) * pricing.inputUsdPer1M
    : (explicitInputTokens / 1_000_000) * pricing.inputUsdPer1M;

  return Number((inputCost + (outputTokens / 1_000_000) * pricing.outputUsdPer1M).toFixed(8));
}
