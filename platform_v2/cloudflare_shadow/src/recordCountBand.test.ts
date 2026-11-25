import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { handleRecordCountBandRoute, seasonOf, type BandDeps, type BandPublicRow } from "./recordCountBand.js";

const migration = (name: string) => readFileSync(path.join(process.cwd(), "migrations", "observations", name), "utf8");
const NOW = Date.parse("2026-11-25T12:00:00+09:00");
const CELL = "cell:34.71,137.73";
const OTHER_CELL = "cell:35.10,138.00";

type Rec = { id: string; owner?: string; at: string; cell?: string; visibility?: string; hiddenFlag?: number; risk?: string; scope?: string; precision?: string; withdrawn?: boolean; placeType?: string; noObservationRow?: boolean };

function openDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const file of ["0001_observation_write_contract.sql", "0030_observation_data_rights.sql", "0043_civic_observation_contexts.sql", "0049_observation_detail_edit_runtime.sql", "0052_public_area_label_readmodel.sql"]) db.exec(migration(file));
  return db;
}
function put(db: DatabaseSync, r: Rec) {
  const cell = r.cell ?? CELL;
  if (!r.noObservationRow) {
    db.prepare("INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, taxon_label, public_cell, visibility, emergency_hidden) VALUES (?,?,?,?,?,?,?,?)")
      .run(r.id, `d-${r.id}`, r.owner ?? "u-other", r.at, "アオサギ", cell, r.visibility ?? "public", r.hiddenFlag ?? 0);
  }
  db.prepare("INSERT INTO readmodel_public_observations (observation_id, public_cell, observed_at, taxon_label, public_area_label) VALUES (?,?,?,?,?)").run(r.id, cell, r.at, "アオサギ", "みなと川の土手");
  if (r.risk || r.scope || r.precision) {
    db.prepare("INSERT INTO civic_observation_contexts (context_id, visit_id, audience_scope, public_precision, risk_lane) VALUES (?,?,?,?,?)").run(`c-${r.id}`, r.id, r.scope ?? "public", r.precision ?? "municipality", r.risk ?? "normal");
  }
  if (r.withdrawn) db.prepare("INSERT INTO observation_data_rights (visit_id, withdrawal_status) VALUES (?, 'withdrawn')").run(r.id);
  if (r.placeType) db.prepare("INSERT INTO observation_environment_records (record_id, occurrence_id, lat, lng, structured_json) VALUES (?,?,?,?,?)").run(`e-${r.id}`, r.id, 34.7, 137.7, JSON.stringify({ place_type: r.placeType }));
}
const depsOf = (db: DatabaseSync): BandDeps => ({
  query: async (sql, values) => db.prepare(sql).all(...(values as Array<string | number | null>)) as Array<Record<string, unknown>>,
  publicRows: async () => db.prepare("SELECT observation_id, public_cell, observed_at, taxon_label, public_area_label FROM readmodel_public_observations ORDER BY observed_at DESC").all() as unknown as BandPublicRow[],
  nowMs: NOW,
});
const call = async (db: DatabaseSync, pathname: string, userId: string | null) => {
  const res = await handleRecordCountBandRoute(depsOf(db), async () => (userId ? { userId } : null), pathname);
  assert.ok(res);
  const text = await res.text();
  return { status: res.status, text, json: JSON.parse(text) as Record<string, any>, headers: res.headers };
};
const autumn = (n: number) => `2025-10-${String(n).padStart(2, "0")}T09:00:00+09:00`;

function seedFour(db: DatabaseSync) {
  put(db, { id: "r1", owner: "u-a", at: autumn(1) });
  put(db, { id: "r2", owner: "u-b", at: autumn(2) });
  put(db, { id: "r3", owner: "u-c", at: autumn(3) });
  put(db, { id: "r4", owner: "u-me", at: autumn(4) });
  put(db, { id: "spring", owner: "u-a", at: "2025-04-01T09:00:00+09:00" });
  put(db, { id: "far", owner: "u-a", at: autumn(5), cell: OTHER_CELL });
}

test("band count equals the linked list count and wording follows viewer", async () => {
  const db = openDb();
  seedFour(db);
  const other = await call(db, "/api/v1/records/r2/count-band", "u-x");
  const list = await call(db, "/api/v1/records/r2/place-season", null);
  assert.equal(other.json.band.kind, "public_place_season");
  assert.equal(other.json.band.count, 4);
  assert.equal(list.json.count, other.json.band.count);
  assert.equal(list.json.items.length, other.json.band.count);
  assert.deepEqual(list.json.items.map((i: { visitId: string }) => i.visitId).sort(), ["r1", "r2", "r3", "r4"]);
  assert.equal(other.json.band.text, "みなと川の土手の秋の記録は、いま4件あります");
  assert.equal(other.json.band.href, "/api/v1/records/r2/place-season");
  const mine = await call(db, "/api/v1/records/r4/count-band", "u-me");
  assert.equal(mine.json.band.text, "この記録で、みなと川の土手の秋の記録が4件になりました");
  const mineOld = await call(db, "/api/v1/records/r1/count-band", "u-a");
  assert.match(mineOld.json.band.text, /いま4件あります/);
  assert.match(other.headers.get("cache-control") ?? "", /no-store/);
  for (const id of ["r1", "r3", "r4"]) assert.equal((await call(db, `/api/v1/records/${id}/place-season`, null)).json.count, 4);
});

