import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import type { Env } from "./core/env";
import * as flagDef from "./flags/REGION_SEASON_ENABLED";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import { migratedDb } from "./externalAggregation/sqliteDb.testkit";
import { pickPeakMonths, renderSeasonShelf, loadRegionCalendar, loadRegionSeason, renderRegionCalendarPage, runPlacePeakMonthsBackfill } from "./regionSeason";
import { RESERVED_REGION_SLUGS, resolveRegionSlugPath } from "./regionSlugs";

const NOW = new Date("2026-11-28T03:00:00Z");
const AREA = "浜松市";
let seq = 0;

function seed(sqlite: any) {
  for (const [id, name] of [["pA", "佐鳴湖公園"], ["pB", "連理の木の下で"], ["pC", "中田島砂丘"], ["pD", "写真なしの池"]]) {
    sqlite.prepare(`INSERT INTO places (place_id,canonical_name,canonical_name_normalized,place_kind,public_profile_status,municipality,prefecture) VALUES (?,?,?, 'park','published',?, '静岡県')`).run(id, name, name, AREA);
  }
  sqlite.prepare(`INSERT INTO places (place_id,canonical_name,canonical_name_normalized,place_kind,public_profile_status,municipality) VALUES ('pX','他市の公園','他市の公園','park','published','磐田市')`).run();
}

function rec(sqlite: any, id: string, at: string, label: string, placeId: string | null, o: { vis?: string; hidden?: number; area?: string } = {}) {
  sqlite.prepare(`INSERT INTO observations (observation_id,draft_id,owner_user_id,observed_at,taxon_label,public_cell,visibility,emergency_hidden) VALUES (?,?,?,?,?,?,?,?)`).run(id, `d-${id}-${seq++}`, "u1", at, label, "c1", o.vis ?? "public", o.hidden ?? 0);
  sqlite.prepare(`INSERT INTO readmodel_public_observations (observation_id,public_cell,observed_at,taxon_label,public_area_label) VALUES (?,?,?,?,?)`).run(id, "c1", at, label, o.area ?? AREA);
  if (placeId) sqlite.prepare(`INSERT INTO record_place_memberships (membership_id,record_id,place_id,membership_type,membership_state,derivation_source,calculation_version,public_precision) VALUES (?,?,?, 'inside','confirmed','test','v1','place')`).run(`m-${id}`, id, placeId);
}

const photosFor = (map: Record<string, string>) => async (ids: readonly string[]) => new Map(ids.filter((i) => map[i]).map((i) => [i, map[i]!]));
const never = async () => false;
const peakRows = (sqlite: any, place: string) => sqlite.prepare("SELECT month, source, evidence_count FROM place_peak_months WHERE place_id = ? ORDER BY month").all(place).map((r: any) => ({ ...r }));

test("flag is registered in zukan_region and off by default", () => {
  assert.equal(flagDef.flag, "REGION_SEASON_ENABLED");
  assert.equal(flagDef.lane, "zukan_region");
  assert.equal(flagDef.production, false);
  assert.ok(PROTOTYPE_FLAGS.some((f) => f.flag === "REGION_SEASON_ENABLED"));
});

test("peak months: a place seen in one season only gets none; otherwise top months with at least 2 records", () => {
  assert.deepEqual(pickPeakMonths(new Map([[10, 4], [11, 5], [9, 3]])), []);
  assert.deepEqual(pickPeakMonths(new Map([[11, 3], [4, 2], [7, 1]])), [4, 11]);
  assert.deepEqual(pickPeakMonths(new Map([[11, 1], [4, 1]])), []);
});

test("peak months backfill: off by default, records-only, never overwrites human rows, does not rescan unchanged places", async (t) => {
  const { db, sqlite } = migratedDb();
  t.after(() => sqlite.close());
  seed(sqlite);
  for (const d of ["2025-11-03", "2025-11-10", "2026-11-12"]) rec(sqlite, `a-n-${d}`, `${d}T10:00:00+09:00`, "カモ", "pA");
  for (const d of ["2026-04-03", "2026-04-09"]) rec(sqlite, `a-a-${d}`, `${d}T10:00:00+09:00`, "ツバメ", "pA");
  rec(sqlite, "a-j", "2026-07-01T10:00:00+09:00", "セミ", "pA");
  for (const d of ["2025-11-03", "2026-11-04", "2026-11-05"]) rec(sqlite, `b-n-${d}`, `${d}T10:00:00+09:00`, "カエデ", "pB");
  rec(sqlite, "a-priv", "2026-04-20T10:00:00+09:00", "ヒバリ", "pA", { vis: "private" });
  sqlite.prepare("INSERT INTO place_peak_months (place_id, month, source, evidence_count) VALUES ('pA', 11, 'human', 99)").run();
  const off = await runPlacePeakMonthsBackfill({ OBS_DB: db as never });
  assert.equal(off.scanned, 0);
  const r = await runPlacePeakMonthsBackfill({ PLACE_CATEGORY_BACKFILL: "on", OBS_DB: db as never });
  assert.equal(r.scanned, 2);
  assert.equal(r.assigned, 1);
  assert.deepEqual(peakRows(sqlite, "pA").filter((x: any) => x.month > 0), [
    { month: 4, source: "records", evidence_count: 2 },
    { month: 11, source: "human", evidence_count: 99 },
  ]);
  assert.deepEqual(peakRows(sqlite, "pB").filter((x: any) => x.month > 0), []);
  assert.equal((await runPlacePeakMonthsBackfill({ PLACE_CATEGORY_BACKFILL: "on", OBS_DB: db as never })).scanned, 0);
});

