import assert from "node:assert/strict";
import test from "node:test";
import type { AiUsageEvent } from "./aiUsageControl.js";
import { projectUsageToLegacyAiCostLog } from "./aiUsageLegacyCostProjection.js";

function event(overrides: Partial<AiUsageEvent> = {}): AiUsageEvent {
  return {
    eventId: "event-1", occurredAt: "2026-07-29T00:00:00.000Z", recordedSequence: 1,
    tenantId: "tenant-a", project: "zukan", workspaceId: null,
    feature: "context_packet", operationVersion: "context/v2", requestId: "request-1",
    executionKey: "a".repeat(64), attemptId: "attempt-1", leaseGeneration: 1,
    provider: "google", providerRequestId: "provider-1", providerAccountId: "account-a",
    modelId: "gemini-3.1-flash-lite", pricingVersion: "google-2026-07-29", promptVersion: "prompt-v1",
    inputTokens: 100, cachedInputTokens: 20, cacheWriteTokens: 0, outputTokens: 10,
    costUsdMicros: 250, retryCount: 1, fallbackDepth: 1, providerFailureCount: 1,
    eventKind: "usage", outcome: "ok", reconciliationStatus: "pending",
    rawUsageJson: "{}", retryOfEventId: null, adjustmentOfEventId: null,
    ...overrides,
  };
}

test("usage event projects into the existing ai_cost_log shape", () => {
  const projected = projectUsageToLegacyAiCostLog({ event: event(), layer: "hot" });
  assert.equal(projected.kind, "loggable");
  if (projected.kind !== "loggable") assert.fail();
  assert.equal(projected.entry.provider, "gemini");
  assert.equal(projected.entry.costUsd, 0.00025);
  assert.equal(projected.entry.metadata?.aiLeaseGeneration, 1);
  assert.equal(projected.entry.metadata?.aiOperationVersion, "context/v2");
  assert.equal(typeof projected.entry.metadata?.aiRawUsageSha256, "string");
});

test("negative reconciliation adjustment is not silently written", () => {
  const projected = projectUsageToLegacyAiCostLog({
    event: event({
      eventKind: "adjustment", costUsdMicros: -50,
      reconciliationStatus: "adjusted", adjustmentOfEventId: "usage-original",
    }),
    layer: "hot",
  });
  assert.equal(projected.kind, "requires_event_store");
});
