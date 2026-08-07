import assert from "node:assert/strict";
import test from "node:test";
import { emitAlertsForOccurrence } from "./alertDispatcher.js";

type Query = { text: string; values: unknown[] };

function makeExplodingClient(history: Query[]) {
  return {
    query: async (text: string, values?: unknown[]) => {
      history.push({ text, values: values ?? [] });
      throw new Error("retired_postgresql_alert_dispatch_must_not_query");
    },
  } as unknown as import("pg").PoolClient;
}

test("managed Kubiaka context is denied before the retired PostgreSQL dispatcher", async () => {
  const summary = await emitAlertsForOccurrence({
    occurrenceId: "00000000-0000-0000-0000-000000000101",
    visitId: "00000000-0000-0000-0000-000000000102",
    invasiveStatus: "iaspecified",
    scientificName: "Aromia bungii (Faldermann, 1835)",
    vernacularName: "クビアカツヤカミキリ",
    prefecture: "静岡県",
    municipality: "浜松市",
    noveltyScore: 0.99,
    isRare: true,
  });

  assert.equal(summary.blockedReason, "experience_managed_taxon_denied");
  assert.equal(summary.managedTaxonScopeKey, "kubiaka-watch");
  assert.equal(summary.areaWatchNotifications, 0);
  assert.equal(summary.municipalityInvasive, 0);
  assert.equal(summary.researcherInvasive, 0);
  assert.equal(summary.researcherRare, 0);
  assert.equal(summary.researcherNovelty, 0);
  assert.equal(summary.userTaxonMatches, 0);
});

test("managed synonym remains denied during link_pending", async () => {
  const history: Query[] = [];
  const summary = await emitAlertsForOccurrence(
    {
      occurrenceId: "00000000-0000-0000-0000-000000000103",
      visitId: "00000000-0000-0000-0000-000000000104",
      invasiveStatus: "priority",
      scientificName: "Callichroma ruficolle Redtenbacher, 1868",
      vernacularName: "クビアカツヤカミキリ",
      experienceRecordLinkState: "link_pending",
    },
    makeExplodingClient(history),
  );

  assert.equal(summary.blockedReason, "experience_managed_taxon_denied");
  assert.equal(summary.managedTaxonScopeKey, "kubiaka-watch");
  assert.equal(summary.areaWatchNotifications, 0);
  assert.deepEqual(history, []);
});

test("unmanaged context fails closed without invoking retired PostgreSQL notification SQL", async () => {
  const history: Query[] = [];
  const summary = await emitAlertsForOccurrence(
    {
      occurrenceId: "00000000-0000-0000-0000-000000000105",
      visitId: "00000000-0000-0000-0000-000000000106",
      invasiveStatus: "iaspecified",
      scientificName: "Procyon lotor",
      vernacularName: "アライグマ",
      municipality: "浜松市",
      noveltyScore: 0.99,
      isRare: true,
    },
    makeExplodingClient(history),
  );

  assert.deepEqual(summary, {
    areaWatchNotifications: 0,
    municipalityInvasive: 0,
    invasiveReportingMatched: 0,
    invasiveReportingSuppressed: 0,
    researcherInvasive: 0,
    researcherRare: 0,
    researcherNovelty: 0,
    userTaxonMatches: 0,
    blockedReason: "notification_gate_unavailable",
    managedTaxonScopeKey: null,
  });
  assert.deepEqual(history, []);
});

test("unresolved identity also fails closed before any legacy delivery write", async () => {
  const history: Query[] = [];
  const summary = await emitAlertsForOccurrence(
    {
      occurrenceId: "00000000-0000-0000-0000-000000000107",
      visitId: "00000000-0000-0000-0000-000000000108",
      invasiveStatus: null,
      scientificName: null,
      vernacularName: "未同定",
    },
    makeExplodingClient(history),
  );

  assert.equal(summary.blockedReason, "notification_gate_unavailable");
  assert.equal(summary.areaWatchNotifications, 0);
  assert.equal(summary.managedTaxonScopeKey, null);
  assert.deepEqual(history, []);
});
