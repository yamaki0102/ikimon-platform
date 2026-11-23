import assert from "node:assert/strict";
import test from "node:test";
import { buildPlaceYearHref, parsePlaceYearState } from "./placeYearState.js";

const CY = 2026;
const parse = (q: string) => parsePlaceYearState(new URL(`https://zukan.earth/ja/${q}`), CY);

test("place validation", () => {
  assert.equal(parse("?place=minato-dori").place, "minato-dori");
  assert.equal(parse("?place=cell:34.7,137.7").place, "cell:34.7,137.7");
  assert.equal(parse("?place=cell:1000:12:-3").place, "cell:1000:12:-3");
  assert.equal(parse("?place=cell:abc").place, null);
  assert.equal(parse("?place=a").place, null);
  assert.equal(parse("?place=../etc").place, null);
  assert.equal(parse("?place=%3Cscript%3E").place, null);
  assert.equal(parse("").place, null);
});

test("year validation", () => {
  assert.equal(parse("?year=1899").year, null);
  assert.equal(parse("?year=1900").year, 1900);
  assert.equal(parse("?year=2008").year, 2008);
  assert.equal(parse("?year=2026").year, 2026);
  assert.equal(parse("?year=2027").year, null);
  assert.equal(parse("?year=20a8").year, null);
  assert.equal(parse("?year=").year, null);
});

test("map and record", () => {
  assert.equal(parse("?map=1").map, true);
  assert.equal(parse("?map=0").map, false);
  assert.equal(parse("?map=true").map, false);
  assert.equal(parse("?record=abc_123-x").record, "abc_123-x");
  assert.equal(parse("?record=a").record, null);
  assert.equal(parse("?record=a/b").record, null);
});

test("href round trip keeps lang prefix", () => {
  for (const lang of ["ja", "en", "es", "pt-br"]) {
    const state = { place: "minato-dori", year: 2008, map: true, record: "rec_1" };
    const href = buildPlaceYearHref("", state, lang);
    assert.ok(href.startsWith(`/${lang}/?`));
    assert.deepEqual(parsePlaceYearState(new URL(href, "https://zukan.earth"), CY), state);
  }
  assert.equal(buildPlaceYearHref("/", {}, "en"), "/en/");
  assert.equal(buildPlaceYearHref("/app", { year: 1899, place: "x" }, "ja"), "/app/ja/");
  const cell = parsePlaceYearState(new URL(buildPlaceYearHref("", { place: "cell:34.7,137.7" }, "ja"), "https://zukan.earth"), CY);
  assert.equal(cell.place, "cell:34.7,137.7");
});
