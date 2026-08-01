import assert from "node:assert/strict";
import test from "node:test";
import {
  emitAreaWatchNotificationForObservation,
  ensureAreaWatchParticipationForVisit,
} from "./areaWatchNotifications.js";

type Query = { text: string; values: unknown[] };

function makeMockClient(
  history: Query[],
  rows: Array<{ delivery_id: string }> = [],
  canonicalScientificName: string | null = "Procyon lotor",
) {
  return {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (text.includes("notification_gate_canonical_taxon")) {
        return { rows: [{ scientific_name: canonicalScientificName }] };
      }
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
  const canonicalGateQuery = history.find((query) => query.text.includes("notification_gate_canonical_taxon"));
  assert.deepEqual(canonicalGateQuery?.values, ["occ-1", "visit-1"]);
});

test("emitAreaWatchNotificationForObservation blocks Kubiaka before any area_watch delivery row", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history, [{ delivery_id: "should-not-exist" }], "Aromia bungii");
  const first = await emitAreaWatchNotificationForObservation({
    occurrenceId: "kubiaka-occurrence",
    visitId: "kubiaka-visit",
  }, client);
  const replay = await emitAreaWatchNotificationForObservation({
    occurrenceId: "kubiaka-occurrence",
    visitId: "kubiaka-visit",
  }, client);

  assert.deepEqual(first, {
    areaWatchNotifications: 0,
    blockedReason: "managed_taxon_gate_denied",
  });
  assert.deepEqual(replay, first);
  assert.equal(history.filter((query) => query.text.includes("notification_gate_canonical_taxon")).length, 2, "each retry may re-read the canonical gate but must not write");
  const sql = history.map((query) => query.text).join("\n");
  assert.doesNotMatch(sql, /insert into alert_deliveries/i);
  assert.doesNotMatch(sql, /'area_watch'|'sent'|delivered_at/i);
});

test("emitAreaWatchNotificationForObservation fails closed when species identity is unavailable", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history, [{ delivery_id: "should-not-exist" }], null);
  const summary = await emitAreaWatchNotificationForObservation({
    occurrenceId: "unknown-occurrence",
    visitId: "unknown-visit",
  }, client);

  assert.deepEqual(summary, {
    areaWatchNotifications: 0,
    blockedReason: "species_unresolved",
  });
  assert.doesNotMatch(history.map((query) => query.text).join("\n"), /insert into alert_deliveries/i);
});

test("emitAreaWatchNotificationForObservation fails closed on the canonical species read error", async () => {
  const history: Query[] = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      throw new Error("db_read_failed");
    },
  } as unknown as import("pg").PoolClient;
  const summary = await emitAreaWatchNotificationForObservation({
    occurrenceId: "error-occurrence",
    visitId: "error-visit",
  }, client);

  assert.deepEqual(summary, {
    areaWatchNotifications: 0,
    blockedReason: "notification_gate_error",
  });
  assert.match(history.map((query) => query.text).join("\n"), /rollback to savepoint notification_gate_read/i);
  assert.doesNotMatch(history.map((query) => query.text).join("\n"), /insert into alert_deliveries/i);
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
