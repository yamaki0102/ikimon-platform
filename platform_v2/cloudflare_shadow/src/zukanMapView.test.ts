import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleMapExploreRoute, handleMapPlacesBoundsApi, mapPlaceCardFromProfile } from "./zukanMapView";

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
  ins.run("p-far", "浜松の遠い公園", "published"); bnd.run("b4", "p-far", 138.19, 34.89, 138.21, 34.91);
  ins.run("p-far2", "浜松の遠い公園2", "published"); bnd.run("b7", "p-far2", 138.37, 34.96, 138.39, 34.98);
  ins.run("p-miyako", "都田公園", "published"); bnd.run("b5", "p-miyako", 137.78, 34.80, 137.78, 34.80);
  ins.run("p-near2", "都田の池", "published"); bnd.run("b6", "p-near2", 137.80, 34.80, 137.80, 34.80);
  return sqliteObsDb(sqlite);
}

test("GET /api/v1/map/places returns only public places inside bounding box", async (t) => {
  const db = setupDb(t);
  const res = await handleMapPlacesBoundsApi(
    new URL("https://ikimon.life/api/v1/map/places?minLat=34.6&maxLat=34.75&minLng=137.6&maxLng=137.75"),
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
  const res = await handleMapPlacesBoundsApi(new URL("https://ikimon.life/api/v1/map/places?lat=34.8&lng=137.7"), broken);
  assert.equal(res.status, 200);
  assert.deepEqual(((await res.json()) as { places: unknown[] }).places, []);
});

type ApiPlace = { placeId: string; recordCount: number | null; photoUrl: string | null };

test("center query returns nearest first, never a far place, and caps by radius", async (t) => {
  const db = setupDb(t);
  const res = await handleMapPlacesBoundsApi(new URL("https://zukan.earth/api/v1/map/places?lat=34.80&lng=137.78"), db);
  const body = (await res.json()) as { places: ApiPlace[] };
  assert.deepEqual(body.places.map((p) => p.placeId), ["p-miyako", "p-near2"]);
  assert.equal(body.places.some((p) => p.placeId === "p-far"), false);
  assert.equal(body.places.some((p) => p.placeId === "p-priv"), false);
  assert.equal(body.places[0]?.recordCount, null);
  const wide = await handleMapPlacesBoundsApi(new URL("https://zukan.earth/api/v1/map/places?lat=34.80&lng=137.78&radiusKm=50"), db);
  const ids = ((await wide.json()) as { places: ApiPlace[] }).places.map((p) => p.placeId);
  assert.equal(ids[ids.length - 1], "p-far");
  assert.equal(ids.includes("p-out"), false);
});

test("center query ordering follows distance, not insertion order", async (t) => {
  const db = setupDb(t);
  const res = await handleMapPlacesBoundsApi(new URL("https://zukan.earth/api/v1/map/places?lat=34.71&lng=137.72&radiusKm=30"), db);
  const ids = ((await res.json()) as { places: ApiPlace[] }).places.map((p) => p.placeId);
  assert.equal(ids[0], "p-in");
  assert.ok(ids.indexOf("p-miyako") > ids.indexOf("p-in"));
});

test("no center and no bounds returns an empty list", async (t) => {
  const db = setupDb(t);
  for (const q of ["", "?lat=34.8", "?lat=abc&lng=137.7", "?lat=95&lng=137.7", "?minLat=34.6&maxLat=34.8"]) {
    const res = await handleMapPlacesBoundsApi(new URL("https://zukan.earth/api/v1/map/places" + q), db);
    assert.deepEqual(((await res.json()) as { places: unknown[] }).places, [], q);
  }
});

test("top 3 nearest are enriched by the loader; failures give null count, never 0", async (t) => {
  const db = setupDb(t);
  const calls: string[] = [];
  const res = await handleMapPlacesBoundsApi(new URL("https://zukan.earth/api/v1/map/places?lat=34.80&lng=137.78&radiusKm=50"), db, async (id) => {
    calls.push(id);
    if (id === "p-near2") throw new Error("boom");
    return { recordCount: 23, photoUrl: "/thumb/400/a1", latestRecord: null };
  });
  const places = ((await res.json()) as { places: ApiPlace[] }).places;
  assert.deepEqual(calls, ["p-miyako", "p-near2", "p-in"]);
  assert.equal(places[0]?.recordCount, 23);
  assert.equal(places[0]?.photoUrl, "/thumb/400/a1");
  assert.equal(places[1]?.recordCount, null);
  assert.equal(places[2]?.recordCount, 23);
  assert.equal(places[3]?.recordCount, null);
});

test("card count uses the place page formula and skips audio for photos", () => {
  const rec = (id: string, mediaUrl: string | null, mediaKind: string) => ({ recordId: id, displayName: id, observedAt: "2026-11-01", mediaUrl, mediaKind });
  const a = mapPlaceCardFromProfile({ summary: { recordCount: 23 }, recentRecords: [rec("r1", "/thumb/400/x", "audio"), rec("r2", "/thumb/400/y", "photo")] });
  assert.equal(a.recordCount, 23);
  assert.equal(a.photoUrl, "/thumb/400/y");
  assert.equal(a.latestRecord?.observationId, "r1");
  assert.equal(a.latestRecord?.photoUrl, null);
  const b = mapPlaceCardFromProfile({ summary: { recordCount: null }, recentRecords: [rec("r1", null, "photo"), rec("r2", null, "photo"), null, { recordId: "" }] });
  assert.equal(b.recordCount, 2);
  const c = mapPlaceCardFromProfile({ summary: { recordCount: 0 }, recentRecords: [] });
  assert.equal(c.recordCount, 0);
  assert.equal(c.latestRecord, null);
});
