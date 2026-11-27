import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "./index";
import type { Env } from "./core/env";
import * as invasiveFlag from "./flags/INVASIVE_MAP_V1_ENABLED";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import {
  buildInvasiveRecords,
  mapCellsPayload,
  recordsForRegion,
  renderInvasiveSpeciesPage,
  renderRegionInvasivePage,
  summarizeCells,
  summarizeSpecies,
  type InvasiveSourceRow,
} from "./invasiveMapV1";
import { filterInvasiveRows } from "./mapInvasive";

const NOW = Date.parse("2026-11-27T12:00:00Z");

const row = (id: string, label: string | null, cell = "34.70,137.70", observedAt = "2026-11-10T01:00:00Z", area: string | null = "テスト市"): InvasiveSourceRow => ({
  observation_id: id,
  public_cell: cell,
  observed_at: observedAt,
  taxon_label: label,
  public_area_label: area,
});

const SOURCE: InvasiveSourceRow[] = [
  row("a1", "ナガエツルノゲイトウ"),
  row("a2", "ナガエツルノゲイトウ", "34.70,137.70", "2026-09-05T01:00:00Z"),
  row("a3", "ナガエツルノゲイトウ", "34.80,137.80"),
  row("b1", "アメリカザリガニ", "34.80,137.80"),
  row("c1", "ハクビシン", "34.90,137.90", "2026-11-01T01:00:00Z", "別の町"),
  row("n1", "カワセミ"),
  row("w1", null),
  row("w2", "同定待ち"),
  row("h1", "ナガエツルノゲイトウ", "hidden"),
  row("f1", "ナガエツルノゲイトウ", "34.70,137.70", "2026-11-27T05:00:00Z"),
];

test("INVASIVE_MAP_V1_ENABLED is registered and default off", () => {
  assert.equal(invasiveFlag.flag, "INVASIVE_MAP_V1_ENABLED");
  assert.equal(invasiveFlag.staging, false);
  assert.equal(invasiveFlag.production, false);
  assert.equal(PROTOTYPE_FLAGS.find((f) => f.flag === "INVASIVE_MAP_V1_ENABLED")?.stagingEnabled, false);
});

test("public records keep only confirmed invasive names, drop hidden and under-24h records, and agree with the map filter", () => {
  const records = buildInvasiveRecords(SOURCE, { nowMs: NOW });
  const ids = records.map((r) => r.visitId).sort();
  assert.deepEqual(ids, ["a1", "a2", "a3", "b1", "c1"]);
  const mapIds = filterInvasiveRows(SOURCE).map((r) => r.observation_id);
  for (const id of ids) assert.ok(mapIds.includes(id));
  assert.equal(records.find((r) => r.visitId === "b1")?.category, "conditional");
  assert.equal(records.find((r) => r.visitId === "a3")?.halfStep, 0.005);
});

test("coarse 10km cells keep a wider half step", () => {
  const records = buildInvasiveRecords([row("x1", "ヒアリ", "34.7,137.7")], { nowMs: NOW });
  assert.equal(records[0]!.halfStep, 0.05);
});

test("species and cell summaries count records, cells and range", () => {
  const records = buildInvasiveRecords(SOURCE, { nowMs: NOW });
  const species = summarizeSpecies(records);
  assert.equal(species[0]!.slug, "alternanthera-philoxeroides");
  assert.equal(species[0]!.records, 3);
  assert.equal(species[0]!.cells, 2);
  assert.equal(species[0]!.first.slice(0, 7), "2026-09");
  const cells = summarizeCells(records);
  assert.equal(cells.length, 3);
  assert.equal(cells[0]!.count, 2);
  const payload = mapCellsPayload(records, "procambarus-clarkii");
  assert.equal(payload.cells.length, 1);
  assert.equal(payload.cells[0]!.species[0]!.name, "アメリカザリガニ");
  assert.equal(payload.cells[0]!.species[0]!.categoryLabel, "条件付特定外来生物");
});

