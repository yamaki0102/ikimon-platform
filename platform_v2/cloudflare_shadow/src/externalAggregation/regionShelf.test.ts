import assert from "node:assert/strict";
import test from "node:test";
import { loadRegionExternalEvents, renderRegionExternalShelf } from "./regionShelf";
import { seedExt } from "./regionShelf.testkit";
import { migratedDb } from "./sqliteDb.testkit";

const NOW = new Date("2026-11-28T03:00:00Z");

test("shelf loads only sourced, current, active events of the area", async () => {
  const { db, sqlite } = migratedDb();
  seedExt(sqlite);
  const r = await loadRegionExternalEvents(db, "浜松市", NOW);
  assert.deepEqual(r.items.map((i) => i.event_id), ["e-ok"]);
  assert.equal(r.total, 1);
  assert.equal(r.items[0]!.venue_name, "市民会館（中央区）");
  assert.equal(r.items[0]!.organizer_name, "浜松市みどり課");
  assert.equal(r.items[0]!.fetched_at, "2026-11-27T01:00:00Z");
  const html = renderRegionExternalShelf("ja", r);
  assert.match(html, /data-region-shelf="ext-events"/);
  assert.match(html, /まちの行事/);
  assert.match(html, /rel="noopener nofollow"/);
  assert.match(html, /出典：浜松市オープンデータ（イベント情報）／取得日 2026-11-27/);
  assert.doesNotMatch(html, /出典なし|過去の行事|非表示|他市/);
  assert.doesNotMatch(html, /<img/);
  assert.match(renderRegionExternalShelf("en", r), /Events in town/);
});

test("more than the limit shows the remainder count", async () => {
  const { db, sqlite } = migratedDb();
  seedExt(sqlite, { n: 6 });
  const r = await loadRegionExternalEvents(db, "浜松市", NOW);
  assert.equal(r.items.length, 5);
  assert.equal(r.total, 7);
  assert.match(renderRegionExternalShelf("ja", r, "/ja/regions/jp/shizuoka/hamamatsu/events"), /href="\/ja\/regions\/jp\/shizuoka\/hamamatsu\/events">すべて見る（7件）/);
  assert.match(renderRegionExternalShelf("ja", r), /ほか 2件/);
});

test("missing tables or empty data give empty output", async () => {
  const empty = await loadRegionExternalEvents({ prepare: () => ({ bind: () => ({ all: async () => { throw new Error("no table"); }, first: async () => { throw new Error("no table"); } }) }) }, "浜松市", NOW);
  assert.deepEqual(empty, { items: [], total: 0 });
  assert.equal(renderRegionExternalShelf("ja", empty), "");
  const { db } = migratedDb();
  assert.equal((await loadRegionExternalEvents(db, "浜松市", NOW)).total, 0);
});
