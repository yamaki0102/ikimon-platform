import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { buildInvasiveRecords, recordsForRegion, renderInvasiveSpeciesPage, renderRegionInvasivePage, type InvasiveSourceRow } from "./invasiveMapV1";
import { renderPlaceV3 } from "./placeDetailV3";
import { renderRegionSpeciesListPage, renderRegionSurfacePage, type RegionSurfaceData } from "./regionSurfaceV1";
import { renderBiosecurityPage } from "../../src/ui/biosecurity";
import { listInvasiveSpecies } from "../../src/services/invasiveSpeciesCatalog";

const CJK = /[぀-ヿ㐀-鿿]/;
const NOW = Date.parse("2026-11-27T12:00:00Z");
const DATA = ["テスト市", "ナガエツルノゲイトウ", "セイヨウタンポポ", "アメリカザリガニ", "カワセミ", "アオサギ", "ヒアリ", "浅畑川", "観察会", "クビアカツヤカミキリの見守り"];

const clean = (html: string, extra: readonly string[] = []): string => {
  let out = html.replace(/<style[\s\S]*?<\/style>/g, "");
  const i = out.indexOf('<div class="iv-col');
  if (i >= 0) out = out.slice(i);
  out = out.split('<p class="zt-feedback-foot"')[0]!;
  for (const name of [...DATA, ...extra]) out = out.split(name).join("");
  return out.replace(/\([^)]*[぀-ヿ㐀-鿿][^)]*\)/g, "");
};
const assertNoJa = (html: string, label: string, extra: readonly string[] = []): void => {
  const out = clean(html, extra);
  const m = CJK.exec(out);
  assert.equal(m, null, `${label}: Japanese near "${m ? out.slice(Math.max(0, m.index - 60), m.index + 40) : ""}"`);
};

const row = (id: string, label: string, cell = "34.70,137.70", observedAt = "2026-11-10T01:00:00Z"): InvasiveSourceRow => ({ observation_id: id, public_cell: cell, observed_at: observedAt, taxon_label: label, public_area_label: "テスト市" });
const SOURCE = [row("a1", "ナガエツルノゲイトウ"), row("a2", "ナガエツルノゲイトウ", "34.80,137.80", "2026-09-05T01:00:00Z"), row("b1", "アメリカザリガニ"), row("c1", "セイヨウタンポポ", "34.90,137.90")];

test("English invasive region and species pages have no Japanese UI strings", () => {
  const records = buildInvasiveRecords(SOURCE, { nowMs: NOW, photos: new Map([["a1", "/p/1.webp"]]) });
  for (const lang of ["en", "es", "pt-br"] as const) {
    assertNoJa(renderRegionInvasivePage({ area: "テスト市", records: recordsForRegion(records, "テスト市"), lang, authenticated: true, displayName: "x", regionHref: "/en/regions/x" }), `region ${lang}`, ["アライグマ", "ヌートリア", "ヒアリ", "セアカゴケグモ", "オオクチバス", "カダヤシ", "カミツキガメ", "ウシガエル", "ガビチョウ", "ソウシチョウ", "オオキンケイギク", "ボタンウキクサ", "セイヨウオオマルハナバチ", "アルゼンチンアリ", "ミシシッピアカミミガメ"]);
    assertNoJa(renderRegionInvasivePage({ area: "テスト市", records: [], lang, authenticated: false }), `region-zero ${lang}`, ["アライグマ", "ヌートリア", "ヒアリ", "セアカゴケグモ", "オオクチバス", "カダヤシ", "カミツキガメ", "ウシガエル", "ガビチョウ", "ソウシチョウ", "オオキンケイギク", "ボタンウキクサ", "セイヨウオオマルハナバチ", "アルゼンチンアリ", "ミシシッピアカミミガメ"]);
  }
  for (const slug of ["alternanthera-philoxeroides", "taraxacum-officinale", "procambarus-clarkii", "solenopsis-invicta", "procyon-lotor", "paguma-larvata"]) {
    const names = ["アライグマ", "ハクビシン"];
    assertNoJa(renderInvasiveSpeciesPage({ slug, records, lang: "en", authenticated: true })!, `species ${slug} member`, names);
    assertNoJa(renderInvasiveSpeciesPage({ slug, records, lang: "en", authenticated: false })!, `species ${slug} guest`, names);
  }
  const html = renderInvasiveSpeciesPage({ slug: "taraxacum-officinale", records, lang: "en", authenticated: false })!;
  assert.match(html, /Priority countermeasure invasive species/);
  assert.match(html, /\/en\/learn\/invasive-species\/taraxacum-officinale/);
  assert.match(html, /<html lang="en">/);
  const rg = renderRegionInvasivePage({ area: "テスト市", records: recordsForRegion(records, "テスト市"), lang: "en", authenticated: false });
  assert.match(rg, /2 places/);
  assert.match(rg, /1 record/);
});

