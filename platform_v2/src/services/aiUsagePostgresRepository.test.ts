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

  release(): void {
    this.released = true;
  }
}

class ScriptedPool implements AiUsagePostgresPool {
  readonly directCalls: Array<{ sql: string; params: readonly unknown[] }> = [];

  constructor(
    readonly client: ScriptedClient,
    private readonly directResponses: Response[] = [],
  ) {}

  async connect(): Promise<AiUsagePostgresClient> {
    return this.client;
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: T[]; rowCount?: number | null }> {
    this.directCalls.push({ sql, params });
    const response = this.directResponses.shift() ?? { rows: [] };
    return { rows: response.rows as T[], rowCount: response.rowCount ?? response.rows.length };
  }
}

function usageInput(): RecordAiUsageInput {
  return {
    eventId: "usage-1",
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
    costUsdMicros: 100,
    retryCount: 0,
    fallbackDepth: 0,
    providerFailureCount: 0,
    eventKind: "usage",
    outcome: "ok",
    reconciliationStatus: "pending",
    rawUsageJson: "{\"promptTokenCount\":100,\"candidatesTokenCount\":20}",
    retryOfEventId: null,
    adjustmentOfEventId: null,
  };
}

test("Postgres acquire uses a transaction, advisory lock, guard row, and attempt event", async () => {
  const client = new ScriptedClient([
    { rows: [] }, { rows: [] }, { rows: [] },
    { rows: [] }, { rows: [] }, { rows: [] },
  ]);
  const repository = new AiUsagePostgresRepository(new ScriptedPool(client));
  const result = await repository.acquire({
    key: {
      tenantId: "tenant-a",
      feature: "context_packet",
      sourceDigest: "a".repeat(64),
      extractionRunId: null,
      policyVersion: "policy-v1",
      promptVersion: "prompt-v1",
      modelId: "gemini-3.1-flash-lite",
    },
    attemptId: "attempt-1",
    now: "2026-07-29T00:00:00.000Z",
    leaseExpiresAt: "2026-07-29T00:05:00.000Z",
  });

  assert.equal(result.acquired, true);
  assert.equal(client.calls[0]?.sql, "BEGIN");
  assert.match(client.calls[1]?.sql ?? "", /pg_advisory_xact_lock/u);
  assert.match(client.calls[2]?.sql ?? "", /FOR UPDATE/u);
  assert.match(client.calls[3]?.sql ?? "", /INSERT INTO ai_execution_guards/u);
  assert.match(client.calls[4]?.sql ?? "", /INSERT INTO ai_execution_attempt_events/u);
  assert.equal(client.calls[5]?.sql, "COMMIT");
  assert.equal(client.released, true);
});

test("Postgres usage insert returns the authoritative recorded sequence", async () => {
  const input = usageInput();
  const row = {
    event_id: input.eventId,
    recorded_sequence: "7",
    occurred_at: input.occurredAt,
    tenant_id: input.tenantId,
    project: input.project,
    feature: input.feature,
    request_id: input.requestId,
    execution_key: input.executionKey,
    attempt_id: input.attemptId,
    provider: input.provider,
    provider_request_id: input.providerRequestId,
    model_id: input.modelId,
    pricing_version: input.pricingVersion,
    prompt_version: input.promptVersion,
    input_tokens: input.inputTokens,
    cached_input_tokens: input.cachedInputTokens,
    cache_write_tokens: input.cacheWriteTokens,
    output_tokens: input.outputTokens,
    cost_usd_micros: input.costUsdMicros,
    retry_count: input.retryCount,
    fallback_depth: input.fallbackDepth,
    provider_failure_count: input.providerFailureCount,
    event_kind: input.eventKind,
    outcome: input.outcome,
    reconciliation_status: input.reconciliationStatus,
    raw_usage: JSON.parse(input.rawUsageJson),
    retry_of_event_id: input.retryOfEventId,
    adjustment_of_event_id: input.adjustmentOfEventId,
  };
  const client = new ScriptedClient([
    { rows: [] }, { rows: [] }, { rows: [] }, { rows: [row] }, { rows: [] },
  ]);
  const repository = new AiUsagePostgresRepository(new ScriptedPool(client));
  const inserted = await repository.recordUsage(input);

  assert.equal(inserted.recordedSequence, 7);
  assert.equal(inserted.eventId, "usage-1");
  assert.match(client.calls[3]?.sql ?? "", /INSERT INTO ai_usage_events/u);
  assert.equal(client.calls[4]?.sql, "COMMIT");
});

test("Postgres persistence rejects prompt or response content before opening a transaction", async () => {
  const client = new ScriptedClient([]);
  const repository = new AiUsagePostgresRepository(new ScriptedPool(client));
  await assert.rejects(() => repository.recordUsage({
    ...usageInput(),
    eventId: "usage-sensitive",
    rawUsageJson: JSON.stringify({ response_body: "secret" }),
  }), /ai_usage_raw_usage_forbidden_key:response_body/u);
  assert.equal(client.calls.length, 0);
});

test("Postgres budget snapshot reads gross usage and excludes reconciliation adjustments", async () => {
  const client = new ScriptedClient([]);
  const pool = new ScriptedPool(client, [{
    rows: [{
      hourly_usd_micros: "10",
      feature_monthly_usd_micros: "20",
      tenant_monthly_usd_micros: "30",
      retry_count: "2",
      fallback_depth: "1",
      provider_failure_count: "3",
    }],
  }]);
  const repository = new AiUsagePostgresRepository(pool);
  const snapshot = await repository.budgetSnapshot({
    tenantId: "tenant-a",
    project: "zukan",
    feature: "context_packet",
    now: "2026-07-29T00:10:00.000Z",
  });

  assert.deepEqual(snapshot, {
    hourlyUsdMicros: 10,
    featureMonthlyUsdMicros: 20,
    tenantMonthlyUsdMicros: 30,
    retryCount: 2,
    fallbackDepth: 1,
    providerFailureCount: 3,
  });
  const sql = pool.directCalls[0]?.sql ?? "";
  assert.match(sql, /date_trunc\('hour'/u);
  assert.match(sql, /date_trunc\('month'/u);
  assert.match(sql, /event_kind = 'usage'/u);
});
