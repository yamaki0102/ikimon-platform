import { createHash } from "node:crypto";
import type {
  AiBudgetDecision, AiBudgetLimits, AiBudgetProjection, AiBudgetReason, AiBudgetSnapshot,
  AiExecutionKeyInput, AiUsageEvent, RecordAiUsageInput,
} from "./aiUsageTypes.js";

export const MAX_AI_LEASE_DURATION_MS = 15 * 60 * 1_000;
export const AI_USAGE_METADATA_SCHEMA_VERSION = "ai.usage-metadata/v1" as const;

const countKeys = new Set([
  "prompttokencount", "candidatestokencount", "thoughtstokencount",
  "cachedcontenttokencount", "totaltokencount", "tooluseprompttokencount",
  "tokencount", "prompt_tokens", "completion_tokens", "total_tokens",
  "prompt_cache_hit_tokens", "prompt_cache_miss_tokens", "input_tokens",
  "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens",
  "cached_tokens", "audio_tokens", "reasoning_tokens",
  "accepted_prediction_tokens", "rejected_prediction_tokens",
  "ephemeral_5m_input_tokens", "ephemeral_1h_input_tokens",
]);
const enumKeys = new Set(["traffictype", "modality", "service_tier"]);
const containerKeys = new Set([
  "prompttokensdetails", "cachetokensdetails", "candidatestokensdetails",
  "tooluseprompttokensdetails", "prompt_tokens_details",
  "completion_tokens_details", "input_tokens_details", "output_tokens_details",
  "cache_creation",
]);

function sortedAiValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedAiValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortedAiValue(item)]),
  );
}

export function canonicalAiJson(value: unknown): string {
  return JSON.stringify(sortedAiValue(value));
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function required(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`required_ai_field:${name}`);
  return normalized;
}

export function requireDigest(value: string, name: string): string {
  const digest = required(value, name).toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(digest)) throw new Error(`invalid_ai_digest:${name}`);
  return digest;
}

export function validTimestamp(value: string, name: string): number {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) throw new Error(`invalid_ai_timestamp:${name}`);
  return epoch;
}

