import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS } from "../../src/services/placeAtlasContract";
import { matchD1PublicPlaceDetail } from "./placeRegistryD1";
import {
  PLACE_YEAR_CARDS_SQL,
  PLACE_YEAR_DEFAULT_PLACE_SQL,
  PLACE_YEAR_INDEX_SQL,
  PLACE_YEAR_MIN_PUBLIC_RECORDS,
  deriveRecordCategory,
  handlePlaceYearReadRequest,
  loadPlaceYearCards,
  loadPlaceYearIndex,
  resolveDefaultPublicPlace,
  type PlaceYearDatabase,
} from "./placeYearRead";

type Value = string | number | null;
type PlaceOptions = {
  boundary?: boolean;
  boundaryState?: string;
  osmId?: string | null;
  sourceType?: string;
  sourceVerification?: string;
  superseded?: boolean;
};

function fixture() {
  const native = new DatabaseSync(":memory:");
  native.exec("CREATE TABLE place_memory_entries (entry_id TEXT PRIMARY KEY, cell_id TEXT, updated_at TEXT)");
  for (const name of [
    "0001_observation_write_contract",
    "0009_production_canonical_import",
    "0030_observation_data_rights",
    "0052_public_area_label_readmodel",
    "0068_universal_place_atlas",
  ]) {
    native.exec(readFileSync(new URL(`../migrations/observations/${name}.sql`, import.meta.url), "utf8"));
  }
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
  let osmSeq = 0;
  const addPolicy = (id: string, visibility: string, mode: string, from: string, to: string | null = null) => {
    native.prepare("INSERT INTO place_policies (place_policy_id, place_id, place_visibility, public_location_mode, valid_from, valid_to) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`pol-${++policySeq}`, id, visibility, mode, from, to);
  };
  const hide = (visit: string, mode: "emergency" | "private") => {
    native.prepare("INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, public_cell, visibility, emergency_hidden) VALUES (?, ?, 'u', '2008-01-01', 'c', ?, ?)")
      .run(visit, `d-${visit}`, mode === "private" ? "private" : "public", mode === "emergency" ? 1 : 0);
  };
  const addPlace = (id: string, name: string, visibility = "public", status = "published", o: PlaceOptions = {}) => {
    native.prepare("INSERT INTO places (place_id, canonical_name, canonical_name_normalized, verification_status, public_profile_status, superseded_by_place_id) VALUES (?, ?, ?, 'verified', ?, ?)")
      .run(id, name, name, status, o.superseded ? "other-place" : null);
    const osmId = o.osmId === undefined ? `way:${++osmSeq}` : o.osmId;
    if (osmId !== null) {
      native.prepare("INSERT INTO place_source_references (source_reference_id, place_id, source_type, source_id, verification_status) VALUES (?, ?, ?, ?, ?)")
        .run(`src-${id}`, id, o.sourceType ?? "osm", osmId, o.sourceVerification ?? "verified");
    }
    if (o.boundary !== false && osmId !== null) {
      native.prepare("INSERT INTO place_boundaries (boundary_id, place_id, geometry_kind, boundary_geojson, source_reference_id, source_type, validation_state, is_primary) VALUES (?, ?, 'Polygon', '{}', ?, 'osm', ?, 1)")
        .run(`b-${id}`, id, `src-${id}`, o.boundaryState ?? "valid");
    }
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
    native.prepare("INSERT INTO record_place_memberships (membership_id, record_id, place_id, membership_type, membership_state, derivation_source, calculation_version, public_precision, removed_at) VALUES (?, ?, ?, 'inside', ?, 'test', 'v1', ?, ?)")
      .run(`m-${++seq}`, visit, place, o.state ?? "confirmed", o.precision ?? "place", o.removed ?? null);
    native.prepare("INSERT INTO production_import_public_readmodel (visit_id, public_cell, observed_at, occurrence_count, asset_count, public_ready_asset_count, unresolved_asset_count, visibility) VALUES (?, ?, ?, 1, 1, 1, 0, 'public')")
      .run(visit, o.cell ?? "cell-1", observedAt);
    if (o.area !== undefined) {
      native.prepare("INSERT INTO readmodel_public_observations (observation_id, public_cell, observed_at, public_area_label) VALUES (?, ?, ?, ?)")
        .run(visit, o.cell ?? "cell-1", observedAt, o.area);
    }
  };
  const addRecords = (prefix: string, place: string, count: number, observedAt = "2008-05-01T00:00:00Z") => {
    for (let i = 0; i < count; i++) addRecord(`${prefix}-${i}`, place, observedAt);
  };
  return { native, db, statements, addPlace, addRecord, addRecords, addPolicy, hide };
}

const isoFromNow = (ms: number) => new Date(Date.now() + ms).toISOString();

test("threshold reuses the place atlas minimum", () => {
  assert.equal(PLACE_YEAR_MIN_PUBLIC_RECORDS, PLACE_ATLAS_DEFAULT_MIN_PUBLIC_RECORDS);
  assert.equal(PLACE_YEAR_MIN_PUBLIC_RECORDS, 3);
});

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
  f.addRecord("x7", "hamamatsu-castle", "1850-01-01T00:00:00Z");
  f.statements.length = 0;
  const index = await loadPlaceYearIndex(f.db, "hamamatsu-castle");
  assert.deepEqual(index.years, [{ year: 1971, count: 1 }, { year: 2008, count: 2 }, { year: 2026, count: 1 }]);
  assert.equal(f.statements.length, 2);
});

