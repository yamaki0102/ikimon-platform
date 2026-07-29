import { createHash, randomUUID } from "node:crypto";

export type AiExecutionKeyInput = {
  tenantId: string;
  feature: string;
  sourceDigest: string;
  extractionRunId: string | null;
  policyVersion: string;
  promptVersion: string;
  modelId: string;
};

export type AiExecutionGuard = {
  executionKey: string;
  holderAttemptId: string;
  acquiredAt: string;
  leaseExpiresAt: string;
  state: "active" | "succeeded" | "failed";
  settledAt: string | null;
};

export type AiExecutionAttemptEvent = {
  eventId: string;
  executionKey: string;
  attemptId: string;
  occurredAt: string;
  kind: "started" | "succeeded" | "failed" | "lease_expired";
  detail: string | null;
};

export type AiUsageEvent = {
  eventId: string;
  occurredAt: string;
  recordedSequence: number;
  tenantId: string;
  project: string;
  feature: string;
  requestId: string;
  executionKey: string | null;
  attemptId: string | null;
  provider: string;
  providerRequestId: string | null;
  modelId: string;
  pricingVersion: string;
  promptVersion: string;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  costUsdMicros: number;
  retryCount: number;
  fallbackDepth: number;
  providerFailureCount: number;
  eventKind: "usage" | "adjustment";
  outcome: "ok" | "error" | "timeout" | "refused" | "aborted";
  reconciliationStatus: "pending" | "matched" | "adjusted";
  rawUsageJson: string;
  retryOfEventId: string | null;
};

export type AiBudgetLimits = {
  requestUsdMicros: number;
  hourlyUsdMicros: number;
  featureMonthlyUsdMicros: number;
  tenantMonthlyUsdMicros: number;
  retryCount: number;
  fallbackDepth: number;
  providerFailureCount: number;
};

export type AiBudgetSnapshot = {
  hourlyUsdMicros: number;
  featureMonthlyUsdMicros: number;
  tenantMonthlyUsdMicros: number;
  retryCount: number;
  fallbackDepth: number;
  providerFailureCount: number;
};

export type AiBudgetReason =
  | "request_limit"
  | "hourly_limit"
  | "feature_monthly_limit"
  | "tenant_monthly_limit"
  | "retry_limit"
  | "fallback_depth_limit"
  | "provider_failure_limit";

export type AiBudgetDecision = {
  allowed: boolean;
  reasons: AiBudgetReason[];
};

export type AcquireAiExecutionInput = {
  key: AiExecutionKeyInput;
  attemptId: string;
  now: string;
  leaseExpiresAt: string;
};

export type AcquireAiExecutionResult =
  | { acquired: true; guard: AiExecutionGuard }
  | {
      acquired: false;
      reason: "active_lease" | "already_succeeded";
      guard: AiExecutionGuard;
    };

export type SettleAiExecutionInput = {
  executionKey: string;
  attemptId: string;
  occurredAt: string;
  outcome: "succeeded" | "failed";
  detail?: string | null;
};

export type RecordAiUsageInput = Omit<AiUsageEvent, "eventId" | "recordedSequence">;

/**
 * Persistence boundary. Production implementations must make acquire() atomic
 * across workers and persist attempt/usage events durably.
 */
export interface AiUsageRepository {
  acquire(input: AcquireAiExecutionInput): Promise<AcquireAiExecutionResult>;
  settle(input: SettleAiExecutionInput): Promise<AiExecutionGuard>;
  recordUsage(input: RecordAiUsageInput): Promise<AiUsageEvent>;
  getGuard(executionKey: string): Promise<AiExecutionGuard | null>;
  listAttemptEvents(): Promise<AiExecutionAttemptEvent[]>;
  listUsageEvents(): Promise<AiUsageEvent[]>;
}

function sortedAiValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedAiValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortedAiValue(item)]),
  );
}

function canonicalAiJson(value: unknown): string {
  return JSON.stringify(sortedAiValue(value));
}

function required(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`required_ai_field:${name}`);
  return normalized;
}

