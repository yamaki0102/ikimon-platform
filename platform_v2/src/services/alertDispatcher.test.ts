import assert from "node:assert/strict";
import test from "node:test";
import { emitAlertsForOccurrence } from "./alertDispatcher.js";

/**
 * DB なしのスモーク。pg client が無い状態で呼ばれた場合も
 * dispatcher 側のロジック (invasive trigger 判定 / novelty 閾値 / candidate 生成)
 * は確認したいが、SQL 自体は実行できない。
 *
 * このテストでは、PoolClient のモックを差し込み、queries 履歴を assert する。
 */

type Query = { text: string; values: unknown[] };

function makeMockClient(history: Query[]) {
  return {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      return { rows: [] as Array<{ recipient_id?: string; subscription_id?: string }> };
    },
  } as unknown as import("pg").PoolClient;
}

test("emitAlertsForOccurrence: in-trigger invasive issues municipality + researcher inserts", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history);
  const summary = await emitAlertsForOccurrence(
    {
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
    },
    client,
  );
  assert.equal(summary.municipalityInvasive, 0); // mock returns no rows
  // SQL がそれぞれ走った形跡があれば良い
  const allText = history.map((q) => q.text).join("\n");
  assert.match(allText, /alert_recipients/);
  assert.match(allText, /municipality_invasive/);
  assert.match(allText, /researcher/);
  assert.match(allText, /taxon_alert_subscriptions/);
});

test("emitAlertsForOccurrence: native subject does NOT emit municipality_invasive", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history);
  await emitAlertsForOccurrence(
    {
      occurrenceId: "00000000-0000-0000-0000-000000000003",
      visitId: "00000000-0000-0000-0000-000000000004",
      invasiveStatus: "native",
      scientificName: "Cerasus jamasakura",
      vernacularName: "ヤマザクラ",
      prefecture: "東京都",
      municipality: "町田市",
    },
    client,
  );
  const allText = history.map((q) => q.text).join("\n");
  assert.doesNotMatch(allText, /municipality_invasive/);
});

test("emitAlertsForOccurrence: novelty_score below 0.5 does not emit researcher novelty", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history);
  await emitAlertsForOccurrence(
    {
      occurrenceId: "00000000-0000-0000-0000-000000000005",
      visitId: "00000000-0000-0000-0000-000000000006",
      invasiveStatus: null,
      scientificName: "Some species",
      vernacularName: "なんとか種",
      noveltyScore: 0.3,
    },
    client,
  );
  const inserted = history.filter((q) => /INSERT INTO alert_deliveries/.test(q.text));
  const noveltyInsert = inserted.find((q) => q.values.some((v) => v === "novelty"));
  assert.equal(noveltyInsert, undefined);
});

test("emitAlertsForOccurrence: novelty_score >= 0.5 emits researcher novelty trigger", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history);
  await emitAlertsForOccurrence(
    {
      occurrenceId: "00000000-0000-0000-0000-000000000007",
      visitId: "00000000-0000-0000-0000-000000000008",
      invasiveStatus: null,
      scientificName: "Mystery sp.",
      vernacularName: "なぞ生物",
      noveltyScore: 0.8,
    },
    client,
  );
  // novelty trigger query should reference 'novelty'
  const inserted = history.filter((q) => /INSERT INTO alert_deliveries/.test(q.text));
  const noveltyInsert = inserted.find((q) => q.values.some((v) => v === "novelty"));
  assert.ok(noveltyInsert, "expected novelty insert query");
});