test("a non-public or unknown place yields empty reads, not errors", async () => {
  const f = fixture();
  f.addPlace("hidden-place", "非公開", "private");
  f.addPlace("draft-place", "下書き", "public", "draft");
  f.addRecords("a", "hidden-place", 3);
  f.addRecords("b", "draft-place", 3);
  for (const id of ["hidden-place", "draft-place", "missing-place"]) {
    assert.deepEqual((await loadPlaceYearIndex(f.db, id)).years, []);
    assert.deepEqual(await loadPlaceYearCards(f.db, id), []);
  }
  assert.equal(await resolveDefaultPublicPlace(f.db), null);
});

test("cards honour untilYear, ordering, limit cap and exclusion", async () => {
  const f = fixture();
  f.addPlace("p1", "浜松城公園");
  for (let i = 0; i < 20; i++) f.addRecord(`v${String(i).padStart(2, "0")}`, "p1", `${2000 + i}-03-01T00:00:00Z`);
  f.statements.length = 0;
  const all = await loadPlaceYearCards(f.db, "p1", { limit: 99 });
  assert.equal(all.length, 12);
  assert.equal(f.statements.length, 2);
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
  f.addRecords("a", "old", 3, "2001-01-01T00:00:00Z");
  f.addRecords("b", "new", 3, "2020-01-01T00:00:00Z");
  f.addRecords("c", "secret", 3, "2026-01-01T00:00:00Z");
  assert.deepEqual(await resolveDefaultPublicPlace(f.db), { placeId: "new", label: "新しい場所" });
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
  f.addRecords("a", "p1", 3);
  const get = (path: string, init?: RequestInit) =>
    handlePlaceYearReadRequest(new Request(`https://zukan.earth${path}`, init), f.db, path.split("?")[0]!);
  const bad = await get("/api/v1/places/%20/years");
  assert.equal(bad?.status, 400);
  const badDecode = await get("/api/v1/places/%E0%A4%A/years");
  assert.equal(badDecode?.status, 400);
  const ok = await get("/api/v1/places/p1/years");
  assert.equal(ok?.status, 200);
  assert.equal(ok?.headers.get("cache-control"), "public, max-age=60");
  assert.deepEqual((await ok!.json()).years, [{ year: 2008, count: 3 }]);
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
  f.addRecords("ok", "p1", 3);
  f.addRecord("hid", "p1", "1999-05-01T00:00:00Z");
  f.addRecord("priv", "p1", "1998-05-01T00:00:00Z");
  f.hide("hid", "emergency");
  f.hide("priv", "private");
  assert.deepEqual((await loadPlaceYearIndex(f.db, "p1")).years, [{ year: 2008, count: 3 }]);
  assert.deepEqual((await loadPlaceYearCards(f.db, "p1")).map((c) => c.visitId).sort(), ["ok-0", "ok-1", "ok-2"]);
  f.hide("ok-0", "emergency");
  assert.deepEqual((await loadPlaceYearIndex(f.db, "p1")).years, []);
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
  for (const id of ["hid-mode", "went-private", "back-public"]) f.addRecords(`r-${id}`, id, 3);
  assert.deepEqual((await loadPlaceYearIndex(f.db, "hid-mode")).years, []);
  assert.deepEqual(await loadPlaceYearCards(f.db, "hid-mode"), []);
  assert.deepEqual((await loadPlaceYearIndex(f.db, "went-private")).years, []);
  assert.deepEqual(await loadPlaceYearCards(f.db, "went-private"), []);
  assert.equal((await loadPlaceYearCards(f.db, "back-public")).length, 3);
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
  f.addRecords("keep", "p1", 3, "2010-05-01T00:00:00Z");
  f.addRecord("migrated", "p1", "2008-05-01T00:00:00Z");
  f.native.prepare("UPDATE production_import_visits SET legacy_observation_id = 'legacy-1' WHERE visit_id = 'migrated'").run();
  f.hide("legacy-1", "emergency");
  assert.deepEqual((await loadPlaceYearIndex(f.db, "p1")).years, [{ year: 2010, count: 3 }]);
  assert.ok((await loadPlaceYearCards(f.db, "p1")).every((card) => card.visitId !== "migrated"));
});

