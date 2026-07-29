import { randomUUID } from "node:crypto";
import {
  canonicalAiJson, normalizeAiUsageMetadata, normalizeExecutionKeyInput,
  nonNegativeInteger, required, validTimestamp,
} from "./aiUsagePolicy.js";
import type { AiExecutionGuard, AiExecutionKeyInput, AiUsageEvent, RecordAiUsageInput } from "./aiUsageTypes.js";

export interface AiUsagePostgresQueryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}
export interface AiUsagePostgresClient extends AiUsagePostgresQueryable { release(): void }
export interface AiUsagePostgresPool extends AiUsagePostgresQueryable { connect(): Promise<AiUsagePostgresClient> }

export type GuardRow = {
  execution_key: string; tenant_id: string; project: string; workspace_id: string | null;
  feature: string; provider: string; model_id: string; operation_version: string;
  invocation_id: string; canonical_input_digest: string; source_digest: string;
  extraction_run_id: string | null; policy_version: string; prompt_version: string;
  target_time: string | null; holder_attempt_id: string; lease_generation: string | number;
  acquired_at: string; lease_expires_at: string; state: string; settled_at: string | null;
};
export type UsageRow = {
  event_id: string; recorded_sequence: string | number; occurred_at: string;
  tenant_id: string; project: string; workspace_id: string | null; feature: string;
  operation_version: string; request_id: string; execution_key: string | null;
  attempt_id: string | null; lease_generation: string | number | null;
  provider: string; provider_request_id: string | null; provider_account_id: string | null;
  model_id: string; pricing_version: string; prompt_version: string;
  input_tokens: string | number; cached_input_tokens: string | number;
  cache_write_tokens: string | number; output_tokens: string | number;
  cost_usd_micros: string | number; retry_count: string | number;
  fallback_depth: string | number; provider_failure_count: string | number;
  event_kind: string; outcome: string; reconciliation_status: string; raw_usage: unknown;
  retry_of_event_id: string | null; adjustment_of_event_id: string | null;
};

export const GUARD_COLUMNS = `execution_key, tenant_id, project, workspace_id, feature, provider,
  model_id, operation_version, invocation_id, canonical_input_digest, source_digest,
  extraction_run_id, policy_version, prompt_version, target_time::text,
  holder_attempt_id, lease_generation, acquired_at::text, lease_expires_at::text,
  state, settled_at::text`;
export const USAGE_COLUMNS = `event_id, recorded_sequence, occurred_at::text, tenant_id, project,
  workspace_id, feature, operation_version, request_id, execution_key, attempt_id,
  lease_generation, provider, provider_request_id, provider_account_id, model_id,
  pricing_version, prompt_version, input_tokens, cached_input_tokens, cache_write_tokens,
  output_tokens, cost_usd_micros, retry_count, fallback_depth, provider_failure_count,
  event_kind, outcome, reconciliation_status, raw_usage, retry_of_event_id, adjustment_of_event_id`;

