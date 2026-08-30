import assert from "node:assert/strict";
import test from "node:test";
import {
  emitAreaWatchNotificationForObservation,
  ensureAreaWatchParticipationForVisit,
} from "./areaWatchNotifications.js";

type Query = { text: string; values: unknown[] };

function makeMockClient(history: Query[], rows: Array<{ delivery_id: string }> = []) {
  return {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      return { rows };
    },
  } as unknown as import("pg").PoolClient;
}

test("emitAreaWatchNotificationForObservation targets active area followers without emailing", async () => {
  const history: Query[] = [];
  const summary = await emitAreaWatchNotificationForObservation({
    occurrenceId: "occ-1",
    visitId: "visit-1",
  }, makeMockClient(history, [{ delivery_id: "delivery-1" }]));

  assert.equal(summary.areaWatchNotifications, 1);
  const sql = history.map((query) => query.text).join("\n");
  assert.match(sql, /user_area_subscriptions/u);
  assert.match(sql, /area_subscription_id/u);
  assert.match(sql, /'area_watch'/u);
  assert.match(sql, /'none'/u);
  assert.match(sql, /見守りエリアに新しい記録/u);
  assert.match(sql, /s\.user_id <> v\.user_id/u);
  assert.match(sql, /savepoint area_watch_notification_dispatch/iu);
  assert.match(sql, /release savepoint area_watch_notification_dispatch/iu);
});

test("emitAreaWatchNotificationForObservation restores the caller transaction after a write error", async () => {
  const history: Query[] = [];
  let transactionAborted = false;
  const client = {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (/insert into alert_deliveries/iu.test(text) && /'area_watch'/iu.test(text)) {
        transactionAborted = true;
        throw new Error("area_watch_write_failed");
      }
      if (text.includes("rollback to savepoint area_watch_notification_dispatch")) {
        transactionAborted = false;
        return { rows: [] };
      }
      if (transactionAborted) throw new Error("transaction_aborted");
      return { rows: [] };
    },
  } as unknown as import("pg").PoolClient;

  await assert.rejects(
    emitAreaWatchNotificationForObservation({
      occurrenceId: "write-error-occurrence",
      visitId: "write-error-visit",
    }, client),
    /area_watch_write_failed/u,
  );
  await client.query("select after_area_watch_write_error");
  assert.equal(transactionAborted, false);
  assert.match(history.map((query) => query.text).join("\n"), /rollback to savepoint area_watch_notification_dispatch/iu);
});

test("emitAreaWatchNotificationForObservation relies on idempotent conflict handling for replay", async () => {
  const history: Query[] = [];
  let areaWatchInsertCount = 0;
  const client = {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (/insert into alert_deliveries/iu.test(text) && /'area_watch'/iu.test(text)) {
        areaWatchInsertCount += 1;
        return { rows: areaWatchInsertCount === 1 ? [{ delivery_id: "delivery-1" }] : [] };
      }
      return { rows: [] };
    },
  } as unknown as import("pg").PoolClient;

  const first = await emitAreaWatchNotificationForObservation({ occurrenceId: "occ-replay", visitId: "visit-replay" }, client);
  const replay = await emitAreaWatchNotificationForObservation({ occurrenceId: "occ-replay", visitId: "visit-replay" }, client);

  assert.equal(first.areaWatchNotifications, 1);
  assert.equal(replay.areaWatchNotifications, 0);
  assert.equal(areaWatchInsertCount, 2);
  assert.match(history.map((query) => query.text).join("\n"), /on conflict \(occurrence_id, user_id, area_subscription_id, trigger_kind\)/iu);
});

test("emitAreaWatchNotificationForObservation ignores blank ids", async () => {
  const history: Query[] = [];
  const summary = await emitAreaWatchNotificationForObservation({
    occurrenceId: " ",
    visitId: "visit-1",
  }, makeMockClient(history));
  assert.deepEqual(summary, { areaWatchNotifications: 0 });
  assert.equal(history.length, 0);
});

test("ensureAreaWatchParticipationForVisit auto-follows fields from a participant visit", async () => {
  const history: Query[] = [];
  const summary = await ensureAreaWatchParticipationForVisit(
    { visitId: "visit-1" },
    makeMockClient(history, [{ delivery_id: "subscription-1" }]),
  );

  assert.equal(summary.followedAreas, 1);
  const sql = history.map((query) => query.text).join("\n");
  assert.match(sql, /insert into user_area_subscriptions/u);
  assert.match(sql, /resolved_field_ids/u);
  assert.match(sql, /\/map\?field=/u);
  assert.match(sql, /\/map\?place=/u);
  assert.match(sql, /on conflict \(user_id, target_type, target_id\)/u);
  assert.deepEqual(history[0]?.values, ["visit-1"]);
});
