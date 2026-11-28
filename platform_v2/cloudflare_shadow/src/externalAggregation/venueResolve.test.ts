import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminIndex } from "../adminUnits";
import { migratedDb } from "./sqliteDb.testkit";
import { resolveVenue } from "./venueResolve";

const poly = { type: "Polygon" as const, coordinates: [[[137, 34], [138, 34], [138, 35], [137, 35], [137, 34]]] };

function setup() {
  const t = migratedDb();
  t.sqlite.exec(`INSERT INTO admin_units (code,level,parent_code,name_ja,boundary_version) VALUES ('22130','city',NULL,'浜松市','t'),('22131','ward','22130','中央区','t'),('22100','city',NULL,'静岡市','t')`);
  return t;
}
const base = { lat: null, lng: null, venue_name: null, venue_address: null };

test("a: coordinates", async () => {
  const { db } = setup();
  const index = buildAdminIndex([{ code: "22131", level: "ward", parent_code: "22130", bbox: [137, 34, 138, 35], geometry: poly }]);
  const r = await resolveVenue(db, { ...base, lat: 34.5, lng: 137.5 }, index);
  assert.deepEqual([r.city_unit_id, r.admin_unit_id], ["22130", "22131"]);
});

test("b: venue name via places", async () => {
  const { db, sqlite } = setup();
  sqlite.exec(`INSERT INTO places (place_id,canonical_name,canonical_name_normalized,municipality) VALUES ('p1','浜松市動物園','浜松市動物園','静岡市')`);
  const r = await resolveVenue(db, { ...base, venue_name: "浜松市動物園" }, null);
  assert.deepEqual([r.city_unit_id, r.zukan_place_id], ["22100", "p1"]);
});

test("c: address city and ward", async () => {
  const { db } = setup();
  const r = await resolveVenue(db, { ...base, venue_address: "静岡県浜松市中央区元城町1-1" }, null);
  assert.deepEqual([r.city_unit_id, r.admin_unit_id], ["22130", "22131"]);
  const r2 = await resolveVenue(db, { ...base, venue_address: "静岡市葵区" }, null);
  assert.equal(r2.city_unit_id, "22100");
});

test("d: unresolved gives null", async () => {
  const { db } = setup();
  const r = await resolveVenue(db, { ...base, venue_name: "どこか", venue_address: "不明" }, null);
  assert.equal(r.city_unit_id, null);
});
