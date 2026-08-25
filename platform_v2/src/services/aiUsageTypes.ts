export type AiExecutionKeyInput = {
  tenantId: string;
  project: string;
  workspaceId: string | null;
  feature: string;
  provider: string;
  modelId: string;
  operationVersion: string;
  invocationId: string;
  canonicalInputDigest: string;
  sourceDigest: string;
  extractionRunId: string | null;
  policyVersion: string;
  promptVersion: string;
  targetTime: string | null;
};

export type AiExecutionGuard = {
  executionKey: string;
  key: AiExecutionKeyInput;
  holderAttemptId: string;
  leaseGeneration: number;
  acquiredAt: string;
  leaseExpiresAt: string;
  state: "active" | "succeeded" | "failed";
  settledAt: string | null;
};

export type AiExecutionAttemptEvent = {
  eventId: string;
  executionKey: string;
  attemptId: string;
  leaseGeneration: number;
  occurredAt: string;
  kind: "started" | "renewed" | "succeeded" | "failed" | "lease_expired";
  detail: string | null;
};

export type AiUsageEvent = {
  eventId: string;
  occurredAt: string;
  recordedSequence: number;
  tenantId: string;
  project: string;
  workspaceId: string | null;
  feature: string;
  operationVersion: string;
  requestId: string;
  executionKey: string | null;
  attemptId: string | null;
  leaseGeneration: number | null;
  provider: string;
  providerRequestId: string | null;
  providerAccountId: string | null;
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
  adjustmentOfEventId: string | null;
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
export type AiBudgetProjection = {
  requestUsdMicros: number;
  retryCount: number;
  fallbackDepth: number;
  providerFailureCount: number;
};
export type AiBudgetReason =
  | "request_limit" | "hourly_limit" | "feature_monthly_limit" | "tenant_monthly_limit"
  | "retry_limit" | "fallback_depth_limit" | "provider_failure_limit";
export type AiBudgetDecision = { allowed: boolean; reasons: AiBudgetReason[] };

export type AcquireAiExecutionInput = { key: AiExecutionKeyInput; attemptId: string; leaseDurationMs: number };
export type AcquireAiExecutionResult =
  | { acquired: true; guard: AiExecutionGuard }
  | { acquired: false; reason: "active_lease" | "already_succeeded"; guard: AiExecutionGuard };
export type RenewAiExecutionInput = {
  executionKey: string; attemptId: string; leaseGeneration: number; leaseDurationMs: number;
};
export type SettleAiExecutionInput = {
  executionKey: string; attemptId: string; leaseGeneration: number;
  outcome: "succeeded" | "failed"; detail?: string | null;
};
export type RecordAiUsageInput = Omit<AiUsageEvent, "recordedSequence">;
export type CompleteAiExecutionInput = { settle: SettleAiExecutionInput; usage: RecordAiUsageInput };
export type CompleteAiExecutionResult = { guard: AiExecutionGuard; usage: AiUsageEvent };
export type AiBudgetSnapshotInput = {
  tenantId: string; project: string; workspaceId: string | null; feature: string; now: string;
};

export interface AiUsageRepository {
  acquire(input: AcquireAiExecutionInput): Promise<AcquireAiExecutionResult>;
  renew(input: RenewAiExecutionInput): Promise<AiExecutionGuard>;
  settle(input: SettleAiExecutionInput): Promise<AiExecutionGuard>;
  completeAttempt(input: CompleteAiExecutionInput): Promise<CompleteAiExecutionResult>;
  recordUsage(input: RecordAiUsageInput): Promise<AiUsageEvent>;
  getGuard(executionKey: string): Promise<AiExecutionGuard | null>;
  budgetSnapshot?(input: AiBudgetSnapshotInput): Promise<AiBudgetSnapshot>;
}
