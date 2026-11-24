import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  backfillRecordHealthGaps,
  listRecordHealthHistory,
  normalizeMunicipalityLabel,
  runRecordHealthCheck
} from "./recordHealthCheck";
import type { Env } from "./core/env";

function makeFakeDb(sqlite: DatabaseSync) {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async first() {
          return sqlite.prepare(query).get(...(values as never[])) ?? null;
        },
        async all() {
          return { results: sqlite.prepare(query).all(...(values as never[])) };
        },
        async run() {
          const info = sqlite.prepare(query).run(...(values as never[]));
          return { meta: { changes: Number(info.changes) } };
        }
      };
      return stmt;
    }
  };
}

test("recordHealthCheck counts missing area, missing taxon, and mismatch awaiting, and backfills additively", async () => {
  const obsDb = new DatabaseSync(":memory:");
  const coreDb = new DatabaseSync(":memory:");
  obsDb.exec(`
    CREATE TABLE observations (
      observation_id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      observed_at TEXT,
      taxon_label TEXT,
      exact_lat REAL,
      exact_lng REAL,
      public_cell TEXT,
      visibility TEXT,
      emergency_hidden INTEGER DEFAULT 0,
      public_area_label TEXT,
      updated_at TEXT
    );
    CREATE TABLE readmodel_public_observations (
      observation_id TEXT PRIMARY KEY,
      public_cell TEXT,
      observed_at TEXT,
      taxon_label TEXT,
      asset_count INTEGER,
      public_area_label TEXT,
      updated_at TEXT
    );
    CREATE TABLE observation_identifications (
      identification_id TEXT PRIMARY KEY,
      occurrence_id TEXT,
      proposed_name TEXT,
      stance TEXT,
      is_current INTEGER,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE observation_ai_review_targets (
      occurrence_id TEXT PRIMARY KEY,
      candidate_vernacular_name TEXT,
      candidate_scientific_name TEXT,
      ai_recommended_taxon_name TEXT
    );
  `);

  // 1) Mismatch: readmodel is '同定待ち', observations has 'リュウキュウメジロ', missing area
  obsDb.prepare(
    "INSERT INTO observations VALUES ('rec-1', 'u1', '2026-05-21T01:00:00Z', 'リュウキュウメジロ', 26.21, 127.68, '26.21,127.68', 'public', 0, NULL, NULL)"
  ).run();
  obsDb.prepare(
    "INSERT INTO readmodel_public_observations VALUES ('rec-1', '26.21,127.68', '2026-05-21T01:00:00Z', '同定待ち', 1, NULL, NULL)"
  ).run();

  // 2) Missing taxon everywhere, has area
  obsDb.prepare(
    "INSERT INTO observations VALUES ('rec-2', 'u1', '2026-05-22T01:00:00Z', NULL, 26.22, 127.69, '26.22,127.69', 'public', 0, '沖縄県浦添市', NULL)"
  ).run();
  obsDb.prepare(
    "INSERT INTO readmodel_public_observations VALUES ('rec-2', '26.22,127.69', '2026-05-22T01:00:00Z', NULL, 1, '沖縄県浦添市', NULL)"
  ).run();

  // 3) Mismatch via observation_identifications, missing area
  obsDb.prepare(
    "INSERT INTO observations VALUES ('rec-3', 'u1', '2026-05-23T01:00:00Z', NULL, 26.23, 127.70, '26.23,127.70', 'public', 0, NULL, NULL)"
  ).run();
  obsDb.prepare(
    "INSERT INTO readmodel_public_observations VALUES ('rec-3', '26.23,127.70', '2026-05-23T01:00:00Z', '名前待ち', 1, NULL, NULL)"
  ).run();
  obsDb.prepare(
    "INSERT INTO observation_identifications VALUES ('id-3', 'occ:rec-3:0', 'オキナワキノボリトカゲ', 'propose', 1, '2026-05-23T02:00:00Z', '2026-05-23T02:00:00Z')"
  ).run();

  const env = { OBS_DB: makeFakeDb(obsDb), CORE_DB: makeFakeDb(coreDb) } as unknown as Env;
  const before = await runRecordHealthCheck(env, new Date("2026-11-24T00:00:00Z"));
  assert.equal(before.totalPublic, 3);
  assert.equal(before.missingAreaLabel, 2);
  assert.equal(before.taxonMismatchAwaiting, 2);
  assert.equal(before.missingTaxonEverywhere, 1);

  assert.equal(normalizeMunicipalityLabel("沖縄県那覇市1-2-3"), null);
  assert.equal(normalizeMunicipalityLabel("沖縄県那覇市"), "沖縄県那覇市");

  const bf = await backfillRecordHealthGaps(env, {
    limit: 50,
    resolveMunicipality: async () => "沖縄県那覇市"
  });
  assert.equal(bf.backfilledTaxon, 2);
  assert.equal(bf.backfilledArea, 2);

  const after = await runRecordHealthCheck(env, new Date("2026-11-24T01:00:00Z"));
  assert.equal(after.missingAreaLabel, 0);
  assert.equal(after.taxonMismatchAwaiting, 0);
  assert.equal(after.missingTaxonEverywhere, 1);

  // Existing area label on rec-2 was preserved, not overwritten
  const rec2 = obsDb.prepare("SELECT public_area_label FROM readmodel_public_observations WHERE observation_id = 'rec-2'").get() as { public_area_label: string };
  assert.equal(rec2.public_area_label, "沖縄県浦添市");

  const history = await listRecordHealthHistory(env, 10);
  assert.equal(history.length, 1);
  assert.equal(history[0]!.snapshot_date, "2026-11-24");
});
