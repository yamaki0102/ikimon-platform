import { randomUUID } from "node:crypto";
import {
  buildAiExecutionKey, canonicalAiJson, normalizeAiUsageMetadata,
  normalizeExecutionKeyInput, nonNegativeInteger, positiveLeaseDuration, required,
  validateRelatedUsageEvent, validTimestamp,
} from "./aiUsagePolicy.js";
import type {
  AcquireAiExecutionInput, AcquireAiExecutionResult, AiExecutionAttemptEvent,
  AiExecutionGuard, AiUsageEvent, AiUsageRepository, CompleteAiExecutionInput,
  CompleteAiExecutionResult, RecordAiUsageInput, RenewAiExecutionInput,
  SettleAiExecutionInput,
} from "./aiUsageTypes.js";

function iso(epoch: number): string { return new Date(epoch).toISOString(); }

/** Test/development repository only. */
export class InMemoryAiUsageRepository implements AiUsageRepository {
  private readonly guards = new Map<string, AiExecutionGuard>();
  private readonly attemptEvents: AiExecutionAttemptEvent[] = [];
  private readonly usageEvents: AiUsageEvent[] = [];
  private readonly usageEventsById = new Map<string, AiUsageEvent>();
  private recordedSequence = 0;

  constructor(private readonly clock: () => Date = () => new Date()) {}

  private now(): number {
    const epoch = this.clock().getTime();
    if (!Number.isFinite(epoch)) throw new Error("invalid_ai_repository_clock");
    return epoch;
  }

  async acquire(input: AcquireAiExecutionInput): Promise<AcquireAiExecutionResult> {
    const attemptId = required(input.attemptId, "attempt_id");
    const duration = positiveLeaseDuration(input.leaseDurationMs);
    const now = this.now();
    const normalizedKey = normalizeExecutionKeyInput(input.key);
    const executionKey = buildAiExecutionKey(normalizedKey);
    const existing = this.guards.get(executionKey);
    if (existing?.state === "succeeded") {
      return { acquired: false, reason: "already_succeeded", guard: structuredClone(existing) };
    }
    if (existing?.state === "failed" && existing.holderAttemptId === attemptId) {
      throw new Error("ai_retry_requires_new_attempt_id");
    }
    let generation = existing ? existing.leaseGeneration + 1 : 1;
    if (existing?.state === "active") {
      const existingExpiry = validTimestamp(existing.leaseExpiresAt, "existing_lease");
      if (existing.holderAttemptId === attemptId) {
        if (existingExpiry > now) return { acquired: true, guard: structuredClone(existing) };
        throw new Error("ai_retry_requires_new_attempt_id");
      }
      if (existingExpiry > now) {
        return { acquired: false, reason: "active_lease", guard: structuredClone(existing) };
      }
      this.attemptEvents.push({
        eventId: randomUUID(), executionKey, attemptId: existing.holderAttemptId,
        leaseGeneration: existing.leaseGeneration, occurredAt: iso(now), kind: "lease_expired", detail: null,
      });
    }
    const guard: AiExecutionGuard = {
      executionKey,
      key: normalizedKey,
      holderAttemptId: attemptId,
      leaseGeneration: generation,
      acquiredAt: iso(now),
      leaseExpiresAt: iso(now + duration),
      state: "active",
      settledAt: null,
    };
    this.guards.set(executionKey, guard);
    this.attemptEvents.push({
      eventId: randomUUID(), executionKey, attemptId, leaseGeneration: generation,
      occurredAt: guard.acquiredAt, kind: "started", detail: null,
    });
    return { acquired: true, guard: structuredClone(guard) };
  }

