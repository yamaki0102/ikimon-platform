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
      name TEXT NOT NULL,
      lat REAL,
      lng REAL,
      visibility TEXT NOT NULL DEFAULT 'public'
    );
  `);
  sqlite.prepare("INSERT INTO places (place_id, name, lat, lng, visibility) VALUES (?, ?, ?, ?, 'public')").run("p-in", "佐鳴湖公園", 34.71, 137.72);
  sqlite.prepare("INSERT INTO places (place_id, name, lat, lng, visibility) VALUES (?, ?, ?, ?, 'private')").run("p-priv", "秘密の場所", 34.71, 137.72);
  sqlite.prepare("INSERT INTO places (place_id, name, lat, lng, visibility) VALUES (?, ?, ?, ?, 'public')").run("p-out", "東京公園", 35.68, 139.76);
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
