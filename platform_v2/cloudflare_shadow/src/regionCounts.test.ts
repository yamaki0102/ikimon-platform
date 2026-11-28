import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { listRegionAreasByRecords, loadAllRegionCounts, loadRegionCounts, regionHasPublicRecords } from "./regionCounts";
import { loadRegionIndex, loadRegionSurfaceData } from "./regionSurfaceV1";

const SCHEMA = `
  CREATE TABLE readmodel_public_observations (observation_id TEXT PRIMARY KEY, public_cell TEXT, observed_at TEXT, taxon_label TEXT, asset_count INTEGER DEFAULT 0, public_area_label TEXT);
  CREATE TABLE observation_data_rights (visit_id TEXT, withdrawal_status TEXT, record_consent TEXT);
  CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, visibility TEXT DEFAULT 'public', emergency_hidden INTEGER DEFAULT 0, taxon_label TEXT, note TEXT, created_at TEXT, observed_at TEXT);
  CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT, locality_label TEXT, place_kind TEXT, public_profile_status TEXT, superseded_by_place_id TEXT, municipality TEXT, prefecture TEXT, metadata_json TEXT);
`;

function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA);
  const ins = sqlite.prepare("INSERT INTO readmodel_public_observations (observation_id, public_cell, observed_at, taxon_label, public_area_label) VALUES (?,?,?,?,?)");
  const own = sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, visibility, emergency_hidden) VALUES (?,?,?,?)");
  const rows: Array<[string, string | null, string, number]> = [
    ["a1", "カワセミ", "public", 0], ["a2", "カワセミ", "public", 0], ["a3", "アオサギ", "public", 0],
    ["a4", null, "public", 0], ["a5", "不明", "public", 0], ["a6", "チョウ", "public", 0], ["a7", "アゲハチョウ科", "public", 0],
    ["a8", "ｶﾜｾﾐ", "public", 0],
    ["h1", "ヒドリガモ", "private", 0], ["h2", "ヒドリガモ", "public", 1], ["h3", "ヒドリガモ", "public", 0],
  ];
  for (const [id, label, vis, em] of rows) { ins.run(id, "34.70,137.70", "2026-11-01T01:00:00Z", label, "浜松市"); own.run(id, "u1", vis, em); }
  sqlite.prepare("INSERT INTO observation_data_rights VALUES (?,?,?)").run("h3", "withdrawn", null);
  ins.run("b1", "34.70,137.70", "2026-11-01T01:00:00Z", "ツバメ", "磐田市"); own.run("b1", "u1", "public", 0);
  sqlite.prepare("INSERT INTO observation_data_rights VALUES (?,?,?)").run("b1", "active", null);
  const pl = sqlite.prepare("INSERT INTO places VALUES (?,?,?,?,?,?,?,?,?)");
  pl.run("p1", "浜名湖", "静岡県浜松市", "park", "published", null, null, null, "{}");
  pl.run("p2", "下書き", "静岡県浜松市", "park", "draft", null, null, null, "{}");
  pl.run("p3", "置換済み", "静岡県浜松市", "park", "published", "p1", null, null, "{}");
  pl.run("p4", "他所", "静岡県磐田市", "park", "published", null, "磐田市", "静岡県", "{}");
  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { values = args; return stmt; },
        async first<T>() { return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null; },
        async all<T>() { return { results: sqlite.prepare(query).all(...(values as never[])) as T[] }; },
      };
      return stmt;
    },
  };
  return { sqlite, db };
}

const normalize = (v: string): string | null => v;

test("region counts follow one definition on list, city page and counts module", async (t) => {
  const { sqlite, db } = setup();
  t.after(() => sqlite.close());
  const counts = await loadRegionCounts(db, "浜松市");
  assert.deepEqual(counts, { records: 8, species: 2, places: 1, hiddenRecords: 0 });
  const all = await loadAllRegionCounts(db, normalize);
  const hamamatsu = all.find((i) => i.area === "浜松市")!;
  assert.equal(hamamatsu.records, counts.records);
  assert.equal(hamamatsu.species, counts.species);
  assert.equal(hamamatsu.places, counts.places);
  assert.equal(hamamatsu.prefecture, "静岡県");
  const index = (await loadRegionIndex(db, normalize)).find((i) => i.area === "浜松市")!;
  const page = await loadRegionSurfaceData(db, "浜松市", async () => new Map());
  assert.equal(index.records, page.recordTotal);
  assert.equal(index.places, page.placeTotal);
  assert.equal(page.recordTotal, 8);
  assert.equal(page.placeTotal, 1);
});

test("region helpers exclude hidden, withdrawn and emergency_hidden records", async (t) => {
  const { sqlite, db } = setup();
  t.after(() => sqlite.close());
  assert.equal(await regionHasPublicRecords(db, "浜松市"), true);
  assert.equal(await regionHasPublicRecords(db, "磐田市"), true);
  assert.equal(await regionHasPublicRecords(db, "存在しない市"), false);
  assert.deepEqual(await listRegionAreasByRecords(db, 10), ["浜松市", "磐田市"]);
  sqlite.prepare("UPDATE observations SET visibility = 'private' WHERE observation_id = 'b1'").run();
  assert.equal(await regionHasPublicRecords(db, "磐田市"), false);
});
