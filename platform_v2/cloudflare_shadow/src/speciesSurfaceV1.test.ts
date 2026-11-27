import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";
import worker from "./index";
import type { Env } from "./core/env";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import { isHigherRankName, renderRegionSpeciesListPage, renderRegionSurfacePage, splitByRank, type RegionSurfaceData } from "./regionSurfaceV1";
import { loadSpeciesSurfaceData, renderSpeciesSurfacePage, resolveSpeciesKey, type SpeciesSurfaceData } from "./speciesSurfaceV1";

const region = (): RegionSurfaceData => ({
  area: "テスト市",
  recordTotal: 9,
  species: [
    { name: "植物界", group: "plant", records: 4, lastObservationId: "c1", photoUrl: "/p/c.webp", invasiveSlug: null },
    { name: "カワセミ", group: "bird", records: 3, lastObservationId: "o1", photoUrl: "/p/1.webp", invasiveSlug: null },
    { name: "アリ科", group: "insect", records: 2, lastObservationId: "c2", photoUrl: "/p/1.webp", invasiveSlug: null },
    { name: "クモ", group: "other", records: 1, lastObservationId: "c3", photoUrl: null, invasiveSlug: null },
  ],
  places: [], placeTotal: 0, events: [], eventTotal: 0,
});

const species = (over: Partial<SpeciesSurfaceData> = {}): SpeciesSurfaceData => ({
  name: "カワセミ", group: "bird", total: 3,
  areas: [{ area: "テスト市", count: 3 }],
  cells: [{ cell: "34.70,137.70", count: 3 }],
  recent: [
    { id: "o1", observedAt: "2026-11-02T01:00:00Z", area: "テスト市", photoUrl: null },
    { id: "o2", observedAt: "2026-11-01T01:00:00Z", area: "テスト市", photoUrl: "/p/2.webp" },
  ],
  firstObservedAt: "2026-10-01T01:00:00Z", lastObservedAt: "2026-11-02T01:00:00Z",
  heroUrl: "/p/1.webp", invasiveSlug: null, scientificName: null, higherRank: false,
  ...over,
});

test("flag definition", () => {
  assert.ok(PROTOTYPE_FLAGS.some((f) => f.flag === "SPECIES_SURFACE_V1_ENABLED"));
});

test("rank grouping separates higher ranks from species", () => {
  for (const n of ["植物界", "アリ科", "ハチ目", "脊索動物門", "鳥綱", "クモ", "Formicidae"]) assert.equal(isHigherRankName(n), true, n);
  for (const n of ["カワセミ", "アオサギ", "ナガエツルノゲイトウ", "Alternanthera philoxeroides", "ヒメアカタテハ"]) assert.equal(isHigherRankName(n), false, n);
  const { fine, coarse } = splitByRank(region().species);
  assert.deepEqual(fine.map((s) => s.name), ["カワセミ"]);
  assert.equal(coarse.length, 3);
});

