import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { loadPlacePublicRecordsAndPhotos } from "./zukanPlaceRecordsAndPhotos";
import { loadPlaceFixedPointFrames } from "./zukanPlaceShareAndTimeline";
import { handlePlaceSeasonsApi } from "./zukanPlaceAboutAndSeasons";

// Production D1 schema (ikimon_prod_observations_2026_06): observations has no place_id / vernacular_name.
function prodLikeDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, draft_id TEXT NOT NULL UNIQUE, owner_user_id TEXT NOT NULL, observed_at TEXT NOT NULL, taxon_label TEXT, note TEXT, exact_lat REAL, exact_lng REAL, location_accuracy_m REAL, public_cell TEXT NOT NULL, visibility TEXT NOT NULL, emergency_hidden INTEGER NOT NULL DEFAULT 0, processing_state TEXT NOT NULL DEFAULT 'accepted', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, partition_month TEXT, organism_origin TEXT, public_area_label TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, draft_id TEXT NOT NULL, observation_id TEXT, owner_user_id TEXT NOT NULL, object_key TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', exif_scrub_state TEXT NOT NULL DEFAULT 'not_started');
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, public_profile_status TEXT NOT NULL DEFAULT 'draft');
    CREATE TABLE record_place_memberships (membership_id TEXT PRIMARY KEY, record_id TEXT NOT NULL, place_id TEXT NOT NULL, membership_type TEXT NOT NULL, membership_state TEXT NOT NULL DEFAULT 'candidate', public_precision TEXT NOT NULL DEFAULT 'place', removed_at TEXT, calculation_version TEXT NOT NULL);
  `);
  sqlite.exec(`INSERT INTO places VALUES ('plc_1','常磐公園','published')`);
  const obs = (id: string, at: string, vis: string, hidden = 0) =>
    sqlite.exec(`INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, taxon_label, public_cell, visibility, emergency_hidden) VALUES ('${id}','d_${id}','u1','${at}','カワセミ','34.9,138.3','${vis}',${hidden})`);
  obs("o1", "2026-11-20T09:00:00Z", "public");
  obs("o2", "2026-11-21T09:00:00Z", "private");
  obs("o3", "2025-10-01T09:00:00Z", "public");
  obs("o4", "2026-11-22T09:00:00Z", "public", 1);
  sqlite.exec(`INSERT INTO asset_ledger VALUES ('a1','d_o1','o1','u1','k','image/jpeg',1,'public','scrubbed')`);
  const member = (id: string, rec: string, state = "confirmed", removed: string | null = null) =>
    sqlite.exec(`INSERT INTO record_place_memberships VALUES ('m_${id}','${rec}','plc_1','containment','${state}','place',${removed ? `'${removed}'` : "NULL"},'v1')`);
  member("1", "o1"); member("2", "o2"); member("3", "o3", "candidate"); member("4", "o4");
  return {
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        bind(...values: unknown[]) {
          return {
            async first() { return (stmt.get(...(values as never[])) as never) ?? null; },
            async all() { return { results: stmt.all(...(values as never[])) as never[] }; },
          };
        },
      };
    },
  };
}

test("place records, photos, timeline and seasons run against the production observation schema", async () => {
  const db = prodLikeDb();
  const data = await loadPlacePublicRecordsAndPhotos(db as never, "plc_1", 40);
  assert.deepEqual(data.records.map((r) => r.observationId), ["o1"]);
  assert.equal(data.records[0]?.taxonName, "カワセミ");
  assert.deepEqual(data.photos.map((p) => p.assetId), ["a1"]);

  const frames = await loadPlaceFixedPointFrames("plc_1", db as never);
  assert.deepEqual(frames?.frames.map((f) => f.observationId), ["o1"]);

  const response = await handlePlaceSeasonsApi("plc_1", db as never);
  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; seasons: Array<{ thisYearCount: number; lastYearCount: number }> };
  assert.equal(body.ok, true);
  assert.equal(body.seasons.reduce((n, s) => n + s.thisYearCount + s.lastYearCount, 0), 1);
});
