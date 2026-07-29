import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryAiUsageControl,
  buildAiExecutionKey,
  evaluateAiBudget,
  type AiExecutionKeyInput,
} from "./aiUsageControl.js";

const key: AiExecutionKeyInput = {
  tenantId: "tenant-a",
  feature: "context_packet",
  sourceDigest: "A".repeat(64),
  extractionRunId: null,
  policyVersion: "policy-v1",
  promptVersion: "prompt-v1",
  modelId: "gemini-3.1-flash-lite",
};

test("execution key is deterministic and normalizes the source digest", () => {
  assert.equal(buildAiExecutionKey(key), buildAiExecutionKey({ ...key, sourceDigest: "a".repeat(64) }));
});

test("active and succeeded guards prevent duplicate execution", () => {
  const control = new InMemoryAiUsageControl();
  const first = control.acquire({
    key,
    attemptId: "attempt-1",
    now: "2026-07-29T00:00:00.000Z",
    leaseExpiresAt: "2026-07-29T00:05:00.000Z",
  });
  assert.equal(first.acquired, true);
  const duplicate = control.acquire({
    key,
    attemptId: "attempt-2",
    now: "2026-07-29T00:01:00.000Z",
    leaseExpiresAt: "2026-07-29T00:06:00.000Z",
  });
  assert.equal(duplicate.acquired, false);
  if (duplicate.acquired) assert.fail("duplicate execution unexpectedly acquired");
  assert.equal(duplicate.reason, "active_lease");

  const executionKey = buildAiExecutionKey(key);
  control.settle({
    executionKey,
    attemptId: "attempt-1",
    occurredAt: "2026-07-29T00:02:00.000Z",
    outcome: "succeeded",
  });
  const afterSuccess = control.acquire({
    key,
    attemptId: "attempt-3",
    now: "2026-07-29T00:03:00.000Z",
    leaseExpiresAt: "2026-07-29T00:08:00.000Z",
  });
  assert.equal(afterSuccess.acquired, false);
  if (afterSuccess.acquired) assert.fail("settled execution unexpectedly acquired");
  assert.equal(afterSuccess.reason, "already_succeeded");
});

test("failed or expired attempts can be reacquired with append-only attempt events", () => {
  const control = new InMemoryAiUsageControl();
  const first = control.acquire({
    key,
    attemptId: "attempt-1",
    now: "2026-07-29T00:00:00.000Z",
    leaseExpiresAt: "2026-07-29T00:01:00.000Z",
  });
  assert.equal(first.acquired, true);
  const reacquired = control.acquire({
    key,
    attemptId: "attempt-2",
    now: "2026-07-29T00:02:00.000Z",
    leaseExpiresAt: "2026-07-29T00:03:00.000Z",
  });
  assert.equal(reacquired.acquired, true);
  assert.deepEqual(
    control.listAttemptEvents().map((event) => event.kind),
    ["started", "lease_expired", "started"],
  );

  control.settle({
    executionKey: buildAiExecutionKey(key),
    attemptId: "attempt-2",
    occurredAt: "2026-07-29T00:02:30.000Z",
    outcome: "failed",
    detail: "provider_timeout",
  });
  const retry = control.acquire({
    key,
    attemptId: "attempt-3",
    now: "2026-07-29T00:02:40.000Z",
    leaseExpiresAt: "2026-07-29T00:04:00.000Z",
  });
  assert.equal(retry.acquired, true);
});

test("usage and reconciliation adjustments are both retained", () => {
  const control = new InMemoryAiUsageControl();
  const base = {
    occurredAt: "2026-07-29T00:00:00.000Z",
    tenantId: "tenant-a",
    project: "zukan",
    feature: "context_packet",
    requestId: "request-1",
    executionKey: null,
    attemptId: null,
    provider: "google",
    providerRequestId: "provider-request-1",
    modelId: "gemini-3.1-flash-lite",
    pricingVersion: "google-2026-07-29",
    promptVersion: "prompt-v1",
    inputTokens: 100,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 20,
    outcome: "ok" as const,
    rawUsageJson: "{\"promptTokenCount\":100,\"candidatesTokenCount\":20}",
    retryOfEventId: null,
  };
  const usage = control.recordUsage({
    ...base,
    costUsdMicros: 100,
    eventKind: "usage",
    reconciliationStatus: "pending",
  });
  const adjustment = control.recordUsage({
    ...base,
    requestId: "reconciliation-1",
    inputTokens: 0,
    outputTokens: 0,
    costUsdMicros: -10,
    eventKind: "adjustment",
    reconciliationStatus: "adjusted",
    retryOfEventId: usage.eventId,
  });
  assert.equal(usage.recordedSequence, 1);
  assert.equal(adjustment.recordedSequence, 2);
  assert.equal(control.listUsageEvents().length, 2);
});

test("budget decision checks request hourly feature and tenant limits", () => {
  assert.deepEqual(evaluateAiBudget({
    projectedRequestUsdMicros: 60,
    snapshot: {
      hourlyUsdMicros: 50,
      featureMonthlyUsdMicros: 150,
      tenantMonthlyUsdMicros: 250,
    },
    limits: {
      requestUsdMicros: 50,
      hourlyUsdMicros: 100,
      featureMonthlyUsdMicros: 200,
      tenantMonthlyUsdMicros: 300,
    },
  }), {
    allowed: false,
    reasons: ["request_limit", "hourly_limit", "feature_monthly_limit", "tenant_monthly_limit"],
  });
});
