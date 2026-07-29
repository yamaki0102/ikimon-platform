import { createHash } from "node:crypto";
import type { AiCostLayer, AiCostLogEntry, AiCostProvider } from "./aiCostLogger.js";
import type { AiUsageEvent } from "./aiUsageControl.js";

export type LegacyAiCostProjection =
  | { kind: "loggable"; entry: AiCostLogEntry }
  | {
      kind: "requires_event_store";
      reason: "adjustment_not_supported_by_ai_cost_log";
      usageEventId: string;
    };

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function legacyProvider(provider: string): AiCostProvider {
  if (provider === "gemini" || provider === "google") return "gemini";
  if (provider === "vertex") return "vertex";
  if (provider === "claude" || provider === "anthropic") return "claude";
  if (provider === "deepseek") return "deepseek";
  if (provider === "openai" || provider === "openai-compatible") return "openai";
  return "other";
}

/**
 * Bounded compatibility projection for the existing append-only ai_cost_log.
 * Negative reconciliation adjustments cannot be represented by the current
 * non-negative schema and therefore must not be silently projected.
 */
export function projectUsageToLegacyAiCostLog(input: {
  event: AiUsageEvent;
  layer: AiCostLayer;
}): LegacyAiCostProjection {
  if (input.event.eventKind === "adjustment") {
    return {
      kind: "requires_event_store",
      reason: "adjustment_not_supported_by_ai_cost_log",
      usageEventId: input.event.eventId,
    };
  }
  return {
    kind: "loggable",
    entry: {
      layer: input.layer,
      endpoint: input.event.feature,
      provider: legacyProvider(input.event.provider),
      model: input.event.modelId,
      inputTokens: input.event.inputTokens,
      outputTokens: input.event.outputTokens,
      costUsd: input.event.costUsdMicros / 1_000_000,
      escalated: input.event.fallbackDepth > 0,
      cacheHit: input.event.cachedInputTokens > 0,
      metadata: {
        aiUsageEventId: input.event.eventId,
        aiExecutionKey: input.event.executionKey,
        aiAttemptId: input.event.attemptId,
        aiProviderRequestId: input.event.providerRequestId,
        aiPricingVersion: input.event.pricingVersion,
        aiPromptVersion: input.event.promptVersion,
        aiCachedInputTokens: input.event.cachedInputTokens,
        aiCacheWriteTokens: input.event.cacheWriteTokens,
        aiRetryCount: input.event.retryCount,
        aiRetryOfEventId: input.event.retryOfEventId,
        aiAdjustmentOfEventId: input.event.adjustmentOfEventId,
        aiFallbackDepth: input.event.fallbackDepth,
        aiProviderFailureCount: input.event.providerFailureCount,
        aiReconciliationStatus: input.event.reconciliationStatus,
        aiRawUsageSha256: sha256(input.event.rawUsageJson),
      },
    },
  };
}
