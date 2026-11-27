import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import type { SessionSnapshot } from "./core/shared";
import { loadCloudflarePlaceAtlasProfile } from "./placeAtlasProfileNative";
import { searchD1PublicPlaces } from "./placeRegistryD1";
import { handleMapPlacesBoundsApi } from "./zukanMapView";
import {
  PLACE_REGISTER_RADII,
  circlePolygon,
  guessPlaceKindFromName,
  handlePlaceRegisterRequest,
  haversineMeters,
  injectMapAdminPlaceRegisterButton,
  validatePlaceRegisterInput,
} from "./zukanPlaceRegister";

const MIGRATIONS = "migrations/observations";

function openDb(t: test.TestContext): DatabaseSync {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(`${MIGRATIONS}/${file}`, "utf8"));
  }
  return sqlite;
}

function d1(sqlite: DatabaseSync) {
  const statement = (query: string) => {
    let values: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        values = args;
        return stmt;
      },
      async run() {
        const result = sqlite.prepare(query).run(...(values as never[]));
        return { meta: { changes: Number(result.changes) } };
      },
      async all<T>() {
        return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
      },
      async first<T>() {
        return (sqlite.prepare(query).get(...(values as never[])) ?? null) as T | null;
      },
    };
    return stmt;
  };
  return {
    prepare: statement,
    async batch(statements: Array<{ run(): Promise<unknown> }>) {
      sqlite.exec("BEGIN");
      try {
        const results: unknown[] = [];
        for (const stmt of statements) results.push(await stmt.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

const ADMIN: SessionSnapshot = {
  tokenHash: "h",
  userId: "user_owner",
  displayName: "オーナー",
  roleName: "admin",
  rankLabel: null,
  banned: false,
  expiresAt: "2099-01-01T00:00:00.000Z",
};
const MEMBER: SessionSnapshot = { ...ADMIN, userId: "user_member", roleName: "user" };

type Fixture = { sqlite: DatabaseSync; env: Env; call: (method: string, path: string, body?: unknown, session?: SessionSnapshot | null, headers?: Record<string, string>) => Promise<Response | null> };

function fixture(t: test.TestContext, envExtra: Record<string, unknown> = { PLACE_REGISTER_ENABLED: "true" }): Fixture {
  const sqlite = openDb(t);
  const env = { OBS_DB: d1(sqlite), ...envExtra } as unknown as Env;
  let counter = 0;
  const call: Fixture["call"] = (method, path, body, session = ADMIN, headers = {}) =>
    handlePlaceRegisterRequest(
      new Request(`https://zukan.earth${path}`, {
        method,
        headers: { "content-type": "application/json", ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
      { readSession: async () => session, newId: () => `plc_${String(++counter).padStart(16, "0")}` }
    );
  return { sqlite, env, call };
}

const PARK = { name: "テスト公園", kind: "park", lat: 34.8, lng: 137.78, radiusM: 300, locality: "浜松市" };

const count = (sqlite: DatabaseSync, table: string): number =>
  Number((sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);

test("validation: name, kind, Japan bbox, radius set, locality", () => {
  const ok = validatePlaceRegisterInput(PARK);
  assert.equal(ok.ok, true);
  const bad = (patch: Record<string, unknown>) => {
    const result = validatePlaceRegisterInput({ ...PARK, ...patch });
    return result.ok ? "ok" : result.error;
  };
  assert.equal(bad({ name: "" }), "invalid_name");
  assert.equal(bad({ name: "   " }), "invalid_name");
  assert.equal(bad({ name: "あ".repeat(81) }), "invalid_name");
  assert.equal(bad({ name: "あ".repeat(80) }), "ok");
  assert.equal(bad({ name: "a\u0000b" }), "invalid_name");
  assert.equal(bad({ name: 12 }), "invalid_name");
  assert.equal(bad({ kind: "castle" }), "invalid_kind");
  assert.equal(bad({ kind: undefined }), "ok");
  assert.equal(bad({ kind: 5 }), "invalid_kind");
  assert.equal(bad({ lat: 19.99 }), "invalid_location");
  assert.equal(bad({ lat: 46.01 }), "invalid_location");
  assert.equal(bad({ lng: 121.9 }), "invalid_location");
  assert.equal(bad({ lng: 154.1 }), "invalid_location");
  assert.equal(bad({ lat: Number.NaN }), "invalid_location");
  assert.equal(bad({ lat: "abc" }), "invalid_location");
  assert.equal(bad({ lat: null }), "invalid_location");
  assert.equal(bad({ lat: "34.8", lng: "137.78" }), "ok");
  assert.equal(bad({ radiusM: 75 }), "invalid_radius");
  assert.equal(bad({ radiusM: "wide" }), "invalid_radius");
  for (const radius of PLACE_REGISTER_RADII) assert.equal(bad({ radiusM: radius }), "ok");
  assert.equal(bad({ locality: "あ".repeat(81) }), "invalid_locality");
  const shopDefault = validatePlaceRegisterInput({ name: "店", kind: "shop", lat: 34.8, lng: 137.78 });
  assert.equal(shopDefault.ok && shopDefault.value.radiusM, 100);
  const parkDefault = validatePlaceRegisterInput({ name: "公園", kind: "park", lat: 34.8, lng: 137.78 });
  assert.equal(parkDefault.ok && parkDefault.value.radiusM, 300);
});

test("circle polygon is closed, 24 points, and centered with the requested radius", () => {
  for (const radius of PLACE_REGISTER_RADII) {
    const geometry = circlePolygon(34.8, 137.78, radius);
    const ring = (geometry.coordinates as number[][][])[0]!;
    assert.equal(ring.length, 25);
    assert.deepEqual(ring[0], ring[24]);
    for (const [lng, lat] of ring) {
      const distance = haversineMeters(34.8, 137.78, lat!, lng!);
      assert.ok(Math.abs(distance - radius) / radius < 0.01, `${radius}: ${distance}`);
    }
  }
});

test("everything is 404 unless the flag is on AND the viewer is an admin", async (t) => {
  const off = fixture(t, {});
  for (const [method, path] of [["GET", "/ja/admin/places/new"], ["POST", "/api/v1/admin/places"], ["POST", "/api/v1/admin/places/plc_x/private"]] as const) {
    const res = await off.call(method, path, method === "POST" ? PARK : undefined);
    assert.equal(res?.status, 404, `flag off ${method} ${path}`);
  }
  assert.equal(count(off.sqlite, "places"), 0);

  const on = fixture(t);
  for (const [method, path] of [["GET", "/ja/admin/places/new"], ["POST", "/api/v1/admin/places"], ["POST", "/api/v1/admin/places/plc_x/private"]] as const) {
    assert.equal((await on.call(method, path, method === "POST" ? PARK : undefined, MEMBER))?.status, 404, `member ${method} ${path}`);
    assert.equal((await on.call(method, path, method === "POST" ? PARK : undefined, null))?.status, 404, `anonymous ${method} ${path}`);
    assert.equal((await on.call(method, path, method === "POST" ? PARK : undefined, { ...ADMIN, banned: true }))?.status, 404, `banned ${method} ${path}`);
    assert.equal((await on.call(method, path, method === "POST" ? PARK : undefined, { ...ADMIN, roleName: "analyst" }))?.status, 404, `analyst ${method} ${path}`);
  }
  assert.equal(count(on.sqlite, "places"), 0);
  assert.equal((await on.call("GET", "/ja/admin/places/new"))?.status, 200);
  assert.equal((await on.call("PUT", "/api/v1/admin/places", PARK))?.status, 404);
  assert.equal((await on.call("POST", "/ja/admin/places/new", PARK))?.status, 404);
  assert.equal(await on.call("GET", "/ja/places/plc_x"), null);
  assert.equal(await on.call("GET", "/ja/admin/places/other"), null);
});

test("rollout allowlist limits the screen to the listed admin", async (t) => {
  const rollout = JSON.stringify({ PLACE_REGISTER_ENABLED: { state: "allowlist", allowlist: ["user_owner"], expiresOn: "2099-01-01", removeBy: "2099-01-08" } });
  const f = fixture(t, { ZUKAN_FEATURE_ROLLOUTS: rollout });
  assert.equal((await f.call("GET", "/ja/admin/places/new"))?.status, 200);
  assert.equal((await f.call("GET", "/ja/admin/places/new", undefined, { ...ADMIN, userId: "user_other_admin" }))?.status, 404);
  const closed = fixture(t, { ZUKAN_FEATURE_ROLLOUTS: JSON.stringify({ PLACE_REGISTER_ENABLED: { state: "off" } }), PLACE_REGISTER_ENABLED: "true" });
  assert.equal((await closed.call("GET", "/ja/admin/places/new"))?.status, 404);
});

test("POST requires same origin and valid input", async (t) => {
  const f = fixture(t);
  const cross = await f.call("POST", "/api/v1/admin/places", PARK, ADMIN, { origin: "https://evil.example" });
  assert.equal(cross?.status, 403);
  const site = await f.call("POST", "/api/v1/admin/places", PARK, ADMIN, { "sec-fetch-site": "cross-site" });
  assert.equal(site?.status, 403);
  assert.equal(count(f.sqlite, "places"), 0);
  const same = await f.call("POST", "/api/v1/admin/places", PARK, ADMIN, { origin: "https://zukan.earth" });
  assert.equal(same?.status, 201);
  for (const body of [{ ...PARK, name: "" }, { ...PARK, lat: 10 }, { ...PARK, radiusM: 5 }, { ...PARK, kind: "x" }]) {
    const res = await f.call("POST", "/api/v1/admin/places", body);
    assert.equal(res?.status, 400);
  }
  const broken = await handlePlaceRegisterRequest(
    new Request("https://zukan.earth/api/v1/admin/places", { method: "POST", body: "{not json" }),
    f.env,
    { readSession: async () => ADMIN }
  );
  assert.equal(broken?.status, 400);
  assert.equal(count(f.sqlite, "places"), 1);
});

test("success writes the published place, owner source, circle boundary and policy atomically", async (t) => {
  const f = fixture(t);
  const res = await f.call("POST", "/api/v1/admin/places", PARK);
  assert.equal(res?.status, 201);
  const body = (await res!.json()) as { ok: boolean; place: { placeId: string; url: string } };
  assert.equal(body.ok, true);
  const id = body.place.placeId;
  assert.equal(body.place.url, `/ja/places/${id}`);

  const place = f.sqlite.prepare("SELECT * FROM places WHERE place_id = ?").get(id) as Record<string, string>;
  assert.equal(place.canonical_name, "テスト公園");
  assert.equal(place.canonical_name_normalized, "テスト公園");
  assert.equal(place.place_kind, "park");
  assert.equal(place.locality_label, "浜松市");
  assert.equal(place.public_profile_status, "published");
  assert.equal(place.verification_status, "owner_registered");
  assert.equal(place.official_status, "unofficial");
  assert.equal(place.valid_to, null);
  assert.equal(place.superseded_by_place_id, null);
  assert.deepEqual(JSON.parse(place.metadata_json!), { via: "admin_place_register", createdBy: "user_owner", registerKind: "park", radiusM: 300, lat: 34.8, lng: 137.78 });

  const source = f.sqlite.prepare("SELECT * FROM place_source_references WHERE place_id = ?").all(id) as Array<Record<string, unknown>>;
  assert.equal(source.length, 1);
  assert.equal(source[0]!.source_type, "owner_registered");
  assert.equal(source[0]!.source_id, id);
  assert.equal(source[0]!.verification_status, "source_verified");

  const boundaries = f.sqlite.prepare("SELECT * FROM place_boundaries WHERE place_id = ?").all(id) as Array<Record<string, any>>;
  assert.equal(boundaries.length, 1);
  const boundary = boundaries[0]!;
  assert.equal(boundary.is_primary, 1);
  assert.equal(boundary.validation_state, "valid");
  assert.equal(boundary.source_reference_id, source[0]!.source_reference_id);
  assert.equal(boundary.geometry_kind, "Polygon");
  const ring = (JSON.parse(boundary.boundary_geojson).coordinates as number[][][])[0]!;
  assert.equal(ring.length, 25);
  assert.ok(Math.abs((boundary.bbox_south + boundary.bbox_north) / 2 - 34.8) < 1e-5);
  assert.ok(Math.abs((boundary.bbox_west + boundary.bbox_east) / 2 - 137.78) < 1e-5);
  assert.ok(boundary.area_ha > 20 && boundary.area_ha < 30);

  const policy = f.sqlite.prepare("SELECT * FROM place_policies WHERE place_id = ?").all(id) as Array<Record<string, unknown>>;
  assert.equal(policy.length, 1);
  assert.equal(policy[0]!.place_visibility, "public");
  assert.equal(policy[0]!.recording_policy, "check_rules");
});

test("kinds map to existing place kinds and the radius default follows the kind", async (t) => {
  const f = fixture(t);
  const cases: Array<[string, string]> = [["park", "park"], ["shop", "commercial_complex"], ["org", "other_named_area"], ["facility", "public_facility"], ["other", "other_named_area"]];
  let lng = 137.1;
  for (const [kind, placeKind] of cases) {
    lng += 0.1;
    const res = await f.call("POST", "/api/v1/admin/places", { name: `場所-${kind}`, kind, lat: 34.8, lng });
    assert.equal(res?.status, 201, kind);
    const id = ((await res!.json()) as { place: { placeId: string } }).place.placeId;
    const row = f.sqlite.prepare("SELECT place_kind, metadata_json FROM places WHERE place_id = ?").get(id) as { place_kind: string; metadata_json: string };
    assert.equal(row.place_kind, placeKind, kind);
    assert.equal(JSON.parse(row.metadata_json).radiusM, kind === "park" ? 300 : 100);
  }
});

test("dedupe refuses a published place with the same normalized name within 200 m", async (t) => {
  const f = fixture(t);
  const first = await f.call("POST", "/api/v1/admin/places", PARK);
  const firstId = ((await first!.json()) as { place: { placeId: string } }).place.placeId;

  const near = await f.call("POST", "/api/v1/admin/places", { ...PARK, name: " テスト　公園 ", lat: 34.8 + 0.0015, radiusM: 100 });
  assert.equal(near?.status, 409);
  const nearBody = (await near!.json()) as { error: string; placeId: string; url: string };
  assert.equal(nearBody.error, "duplicate_place");
  assert.equal(nearBody.placeId, firstId);
  assert.equal(nearBody.url, `/ja/places/${firstId}`);
  assert.equal(count(f.sqlite, "places"), 1);
  assert.equal(count(f.sqlite, "place_boundaries"), 1);

  const far = await f.call("POST", "/api/v1/admin/places", { ...PARK, lat: 34.8 + 0.003 });
  assert.equal(far?.status, 201);
  const otherName = await f.call("POST", "/api/v1/admin/places", { ...PARK, name: "別の公園" });
  assert.equal(otherName?.status, 201);

  await f.call("POST", `/api/v1/admin/places/${firstId}/private`);
  const afterPrivate = await f.call("POST", "/api/v1/admin/places", { ...PARK, lat: 34.8 + 0.0005 });
  assert.equal(afterPrivate?.status, 201);
});

test("a failing batch leaves no partial rows", async (t) => {
  const f = fixture(t);
  f.sqlite.exec(`INSERT INTO place_boundaries (boundary_id, place_id, geometry_kind, boundary_geojson, source_type)
                 VALUES ('bnd_plc_clash_v1', 'x', 'Polygon', '{}', 'osm')`);
  const res = await handlePlaceRegisterRequest(
    new Request("https://zukan.earth/api/v1/admin/places", { method: "POST", body: JSON.stringify(PARK) }),
    f.env,
    { readSession: async () => ADMIN, newId: () => "plc_clash" }
  );
  assert.equal(res?.status, 500);
  assert.equal(count(f.sqlite, "places"), 0);
  assert.equal(count(f.sqlite, "place_source_references"), 0);
  assert.equal(count(f.sqlite, "place_policies"), 0);
  assert.equal(count(f.sqlite, "place_boundaries"), 1);
});

test("the new place appears in the public map query near it, not far from it", async (t) => {
  const f = fixture(t);
  const res = await f.call("POST", "/api/v1/admin/places", PARK);
  const id = ((await res!.json()) as { place: { placeId: string } }).place.placeId;
  const near = await handleMapPlacesBoundsApi(new URL("https://zukan.earth/api/v1/map/places?lat=34.801&lng=137.781"), f.env.OBS_DB);
  const places = ((await near.json()) as { places: Array<{ placeId: string; name: string; lat: number; lng: number }> }).places;
  assert.equal(places.length, 1);
  assert.equal(places[0]!.placeId, id);
  assert.equal(places[0]!.name, "テスト公園");
  assert.ok(Math.abs(places[0]!.lat - 34.8) < 1e-5 && Math.abs(places[0]!.lng - 137.78) < 1e-5);
  const far = await handleMapPlacesBoundsApi(new URL("https://zukan.earth/api/v1/map/places?lat=35.68&lng=139.76"), f.env.OBS_DB);
  assert.deepEqual(((await far.json()) as { places: unknown[] }).places, []);
});

test("public search finds it as an owner-registered source and the place atlas loads inside the circle", async (t) => {
  const f = fixture(t);
  const res = await f.call("POST", "/api/v1/admin/places", { ...PARK, name: "円の公園", radiusM: 300 });
  const id = ((await res!.json()) as { place: { placeId: string } }).place.placeId;

  const search = await searchD1PublicPlaces({ db: f.env.OBS_DB as never, query: id, limit: 2 });
  const hit = search.results.find((candidate) => candidate.canonicalPlaceId === id);
  assert.ok(hit);
  assert.equal(hit.osmSourceId, null);
  assert.equal(hit.source?.sourceType, "owner_registered");
  assert.equal(hit.canonicalName, "円の公園");

  const profile = await loadCloudflarePlaceAtlasProfile({
    db: f.env.OBS_DB as never,
    placeRef: { kind: "registered_place", placeId: id },
    generatedAt: "2026-11-27T00:00:00Z",
    fetchFn: async () => {
      throw new Error("no network");
    },
  });
  assert.ok(profile);
  assert.equal(profile.place.name, "円の公園");
  assert.equal(profile.place.canonicalPlaceId, id);
  assert.equal(profile.placeRef.kind, "registered_place");
  assert.equal(profile.policy?.placeVisibility, "public");
  assert.equal(profile.publication.locationMode, "registered_place");
  assert.equal(profile.provenance.sourceReferences?.[0]?.sourceType, "owner_registered");
  assert.doesNotMatch(JSON.stringify(profile), /exact_lat|exact_lng/);
});

test("place atlas counts public records inside the circle and leaves out the ones outside", async (t) => {
  const f = fixture(t);
  const res = await f.call("POST", "/api/v1/admin/places", { ...PARK, name: "数える公園", radiusM: 300 });
  const id = ((await res!.json()) as { place: { placeId: string } }).place.placeId;
  const addRecord = (visitId: string, lat: number, lng: number, name: string) => {
    const cell = `${(Math.round(lat * 100) / 100).toFixed(2)},${(Math.round(lng * 100) / 100).toFixed(2)}`;
    f.sqlite.prepare(`INSERT INTO public_map_snapshot_records_v1
      (snapshot_key, occurrence_id, visit_id, observed_at, observed_year, taxon_group, display_name, cell_1000, cell_3000, cell_10000)
      VALUES ('public-map:v1:global', ?, ?, '2026-11-01T00:00:00.000Z', 2026, 'bird', ?, ?, ?, ?)`).run(`occ:${visitId}`, visitId, name, cell, cell, cell);
    f.sqlite.prepare("INSERT INTO production_import_visits (visit_id, exact_lat, exact_lng, public_visibility, observed_at) VALUES (?, ?, ?, 'public', '2026-11-01T00:00:00.000Z')").run(visitId, lat, lng);
    f.sqlite.prepare("INSERT INTO observation_data_rights (visit_id, record_consent, withdrawal_status) VALUES (?, 'public_summary', 'active')").run(visitId);
  };
  addRecord("in-1", 34.8005, 137.7805, "スズメ");
  addRecord("in-2", 34.7985, 137.7795, "ヒヨドリ");
  addRecord("in-3", 34.7995, 137.7802, "メジロ");
  addRecord("out-1", 34.805, 137.78, "遠いカラス");
  const profile = await loadCloudflarePlaceAtlasProfile({
    db: f.env.OBS_DB as never,
    placeRef: { kind: "registered_place", placeId: id },
    generatedAt: "2026-11-27T00:00:00Z",
  });
  assert.ok(profile);
  const names = (profile.recentRecords ?? []).map((record) => record.displayName).sort();
  assert.deepEqual(names, ["スズメ", "ヒヨドリ", "メジロ"]);
  assert.equal(profile.summary.recordCount, 3);
});

test("make-private hides the place from map and search, only for places registered here", async (t) => {
  const f = fixture(t);
  const res = await f.call("POST", "/api/v1/admin/places", PARK);
  const id = ((await res!.json()) as { place: { placeId: string } }).place.placeId;
  f.sqlite.exec(`INSERT INTO places (place_id, canonical_name, canonical_name_normalized, public_profile_status, metadata_json)
                 VALUES ('plc_osm_seed', '常磐公園', '常磐公園', 'published', '{"seedVersion":"v1"}')`);

  const refused = await f.call("POST", "/api/v1/admin/places/plc_osm_seed/private");
  assert.equal(refused?.status, 404);
  assert.equal((f.sqlite.prepare("SELECT public_profile_status AS s FROM places WHERE place_id = 'plc_osm_seed'").get() as { s: string }).s, "published");

  const done = await f.call("POST", `/api/v1/admin/places/${id}/private`);
  assert.equal(done?.status, 200);
  assert.equal((f.sqlite.prepare("SELECT public_profile_status AS s FROM places WHERE place_id = ?").get(id) as { s: string }).s, "private");
  assert.equal(count(f.sqlite, "places"), 2);
  assert.equal(count(f.sqlite, "place_boundaries"), 1);

  const map = await handleMapPlacesBoundsApi(new URL("https://zukan.earth/api/v1/map/places?lat=34.8&lng=137.78"), f.env.OBS_DB);
  assert.deepEqual(((await map.json()) as { places: unknown[] }).places, []);
  const search = await searchD1PublicPlaces({ db: f.env.OBS_DB as never, query: id, limit: 2 });
  assert.deepEqual(search.results, []);

  const again = await f.call("POST", `/api/v1/admin/places/${id}/private`);
  assert.equal(again?.status, 404);
});

test("the form page lists the last 20 own registrations, escapes names, and offers 非公開に戻す only while published", async (t) => {
  const f = fixture(t);
  for (let index = 0; index < 22; index += 1) {
    const res = await f.call("POST", "/api/v1/admin/places", { name: index === 21 ? "<b>危ない</b>名前" : `場所${index}`, kind: "shop", lat: 34.8, lng: 137 + index * 0.05 });
    assert.equal(res?.status, 201);
  }
  const listed = f.sqlite.prepare("SELECT place_id FROM places WHERE canonical_name = '場所20'").get() as { place_id: string };
  await f.call("POST", `/api/v1/admin/places/${listed.place_id}/private`);
  f.sqlite.exec(`UPDATE places SET metadata_json = json_set(metadata_json, '$.createdBy', 'someone_else') WHERE canonical_name = '場所0'`);

  const page = await f.call("GET", "/ja/admin/places/new");
  assert.equal(page?.status, 200);
  assert.match(page!.headers.get("content-type") ?? "", /text\/html/);
  assert.equal(page!.headers.get("cache-control"), "private, no-store");
  const html = await page!.text();
  assert.match(html, /場所を登録/);
  assert.match(html, /ここを登録/);
  assert.match(html, /非公開に戻す/);
  assert.match(html, /公園・自然/);
  assert.match(html, /50m/);
  assert.match(html, /1km/);
  assert.match(html, /min-height:52px/);
  assert.doesNotMatch(html, /<b>危ない<\/b>/);
  assert.match(html, /&lt;b&gt;危ない&lt;\/b&gt;名前/);
  const items = html.match(/data-pr-item="/g) ?? [];
  assert.equal(items.length, 20);
  assert.doesNotMatch(html, />場所0</);
  assert.doesNotMatch(html, /場所1</);
  assert.match(html, /<span class="pr-state">非公開<\/span>/);
});

test("worker serves /ja/places/<id> for an owner-registered place and keeps the register routes closed without a session", async (t) => {
  const { worker } = await import("./index");
  const f = fixture(t);
  const core = { prepare() { const s: Record<string, unknown> = { bind: () => s, run: async () => ({ meta: {} }), all: async () => ({ results: [] }), first: async () => null }; return s; } };
  const env = { ...f.env, CORE_DB: core, ENVIRONMENT: "test" } as unknown as Env;
  const res = await f.call("POST", "/api/v1/admin/places", { ...PARK, name: "ページ公園" });
  const id = ((await res!.json()) as { place: { placeId: string } }).place.placeId;
  const page = await worker.fetch(new Request(`https://zukan.earth/ja/places/${id}`), env);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /ページ公園/);
  const closed = await worker.fetch(new Request("https://zukan.earth/ja/admin/places/new"), env);
  assert.equal(closed.status, 404);
  const closedPost = await worker.fetch(new Request("https://zukan.earth/api/v1/admin/places", { method: "POST", body: JSON.stringify(PARK) }), env);
  assert.equal(closedPost.status, 404);
  await f.call("POST", `/api/v1/admin/places/${id}/private`);
  const hidden = await worker.fetch(new Request(`https://zukan.earth/ja/places/${id}`), env);
  assert.equal(hidden.status, 404);
});

test("guessPlaceKindFromName maps names to kind and radius", () => {
  const cases: Array<[string, string, number]> = [
    ["浜松城公園", "park", 300], ["佐鳴湖", "park", 1000], ["天竜川", "park", 300], ["入野の森", "park", 1000], ["弁天島海岸", "park", 300], ["春野の湿地", "park", 1000], ["自然観察広場", "park", 300],
    ["五社神社", "facility", 100], ["龍潭寺", "facility", 100], ["浜松城跡", "facility", 100], ["蜆塚遺跡", "facility", 100],
    ["珈琲ひなた店", "shop", 50], ["カフェ木漏れ日", "shop", 50], ["山田食堂", "shop", 50], ["鰻の亭", "shop", 50], ["ベーカリー麦", "shop", 50],
    ["株式会社イカン", "org", 100], ["浜松自然協会", "org", 100], ["○○(株)", "org", 100], ["静岡大学", "org", 100], ["有限会社山田", "org", 100],
    ["私の庭", "other", 100], ["", "other", 100],
  ];
  for (const [name, kind, radiusM] of cases) assert.deepEqual(guessPlaceKindFromName(name), { kind, radiusM }, name);
});

test("POST with only name/lat/lng guesses kind and radius; explicit values win", async (t) => {
  const f = fixture(t);
  const meta = (id: string) => JSON.parse((f.sqlite.prepare("SELECT metadata_json FROM places WHERE place_id = ?").get(id) as { metadata_json: string }).metadata_json) as { registerKind: string; radiusM: number };
  const a = await f.call("POST", "/api/v1/admin/places", { name: "佐鳴湖", lat: 34.7, lng: 137.7 });
  assert.equal(a?.status, 201);
  assert.deepEqual([meta((await a!.json() as { place: { placeId: string } }).place.placeId).registerKind, 1000], ["park", 1000]);
  const b = await f.call("POST", "/api/v1/admin/places", { name: "ひなた食堂", lat: 34.9, lng: 137.9 });
  const bm = meta((await b!.json() as { place: { placeId: string } }).place.placeId);
  assert.deepEqual([bm.registerKind, bm.radiusM], ["shop", 50]);
  const c = await f.call("POST", "/api/v1/admin/places", { name: "ひなた食堂", kind: "org", radiusM: 300, lat: 34.95, lng: 137.95 });
  const cm = meta((await c!.json() as { place: { placeId: string } }).place.placeId);
  assert.deepEqual([cm.registerKind, cm.radiusM], ["org", 300]);
});

test("page: only name and the register button are outside the details block", async (t) => {
  const f = fixture(t);
  const html = await (await f.call("GET", "/ja/admin/places/new"))!.text();
  assert.match(html, /ここを登録/);
  assert.match(html, /watchPosition/);
  assert.match(html, /enterkeyhint="done"/);
  const open = html.indexOf('<details class="pr-more">');
  const close = html.indexOf("</details>");
  assert.ok(open > 0 && close > open);
  const inside = html.slice(open, close);
  const outside = html.slice(0, open);
  for (const id of ["pr-kind", "pr-radius", "pr-lat", "pr-lng", "pr-locality"]) {
    assert.ok(inside.includes('id="' + id + '"'), id);
    assert.ok(!outside.includes('id="' + id + '"'), id);
  }
  assert.ok(outside.includes('id="pr-name"') && outside.includes('id="pr-submit"'));
  assert.ok(inside.includes("<summary>詳しく</summary>"));
});

test("injectMapAdminPlaceRegisterButton injects only when enabled", () => {
  const sample = '<!doctype html><html><body><div class="me-map-wrap"><div id="map-explorer"></div><button type="button" class="me-search-area-btn"></button></div></body></html>';
  assert.equal(injectMapAdminPlaceRegisterButton(sample, false), sample);
  const injected = injectMapAdminPlaceRegisterButton(sample, true);
  assert.match(injected, /<a class="me-admin-place-register" data-map-place-register href="\/ja\/admin\/places\/new">ここを場所に登録<\/a><button type="button" class="me-search-area-btn/);
  assert.ok(!sample.includes("ここを場所に登録"));
  assert.ok(!sample.includes("/ja/admin/places/new"));
});
