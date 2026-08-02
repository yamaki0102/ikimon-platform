import assert from "node:assert/strict";
import test from "node:test";
import {
  emitAreaWatchNotificationForObservation,
  ensureAreaWatchParticipationForVisit,
} from "./areaWatchNotifications.js";

type Query = { text: string; values: unknown[] };
type CanonicalTaxonRow = {
  scientific_name: string | null;
  occurrence_scientific_name?: string | null;
  persisted_scientific_name?: string | null;
};

function asCanonicalRow(value: string | null | CanonicalTaxonRow): CanonicalTaxonRow {
  if (typeof value === "object" && value !== null) return value;
  return {
    scientific_name: value,
    occurrence_scientific_name: value,
    persisted_scientific_name: null,
  };
}

function makeMockClient(
  history: Query[],
  rows: Array<{ delivery_id: string }> = [],
  canonicalScientificName: string | null | CanonicalTaxonRow = "Procyon lotor",
) {
  return {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (text.includes("notification_gate_canonical_taxon")) {
        return { rows: [asCanonicalRow(canonicalScientificName)] };
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
  assert.equal(summary.blockedReason, null);
  const sql = history.map((q) => q.text).join("\n");
  assert.match(sql, /user_area_subscriptions/);
  assert.match(sql, /area_subscription_id/);
  assert.match(sql, /'area_watch'/);
  assert.match(sql, /'none'/);
  assert.match(sql, /見守りエリアに新しい記録/);
  assert.match(sql, /s\.user_id <> v\.user_id/);
  const canonicalGateQuery = history.find((query) => query.text.includes("notification_gate_canonical_taxon"));
  assert.deepEqual(canonicalGateQuery?.values, ["occ-1", "visit-1"]);
  assert.match(sql, /savepoint area_watch_notification_dispatch/i);
  assert.match(sql, /release savepoint area_watch_notification_dispatch/i);
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
    managedTaxonScopeKey: "kubiaka-watch",
  });
  assert.deepEqual(replay, first);
  assert.equal(history.filter((query) => query.text.includes("notification_gate_canonical_taxon")).length, 2, "each retry may re-read the canonical gate but must not write");
  const sql = history.map((query) => query.text).join("\n");
  assert.doesNotMatch(sql, /insert into alert_deliveries/i);
  assert.doesNotMatch(sql, /'area_watch'|'sent'|delivered_at/i);
});

test("emitAreaWatchNotificationForObservation blocks persisted managed identity over original unmanaged identity", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history, [{ delivery_id: "should-not-exist" }], {
    scientific_name: "Aromia bungii",
    occurrence_scientific_name: "Procyon lotor",
    persisted_scientific_name: "Aromia bungii",
  });
  const summary = await emitAreaWatchNotificationForObservation({
    occurrenceId: "corrected-kubiaka-occurrence",
    visitId: "corrected-kubiaka-visit",
  }, client);

  assert.deepEqual(summary, {
    areaWatchNotifications: 0,
    blockedReason: "managed_taxon_gate_denied",
    managedTaxonScopeKey: "kubiaka-watch",
  });
  assert.doesNotMatch(history.map((query) => query.text).join("\n"), /insert into alert_deliveries/i);
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
    managedTaxonScopeKey: null,
  });
  assert.doesNotMatch(history.map((query) => query.text).join("\n"), /insert into alert_deliveries/i);
});

test("emitAreaWatchNotificationForObservation fails closed on the canonical species read error", async () => {
  const history: Query[] = [];
  let transactionAborted = false;
  const client = {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (text.includes("notification_gate_canonical_taxon")) {
        transactionAborted = true;
        throw new Error("db_read_failed");
      }
      if (text.includes("rollback to savepoint notification_gate_read")) {
        transactionAborted = false;
        return { rows: [] };
      }
      if (transactionAborted) throw new Error("transaction_aborted");
      return { rows: [] };
    },
  } as unknown as import("pg").PoolClient;
  const summary = await emitAreaWatchNotificationForObservation({
    occurrenceId: "error-occurrence",
    visitId: "error-visit",
  }, client);

  assert.deepEqual(summary, {
    areaWatchNotifications: 0,
    blockedReason: "notification_gate_error",
    managedTaxonScopeKey: null,
  });
  assert.match(history.map((query) => query.text).join("\n"), /rollback to savepoint notification_gate_read/i);
  assert.doesNotMatch(history.map((query) => query.text).join("\n"), /insert into alert_deliveries/i);
  await client.query("select after_gate_error");
  assert.equal(transactionAborted, false);
});

test("emitAreaWatchNotificationForObservation restores caller transaction after write error", async () => {
  const history: Query[] = [];
  let transactionAborted = false;
  const client = {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (text.includes("notification_gate_canonical_taxon")) {
        return { rows: [asCanonicalRow("Procyon lotor")] };
      }
      if (/insert into alert_deliveries/i.test(text) && /'area_watch'/i.test(text)) {
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
    /area_watch_write_failed/,
  );
  await client.query("select after_area_watch_write_error");
  assert.equal(transactionAborted, false);
  const sql = history.map((query) => query.text).join("\n");
  assert.match(sql, /rollback to savepoint area_watch_notification_dispatch/i);
});

test("emitAreaWatchNotificationForObservation relies on idempotent conflict handling for replay", async () => {
  const history: Query[] = [];
  let areaWatchInsertCount = 0;
  const client = {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (text.includes("notification_gate_canonical_taxon")) {
        return { rows: [asCanonicalRow({
          scientific_name: "Procyon lotor",
          occurrence_scientific_name: null,
          persisted_scientific_name: "Procyon lotor",
        })] };
      }
      if (/insert into alert_deliveries/i.test(text) && /'area_watch'/i.test(text)) {
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
  assert.match(history.map((query) => query.text).join("\n"), /on conflict \(occurrence_id, user_id, area_subscription_id, trigger_kind\)/i);
});

test("emitAreaWatchNotificationForObservation ignores blank ids", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history);
  const summary = await emitAreaWatchNotificationForObservation({
    occurrenceId: " ",
    visitId: "visit-1",
  }, client);
  assert.deepEqual(summary, {
    areaWatchNotifications: 0,
    blockedReason: null,
    managedTaxonScopeKey: null,
  });
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