test("a future-dated or expired policy does not override the current one", async () => {
  const f = fixture();
  f.addPlace("fut", "場所F", "private");
  f.addPolicy("fut", "public", "place", "2000-01-01");
  f.addPolicy("fut", "private", "place", "2001-01-01");
  f.addPolicy("fut", "public", "place", "2999-01-01");
  f.addRecords("r1", "fut", 3);
  assert.deepEqual((await loadPlaceYearIndex(f.db, "fut")).years, []);
  f.addPlace("exp", "場所E", "private");
  f.addPolicy("exp", "public", "place", "2000-01-01");
  f.native.prepare("UPDATE place_policies SET valid_to = '2001-01-01' WHERE place_id = 'exp'").run();
  f.addPolicy("exp", "public", "place", "2002-01-01");
  f.addRecords("r2", "exp", 3);
  assert.equal((await loadPlaceYearCards(f.db, "exp")).length, 3);
});

test("zone and public_cell precision places are excluded from place-level reads", async () => {
  const f = fixture();
  for (const mode of ["zone", "public_cell"]) {
    f.addPlace(`pl-${mode}`, "場所", "private");
    f.addPolicy(`pl-${mode}`, "public", mode, "2000-01-01");
    f.addRecords(`rec-${mode}`, `pl-${mode}`, 3);
    assert.deepEqual((await loadPlaceYearIndex(f.db, `pl-${mode}`)).years, []);
    assert.deepEqual(await loadPlaceYearCards(f.db, `pl-${mode}`), []);
  }
  assert.equal(await resolveDefaultPublicPlace(f.db), null);
});

test("small-count suppression: 1-2 public records expose no years, cards or default place", async () => {
  const f = fixture();
  f.addPlace("tiny", "小さな場所");
  f.addRecord("t1", "tiny", "2008-05-01T00:00:00Z");
  f.addRecord("t2", "tiny", "1999-05-01T00:00:00Z");
  f.addRecord("tx", "tiny", "2009-05-01T00:00:00Z", { visibility: "private" });
  const get = async (path: string) =>
    (await handlePlaceYearReadRequest(new Request(`https://zukan.earth${path}`), f.db, path.split("?")[0]!))!.json();
  assert.deepEqual((await get("/api/v1/places/tiny/years")).years, []);
  assert.deepEqual((await get("/api/v1/places/tiny/records")).cards, []);
  assert.deepEqual((await get("/api/v1/places/tiny/records?until=2000")).cards, []);
  assert.equal(await resolveDefaultPublicPlace(f.db), null);
  f.addRecord("t3", "tiny", "2010-05-01T00:00:00Z");
  assert.deepEqual((await get("/api/v1/places/tiny/years")).years.map((y: { year: number }) => y.year), [1999, 2008, 2010]);
  assert.deepEqual((await get("/api/v1/places/tiny/records?until=2000")).cards.map((c: { visitId: string }) => c.visitId), ["t2"]);
  assert.deepEqual(await resolveDefaultPublicPlace(f.db), { placeId: "tiny", label: "小さな場所" });
});

test("small-count suppression counts distinct visits, not duplicate memberships", async () => {
  const f = fixture();
  f.addPlace("dup", "重複");
  f.addRecords("d", "dup", 2);
  f.native.prepare("INSERT INTO record_place_memberships (membership_id, record_id, place_id, membership_type, membership_state, derivation_source, calculation_version) VALUES ('m-dup', 'd-0', 'dup', 'inside', 'confirmed', 'test', 'v2')").run();
  assert.deepEqual((await loadPlaceYearIndex(f.db, "dup")).years, []);
  assert.deepEqual(await loadPlaceYearCards(f.db, "dup"), []);
  assert.equal(await resolveDefaultPublicPlace(f.db), null);
});