test("Japanese invasive pages keep their exact copy and links", () => {
  const records = buildInvasiveRecords(SOURCE, { nowMs: NOW });
  const html = renderInvasiveSpeciesPage({ slug: "taraxacum-officinale", records, lang: "ja", authenticated: false })!;
  assert.match(html, /重点対策外来種/);
  assert.match(html, /\/ja\/learn\/invasive-species\/taraxacum-officinale#identify/);
  assert.match(html, /<span class="iv-nb">1件<\/span> ・ 2026年11月から/);
});

const region = (over: Partial<RegionSurfaceData> = {}): RegionSurfaceData => ({
  area: "テスト市",
  recordTotal: 6,
  species: [
    { name: "カワセミ", group: "bird", records: 3, lastObservationId: "o1", photoUrl: "/p/1.webp", invasiveSlug: null },
    { name: "アオサギ", group: "other", records: 1, lastObservationId: "o2", photoUrl: null, invasiveSlug: null },
    { name: "ナガエツルノゲイトウ", group: "plant", records: 1, lastObservationId: "o3", photoUrl: null, invasiveSlug: "alternanthera-philoxeroides" },
  ],
  places: [{ id: "pl1", name: "浅畑川", locality: null, kind: "river" }],
  placeTotal: 2,
  events: [{ id: "e1", title: "観察会", startedAt: "2026-12-07T09:00:00Z" }],
  eventTotal: 1,
  cells: [{ cell: "34.70,137.70", count: 3 }],
  ...over,
});

test("English region pages have no Japanese UI strings", () => {
  for (const lang of ["en", "es", "pt-br"] as const) {
    assertNoJa(renderRegionSurfacePage({ data: region(), lang, authenticated: false, invasiveAvailable: true }), `surface ${lang}`);
    assertNoJa(renderRegionSpeciesListPage({ data: region(), group: null, lang, authenticated: false, invasiveAvailable: true }), `species ${lang}`);
    assertNoJa(renderRegionSpeciesListPage({ data: region({ species: [] }), group: null, lang, authenticated: false }), `species-empty ${lang}`);
  }
  const html = renderRegionSurfacePage({ data: region(), lang: "en", authenticated: false, invasiveAvailable: true });
  assert.match(html, /Wildlife/);
  assert.match(html, /2 places/);
  assert.match(html, /Birds · <span class="iv-nb">3 records<\/span>/);
});

test("Japanese region page keeps its copy", () => {
  const html = renderRegionSurfacePage({ data: region(), lang: "ja", authenticated: false, invasiveAvailable: true });
  assert.match(html, /鳥 ・ 記録 <span class="iv-nb">3件<\/span>/);
  assert.match(html, /2か所/);
});

test("place page v3 field-card link is localized", () => {
  const base = { prefix: "/en", canonicalPlaceId: "p", name: "x", localName: null, locality: "", hasRecords: true, suppressed: false, shownCount: 1, startYear: "2026", latestLabel: null, records: [], photoUrls: [], recordHref: "/r", fieldCardHref: "/fc", allRecordsHref: "/a", backHref: "/b", backLabel: "Back", shareLabel: "Share", copiedLabel: "Copied", shareTitle: "x", saveHtml: "", moreLabel: "m", moreHref: "/m", mapHref: "/map", externalMapHref: "", externalMapLabel: "", stewardIntro: null, events: [], steward: null, nearby: [], now: new Date("2026-11-27T00:00:00Z") };
  assert.match(renderPlaceV3({ ...base, lang: "en" }), />Pre-trip card</);
  assert.match(renderPlaceV3({ ...base, lang: "ja" }), />出発前カード</);
});

test("biosecurity chooser is English for /en and unchanged for ja", () => {
  const profile = { id: "gairai", title: "クビアカツヤカミキリの見守り", signals: [], summary: "s", guideUrl: "https://example.test/", safety: [] } as never;
  const en = renderBiosecurityPage("chooser", { lang: "en", profiles: [profile], profile });
  assert.match(en, /<html lang="en">/);
  assert.match(en, /Save what you found/);
  assert.match(en, /href="\/en\/biosecurity\/gairai\/capture"/);
  assertNoJa(en.slice(en.indexOf('<a class="bio-skip"')), "biosecurity en");
  const ja = renderBiosecurityPage("chooser", { profiles: [profile], profile });
  assert.match(ja, /見つけた生きものを残す/);
  assert.match(ja, /href="\/ja\/biosecurity\/gairai\/capture"/);
});

const routes = await import("../../src/routes/invasiveSpecies").catch(() => null);

test("learn invasive-species pages are English for /en", { skip: !routes }, async () => {
  const app = Fastify();
  await routes!.registerInvasiveSpeciesRoutes(app);
  const names = listInvasiveSpecies().map((item) => item.vernacularName);
  for (const url of ["/learn/invasive-species?lang=en", "/learn/invasive-species/procyon-lotor?lang=en", "/learn/invasive-species/no-such?lang=en"]) {
    const res = await app.inject({ method: "GET", url });
    if (url.startsWith("/learn/invasive-species?")) assert.match(res.body, /Safety notes for finding an invasive species/);
    const body = res.body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
    const main = body.slice(body.indexOf('<div class="invasive-page')).split("</main>")[0]!;
    let out = main;
    for (const name of names) out = out.split(name).join("");
    out = out.replace(/\([^)]*[぀-ヿ㐀-鿿][^)]*\)/g, "");
    const m = CJK.exec(out);
    assert.equal(m, null, `${url}: ${m ? out.slice(Math.max(0, m.index - 60), m.index + 40) : ""}`);
  }
  const ja = await app.inject({ method: "GET", url: "/learn/invasive-species/procyon-lotor" });
  assert.match(ja.body, /触らず、写真と場所を残す。/);
  await app.close();
});
