import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleMapFilteredPinsApi, handleMapFiltersRoute } from "./zukanMapFiltersAndPins";

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
  sqlite.prepare("INSERT INTO places (place_id, name, lat, lng, visibility) VALUES (?, ?, ?, ?, 'public')").run("p-pub", "佐鳴湖公園", 34.71, 137.72);
  sqlite.prepare("INSERT INTO places (place_id, name, lat, lng, visibility) VALUES (?, ?, ?, ?, 'private')").run("p-priv", "非公開場所", 34.71, 137.72);
  return sqliteObsDb(sqlite);
}

test("GET /api/v1/map/filtered-pins returns only public pins inside bounds", async (t) => {
  const db = setupDb(t);
  const res = await handleMapFilteredPinsApi(
    new URL("https://ikimon.life/api/v1/map/filtered-pins?minLat=34.6&maxLat=34.8&minLng=137.6&maxLng=137.8"),
    db
  );
  assert.equal(res.status, 200);
  const body = await res.json() as { ok: boolean; pins: Array<{ placeId: string; name: string }> };
  assert.equal(body.ok, true);
  assert.equal(body.pins.length, 1);
  assert.equal(body.pins[0]?.placeId, "p-pub");
});

test("G4-G6 map filters page renders filter bar, G5 location-denied state, G6 photo pins, and 12px feedback offset", async (t) => {
  const db = setupDb(t);
  const res = await handleMapFiltersRoute(
    new URL("https://ikimon.life/ja/map/filters?geo=denied"),
    "ja",
    null,
    db
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class="zt-shell"/);
  assert.match(html, /data-map-view="g4-g6"/);
  assert.match(html, /data-map-geo-denied="1"/);
  assert.match(html, /zt-map-photo-pin/);
  assert.match(html, /zt-map-feedback-btn/);
  assert.match(html, /佐鳴湖公園/);
});
