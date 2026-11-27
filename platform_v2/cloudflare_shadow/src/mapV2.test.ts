import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "./index";
import type { Env } from "./core/env";
import * as mapV2Flag from "./flags/MAP_V2_ENABLED";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import { handleMapPlacesBoundsApi, mapPlaceCardFromProfile, selectUnknownCountCandidates } from "./zukanMapView";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

function setupHamamatsuDb(t: test.TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE places (
      place_id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      place_kind TEXT DEFAULT 'park',
      locality_label TEXT DEFAULT '浜松市',
      public_profile_status TEXT NOT NULL DEFAULT 'published',
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
    CREATE TABLE record_place_memberships (
      record_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      public_precision TEXT NOT NULL,
      membership_state TEXT NOT NULL,
      removed_at TEXT
    );
    CREATE TABLE production_import_visits (
      visit_id TEXT PRIMARY KEY,
      observed_at TEXT,
      public_visibility TEXT,
      owner_user_id TEXT
    );
    CREATE TABLE production_import_occurrences (
      occurrence_id TEXT PRIMARY KEY,
      visit_id TEXT NOT NULL,
      taxon_rank TEXT,
      vernacular_name TEXT,
      scientific_name TEXT
    );
    CREATE TABLE observation_data_rights (
      visit_id TEXT PRIMARY KEY,
      withdrawal_status TEXT,
      record_consent TEXT
    );
  `);
  const ins = sqlite.prepare("INSERT INTO places (place_id, canonical_name, place_kind) VALUES (?, ?, ?)");
  const bnd = sqlite.prepare("INSERT INTO place_boundaries (boundary_id, place_id, is_primary, bbox_west, bbox_south, bbox_east, bbox_north) VALUES (?, ?, 1, ?, ?, ?, ?)");

  // Recorded place near Hamamatsu Station
  ins.run("p-sanaru", "佐鳴湖公園", "park");
  bnd.run("b-sanaru", "p-sanaru", 137.701, 34.705, 137.703, 34.707);
  sqlite.prepare("INSERT INTO record_place_memberships VALUES (?, ?, 'place', 'confirmed', NULL)").run("v-1", "p-sanaru");
  sqlite.prepare("INSERT INTO production_import_visits VALUES (?, '2026-10-01', 'public', 'user-yui')").run("v-1");
  sqlite.prepare("INSERT INTO production_import_occurrences VALUES ('occ-1', 'v-1', 'bird', 'アライグマ', 'Procyon lotor')").run();
  sqlite.prepare("INSERT INTO observation_data_rights VALUES ('v-1', 'active', 'public_summary')").run();

  // 310 zero-record places around Hamamatsu Station
  for (let i = 0; i < 310; i++) {
    const id = `p-zero-${i + 1}`;
    const lat = 34.68 + Math.floor(i / 20) * 0.004;
    const lng = 137.71 + (i % 20) * 0.004;
    ins.run(id, i === 0 ? "都田総合公園" : `浜松の公園 ${i + 1}`, "park");
    bnd.run(`b-z-${i + 1}`, id, lng - 0.0005, lat - 0.0005, lng + 0.0005, lat + 0.0005);
  }
  return sqliteObsDb(sqlite);
}

test("MAP_V2_ENABLED is default off in both staging and production", () => {
  assert.equal(mapV2Flag.flag, "MAP_V2_ENABLED");
  assert.equal(mapV2Flag.staging, false);
  assert.equal(mapV2Flag.production, false);
  const reg = PROTOTYPE_FLAGS.find((f) => f.flag === "MAP_V2_ENABLED");
  assert.ok(reg);
  assert.equal(reg.stagingEnabled, false);
});

test("/api/v1/map/places?v2=1 loads 310+ places, hides ownCount when logged out, filters 0-record when taxon_group set, and supports name search q", async (t) => {
  const db = setupHamamatsuDb(t);

  // Guest request with v2=1 & limit=400 around Hamamatsu Station
  const resGuest = await handleMapPlacesBoundsApi(
    new URL("https://zukan.earth/api/v1/map/places?lat=34.705&lng=137.72&radiusKm=15&v2=1&limit=400"),
    db,
  );
  assert.equal(resGuest.status, 200);
  const guestBody = (await resGuest.json()) as { ok: boolean; places: Array<{ placeId: string; recordCount: number | null; ownCount?: number | null; invasive?: boolean }> };
  assert.equal(guestBody.ok, true);
  assert.equal(guestBody.places.length, 311);
  const sanaruGuest = guestBody.places.find((p) => p.placeId === "p-sanaru");
  assert.equal(sanaruGuest?.recordCount, 1);
  assert.equal(sanaruGuest?.ownCount ?? null, null);
  assert.equal(sanaruGuest?.invasive, true);

  // Logged-in owner sees ownCount=1 on p-sanaru
  const resOwner = await handleMapPlacesBoundsApi(
    new URL("https://zukan.earth/api/v1/map/places?lat=34.705&lng=137.72&radiusKm=15&v2=1&limit=400"),
    db,
    undefined,
    { viewerUserId: "user-yui" },
  );
  const ownerBody = (await resOwner.json()) as typeof guestBody;
  assert.equal(ownerBody.places.find((p) => p.placeId === "p-sanaru")?.ownCount, 1);

  // When taxon_group is active, zero-record places are excluded
  const resFiltered = await handleMapPlacesBoundsApi(
    new URL("https://zukan.earth/api/v1/map/places?lat=34.705&lng=137.72&radiusKm=15&v2=1&limit=400&taxon_group=bird"),
    db,
  );
  const filteredBody = (await resFiltered.json()) as typeof guestBody;
  assert.deepEqual(filteredBody.places.map((p) => p.placeId), ["p-sanaru"]);

  // Name search q still finds zero-record place by name
  const resSearch = await handleMapPlacesBoundsApi(
    new URL("https://zukan.earth/api/v1/map/places?lat=34.705&lng=137.72&radiusKm=15&v2=1&q=都田総合公園"),
    db,
  );
  const searchBody = (await resSearch.json()) as typeof guestBody;
  assert.equal(searchBody.places.some((p) => p.placeId === "p-zero-1"), true);
});

test("/api/v1/map/places?v2=1 returns nearestRecorded when viewport has zero recorded places", async (t) => {
  const db = setupHamamatsuDb(t);
  // Tight 2km radius around distant zero-record corner (34.736, 137.786) where p-sanaru (~9km away) is outside bounds
  const res = await handleMapPlacesBoundsApi(
    new URL("https://zukan.earth/api/v1/map/places?lat=34.736&lng=137.786&radiusKm=2&v2=1&limit=400"),
    db,
  );
  const body = (await res.json()) as { places: Array<{ placeId: string; recordCount: number | null }>; nearestRecorded?: { placeId: string; name: string } | null };
  assert.ok(body.places.length > 0);
  assert.equal(body.places.every((p) => (p.recordCount ?? 0) === 0), true);
  assert.equal(body.nearestRecorded?.placeId, "p-sanaru");
});

test("/ja/map serves MAP_V2 HTML only when MAP_V2_ENABLED is enabled in rollout", async () => {
  const baseEnv = {
    ENVIRONMENT: "staging",
    UI_ORIGIN: "https://example.invalid",
    ASSET_BUCKET: {
      async get(key: string) {
        if (key.startsWith("original-ui/current/")) return null;
        return {
          body: "<!doctype html><html><body>legacy map</body></html>",
          httpMetadata: { contentType: "text/html; charset=utf-8" },
        };
      },
    },
  } as unknown as Env;

  const offRes = await worker.fetch(new Request("https://zukan.earth/ja/map"), baseEnv);
  assert.equal(offRes.status, 200);
  assert.equal(offRes.headers.get("x-ikimon-cloudflare-native"), null);
  assert.match(await offRes.text(), /legacy map/);

  const onEnv = {
    ...baseEnv,
    ZUKAN_FEATURE_ROLLOUTS: JSON.stringify({
      MAP_V2_ENABLED: { state: "all" },
    }),
  } as unknown as Env;
  const onRes = await worker.fetch(new Request("https://zukan.earth/ja/map"), onEnv);
  assert.equal(onRes.status, 200);
  assert.equal(onRes.headers.get("x-ikimon-cloudflare-native"), "zukan-map-v2");
  const html = await onRes.text();
  assert.match(html, /data-map-v2="1"/);
  assert.match(html, /まだ記録のない場所/);
});

test("selectUnknownCountCandidates picks only places whose bbox cells hold snapshot records and caps the count", () => {
  const mk = (placeId: string, lat: number, lng: number) => ({ placeId, lat, lng, bboxSouth: lat - 0.0002, bboxNorth: lat + 0.0002, bboxWest: lng - 0.0002, bboxEast: lng + 0.0002 });
  const counts = new Map<string, number>([["34.81,137.73", 5]]);
  const picked = selectUnknownCountCandidates([mk("a", 34.8142, 137.733), mk("b", 34.70, 137.60), mk("c", 34.8139, 137.7331)], counts, 1);
  assert.deepEqual(picked.candidates, ["a"]);
  assert.deepEqual(picked.overflow, ["c"]);
  assert.deepEqual(selectUnknownCountCandidates([mk("b", 34.70, 137.60)], counts).candidates, []);
});

test("/api/v1/map/places?v2=1 computes the place-page count for places without memberships and returns null (unknown) when the loader fails", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, place_kind TEXT DEFAULT 'park', locality_label TEXT, public_profile_status TEXT NOT NULL DEFAULT 'published', superseded_by_place_id TEXT);
    CREATE TABLE place_boundaries (boundary_id TEXT PRIMARY KEY, place_id TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0, boundary_version INTEGER NOT NULL DEFAULT 1, valid_to TEXT, superseded_by_boundary_id TEXT, bbox_west REAL, bbox_south REAL, bbox_east REAL, bbox_north REAL);
    CREATE TABLE public_map_snapshot_records_v1 (snapshot_key TEXT, visit_id TEXT, cell_1000 TEXT);
  `);
  const ins = sqlite.prepare("INSERT INTO places (place_id, canonical_name) VALUES (?, ?)");
  const bnd = sqlite.prepare("INSERT INTO place_boundaries (boundary_id, place_id, is_primary, bbox_west, bbox_south, bbox_east, bbox_north) VALUES (?, ?, 1, ?, ?, ?, ?)");
  ins.run("plc_renri", "連理の木の下で");
  bnd.run("b1", "plc_renri", 137.7328, 34.8140, 137.7331, 34.8143);
  ins.run("plc_far", "遠い公園");
  bnd.run("b2", "plc_far", 137.7500, 34.8300, 137.7502, 34.8302);
  sqlite.prepare("INSERT INTO public_map_snapshot_records_v1 VALUES ('public-map:v1:global', 'v1', '34.81,137.73')").run();
  const db = sqliteObsDb(sqlite);
  const url = new URL("https://zukan.earth/api/v1/map/places?lat=34.8142&lng=137.733&radiusKm=10&v2=1&limit=400");
  const profile = { summary: { recordCount: 4 }, recentRecords: [{ recordId: "r1", displayName: "x", observedAt: "2026-10-01", mediaUrl: "https://e/x.jpg", mediaKind: "image" }] };
  const loaded: string[] = [];
  const ok = await handleMapPlacesBoundsApi(url, db, async (id) => { loaded.push(id); return mapPlaceCardFromProfile(profile); });
  const okBody = (await ok.json()) as { places: Array<{ placeId: string; recordCount: number | null; photoUrl: string | null }> };
  const renri = okBody.places.find((p) => p.placeId === "plc_renri");
  assert.equal(renri?.recordCount, mapPlaceCardFromProfile(profile).recordCount);
  assert.equal(renri?.recordCount, 4);
  assert.equal(renri?.photoUrl, "https://e/x.jpg");
  assert.equal(okBody.places.find((p) => p.placeId === "plc_far")?.recordCount, 0);
  assert.deepEqual(loaded.sort(), ["plc_renri", "plc_far"].filter((id) => id === "plc_renri"));
  const fail = await handleMapPlacesBoundsApi(url, db, async () => null);
  const failBody = (await fail.json()) as { places: Array<{ placeId: string; recordCount: number | null }> };
  assert.equal(failBody.places.find((p) => p.placeId === "plc_renri")?.recordCount, null);
  assert.equal(failBody.places.find((p) => p.placeId === "plc_far")?.recordCount, 0);
});