  async renew(input: RenewAiExecutionInput): Promise<AiExecutionGuard> {
    const now = this.now();
    const duration = positiveLeaseDuration(input.leaseDurationMs);
    const guard = this.guards.get(required(input.executionKey, "execution_key"));
    if (!guard) throw new Error("ai_guard_not_found");
    if (guard.state !== "active") throw new Error("ai_guard_not_active");
    if (guard.holderAttemptId !== required(input.attemptId, "attempt_id")) throw new Error("ai_guard_holder_mismatch");
    if (guard.leaseGeneration !== nonNegativeInteger(input.leaseGeneration, "lease_generation")) {
      throw new Error("ai_guard_fencing_mismatch");
    }
    if (validTimestamp(guard.leaseExpiresAt, "lease_expires_at") <= now) throw new Error("ai_guard_lease_expired");
    const renewed = { ...guard, leaseExpiresAt: iso(now + duration) };
    this.guards.set(guard.executionKey, renewed);
    this.attemptEvents.push({
      eventId: randomUUID(), executionKey: guard.executionKey, attemptId: guard.holderAttemptId,
      leaseGeneration: guard.leaseGeneration, occurredAt: iso(now), kind: "renewed", detail: null,
    });
    return structuredClone(renewed);
  }

  async settle(input: SettleAiExecutionInput): Promise<AiExecutionGuard> {
    const now = this.now();
    const executionKey = required(input.executionKey, "execution_key");
    const attemptId = required(input.attemptId, "attempt_id");
    const generation = nonNegativeInteger(input.leaseGeneration, "lease_generation");
    const guard = this.guards.get(executionKey);
    if (!guard) throw new Error("ai_guard_not_found");
    if (guard.holderAttemptId !== attemptId) throw new Error("ai_guard_holder_mismatch");
    if (guard.leaseGeneration !== generation) throw new Error("ai_guard_fencing_mismatch");
    if (guard.state === input.outcome) return structuredClone(guard);
    if (guard.state !== "active") throw new Error("ai_guard_already_settled_with_different_outcome");
    if (validTimestamp(guard.leaseExpiresAt, "lease_expires_at") <= now) throw new Error("ai_guard_lease_expired");
    const settledAt = iso(now);
    const settled: AiExecutionGuard = { ...guard, state: input.outcome, settledAt };
    this.guards.set(executionKey, settled);
    this.attemptEvents.push({
      eventId: randomUUID(), executionKey, attemptId, leaseGeneration: generation,
      occurredAt: settledAt, kind: input.outcome, detail: input.detail ?? null,
    });
    return structuredClone(settled);
  }