export function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid_ai_integer:${name}`);
  return value;
}

export function positiveLeaseDuration(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_AI_LEASE_DURATION_MS) {
    throw new Error("invalid_ai_lease_duration");
  }
  return value;
}

export function normalizeExecutionKeyInput(input: AiExecutionKeyInput): AiExecutionKeyInput {
  const targetTime = input.targetTime === null
    ? null
    : new Date(validTimestamp(input.targetTime, "target_time")).toISOString();
  return {
    tenantId: required(input.tenantId, "tenant_id"),
    project: required(input.project, "project"),
    workspaceId: input.workspaceId === null ? null : required(input.workspaceId, "workspace_id"),
    feature: required(input.feature, "feature"),
    provider: required(input.provider, "provider"),
    modelId: required(input.modelId, "model_id"),
    operationVersion: required(input.operationVersion, "operation_version"),
    canonicalInputDigest: requireDigest(input.canonicalInputDigest, "canonical_input_digest"),
    sourceDigest: requireDigest(input.sourceDigest, "source_digest"),
    extractionRunId: input.extractionRunId === null ? null : required(input.extractionRunId, "extraction_run_id"),
    policyVersion: required(input.policyVersion, "policy_version"),
    promptVersion: required(input.promptVersion, "prompt_version"),
    targetTime,
  };
}

export function buildAiExecutionKey(input: AiExecutionKeyInput): string {
  return sha256(canonicalAiJson(normalizeExecutionKeyInput(input)));
}

function validateUsageMetadataValue(value: unknown, depth: number): void {
  if (depth > 6) throw new Error("ai_raw_usage_json_too_deep");
  if (Array.isArray(value)) {
    if (value.length > 256) throw new Error("ai_raw_usage_json_array_too_large");
    for (const item of value) {
      if (item !== null && (typeof item !== "object" || Array.isArray(item))) {
        throw new Error("ai_raw_usage_json_array_item_invalid");
      }
      if (item !== null) validateUsageMetadataValue(item, depth + 1);
    }
    return;
  }
  if (!value || typeof value !== "object") throw new Error("ai_raw_usage_json_container_invalid");
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 256) throw new Error("ai_raw_usage_json_object_too_large");
  for (const [key, item] of entries) {
    const normalizedKey = key.toLowerCase();
    if (countKeys.has(normalizedKey)) {
      if (item !== null && (typeof item !== "number" || !Number.isFinite(item) || item < 0)) {
        throw new Error(`ai_raw_usage_json_count_invalid:${key}`);
      }
    } else if (enumKeys.has(normalizedKey)) {
      if (item !== null && (typeof item !== "string" || item.length > 64)) {
        throw new Error(`ai_raw_usage_json_enum_invalid:${key}`);
      }
    } else if (containerKeys.has(normalizedKey)) {
      if (item !== null) validateUsageMetadataValue(item, depth + 1);
    } else {
      throw new Error(`ai_raw_usage_json_unknown_key:${key}`);
    }
  }
}

export function normalizeAiUsageMetadata(rawUsageJson: string): string {
  if (rawUsageJson.length > 16_384) throw new Error("ai_raw_usage_json_too_large");
  let parsed: unknown;
  try { parsed = JSON.parse(rawUsageJson); } catch { throw new Error("ai_raw_usage_json_invalid"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ai_raw_usage_json_must_be_object");
  }
  validateUsageMetadataValue(parsed, 0);
  const canonical = canonicalAiJson(parsed);
  if (Buffer.byteLength(canonical, "utf8") > 16_384) throw new Error("ai_raw_usage_json_too_large");
  return canonical;
}

export function validateRelatedUsageEvent(
  input: RecordAiUsageInput,
  target: AiUsageEvent,
  relation: "retry" | "adjustment",
): void {
  if (target.tenantId !== input.tenantId
    || target.project !== input.project
    || target.workspaceId !== input.workspaceId
    || target.feature !== input.feature
    || target.operationVersion !== input.operationVersion
    || target.provider !== input.provider
    || target.modelId !== input.modelId
    || target.executionKey !== input.executionKey) {
    throw new Error(`ai_${relation}_target_scope_mismatch`);
  }
}

export function evaluateAiBudget(input: {
  projection: AiBudgetProjection;
  snapshot: AiBudgetSnapshot;
  limits: AiBudgetLimits;
}): AiBudgetDecision {
  const projection = {
    request: nonNegativeInteger(input.projection.requestUsdMicros, "projected_request_usd_micros"),
    retryCount: nonNegativeInteger(input.projection.retryCount, "projected_retry_count"),
    fallbackDepth: nonNegativeInteger(input.projection.fallbackDepth, "projected_fallback_depth"),
    providerFailureCount: nonNegativeInteger(input.projection.providerFailureCount, "projected_provider_failure_count"),
  };
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
  if (projection.request > limits.request) reasons.push("request_limit");
  if (snapshot.hourly + projection.request > limits.hourly) reasons.push("hourly_limit");
  if (snapshot.featureMonthly + projection.request > limits.featureMonthly) reasons.push("feature_monthly_limit");
  if (snapshot.tenantMonthly + projection.request > limits.tenantMonthly) reasons.push("tenant_monthly_limit");
  if (snapshot.retryCount + projection.retryCount > limits.retryCount) reasons.push("retry_limit");
  if (Math.max(snapshot.fallbackDepth, projection.fallbackDepth) > limits.fallbackDepth) reasons.push("fallback_depth_limit");
  if (snapshot.providerFailureCount + projection.providerFailureCount > limits.providerFailureCount) {
    reasons.push("provider_failure_limit");
  }
  return { allowed: reasons.length === 0, reasons };
}
