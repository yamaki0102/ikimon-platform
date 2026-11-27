import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "./index";
import type { Env } from "./core/env";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import * as regionFlag from "./flags/REGION_SURFACE_V1_ENABLED";
import { loadRegionSurfaceData, regionSurfaceHasContent, renderRegionSpeciesListPage, renderRegionSurfacePage, type RegionSurfaceData } from "./regionSurfaceV1";

const sample = (over: Partial<RegionSurfaceData> = {}): RegionSurfaceData => ({
  area: "テスト市",
  recordTotal: 6,
  species: [
    { name: "カワセミ", group: "bird", records: 3, lastObservationId: "o1", photoUrl: "/p/1.webp", invasiveSlug: null },
    { name: "アオサギ", group: "bird", records: 2, lastObservationId: "o2", photoUrl: "/p/1.webp", invasiveSlug: null },
    { name: "ナガエツルノゲイトウ", group: "plant", records: 1, lastObservationId: "o3", photoUrl: null, invasiveSlug: "alternanthera-philoxeroides" },
  ],
  places: [],
  placeTotal: 0,
  events: [],
  eventTotal: 0,
  ...over,
});

test("flag definition", () => {
  assert.equal(regionFlag.flag, "REGION_SURFACE_V1_ENABLED");
  assert.ok(PROTOTYPE_FLAGS.some((f) => f.flag === "REGION_SURFACE_V1_ENABLED"));
});

test("region page shows only shelves with content and never repeats a photo", () => {
  const html = renderRegionSurfacePage({ data: sample(), lang: "ja", authenticated: true, invasiveAvailable: true });
  assert.match(html, /data-region-shelf="bio"/);
  assert.doesNotMatch(html, /data-region-shelf="places"/);
  assert.doesNotMatch(html, /data-region-shelf="events"/);
  assert.match(html, /data-region-guide="1"/);
  assert.match(html, /\/ja\/regions\/%E3%83%86%E3%82%B9%E3%83%88%E5%B8%82\/species/);
  assert.match(html, /data-region-invasive="1"/);
  assert.equal((html.match(/\/p\/1\.webp/g) ?? []).length, 1);
  assert.doesNotMatch(html, /店<|人<small/);
});

test("region page shelves for places and events appear with real rows", () => {
  const html = renderRegionSurfacePage({
    data: sample({ places: [{ id: "pl1", name: "浅畑川", locality: null, kind: "river" }], placeTotal: 1, events: [{ id: "e1", title: "観察会", startedAt: "2026-12-07T09:00:00Z" }], eventTotal: 1 }),
    lang: "ja", authenticated: false, invasiveAvailable: false,
  });
  assert.match(html, /data-region-shelf="places"/);
  assert.match(html, /data-region-shelf="events"/);
  assert.match(html, /\/ja\/places\/pl1/);
  assert.match(html, /\/ja\/events\/e1\/preview/);
  assert.doesNotMatch(html, /data-region-invasive/);
});

test("species list filters by group and shows the empty state", () => {
  const all = renderRegionSpeciesListPage({ data: sample(), group: null, lang: "ja", authenticated: false });
  assert.match(all, /data-region-chips="1"/);
  assert.match(all, /カワセミ/);
  const plants = renderRegionSpeciesListPage({ data: sample(), group: "plant", lang: "ja", authenticated: false });
  assert.doesNotMatch(plants, /カワセミ/);
  assert.match(plants, /ナガエツルノゲイトウ/);
  const empty = renderRegionSpeciesListPage({ data: sample({ species: [] }), group: null, lang: "ja", authenticated: false });
  assert.match(empty, /data-region-empty="1"/);
  assert.doesNotMatch(empty, /data-region-chips/);
  assert.equal(regionSurfaceHasContent(sample({ species: [], recordTotal: 0 })), false);
});