test("region page lists found species, hides nothing real, and links to the species face", () => {
  const records = recordsForRegion(buildInvasiveRecords(SOURCE, { nowMs: NOW }), "テスト市");
  const html = renderRegionInvasivePage({ area: "テスト市", records, lang: "ja", authenticated: false, cspNonce: "n0nce" });
  assert.match(html, /テスト市/);
  assert.match(html, /見つかっている種/);
  assert.match(html, /\/ja\/invasive\/alternanthera-philoxeroides/);
  assert.match(html, /\/ja\/map\?taxon_group=invasive/);
  assert.match(html, /名前の確認が済んだ記録だけ/);
  assert.doesNotMatch(html, /ハクビシン/);
  assert.doesNotMatch(html, /(?<!て)いません/);
  assert.match(html, /nonce="n0nce"/);
});

test("region zero state omits the found section, never says nobody is there, and invites a record", () => {
  const html = renderRegionInvasivePage({ area: "ゼロ町", records: [], lang: "ja", authenticated: true, displayName: "ゆい" });
  assert.doesNotMatch(html, /見つかっている種/);
  assert.doesNotMatch(html, /data-invasive-species-list/);
  assert.doesNotMatch(html, /(?<!て)いません|ありません/);
  assert.match(html, /全国で指定されている種/);
  assert.match(html, /この地域で記録する/);
  assert.match(html, /まだ集まっていません/);
  const buttons = html.match(/class="iv-btn"/g) ?? [];
  assert.equal(buttons.length, 1);
});

