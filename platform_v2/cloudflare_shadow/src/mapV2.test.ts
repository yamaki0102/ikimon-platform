import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "./index";
import type { Env } from "./core/env";
import * as mapV2Flag from "./flags/MAP_V2_ENABLED";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import { renderMapExplorerV2Document } from "../../src/ui/mapExplorerV2";
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
  ins.run("p-renri", "連理の木の下で", "nature_area");
  bnd.run("b-renri", "p-renri", 138.4995, 35.4995, 138.5005, 35.5005);
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
  const points = [{ lat: 34.8142, lng: 137.733 }, { lat: 34.8140, lng: 137.7330 }];
  const picked = selectUnknownCountCandidates([mk("a", 34.8142, 137.733), mk("b", 34.70, 137.60), mk("c", 34.8140, 137.7330), mk("n", 34.8150, 137.7340)], points, 1);
  assert.deepEqual(picked.candidates, ["a"]);
  assert.deepEqual(picked.overflow, ["c"]);
  assert.deepEqual(selectUnknownCountCandidates([mk("b", 34.70, 137.60)], points).candidates, []);
});

test("/api/v1/map/places?v2=1 computes the place-page count for places without memberships and returns null (unknown) when the loader fails", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, place_kind TEXT DEFAULT 'park', locality_label TEXT, public_profile_status TEXT NOT NULL DEFAULT 'published', superseded_by_place_id TEXT);
    CREATE TABLE place_boundaries (boundary_id TEXT PRIMARY KEY, place_id TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0, boundary_version INTEGER NOT NULL DEFAULT 1, valid_to TEXT, superseded_by_boundary_id TEXT, bbox_west REAL, bbox_south REAL, bbox_east REAL, bbox_north REAL);
    CREATE TABLE public_map_snapshot_records_v1 (snapshot_key TEXT, visit_id TEXT, cell_1000 TEXT);
    CREATE TABLE production_import_visits (visit_id TEXT PRIMARY KEY, exact_lat REAL, exact_lng REAL, public_visibility TEXT);
  `);
  const ins = sqlite.prepare("INSERT INTO places (place_id, canonical_name) VALUES (?, ?)");
  const bnd = sqlite.prepare("INSERT INTO place_boundaries (boundary_id, place_id, is_primary, bbox_west, bbox_south, bbox_east, bbox_north) VALUES (?, ?, 1, ?, ?, ?, ?)");
  ins.run("plc_renri", "連理の木の下で");
  bnd.run("b1", "plc_renri", 137.7328, 34.8140, 137.7331, 34.8143);
  ins.run("plc_far", "遠い公園");
  bnd.run("b2", "plc_far", 137.7500, 34.8300, 137.7502, 34.8302);
  sqlite.prepare("INSERT INTO public_map_snapshot_records_v1 VALUES ('public-map:v1:global', 'v1', '34.81,137.73')").run();
  sqlite.prepare("INSERT INTO production_import_visits VALUES ('v1', 34.8142, 137.7330, 'public')").run();
  ins.run("plc_adjacent", "隣の公園");
  bnd.run("b3", "plc_adjacent", 137.7350, 34.8160, 137.7352, 34.8162);
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
  assert.equal(okBody.places.find((p) => p.placeId === "plc_adjacent")?.recordCount, 0);
  assert.deepEqual(loaded.sort(), ["plc_renri", "plc_far"].filter((id) => id === "plc_renri"));
  const fail = await handleMapPlacesBoundsApi(url, db, async () => null);
  const failBody = (await fail.json()) as { places: Array<{ placeId: string; recordCount: number | null }> };
  assert.equal(failBody.places.find((p) => p.placeId === "plc_renri")?.recordCount, null);
  assert.equal(failBody.places.find((p) => p.placeId === "plc_far")?.recordCount, 0);
  assert.equal(failBody.places.find((p) => p.placeId === "plc_adjacent")?.recordCount, 0);
});

test("map v2 HTML includes Japanese-only symbol label override on load and single-line mobile nav CSS", () => {
  const html = renderMapExplorerV2Document({
    basePath: "",
    lang: "ja",
    authenticated: true,
    displayName: "ゆい",
  });
  assert.match(html, /\.zv2-tab\{[^}]*font-size:12px[^}]*white-space:nowrap/u);
  assert.match(html, /\.zv2-tab span\{white-space:nowrap\}/u);
  assert.match(html, /applyJapaneseMapLabels\(map\)/u);
  assert.match(html, /\['coalesce',\s*\['get',\s*'name:ja'\],\s*\['get',\s*'name'\]\]/u);
});

function findChromiumExecutable(): string | null {
  for (const c of [
    process.env.CHROMIUM_PATH,
    "/home/nexus/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ]) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

test("Playwright verifies map v2 applies Japanese-only symbol labels on load and keeps ライブラリ single-line at 375px", async (t) => {
  const executablePath = findChromiumExecutable();
  if (!executablePath) {
    t.skip("No Chromium binary available");
    return;
  }
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  t.after(() => browser.close());

  const mapUrl = "https://zukan.earth/ja/map?lat=34.81&lng=137.73&zoom=13";
  const html = renderMapExplorerV2Document({
    basePath: "",
    lang: "ja",
    authenticated: true,
    displayName: "ゆい",
  });

  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.route("**/*", async (route) => {
    const u = route.request().url();
    if (u === mapUrl) {
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      return;
    }
    if (u.endsWith(".css")) {
      await route.fulfill({ status: 200, contentType: "text/css", body: "" });
      return;
    }
    if (u.includes("maplibre") && u.endsWith(".js")) {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `window.__mapUpdates = []; window.maplibregl = { Map: function () {
          var handlers = {};
          var layers = [
            { id: 'place_city', type: 'symbol', layout: { 'text-field': ['concat', ['get', 'name:en'], ' ', ['get', 'name:ja']] } },
            { id: 'waterway', type: 'line', layout: {} },
            { id: 'zv2-clusters', type: 'symbol', layout: { 'text-field': ['get', 'point_count'] } }
          ];
          this.on = function (ev, fn) { handlers[ev] = fn; if (ev === 'load') setTimeout(fn, 10); };
          this.once = function (ev, fn) { this.on(ev, fn); };
          this.getStyle = function () { return { layers: layers }; };
          this.setLayoutProperty = function (id, prop, val) { window.__mapUpdates.push({ id: id, prop: prop, val: val }); };
          this.addSource = function () {};
          this.addLayer = function () {};
          this.addImage = function () {};
          this.getSource = function () { return null; };
          this.getBounds = function () { return { getSouth: function () { return 34.7; }, getWest: function () { return 137.7; }, getNorth: function () { return 34.9; }, getEast: function () { return 137.8; } }; };
          this.getCenter = function () { return { lat: 34.81, lng: 137.73 }; };
          this.getZoom = function () { return 13; };
          this.getCanvas = function () { return { style: {} }; };
        } };`,
      });
      return;
    }
    if (u.includes("/api/v1/map/places")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"places":[]}' });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto(mapUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Array.isArray((window as unknown as { __mapUpdates?: unknown[] }).__mapUpdates) && ((window as unknown as { __mapUpdates: unknown[] }).__mapUpdates.length > 0), { timeout: 5000 });

  const result = await page.evaluate(() => {
    const updates = (window as unknown as { __mapUpdates?: Array<{ id: string; prop: string; val: unknown }> }).__mapUpdates ?? [];
    const tabs = Array.from(document.querySelectorAll(".zv2-tab"));
    const libTab = tabs.find((el) => (el.textContent ?? "").includes("ライブラリ"));
    const libSpan = libTab?.querySelector("span");
    let lineCount = 0;
    if (libSpan) {
      const range = document.createRange();
      range.selectNodeContents(libSpan);
      lineCount = range.getClientRects().length;
    }
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      libText: libSpan?.textContent ?? "",
      libLineCount: lineCount,
      updates,
    };
  });

  assert.equal(result.overflowX, 0);
  assert.equal(result.libText, "ライブラリ");
  assert.equal(result.libLineCount, 1, `expected ライブラリ to fit on 1 line at 375px, got ${result.libLineCount} lines`);
  assert.deepEqual(result.updates, [
    { id: "place_city", prop: "text-field", val: ["coalesce", ["get", "name:ja"], ["get", "name"]] },
  ]);
  await ctx.close();
});

test("map places q searches names beyond the radius via SQL LIKE and escapes wildcards", async (t) => {
  const db = setupHamamatsuDb(t);
  const res = await handleMapPlacesBoundsApi(
    new URL("https://zukan.earth/api/v1/map/places?lat=34.705&lng=137.72&radiusKm=15&v2=1&limit=400&q=" + encodeURIComponent("連理の木")),
    db,
  );
  const body = (await res.json()) as { places: Array<{ placeId: string; name: string }> };
  assert.deepEqual(body.places.map((p) => p.placeId), ["p-renri"]);
  const wild = await handleMapPlacesBoundsApi(
    new URL("https://zukan.earth/api/v1/map/places?lat=34.705&lng=137.72&v2=1&q=" + encodeURIComponent("%")),
    db,
  );
  assert.equal(((await wild.json()) as { places: unknown[] }).places.length, 0);
  const near = await handleMapPlacesBoundsApi(
    new URL("https://zukan.earth/api/v1/map/places?lat=34.705&lng=137.72&v2=1&q=" + encodeURIComponent("浜松の公園 2")),
    db,
  );
  assert.ok(((await near.json()) as { places: unknown[] }).places.length > 1);
});

test("map v2 mobile search renders results dropdown under the search bar with keyboard-safe height, Enter and tap handlers", () => {
  for (const lang of ["ja", "en"] as const) {
    const html = renderMapExplorerV2Document({ lang, authenticated: false, basePath: "", cspNonce: "n" });
    assert.match(html, /id="zv2-sdrop"/);
    assert.match(html, /visualViewport/);
    assert.match(html, /data-zv2-drop-place/);
    assert.match(html, /ev\.key !== 'Enter'/);
    assert.match(html, lang === "ja" ? /見つかりません/ : /No matches/);
  }
});
