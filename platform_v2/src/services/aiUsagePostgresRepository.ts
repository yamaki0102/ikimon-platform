import { randomUUID } from "node:crypto";
import {
  buildAiExecutionKey,
  type AcquireAiExecutionInput,
  type AcquireAiExecutionResult,
  type AiBudgetSnapshot,
  type AiExecutionAttemptEvent,
  type AiExecutionGuard,
  type AiUsageEvent,
  type AiUsageRepository,
  type RecordAiUsageInput,
  type SettleAiExecutionInput,
} from "./aiUsageControl.js";

export interface AiUsagePostgresQueryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface AiUsagePostgresClient extends AiUsagePostgresQueryable {
  release(): void;
}

export interface AiUsagePostgresPool extends AiUsagePostgresQueryable {
  connect(): Promise<AiUsagePostgresClient>;
}

type GuardRow = {
  execution_key: string;
  holder_attempt_id: string;
  acquired_at: string;
  lease_expires_at: string;
  state: string;
  settled_at: string | null;
};

type UsageRow = {
  event_id: string;
  recorded_sequence: string | number;
  occurred_at: string;
  tenant_id: string;
  project: string;
  feature: string;
  request_id: string;
  execution_key: string | null;
  attempt_id: string | null;
  provider: string;
  provider_request_id: string | null;
  model_id: string;
  pricing_version: string;
  prompt_version: string;
  input_tokens: string | number;
  cached_input_tokens: string | number;
  cache_write_tokens: string | number;
  output_tokens: string | number;
  cost_usd_micros: string | number;
  retry_count: string | number;
  fallback_depth: string | number;
  provider_failure_count: string | number;
  event_kind: string;
  outcome: string;
  reconciliation_status: string;
  raw_usage: unknown;
  retry_of_event_id: string | null;
  adjustment_of_event_id: string | null;
};

const GUARD_SELECT = `SELECT execution_key, holder_attempt_id, acquired_at::text,
                             lease_expires_at::text, state, settled_at::text
                        FROM ai_execution_guards
                       WHERE execution_key = $1
                       FOR UPDATE`;

const USAGE_SELECT = `SELECT event_id, recorded_sequence, occurred_at::text, tenant_id, project,
                             feature, request_id, execution_key, attempt_id, provider,
                             provider_request_id, model_id, pricing_version, prompt_version,
                             input_tokens, cached_input_tokens, cache_write_tokens, output_tokens,
                             cost_usd_micros, retry_count, fallback_depth, provider_failure_count,
                             event_kind, outcome, reconciliation_status, raw_usage,
                             retry_of_event_id, adjustment_of_event_id
                        FROM ai_usage_events
                       WHERE event_id = $1`;

function timestamp(value: unknown, errorCode: string): string {
  const epoch = Date.parse(String(value));
  if (!Number.isFinite(epoch)) throw new Error(errorCode);
  return new Date(epoch).toISOString();
}

function integer(value: unknown, errorCode: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(errorCode);
  return parsed;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  errorCode: string,
): T[number] {
  const actual = String(value);
  if (!allowed.includes(actual)) throw new Error(`${errorCode}:${actual}`);
  return actual as T[number];
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortedValue(item)]),
  );
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortedValue(value));
}

