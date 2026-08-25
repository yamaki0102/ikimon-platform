import assert from "node:assert/strict";
import test from "node:test";
import type { RecordAiUsageInput } from "./aiUsageControl.js";
import {
  AiUsagePostgresRepository,
  type AiUsagePostgresClient,
  type AiUsagePostgresPool,
} from "./aiUsagePostgresRepository.js";

type Response = { rows: Record<string, unknown>[]; rowCount?: number };
class ScriptedClient implements AiUsagePostgresClient {
  readonly calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  released = false;
  constructor(private readonly responses: Response[]) {}
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: T[]; rowCount?: number | null }> {
    this.calls.push({ sql, params });
    const response = this.responses.shift() ?? { rows: [] };
    return { rows: response.rows as T[], rowCount: response.rowCount ?? response.rows.length };
  }
  release(): void { this.released = true }
}
class ScriptedPool implements AiUsagePostgresPool {
  readonly directCalls: Array<{ sql: string; params: readonly unknown[] }> = [];
  constructor(readonly client: ScriptedClient, private readonly responses: Response[] = []) {}
  async connect(): Promise<AiUsagePostgresClient> { return this.client }
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: T[]; rowCount?: number | null }> {
    this.directCalls.push({ sql, params });
    const response = this.responses.shift() ?? { rows: [] };
    return { rows: response.rows as T[], rowCount: response.rowCount ?? response.rows.length };
  }
}

const key = {
  tenantId: "tenant-a", project: "zukan", workspaceId: null, feature: "context_packet",
  provider: "google", modelId: "gemini-3.1-flash-lite", operationVersion: "context/v2",
  invocationId: "invocation-postgres-1",
  canonicalInputDigest: "a".repeat(64), sourceDigest: "b".repeat(64), extractionRunId: null,
  policyVersion: "policy-v1", promptVersion: "prompt-v1", targetTime: null,
};
function guardRow() {
  return {
    execution_key: "c".repeat(64), tenant_id: key.tenantId, project: key.project,
    workspace_id: key.workspaceId, feature: key.feature, provider: key.provider,
    model_id: key.modelId, operation_version: key.operationVersion,
    invocation_id: key.invocationId,
    canonical_input_digest: key.canonicalInputDigest, source_digest: key.sourceDigest,
    extraction_run_id: null, policy_version: key.policyVersion, prompt_version: key.promptVersion,
    target_time: null, holder_attempt_id: "attempt-1", lease_generation: "1",
    acquired_at: "2026-07-29T00:00:00.000Z", lease_expires_at: "2026-07-29T00:01:00.000Z",
    state: "active", settled_at: null,
  };
}
function usage(overrides: Partial<RecordAiUsageInput> = {}): RecordAiUsageInput {
  return {
    eventId: "usage-1", occurredAt: "2026-07-29T00:00:00.000Z",
    tenantId: key.tenantId, project: key.project, workspaceId: null, feature: key.feature,
    operationVersion: key.operationVersion, requestId: "request-1",
    executionKey: null, attemptId: null, leaseGeneration: null,
    provider: key.provider, providerRequestId: "provider-1", providerAccountId: "account-1",
    modelId: key.modelId, pricingVersion: "pricing-v1", promptVersion: key.promptVersion,
    inputTokens: 1, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 1,
    costUsdMicros: 10, retryCount: 0, fallbackDepth: 0, providerFailureCount: 0,
    eventKind: "usage", outcome: "ok", reconciliationStatus: "pending",
    rawUsageJson: '{"prompt_tokens":1,"completion_tokens":1}',
    retryOfEventId: null, adjustmentOfEventId: null, ...overrides,
  };
}

test("acquire uses database clock generation invocation and bounded duration", async () => {
  const row = guardRow();
  const client = new ScriptedClient([
    { rows: [] }, { rows: [] }, { rows: [{ now: "2026-07-29T00:00:00.000Z" }] },
    { rows: [] }, { rows: [] }, { rows: [] }, { rows: [row] }, { rows: [] },
  ]);
  const repository = new AiUsagePostgresRepository(new ScriptedPool(client));
  const result = await repository.acquire({ key, attemptId: "attempt-1", leaseDurationMs: 60_000 });
  assert.equal(result.acquired, true);
  assert.match(client.calls[2]?.sql ?? "", /clock_timestamp/u);
  assert.match(client.calls[4]?.sql ?? "", /invocation_id/u);
  assert.match(client.calls[4]?.sql ?? "", /lease_generation/u);
  assert.match(client.calls[4]?.sql ?? "", /interval '1 millisecond'/u);
  assert.equal(client.calls[7]?.sql, "COMMIT");
});

test("strict metadata rejects unknown keys before a transaction", async () => {
  const client = new ScriptedClient([]);
  const repository = new AiUsagePostgresRepository(new ScriptedPool(client));
  await assert.rejects(() => repository.recordUsage(usage({ rawUsageJson: '{"unknown":1}' })), /unknown_key:unknown/u);
  assert.equal(client.calls.length, 0);
});

test("budget query uses database UTC clock and prefilters tenant gross usage", async () => {
  const pool = new ScriptedPool(new ScriptedClient([]), [{ rows: [{
    hourly_usd_micros: "1", feature_monthly_usd_micros: "2", tenant_monthly_usd_micros: "3",
    retry_count: "0", fallback_depth: "0", provider_failure_count: "0",
  }] }]);
  const repository = new AiUsagePostgresRepository(pool);
  const snapshot = await repository.budgetSnapshot({
    tenantId: key.tenantId, project: key.project, workspaceId: null,
    feature: key.feature, now: "1900-01-01T00:00:00.000Z",
  });
  assert.equal(snapshot.tenantMonthlyUsdMicros, 3);
  const sql = pool.directCalls[0]?.sql ?? "";
  assert.match(sql, /date_trunc\('month',clock_timestamp\(\),'UTC'\)/u);
  assert.match(sql, /WHERE tenant_id=\$1 AND event_kind='usage'/u);
  assert.match(sql, /recorded_at>=bounds\.month_start/u);
  assert.doesNotMatch(sql, /\$5::timestamptz/u);
});
