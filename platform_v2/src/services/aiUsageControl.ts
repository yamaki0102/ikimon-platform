import { createHash, randomUUID } from "node:crypto";
import { canonicalFoundationJson } from "./zukanFoundationV2RepositoryContract.js";

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
};

export type AiBudgetSnapshot = {
  hourlyUsdMicros: number;
  featureMonthlyUsdMicros: number;
  tenantMonthlyUsdMicros: number;
};

export type AiBudgetDecision = {
  allowed: boolean;
  reasons: Array<"request_limit" | "hourly_limit" | "feature_monthly_limit" | "tenant_monthly_limit">;
};

export function buildAiExecutionKey(input: AiExecutionKeyInput): string {
  const digestInput = {
    tenantId: input.tenantId.trim(),
    feature: input.feature.trim(),
    sourceDigest: input.sourceDigest.trim().toLowerCase(),
    extractionRunId: input.extractionRunId,
    policyVersion: input.policyVersion.trim(),
    promptVersion: input.promptVersion.trim(),
    modelId: input.modelId.trim(),
  };
  return createHash("sha256").update(canonicalFoundationJson(digestInput), "utf8").digest("hex");
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
  const reasons: AiBudgetDecision["reasons"] = [];
  if (projected > input.limits.requestUsdMicros) reasons.push("request_limit");
  if (input.snapshot.hourlyUsdMicros + projected > input.limits.hourlyUsdMicros) reasons.push("hourly_limit");
  if (input.snapshot.featureMonthlyUsdMicros + projected > input.limits.featureMonthlyUsdMicros) {
    reasons.push("feature_monthly_limit");
  }
  if (input.snapshot.tenantMonthlyUsdMicros + projected > input.limits.tenantMonthlyUsdMicros) {
    reasons.push("tenant_monthly_limit");
  }
  return { allowed: reasons.length === 0, reasons };
}

export class InMemoryAiUsageControl {
  private readonly guards = new Map<string, AiExecutionGuard>();
  private readonly attemptEvents: AiExecutionAttemptEvent[] = [];
  private readonly usageEvents: AiUsageEvent[] = [];
  private recordedSequence = 0;

  acquire(input: {
    key: AiExecutionKeyInput;
    attemptId: string;
    now: string;
    leaseExpiresAt: string;
  }): { acquired: true; guard: AiExecutionGuard } | {
    acquired: false;
    reason: "active_lease" | "already_succeeded";
    guard: AiExecutionGuard;
  } {
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
      holderAttemptId: input.attemptId,
      acquiredAt: input.now,
      leaseExpiresAt: input.leaseExpiresAt,
      state: "active",
      settledAt: null,
    };
    this.guards.set(executionKey, guard);
    this.attemptEvents.push({
      eventId: randomUUID(),
      executionKey,
      attemptId: input.attemptId,
      occurredAt: input.now,
      kind: "started",
      detail: null,
    });
    return { acquired: true, guard: { ...guard } };
  }

  settle(input: {
    executionKey: string;
    attemptId: string;
    occurredAt: string;
    outcome: "succeeded" | "failed";
    detail?: string | null;
  }): AiExecutionGuard {
    validTimestamp(input.occurredAt, "settled_at");
    const guard = this.guards.get(input.executionKey);
    if (!guard) throw new Error("ai_guard_not_found");
    if (guard.holderAttemptId !== input.attemptId) throw new Error("ai_guard_holder_mismatch");
    if (guard.state !== "active") throw new Error("ai_guard_not_active");
    const settled: AiExecutionGuard = {
      ...guard,
      state: input.outcome,
      settledAt: input.occurredAt,
    };
    this.guards.set(input.executionKey, settled);
    this.attemptEvents.push({
      eventId: randomUUID(),
      executionKey: input.executionKey,
      attemptId: input.attemptId,
      occurredAt: input.occurredAt,
      kind: input.outcome,
      detail: input.detail ?? null,
    });
    return { ...settled };
  }

  recordUsage(input: Omit<AiUsageEvent, "eventId" | "recordedSequence">): AiUsageEvent {
    validTimestamp(input.occurredAt, "usage_occurred_at");
    nonNegativeInteger(input.inputTokens, "input_tokens");
    nonNegativeInteger(input.cachedInputTokens, "cached_input_tokens");
    nonNegativeInteger(input.cacheWriteTokens, "cache_write_tokens");
    nonNegativeInteger(input.outputTokens, "output_tokens");
    if (!Number.isSafeInteger(input.costUsdMicros)) throw new Error("invalid_ai_integer:cost_usd_micros");
    if (input.eventKind === "usage" && input.costUsdMicros < 0) throw new Error("ai_usage_cost_must_not_be_negative");
    this.recordedSequence += 1;
    const event: AiUsageEvent = {
      ...input,
      eventId: randomUUID(),
      recordedSequence: this.recordedSequence,
    };
    this.usageEvents.push(event);
    return { ...event };
  }

  getGuard(executionKey: string): AiExecutionGuard | null {
    const guard = this.guards.get(executionKey);
    return guard ? { ...guard } : null;
  }

  listAttemptEvents(): AiExecutionAttemptEvent[] {
    return this.attemptEvents.map((event) => ({ ...event }));
  }

  listUsageEvents(): AiUsageEvent[] {
    return this.usageEvents.map((event) => ({ ...event }));
  }
}