export function integer(value: unknown, code: string): number {
  const parsed = Number(value); if (!Number.isSafeInteger(parsed)) throw new Error(code); return parsed;
}
export function timestamp(value: unknown, code: string): string {
  const epoch = Date.parse(String(value)); if (!Number.isFinite(epoch)) throw new Error(code); return new Date(epoch).toISOString();
}
export function enumValue<T extends string>(value: unknown, allowed: readonly T[], code: string): T {
  const actual = String(value); if (!allowed.includes(actual as T)) throw new Error(`${code}:${actual}`); return actual as T;
}
export function guardFromRow(row: GuardRow): AiExecutionGuard {
  const key: AiExecutionKeyInput = {
    tenantId: row.tenant_id, project: row.project, workspaceId: row.workspace_id,
    feature: row.feature, provider: row.provider, modelId: row.model_id,
    operationVersion: row.operation_version, invocationId: row.invocation_id,
    canonicalInputDigest: row.canonical_input_digest, sourceDigest: row.source_digest,
    extractionRunId: row.extraction_run_id, policyVersion: row.policy_version,
    promptVersion: row.prompt_version,
    targetTime: row.target_time === null ? null : timestamp(row.target_time, "ai_guard_target_time_invalid"),
  };
  return {
    executionKey: row.execution_key, key: normalizeExecutionKeyInput(key),
    holderAttemptId: row.holder_attempt_id,
    leaseGeneration: integer(row.lease_generation, "ai_guard_generation_invalid"),
    acquiredAt: timestamp(row.acquired_at, "ai_guard_acquired_at_invalid"),
    leaseExpiresAt: timestamp(row.lease_expires_at, "ai_guard_expiry_invalid"),
    state: enumValue(row.state, ["active", "succeeded", "failed"] as const, "ai_guard_state_invalid"),
    settledAt: row.settled_at === null ? null : timestamp(row.settled_at, "ai_guard_settled_at_invalid"),
  };
}
export function rawJson(value: unknown): string {
  return normalizeAiUsageMetadata(typeof value === "string" ? value : JSON.stringify(value ?? {}));
}
export function usageFromRow(row: UsageRow): AiUsageEvent {
  return {
    eventId: row.event_id, recordedSequence: integer(row.recorded_sequence, "ai_usage_sequence_invalid"),
    occurredAt: timestamp(row.occurred_at, "ai_usage_occurred_at_invalid"),
    tenantId: row.tenant_id, project: row.project, workspaceId: row.workspace_id,
    feature: row.feature, operationVersion: row.operation_version, requestId: row.request_id,
    executionKey: row.execution_key, attemptId: row.attempt_id,
    leaseGeneration: row.lease_generation === null ? null : integer(row.lease_generation, "ai_usage_generation_invalid"),
    provider: row.provider, providerRequestId: row.provider_request_id,
    providerAccountId: row.provider_account_id, modelId: row.model_id,
    pricingVersion: row.pricing_version, promptVersion: row.prompt_version,
    inputTokens: integer(row.input_tokens, "ai_usage_input_invalid"),
    cachedInputTokens: integer(row.cached_input_tokens, "ai_usage_cache_read_invalid"),
    cacheWriteTokens: integer(row.cache_write_tokens, "ai_usage_cache_write_invalid"),
    outputTokens: integer(row.output_tokens, "ai_usage_output_invalid"),
    costUsdMicros: integer(row.cost_usd_micros, "ai_usage_cost_invalid"),
    retryCount: integer(row.retry_count, "ai_usage_retry_invalid"),
    fallbackDepth: integer(row.fallback_depth, "ai_usage_fallback_invalid"),
    providerFailureCount: integer(row.provider_failure_count, "ai_usage_failure_invalid"),
    eventKind: enumValue(row.event_kind, ["usage", "adjustment"] as const, "ai_usage_kind_invalid"),
    outcome: enumValue(row.outcome, ["ok", "error", "timeout", "refused", "aborted"] as const, "ai_usage_outcome_invalid"),
    reconciliationStatus: enumValue(row.reconciliation_status, ["pending", "matched", "adjusted"] as const, "ai_usage_reconciliation_invalid"),
    rawUsageJson: rawJson(row.raw_usage), retryOfEventId: row.retry_of_event_id,
    adjustmentOfEventId: row.adjustment_of_event_id,
  };
}
export function comparable(event: AiUsageEvent): string {
  const { recordedSequence: _, rawUsageJson, ...rest } = event;
  return canonicalAiJson({ ...rest, rawUsageJson: rawJson(rawUsageJson) });
}
export async function rollback(client: AiUsagePostgresClient): Promise<void> { await client.query("ROLLBACK").catch(() => undefined) }
export async function dbNow(client: AiUsagePostgresQueryable): Promise<string> {
  const result = await client.query<{ now: string }>("SELECT clock_timestamp()::text AS now");
  if (!result.rows[0]) throw new Error("ai_database_clock_unavailable");
  return timestamp(result.rows[0].now, "ai_database_clock_invalid");
}
export async function selectGuard(client: AiUsagePostgresQueryable, key: string): Promise<AiExecutionGuard | null> {
  const result = await client.query<GuardRow>(`SELECT ${GUARD_COLUMNS} FROM ai_execution_guards WHERE execution_key=$1 FOR UPDATE`, [key]);
  return result.rows[0] ? guardFromRow(result.rows[0]) : null;
}
export async function appendAttempt(client: AiUsagePostgresQueryable, input: {
  executionKey: string; attemptId: string; generation: number; occurredAt: string;
  kind: "started" | "renewed" | "succeeded" | "failed" | "lease_expired"; detail?: string | null;
}): Promise<void> {
  await client.query(`INSERT INTO ai_execution_attempt_events(
    event_id, execution_key, attempt_id, lease_generation, occurred_at, kind, detail
  ) VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7)`, [
    randomUUID(), input.executionKey, input.attemptId, input.generation,
    input.occurredAt, input.kind, input.detail ?? null,
  ]);
}
export function validateUsageInput(input: RecordAiUsageInput): string {
  required(input.eventId, "usage_event_id"); validTimestamp(input.occurredAt, "usage_occurred_at");
  for (const name of ["tenantId", "project", "feature", "operationVersion", "requestId", "provider", "modelId", "pricingVersion", "promptVersion"] as const) required(input[name], `usage_${name}`);
  if (input.workspaceId !== null) required(input.workspaceId, "usage_workspace_id");
  for (const [name, value] of Object.entries({
    inputTokens: input.inputTokens, cachedInputTokens: input.cachedInputTokens,
    cacheWriteTokens: input.cacheWriteTokens, outputTokens: input.outputTokens,
    retryCount: input.retryCount, fallbackDepth: input.fallbackDepth,
    providerFailureCount: input.providerFailureCount,
  })) nonNegativeInteger(value, name);
  if (!Number.isSafeInteger(input.costUsdMicros) || (input.eventKind === "usage" && input.costUsdMicros < 0)) throw new Error("ai_usage_cost_invalid");
  const relation = [input.executionKey, input.attemptId, input.leaseGeneration];
  if (!(relation.every((v) => v === null) || relation.every((v) => v !== null))) throw new Error("ai_usage_execution_relation_shape_invalid");
  if (input.eventKind === "adjustment") {
    if (input.retryOfEventId || !input.adjustmentOfEventId || input.reconciliationStatus !== "adjusted") throw new Error("ai_usage_adjustment_shape_invalid");
  } else if (input.adjustmentOfEventId || input.reconciliationStatus === "adjusted") throw new Error("ai_usage_shape_invalid");
  return normalizeAiUsageMetadata(input.rawUsageJson);
}
