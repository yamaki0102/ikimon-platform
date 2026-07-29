import { buildAiExecutionKey, normalizeExecutionKeyInput, positiveLeaseDuration, required } from "./aiUsagePolicy.js";
import type {
  AcquireAiExecutionInput, AcquireAiExecutionResult, AiBudgetSnapshot, AiBudgetSnapshotInput,
  AiExecutionGuard, AiUsageEvent, AiUsageRepository, CompleteAiExecutionInput,
  CompleteAiExecutionResult, RecordAiUsageInput, RenewAiExecutionInput, SettleAiExecutionInput,
} from "./aiUsageTypes.js";
import {
  appendAttempt, dbNow, rollback, selectGuard,
  type AiUsagePostgresPool,
} from "./aiUsagePostgresCodecV2.js";
import { AiUsagePostgresRepositoryV2 } from "./aiUsagePostgresRepositoryV2.js";

/**
 * Contract-v2 acquisition path with logical invocation identity.
 * The remaining methods delegate to the transaction-safe v2 implementation.
 */
export class AiUsagePostgresRepositoryV3 implements AiUsageRepository {
  private readonly delegate: AiUsagePostgresRepositoryV2;

  constructor(private readonly pool: AiUsagePostgresPool) {
    this.delegate = new AiUsagePostgresRepositoryV2(pool);
  }

  async acquire(input: AcquireAiExecutionInput): Promise<AcquireAiExecutionResult> {
    const duration = positiveLeaseDuration(input.leaseDurationMs);
    const key = normalizeExecutionKeyInput(input.key);
    const executionKey = buildAiExecutionKey(key);
    const attemptId = required(input.attemptId, "attempt_id");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1495))", [executionKey]);
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
          executionKey,
          attemptId: existing.holderAttemptId,
          generation: existing.leaseGeneration,
          occurredAt: now,
          kind: "lease_expired",
        });
      }
      const params = [
        executionKey, key.tenantId, key.project, key.workspaceId, key.feature, key.provider,
        key.modelId, key.operationVersion, key.invocationId, key.canonicalInputDigest,
        key.sourceDigest, key.extractionRunId, key.policyVersion, key.promptVersion,
        key.targetTime, attemptId, generation, duration,
      ];
      if (existing) {
        await client.query(`UPDATE ai_execution_guards SET
          tenant_id=$2, project=$3, workspace_id=$4, feature=$5, provider=$6,
          model_id=$7, operation_version=$8, invocation_id=$9,
          canonical_input_digest=$10, source_digest=$11, extraction_run_id=$12,
          policy_version=$13, prompt_version=$14, target_time=$15::timestamptz,
          holder_attempt_id=$16, lease_generation=$17,
          acquired_at=clock_timestamp(),
          lease_expires_at=clock_timestamp()+($18::bigint*interval '1 millisecond'),
          state='active', settled_at=NULL, updated_at=clock_timestamp()
          WHERE execution_key=$1`, params);
      } else {
        await client.query(`INSERT INTO ai_execution_guards(
          execution_key, tenant_id, project, workspace_id, feature, provider, model_id,
          operation_version, invocation_id, canonical_input_digest, source_digest,
          extraction_run_id, policy_version, prompt_version, target_time,
          holder_attempt_id, lease_generation, acquired_at, lease_expires_at, state
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::timestamptz,
          $16,$17,clock_timestamp(),
          clock_timestamp()+($18::bigint*interval '1 millisecond'),'active')`, params);
      }
      await appendAttempt(client, {
        executionKey, attemptId, generation, occurredAt: now, kind: "started",
      });
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

  renew(input: RenewAiExecutionInput): Promise<AiExecutionGuard> { return this.delegate.renew(input) }
  settle(input: SettleAiExecutionInput): Promise<AiExecutionGuard> { return this.delegate.settle(input) }
  recordUsage(input: RecordAiUsageInput): Promise<AiUsageEvent> { return this.delegate.recordUsage(input) }
  completeAttempt(input: CompleteAiExecutionInput): Promise<CompleteAiExecutionResult> {
    return this.delegate.completeAttempt(input);
  }
  getGuard(executionKey: string): Promise<AiExecutionGuard | null> { return this.delegate.getGuard(executionKey) }
  budgetSnapshot(input: AiBudgetSnapshotInput): Promise<AiBudgetSnapshot> { return this.delegate.budgetSnapshot(input) }
}
