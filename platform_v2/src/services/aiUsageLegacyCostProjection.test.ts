import assert from "node:assert/strict";
import test from "node:test";
import type { AiUsageEvent } from "./aiUsageControl.js";
import { projectUsageToLegacyAiCostLog } from "./aiUsageLegacyCostProjection.js";

function event(overrides: Partial<AiUsageEvent> = {}): AiUsageEvent {
  return {
    eventId: "event-1",
    occurredAt: "2026-07-29T00:00:00.000Z",
    recordedSequence: 1,
    tenantId: "tenant-a",
    project: "zukan",
    feature: "context_packet",
    requestId: "request-1",
    executionKey: "execution-1",
    attemptId: "attempt-1",
    provider: "google",
    providerRequestId: "provider-1",
    modelId: "gemini-3.1-flash-lite",
    pricingVersion: "google-2026-07-29",
    promptVersion: "prompt-v1",
    inputTokens: 100,
    cachedInputTokens: 20,
    cacheWriteTokens: 0,
    outputTokens: 10,
    costUsdMicros: 250,
    retryCount: 1,
    fallbackDepth: 1,
    providerFailureCount: 1,
    eventKind: "usage",
    outcome: "ok",
    reconciliationStatus: "pending",
    rawUsageJson: "{}",
    retryOfEventId: null,
    adjustmentOfEventId: null,
    ...overrides,
  };
}

test("usage event projects into the existing ai_cost_log shape", () => {
  const projected = projectUsageToLegacyAiCostLog({ event: event(), layer: "hot" });
  assert.equal(projected.kind, "loggable");
  if (projected.kind !== "loggable") assert.fail("usage event was not loggable");
  assert.equal(projected.entry.provider, "gemini");
  assert.equal(projected.entry.costUsd, 0.00025);
  assert.equal(projected.entry.cacheHit, true);
  assert.equal(projected.entry.escalated, true);
  assert.equal(projected.entry.metadata?.aiProviderRequestId, "provider-1");
  assert.equal(typeof projected.entry.metadata?.aiRawUsageSha256, "string");
  assert.equal("aiRawUsageJson" in (projected.entry.metadata ?? {}), false);
});

test("negative reconciliation adjustment is not silently written to ai_cost_log", () => {
  const projected = projectUsageToLegacyAiCostLog({
    event: event({
      eventKind: "adjustment",
      costUsdMicros: -50,
      reconciliationStatus: "adjusted",
      adjustmentOfEventId: "usage-original",
    }),
    layer: "hot",
  });
  assert.deepEqual(projected, {
    kind: "requires_event_store",
    reason: "adjustment_not_supported_by_ai_cost_log",
    usageEventId: "event-1",
  });
});