test("season shelf: only this month's places, one card per photo, gated records skipped, no shelf at 0", async (t) => {
  const { db, sqlite } = migratedDb();
  t.after(() => sqlite.close());
  seed(sqlite);
  rec(sqlite, "ra1", "2026-11-12T09:00:00+09:00", "カモ", "pA");
  rec(sqlite, "ra0", "2026-11-01T09:00:00+09:00", "オオバン", "pA");
  rec(sqlite, "rb1", "2026-11-20T09:00:00+09:00", "カエデ", "pB");
  rec(sqlite, "rc1", "2026-11-03T09:00:00+09:00", "ヒヨドリ", "pC");
  rec(sqlite, "rd1", "2026-11-05T09:00:00+09:00", "メダカ", "pD");
  rec(sqlite, "rpriv", "2026-11-25T09:00:00+09:00", "ひみつ", "pA", { vis: "private" });
  rec(sqlite, "rhid", "2026-11-26T09:00:00+09:00", "ひみつ2", "pA", { hidden: 1 });
  const peak = sqlite.prepare("INSERT INTO place_peak_months (place_id, month, source, evidence_count) VALUES (?,?, 'records', ?)");
  peak.run("pA", 11, 9); peak.run("pB", 11, 8); peak.run("pC", 11, 7); peak.run("pD", 11, 6); peak.run("pA", 4, 5); peak.run("pX", 11, 50);
  const photos = photosFor({ ra1: "/m/shared.jpg", rb1: "/m/shared.jpg", ra0: "/m/a0.jpg", rc1: "/m/c1.jpg", rpriv: "/m/p.jpg", rhid: "/m/h.jpg" });
  const data = await loadRegionSeason(db as never, AREA, NOW, photos, never);
  assert.equal(data.month, 11);
  assert.deepEqual(data.cards.map((c) => c.placeId), ["pA", "pC"]);
  assert.equal(new Set(data.cards.map((c) => c.photoUrl)).size, data.cards.length);
  assert.equal(data.cards[0]!.observationId, "ra1");
  assert.equal(data.cards[0]!.label, "カモ");
  const gated = await loadRegionSeason(db as never, AREA, NOW, photos, async (id) => id === "ra1");
  assert.equal(gated.cards[0]!.observationId, "ra0");
  const html = renderSeasonShelf("ja", "/ja/regions/jp/shizuoka/hamamatsu", "/ja", data, AREA);
  assert.match(html, /data-region-shelf="season"/);
  assert.match(html, /data-region-calendar-month="11" aria-current="true"/);
  assert.match(html, /\/calendar\/11/);
  assert.doesNotMatch(html, /data-region-calendar-month="3"[^>]*href/);
  assert.equal((html.match(/shared\.jpg/g) ?? []).length, 1);
  const none = await loadRegionSeason(db as never, AREA, NOW, async () => new Map(), never);
  assert.equal(none.cards.length, 0);
  assert.doesNotMatch(renderSeasonShelf("ja", "/b", "/ja", none, AREA), /data-region-shelf="season"/);
  assert.equal(renderSeasonShelf("ja", "/b", "/ja", null, AREA), "");
});

