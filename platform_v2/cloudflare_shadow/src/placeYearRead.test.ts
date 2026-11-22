import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  PLACE_YEAR_CARDS_SQL,
  PLACE_YEAR_DEFAULT_PLACE_SQL,
  PLACE_YEAR_INDEX_SQL,
  deriveRecordCategory,
  handlePlaceYearReadRequest,
  loadPlaceYearCards,
  loadPlaceYearIndex,
  resolveDefaultPublicPlace,
  type PlaceYearDatabase,
} from "./placeYearRead";

type Value = string | number | null;

function fixture() {
  const native = new DatabaseSync(":memory:");
  for (const prefix of ["0001", "0009", "0030", "0052"]) {
    const name = ["0001_observation_write_contract", "0009_production_canonical_import", "0030_observation_data_rights", "0052_public_area_label_readmodel"]
      .find((entry) => entry.startsWith(prefix))!;
    native.exec(readFileSync(new URL(`../migrations/observations/${name}.sql`, import.meta.url), "utf8"));
  }
  native.exec(`
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, public_profile_status TEXT NOT NULL DEFAULT 'draft', valid_to TEXT, superseded_by_place_id TEXT);
    CREATE TABLE place_policies (place_policy_id TEXT PRIMARY KEY, place_id TEXT NOT NULL, place_visibility TEXT NOT NULL, public_location_mode TEXT NOT NULL DEFAULT 'place', valid_from TEXT, valid_to TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE record_place_memberships (membership_id TEXT PRIMARY KEY, record_id TEXT NOT NULL, place_id TEXT NOT NULL,
      membership_state TEXT NOT NULL DEFAULT 'confirmed', public_precision TEXT NOT NULL DEFAULT 'place', removed_at TEXT);
  `);
  const statements: string[] = [];
  const db: PlaceYearDatabase = {
    prepare(query: string) {
      statements.push(query);
      let values: Value[] = [];
      const statement = {
        bind(...next: Value[]) { values = next; return statement; },
        async all<T>() { return { results: native.prepare(query).all(...values) as T[] }; },
      };
      return statement;
    },
  };
  let seq = 0;
  let policySeq = 0;
  const addPolicy = (id: string, visibility: string, mode: string, from: string) => {
    native.prepare("INSERT INTO place_policies (place_policy_id, place_id, place_visibility, public_location_mode, valid_from) VALUES (?, ?, ?, ?, ?)")
      .run(`pol-${++policySeq}`, id, visibility, mode, from);
  };
  const hide = (visit: string, mode: "emergency" | "private") => {
    native.prepare("INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, public_cell, visibility, emergency_hidden) VALUES (?, ?, 'u', '2008-01-01', 'c', ?, ?)")
      .run(visit, `d-${visit}`, mode === "private" ? "private" : "public", mode === "emergency" ? 1 : 0);
  };
  const addPlace = (id: string, name: string, visibility = "public", status = "published") => {
    native.prepare("INSERT INTO places (place_id, canonical_name, public_profile_status) VALUES (?, ?, ?)").run(id, name, status);
    addPolicy(id, visibility, "place", "2000-01-01");
  };
  const addRecord = (visit: string, place: string, observedAt: string, o: {
    visibility?: string; consent?: string; withdrawal?: string; precision?: string; state?: string; removed?: string | null;
    name?: string; rank?: string; area?: string | null; cell?: string;
  } = {}) => {
    native.prepare("INSERT INTO production_import_visits (visit_id, place_id, observed_at, exact_lat, exact_lng, public_visibility, created_at) VALUES (?, ?, ?, 34.7, 137.7, ?, ?)")
      .run(visit, place, observedAt, o.visibility ?? "public", observedAt);
    native.prepare("INSERT INTO production_import_occurrences (occurrence_id, visit_id, vernacular_name, taxon_rank, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(`occ-${visit}`, visit, o.name ?? "メジロ", o.rank ?? "species", observedAt);
    native.prepare("INSERT INTO observation_data_rights (visit_id, record_consent, withdrawal_status) VALUES (?, ?, ?)")
      .run(visit, o.consent ?? "public_summary", o.withdrawal ?? "active");
    native.prepare("INSERT INTO record_place_memberships (membership_id, record_id, place_id, membership_state, public_precision, removed_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`m-${++seq}`, visit, place, o.state ?? "confirmed", o.precision ?? "place", o.removed ?? null);
    native.prepare("INSERT INTO production_import_public_readmodel (visit_id, public_cell, observed_at, occurrence_count, asset_count, public_ready_asset_count, unresolved_asset_count, visibility) VALUES (?, ?, ?, 1, 1, 1, 0, 'public')")
      .run(visit, o.cell ?? "cell-1", observedAt);
    if (o.area !== undefined) {
      native.prepare("INSERT INTO readmodel_public_observations (observation_id, public_cell, observed_at, public_area_label) VALUES (?, ?, ?, ?)")
        .run(visit, o.cell ?? "cell-1", observedAt, o.area);
    }
  };
  return { native, db, statements, addPlace, addRecord, addPolicy, hide };
}

test("years are distinct, ascending and exclude every non-public record", async () => {
  const f = fixture();
  f.addPlace("hamamatsu-castle", "浜松城公園");
  f.addRecord("a", "hamamatsu-castle", "2008-05-01T00:00:00Z");
  f.addRecord("b", "hamamatsu-castle", "2008-06-01T00:00:00Z");
  f.addRecord("c", "hamamatsu-castle", "1971-01-01T00:00:00Z");
  f.addRecord("d", "hamamatsu-castle", "2026-01-01T00:00:00Z");
  f.addRecord("x1", "hamamatsu-castle", "1990-01-01T00:00:00Z", { visibility: "private" });
  f.addRecord("x2", "hamamatsu-castle", "1991-01-01T00:00:00Z", { withdrawal: "withdrawn" });
  f.addRecord("x3", "hamamatsu-castle", "1992-01-01T00:00:00Z", { precision: "cell" });
  f.addRecord("x4", "hamamatsu-castle", "1993-01-01T00:00:00Z", { removed: "2026-01-01" });
  f.addRecord("x5", "hamamatsu-castle", "1994-01-01T00:00:00Z", { consent: "private" });
  f.addRecord("x6", "hamamatsu-castle", "1995-01-01T00:00:00Z", { state: "candidate" });
  f.statements.length = 0;
  const index = await loadPlaceYearIndex(f.db, "hamamatsu-castle");
  assert.deepEqual(index.years, [{ year: 1971, count: 1 }, { year: 2008, count: 2 }, { year: 2026, count: 1 }]);
  assert.equal(f.statements.length, 1);
});

test("a non-public or unknown place yields empty reads, not errors", async () => {
  const f = fixture();
  f.addPlace("hidden-place", "非公開", "private");
  f.addPlace("draft-place", "下書き", "public", "draft");
  f.addRecord("a", "hidden-place", "2008-05-01T00:00:00Z");
  f.addRecord("b", "draft-place", "2008-05-01T00:00:00Z");
  for (const id of ["hidden-place", "draft-place", "missing-place"]) {
    assert.deepEqual((await loadPlaceYearIndex(f.db, id)).years, []);
    assert.deepEqual(await loadPlaceYearCards(f.db, id), []);
  }
  assert.equal(await resolveDefaultPublicPlace(f.db), null);
});

test("cards honour untilYear, ordering, limit cap, exclusion and one statement", async () => {
  const f = fixture();
  f.addPlace("p1", "浜松城公園");
  for (let i = 0; i < 20; i++) f.addRecord(`v${String(i).padStart(2, "0")}`, "p1", `${2000 + i}-03-01T00:00:00Z`);
  f.statements.length = 0;
  const all = await loadPlaceYearCards(f.db, "p1", { limit: 99 });
  assert.equal(all.length, 12);
  assert.equal(f.statements.length, 1);
  assert.deepEqual(all.map((card) => card.year), [2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008]);
  const until = await loadPlaceYearCards(f.db, "p1", { untilYear: 2008 });
  assert.ok(until.length > 0 && until.every((card) => card.year <= 2008));
  assert.equal(until[0]!.year, 2008);
  const excluded = await loadPlaceYearCards(f.db, "p1", { untilYear: 2008, excludeId: "v08" });
  assert.ok(excluded.every((card) => card.visitId !== "v08"));
  assert.equal((await loadPlaceYearCards(f.db, "p1", { limit: 3 })).length, 3);
});

test("cards expose only safe area labels, public cells and no exact coordinates", async () => {
  const f = fixture();
  f.addPlace("p1", "浜松城公園");
  f.addRecord("safe", "p1", "2008-05-01T00:00:00Z", { area: "浜松市中央区", cell: "cell-9" });
  f.addRecord("school", "p1", "2008-04-01T00:00:00Z", { area: "浜松小学校" });
  f.addRecord("digits", "p1", "2008-03-01T00:00:00Z", { area: "中央1-2-3" });
  const cards = await loadPlaceYearCards(f.db, "p1");
  const byId: Record<string, (typeof cards)[number]> = Object.fromEntries(cards.map((card) => [card.visitId, card]));
  assert.equal(byId.safe!.areaLabel, "浜松市中央区");
  assert.equal(byId.safe!.publicCell, "cell-9");
  assert.equal(byId.school!.areaLabel, null);
  assert.equal(byId.digits!.areaLabel, null);
  assert.ok(!JSON.stringify(cards).includes("34.7"));
  for (const sql of [PLACE_YEAR_INDEX_SQL, PLACE_YEAR_CARDS_SQL, PLACE_YEAR_DEFAULT_PLACE_SQL]) {
    assert.ok(!/exact_lat|exact_lng/i.test(sql));
  }
});

test("default place is the one with the newest public record", async () => {
  const f = fixture();
  f.addPlace("old", "古い場所");
  f.addPlace("new", "新しい場所");
  f.addPlace("secret", "非公開", "private");
  f.addRecord("a", "old", "2001-01-01T00:00:00Z");
  f.addRecord("b", "new", "2020-01-01T00:00:00Z");
  f.addRecord("c", "secret", "2026-01-01T00:00:00Z");
  f.statements.length = 0;
  assert.deepEqual(await resolveDefaultPublicPlace(f.db), { placeId: "new", label: "新しい場所" });
  assert.equal(f.statements.length, 1);
});

test("deriveRecordCategory maps known signals and refuses to guess", () => {
  assert.equal(deriveRecordCategory({ eventId: "e1" }), "community");
  assert.equal(deriveRecordCategory({ scenePlaceType: "shrine" }), "heritage");
  assert.equal(deriveRecordCategory({ scenePlaceType: "Temple_garden" }), "heritage");
  assert.equal(deriveRecordCategory({ scenePlaceType: "park" }), "nature");
  assert.equal(deriveRecordCategory({ taxonRank: "species", displayName: "メジロ" }), "nature");
  assert.equal(deriveRecordCategory({ taxonRank: "other", displayName: "メジロ" }), null);
  assert.equal(deriveRecordCategory({ taxonRank: "species", displayName: "" }), null);
  assert.equal(deriveRecordCategory({}), null);
});

test("route: 400 on a bad place id, empty for non-public, public cache for anonymous", async () => {
  const f = fixture();
  f.addPlace("p1", "浜松城公園");
  f.addRecord("a", "p1", "2008-05-01T00:00:00Z");
  const get = (path: string, init?: RequestInit) =>
    handlePlaceYearReadRequest(new Request(`https://zukan.earth${path}`, init), f.db, path.split("?")[0]!);
  const bad = await get("/api/v1/places/%20/years");
  assert.equal(bad?.status, 400);
  const badDecode = await get("/api/v1/places/%E0%A4%A/years");
  assert.equal(badDecode?.status, 400);
  const ok = await get("/api/v1/places/p1/years");
  assert.equal(ok?.status, 200);
  assert.equal(ok?.headers.get("cache-control"), "public, max-age=60");
  assert.deepEqual((await ok!.json()).years, [{ year: 2008, count: 1 }]);
  const empty = await get("/api/v1/places/nope-place/records?until=2008");
  assert.equal(empty?.status, 200);
  assert.deepEqual((await empty!.json()).cards, []);
  const records = await get("/api/v1/places/p1/records?until=2007");
  assert.deepEqual((await records!.json()).cards, []);
  const authed = await get("/api/v1/places/p1/years", { headers: { cookie: "s=1" } });
  assert.equal(authed?.headers.get("cache-control"), "private, no-store");
  assert.equal(await get("/api/v1/places/p1/other"), null);
});

test("emergency-hidden and non-public observations vanish from every read", async () => {
  const f = fixture();
  f.addPlace("p1", "浜松城公園");
  f.addRecord("ok", "p1", "2008-05-01T00:00:00Z");
  f.addRecord("hid", "p1", "1999-05-01T00:00:00Z");
  f.addRecord("priv", "p1", "1998-05-01T00:00:00Z");
  f.hide("hid", "emergency");
  f.hide("priv", "private");
  assert.deepEqual((await loadPlaceYearIndex(f.db, "p1")).years, [{ year: 2008, count: 1 }]);
  assert.deepEqual((await loadPlaceYearCards(f.db, "p1")).map((c) => c.visitId), ["ok"]);
  f.hide("ok", "emergency");
  assert.equal(await resolveDefaultPublicPlace(f.db), null);
});

test("a hidden location mode or a non-public latest policy removes the place from reads", async () => {
  const f = fixture();
  f.addPlace("hid-mode", "場所A");
  f.addPolicy("hid-mode", "public", "hidden", "2010-01-01");
  f.addPlace("went-private", "場所B");
  f.addPolicy("went-private", "private", "place", "2020-01-01");
  f.addPlace("back-public", "場所C", "private");
  f.addPolicy("back-public", "public", "place", "2021-01-01");
  for (const id of ["hid-mode", "went-private", "back-public"]) f.addRecord(`r-${id}`, id, "2008-05-01T00:00:00Z");
  assert.deepEqual((await loadPlaceYearIndex(f.db, "hid-mode")).years, []);
  assert.deepEqual(await loadPlaceYearCards(f.db, "hid-mode"), []);
  assert.deepEqual((await loadPlaceYearIndex(f.db, "went-private")).years, []);
  assert.deepEqual(await loadPlaceYearCards(f.db, "went-private"), []);
  assert.equal((await loadPlaceYearCards(f.db, "back-public")).length, 1);
  assert.deepEqual(await resolveDefaultPublicPlace(f.db), { placeId: "back-public", label: "場所C" });
});

test("responses vary on credentials", async () => {
  const f = fixture();
  f.addPlace("p1", "浜松城公園");
  const anon = await handlePlaceYearReadRequest(new Request("https://zukan.earth/api/v1/places/p1/years"), f.db, "/api/v1/places/p1/years");
  const authed = await handlePlaceYearReadRequest(new Request("https://zukan.earth/api/v1/places/p1/records", { headers: { authorization: "x" } }), f.db, "/api/v1/places/p1/records");
  for (const r of [anon, authed]) assert.equal(r?.headers.get("vary"), "Cookie, Authorization");
  assert.equal(authed?.headers.get("cache-control"), "private, no-store");
});

test("hide matches the legacy observation id of a migrated record", async () => {
  const f = fixture();
  f.addPlace("p1", "浜松城公園");
  f.addRecord("migrated", "p1", "2008-05-01T00:00:00Z");
  f.native.prepare("UPDATE production_import_visits SET legacy_observation_id = 'legacy-1' WHERE visit_id = 'migrated'").run();
  f.hide("legacy-1", "emergency");
  assert.deepEqual((await loadPlaceYearIndex(f.db, "p1")).years, []);
  assert.deepEqual(await loadPlaceYearCards(f.db, "p1"), []);
});

test("a future-dated or expired policy does not override the current one", async () => {
  const f = fixture();
  f.addPlace("fut", "場所F", "private");
  f.addPolicy("fut", "public", "place", "2000-01-01");
  f.addPolicy("fut", "private", "place", "2001-01-01");
  f.addPolicy("fut", "public", "place", "2999-01-01");
  f.addRecord("r1", "fut", "2008-05-01T00:00:00Z");
  assert.deepEqual((await loadPlaceYearIndex(f.db, "fut")).years, []);
  f.addPlace("exp", "場所E", "private");
  f.addPolicy("exp", "public", "place", "2000-01-01");
  f.native.prepare("UPDATE place_policies SET valid_to = '2001-01-01' WHERE place_id = 'exp'").run();
  f.addPolicy("exp", "public", "place", "2002-01-01");
  f.addRecord("r2", "exp", "2008-05-01T00:00:00Z");
  assert.equal((await loadPlaceYearCards(f.db, "exp")).length, 1);
});

test("zone and public_cell precision places are excluded from place-level reads", async () => {
  const f = fixture();
  for (const mode of ["zone", "public_cell"]) {
    f.addPlace(`pl-${mode}`, "場所", "private");
    f.addPolicy(`pl-${mode}`, "public", mode, "2000-01-01");
    f.addRecord(`rec-${mode}`, `pl-${mode}`, "2008-05-01T00:00:00Z");
    assert.deepEqual((await loadPlaceYearIndex(f.db, `pl-${mode}`)).years, []);
    assert.deepEqual(await loadPlaceYearCards(f.db, `pl-${mode}`), []);
  }
  assert.equal(await resolveDefaultPublicPlace(f.db), null);
});
