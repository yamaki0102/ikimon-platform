import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { legacyImportDisplayName, loadLegacyImportNames, pickLegacyImportName, resolveWeakLabels } from "./legacyImportNames";

function sqliteDb(sqlite: DatabaseSync, seen: string[] = []) {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async all<T>() {
          seen.push(query);
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt;
    },
  };
}

function seed() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE production_import_occurrences (occurrence_id TEXT PRIMARY KEY, visit_id TEXT, scientific_name TEXT, vernacular_name TEXT, taxon_rank TEXT, confidence_score REAL, quality_grade TEXT, created_at TEXT, updated_at TEXT);
    INSERT INTO production_import_occurrences VALUES
      ('occ:v1:0','v1',NULL,NULL,NULL,NULL,NULL,'2020-01-01',NULL),
      ('occ:v1:1','v1','Parus minor','シジュウカラ','species',0.4,'needs_id','2020-01-02',NULL),
      ('occ:v1:2','v1','Passer montanus','スズメ','species',0.3,'research','2020-01-03',NULL),
      ('occ:v2:0','v2',NULL,'','',NULL,NULL,'2020-01-01',NULL),
      ('occ:v2:1','v2','unidentified','unknown',NULL,0.9,'research','2020-01-02',NULL),
      ('occ:v3:0','v3',NULL,NULL,NULL,NULL,NULL,'2020-01-01',NULL),
      ('occ:v3:1','v3','Corvus macrorhynchos',NULL,'species',0.5,'needs_id','2020-01-02',NULL),
      ('occ:v3:2','v3',NULL,'ハシブトガラス','species',0.8,'needs_id','2020-01-03',NULL),
      ('occ:v4:1','v4',NULL,'メジロ','species',NULL,NULL,'2020-01-05',NULL),
      ('occ:v4:2','v4',NULL,'ヒヨドリ','species',NULL,NULL,'2020-01-04',NULL);
  `);
  return sqlite;
}

test("research-grade name wins over higher confidence; nameless rows ignored", async (t) => {
  const sqlite = seed();
  t.after(() => sqlite.close());
  const map = await loadLegacyImportNames(sqliteDb(sqlite), ["v1", "v3"]);
  assert.deepEqual(map.get("v1"), { vernacularName: "スズメ", scientificName: "Passer montanus", rank: "species" });
  assert.deepEqual(map.get("v3"), { vernacularName: "ハシブトガラス", scientificName: null, rank: "species" });
});

test("ties on grade and confidence fall back to oldest created_at; all-nameless yields none", async (t) => {
  const sqlite = seed();
  t.after(() => sqlite.close());
  const map = await loadLegacyImportNames(sqliteDb(sqlite), ["v2", "v4", "missing"]);
  assert.equal(map.has("v2"), false);
  assert.equal(map.has("missing"), false);
  assert.equal(legacyImportDisplayName(map.get("v4")), "ヒヨドリ");
  assert.equal(pickLegacyImportName([]), null);
  assert.equal(legacyImportDisplayName({ vernacularName: null, scientificName: "Parus minor", rank: null }), "Parus minor");
});

test("ids are chunked at 90 per query and query errors return an empty map", async (t) => {
  const sqlite = seed();
  t.after(() => sqlite.close());
  const seen: string[] = [];
  const ids = Array.from({ length: 200 }, (_, i) => `x${i}`).concat("v1");
  const map = await loadLegacyImportNames(sqliteDb(sqlite, seen), ids);
  assert.equal(seen.length, 3);
  assert.ok(seen.every((q) => (q.match(/\?/g) ?? []).length <= 90));
  assert.equal(legacyImportDisplayName(map.get("v1")), "スズメ");
  const broken = new DatabaseSync(":memory:");
  t.after(() => broken.close());
  assert.equal((await loadLegacyImportNames(sqliteDb(broken), ["v1"])).size, 0);
  assert.equal((await loadLegacyImportNames(sqliteDb(sqlite), [])).size, 0);
});

test("resolveWeakLabels only looks up weak labels", async (t) => {
  const sqlite = seed();
  t.after(() => sqlite.close());
  const seen: string[] = [];
  const out = await resolveWeakLabels(sqliteDb(sqlite, seen), [
    { id: "v1", label: "unidentified" },
    { id: "v3", label: "カワセミ" },
    { id: "v4", label: null },
  ]);
  assert.deepEqual([...out.entries()].sort(), [["v1", "スズメ"], ["v4", "ヒヨドリ"]]);
  const none = await resolveWeakLabels(sqliteDb(sqlite, seen), [{ id: "v3", label: "カワセミ" }]);
  assert.equal(none.size, 0);
  assert.equal(seen.length, 1);
});