test("worker routes regions only when REGION_SURFACE_V1_ENABLED is on; unknown areas 404", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE readmodel_public_observations (observation_id TEXT PRIMARY KEY, public_cell TEXT, observed_at TEXT, taxon_label TEXT, asset_count INTEGER DEFAULT 0, public_area_label TEXT);
    CREATE TABLE observation_data_rights (visit_id TEXT, withdrawal_status TEXT, record_consent TEXT);
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, visibility TEXT DEFAULT 'public', emergency_hidden INTEGER DEFAULT 0, taxon_label TEXT, note TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, mime TEXT, processing_state TEXT, public_derivative_key TEXT, public_derivative_verified_at TEXT, public_derivative_metadata_json TEXT, exif_scrub_state TEXT, public_ready_at TEXT);
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT, locality_label TEXT, place_kind TEXT, public_profile_status TEXT, superseded_by_place_id TEXT, municipality TEXT, prefecture TEXT);
    CREATE TABLE observation_event_sessions (session_id TEXT PRIMARY KEY, title TEXT, event_code TEXT, started_at TEXT, field_id TEXT);
  `);
  const ins = sqlite.prepare("INSERT INTO readmodel_public_observations (observation_id, public_cell, observed_at, taxon_label, public_area_label) VALUES (?,?,?,?,?)");
  const own = sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id) VALUES (?,?)");
  ins.run("w-1", "34.70,137.70", "2026-11-01T01:00:00Z", "カワセミ", "テスト市");
  own.run("w-1", "u1");
  ins.run("w-2", "34.70,137.70", "2026-11-02T01:00:00Z", "不明", "テスト市");
  own.run("w-2", "u1");
  sqlite.prepare("INSERT INTO places VALUES (?,?,?,?,?,?,?,?)").run("pl-1", "テスト公園", null, "park", "published", null, "場所だけの市", null);
  sqlite.prepare("INSERT INTO places VALUES (?,?,?,?,?,?,?,?)").run("pl-2", "下書き", null, "park", "draft", null, "場所だけの市", null);
  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { values = args; return stmt; },
        async run() { return { meta: { changes: 0 } }; },
        async first<T>() { return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null; },
        async all<T>() { return { results: sqlite.prepare(query).all(...(values as never[])) as T[] }; },
      };
      return stmt;
    },
  } as unknown as Env["OBS_DB"];
  const base = { ENVIRONMENT: "staging", CORE_DB: db, OBS_DB: db } as unknown as Env;
  const on = { ...base, ZUKAN_FEATURE_ROLLOUTS: JSON.stringify({ REGION_SURFACE_V1_ENABLED: { state: "all" } }) } as unknown as Env;
  const get = (path: string, env: Env) => worker.fetch(new Request("https://zukan.earth" + path), env);
  const enc = encodeURIComponent;

  const off = await get(`/ja/regions/${enc("テスト市")}`, base);
  assert.notEqual(off.headers.get("x-ikimon-cloudflare-native"), "region-surface-v1");

  const page = await get(`/ja/regions/${enc("テスト市")}`, on);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-ikimon-cloudflare-native"), "region-surface-v1");
  const html = await page.text();
  assert.match(html, /カワセミ/);
  assert.doesNotMatch(html, /data-region-shelf="places"/);

  const list = await get(`/ja/regions/${enc("テスト市")}/species?group=bird`, on);
  assert.equal(list.status, 200);
  assert.equal(list.headers.get("x-ikimon-cloudflare-native"), "region-species-v1");

  const placesOnly = await get(`/ja/regions/${enc("場所だけの市")}`, on);
  assert.equal(placesOnly.status, 200);
  const placesHtml = await placesOnly.text();
  assert.match(placesHtml, /data-region-shelf="places"/);
  assert.doesNotMatch(placesHtml, /data-region-shelf="bio"/);
  assert.match(placesHtml, /テスト公園/);
  assert.doesNotMatch(placesHtml, /下書き/);

  const none = await get(`/ja/regions/${enc("記録のない村")}`, on);
  assert.equal(none.status, 404);
});

test("loader tolerates missing places and events tables", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE readmodel_public_observations (observation_id TEXT, observed_at TEXT, taxon_label TEXT, public_area_label TEXT);
    CREATE TABLE observations (observation_id TEXT, visibility TEXT, emergency_hidden INTEGER);
    CREATE TABLE observation_data_rights (visit_id TEXT, withdrawal_status TEXT);
  `);
  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) { values = a; return stmt; },
        async first<T>() { return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null; },
        async all<T>() { return { results: sqlite.prepare(query).all(...(values as never[])) as T[] }; },
      };
      return stmt;
    },
  };
  const data = await loadRegionSurfaceData(db, "どこか", async () => new Map());
  assert.equal(regionSurfaceHasContent(data), false);
  sqlite.close();
});
