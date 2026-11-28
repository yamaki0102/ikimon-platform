import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import type { Env } from "./core/env";
import * as flagDef from "./flags/PARCEL_LEDGER_ENABLED";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import { migratedDb } from "./externalAggregation/sqliteDb.testkit";
import { cellOf, lookupParcel, parcelRefForObservation, pointInMultiPolygon, recordsInParcel } from "./parcelLookup";
import { renderParcelLedgerPage } from "./parcelLedgerPage";

const sq = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const DONUT = [[sq(0, 0, 10, 10), sq(4, 4, 6, 6)]];
let seq = 0;

function placeDb() {
  const { sqlite, db } = migratedDb();
  sqlite.exec(`CREATE TABLE parcels (pid TEXT PRIMARY KEY, city_code TEXT, oaza TEXT, chome TEXT, koaza TEXT, chiban TEXT, min_lng REAL, min_lat REAL, max_lng REAL, max_lat REAL, rings TEXT, source_version TEXT);
    CREATE TABLE parcel_cells (cell INTEGER, pid TEXT, PRIMARY KEY (cell, pid));
    CREATE TABLE sources (source_version TEXT, attribution_text TEXT);`);
  sqlite.prepare(`INSERT INTO sources VALUES ('v1','出典: 公図テスト')`).run();
  return { sqlite, db };
}

function addParcel(sqlite: any, pid: string, box: [number, number, number, number], oaza: string, chiban: string, rings?: unknown) {
  const [x0, y0, x1, y1] = box;
  sqlite.prepare(`INSERT INTO parcels VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(pid, "22137", oaza, "", "", chiban, x0, y0, x1, y1, JSON.stringify(rings ?? [[sq(x0, y0, x1, y1)]]), "v1");
  for (let lx = Math.trunc(x0 / 0.002); lx <= Math.trunc(x1 / 0.002); lx++)
    for (let ly = Math.trunc(y0 / 0.002); ly <= Math.trunc(y1 / 0.002); ly++)
      sqlite.prepare(`INSERT OR IGNORE INTO parcel_cells VALUES (?,?)`).run(lx * 100000 + ly, pid);
}

function rec(sqlite: any, id: string, at: string, label: string, lng: number, lat: number, o: { risk?: string } = {}) {
  sqlite.prepare(`INSERT INTO observations (observation_id,draft_id,owner_user_id,observed_at,taxon_label,public_cell,visibility,emergency_hidden,exact_lat,exact_lng) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, `d-${id}-${seq++}`, "u1", at, label, "c1", "public", 0, lat, lng);
  sqlite.prepare(`INSERT INTO readmodel_public_observations (observation_id,public_cell,observed_at,taxon_label,public_area_label) VALUES (?,?,?,?,?)`).run(id, "c1", at, label, "浜松市");
  if (o.risk) sqlite.prepare(`INSERT INTO civic_observation_contexts (visit_id,audience_scope,public_precision,risk_lane) VALUES (?, 'public','municipality',?)`).run(id, o.risk);
}

const photosFor = (map: Record<string, string>) => async (ids: readonly string[]) => new Map(ids.filter((i) => map[i]).map((i) => [i, map[i]!]));
const noBlock = async () => false;

test("flag is registered, off by default", () => {
  assert.equal(flagDef.flag, "PARCEL_LEDGER_ENABLED");
  assert.equal(flagDef.production, false);
  assert.equal(flagDef.staging, false);
  assert.ok(PROTOTYPE_FLAGS.some((f) => f.flag === "PARCEL_LEDGER_ENABLED"));
});

test("cellOf matches the stored grid formula", () => {
  assert.equal(cellOf(137.81, 34.91), 68905 * 100000 + 17454);
  assert.equal(cellOf(0.001, 0.001), 0);
  assert.equal(cellOf(0.004, 0.002), 2 * 100000 + 1);
});

test("pointInMultiPolygon honours holes and multiple polygons", () => {
  assert.equal(pointInMultiPolygon(2, 2, DONUT), true);
  assert.equal(pointInMultiPolygon(5, 5, DONUT), false);
  assert.equal(pointInMultiPolygon(11, 5, DONUT), false);
  assert.equal(pointInMultiPolygon(21, 1, [...DONUT, [sq(20, 0, 30, 2)]]), true);
});

test("lookupParcel narrows several candidates to the containing one and tolerates a missing db", async () => {
  const { sqlite, db } = placeDb();
  addParcel(sqlite, "big", [137.8, 34.9, 137.82, 34.92], "大字A", "1");
  addParcel(sqlite, "ring", [137.809, 34.909, 137.811, 34.911], "大字B", "2", [[sq(137.809, 34.909, 137.811, 34.911), sq(137.8099, 34.9099, 137.8101, 34.9101)]]);
  addParcel(sqlite, "small", [137.8099, 34.9099, 137.8101, 34.9101], "大字C", "3");
  const hit = await lookupParcel(db as never, 137.81, 34.91);
  assert.equal(hit?.pid, "small");
  assert.equal(hit?.label, "大字C3");
  assert.equal((await lookupParcel(db as never, 137.8105, 34.9105))?.pid, "ring");
  assert.equal(await lookupParcel(db as never, 138.5, 35.5), null);
  assert.equal(await lookupParcel(undefined, 137.81, 34.91), null);
});

