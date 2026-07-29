import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { adaptPgPoolForAiUsage } from "./aiUsagePgPoolAdapter.js";
import { AiUsagePostgresRepository } from "./aiUsagePostgresRepository.js";

const enabled = process.env.AI_USAGE_TEST_ALLOW_MUTATION === "1"
  && Boolean(process.env.AI_USAGE_TEST_DATABASE_URL?.trim());
const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrations = [
  "0140_ai_usage_control.sql",
  "0141_ai_usage_control_hardening.sql",
  "0142_ai_usage_metadata_allowlist.sql",
  "0143_ai_usage_contract_v2.sql",
  "0144_ai_usage_invocation_identity.sql",
];

const key = {
  tenantId: "tenant-a", project: "zukan", workspaceId: null, feature: "integration",
  provider: "google", modelId: "gemini-test", operationVersion: "integration/v1",
  invocationId: "integration-invocation-1",
  canonicalInputDigest: "a".repeat(64), sourceDigest: "b".repeat(64), extractionRunId: null,
  policyVersion: "policy-v1", promptVersion: "prompt-v1", targetTime: null,
};

test("AI usage PostgreSQL migration and concurrency contract", { skip: !enabled }, async () => {
  const connectionString = process.env.AI_USAGE_TEST_DATABASE_URL!.trim();
  const admin = new Pool({ connectionString });
  const schema = `ai_usage_test_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^[a-z0-9_]+$/u);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  try {
    for (const migration of migrations) {
      await pool.query(readFileSync(path.join(platformRoot, "db/migrations", migration), "utf8"));
    }
    const repositoryA = new AiUsagePostgresRepository(adaptPgPoolForAiUsage(pool));
    const repositoryB = new AiUsagePostgresRepository(adaptPgPoolForAiUsage(pool));
    const [left, right] = await Promise.all([
      repositoryA.acquire({ key, attemptId: "attempt-a", leaseDurationMs: 30_000 }),
      repositoryB.acquire({ key, attemptId: "attempt-b", leaseDurationMs: 30_000 }),
    ]);
    assert.equal([left, right].filter((result) => result.acquired).length, 1);
    assert.equal([left, right].filter((result) => !result.acquired).length, 1);
    const acquired = left.acquired ? left : right.acquired ? right : null;
    assert.ok(acquired);

    await assert.rejects(() => pool.query(`INSERT INTO ai_usage_events(
      event_id, occurred_at, tenant_id, project, workspace_id, feature, operation_version,
      request_id, execution_key, attempt_id, lease_generation, provider, provider_request_id,
      provider_account_id, model_id, pricing_version, prompt_version, input_tokens,
      cached_input_tokens, cache_write_tokens, output_tokens, cost_usd_micros, retry_count,
      fallback_depth, provider_failure_count, event_kind, outcome, reconciliation_status,
      raw_usage, retry_of_event_id, adjustment_of_event_id
    ) VALUES (
      'cross-tenant', clock_timestamp(), 'tenant-b', 'zukan', NULL, 'integration', 'integration/v1',
      'request-cross', $1, $2, $3, 'google', 'provider-cross', 'account-a', 'gemini-test',
      'pricing-v1', 'prompt-v1', 1,0,0,1,1,0,0,0,'usage','ok','pending',
      '{"prompt_tokens":1}'::jsonb,NULL,NULL
    )`, [acquired.guard.executionKey, acquired.guard.holderAttemptId, acquired.guard.leaseGeneration]), /ai_usage_guard_scope_mismatch/u);

    const baseUsage = {
      occurredAt: new Date().toISOString(), tenantId: "tenant-free", project: "zukan",
      workspaceId: null, feature: "free", operationVersion: "free/v1",
      executionKey: null, attemptId: null, leaseGeneration: null,
      provider: "google", providerRequestId: "provider-unique", providerAccountId: "account-a",
      modelId: "gemini-test", pricingVersion: "pricing-v1", promptVersion: "prompt-v1",
      inputTokens: 1, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 1,
      costUsdMicros: 1, retryCount: 0, fallbackDepth: 0, providerFailureCount: 0,
      eventKind: "usage" as const, outcome: "ok" as const, reconciliationStatus: "pending" as const,
      rawUsageJson: '{"prompt_tokens":1}', retryOfEventId: null, adjustmentOfEventId: null,
    };
    await repositoryA.recordUsage({ ...baseUsage, eventId: "unique-1", requestId: "request-1" });
    await assert.rejects(() => repositoryA.recordUsage({
      ...baseUsage, eventId: "unique-2", requestId: "request-2",
    }), /duplicate key|uq_ai_usage_provider_request/iu);

    await assert.rejects(() => pool.query(`INSERT INTO ai_usage_events(
      event_id, occurred_at, tenant_id, project, feature, operation_version, request_id,
      provider, model_id, pricing_version, prompt_version, input_tokens, output_tokens,
      cost_usd_micros, retry_count, fallback_depth, provider_failure_count, event_kind,
      outcome, reconciliation_status, raw_usage
    ) VALUES ('unsafe',clock_timestamp(),'tenant-a','zukan','unsafe','unsafe/v1','unsafe',
      'google','gemini-test','pricing-v1','prompt-v1',1,1,1,0,0,0,'usage','ok','pending',
      '{"unknown":1}'::jsonb)`), /check constraint|ai_usage_events_raw_usage_chk/iu);

    await assert.rejects(() => pool.query("UPDATE ai_usage_events SET cost_usd_micros=0 WHERE event_id='unique-1'"), /append-only/iu);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});

test("AI usage PostgreSQL fencing budget clock and teardown contract", { skip: !enabled }, async () => {
  const connectionString = process.env.AI_USAGE_TEST_DATABASE_URL!.trim();
  const admin = new Pool({ connectionString });
  const schema = `ai_usage_test_${randomUUID().replaceAll("-", "")}`;
  assert.match(schema, /^[a-z0-9_]+$/u);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  try {
    for (const migration of migrations) {
      await pool.query(readFileSync(path.join(platformRoot, "db/migrations", migration), "utf8"));
    }
    const repository = new AiUsagePostgresRepository(adaptPgPoolForAiUsage(pool));
    const fenceKey = { ...key, invocationId: "integration-invocation-fence" };
    const first = await repository.acquire({ key: fenceKey, attemptId: "fence-a", leaseDurationMs: 1 });
    assert.equal(first.acquired, true);
    assert.ok(first.guard);
    const stale = first.guard;

    await new Promise((resolve) => setTimeout(resolve, 25));
    const second = await repository.acquire({ key: fenceKey, attemptId: "fence-b", leaseDurationMs: 30_000 });
    assert.equal(second.acquired, true);
    assert.ok(second.guard);
    assert.equal(second.guard.leaseGeneration, stale.leaseGeneration + 1);

    await assert.rejects(() => repository.renew({
      executionKey: stale.executionKey, attemptId: "fence-a",
      leaseGeneration: stale.leaseGeneration, leaseDurationMs: 30_000,
    }), /ai_guard_holder_mismatch|ai_guard_fencing_mismatch/u);
    await assert.rejects(() => repository.renew({
      executionKey: stale.executionKey, attemptId: second.guard.holderAttemptId,
      leaseGeneration: stale.leaseGeneration, leaseDurationMs: 30_000,
    }), /ai_guard_fencing_mismatch/u);
    await assert.rejects(() => repository.settle({
      executionKey: stale.executionKey, attemptId: second.guard.holderAttemptId,
      leaseGeneration: stale.leaseGeneration, outcome: "succeeded",
    }), /ai_guard_fencing_mismatch/u);

    const fencedUsage = {
      occurredAt: new Date().toISOString(), tenantId: key.tenantId, project: key.project,
      workspaceId: null, feature: key.feature, operationVersion: key.operationVersion,
      provider: key.provider, providerAccountId: "account-a", modelId: key.modelId,
      pricingVersion: "pricing-v1", promptVersion: "prompt-v1",
      inputTokens: 1, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 1,
      costUsdMicros: 1, retryCount: 0, fallbackDepth: 0, providerFailureCount: 0,
      eventKind: "usage" as const, outcome: "ok" as const, reconciliationStatus: "pending" as const,
      rawUsageJson: '{"prompt_tokens":1}', retryOfEventId: null, adjustmentOfEventId: null,
    };
    await assert.rejects(() => repository.recordUsage({
      ...fencedUsage, eventId: "fenced-1", requestId: "request-fenced-1",
      providerRequestId: "provider-fenced-1", executionKey: stale.executionKey,
      attemptId: second.guard.holderAttemptId, leaseGeneration: stale.leaseGeneration,
    }), /fencing_mismatch/u);

    const clockTenant = `tenant-clock-${randomUUID().slice(0, 8)}`;
    await repository.recordUsage({
      ...fencedUsage, tenantId: clockTenant, feature: "clock",
      occurredAt: "2000-01-01T00:00:00.000Z",
      eventId: "clock-1", requestId: "request-clock-1", providerRequestId: "provider-clock-1",
      executionKey: null, attemptId: null, leaseGeneration: null, costUsdMicros: 77,
    });
    const recorded = await pool.query<{ occurred_at: string; recorded_at: string }>(
      "SELECT occurred_at::text AS occurred_at, recorded_at::text AS recorded_at FROM ai_usage_events WHERE event_id='clock-1'",
    );
    const row = recorded.rows[0];
    assert.ok(row);
    assert.match(row.occurred_at, /^2000-01-01/u);
    assert.ok(Date.parse(row.recorded_at) > Date.parse("2020-01-01T00:00:00.000Z"));

    const snapshot = await repository.budgetSnapshot!({
      tenantId: clockTenant, project: key.project, workspaceId: null,
      feature: "clock", now: "1900-01-01T00:00:00.000Z",
    });
    assert.equal(snapshot.tenantMonthlyUsdMicros, 77);
    assert.equal(snapshot.hourlyUsdMicros, 77);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    const remaining = await admin.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM information_schema.schemata WHERE schema_name=$1",
      [schema],
    );
    assert.equal(remaining.rows[0]?.count, "0");
    await admin.end();
  }
});