export function buildAiExecutionKey(input: AiExecutionKeyInput): string {
  const sourceDigest = required(input.sourceDigest, "source_digest").toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(sourceDigest)) throw new Error("invalid_ai_source_digest");
  const digestInput = {
    tenantId: required(input.tenantId, "tenant_id"),
    feature: required(input.feature, "feature"),
    sourceDigest,
    extractionRunId: input.extractionRunId ? required(input.extractionRunId, "extraction_run_id") : null,
    policyVersion: required(input.policyVersion, "policy_version"),
    promptVersion: required(input.promptVersion, "prompt_version"),
    modelId: required(input.modelId, "model_id"),
  };
  return createHash("sha256").update(canonicalAiJson(digestInput), "utf8").digest("hex");
}

function validTimestamp(value: string, name: string): number {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) throw new Error(`invalid_ai_timestamp:${name}`);
  return epoch;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid_ai_integer:${name}`);
  return value;
}

export function evaluateAiBudget(input: {
  projectedRequestUsdMicros: number;
  snapshot: AiBudgetSnapshot;
  limits: AiBudgetLimits;
}): AiBudgetDecision {
  const projected = nonNegativeInteger(input.projectedRequestUsdMicros, "projected_request_usd_micros");
  const snapshot = {
    hourly: nonNegativeInteger(input.snapshot.hourlyUsdMicros, "snapshot_hourly_usd_micros"),
    featureMonthly: nonNegativeInteger(input.snapshot.featureMonthlyUsdMicros, "snapshot_feature_monthly_usd_micros"),
    tenantMonthly: nonNegativeInteger(input.snapshot.tenantMonthlyUsdMicros, "snapshot_tenant_monthly_usd_micros"),
    retryCount: nonNegativeInteger(input.snapshot.retryCount, "snapshot_retry_count"),
    fallbackDepth: nonNegativeInteger(input.snapshot.fallbackDepth, "snapshot_fallback_depth"),
    providerFailureCount: nonNegativeInteger(input.snapshot.providerFailureCount, "snapshot_provider_failure_count"),
  };
  const limits = {
    request: nonNegativeInteger(input.limits.requestUsdMicros, "limit_request_usd_micros"),
    hourly: nonNegativeInteger(input.limits.hourlyUsdMicros, "limit_hourly_usd_micros"),
    featureMonthly: nonNegativeInteger(input.limits.featureMonthlyUsdMicros, "limit_feature_monthly_usd_micros"),
    tenantMonthly: nonNegativeInteger(input.limits.tenantMonthlyUsdMicros, "limit_tenant_monthly_usd_micros"),
    retryCount: nonNegativeInteger(input.limits.retryCount, "limit_retry_count"),
    fallbackDepth: nonNegativeInteger(input.limits.fallbackDepth, "limit_fallback_depth"),
    providerFailureCount: nonNegativeInteger(input.limits.providerFailureCount, "limit_provider_failure_count"),
  };
  const reasons: AiBudgetReason[] = [];
  if (projected > limits.request) reasons.push("request_limit");
  if (snapshot.hourly + projected > limits.hourly) reasons.push("hourly_limit");
  if (snapshot.featureMonthly + projected > limits.featureMonthly) reasons.push("feature_monthly_limit");
  if (snapshot.tenantMonthly + projected > limits.tenantMonthly) reasons.push("tenant_monthly_limit");
  if (snapshot.retryCount > limits.retryCount) reasons.push("retry_limit");
  if (snapshot.fallbackDepth > limits.fallbackDepth) reasons.push("fallback_depth_limit");
  if (snapshot.providerFailureCount > limits.providerFailureCount) reasons.push("provider_failure_limit");
  return { allowed: reasons.length === 0, reasons };
}

/**
 * Test/development repository only. It deliberately does not provide
 * cross-process safety; production wiring must use a durable implementation.
 */
export class InMemoryAiUsageRepository implements AiUsageRepository {
  private readonly guards = new Map<string, AiExecutionGuard>();
  private readonly attemptEvents: AiExecutionAttemptEvent[] = [];
  private readonly usageEvents: AiUsageEvent[] = [];
  private recordedSequence = 0;

  async acquire(input: AcquireAiExecutionInput): Promise<AcquireAiExecutionResult> {
    const attemptId = required(input.attemptId, "attempt_id");
    const nowEpoch = validTimestamp(input.now, "now");
    const expiryEpoch = validTimestamp(input.leaseExpiresAt, "lease_expires_at");
    if (expiryEpoch <= nowEpoch) throw new Error("ai_guard_expiry_must_be_future");
    const executionKey = buildAiExecutionKey(input.key);
    const existing = this.guards.get(executionKey);
    if (existing?.state === "succeeded") {
      return { acquired: false, reason: "already_succeeded", guard: { ...existing } };
    }
    if (existing?.state === "active" && validTimestamp(existing.leaseExpiresAt, "existing_lease") > nowEpoch) {
      return { acquired: false, reason: "active_lease", guard: { ...existing } };
    }
    if (existing?.state === "active") {
      this.attemptEvents.push({
        eventId: randomUUID(),
        executionKey,
        attemptId: existing.holderAttemptId,
        occurredAt: input.now,
        kind: "lease_expired",
        detail: null,
      });
    }
    const guard: AiExecutionGuard = {
      executionKey,
      holderAttemptId: attemptId,
      acquiredAt: input.now,
      leaseExpiresAt: input.leaseExpiresAt,
      state: "active",
      settledAt: null,
    };
    this.guards.set(executionKey, guard);
    this.attemptEvents.push({
      eventId: randomUUID(),
      executionKey,
      attemptId,
      occurredAt: input.now,
      kind: "started",
      detail: null,
    });
    return { acquired: true, guard: { ...guard } };
  }

  async settle(input: SettleAiExecutionInput): Promise<AiExecutionGuard> {
    validTimestamp(input.occurredAt, "settled_at");
    const executionKey = required(input.executionKey, "execution_key");
    const attemptId = required(input.attemptId, "attempt_id");
    const guard = this.guards.get(executionKey);
    if (!guard) throw new Error("ai_guard_not_found");
    if (guard.holderAttemptId !== attemptId) throw new Error("ai_guard_holder_mismatch");
    if (guard.state !== "active") throw new Error("ai_guard_not_active");
    const settled: AiExecutionGuard = {
      ...guard,
      state: input.outcome,
      settledAt: input.occurredAt,
    };
    this.guards.set(executionKey, settled);
    this.attemptEvents.push({
      eventId: randomUUID(),
      executionKey,
      attemptId,
      occurredAt: input.occurredAt,
      kind: input.outcome,
      detail: input.detail ?? null,
    });
    return { ...settled };
  }

  async recordUsage(input: RecordAiUsageInput): Promise<AiUsageEvent> {
    validTimestamp(input.occurredAt, "usage_occurred_at");
    nonNegativeInteger(input.inputTokens, "input_tokens");
    nonNegativeInteger(input.cachedInputTokens, "cached_input_tokens");
    nonNegativeInteger(input.cacheWriteTokens, "cache_write_tokens");
    nonNegativeInteger(input.outputTokens, "output_tokens");
    nonNegativeInteger(input.retryCount, "retry_count");
    nonNegativeInteger(input.fallbackDepth, "fallback_depth");
    nonNegativeInteger(input.providerFailureCount, "provider_failure_count");
    if (!Number.isSafeInteger(input.costUsdMicros)) throw new Error("invalid_ai_integer:cost_usd_micros");
    if (input.eventKind === "usage" && input.costUsdMicros < 0) throw new Error("ai_usage_cost_must_not_be_negative");
    required(input.tenantId, "usage_tenant_id");
    required(input.project, "usage_project");
    required(input.feature, "usage_feature");
    required(input.requestId, "usage_request_id");
    required(input.provider, "usage_provider");
    required(input.modelId, "usage_model_id");
    required(input.pricingVersion, "usage_pricing_version");
    required(input.promptVersion, "usage_prompt_version");
    this.recordedSequence += 1;
    const event: AiUsageEvent = {
      ...input,
      eventId: randomUUID(),
      recordedSequence: this.recordedSequence,
    };
    this.usageEvents.push(event);
    return { ...event };
  }

  async getGuard(executionKey: string): Promise<AiExecutionGuard | null> {
    const guard = this.guards.get(required(executionKey, "execution_key"));
    return guard ? { ...guard } : null;
  }

  async listAttemptEvents(): Promise<AiExecutionAttemptEvent[]> {
    return this.attemptEvents.map((event) => ({ ...event }));
  }

  async listUsageEvents(): Promise<AiUsageEvent[]> {
    return this.usageEvents.map((event) => ({ ...event }));
  }
}

/** @deprecated Use InMemoryAiUsageRepository; retained for source compatibility. */
export class InMemoryAiUsageControl extends InMemoryAiUsageRepository {}
