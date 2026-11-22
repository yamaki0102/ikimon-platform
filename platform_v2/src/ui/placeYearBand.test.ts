import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Fastify from "fastify";
import { registerLegacyAssetRoutes } from "../routes/legacyAssets.js";
import { PLACE_YEAR_BAND_STYLES, renderPlaceYearBand, type PlaceYearBandLang } from "./placeYearBand.js";
import { placeYearBandAsset } from "./placeYearBandScript.js";

const LANGS: PlaceYearBandLang[] = ["ja", "en", "es", "pt-br"];
const NOW_LABEL: Record<PlaceYearBandLang, string> = { ja: "いま", en: "Now", es: "Ahora", "pt-br": "Agora" };
const years = [1971, 1998, 2008];

function band(lang: PlaceYearBandLang, year: number | null = null, map = false): string {
  return renderPlaceYearBand({
    lang,
    basePath: "",
    currentPath: `/${lang}/`,
    place: { id: "minato-dori", label: "みなと通り周辺" },
    years,
    state: { place: "minato-dori", year, map, record: null },
    currentYear: 2026,
  });
}

test("band markup per language", () => {
  for (const lang of LANGS) {
    const html = band(lang);
    assert.equal((html.match(/<form\b[^>]*method="get"[^>]*data-place-year-band/g) ?? []).length, 1);
    assert.equal((html.match(/<form\b/g) ?? []).length, 1);
    assert.match(html, /<input type="range" name="year"/);
    assert.equal((html.match(/<option value="\d{4}"><\/option>/g) ?? []).length, years.length);
    assert.match(html, /<strong data-pyb-year>/);
    assert.ok(html.includes(`>${NOW_LABEL[lang]}</strong>`));
    assert.match(html, /<button[^>]*name="map"[^>]*aria-pressed="false"/);
    assert.match(html, /<noscript><button[^>]*type="submit"/);
    assert.match(html, new RegExp(`action="/${lang}/"`));
    assert.doesNotMatch(html, /\son[a-z]+=/i);
  }
});

test("year and map state reflected", () => {
  const html = band("ja", 2008, true);
  assert.match(html, /value="2008"/);
  assert.ok(html.includes(">2008年</strong>"));
  assert.ok(html.includes(">この年まで</small>"));
  assert.match(html, /name="map" value="0" aria-pressed="true"/);
});

test("styles keep 14px floor and 44px targets, map button outline", () => {
  for (const m of PLACE_YEAR_BAND_STYLES.matchAll(/font-size:\s*(\d*\.?\d+)(px|rem|em)/g)) {
    const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16;
    assert.ok(px >= 14, m[0]);
  }
  assert.match(PLACE_YEAR_BAND_STYLES, /\.pyb-map\{[^}]*min-height:var\(--zukan-control-min,44px\)[^}]*background:#fff/);
});

test("script asset is external, hashed, has no inline handlers", () => {
  const asset = placeYearBandAsset();
  assert.match(asset.path, /^\/assets\/ui\/place-year-band\.[a-f0-9]{12}\.js$/);
  assert.ok(band("ja").includes(`<script src="${asset.path}" defer></script>`));
  assert.doesNotMatch(band("ja"), /<script>/);
});

test("asset served by legacy asset routes", async () => {
  const app = Fastify();
  await registerLegacyAssetRoutes(app);
  try {
    const asset = placeYearBandAsset();
    const res = await app.inject({ method: "GET", url: asset.path });
    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers["content-type"]), /javascript/);
    assert.equal(res.body, asset.content.toString("utf8"));
  } finally {
    await app.close();
  }
});

test("worker static asset allowlist accepts the band asset", () => {
  const src = readFileSync(new URL("../../cloudflare_shadow/src/index.ts", import.meta.url), "utf8");
  const line = src.split("\n").find((l) => l.includes("place-year-band"));
  assert.ok(line, "worker allowlist line missing");
  const start = line.indexOf("/^");
  const end = line.indexOf("/.test(pathname)");
  const re = new RegExp(line.slice(start + 1, end));
  assert.equal(re.test(placeYearBandAsset().path), true);
  assert.equal(re.test("/assets/ui/place-year-band.zzzzzzzzzzzz.js"), false);
});
