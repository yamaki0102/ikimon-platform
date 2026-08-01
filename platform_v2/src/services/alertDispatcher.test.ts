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

function makeMockClient(history: Query[], canonicalScientificName = "Procyon lotor") {
  return {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      if (text.includes("notification_gate_canonical_taxon")) {
        return { rows: [{ scientific_name: canonicalScientificName }] };
      }
      return { rows: [] as Array<{ recipient_id?: string; subscription_id?: string }> };
    },
  } as unknown as import("pg").PoolClient;
}

test("emitAlertsForOccurrence: managed taxon is denied before DB connection", async () => {
  const summary = await emitAlertsForOccurrence({
    occurrenceId: "00000000-0000-0000-0000-000000000101",
    visitId: "00000000-0000-0000-0000-000000000102",
    invasiveStatus: "iaspecified",
    scientificName: "Aromia bungii (Faldermann, 1835)",
    vernacularName: "クビアカツヤカミキリ",
    genus: "Aromia",
    family: "Cerambycidae",
    orderName: "Coleoptera",
    className: "Insecta",
    prefecture: "静岡県",
    municipality: "浜松市",
    noveltyScore: 0.99,
    isRare: true,
  });

  assert.deepEqual(summary, {
    municipalityInvasive: 0,
    invasiveReportingMatched: 0,
    invasiveReportingSuppressed: 0,
    researcherInvasive: 0,
    researcherRare: 0,
    researcherNovelty: 0,
    userTaxonMatches: 0,
    blockedReason: "experience_managed_taxon_denied",
    managedTaxonScopeKey: "kubiaka-watch",
  });
});

test("emitAlertsForOccurrence: managed synonym stays denied during link_pending", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history);
  const summary = await emitAlertsForOccurrence(
    {
      occurrenceId: "00000000-0000-0000-0000-000000000103",
      visitId: "00000000-0000-0000-0000-000000000104",
      invasiveStatus: "priority",
      scientificName: "Callichroma ruficolle Redtenbacher, 1868",
      vernacularName: "クビアカツヤカミキリ",
      genus: "Aromia",
      family: "Cerambycidae",
      orderName: "Coleoptera",
      className: "Insecta",
      prefecture: "静岡県",
      municipality: "浜松市",
      noveltyScore: 0.99,
      isRare: true,
      experienceRecordLinkState: "link_pending",
    },
    client,
  );

  assert.equal(summary.blockedReason, "experience_managed_taxon_denied");
  assert.equal(summary.managedTaxonScopeKey, "kubiaka-watch");
  assert.equal(history.length, 0, "managed taxon must not query or create delivery rows");
});

test("emitAlertsForOccurrence: canonical managed taxon cannot be hidden by an unmanaged context", async () => {
  const history: Query[] = [];
  const client = makeMockClient(history, "Aromia bungii");
  const summary = await emitAlertsForOccurrence(
    {
      occurrenceId: "00000000-0000-0000-0000-000000000105",
      visitId: "00000000-0000-0000-0000-000000000106",
      invasiveStatus: null,
      scientificName: "Procyon lotor",
      vernacularName: "アライグマ",
    },
    client,
  );
  assert.equal(summary.blockedReason, "experience_managed_taxon_denied");
  assert.equal(summary.managedTaxonScopeKey, "kubiaka-watch");
  assert.equal(history.length, 1);
  assert.doesNotMatch(history[0]?.text ?? "", /INSERT INTO alert_deliveries/i);
});

test("emitAlertsForOccurrence: canonical species read failure creates no delivery row", async () => {
  const history: Query[] = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      throw new Error("db_read_failed");
    },
  } as unknown as import("pg").PoolClient;
  const summary = await emitAlertsForOccurrence(
    {
      occurrenceId: "00000000-0000-0000-0000-000000000107",
      visitId: "00000000-0000-0000-0000-000000000108",
      invasiveStatus: "iaspecified",
      scientificName: "Procyon lotor",
      vernacularName: "アライグマ",
    },
    client,
  );
  assert.equal(summary.blockedReason, "notification_gate_error");
  assert.equal(history.length, 1);
  assert.doesNotMatch(history[0]?.text ?? "", /INSERT INTO alert_deliveries/i);
});

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
  assert.equal(summary.blockedReason, null);
  assert.equal(summary.municipalityInvasive, 0); // mock returns no rows
  assert.equal(summary.invasiveReportingMatched, 0);
  // SQL がそれぞれ走った形跡があれば良い
  const allText = history.map((q) => q.text).join("\n");
  assert.match(allText, /invasive_reporting_rules/);
  assert.match(allText, /alert_recipients/);
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
  assert.doesNotMatch(allText, /invasive_reporting_rules/);
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
