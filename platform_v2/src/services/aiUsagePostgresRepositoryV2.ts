import {
  buildAiExecutionKey, normalizeExecutionKeyInput, positiveLeaseDuration, required, validTimestamp,
} from "./aiUsagePolicy.js";
import type {
  AcquireAiExecutionInput, AcquireAiExecutionResult, AiBudgetSnapshot, AiBudgetSnapshotInput,
  AiExecutionGuard, AiUsageEvent, AiUsageRepository, CompleteAiExecutionInput,
  CompleteAiExecutionResult, RecordAiUsageInput, RenewAiExecutionInput, SettleAiExecutionInput,
} from "./aiUsageTypes.js";
import {
  GUARD_COLUMNS, USAGE_COLUMNS, appendAttempt, comparable, dbNow, guardFromRow, integer,
  rollback, selectGuard, usageFromRow, validateUsageInput,
  type AiUsagePostgresClient, type AiUsagePostgresPool, type GuardRow, type UsageRow,
} from "./aiUsagePostgresCodecV2.js";

export class AiUsagePostgresRepositoryV2 implements AiUsageRepository {
  constructor(private readonly pool: AiUsagePostgresPool) {}

  async acquire(input: AcquireAiExecutionInput): Promise<AcquireAiExecutionResult> {
    const duration = positiveLeaseDuration(input.leaseDurationMs);
    const key = normalizeExecutionKeyInput(input.key);
    const executionKey = buildAiExecutionKey(key);
    const attemptId = required(input.attemptId, "attempt_id");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 1495))", [executionKey]);
      const now = await dbNow(client);
      const existing = await selectGuard(client, executionKey);
      if (existing?.state === "succeeded") {
        await client.query("COMMIT");
        return { acquired: false, reason: "already_succeeded", guard: existing };
      }
      if (existing?.state === "active" && existing.holderAttemptId === attemptId) {
        if (Date.parse(existing.leaseExpiresAt) > Date.parse(now)) {
          await client.query("COMMIT");
          return { acquired: true, guard: existing };
        }
        throw new Error("ai_retry_requires_new_attempt_id");
      }
      if (existing?.state === "active" && Date.parse(existing.leaseExpiresAt) > Date.parse(now)) {
        await client.query("COMMIT");
        return { acquired: false, reason: "active_lease", guard: existing };
      }
      if (existing?.state === "failed" && existing.holderAttemptId === attemptId) {
        throw new Error("ai_retry_requires_new_attempt_id");
      }
      const generation = (existing?.leaseGeneration ?? 0) + 1;
      if (existing?.state === "active") {
        await appendAttempt(client, {
          executionKey, attemptId: existing.holderAttemptId,
          generation: existing.leaseGeneration, occurredAt: now, kind: "lease_expired",
        });
      }
      const params = [
        executionKey, key.tenantId, key.project, key.workspaceId, key.feature, key.provider,
        key.modelId, key.operationVersion, key.canonicalInputDigest, key.sourceDigest,
        key.extractionRunId, key.policyVersion, key.promptVersion, key.targetTime,
        attemptId, generation, duration,
      ];
      if (existing) {
        await client.query(`UPDATE ai_execution_guards SET
          tenant_id=$2, project=$3, workspace_id=$4, feature=$5, provider=$6, model_id=$7,
          operation_version=$8, canonical_input_digest=$9, source_digest=$10,
          extraction_run_id=$11, policy_version=$12, prompt_version=$13, target_time=$14::timestamptz,
          holder_attempt_id=$15, lease_generation=$16, acquired_at=clock_timestamp(),
          lease_expires_at=clock_timestamp()+($17::bigint*interval '1 millisecond'),
          state='active', settled_at=NULL, updated_at=clock_timestamp()
          WHERE execution_key=$1`, params);
      } else {
        await client.query(`INSERT INTO ai_execution_guards(
          execution_key, tenant_id, project, workspace_id, feature, provider, model_id,
          operation_version, canonical_input_digest, source_digest, extraction_run_id,
          policy_version, prompt_version, target_time, holder_attempt_id, lease_generation,
          acquired_at, lease_expires_at, state
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::timestamptz,$15,$16,
          clock_timestamp(),clock_timestamp()+($17::bigint*interval '1 millisecond'),'active')`, params);
      }
      await appendAttempt(client, { executionKey, attemptId, generation, occurredAt: now, kind: "started" });
      const current = await selectGuard(client, executionKey);
      if (!current) throw new Error("ai_guard_write_missing");
      await client.query("COMMIT");
      return { acquired: true, guard: current };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async renew(input: RenewAiExecutionInput): Promise<AiExecutionGuard> {
    const duration = positiveLeaseDuration(input.leaseDurationMs);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1495))", [input.executionKey]);
      const now = await dbNow(client);
      const guard = await selectGuard(client, input.executionKey);
      if (!guard) throw new Error("ai_guard_not_found");
      if (guard.state !== "active") throw new Error("ai_guard_not_active");
      if (guard.holderAttemptId !== input.attemptId) throw new Error("ai_guard_holder_mismatch");
      if (guard.leaseGeneration !== input.leaseGeneration) throw new Error("ai_guard_fencing_mismatch");
      if (Date.parse(guard.leaseExpiresAt) <= Date.parse(now)) throw new Error("ai_guard_lease_expired");
      await client.query(`UPDATE ai_execution_guards SET
        lease_expires_at=clock_timestamp()+($4::bigint*interval '1 millisecond'), updated_at=clock_timestamp()
        WHERE execution_key=$1 AND holder_attempt_id=$2 AND lease_generation=$3`, [
        input.executionKey, input.attemptId, input.leaseGeneration, duration,
      ]);
      await appendAttempt(client, {
        executionKey: input.executionKey, attemptId: input.attemptId,
        generation: input.leaseGeneration, occurredAt: now, kind: "renewed",
      });
      const renewed = await selectGuard(client, input.executionKey);
      if (!renewed) throw new Error("ai_guard_write_missing");
      await client.query("COMMIT");
      return renewed;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  private async settleTx(client: AiUsagePostgresClient, input: SettleAiExecutionInput): Promise<AiExecutionGuard> {
    const now = await dbNow(client);
    const guard = await selectGuard(client, input.executionKey);
    if (!guard) throw new Error("ai_guard_not_found");
    if (guard.holderAttemptId !== input.attemptId) throw new Error("ai_guard_holder_mismatch");
    if (guard.leaseGeneration !== input.leaseGeneration) throw new Error("ai_guard_fencing_mismatch");
    if (guard.state === input.outcome) return guard;
    if (guard.state !== "active") throw new Error("ai_guard_already_settled_with_different_outcome");
    if (Date.parse(guard.leaseExpiresAt) <= Date.parse(now)) throw new Error("ai_guard_lease_expired");
    await client.query(`UPDATE ai_execution_guards SET
      state=$4, settled_at=clock_timestamp(), updated_at=clock_timestamp()
      WHERE execution_key=$1 AND holder_attempt_id=$2 AND lease_generation=$3`, [
      input.executionKey, input.attemptId, input.leaseGeneration, input.outcome,
    ]);
    await appendAttempt(client, {
      executionKey: input.executionKey, attemptId: input.attemptId,
      generation: input.leaseGeneration, occurredAt: now,
      kind: input.outcome, detail: input.detail,
    });
    const settled = await selectGuard(client, input.executionKey);
    if (!settled) throw new Error("ai_guard_write_missing");
    return settled;
  }

  async settle(input: SettleAiExecutionInput): Promise<AiExecutionGuard> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1495))", [input.executionKey]);
      const result = await this.settleTx(client, input);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  private async recordUsageTx(
    client: AiUsagePostgresClient,
    input: RecordAiUsageInput,
    rawUsageJson: string,
  ): Promise<AiUsageEvent> {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1495))", [input.eventId]);
    const prior = await client.query<UsageRow>(`SELECT ${USAGE_COLUMNS} FROM ai_usage_events WHERE event_id=$1`, [input.eventId]);
    if (prior.rows[0]) {
      const existing = usageFromRow(prior.rows[0]);
      if (comparable(existing) !== comparable({ ...input, rawUsageJson, recordedSequence: 0 })) {
        throw new Error("ai_usage_event_id_conflict");
      }
      return existing;
    }
    const result = await client.query<UsageRow>(`INSERT INTO ai_usage_events(
      event_id, occurred_at, tenant_id, project, workspace_id, feature, operation_version,
      request_id, execution_key, attempt_id, lease_generation, provider, provider_request_id,
      provider_account_id, model_id, pricing_version, prompt_version, input_tokens,
      cached_input_tokens, cache_write_tokens, output_tokens, cost_usd_micros, retry_count,
      fallback_depth, provider_failure_count, event_kind, outcome, reconciliation_status,
      raw_usage, retry_of_event_id, adjustment_of_event_id
    ) VALUES ($1,$2::timestamptz,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
      $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29::jsonb,$30,$31)
      RETURNING ${USAGE_COLUMNS}`, [
      input.eventId, input.occurredAt, input.tenantId, input.project, input.workspaceId,
      input.feature, input.operationVersion, input.requestId, input.executionKey,
      input.attemptId, input.leaseGeneration, input.provider, input.providerRequestId,
      input.providerAccountId, input.modelId, input.pricingVersion, input.promptVersion,
      input.inputTokens, input.cachedInputTokens, input.cacheWriteTokens, input.outputTokens,
      input.costUsdMicros, input.retryCount, input.fallbackDepth, input.providerFailureCount,
      input.eventKind, input.outcome, input.reconciliationStatus, rawUsageJson,
      input.retryOfEventId, input.adjustmentOfEventId,
    ]);
    if (!result.rows[0]) throw new Error("ai_usage_insert_returned_no_row");
    return usageFromRow(result.rows[0]);
  }

  async recordUsage(input: RecordAiUsageInput): Promise<AiUsageEvent> {
    const rawUsageJson = validateUsageInput(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await this.recordUsageTx(client, input, rawUsageJson);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async completeAttempt(input: CompleteAiExecutionInput): Promise<CompleteAiExecutionResult> {
    if (input.usage.executionKey !== input.settle.executionKey
      || input.usage.attemptId !== input.settle.attemptId
      || input.usage.leaseGeneration !== input.settle.leaseGeneration) {
      throw new Error("ai_complete_attempt_relation_mismatch");
    }
    const rawUsageJson = validateUsageInput(input.usage);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1495))", [input.settle.executionKey]);
      const usage = await this.recordUsageTx(client, input.usage, rawUsageJson);
      const guard = await this.settleTx(client, input.settle);
      await client.query("COMMIT");
      return { guard, usage };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async getGuard(executionKey: string): Promise<AiExecutionGuard | null> {
    const result = await this.pool.query<GuardRow>(`SELECT ${GUARD_COLUMNS} FROM ai_execution_guards WHERE execution_key=$1`, [executionKey]);
    return result.rows[0] ? guardFromRow(result.rows[0]) : null;
  }

  async budgetSnapshot(input: AiBudgetSnapshotInput): Promise<AiBudgetSnapshot> {
    validTimestamp(input.now, "ai_budget_now");
    const result = await this.pool.query<Record<string, string | number>>(`WITH bounds AS (
      SELECT date_trunc('hour',$5::timestamptz,'UTC') AS hour_start,
             date_trunc('month',$5::timestamptz,'UTC') AS month_start
    ) SELECT
      COALESCE(SUM(cost_usd_micros) FILTER (
        WHERE occurred_at>=bounds.hour_start AND project=$2
          AND workspace_id IS NOT DISTINCT FROM $3 AND feature=$4
      ),0)::text AS hourly_usd_micros,
      COALESCE(SUM(cost_usd_micros) FILTER (
        WHERE project=$2 AND workspace_id IS NOT DISTINCT FROM $3 AND feature=$4
      ),0)::text AS feature_monthly_usd_micros,
      COALESCE(SUM(cost_usd_micros),0)::text AS tenant_monthly_usd_micros,
      COALESCE(SUM(retry_count) FILTER (
        WHERE occurred_at>=bounds.hour_start AND project=$2
          AND workspace_id IS NOT DISTINCT FROM $3 AND feature=$4
      ),0)::text AS retry_count,
      COALESCE(MAX(fallback_depth) FILTER (
        WHERE occurred_at>=bounds.hour_start AND project=$2
          AND workspace_id IS NOT DISTINCT FROM $3 AND feature=$4
      ),0)::text AS fallback_depth,
      COALESCE(SUM(provider_failure_count) FILTER (
        WHERE occurred_at>=bounds.hour_start AND project=$2
          AND workspace_id IS NOT DISTINCT FROM $3 AND feature=$4
      ),0)::text AS provider_failure_count
    FROM ai_usage_events,bounds
    WHERE tenant_id=$1 AND event_kind='usage'
      AND occurred_at>=bounds.month_start AND occurred_at<$5::timestamptz`, [
      input.tenantId, input.project, input.workspaceId, input.feature, input.now,
    ]);
    const row = result.rows[0] ?? {};
    return {
      hourlyUsdMicros: integer(row.hourly_usd_micros ?? 0, "ai_budget_hourly_invalid"),
      featureMonthlyUsdMicros: integer(row.feature_monthly_usd_micros ?? 0, "ai_budget_feature_monthly_invalid"),
      tenantMonthlyUsdMicros: integer(row.tenant_monthly_usd_micros ?? 0, "ai_budget_tenant_monthly_invalid"),
      retryCount: integer(row.retry_count ?? 0, "ai_budget_retry_invalid"),
      fallbackDepth: integer(row.fallback_depth ?? 0, "ai_budget_fallback_invalid"),
      providerFailureCount: integer(row.provider_failure_count ?? 0, "ai_budget_failure_invalid"),
    };
  }
}