test("recordsInParcel keeps in-parcel public records only, no protected, no duplicate photos", async () => {
  const place = placeDb();
  const obs = migratedDb();
  addParcel(place.sqlite, "px", [137.8, 34.9, 137.81, 34.91], "大字A", "1");
  rec(obs.sqlite, "in1", "2026-11-01T01:00:00Z", "メジロ", 137.805, 34.905);
  rec(obs.sqlite, "in2", "2026-11-03T01:00:00Z", "ヒヨドリ", 137.806, 34.906);
  rec(obs.sqlite, "far", "2026-11-04T01:00:00Z", "遠い鳥", 137.9, 34.95);
  rec(obs.sqlite, "prot", "2026-11-05T01:00:00Z", "希少種", 137.805, 34.905, { risk: "sensitive" });
  rec(obs.sqlite, "gate", "2026-11-06T01:00:00Z", "門で止める", 137.805, 34.905);
  const deps = { photoLoader: photosFor({ in1: "https://p/same.jpg", in2: "https://p/same.jpg", gate: "https://p/g.jpg" }), blocked: async (id: string) => id === "gate" };
  const out = await recordsInParcel({ PLACE_DB: place.db as never, OBS_DB: obs.db as never }, "px", deps);
  assert.deepEqual(out.map((r) => r.id), ["in2", "in1"]);
  assert.equal(out.filter((r) => r.photoUrl).length, 1);
  assert.equal(out[0]!.photoUrl, "https://p/same.jpg");
  assert.deepEqual(await recordsInParcel({ OBS_DB: obs.db as never }, "px", deps), []);
  assert.deepEqual(await recordsInParcel({ PLACE_DB: place.db as never, OBS_DB: obs.db as never }, "nope", deps), []);
});

test("parcelRefForObservation hides protected and gated records and works without PLACE_DB", async () => {
  const place = placeDb();
  const obs = migratedDb();
  addParcel(place.sqlite, "px", [137.8, 34.9, 137.81, 34.91], "大字A", "1");
  rec(obs.sqlite, "ok", "2026-11-01T01:00:00Z", "メジロ", 137.805, 34.905);
  rec(obs.sqlite, "prot", "2026-11-01T01:00:00Z", "希少種", 137.805, 34.905, { risk: "sensitive" });
  const env = { PLACE_DB: place.db as never, OBS_DB: obs.db as never };
  assert.equal((await parcelRefForObservation(env, "ok", noBlock))?.pid, "px");
  assert.equal(await parcelRefForObservation(env, "prot", noBlock), null);
  assert.equal(await parcelRefForObservation(env, "ok", async () => true), null);
  assert.equal(await parcelRefForObservation({ OBS_DB: obs.db as never }, "ok", noBlock), null);
});

test("ledger page shows address, attribution, records and an empty state", () => {
  const parcel = { pid: "px", city_code: "22137", oaza: "大字A", chome: "", koaza: "", chiban: "1", label: "大字A1", rings: [], bbox: [0, 0, 1, 1] as [number, number, number, number], attribution: "出典: 公図テスト" };
  const full = renderParcelLedgerPage({ parcel, records: [{ id: "r1", label: "メジロ", observedAt: "2026-11-01T01:00:00Z", photoUrl: "https://p/a.jpg" }, { id: "r2", label: null, observedAt: "2026-10-01T01:00:00Z", photoUrl: null }], lang: "ja", authenticated: false });
  assert.match(full, /大字A1/);
  assert.match(full, /出典: 公図テスト/);
  assert.match(full, /data-parcel-record="r1"/);
  assert.match(full, /2026年11月1日/);
  assert.equal(full.split("https://p/a.jpg").length - 1 >= 1, true);
  const empty = renderParcelLedgerPage({ parcel, records: [], lang: "ja", authenticated: false });
  assert.match(empty, /data-parcel-empty="1"/);
});

test("route: 404 when the switch is off or PLACE_DB is missing, 200 when on", async () => {
  const place = placeDb();
  const obs = migratedDb();
  addParcel(place.sqlite, "px", [137.8, 34.9, 137.81, 34.91], "大字A", "1");
  rec(obs.sqlite, "in1", "2026-11-01T01:00:00Z", "メジロ", 137.805, 34.905);
  const rollouts = (state: string) => JSON.stringify({ REGION_SURFACE_V1_ENABLED: { state: "all" }, PARCEL_LEDGER_ENABLED: { state } });
  const base = { OBS_DB: obs.db, CORE_DB: obs.db, ENVIRONMENT: "staging" };
  const get = (state: string, extra: Record<string, unknown>) => worker.fetch(new Request("https://zukan.earth/ja/parcels/px"), { ...base, ...extra, ZUKAN_FEATURE_ROLLOUTS: rollouts(state) } as unknown as Env, undefined as never);
  assert.equal((await get("off", { PLACE_DB: place.db })).status, 404);
  assert.equal((await get("all", {})).status, 404);
  const ok = await get("all", { PLACE_DB: place.db });
  assert.equal(ok.status, 200);
  assert.match(await ok.text(), /data-parcel-ledger="px"/);
});
