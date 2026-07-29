import assert from "node:assert/strict";
import test from "node:test";
import { AiExecutionBoundary, AiProviderInvocationError } from "./aiExecutionBoundary.js";
import { InMemoryAiUsageRepository, type AiBudgetSnapshotInput, type AiExecutionKeyInput } from "./aiUsageControl.js";

class TestRepository extends InMemoryAiUsageRepository {
  async budgetSnapshot(_input: AiBudgetSnapshotInput) {
    return { hourlyUsdMicros: 0, featureMonthlyUsdMicros: 0, tenantMonthlyUsdMicros: 0, retryCount: 0, fallbackDepth: 0, providerFailureCount: 0 };
  }
}

const key: AiExecutionKeyInput = {
  tenantId: "tenant-a", project: "zukan", workspaceId: null, feature: "context_packet",
  provider: "google", modelId: "gemini-3.1-flash-lite", operationVersion: "context/v2",
  canonicalInputDigest: "a".repeat(64), sourceDigest: "b".repeat(64), extractionRunId: null,
  policyVersion: "policy-v1", promptVersion: "prompt-v1", targetTime: null,
};
const limits = {
  requestUsdMicros: 1_000, hourlyUsdMicros: 10_000, featureMonthlyUsdMicros: 100_000,
  tenantMonthlyUsdMicros: 100_000, retryCount: 10, fallbackDepth: 3, providerFailureCount: 10,
};

test("boundary records and settles successful provider attempts", async () => {
  const repository = new TestRepository(() => new Date("2026-07-29T00:00:00Z"));
  const boundary = new AiExecutionBoundary(repository, () => new Date("2026-07-29T00:00:01Z"));
  const value = await boundary.execute({
    key, attemptId: "attempt-1", leaseDurationMs: 60_000,
    requestId: "request-1", providerAccountId: "account-a", pricingVersion: "pricing-v1",
    budgetLimits: limits,
    budgetProjection: { requestUsdMicros: 100, retryCount: 0, fallbackDepth: 0, providerFailureCount: 0 },
    invoke: async () => ({
      value: "ok",
      telemetry: {
        providerRequestId: "provider-1", rawUsageJson: '{"prompt_tokens":1,"completion_tokens":1}',
        inputTokens: 1, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 1,
        costUsdMicros: 100, retryCount: 0, fallbackDepth: 0, providerFailureCount: 0,
      },
    }),
  });
  assert.equal(value, "ok");
  assert.equal((await repository.listUsageEvents()).length, 1);
  assert.equal((await repository.listUsageEvents())[0]?.outcome, "ok");
});

test("boundary records failed provider attempts before rethrowing", async () => {
  const repository = new TestRepository(() => new Date("2026-07-29T00:00:00Z"));
  const boundary = new AiExecutionBoundary(repository, () => new Date("2026-07-29T00:00:01Z"));
  await assert.rejects(() => boundary.execute({
    key, attemptId: "attempt-2", leaseDurationMs: 60_000,
    requestId: "request-2", providerAccountId: "account-a", pricingVersion: "pricing-v1",
    budgetLimits: limits,
    budgetProjection: { requestUsdMicros: 100, retryCount: 0, fallbackDepth: 0, providerFailureCount: 1 },
    invoke: async () => { throw new AiProviderInvocationError("timeout", "timeout", {
      providerRequestId: "provider-2", rawUsageJson: '{"prompt_tokens":1}', inputTokens: 1,
      costUsdMicros: 10, providerFailureCount: 1,
    }); },
  }), /timeout/u);
  const events = await repository.listUsageEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0]?.outcome, "timeout");
  assert.equal(events[0]?.providerFailureCount, 1);
});