test("region species list puts coarse names in a quiet group and links species to the surface", () => {
  const html = renderRegionSpeciesListPage({ data: region(), group: null, lang: "ja", authenticated: false, speciesSurface: true });
  assert.match(html, /data-region-coarse="1"/);
  assert.match(html, /名前が大まかな記録/);
  assert.match(html, /\/ja\/species\/%E3%82%AB%E3%83%AF%E3%82%BB%E3%83%9F/);
  assert.doesNotMatch(html, /\/ja\/species\/%E6%A4%8D%E7%89%A9%E7%95%8C/);
  assert.match(html, /\/ja\/observations\/c1/);
  const list = html.split('data-region-species-list="1"')[1]!.split("</div>")[0]!;
  assert.doesNotMatch(list, /植物界|アリ科/);
  assert.equal((html.split("<body>")[1]!.match(/\/p\/1\.webp/g) ?? []).length, 1);
  assert.match(html, /種 1種/);
  const off = renderRegionSpeciesListPage({ data: region(), group: null, lang: "ja", authenticated: false });
  assert.doesNotMatch(off, /\/ja\/species\//);
  assert.match(off, /\/ja\/observations\/o1/);
  const en = renderRegionSpeciesListPage({ data: region(), group: null, lang: "en", authenticated: false, speciesSurface: true });
  assert.match(en, /Records with broad names/);
  const page = renderRegionSurfacePage({ data: region(), lang: "ja", authenticated: false, speciesSurface: true });
  assert.match(page, /記録された種<\/span>/);
  assert.match(page, /<b>1<\/b><span>記録された種/);
});

test("species surface has the four parts, one hero and no duplicate photos", () => {
  const html = renderSpeciesSurfacePage({ data: species(), lang: "ja", authenticated: false, regionAvailable: true });
  for (const part of ["basic", "records", "tips", "sources"]) assert.match(html, new RegExp(`data-species-part="${part}"`));
  assert.match(html, /data-species-area="テスト市"/);
  assert.match(html, /\/ja\/regions\/%E3%83%86%E3%82%B9%E3%83%88%E5%B8%82/);
  assert.match(html, /data-region-map="1"/);
  assert.match(html, /rel="canonical"|canonical/);
  for (const url of ["/p/1.webp", "/p/2.webp"]) assert.equal((html.split("<body>")[1]!.match(new RegExp(url.replace(/\./g, "\\."), "g")) ?? []).length, 1, url);
  assert.doesNotMatch(html, /data-species-invasive/);
  const en = renderSpeciesSurfacePage({ data: species({ invasiveSlug: "alternanthera-philoxeroides", scientificName: "Alternanthera philoxeroides" }), lang: "en", authenticated: false, invasiveAvailable: true });
  assert.match(en, /Basic information/);
  assert.match(en, /data-species-invasive="1"/);
  assert.match(en, /\/en\/invasive\/alternanthera-philoxeroides/);
  assert.doesNotMatch(en, /data-species-area[^>]*href/);
});

test("species surface inline script parses", () => {
  const html = renderSpeciesSurfacePage({ data: species(), lang: "ja", authenticated: true, cspNonce: "n" });
  const bodies = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  assert.ok(bodies.length > 0);
  for (const b of bodies) new vm.Script(`(function(){\n${b}\n})`);
});

test("key resolution picks one canonical form", () => {
  assert.deepEqual(resolveSpeciesKey(encodeURIComponent("カワセミ")), { kind: "ok", name: "カワセミ" });
  assert.deepEqual(resolveSpeciesKey("カワセミ"), { kind: "redirect", name: "カワセミ" });
  assert.deepEqual(resolveSpeciesKey(encodeURIComponent("ｶﾜｾﾐ")), { kind: "redirect", name: "カワセミ" });
  assert.equal(resolveSpeciesKey("%E0%A4%A").kind, "invalid");
  assert.equal(resolveSpeciesKey(encodeURIComponent("不明")).kind, "invalid");
  const r = resolveSpeciesKey("alternanthera-philoxeroides");
  assert.equal(r.kind, "redirect");
});

test("worker route: flag gate, 404 without public records, redirects, 200 with records", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE readmodel_public_observations (observation_id TEXT PRIMARY KEY, public_cell TEXT, observed_at TEXT, taxon_label TEXT, asset_count INTEGER DEFAULT 0, public_area_label TEXT);
    CREATE TABLE observation_data_rights (visit_id TEXT, withdrawal_status TEXT, record_consent TEXT);
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, visibility TEXT DEFAULT 'public', emergency_hidden INTEGER DEFAULT 0, taxon_label TEXT, note TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, mime TEXT, processing_state TEXT, public_derivative_key TEXT, public_derivative_verified_at TEXT, public_derivative_metadata_json TEXT, exif_scrub_state TEXT, public_ready_at TEXT);
  `);
  const ins = sqlite.prepare("INSERT INTO readmodel_public_observations (observation_id, public_cell, observed_at, taxon_label, public_area_label) VALUES (?,?,?,?,?)");
  const own = sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, visibility) VALUES (?,?,?)");
  ins.run("s-1", "34.70,137.70", "2026-11-01T01:00:00Z", "カワセミ", "テスト市"); own.run("s-1", "u1", "public");
  ins.run("s-2", "34.71,137.71", "2026-11-02T01:00:00Z", "カワセミ", "テスト市"); own.run("s-2", "u1", "public");
  ins.run("s-3", "34.70,137.70", "2026-11-03T01:00:00Z", "ヒミツ", "テスト市"); own.run("s-3", "u1", "private");
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
  const on = { ...base, ZUKAN_FEATURE_ROLLOUTS: JSON.stringify({ SPECIES_SURFACE_V1_ENABLED: { state: "all" } }) } as unknown as Env;
  const get = (path: string, env: Env) => worker.fetch(new Request("https://zukan.earth" + path, { redirect: "manual" }), env);
  const enc = encodeURIComponent;

  const off = await get(`/ja/species/${enc("カワセミ")}`, base);
  assert.notEqual(off.headers.get("x-ikimon-cloudflare-native"), "species-surface-v1");

  const ok = await get(`/ja/species/${enc("カワセミ")}`, on);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("x-ikimon-cloudflare-native"), "species-surface-v1");
  const html = await ok.text();
  assert.match(html, /data-species-surface="カワセミ"/);
  assert.match(html, /記録 <span class="iv-nb">2件/);

  assert.equal((await get(`/ja/species/${enc("ヒミツ")}`, on)).status, 404);
  assert.equal((await get(`/ja/species/${enc("いない種")}`, on)).status, 404);
  assert.equal((await get(`/ja/species/${enc("不明")}`, on)).status, 404);

  const redirect = await get(`/ja/species/${enc("ｶﾜｾﾐ")}`, on);
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), `/ja/species/${enc("カワセミ")}`);

  const en = await get(`/en/species/${enc("カワセミ")}`, on);
  assert.equal(en.status, 200);
  assert.match(await en.text(), /Basic information/);

  const loaded = await loadSpeciesSurfaceData(db as never, "カワセミ", async () => new Map([["s-1", "/p/a.webp"], ["s-2", "/p/a.webp"]]));
  assert.equal(loaded?.total, 2);
  assert.equal(loaded?.heroUrl, "/p/a.webp");
  assert.equal(loaded?.recent.filter((r) => r.photoUrl).length, 0);
  assert.equal(await loadSpeciesSurfaceData(db as never, "ヒミツ", async () => new Map()), null);
});
