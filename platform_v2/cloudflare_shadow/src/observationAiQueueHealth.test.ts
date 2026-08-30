import assert from "node:assert/strict";
import test from "node:test";
import {
  buildObservationAiOperatorRequeuePayload,
  classifyObservationAiQueueHealth,
  loadObservationAiQueueHealth,
  type ObservationAiQueueStateSummary,
} from "./observationAiQueueHealth.js";

test("queue health distinguishes healthy, delayed, and exhausted work", () => {
  const healthy: ObservationAiQueueStateSummary = {
    pending: { count: 0, staleCount: 0, oldestUpdatedAt: null },
    processing: { count: 0, staleCount: 0, oldestUpdatedAt: null },
    failed: { count: 0, staleCount: 0, oldestUpdatedAt: null },
    completed: { count: 31, staleCount: 0, oldestUpdatedAt: "2026-07-20 06:20:32" },
    exhaustedCount: 0,
    recentFailureCount: 0,
  };
  assert.equal(classifyObservationAiQueueHealth(healthy, true), "healthy");
  assert.equal(classifyObservationAiQueueHealth({ ...healthy, pending: { count: 3, staleCount: 1, oldestUpdatedAt: "2026-08-30 00:00:00" } }, true), "degraded");
  assert.equal(classifyObservationAiQueueHealth({ ...healthy, exhaustedCount: 2 }, true), "blocked");
  assert.equal(classifyObservationAiQueueHealth(healthy, false), "blocked");
});

test("queue health loader performs one aggregate read and returns no observation identities", async () => {
  let sql = "";
  let bindings: unknown[] = [];
  const statement = {
    bind(...values: unknown[]) { bindings = values; return this; },
    async all<T>() {
      return { results: [
        { request_state: "pending", request_count: 2, oldest_updated_at: "2026-08-30 01:00:00", stale_count: 1, exhausted_count: 0, recent_failure_count: 0 },
        { request_state: "failed", request_count: 1, oldest_updated_at: "2026-08-29 01:00:00", stale_count: 0, exhausted_count: 1, recent_failure_count: 1 },
      ] as T[] };
    },
  };
  const db = { prepare(value: string) { sql = value; return statement; } };
  const health = await loadObservationAiQueueHealth(db, {
    providerAvailable: true,
    now: new Date("2026-08-30T02:30:00.000Z"),
  });
  assert.match(sql, /GROUP BY request_state/u);
  assert.equal(bindings.length, 3);
  assert.equal(health.status, "blocked");
  assert.equal(health.states.pending.count, 2);
  assert.equal(health.exhaustedCount, 1);
  assert.doesNotMatch(JSON.stringify(health), /observation_id|request_id/u);
});

test("operator requeue preserves failure history but clears exhausted execution state", () => {
  const payload = buildObservationAiOperatorRequeuePayload({
    sourcePayloadJson: JSON.stringify({
      source: "cloudflare_observation_reassessment_request_ledger",
      attemptCount: 3,
      requeueCount: 1,
      executionStatus: "failed",
      errorCode: "provider_error",
      batchExecution: { claimId: "old-claim" },
    }),
    actorUserId: "admin-user",
    requeuedAt: "2026-08-30T02:30:00.000Z",
    enqueueId: "outbox-requeue-1",
  });
  assert.equal(payload.attemptCount, 0);
  assert.equal(payload.requeueCount, 2);
  assert.equal(payload.previousAttemptCount, 3);
  assert.equal(payload.operatorRequeue.actorUserId, "admin-user");
  assert.equal(payload.operatorRequeue.enqueueId, "outbox-requeue-1");
  assert.equal("batchExecution" in payload, false);
  assert.equal("executionStatus" in payload, false);
  assert.equal(payload.lastFailure.errorCode, "provider_error");
});