  async recordUsage(input: RecordAiUsageInput): Promise<AiUsageEvent> {
    validTimestamp(input.occurredAt, "usage_occurred_at");
    const eventId = required(input.eventId, "usage_event_id");
    for (const [name, value] of Object.entries({
      inputTokens: input.inputTokens,
      cachedInputTokens: input.cachedInputTokens,
      cacheWriteTokens: input.cacheWriteTokens,
      outputTokens: input.outputTokens,
      retryCount: input.retryCount,
      fallbackDepth: input.fallbackDepth,
      providerFailureCount: input.providerFailureCount,
    })) nonNegativeInteger(value, name);
    if (!Number.isSafeInteger(input.costUsdMicros)) throw new Error("invalid_ai_integer:cost_usd_micros");
    if (input.eventKind === "usage" && input.costUsdMicros < 0) throw new Error("ai_usage_cost_must_not_be_negative");
    required(input.tenantId, "usage_tenant_id");
    required(input.project, "usage_project");
    if (input.workspaceId !== null) required(input.workspaceId, "usage_workspace_id");
    required(input.feature, "usage_feature");
    required(input.operationVersion, "usage_operation_version");
    required(input.requestId, "usage_request_id");
    required(input.provider, "usage_provider");
    required(input.modelId, "usage_model_id");
    required(input.pricingVersion, "usage_pricing_version");
    required(input.promptVersion, "usage_prompt_version");
    const rawUsageJson = normalizeAiUsageMetadata(input.rawUsageJson);

    const relationShape = [input.executionKey, input.attemptId, input.leaseGeneration];
    const allNull = relationShape.every((item) => item === null);
    const allPresent = relationShape.every((item) => item !== null);
    if (!allNull && !allPresent) throw new Error("ai_usage_execution_relation_shape_invalid");
    if (input.executionKey !== null) {
      const guard = this.guards.get(input.executionKey);
      if (!guard) throw new Error("ai_usage_guard_not_found");
      if (guard.holderAttemptId !== input.attemptId || guard.leaseGeneration !== input.leaseGeneration) {
        throw new Error("ai_usage_guard_fencing_mismatch");
      }
      const key = guard.key;
      if (key.tenantId !== input.tenantId || key.project !== input.project
        || key.workspaceId !== input.workspaceId || key.feature !== input.feature
        || key.operationVersion !== input.operationVersion || key.provider !== input.provider
        || key.modelId !== input.modelId) {
        throw new Error("ai_usage_guard_scope_mismatch");
      }
      const started = this.attemptEvents.some((event) => event.executionKey === input.executionKey
        && event.attemptId === input.attemptId && event.leaseGeneration === input.leaseGeneration
        && event.kind === "started");
      if (!started) throw new Error("ai_usage_attempt_not_started");
    }

    if (input.eventKind === "adjustment") {
      if (input.retryOfEventId) throw new Error("ai_adjustment_must_not_set_retry_target");
      if (!input.adjustmentOfEventId) throw new Error("ai_adjustment_requires_target_event");
      const target = this.usageEventsById.get(input.adjustmentOfEventId);
      if (!target || target.eventKind !== "usage") throw new Error("ai_adjustment_target_not_found");
      validateRelatedUsageEvent(input, target, "adjustment");
      if (input.reconciliationStatus !== "adjusted") throw new Error("ai_adjustment_status_mismatch");
    } else {
      if (input.adjustmentOfEventId) throw new Error("ai_usage_must_not_set_adjustment_target");
      if (input.retryOfEventId) {
        const target = this.usageEventsById.get(input.retryOfEventId);
        if (!target || target.eventKind !== "usage") throw new Error("ai_retry_target_not_found");
        validateRelatedUsageEvent(input, target, "retry");
      }
      if (input.reconciliationStatus === "adjusted") throw new Error("ai_usage_status_mismatch");
    }

    const normalizedInput = { ...input, rawUsageJson };
    const existing = this.usageEventsById.get(eventId);
    if (existing) {
      const { recordedSequence: _recordedSequence, ...existingInput } = existing;
      if (canonicalAiJson(existingInput) !== canonicalAiJson(normalizedInput)) {
        throw new Error("ai_usage_event_id_conflict");
      }
      return structuredClone(existing);
    }
    this.recordedSequence += 1;
    const event: AiUsageEvent = { ...normalizedInput, eventId, recordedSequence: this.recordedSequence };
    this.usageEvents.push(event);
    this.usageEventsById.set(eventId, event);
    return structuredClone(event);
  }

  async completeAttempt(input: CompleteAiExecutionInput): Promise<CompleteAiExecutionResult> {
    if (input.usage.executionKey !== input.settle.executionKey
      || input.usage.attemptId !== input.settle.attemptId
      || input.usage.leaseGeneration !== input.settle.leaseGeneration) {
      throw new Error("ai_complete_attempt_relation_mismatch");
    }
    const existedBefore = this.usageEventsById.has(input.usage.eventId);
    const usage = await this.recordUsage(input.usage);
    try {
      const guard = await this.settle(input.settle);
      return { guard, usage };
    } catch (error) {
      if (!existedBefore) {
        const index = this.usageEvents.findIndex((event) => event.eventId === usage.eventId);
        if (index >= 0) this.usageEvents.splice(index, 1);
        this.usageEventsById.delete(usage.eventId);
        this.recordedSequence -= 1;
      }
      throw error;
    }
  }

  async getGuard(executionKey: string): Promise<AiExecutionGuard | null> {
    const guard = this.guards.get(required(executionKey, "execution_key"));
    return guard ? structuredClone(guard) : null;
  }

  async listAttemptEvents(): Promise<AiExecutionAttemptEvent[]> { return structuredClone(this.attemptEvents); }
  async listUsageEvents(): Promise<AiUsageEvent[]> { return structuredClone(this.usageEvents); }
}

/** @deprecated Use InMemoryAiUsageRepository. */
export class InMemoryAiUsageControl extends InMemoryAiUsageRepository {}
