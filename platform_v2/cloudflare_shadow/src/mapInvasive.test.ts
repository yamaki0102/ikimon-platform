import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  INVASIVE_LEGAL_NOTE,
  INVASIVE_SEED_ROWS,
  classifyInvasive,
  decorateInvasiveItem,
  filterInvasiveRows,
  injectMapInvasiveMarker,
  invasiveCellExtras,
  invasiveItemInfo,
  isMapHtmlPath,
} from "./mapInvasive";

const slug = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

test("embedded table matches the seed json", () => {
  const seed = JSON.parse(readFileSync(new URL("../../db/seeds/invasive_species_seed.ja.json", import.meta.url), "utf8")) as Array<{ vernacular_name: string; scientific_name: string; mhlw_category: string }>;
  assert.deepEqual(
    INVASIVE_SEED_ROWS.map((row) => [...row]),
    seed.map((row) => [row.vernacular_name, row.mhlw_category, slug(row.scientific_name)]),
  );
  const runtime = readFileSync(new URL("../../src/content/runtime/invasive_species_seed.ja.json", import.meta.url), "utf8");
  assert.equal(runtime, readFileSync(new URL("../../db/seeds/invasive_species_seed.ja.json", import.meta.url), "utf8"));
});

test("exact names map to categories and learn slugs", () => {
  assert.deepEqual(classifyInvasive("アライグマ"), { category: "iaspecified", label: "特定外来生物", learnSlug: "procyon-lotor" });
  assert.deepEqual(classifyInvasive("セイヨウタンポポ"), { category: "priority", label: "重点対策外来種", learnSlug: "taraxacum-officinale" });
  assert.deepEqual(classifyInvasive("ハクビシン"), { category: "prevention", label: "生態系被害防止外来種", learnSlug: "paguma-larvata" });
  assert.deepEqual(classifyInvasive(" ヒアリ "), { category: "iaspecified", label: "特定外来生物", learnSlug: "solenopsis-invicta" });
  assert.equal(classifyInvasive("カミツキガメ")?.label, "特定外来生物");
});

test("conditional category overrides", () => {
  for (const name of ["アメリカザリガニ", "ミシシッピアカミミガメ", "アカミミガメ"]) {
    assert.equal(classifyInvasive(name)?.category, "conditional");
    assert.equal(classifyInvasive(name)?.label, "条件付特定外来生物");
  }
});

test("aliases resolve to the seed entry", () => {
  assert.equal(classifyInvasive("アカミミガメ")?.learnSlug, "trachemys-scripta-elegans");
  assert.deepEqual(classifyInvasive("ブラックバス"), classifyInvasive("オオクチバス"));
  assert.equal(classifyInvasive("ブラックバス")?.learnSlug, "micropterus-salmoides");
});

test("no substring or near-name matching", () => {
  assert.equal(classifyInvasive("ニホンザリガニ"), null);
  assert.equal(classifyInvasive("カンサイタンポポ"), null);
  assert.equal(classifyInvasive("ニホンタンポポ"), null);
  assert.equal(classifyInvasive("タンポポ"), null);
  assert.equal(classifyInvasive("アライグマの足跡"), null);
  assert.equal(classifyInvasive("ザリガニ"), null);
  assert.equal(classifyInvasive("toString"), null);
  assert.equal(classifyInvasive("constructor"), null);
  assert.equal(classifyInvasive(""), null);
  assert.equal(classifyInvasive(null), null);
  assert.equal(classifyInvasive(undefined), null);
});

test("classification returns a copy", () => {
  const first = classifyInvasive("ヒアリ");
  assert.ok(first);
  first.label = "x";
  assert.equal(classifyInvasive("ヒアリ")?.label, "特定外来生物");
});

test("item info carries legal note and learn href", () => {
  assert.deepEqual(invasiveItemInfo("オオキンケイギク"), {
    category: "iaspecified",
    label: "特定外来生物",
    legalNote: INVASIVE_LEGAL_NOTE,
    learnHref: "/ja/learn/invasive-species/coreopsis-lanceolata",
  });
  assert.equal(INVASIVE_LEGAL_NOTE, "持ち帰らない・動かさない");
  assert.equal(invasiveItemInfo("スズメ"), null);
});

test("row filter keeps only classified rows and preserves cell fields", () => {
  const rows = [
    { observation_id: "a", public_cell: "35.00,139.00", taxon_label: "アライグマ" },
    { observation_id: "b", public_cell: "35.00,139.00", taxon_label: "スズメ" },
    { observation_id: "c", public_cell: "hidden", taxon_label: null },
    { observation_id: "d", public_cell: "35.10,139.10", taxon_label: "ブラックバス" },
    { observation_id: "e", public_cell: "35.10,139.10", taxon_label: "ニホンザリガニ" },
  ];
  const kept = filterInvasiveRows(rows);
  assert.deepEqual(kept.map((row) => row.observation_id), ["a", "d"]);
  assert.equal(kept[0], rows[0]);
  assert.equal(rows.length, 5);
  assert.deepEqual(filterInvasiveRows([]), []);
});

test("item decorator adds invasive only for classified labels", () => {
  const item = { occurrenceId: "occ:a:0", displayName: "アライグマ" };
  const decorated = decorateInvasiveItem(item, "アライグマ") as typeof item & { invasive?: { label: string; legalNote: string; learnHref: string } };
  assert.equal(decorated.invasive?.label, "特定外来生物");
  assert.equal(decorated.invasive?.legalNote, "持ち帰らない・動かさない");
  assert.equal(decorated.invasive?.learnHref, "/ja/learn/invasive-species/procyon-lotor");
  assert.equal(decorated.occurrenceId, "occ:a:0");
  assert.equal(decorateInvasiveItem(item, "スズメ"), item);
  assert.ok(!("invasive" in item));
});

test("cell extras only when active", () => {
  assert.deepEqual(invasiveCellExtras([1, 2, 3], true), { invasiveCount: 3 });
  assert.deepEqual(invasiveCellExtras([1, 2, 3], false), {});
  assert.equal(JSON.stringify({ a: 1, ...invasiveCellExtras([1], false) }), '{"a":1}');
});

test("map html path and body marker", () => {
  for (const path of ["/map", "/ja/map", "/en/map", "/es/map", "/pt-br/map", "/ja/map/"]) assert.equal(isMapHtmlPath(path), true, path);
  for (const path of ["/ja/map/x", "/ja/maps", "/ja/home", "/ja/records", "/api/v1/map/cells"]) assert.equal(isMapHtmlPath(path), false, path);
  const html = '<!doctype html><html><head></head><body data-zukan-design="v1" class="x"><main></main></body></html>';
  assert.equal(injectMapInvasiveMarker(html, false), html);
  assert.equal(
    injectMapInvasiveMarker(html, true),
    '<!doctype html><html><head></head><body data-map-invasive="1" data-zukan-design="v1" class="x"><main></main></body></html>',
  );
  assert.equal(injectMapInvasiveMarker("<body>", true), '<body data-map-invasive="1">');
  assert.equal(injectMapInvasiveMarker("<bodyguard>", true), "<bodyguard>");
  assert.equal(injectMapInvasiveMarker("<p>no body</p>", true), "<p>no body</p>");
});
