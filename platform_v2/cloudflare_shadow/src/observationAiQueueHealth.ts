export type ObservationAiQueueState = "pending" | "processing" | "failed" | "completed";

export type ObservationAiQueueStateMetric = {
  count: number;
  staleCount: number;
  oldestUpdatedAt: string | null;
};

export type ObservationAiQueueStateSummary = Record<ObservationAiQueueState, ObservationAiQueueStateMetric> & {
  exhaustedCount: number;
  recentFailureCount: number;
};

export type ObservationAiQueueHealth = {
  status: "healthy" | "degraded" | "blocked";
  providerAvailable: boolean;
  checkedAt: string;
  thresholds: { pendingMinutes: 15; processingMinutes: 60; recentFailureHours: 24 };
  states: Record<ObservationAiQueueState, ObservationAiQueueStateMetric>;
  exhaustedCount: number;
  recentFailureCount: number;
};

export type ObservationAiOperatorRequeuePayload = Record<string, unknown> & {
  attemptCount: 0;
  previousAttemptCount: number;
  requeueCount: number;
  lastFailure: {
    attemptCount: number;
    executionStatus: string;
    errorCode: string | null;
    failedAt: string | null;
  };
  operatorRequeue: {
    actorUserId: string;
    requeuedAt: string;
    enqueueId: string;
  };
};

type D1Result<T> = { results: T[] };
type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  all<T>(): Promise<D1Result<T>>;
};
type D1DatabaseLike = { prepare(sql: string): D1Statement };

type QueueSummaryRow = {
  request_state: string;
  request_count: number;
  oldest_updated_at: string | null;
  stale_count: number;
  exhausted_count: number;
  recent_failure_count: number;
};

const emptyMetric = (): ObservationAiQueueStateMetric => ({ count: 0, staleCount: 0, oldestUpdatedAt: null });

function sqliteTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function classifyObservationAiQueueHealth(
  summary: ObservationAiQueueStateSummary,
  providerAvailable: boolean,
): ObservationAiQueueHealth["status"] {
  if (!providerAvailable || summary.exhaustedCount > 0) return "blocked";
  if (
    summary.pending.staleCount > 0
    || summary.processing.staleCount > 0
    || summary.failed.count > 0
    || summary.recentFailureCount > 0
  ) return "degraded";
  return "healthy";
}

export async function loadObservationAiQueueHealth(
  db: D1DatabaseLike,
  input: { providerAvailable: boolean; now?: Date },
): Promise<ObservationAiQueueHealth> {
  const now = input.now ?? new Date();
  const pendingThreshold = sqliteTimestamp(new Date(now.getTime() - 15 * 60_000));
  const processingThreshold = sqliteTimestamp(new Date(now.getTime() - 60 * 60_000));
  const recentFailureThreshold = sqliteTimestamp(new Date(now.getTime() - 24 * 60 * 60_000));
  const rows = await db.prepare(
    `SELECT request_state,
            COUNT(*) AS request_count,
            MIN(updated_at) AS oldest_updated_at,
            SUM(CASE
                  WHEN request_state = 'pending' AND updated_at < ? THEN 1
                  WHEN request_state = 'processing' AND updated_at < ? THEN 1
                  ELSE 0
                END) AS stale_count,
            SUM(CASE
                  WHEN request_state = 'failed'
                   AND CAST(COALESCE(json_extract(source_payload_json, '$.attemptCount'), 0) AS INTEGER) >= 3
                  THEN 1 ELSE 0
                END) AS exhausted_count,
            SUM(CASE WHEN request_state = 'failed' AND updated_at >= ? THEN 1 ELSE 0 END) AS recent_failure_count
       FROM observation_reassessment_requests
      WHERE request_kind = 'standard'
      GROUP BY request_state`,
  ).bind(pendingThreshold, processingThreshold, recentFailureThreshold).all<QueueSummaryRow>();
  const states: Record<ObservationAiQueueState, ObservationAiQueueStateMetric> = {
    pending: emptyMetric(),
    processing: emptyMetric(),
    failed: emptyMetric(),
    completed: emptyMetric(),
  };
  let exhaustedCount = 0;
  let recentFailureCount = 0;
  for (const row of rows.results) {
    if (!(row.request_state in states)) continue;
    states[row.request_state as ObservationAiQueueState] = {
      count: Number(row.request_count) || 0,
      staleCount: Number(row.stale_count) || 0,
      oldestUpdatedAt: row.oldest_updated_at ?? null,
    };
    exhaustedCount += Number(row.exhausted_count) || 0;
    recentFailureCount += Number(row.recent_failure_count) || 0;
  }
  const summary: ObservationAiQueueStateSummary = { ...states, exhaustedCount, recentFailureCount };
  return {
    status: classifyObservationAiQueueHealth(summary, input.providerAvailable),
    providerAvailable: input.providerAvailable,
    checkedAt: now.toISOString(),
    thresholds: { pendingMinutes: 15, processingMinutes: 60, recentFailureHours: 24 },
    states,
    exhaustedCount,
    recentFailureCount,
  };
}

function parsedPayload(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function buildObservationAiOperatorRequeuePayload(input: {
  sourcePayloadJson: string;
  actorUserId: string;
  requeuedAt: string;
  enqueueId: string;
}): ObservationAiOperatorRequeuePayload {
  const source = parsedPayload(input.sourcePayloadJson);
  const previousAttemptCount = Number(source.attemptCount) || 0;
  const previousRequeueCount = Number(source.requeueCount) || 0;
  const lastFailure = {
    attemptCount: previousAttemptCount,
    executionStatus: typeof source.executionStatus === "string" ? source.executionStatus : "failed",
    errorCode: typeof source.errorCode === "string" ? source.errorCode : null,
    failedAt: typeof source.failedAt === "string" ? source.failedAt : null,
  };
  const next = { ...source };
  for (const key of ["batchExecution", "executionStatus", "errorCode", "failedAt", "lastSubmitError", "lastSubmitAttemptAt"]) delete next[key];
  return {
    ...next,
    attemptCount: 0,
    previousAttemptCount,
    requeueCount: previousRequeueCount + 1,
    lastFailure,
    operatorRequeue: {
      actorUserId: input.actorUserId,
      requeuedAt: input.requeuedAt,
      enqueueId: input.enqueueId,
    },
  } as ObservationAiOperatorRequeuePayload;
}