test("calendar: same place this year and before becomes a pair, the rest are finds, no photo twice; empty month points to nearest", async (t) => {
  const { db, sqlite } = migratedDb();
  t.after(() => sqlite.close());
  seed(sqlite);
  rec(sqlite, "n1", "2026-11-12T09:00:00+09:00", "カモ", "pA");
  rec(sqlite, "o1", "2025-11-10T09:00:00+09:00", "カモ", "pA");
  rec(sqlite, "n2", "2026-11-20T09:00:00+09:00", "カエデ", "pB");
  rec(sqlite, "n3", "2026-11-03T09:00:00+09:00", "ヒヨドリ", "pC");
  rec(sqlite, "n4", "2026-11-04T09:00:00+09:00", "ヒヨドリ", "pC");
  rec(sqlite, "npriv", "2026-11-25T09:00:00+09:00", "ひみつ", "pB", { vis: "private" });
  rec(sqlite, "apr", "2026-04-02T09:00:00+09:00", "ツバメ", "pA");
  rec(sqlite, "other", "2026-11-02T09:00:00+09:00", "他市の鳥", null, { area: "磐田市" });
  const photos = photosFor({ n1: "/m/n1.jpg", o1: "/m/o1.jpg", n2: "/m/n2.jpg", n3: "/m/n3.jpg", npriv: "/m/priv.jpg" });
  const data = await loadRegionCalendar(db as never, AREA, 11, NOW, photos, never);
  assert.equal(data.pairs.length, 1);
  assert.equal(data.pairs[0]!.placeId, "pA");
  assert.equal(data.pairs[0]!.thisYear.id, "n1");
  assert.equal(data.pairs[0]!.before.id, "o1");
  assert.deepEqual(data.finds.map((f) => f.id).sort(), ["n2", "n4"]);
  assert.ok(!data.finds.some((f) => f.id === "npriv" || f.id === "other"));
  const html = renderRegionCalendarPage({ data, lang: "ja", authenticated: false });
  assert.match(html, /<title>浜松市の観察暦 11月 \| ZUKAN<\/title>/);
  assert.match(html, /data-region-calendar-pair="pA"/);
  assert.match(html, /今年・11月/);
  assert.match(html, /去年・11月/);
  assert.match(html, /今月の発見/);
  const urls = html.match(/<img src="\/m\/[a-z0-9]+\.jpg/g) ?? [];
  assert.equal(new Set(urls).size, urls.length);
  assert.doesNotMatch(html, /priv\.jpg/);
  const empty = await loadRegionCalendar(db as never, AREA, 2, NOW, photos, never);
  assert.deepEqual(empty.nearest, [4, 11]);
  const emptyHtml = renderRegionCalendarPage({ data: empty, lang: "ja", authenticated: false });
  assert.match(emptyHtml, /data-region-calendar-other="4"/);
  assert.match(emptyHtml, /\/calendar\/4"/);
});

test("regionSlugs: calendar is reserved so /calendar/<m> never resolves as a region", () => {
  assert.ok(RESERVED_REGION_SLUGS.includes("calendar"));
  assert.equal(resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu", "calendar"], "2026-11-28"), null);
  assert.equal(resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu", "calendar", "11"], "2026-11-28"), null);
  assert.equal(resolveRegionSlugPath(["jp", "shizuoka", "hamamatsu"], "2026-11-28")?.kind, "current");
});

test("routes: flag off changes nothing; on serves the calendar month page and the month strip", async (t) => {
  const { db, sqlite } = migratedDb();
  t.after(() => sqlite.close());
  seed(sqlite);
  const month = new Date(Date.now() + 9 * 3600000).getUTCMonth() + 1;
  const year = new Date(Date.now() + 9 * 3600000).getUTCFullYear();
  const mm = String(month).padStart(2, "0");
  rec(sqlite, "r1", `${year}-${mm}-02T09:00:00+09:00`, "カモ", "pA");
  rec(sqlite, "r2", `${year - 1}-${mm}-02T09:00:00+09:00`, "カモ", "pA");
  const base = { ENVIRONMENT: "staging", CORE_DB: db, OBS_DB: db } as unknown as Env;
  const rollouts = (state: string) => JSON.stringify({ REGION_SURFACE_V1_ENABLED: { state: "all" }, REGION_SEASON_ENABLED: { state } });
  const get = (path: string, state: string) => worker.fetch(new Request(`https://zukan.earth${path}`), { ...base, ZUKAN_FEATURE_ROLLOUTS: rollouts(state) } as unknown as Env, undefined as never);
  const off = await get("/ja/regions/jp/shizuoka/hamamatsu", "off");
  assert.equal(off.status, 200);
  const offHtml = await off.text();
  assert.doesNotMatch(offHtml, /data-region-shelf="calendar"/);
  assert.doesNotMatch(offHtml, /data-region-shelf="season"/);
  assert.notEqual((await get(`/ja/regions/jp/shizuoka/hamamatsu/calendar/${month}`, "off")).status, 200);
  const on = await get("/ja/regions/jp/shizuoka/hamamatsu", "all");
  const onHtml = await on.text();
  assert.match(onHtml, /data-region-shelf="calendar"/);
  assert.match(onHtml, new RegExp(`/ja/regions/jp/shizuoka/hamamatsu/calendar/${month}"`));
  const page = await get(`/ja/regions/jp/shizuoka/hamamatsu/calendar/${month}`, "all");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /data-region-calendar-month-page=/);
  assert.equal((await get("/ja/regions/jp/shizuoka/hamamatsu/calendar/13", "all")).status === 200, false);
});
