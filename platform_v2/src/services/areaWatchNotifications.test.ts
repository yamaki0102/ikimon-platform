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
  const client = makeMockClient(history, [{ delivery_id: "delivery-1" }]);
  const summary = await emitAreaWatchNotificationForObservation({
    occurrenceId: "occ-1",
    visitId: "visit-1",
  }, client);

  assert.equal(summary.areaWatchNotifications, 1);
  const sql = history.map((q) => q.text).join("\n");
  assert.match(sql, /user_area_subscriptions/);
  assert.match(sql, /area_subscription_id/);
  assert.match(sql, /'area_watch'/);
  assert.match(sql, /'none'/);
  assert.match(sql, /見守りエリアに新しい記録/);
  assert.match(sql, /s\.user_id <> v\.user_id/);
  assert.deepEqual(history[0]?.values, ["occ-1", "visit-1"]);
});

test("emitAreaWatchNotificationForObservation ignores blank ids", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history);
  const summary = await emitAreaWatchNotificationForObservation({
    occurrenceId: " ",
    visitId: "visit-1",
  }, client);
  assert.equal(summary.areaWatchNotifications, 0);
  assert.equal(history.length, 0);
});

test("ensureAreaWatchParticipationForVisit auto-follows fields from a participant visit", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history, [{ delivery_id: "subscription-1" }]);
  const summary = await ensureAreaWatchParticipationForVisit({ visitId: "visit-1" }, client);

  assert.equal(summary.followedAreas, 1);
  const sql = history.map((q) => q.text).join("\n");
  assert.match(sql, /insert into user_area_subscriptions/);
  assert.match(sql, /resolved_field_ids/);
  assert.match(sql, /\/map\?field=/);
  assert.match(sql, /\/map\?place=/);
  assert.match(sql, /on conflict \(user_id, target_type, target_id\)/);
  assert.deepEqual(history[0]?.values, ["visit-1"]);
});
