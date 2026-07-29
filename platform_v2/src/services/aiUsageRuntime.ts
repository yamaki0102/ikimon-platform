import { createHash, randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { AiExecutionBoundary, type AiProviderInvocationResult } from "./aiExecutionBoundary.js";
import { canonicalAiJson, type AiBudgetLimits, type AiBudgetProjection } from "./aiUsageControl.js";
import { adaptPgPoolForAiUsage } from "./aiUsagePgPoolAdapter.js";
import { AiUsagePostgresRepository } from "./aiUsagePostgresRepository.js";

export type AiRuntimeMetadata = {
  tenantId?: string;
  project?: string;
  workspaceId?: string | null;
  feature: string;
  operationVersion: string;
  invocationId?: string;
  sourceDigest?: string;
  extractionRunId?: string | null;
  policyVersion?: string;
  promptVersion: string;
  targetTime?: string | null;
  providerAccountId?: string | null;
  pricingVersion: string;
  leaseDurationMs?: number;
  budgetLimits?: Partial<AiBudgetLimits>;
  budgetProjection: AiBudgetProjection;
};

let singleton: AiExecutionBoundary | null = null;
function boundary(): AiExecutionBoundary {
  if (!singleton) {
    singleton = new AiExecutionBoundary(
      new AiUsagePostgresRepository(adaptPgPoolForAiUsage(getPool())),
    );
  }
  return singleton;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function positiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
function limits(overrides: Partial<AiBudgetLimits> = {}): AiBudgetLimits {
  return {
    requestUsdMicros: overrides.requestUsdMicros ?? positiveEnv("AI_USAGE_REQUEST_USD_MICROS", 500_000),
    hourlyUsdMicros: overrides.hourlyUsdMicros ?? positiveEnv("AI_USAGE_HOURLY_USD_MICROS", 5_000_000),
    featureMonthlyUsdMicros: overrides.featureMonthlyUsdMicros ?? positiveEnv("AI_USAGE_FEATURE_MONTHLY_USD_MICROS", 100_000_000),
    tenantMonthlyUsdMicros: overrides.tenantMonthlyUsdMicros ?? positiveEnv("AI_USAGE_TENANT_MONTHLY_USD_MICROS", 500_000_000),
    retryCount: overrides.retryCount ?? positiveEnv("AI_USAGE_HOURLY_RETRY_LIMIT", 100),
    fallbackDepth: overrides.fallbackDepth ?? positiveEnv("AI_USAGE_FALLBACK_DEPTH_LIMIT", 3),
    providerFailureCount: overrides.providerFailureCount ?? positiveEnv("AI_USAGE_HOURLY_PROVIDER_FAILURE_LIMIT", 100),
  };
}
function enabledFlag(): boolean {
  return ["1", "true", "yes", "on"].includes(
    process.env.AI_USAGE_V2_ENABLED?.trim().toLowerCase() ?? "",
  );
}
function enabledFeatures(): Set<string> {
  return new Set(
    (process.env.AI_USAGE_V2_FEATURES ?? "")
      .split(",")
      .map((feature) => feature.trim())
      .filter(Boolean),
  );
}

/**
 * Activation is fail-closed. Both the global flag and an explicit feature
 * allowlist entry are required. `*` is supported only for a reviewed full cutover.
 */
export function isAiUsageV2Enabled(feature?: string): boolean {
  if (!enabledFlag()) return false;
  const features = enabledFeatures();
  if (features.size === 0) return false;
  if (features.has("*")) return true;
  return typeof feature === "string" && features.has(feature.trim());
}

export async function executeMeteredAiOperation<T>(input: {
  provider: string;
  modelId: string;
  canonicalInput: unknown;
  metadata: AiRuntimeMetadata;
  invoke(): Promise<AiProviderInvocationResult<T>>;
}): Promise<T> {
  if (!isAiUsageV2Enabled(input.metadata.feature)) return (await input.invoke()).value;
  const canonicalInputDigest = sha256(canonicalAiJson(input.canonicalInput));
  const invocationId = input.metadata.invocationId ?? randomUUID();
  return boundary().execute({
    key: {
      tenantId: input.metadata.tenantId ?? "ikimon-public",
      project: input.metadata.project ?? "ikimon-life",
      workspaceId: input.metadata.workspaceId ?? null,
      feature: input.metadata.feature,
      provider: input.provider,
      modelId: input.modelId,
      operationVersion: input.metadata.operationVersion,
      invocationId,
      canonicalInputDigest,
      sourceDigest: input.metadata.sourceDigest ?? canonicalInputDigest,
      extractionRunId: input.metadata.extractionRunId ?? null,
      policyVersion: input.metadata.policyVersion ?? "runtime-v1",
      promptVersion: input.metadata.promptVersion,
      targetTime: input.metadata.targetTime ?? null,
    },
    attemptId: `${invocationId}:${randomUUID()}`,
    leaseDurationMs: input.metadata.leaseDurationMs ?? 5 * 60_000,
    requestId: randomUUID(),
    providerAccountId: input.metadata.providerAccountId ?? null,
    pricingVersion: input.metadata.pricingVersion,
    budgetLimits: limits(input.metadata.budgetLimits),
    budgetProjection: input.metadata.budgetProjection,
    invoke: async () => input.invoke(),
  });
}
