import assert from "node:assert/strict";
import test from "node:test";
import {
  emitAreaWatchNotificationForObservation,
  ensureAreaWatchParticipationForVisit,
} from "./areaWatchNotifications.js";

type Query = { text: string; values: unknown[] };

function makeBoundaryClient(history: Query[]) {
  return {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      return { rows: [] };
    },
  } as unknown as import("pg").PoolClient;
}

test("nonblank area-watch dispatch fails closed before retired PostgreSQL delivery SQL", async () => {
  const history: Query[] = [];
  const summary = await emitAreaWatchNotificationForObservation(
    { occurrenceId: "occ-1", visitId: "visit-1" },
    makeBoundaryClient(history),
  );

  assert.deepEqual(summary, {
    areaWatchNotifications: 0,
    blockedReason: "notification_gate_unavailable",
    managedTaxonScopeKey: null,
  });
  assert.equal(history.filter((query) => /insert into alert_deliveries/i.test(query.text)).length, 0);
  assert.match(history.map((query) => query.text).join("\n"), /savepoint area_watch_notification_dispatch/i);
});

test("Kubiaka area-watch retry remains closed in the retired adapter", async () => {
  const history: Query[] = [];
  const input = { occurrenceId: "kubiaka-occurrence", visitId: "kubiaka-visit" };
  const first = await emitAreaWatchNotificationForObservation(input, makeBoundaryClient(history));
  const replay = await emitAreaWatchNotificationForObservation(input, makeBoundaryClient(history));

  assert.deepEqual(first, {
    areaWatchNotifications: 0,
    blockedReason: "notification_gate_unavailable",
    managedTaxonScopeKey: null,
  });
  assert.deepEqual(replay, first);
  assert.equal(history.filter((query) => /insert into alert_deliveries/i.test(query.text)).length, 0);
});

test("blank area-watch identifiers are ignored without opening a database path", async () => {
  const history: Query[] = [];
  const summary = await emitAreaWatchNotificationForObservation(
    { occurrenceId: " ", visitId: "visit-1" },
    makeBoundaryClient(history),
  );

  assert.deepEqual(summary, {
    areaWatchNotifications: 0,
    blockedReason: null,
    managedTaxonScopeKey: null,
  });
  assert.deepEqual(history, []);
});

test("legacy participation helper keeps its explicit PostgreSQL compatibility contract", async () => {
  const history: Query[] = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      return { rows: [{ subscription_id: "subscription-1" }] };
    },
  } as unknown as import("pg").PoolClient;
  const summary = await ensureAreaWatchParticipationForVisit({ visitId: "visit-1" }, client);

  assert.equal(summary.followedAreas, 1);
  const sql = history.map((query) => query.text).join("\n");
  assert.match(sql, /insert into user_area_subscriptions/i);
  assert.match(sql, /resolved_field_ids/i);
  assert.match(sql, /on conflict \(user_id, target_type, target_id\)/i);
  assert.deepEqual(history[0]?.values, ["visit-1"]);
});