function nonEmpty(value: string, errorCode: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function nonNegative(value: number, errorCode: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

function rawUsageJson(value: unknown): string {
  if (typeof value === "string") {
    try {
      return canonicalJson(JSON.parse(value));
    } catch {
      throw new Error("ai_usage_raw_usage_invalid");
    }
  }
  return canonicalJson(value ?? {});
}

function validatePersistentUsageInput(input: RecordAiUsageInput): void {
  nonEmpty(input.eventId, "ai_usage_event_id_required");
  timestamp(input.occurredAt, "ai_usage_occurred_at_invalid");
  nonEmpty(input.tenantId, "ai_usage_tenant_required");
  nonEmpty(input.project, "ai_usage_project_required");
  nonEmpty(input.feature, "ai_usage_feature_required");
  nonEmpty(input.requestId, "ai_usage_request_id_required");
  nonEmpty(input.provider, "ai_usage_provider_required");
  nonEmpty(input.modelId, "ai_usage_model_required");
  nonEmpty(input.pricingVersion, "ai_usage_pricing_version_required");
  nonEmpty(input.promptVersion, "ai_usage_prompt_version_required");
  nonNegative(input.inputTokens, "ai_usage_input_tokens_invalid");
  nonNegative(input.cachedInputTokens, "ai_usage_cached_input_tokens_invalid");
  nonNegative(input.cacheWriteTokens, "ai_usage_cache_write_tokens_invalid");
  nonNegative(input.outputTokens, "ai_usage_output_tokens_invalid");
  nonNegative(input.retryCount, "ai_usage_retry_count_invalid");
  nonNegative(input.fallbackDepth, "ai_usage_fallback_depth_invalid");
  nonNegative(input.providerFailureCount, "ai_usage_provider_failure_count_invalid");
  if (!Number.isSafeInteger(input.costUsdMicros)) throw new Error("ai_usage_cost_invalid");
  if (input.eventKind === "usage" && input.costUsdMicros < 0) throw new Error("ai_usage_cost_negative");
  if (input.eventKind === "adjustment") {
    if (input.retryOfEventId || !input.adjustmentOfEventId || input.reconciliationStatus !== "adjusted") {
      throw new Error("ai_usage_adjustment_shape_invalid");
    }
  } else if (input.adjustmentOfEventId || input.reconciliationStatus === "adjusted") {
    throw new Error("ai_usage_event_shape_invalid");
  }
  const parsed = JSON.parse(rawUsageJson(input.rawUsageJson)) as unknown;
  const inspect = (value: unknown, depth: number): void => {
    if (depth > 6) throw new Error("ai_usage_raw_usage_too_deep");
    if (typeof value === "string") {
      if (value.length > 1024) throw new Error("ai_usage_raw_usage_string_too_large");
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 256) throw new Error("ai_usage_raw_usage_array_too_large");
      value.forEach((item) => inspect(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 256) throw new Error("ai_usage_raw_usage_object_too_large");
    for (const [key, item] of entries) {
      if ([
        "content", "text", "prompt", "completion", "messages",
        "input", "output", "request_body", "response_body",
      ].includes(key.toLowerCase())) {
        throw new Error(`ai_usage_raw_usage_forbidden_key:${key}`);
      }
      inspect(item, depth + 1);
    }
  };
  if (canonicalJson(parsed).length > 16_384) throw new Error("ai_usage_raw_usage_too_large");
  inspect(parsed, 0);
}

function guardFromRow(row: GuardRow): AiExecutionGuard {
  return {
    executionKey: row.execution_key,
    holderAttemptId: row.holder_attempt_id,
    acquiredAt: timestamp(row.acquired_at, "ai_guard_acquired_at_invalid"),
    leaseExpiresAt: timestamp(row.lease_expires_at, "ai_guard_lease_expires_at_invalid"),
    state: enumValue(row.state, ["active", "succeeded", "failed"] as const, "ai_guard_state_invalid"),
    settledAt: row.settled_at === null ? null : timestamp(row.settled_at, "ai_guard_settled_at_invalid"),
  };
}

function usageFromRow(row: UsageRow): AiUsageEvent {
  return {
    eventId: row.event_id,
    recordedSequence: integer(row.recorded_sequence, "ai_usage_recorded_sequence_invalid"),
    occurredAt: timestamp(row.occurred_at, "ai_usage_occurred_at_invalid"),
    tenantId: row.tenant_id,
    project: row.project,
    feature: row.feature,
    requestId: row.request_id,
    executionKey: row.execution_key,
    attemptId: row.attempt_id,
    provider: row.provider,
    providerRequestId: row.provider_request_id,
    modelId: row.model_id,
    pricingVersion: row.pricing_version,
    promptVersion: row.prompt_version,
    inputTokens: integer(row.input_tokens, "ai_usage_input_tokens_invalid"),
    cachedInputTokens: integer(row.cached_input_tokens, "ai_usage_cached_input_tokens_invalid"),
    cacheWriteTokens: integer(row.cache_write_tokens, "ai_usage_cache_write_tokens_invalid"),
    outputTokens: integer(row.output_tokens, "ai_usage_output_tokens_invalid"),
    costUsdMicros: integer(row.cost_usd_micros, "ai_usage_cost_usd_micros_invalid"),
    retryCount: integer(row.retry_count, "ai_usage_retry_count_invalid"),
    fallbackDepth: integer(row.fallback_depth, "ai_usage_fallback_depth_invalid"),
    providerFailureCount: integer(row.provider_failure_count, "ai_usage_provider_failure_count_invalid"),
    eventKind: enumValue(row.event_kind, ["usage", "adjustment"] as const, "ai_usage_event_kind_invalid"),
    outcome: enumValue(
      row.outcome,
      ["ok", "error", "timeout", "refused", "aborted"] as const,
      "ai_usage_outcome_invalid",
    ),
    reconciliationStatus: enumValue(
      row.reconciliation_status,
      ["pending", "matched", "adjusted"] as const,
      "ai_usage_reconciliation_invalid",
    ),
    rawUsageJson: rawUsageJson(row.raw_usage),
    retryOfEventId: row.retry_of_event_id,
    adjustmentOfEventId: row.adjustment_of_event_id,
  };
}

function comparableUsage(event: AiUsageEvent): string {
  const { recordedSequence: _recordedSequence, rawUsageJson: raw, ...rest } = event;
  return canonicalJson({ ...rest, rawUsageJson: rawUsageJson(raw) });
}

async function rollbackQuietly(client: AiUsagePostgresClient): Promise<void> {
  await client.query("ROLLBACK").catch(() => undefined);
}

async function appendAttempt(
  client: AiUsagePostgresQueryable,
  event: Omit<AiExecutionAttemptEvent, "eventId">,
): Promise<void> {
  await client.query(
    `INSERT INTO ai_execution_attempt_events(
       event_id, execution_key, attempt_id, occurred_at, kind, detail
     ) VALUES ($1, $2, $3, $4::timestamptz, $5, $6)`,
    [randomUUID(), event.executionKey, event.attemptId, event.occurredAt, event.kind, event.detail],
  );
}

export class AiUsagePostgresRepository implements AiUsageRepository {
  constructor(private readonly pool: AiUsagePostgresPool) {}

  async acquire(input: AcquireAiExecutionInput): Promise<AcquireAiExecutionResult> {
    const executionKey = buildAiExecutionKey(input.key);
    const nowEpoch = Date.parse(input.now);
    const leaseEpoch = Date.parse(input.leaseExpiresAt);
    if (!Number.isFinite(nowEpoch) || !Number.isFinite(leaseEpoch)) throw new Error("ai_guard_timestamp_invalid");
    if (leaseEpoch <= nowEpoch) throw new Error("ai_guard_expiry_must_be_future");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 1495))", [executionKey]);
      const selected = await client.query<GuardRow>(GUARD_SELECT, [executionKey]);
      const existing = selected.rows[0] ? guardFromRow(selected.rows[0]) : null;
      if (existing?.state === "succeeded") {
        await client.query("COMMIT");
        return { acquired: false, reason: "already_succeeded", guard: existing };
      }
      if (existing?.state === "failed" && existing.holderAttemptId === input.attemptId) {
        throw new Error("ai_retry_requires_new_attempt_id");
      }
      if (existing?.state === "active") {
        const existingLease = Date.parse(existing.leaseExpiresAt);
        if (existing.holderAttemptId === input.attemptId) {
          if (existingLease > nowEpoch) {
            await client.query("COMMIT");
            return { acquired: true, guard: existing };
          }
          throw new Error("ai_retry_requires_new_attempt_id");
        }
        if (existingLease > nowEpoch) {
          await client.query("COMMIT");
          return { acquired: false, reason: "active_lease", guard: existing };
        }
        await appendAttempt(client, {
          executionKey,
          attemptId: existing.holderAttemptId,
          occurredAt: input.now,
          kind: "lease_expired",
          detail: null,
        });
      }
      if (existing) {
        await client.query(
          `UPDATE ai_execution_guards
              SET holder_attempt_id = $2, acquired_at = $3::timestamptz,
                  lease_expires_at = $4::timestamptz, state = 'active',
                  settled_at = NULL, updated_at = NOW()
            WHERE execution_key = $1`,
          [executionKey, input.attemptId, input.now, input.leaseExpiresAt],
        );
      } else {
        await client.query(
          `INSERT INTO ai_execution_guards(
             execution_key, tenant_id, feature, source_digest, extraction_run_id,
             policy_version, prompt_version, model_id, holder_attempt_id,
             acquired_at, lease_expires_at, state
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz,
                     $11::timestamptz, 'active')`,
          [
            executionKey,
            input.key.tenantId.trim(),
            input.key.feature.trim(),
            input.key.sourceDigest.trim().toLowerCase(),
            input.key.extractionRunId,
            input.key.policyVersion.trim(),
            input.key.promptVersion.trim(),
            input.key.modelId.trim(),
            input.attemptId,
            input.now,
            input.leaseExpiresAt,
          ],
        );
      }
      await appendAttempt(client, {
        executionKey,
        attemptId: input.attemptId,
        occurredAt: input.now,
        kind: "started",
        detail: null,
      });
      const guard: AiExecutionGuard = {
        executionKey,
        holderAttemptId: input.attemptId,
        acquiredAt: new Date(nowEpoch).toISOString(),
        leaseExpiresAt: new Date(leaseEpoch).toISOString(),
        state: "active",
        settledAt: null,
      };
      await client.query("COMMIT");
      return { acquired: true, guard };
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async settle(input: SettleAiExecutionInput): Promise<AiExecutionGuard> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 1495))", [input.executionKey]);
      const selected = await client.query<GuardRow>(GUARD_SELECT, [input.executionKey]);
      const existing = selected.rows[0] ? guardFromRow(selected.rows[0]) : null;
      if (!existing) throw new Error("ai_guard_not_found");
      if (existing.holderAttemptId !== input.attemptId) throw new Error("ai_guard_holder_mismatch");
      if (existing.state === input.outcome) {
        await client.query("COMMIT");
        return existing;
      }
      if (existing.state !== "active") throw new Error("ai_guard_already_settled_with_different_outcome");
      const occurredEpoch = Date.parse(input.occurredAt);
      if (!Number.isFinite(occurredEpoch)) throw new Error("ai_guard_settled_at_invalid");
      if (occurredEpoch < Date.parse(existing.acquiredAt)) throw new Error("ai_guard_settled_before_acquired");
      await client.query(
        `UPDATE ai_execution_guards
            SET state = $2, settled_at = $3::timestamptz, updated_at = NOW()
          WHERE execution_key = $1`,
        [input.executionKey, input.outcome, input.occurredAt],
      );
      await appendAttempt(client, {
        executionKey: input.executionKey,
        attemptId: input.attemptId,
        occurredAt: input.occurredAt,
        kind: input.outcome,
        detail: input.detail ?? null,
      });
      const settled: AiExecutionGuard = {
        ...existing,
        state: input.outcome,
        settledAt: new Date(occurredEpoch).toISOString(),
      };
      await client.query("COMMIT");
      return settled;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async recordUsage(input: RecordAiUsageInput): Promise<AiUsageEvent> {
    validatePersistentUsageInput(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 1495))", [input.eventId]);
      const selected = await client.query<UsageRow>(USAGE_SELECT, [input.eventId]);
      if (selected.rows[0]) {
        const existing = usageFromRow(selected.rows[0]);
        if (comparableUsage(existing) !== comparableUsage({ ...input, recordedSequence: 0 })) {
          throw new Error("ai_usage_event_id_conflict");
        }
        await client.query("COMMIT");
        return existing;
      }
      const inserted = await client.query<UsageRow>(
        `INSERT INTO ai_usage_events(
           event_id, occurred_at, tenant_id, project, feature, request_id,
           execution_key, attempt_id, provider, provider_request_id, model_id,
           pricing_version, prompt_version, input_tokens, cached_input_tokens,
           cache_write_tokens, output_tokens, cost_usd_micros, retry_count,
           fallback_depth, provider_failure_count, event_kind, outcome,
           reconciliation_status, raw_usage, retry_of_event_id, adjustment_of_event_id
         ) VALUES (
           $1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10, $11,
           $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
           $24, $25::jsonb, $26, $27
         )
         RETURNING event_id, recorded_sequence, occurred_at::text, tenant_id, project,
                   feature, request_id, execution_key, attempt_id, provider,
                   provider_request_id, model_id, pricing_version, prompt_version,
                   input_tokens, cached_input_tokens, cache_write_tokens, output_tokens,
                   cost_usd_micros, retry_count, fallback_depth, provider_failure_count,
                   event_kind, outcome, reconciliation_status, raw_usage,
                   retry_of_event_id, adjustment_of_event_id`,
        [
          input.eventId, input.occurredAt, input.tenantId, input.project, input.feature,
          input.requestId, input.executionKey, input.attemptId, input.provider,
          input.providerRequestId, input.modelId, input.pricingVersion, input.promptVersion,
          input.inputTokens, input.cachedInputTokens, input.cacheWriteTokens,
          input.outputTokens, input.costUsdMicros, input.retryCount, input.fallbackDepth,
          input.providerFailureCount, input.eventKind, input.outcome,
          input.reconciliationStatus, rawUsageJson(input.rawUsageJson),
          input.retryOfEventId, input.adjustmentOfEventId,
        ],
      );
      const row = inserted.rows[0];
      if (!row) throw new Error("ai_usage_insert_returned_no_row");
      const event = usageFromRow(row);
      await client.query("COMMIT");
      return event;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async getGuard(executionKey: string): Promise<AiExecutionGuard | null> {
    const result = await this.pool.query<GuardRow>(
      `SELECT execution_key, holder_attempt_id, acquired_at::text,
              lease_expires_at::text, state, settled_at::text
         FROM ai_execution_guards
        WHERE execution_key = $1`,
      [executionKey],
    );
    return result.rows[0] ? guardFromRow(result.rows[0]) : null;
  }

  async budgetSnapshot(input: {
    tenantId: string;
    project: string;
    feature: string;
    now: string;
  }): Promise<AiBudgetSnapshot> {
    const result = await this.pool.query<{
      hourly_usd_micros: string | number;
      feature_monthly_usd_micros: string | number;
      tenant_monthly_usd_micros: string | number;
      retry_count: string | number;
      fallback_depth: string | number;
      provider_failure_count: string | number;
    }>(
      `WITH bounds AS (
         SELECT date_trunc('hour', $4::timestamptz) AS hour_start,
                date_trunc('month', $4::timestamptz) AS month_start
       )
       SELECT
         COALESCE(SUM(cost_usd_micros) FILTER (
           WHERE event_kind = 'usage' AND occurred_at >= bounds.hour_start
             AND tenant_id = $1 AND project = $2 AND feature = $3
         ), 0)::text AS hourly_usd_micros,
         COALESCE(SUM(cost_usd_micros) FILTER (
           WHERE event_kind = 'usage' AND occurred_at >= bounds.month_start
             AND tenant_id = $1 AND project = $2 AND feature = $3
         ), 0)::text AS feature_monthly_usd_micros,
         COALESCE(SUM(cost_usd_micros) FILTER (
           WHERE event_kind = 'usage' AND occurred_at >= bounds.month_start AND tenant_id = $1
         ), 0)::text AS tenant_monthly_usd_micros,
         COALESCE(SUM(retry_count) FILTER (
           WHERE event_kind = 'usage' AND occurred_at >= bounds.hour_start
             AND tenant_id = $1 AND project = $2 AND feature = $3
         ), 0)::text AS retry_count,
         COALESCE(MAX(fallback_depth) FILTER (
           WHERE event_kind = 'usage' AND occurred_at >= bounds.hour_start
             AND tenant_id = $1 AND project = $2 AND feature = $3
         ), 0)::text AS fallback_depth,
         COALESCE(SUM(provider_failure_count) FILTER (
           WHERE event_kind = 'usage' AND occurred_at >= bounds.hour_start
             AND tenant_id = $1 AND project = $2 AND feature = $3
         ), 0)::text AS provider_failure_count
       FROM ai_usage_events, bounds
       WHERE occurred_at < $4::timestamptz`,
      [input.tenantId, input.project, input.feature, input.now],
    );
    const row = result.rows[0];
    return {
      hourlyUsdMicros: integer(row?.hourly_usd_micros ?? 0, "ai_budget_hourly_invalid"),
      featureMonthlyUsdMicros: integer(
        row?.feature_monthly_usd_micros ?? 0,
        "ai_budget_feature_monthly_invalid",
      ),
      tenantMonthlyUsdMicros: integer(
        row?.tenant_monthly_usd_micros ?? 0,
        "ai_budget_tenant_monthly_invalid",
      ),
      retryCount: integer(row?.retry_count ?? 0, "ai_budget_retry_count_invalid"),
      fallbackDepth: integer(row?.fallback_depth ?? 0, "ai_budget_fallback_depth_invalid"),
      providerFailureCount: integer(
        row?.provider_failure_count ?? 0,
        "ai_budget_provider_failure_count_invalid",
      ),
    };
  }
}
