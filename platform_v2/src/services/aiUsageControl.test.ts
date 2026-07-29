import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryAiUsageRepository,
  buildAiExecutionKey,
  evaluateAiBudget,
  normalizeAiUsageMetadata,
  type AiExecutionKeyInput,
  type RecordAiUsageInput,
} from "./aiUsageControl.js";

function clock(start = "2026-07-29T00:00:00.000Z") {
  let epoch = Date.parse(start);
  return { now: () => new Date(epoch), advance: (ms: number) => { epoch += ms; } };
}

const key: AiExecutionKeyInput = {
  tenantId: "tenant-a", project: "zukan", workspaceId: null, feature: "context_packet",
  provider: "google", modelId: "gemini-3.1-flash-lite", operationVersion: "context/v1",
  canonicalInputDigest: "b".repeat(64), sourceDigest: "A".repeat(64), extractionRunId: null,
  policyVersion: "policy-v1", promptVersion: "prompt-v1", targetTime: "2026-07-29T00:00:00+00:00",
};

function usage(overrides: Partial<RecordAiUsageInput> = {}): RecordAiUsageInput {
  return {
    eventId: "usage-1", occurredAt: "2026-07-29T00:00:00.000Z",
    tenantId: key.tenantId, project: key.project, workspaceId: key.workspaceId,
    feature: key.feature, operationVersion: key.operationVersion, requestId: "request-1",
    executionKey: null, attemptId: null, leaseGeneration: null,
    provider: key.provider, providerRequestId: "provider-request-1", providerAccountId: "google-account-a",
    modelId: key.modelId, pricingVersion: "google-2026-07-29", promptVersion: key.promptVersion,
    inputTokens: 100, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 20,
    costUsdMicros: 100, retryCount: 0, fallbackDepth: 0, providerFailureCount: 0,
    eventKind: "usage", outcome: "ok", reconciliationStatus: "pending",
    rawUsageJson: "{\"promptTokenCount\":100,\"candidatesTokenCount\":20}",
    retryOfEventId: null, adjustmentOfEventId: null, ...overrides,
  };
}

test("execution identity includes project workspace provider operation and canonical input", () => {
  const first = buildAiExecutionKey(key);
  assert.equal(first, buildAiExecutionKey({ ...key, sourceDigest: "a".repeat(64), targetTime: "2026-07-29T00:00:00.000Z" }));
  for (const changed of [
    { project: "iportal" }, { workspaceId: "workspace-a" }, { provider: "anthropic" },
    { operationVersion: "context/v2" }, { canonicalInputDigest: "c".repeat(64) },
  ]) assert.notEqual(first, buildAiExecutionKey({ ...key, ...changed }));
});

test("lease uses repository clock generation fencing renew and expiry", async () => {
  const time = clock();
  const repository = new InMemoryAiUsageRepository(time.now);
  const first = await repository.acquire({ key, attemptId: "attempt-1", leaseDurationMs: 60_000 });
  assert.equal(first.acquired, true);
  if (!first.acquired) assert.fail();
  assert.equal(first.guard.leaseGeneration, 1);
  time.advance(30_000);
  const renewed = await repository.renew({
    executionKey: first.guard.executionKey, attemptId: "attempt-1", leaseGeneration: 1, leaseDurationMs: 60_000,
  });
  assert.equal(renewed.leaseExpiresAt, "2026-07-29T00:01:30.000Z");
  await assert.rejects(() => repository.settle({
    executionKey: first.guard.executionKey, attemptId: "attempt-1", leaseGeneration: 2, outcome: "succeeded",
  }), /ai_guard_fencing_mismatch/u);
  time.advance(61_000);
  await assert.rejects(() => repository.settle({
    executionKey: first.guard.executionKey, attemptId: "attempt-1", leaseGeneration: 1, outcome: "succeeded",
  }), /ai_guard_lease_expired/u);
  const second = await repository.acquire({ key, attemptId: "attempt-2", leaseDurationMs: 60_000 });
  assert.equal(second.acquired, true);
  if (!second.acquired) assert.fail();
  assert.equal(second.guard.leaseGeneration, 2);
});

test("usage bound to a guard must match full scope and fencing token", async () => {
  const repository = new InMemoryAiUsageRepository(clock().now);
  const acquired = await repository.acquire({ key, attemptId: "attempt-1", leaseDurationMs: 60_000 });
  if (!acquired.acquired) assert.fail();
  const linked = usage({
    executionKey: acquired.guard.executionKey,
    attemptId: acquired.guard.holderAttemptId,
    leaseGeneration: acquired.guard.leaseGeneration,
  });
  assert.equal((await repository.recordUsage(linked)).executionKey, acquired.guard.executionKey);
  await assert.rejects(() => repository.recordUsage({ ...linked, eventId: "usage-other-tenant", tenantId: "tenant-b" }), /ai_usage_guard_scope_mismatch/u);
  await assert.rejects(() => repository.recordUsage({ ...linked, eventId: "usage-old-fence", leaseGeneration: 99 }), /ai_usage_guard_fencing_mismatch/u);
});

test("usage metadata is strict allowlist and canonical", () => {
  assert.equal(normalizeAiUsageMetadata('{"completion_tokens":2,"prompt_tokens":1}'), '{"completion_tokens":2,"prompt_tokens":1}');
  assert.throws(() => normalizeAiUsageMetadata('{"foo":1}'), /ai_raw_usage_json_unknown_key:foo/u);
  assert.throws(() => normalizeAiUsageMetadata('{"prompt_tokens":"1"}'), /ai_raw_usage_json_count_invalid/u);
  assert.throws(() => normalizeAiUsageMetadata('{"messages":[]}'), /ai_raw_usage_json_unknown_key:messages/u);
});

test("retry and adjustment lineage require identical scope", async () => {
  const repository = new InMemoryAiUsageRepository(clock().now);
  const original = await repository.recordUsage(usage({ outcome: "error" }));
  await assert.rejects(() => repository.recordUsage(usage({
    eventId: "retry-1", requestId: "request-2", retryOfEventId: original.eventId, project: "iportal",
  })), /ai_retry_target_scope_mismatch/u);
  const adjustment = await repository.recordUsage(usage({
    eventId: "adjustment-1", requestId: "invoice-adjustment-1", inputTokens: 0, outputTokens: 0,
    costUsdMicros: -10, eventKind: "adjustment", reconciliationStatus: "adjusted",
    providerRequestId: null, adjustmentOfEventId: original.eventId,
  }));
  assert.equal(adjustment.eventKind, "adjustment");
});

test("budget decision includes projected retry fallback and provider failures", () => {
  assert.deepEqual(evaluateAiBudget({
    projection: { requestUsdMicros: 60, retryCount: 1, fallbackDepth: 2, providerFailureCount: 1 },
    snapshot: { hourlyUsdMicros: 50, featureMonthlyUsdMicros: 150, tenantMonthlyUsdMicros: 250, retryCount: 2, fallbackDepth: 1, providerFailureCount: 1 },
    limits: { requestUsdMicros: 50, hourlyUsdMicros: 100, featureMonthlyUsdMicros: 200, tenantMonthlyUsdMicros: 300, retryCount: 2, fallbackDepth: 1, providerFailureCount: 1 },
  }), {
    allowed: false,
    reasons: ["request_limit", "hourly_limit", "feature_monthly_limit", "tenant_monthly_limit", "retry_limit", "fallback_depth_limit", "provider_failure_limit"],
  });
});
