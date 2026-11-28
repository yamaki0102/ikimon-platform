import assert from "node:assert/strict";
import test from "node:test";
import { REGION_SLUG_ENTRIES } from "./regionSlugs.data";
import { readFileSync } from "node:fs";
import { RESERVED_REGION_SLUGS, labelToSlugPath, regionPath, resolveRegionSlugPath } from "./regionSlugs";

const NOW = "2026-11-28";

test("浜松市と中央区が解決される", () => {
  const city = resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu"], NOW);
  assert.deepEqual(city && city.kind === "current" ? [city.label, city.code, city.level] : null, ["浜松市", "22130", "city"]);
  const ward = resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu", "chuo"], NOW);
  assert.deepEqual(ward && ward.kind === "current" ? [ward.label, ward.code] : null, ["浜松市中央区", "22138"]);
  assert.equal(resolveRegionSlugPath(["jp", "shizuoka", "shizuoka", "aoi"], NOW)?.kind, "current");
});

test("旧中区は中央区へ、旧北区は複数後継のため親へ", () => {
  assert.deepEqual(resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu", "naka"], NOW), { kind: "redirect", to: "/regions/jp/shizuoka/hamamatsu/chuo" });
  assert.deepEqual(resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu", "kita"], NOW), { kind: "redirect", to: "/regions/jp/shizuoka/hamamatsu" });
  assert.deepEqual(resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu", "hamakita"], NOW), { kind: "redirect", to: "/regions/jp/shizuoka/hamamatsu/hamana" });
});

test("天竜区は新旧コードで同じslug", () => {
  const entries = REGION_SLUG_ENTRIES.filter((e) => e.slug === "tenryu");
  assert.deepEqual(entries.map((e) => e.code).sort(), ["22137", "22140"]);
  const now = resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu", "tenryu"], NOW);
  assert.equal(now?.kind === "current" ? now.code : null, "22140");
  const before = resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu", "tenryu"], "2020-01-01");
  assert.equal(before?.kind === "current" ? before.code : null, "22137");
});

test("同じ親の下で同一slugの期間が重複しない・コードは同一slug内でのみ共有", () => {
  const groups = new Map<string, typeof REGION_SLUG_ENTRIES>();
  for (const e of REGION_SLUG_ENTRIES) groups.set(`${e.parent_slug}|${e.slug}`, [...(groups.get(`${e.parent_slug}|${e.slug}`) ?? []), e]);
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        const overlap = a.valid_from <= (b.valid_to ?? "9999-12-31") && b.valid_from <= (a.valid_to ?? "9999-12-31");
        assert.equal(overlap, false, `${a.slug} ${a.code}/${b.code}`);
      }
    }
  }
  const codeOwners = new Map<string, string>();
  for (const e of REGION_SLUG_ENTRIES) {
    const key = `${e.parent_slug}|${e.slug}`;
    assert.equal(codeOwners.get(e.code) ?? key, key, e.code);
    codeOwners.set(e.code, key);
  }
});

test("リンク生成: 市は英字URL、他県ラベルは従来URL", () => {
  assert.equal(labelToSlugPath("浜松市"), "jp/shizuoka/hamamatsu");
  assert.equal(regionPath("ja", "浜松市"), "/ja/regions/jp/shizuoka/hamamatsu");
  assert.equal(regionPath("en", "浜松市", "/species"), "/en/regions/jp/shizuoka/hamamatsu/species");
  assert.equal(regionPath("ja", "浜松市中央区"), "/ja/regions/jp/shizuoka/hamamatsu/chuo");
  assert.equal(regionPath("ja", "22138"), "/ja/regions/jp/shizuoka/hamamatsu/chuo");
  assert.equal(regionPath("ja", "札幌市"), `/ja/regions/${encodeURIComponent("札幌市")}`);
  assert.equal(labelToSlugPath("浜松市中区"), null);
});

test("events は予約語で、地域のURLと旧URLの規則に載る", () => {
  assert.equal(regionPath("ja", "浜松市", "/events"), "/ja/regions/jp/shizuoka/hamamatsu/events");
  assert.equal(regionPath("ja", "札幌市", "/events"), `/ja/regions/${encodeURIComponent("札幌市")}/events`);
  assert.ok(REGION_SLUG_ENTRIES.every((e) => !RESERVED_REGION_SLUGS.includes(e.slug)));
  assert.equal(resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu", "events"], NOW), null);
  assert.equal(resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu"], NOW)?.kind, "current");
  const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.ok(src.includes("(\\/species|\\/invasive|\\/events|\\/places|\\/calendar\\/(?:[1-9]|1[0-2]))?$/u"));
  assert.ok(src.includes('slugSuffix === "/events"'));
});

test("未知のslugはnull", () => {
  assert.equal(resolveRegionSlugPath(["jp", "shizuoka", "nowhere"], NOW), null);
  assert.equal(resolveRegionSlugPath(["us"], NOW), null);
});