const INELIGIBLE: Array<[string, PlaceOptions]> = [
  ["no-boundary", { boundary: false }],
  ["invalid-boundary", { boundaryState: "unverified" }],
  ["no-osm", { osmId: null }],
  ["unverified-osm", { sourceVerification: "unverified" }],
  ["non-osm-source", { sourceType: "municipality_official" }],
  ["node-osm", { osmId: "node:42" }],
  ["superseded", { superseded: true }],
];

test("place eligibility: places the detail page would 404 or 503 return empty from both endpoints", async () => {
  const f = fixture();
  for (const [id, options] of INELIGIBLE) {
    f.addPlace(id, `場所 ${id}`, "public", "published", options);
    f.addRecords(`r-${id}`, id, 4, "2025-05-01T00:00:00Z");
  }
  f.addPlace("eligible", "公開場所");
  f.addRecords("r-eligible", "eligible", 3, "2001-05-01T00:00:00Z");
  for (const [id] of INELIGIBLE) {
    assert.notEqual((await matchD1PublicPlaceDetail(f.db, id)).state, "eligible", id);
    assert.deepEqual((await loadPlaceYearIndex(f.db, id)).years, [], id);
    assert.deepEqual(await loadPlaceYearCards(f.db, id), [], id);
  }
  assert.equal((await matchD1PublicPlaceDetail(f.db, "eligible")).state, "eligible");
  assert.equal((await loadPlaceYearCards(f.db, "eligible")).length, 3);
  assert.deepEqual(await resolveDefaultPublicPlace(f.db), { placeId: "eligible", label: "公開場所" });
});

test("place eligibility parity: whenever the detail matcher is not eligible, both endpoints are empty", async () => {
  const f = fixture();
  const ids: string[] = [];
  for (const [id, options] of INELIGIBLE) {
    for (const visibility of ["public", "private"]) {
      for (const status of ["published", "draft"]) {
        const placeId = `${id}-${visibility}-${status}`;
        ids.push(placeId);
        f.addPlace(placeId, placeId, visibility, status, options.osmId === "node:42" ? { ...options, osmId: `node:${ids.length}` } : options);
        f.addRecords(`r-${placeId}`, placeId, 3);
      }
    }
  }
  for (const visibility of ["public", "private"]) {
    for (const status of ["published", "draft"]) {
      const placeId = `ok-${visibility}-${status}`;
      ids.push(placeId);
      f.addPlace(placeId, placeId, visibility, status);
      f.addRecords(`r-${placeId}`, placeId, 3);
    }
  }
  let eligibleCount = 0;
  for (const id of ids) {
    const eligible = (await matchD1PublicPlaceDetail(f.db, id)).state === "eligible";
    const years = (await loadPlaceYearIndex(f.db, id)).years;
    const cards = await loadPlaceYearCards(f.db, id);
    if (!eligible) {
      assert.deepEqual(years, [], id);
      assert.deepEqual(cards, [], id);
    } else {
      eligibleCount += 1;
    }
  }
  assert.equal(eligibleCount, 1);
  const fallback = await resolveDefaultPublicPlace(f.db);
  assert.equal(fallback?.placeId, "ok-public-published");
});

test("policy timing compares full timestamps, not calendar days", async () => {
  const f = fixture();
  f.addPlace("later-today", "まもなく非公開");
  f.addPolicy("later-today", "private", "place", isoFromNow(60_000));
  f.addRecords("a", "later-today", 3);
  assert.equal((await loadPlaceYearCards(f.db, "later-today")).length, 3);

  f.addPlace("ending-later", "期限付き非公開");
  f.addPolicy("ending-later", "private", "place", "2001-01-01T00:00:00Z", isoFromNow(60 * 60_000));
  f.addRecords("b", "ending-later", 3);
  assert.deepEqual((await loadPlaceYearIndex(f.db, "ending-later")).years, []);
  assert.deepEqual(await loadPlaceYearCards(f.db, "ending-later"), []);

  f.addPlace("just-ended", "非公開終了");
  f.addPolicy("just-ended", "private", "place", "2001-01-01 00:00:00", isoFromNow(-60_000));
  f.addRecords("c", "just-ended", 3);
  assert.equal((await loadPlaceYearCards(f.db, "just-ended")).length, 3);

  f.addPlace("just-started", "非公開開始");
  f.addPolicy("just-started", "private", "place", isoFromNow(-60_000));
  f.addRecords("d", "just-started", 3);
  assert.deepEqual(await loadPlaceYearCards(f.db, "just-started"), []);
});