test("region zero state is noindex, links the nationwide list and catalog species, and found state stays indexable", () => {
  const html = renderRegionInvasivePage({ area: "ゼロ町", records: [], lang: "ja", authenticated: false, regionHref: "/ja/regions/ゼロ町" });
  assert.match(html, /<meta name="robots" content="noindex,follow"/);
  assert.match(html, /data-invasive-learn="1" href="\/ja\/learn\/invasive-species"/);
  assert.match(html, /href="\/ja\/invasive\/[a-z-]+"/);
  assert.match(html, /href="\/ja\/record"/);
  assert.match(html, /data-region-back="1"/);
  const en = renderRegionInvasivePage({ area: "Zero", records: [], lang: "en", authenticated: false });
  assert.match(en, /nationwide list/);
  assert.match(en, /href="\/en\/invasive\//);
});

test("region page escapes the area name", () => {
  const html = renderRegionInvasivePage({ area: "<script>alert(1)</script>", records: [], lang: "ja", authenticated: false });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test("species page shows records, blurred plot, area rows and the alert toggle only for signed-in viewers", () => {
  const records = buildInvasiveRecords(SOURCE, { nowMs: NOW, photos: new Map([["a1", "/p/1.webp"], ["a2", "/p/1.webp"], ["a3", "/p/3.webp"]]) });
  const member = renderInvasiveSpeciesPage({ slug: "alternanthera-philoxeroides", records, lang: "ja", authenticated: true, displayName: "ゆい", cspNonce: "abc" })!;
  assert.match(member, /ナガエツルノゲイトウ/);
  assert.match(member, /Alternanthera philoxeroides/);
  assert.match(member, /特定外来生物/);
  assert.match(member, /見つかっている場所/);
  assert.match(member, /場所は大まかに表示しています/);
  assert.match(member, /\/ja\/regions\/%E3%83%86%E3%82%B9%E3%83%88%E5%B8%82\/invasive/);
  assert.match(member, /iv-alert-sw/);
  assert.match(member, /\/api\/v1\/me\/subscriptions/);
  assert.match(member, /nonce="abc"/);
  assert.equal((member.match(/\/p\/1\.webp/g) ?? []).length, 1);
  const guest = renderInvasiveSpeciesPage({ slug: "alternanthera-philoxeroides", records, lang: "ja", authenticated: false })!;
  assert.doesNotMatch(guest, /iv-alert-sw/);
  assert.match(guest, /\/ja\/login/);
});

test("species page without records omits the places section", () => {
  const html = renderInvasiveSpeciesPage({ slug: "solenopsis-invicta", records: [], lang: "ja", authenticated: false })!;
  assert.doesNotMatch(html, /見つかっている場所/);
  assert.doesNotMatch(html, /(?<!て)いません/);
  assert.match(html, /区分と根拠/);
  assert.equal(renderInvasiveSpeciesPage({ slug: "no-such-species", records: [], lang: "ja", authenticated: false }), null);
});

test("worker serves the new faces only when INVASIVE_MAP_V1_ENABLED is on", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE readmodel_public_observations (observation_id TEXT PRIMARY KEY, public_cell TEXT, observed_at TEXT, taxon_label TEXT, asset_count INTEGER DEFAULT 0, public_area_label TEXT);
    CREATE TABLE observation_data_rights (visit_id TEXT, withdrawal_status TEXT, record_consent TEXT);
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, visibility TEXT DEFAULT 'public', emergency_hidden INTEGER DEFAULT 0, taxon_label TEXT, note TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, mime TEXT, processing_state TEXT, public_derivative_key TEXT, public_derivative_verified_at TEXT, public_derivative_metadata_json TEXT, exif_scrub_state TEXT, public_ready_at TEXT);
  `);
  const ins = sqlite.prepare("INSERT INTO readmodel_public_observations (observation_id, public_cell, observed_at, taxon_label, public_area_label) VALUES (?,?,?,?,?)");
  const own = sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id) VALUES (?,?)");
  ins.run("w-1", "34.70,137.70", "2026-11-01T01:00:00Z", "ナガエツルノゲイトウ", "テスト市");
  own.run("w-1", "u1");
  ins.run("w-2", "34.70,137.70", "2026-11-02T01:00:00Z", "カワセミ", "静かな町");
  own.run("w-2", "u2");
  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { values = args; return stmt; },
        async run() { return { meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } }; },
        async first<T>() { return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null; },
        async all<T>() { return { results: sqlite.prepare(query).all(...(values as never[])) as T[] }; },
      };
      return stmt;
    },
  } as unknown as Env["OBS_DB"];
  const base = { ENVIRONMENT: "staging", CORE_DB: db, OBS_DB: db } as unknown as Env;
  const on = { ...base, ZUKAN_FEATURE_ROLLOUTS: JSON.stringify({ INVASIVE_MAP_V1_ENABLED: { state: "all" } }) } as unknown as Env;

  const offRegion = await worker.fetch(new Request("https://zukan.earth/ja/regions/" + encodeURIComponent("テスト市") + "/invasive"), base);
  assert.notEqual(offRegion.headers.get("x-ikimon-cloudflare-native"), "invasive-region-v1");

  const region = await worker.fetch(new Request("https://zukan.earth/ja/regions/" + encodeURIComponent("テスト市") + "/invasive"), on);
  assert.equal(region.status, 200);
  assert.equal(region.headers.get("x-ikimon-cloudflare-native"), "invasive-region-v1");
  assert.match(await region.text(), /ナガエツルノゲイトウ/);

  const zero = await worker.fetch(new Request("https://zukan.earth/ja/regions/" + encodeURIComponent("静かな町") + "/invasive"), on);
  assert.equal(zero.status, 200);
  const zeroHtml = await zero.text();
  assert.doesNotMatch(zeroHtml, /見つかっている種/);
  assert.match(zeroHtml, /この地域で記録する/);

  const unknown = await worker.fetch(new Request("https://zukan.earth/ja/regions/" + encodeURIComponent("記録のない村") + "/invasive"), on);
  assert.equal(unknown.status, 404);

  const species = await worker.fetch(new Request("https://zukan.earth/ja/invasive/alternanthera-philoxeroides"), on);
  assert.equal(species.status, 200);
  assert.equal(species.headers.get("x-ikimon-cloudflare-native"), "invasive-species-v1");
  const badSpecies = await worker.fetch(new Request("https://zukan.earth/ja/invasive/not-a-species"), on);
  assert.equal(badSpecies.status, 404);

  const cells = await worker.fetch(new Request("https://zukan.earth/api/v1/map/invasive-cells"), on);
  assert.equal(cells.status, 200);
  const payload = await cells.json() as { cells: Array<{ count: number; species: Array<{ slug: string }> }> };
  assert.equal(payload.cells.length, 1);
  assert.equal(payload.cells[0]!.species[0]!.slug, "alternanthera-philoxeroides");
  const offCells = await worker.fetch(new Request("https://zukan.earth/api/v1/map/invasive-cells"), base);
  assert.doesNotMatch(await offCells.text(), /"cells"/);
});

test("map explorer carries the invasive cell layer only when the cells api is given, and its script compiles", async () => {
  const { renderMapExplorerV2Document } = await import("../../src/ui/mapExplorerV2");
  const on = renderMapExplorerV2Document({ lang: "ja", authenticated: false, basePath: "", invasiveCellsApi: "/api/v1/map/invasive-cells" });
  const off = renderMapExplorerV2Document({ lang: "ja", authenticated: false, basePath: "" });
  assert.match(on, /"invasiveCellsApi":"\/api\/v1\/map\/invasive-cells"/);
  assert.match(off, /"invasiveCellsApi":null/);
  assert.match(on, /zv2-inv-fill/);
  assert.match(on, /この種について見る/);
  assert.match(on, /data-taxon="invasive"/);
  const scripts = [...on.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
  assert.ok(scripts.length > 0);
  for (const code of scripts) assert.doesNotThrow(() => new Function(code));
});

test("species page alert script compiles", () => {
  const html = renderInvasiveSpeciesPage({ slug: "procyon-lotor", records: [], lang: "ja", authenticated: true })!;
  const m = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(m);
  assert.doesNotThrow(() => new Function(m![1]!));
});

test("invasive faces carry back/share, per-species links, biosecurity link and never repeat a photo", () => {
  const src = [row("t1", "セイヨウタンポポ"), row("t2", "セイヨウタンポポ", "34.80,137.80"), row("a1", "ナガエツルノゲイトウ"), row("a2", "ナガエツルノゲイトウ", "34.80,137.80")];
  const photos = new Map([["t1", "/p/t.webp"], ["t2", "/p/t.webp"], ["a1", "/p/a.webp"], ["a2", "/p/a.webp"]]);
  const records = buildInvasiveRecords(src, { nowMs: NOW, photos });
  const region = renderRegionInvasivePage({ area: "テスト市", records: recordsForRegion(records, "テスト市"), lang: "ja", authenticated: false });
  assert.match(region, /data-iv-back/);
  assert.match(region, /data-iv-share/);
  assert.match(region, /navigator\.share/);
  assert.match(region, /clipboard/);
  assert.equal((region.match(/data-invasive-about="1"/g) ?? []).length, 2);
  assert.equal((region.match(/data-invasive-identify="1"/g) ?? []).length, 2);
  assert.match(region, /href="\/ja\/biosecurity"/);
  assert.match(region, /class="iv-thumb"/);
  assert.equal((region.match(/\/p\/t\.webp/g) ?? []).length, 1);
  assert.equal((region.match(/\/p\/a\.webp/g) ?? []).length, 1);
  const species = renderInvasiveSpeciesPage({ slug: "taraxacum-officinale", records, lang: "ja", authenticated: false })!;
  assert.match(species, /data-iv-back/);
  assert.match(species, /data-iv-share/);
  assert.match(species, /この種について/);
  assert.match(species, /見分けの助け/);
  assert.match(species, /href="\/ja\/biosecurity"/);
  assert.equal((species.match(/\/p\/t\.webp/g) ?? []).length, 1);
  const zero = renderRegionInvasivePage({ area: "ゼロ町", records: [], lang: "ja", authenticated: false });
  assert.match(zero, /href="\/ja\/biosecurity"/);
  for (const html of [region, species, zero]) {
    const m = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    assert.ok(m);
    assert.doesNotThrow(() => new Function(m![1]!));
  }
});

test("taraxacum-officinale renders map cells on the species page and in the cells payload", () => {
  const records = buildInvasiveRecords([row("t1", "セイヨウタンポポ"), row("t2", "セイヨウタンポポ", "34.80,137.80")], { nowMs: NOW });
  const payload = mapCellsPayload(records, "taraxacum-officinale");
  assert.equal(payload.cells.length, 2);
  assert.equal(payload.cells[0]!.species[0]!.slug, "taraxacum-officinale");
  const html = renderInvasiveSpeciesPage({ slug: "taraxacum-officinale", records, lang: "ja", authenticated: false })!;
  assert.match(html, /data-invasive-plot="1"/);
  assert.equal((html.match(/<g><rect /g) ?? []).length, 2);
  assert.match(html, /map\?taxon_group=invasive&amp;species=taraxacum-officinale/);
});