test("public suppression: hidden location, protected species, under 3, deleted, delayed", async () => {
  const db = openDb();
  seedFour(db);
  put(db, { id: "hid", owner: "u-d", at: autumn(6), cell: "hidden" });
  put(db, { id: "rare", owner: "u-e", at: autumn(7), risk: "rare_sensitive" });
  put(db, { id: "gone", owner: "u-f", at: autumn(8), visibility: "private" });
  put(db, { id: "emerg", owner: "u-f", at: autumn(8), hiddenFlag: 1 });
  put(db, { id: "wd", owner: "u-f", at: autumn(8), withdrawn: true });
  put(db, { id: "orphan", owner: "u-f", at: autumn(8), noObservationRow: true });
  put(db, { id: "fresh", owner: "u-f", at: new Date(NOW - 3600_000).toISOString().replace("Z", "+00:00") });
  const excluded = ["hid", "rare", "gone", "emerg", "wd", "orphan", "fresh"];
  const list = await call(db, "/api/v1/records/r1/place-season", null);
  assert.equal(list.json.count, 4);
  assert.equal(list.json.items.some((i: { visitId: string }) => excluded.includes(i.visitId)), false);
  for (const id of excluded) {
    assert.notEqual((await call(db, `/api/v1/records/${id}/count-band`, "u-f")).json.band?.kind, "public_place_season", id);
    assert.equal((await call(db, `/api/v1/records/${id}/count-band`, "u-x")).json.band, null, id);
    assert.equal((await call(db, `/api/v1/records/${id}/place-season`, null)).status, 404, id);
  }
  const few = openDb();
  put(few, { id: "a", owner: "u-a", at: autumn(1) });
  put(few, { id: "b", owner: "u-b", at: autumn(2) });
  assert.equal((await call(few, "/api/v1/records/a/count-band", "u-x")).json.band, null);
  assert.equal((await call(few, "/api/v1/records/a/place-season", null)).status, 404);
  put(few, { id: "c", owner: "u-c", at: autumn(3), scope: "private" });
  assert.equal((await call(few, "/api/v1/records/a/count-band", "u-x")).json.band, null);
});

test("owner-only bands: nth record at place and first place type; absent for others and in public list", async () => {
  const db = openDb();
  put(db, { id: "m1", owner: "u-me", at: "2025-05-01T09:00:00+09:00", placeType: "wetland" });
  put(db, { id: "m2", owner: "u-me", at: "2025-06-01T09:00:00+09:00", placeType: "wetland" });
  put(db, { id: "m3", owner: "u-me", at: "2025-07-20T09:00:00+09:00", visibility: "private", placeType: "woodland" });
  put(db, { id: "m4", owner: "u-me", at: "2025-09-20T09:00:00+09:00", placeType: "water_edge", cell: OTHER_CELL });
  const nth = await call(db, "/api/v1/records/m3/count-band", "u-me");
  assert.equal(nth.json.band.kind, "owner_place_nth");
  assert.equal(nth.json.band.text, "あなたのこの場所の記録は、これで3件目です");
  const mid = await call(db, "/api/v1/records/m2/count-band", "u-me");
  assert.equal(mid.json.band.text, "あなたのこの場所の2件目の記録です");
  const first = await call(db, "/api/v1/records/m4/count-band", "u-me");
  assert.equal(first.json.band.kind, "owner_first_place_type");
  assert.equal(first.json.band.text, "あなたの記録では、初めての水辺です");
  assert.equal((await call(db, "/api/v1/records/m1/count-band", "u-me")).json.band.text, "あなたのこの場所の1件目の記録です");
  for (const viewer of [null, "u-other"]) {
    for (const id of ["m1", "m2", "m3", "m4"]) {
      const res = await call(db, `/api/v1/records/${id}/count-band`, viewer);
      assert.equal(res.json.band, null, `${id}/${viewer}`);
      assert.doesNotMatch(res.text, /あなた|owner_/);
    }
  }
  assert.equal((await call(db, "/api/v1/records/m1/place-season", null)).status, 404);
});

test("hidden-location record gives owner-only first-place-type, never the public band", async () => {
  const db = openDb();
  put(db, { id: "p1", owner: "u-me", at: autumn(1), cell: "hidden", placeType: "coast" });
  const own = await call(db, "/api/v1/records/p1/count-band", "u-me");
  assert.equal(own.json.band.kind, "owner_first_place_type");
  assert.equal((await call(db, "/api/v1/records/p1/count-band", "u-x")).json.band, null);
});

test("season: month based, southern hemisphere flipped, tropics use month", () => {
  assert.equal(seasonOf("2025-10-01T00:00:00+09:00", 35)?.label, "秋");
  assert.equal(seasonOf("2025-10-01T00:00:00+09:00", -35)?.label, "春");
  assert.equal(seasonOf("2025-12-31T00:00:00+09:00", 35)?.label, "冬");
  assert.equal(seasonOf("2025-11-05T00:00:00+09:00", 10)?.label, "11月");
});
