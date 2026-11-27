import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker, { withPublicPlacesInSitemap } from "./index";
import type { Env } from "./core/env";
import { renderRegionIndexPage, renderRegionSurfacePage } from "./regionSurfaceV1";

const SCHEMA = `
  CREATE TABLE readmodel_public_observations (observation_id TEXT PRIMARY KEY, public_cell TEXT, observed_at TEXT, taxon_label TEXT, asset_count INTEGER DEFAULT 0, public_area_label TEXT);
  CREATE TABLE observation_data_rights (visit_id TEXT, withdrawal_status TEXT, record_consent TEXT);
  CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, visibility TEXT DEFAULT 'public', emergency_hidden INTEGER DEFAULT 0, taxon_label TEXT, note TEXT, created_at TEXT, observed_at TEXT);
  CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT, locality_label TEXT, place_kind TEXT, public_profile_status TEXT, superseded_by_place_id TEXT, municipality TEXT, prefecture TEXT, metadata_json TEXT);
`;

function makeDb(seed: boolean) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(SCHEMA);
  if (seed) {
    const ins = sqlite.prepare("INSERT INTO readmodel_public_observations (observation_id, public_cell, observed_at, taxon_label, public_area_label) VALUES (?,?,?,?,?)");
    const own = sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id) VALUES (?,?)");
    const rows: Array<[string, string, string]> = [
      ["a1", "カワセミ", "浜松市"], ["a2", "カワセミ", "浜松市"], ["a3", "アオサギ", "浜松市"], ["a4", "不明", "浜松市"],
      ["b1", "ツバメ", "磐田市"], ["c1", "ヒヨドリ", "札幌市"], ["c2", "ヒヨドリ", "札幌市"], ["c3", "ヒヨドリ", "札幌市"],
    ];
    for (const [id, label, area] of rows) { ins.run(id, "34.70,137.70", "2026-11-01T01:00:00Z", label, area); own.run(id, "u1"); }
    sqlite.prepare("INSERT INTO places VALUES (?,?,?,?,?,?,?,?,?)").run("pl-1", "浜名湖", null, "park", "published", null, "浜松市", "静岡県", "{}");
    sqlite.prepare("INSERT INTO places VALUES (?,?,?,?,?,?,?,?,?)").run("pl-2", "下書き", null, "park", "draft", null, "磐田市", "静岡県", "{}");
  }
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
  return { sqlite, db };
}

const rollout = (flags: string[]) => JSON.stringify(Object.fromEntries(flags.map((f) => [f, { state: "all" }])));

test("regions index lists areas by prefecture sorted by records, empty state is 200", async (t) => {
  const { sqlite, db } = makeDb(true);
  t.after(() => sqlite.close());
  const base = { ENVIRONMENT: "staging", CORE_DB: db, OBS_DB: db } as unknown as Env;
  const on = { ...base, ZUKAN_FEATURE_ROLLOUTS: rollout(["REGION_SURFACE_V1_ENABLED"]) } as unknown as Env;
  const get = (path: string, env: Env) => worker.fetch(new Request("https://zukan.earth" + path), env);
  const off = await get("/ja/regions", base);
  assert.notEqual(off.headers.get("x-ikimon-cloudflare-native"), "region-index-v1");
  const res = await get("/ja/regions", on);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-ikimon-cloudflare-native"), "region-index-v1");
  const html = await res.text();
  assert.match(html, /<title>地域から探す \| ZUKAN<\/title>/);
  assert.match(html, /rel="canonical" href="[^"]*\/ja\/regions"/);
  assert.match(html, /hreflang="en"/);
  assert.match(html, /data-region-filter="1"/);
  assert.ok(html.indexOf("浜松市") < html.indexOf("磐田市"));
  assert.match(html, /data-region-group="静岡県"/);
  assert.match(html, /data-region-row="浜松市 静岡県"/);
  assert.match(html, /種 <span class="iv-nb">2<\/span> ・ 記録 <span class="iv-nb">4件<\/span> ・ 場所 <span class="iv-nb">1か所<\/span>/);
  assert.match(html, /\/ja\/regions\/%E6%B5%9C%E6%9D%BE%E5%B8%82/);
  const en = await (await get("/en/regions", on)).text();
  assert.match(en, /Explore by region \| ZUKAN/);
  const empty = makeDb(false);
  t.after(() => empty.sqlite.close());
  const emptyRes = await get("/ja/regions", { ...on, OBS_DB: empty.db, CORE_DB: empty.db } as unknown as Env);
  assert.equal(emptyRes.status, 200);
  assert.match(await emptyRes.text(), /data-region-index-empty="1"/);
});

test("sitemap adds /ja/regions and species surfaces under their flags", async (t) => {
  const { sqlite, db } = makeDb(true);
  t.after(() => sqlite.close());
  const env = { ENVIRONMENT: "production", CORE_DB: db, OBS_DB: db, ZUKAN_FEATURE_ROLLOUTS: rollout(["REGION_SURFACE_V1_ENABLED", "SPECIES_SURFACE_V1_ENABLED"]) } as unknown as Env;
  const xml = await withPublicPlacesInSitemap("<urlset></urlset>", env);
  assert.match(xml, /<loc>https:\/\/zukan\.earth\/ja\/regions<\/loc>/);
  assert.match(xml, /\/ja\/species\/%E3%82%AB%E3%83%AF%E3%82%BB%E3%83%9F</);
  assert.doesNotMatch(xml, /%E4%B8%8D%E6%98%8E</);
});

test("region page and explore link back to the index, client script parses", () => {
  const html = renderRegionSurfacePage({ data: { area: "テスト市", recordTotal: 1, species: [], places: [], placeTotal: 1, events: [], eventTotal: 0 }, lang: "ja", authenticated: false });
  assert.match(html, /data-region-index-link="1" href="\/ja\/regions"/);
  const page = renderRegionIndexPage({ items: [{ area: "浜松市", prefecture: "静岡県", records: 3, species: 1, places: 0 }], lang: "ja", authenticated: false });
  const scripts = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  assert.ok(scripts.length > 0);
  for (const s of scripts) new Function(s);
});

test("explore shows the quiet regions link only when the flag is on", async (t) => {
  const { sqlite, db } = makeDb(true);
  t.after(() => sqlite.close());
  const base = { ENVIRONMENT: "staging", CORE_DB: db, OBS_DB: db } as unknown as Env;
  const on = { ...base, ZUKAN_FEATURE_ROLLOUTS: rollout(["REGION_SURFACE_V1_ENABLED"]) } as unknown as Env;
  const get = async (env: Env) => (await worker.fetch(new Request("https://zukan.earth/ja/search/explore"), env)).text();
  assert.match(await get(on), /data-search-regions-link="1" [^>]*href="\/ja\/regions"/);
  assert.doesNotMatch(await get(base), /data-search-regions-link/);
});
