import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleMapExploreRoute, handleMapPlacesBoundsApi } from "./zukanMapView";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

function setupDb(t: test.TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE places (
      place_id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      public_profile_status TEXT NOT NULL DEFAULT 'draft',
      superseded_by_place_id TEXT
    );
    CREATE TABLE place_boundaries (
      boundary_id TEXT PRIMARY KEY,
      place_id TEXT NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      boundary_version INTEGER NOT NULL DEFAULT 1,
      valid_to TEXT,
      superseded_by_boundary_id TEXT,
      bbox_west REAL, bbox_south REAL, bbox_east REAL, bbox_north REAL
    );
  `);
  const ins = sqlite.prepare("INSERT INTO places (place_id, canonical_name, public_profile_status) VALUES (?, ?, ?)");
  const bnd = sqlite.prepare("INSERT INTO place_boundaries (boundary_id, place_id, is_primary, bbox_west, bbox_south, bbox_east, bbox_north) VALUES (?, ?, 1, ?, ?, ?, ?)");
  ins.run("p-in", "佐鳴湖公園", "published"); bnd.run("b1", "p-in", 137.71, 34.70, 137.73, 34.72);
  ins.run("p-priv", "秘密の場所", "draft"); bnd.run("b2", "p-priv", 137.71, 34.70, 137.73, 34.72);
  ins.run("p-out", "東京公園", "published"); bnd.run("b3", "p-out", 139.75, 35.67, 139.77, 35.69);
  return sqliteObsDb(sqlite);
}

test("GET /api/v1/map/places returns only public places inside bounding box", async (t) => {
  const db = setupDb(t);
  const res = await handleMapPlacesBoundsApi(
    new URL("https://ikimon.life/api/v1/map/places?minLat=34.6&maxLat=34.8&minLng=137.6&maxLng=137.8"),
    db
  );
  assert.equal(res.status, 200);
  const body = await res.json() as { ok: boolean; places: Array<{ placeId: string; name: string }> };
  assert.equal(body.ok, true);
  assert.equal(body.places.length, 1);
  assert.equal(body.places[0]?.placeId, "p-in");
});

test("G1-G3 map explore page renders MapLibre canvas and G3 selected place card in zukanShell", async (t) => {
  const db = setupDb(t);
  const res = await handleMapExploreRoute(new URL("https://ikimon.life/ja/map/explore?placeId=p-in"), "ja", null, db);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class="zt-shell"/);
  assert.match(html, /data-map-view="g1-g3"/);
  assert.match(html, /id="zukan-maplibre-canvas"/);
  assert.match(html, /id="zukan-map-selected-card"/);
  assert.match(html, /佐鳴湖公園/);
});

test("map places API degrades to empty when the query fails", async () => {
  const broken = { prepare() { throw new Error("no such column"); } } as unknown as Env["OBS_DB"];
  const res = await handleMapPlacesBoundsApi(new URL("https://ikimon.life/api/v1/map/places"), broken);
  assert.equal(res.status, 200);
  assert.deepEqual(((await res.json()) as { places: unknown[] }).places, []);
});
