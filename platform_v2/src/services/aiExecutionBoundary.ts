import { randomUUID } from "node:crypto";
import {
  evaluateAiBudget, normalizeAiUsageMetadata,
  type AiBudgetLimits, type AiBudgetProjection, type AiExecutionKeyInput,
  type AiUsageEvent, type AiUsageRepository,
} from "./aiUsageControl.js";

export type AiProviderTelemetry = {
  providerRequestId: string | null;
  rawUsageJson: string;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  costUsdMicros: number;
  retryCount: number;
  fallbackDepth: number;
  providerFailureCount: number;
};

export type AiProviderInvocationResult<T> = { value: T; telemetry: AiProviderTelemetry };

export class AiProviderInvocationError extends Error {
  constructor(
    message: string,
    readonly outcome: "error" | "timeout" | "refused" | "aborted",
    readonly telemetry?: Partial<AiProviderTelemetry>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AiProviderInvocationError";
  }
}

export class AiBudgetRejectedError extends Error {
  constructor(readonly reasons: string[]) {
    super(`ai_budget_rejected:${reasons.join(",")}`);
    this.name = "AiBudgetRejectedError";
  }
}

export type AiExecutionBoundaryRequest<T> = {
  key: AiExecutionKeyInput;
  attemptId: string;
  leaseDurationMs: number;
  requestId: string;
  providerAccountId: string | null;
  pricingVersion: string;
  budgetLimits: AiBudgetLimits;
  budgetProjection: AiBudgetProjection;
  invoke(input: { renew(): Promise<void> }): Promise<AiProviderInvocationResult<T>>;
};

function nonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function telemetryFromError(error: unknown): { outcome: AiUsageEvent["outcome"]; telemetry: AiProviderTelemetry } {
  const failure = error instanceof AiProviderInvocationError ? error : null;
  const partial = failure?.telemetry;
  return {
    outcome: failure?.outcome ?? "error",
    telemetry: {
      providerRequestId: partial?.providerRequestId ?? null,
      rawUsageJson: normalizeAiUsageMetadata(partial?.rawUsageJson ?? "{}"),
      inputTokens: nonNegative(partial?.inputTokens),
      cachedInputTokens: nonNegative(partial?.cachedInputTokens),
      cacheWriteTokens: nonNegative(partial?.cacheWriteTokens),
      outputTokens: nonNegative(partial?.outputTokens),
      costUsdMicros: nonNegative(partial?.costUsdMicros),
      retryCount: nonNegative(partial?.retryCount),
      fallbackDepth: nonNegative(partial?.fallbackDepth),
      providerFailureCount: Math.max(1, nonNegative(partial?.providerFailureCount)),
    },
  };
}

export class AiExecutionBoundary {
  constructor(
    private readonly repository: AiUsageRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute<T>(request: AiExecutionBoundaryRequest<T>): Promise<T> {
    if (!this.repository.budgetSnapshot) throw new Error("ai_budget_snapshot_not_supported");
    const snapshot = await this.repository.budgetSnapshot({
      tenantId: request.key.tenantId,
      project: request.key.project,
      workspaceId: request.key.workspaceId,
      feature: request.key.feature,
      now: this.clock().toISOString(),
    });
    const budget = evaluateAiBudget({ projection: request.budgetProjection, snapshot, limits: request.budgetLimits });
    if (!budget.allowed) throw new AiBudgetRejectedError(budget.reasons);

    const acquired = await this.repository.acquire({
      key: request.key, attemptId: request.attemptId, leaseDurationMs: request.leaseDurationMs,
    });
    if (!acquired.acquired) throw new Error(`ai_execution_not_acquired:${acquired.reason}`);
    const guard = acquired.guard;
    const renew = async (): Promise<void> => {
      await this.repository.renew({
        executionKey: guard.executionKey,
        attemptId: guard.holderAttemptId,
        leaseGeneration: guard.leaseGeneration,
        leaseDurationMs: request.leaseDurationMs,
      });
    };

    const complete = async (
      outcome: AiUsageEvent["outcome"],
      settleOutcome: "succeeded" | "failed",
      telemetry: AiProviderTelemetry,
      detail?: string,
    ): Promise<void> => {
      await this.repository.completeAttempt({
        settle: {
          executionKey: guard.executionKey,
          attemptId: guard.holderAttemptId,
          leaseGeneration: guard.leaseGeneration,
          outcome: settleOutcome,
          detail,
        },
        usage: {
          eventId: randomUUID(),
          occurredAt: this.clock().toISOString(),
          tenantId: request.key.tenantId,
          project: request.key.project,
          workspaceId: request.key.workspaceId,
          feature: request.key.feature,
          operationVersion: request.key.operationVersion,
          requestId: request.requestId,
          executionKey: guard.executionKey,
          attemptId: guard.holderAttemptId,
          leaseGeneration: guard.leaseGeneration,
          provider: request.key.provider,
          providerRequestId: telemetry.providerRequestId,
          providerAccountId: request.providerAccountId,
          modelId: request.key.modelId,
          pricingVersion: request.pricingVersion,
          promptVersion: request.key.promptVersion,
          inputTokens: telemetry.inputTokens,
          cachedInputTokens: telemetry.cachedInputTokens,
          cacheWriteTokens: telemetry.cacheWriteTokens,
          outputTokens: telemetry.outputTokens,
          costUsdMicros: telemetry.costUsdMicros,
          retryCount: telemetry.retryCount,
          fallbackDepth: telemetry.fallbackDepth,
          providerFailureCount: telemetry.providerFailureCount,
          eventKind: "usage",
          outcome,
          reconciliationStatus: "pending",
          rawUsageJson: normalizeAiUsageMetadata(telemetry.rawUsageJson),
          retryOfEventId: null,
          adjustmentOfEventId: null,
        },
      });
    };

    try {
      const result = await request.invoke({ renew });
      await complete("ok", "succeeded", result.telemetry);
      return result.value;
    } catch (error) {
      const failure = telemetryFromError(error);
      await complete(
        failure.outcome,
        "failed",
        failure.telemetry,
        error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
      );
      throw error;
    }
  }
}
