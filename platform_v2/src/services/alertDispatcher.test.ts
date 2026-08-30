import assert from "node:assert/strict";
import test from "node:test";
import { emitAlertsForOccurrence } from "./alertDispatcher.js";

type Query = { text: string; values: unknown[] };

function makeMockClient(history: Query[]) {
  return {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      return { rows: [] as Array<{ recipient_id?: string; subscription_id?: string }> };
    },
  } as unknown as import("pg").PoolClient;
}

test("emitAlertsForOccurrence replays Area Watch idempotently", async () => {
  const history: Query[] = [];
  let areaWatchInsertAttempts = 0;
  const client = {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (/insert into alert_deliveries/iu.test(text) && /'area_watch'/iu.test(text)) {
        areaWatchInsertAttempts += 1;
        return { rows: areaWatchInsertAttempts === 1 ? [{ delivery_id: "area-watch-1" }] : [] };
      }
      return { rows: [] };
    },
  } as unknown as import("pg").PoolClient;
  const context = {
    occurrenceId: "00000000-0000-0000-0000-000000000115",
    visitId: "00000000-0000-0000-0000-000000000116",
    invasiveStatus: null,
    scientificName: null,
    vernacularName: "アライグマ",
  };

  const first = await emitAlertsForOccurrence(context, client);
  const replay = await emitAlertsForOccurrence(context, client);

  assert.equal(first.areaWatchNotifications, 1);
  assert.equal(replay.areaWatchNotifications, 0);
  assert.equal(areaWatchInsertAttempts, 2);
  assert.match(history.map((query) => query.text).join("\n"), /on conflict \(occurrence_id, user_id, area_subscription_id, trigger_kind\)/iu);
});

test("emitAlertsForOccurrence keeps general alerts available after an Area Watch write error", async () => {
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

  const summary = await emitAlertsForOccurrence({
    occurrenceId: "00000000-0000-0000-0000-000000000117",
    visitId: "00000000-0000-0000-0000-000000000118",
    invasiveStatus: "iaspecified",
    scientificName: "Procyon lotor",
    vernacularName: "アライグマ",
    genus: "Procyon",
    family: "Procyonidae",
    prefecture: "東京都",
    municipality: "町田市",
  }, client);

  assert.equal(summary.areaWatchNotifications, 0);
  assert.equal(transactionAborted, false);
  const allText = history.map((query) => query.text).join("\n");
  assert.match(allText, /rollback to savepoint area_watch_notification_dispatch/iu);
  assert.match(allText, /invasive_reporting_rules/iu);
  assert.match(allText, /alert_recipients/iu);
  assert.match(allText, /taxon_alert_subscriptions/iu);
});

test("emitAlertsForOccurrence runs invasive and researcher matching", async () => {
  const history: Query[] = [];
  const summary = await emitAlertsForOccurrence({
    occurrenceId: "00000000-0000-0000-0000-000000000001",
    visitId: "00000000-0000-0000-0000-000000000002",
    invasiveStatus: "iaspecified",
    scientificName: "Procyon lotor",
    vernacularName: "アライグマ",
    genus: "Procyon",
    family: "Procyonidae",
    orderName: "Carnivora",
    className: "Mammalia",
    prefecture: "東京都",
    municipality: "町田市",
  }, makeMockClient(history));

  assert.equal(summary.municipalityInvasive, 0);
  assert.equal(summary.invasiveReportingMatched, 0);
  const allText = history.map((query) => query.text).join("\n");
  assert.match(allText, /invasive_reporting_rules/u);
  assert.match(allText, /alert_recipients/u);
  assert.match(allText, /researcher/u);
  assert.match(allText, /taxon_alert_subscriptions/u);
  assert.match(allText, /'area_watch'/u);
});

test("emitAlertsForOccurrence does not run invasive reporting for native subjects", async () => {
  const history: Query[] = [];
  await emitAlertsForOccurrence({
    occurrenceId: "00000000-0000-0000-0000-000000000003",
    visitId: "00000000-0000-0000-0000-000000000004",
    invasiveStatus: "native",
    scientificName: "Cerasus jamasakura",
    vernacularName: "ヤマザクラ",
    prefecture: "東京都",
    municipality: "町田市",
  }, makeMockClient(history));

  assert.doesNotMatch(history.map((query) => query.text).join("\n"), /invasive_reporting_rules/u);
});

test("emitAlertsForOccurrence applies the general novelty threshold", async () => {
  const belowHistory: Query[] = [];
  await emitAlertsForOccurrence({
    occurrenceId: "00000000-0000-0000-0000-000000000005",
    visitId: "00000000-0000-0000-0000-000000000006",
    invasiveStatus: null,
    scientificName: "Some species",
    vernacularName: "なんとか種",
    noveltyScore: 0.3,
  }, makeMockClient(belowHistory));
  assert.equal(belowHistory.some((query) => query.values.includes("novelty")), false);

  const aboveHistory: Query[] = [];
  await emitAlertsForOccurrence({
    occurrenceId: "00000000-0000-0000-0000-000000000007",
    visitId: "00000000-0000-0000-0000-000000000008",
    invasiveStatus: null,
    scientificName: "Mystery sp.",
    vernacularName: "なぞ生物",
    noveltyScore: 0.8,
  }, makeMockClient(aboveHistory));
  assert.equal(aboveHistory.some((query) => query.values.includes("novelty")), true);
});
