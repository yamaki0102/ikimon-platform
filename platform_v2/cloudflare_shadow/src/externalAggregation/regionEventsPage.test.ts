import assert from "node:assert/strict";
import test from "node:test";
import { loadRegionEventList, renderRegionEventsPage } from "./regionEventsPage";
import { seedExt } from "./regionShelf.testkit";
import { migratedDb } from "./sqliteDb.testkit";

const NOW = new Date("2026-11-28T03:00:00Z");

function seedMore(sqlite: any, n: number) {
  sqlite.prepare("INSERT INTO admin_units (code,level,parent_code,name_ja,boundary_version) VALUES ('22132','ward','22130','浜名区','t')").run();
  sqlite.prepare("INSERT INTO ext_places (place_id,name,admin_unit_id,city_unit_id,created_at) VALUES ('p2','浜名公民館','22132','22130','x')").run();
  for (let i = 0; i < n; i++) {
    const id = `m${String(i).padStart(2, "0")}`;
    const day = String(1 + Math.floor(i / 3)).padStart(2, "0");
    const cat = i % 2 === 0 ? "かんきょう" : "講座・教室";
    sqlite.prepare("INSERT INTO ext_events (event_id,org_id,place_id,title,category,starts_at,status,city_unit_id,updated_at) VALUES (?,?,?,?,?,?,?,?,'x')")
      .run(id, "o1", i % 3 === 0 ? "p2" : "p1", `行事${id}`, i === 5 ? null : cat, `2026-12-${day}T1${i % 10}:00:00+09:00`, "active", "22130");
    sqlite.prepare("INSERT INTO ext_source_records (record_id,source_id,external_ref,url,kind,raw_json,content_hash,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(`r-${id}`, "S1", id, `https://x/${id}`, "event", i === 5 ? JSON.stringify({ category: "かんきょう" }) : "{}", "h", "2026-11-20", "2026-11-27T01:00:00Z");
    sqlite.prepare("INSERT INTO ext_item_sources (item_kind,item_id,record_id,role) VALUES ('event',?,?,'official')").run(id, `r-${id}`);
  }
}

test("list groups by day, hides past and sourceless, no images", async () => {
  const { db, sqlite } = migratedDb();
  seedExt(sqlite);
  const list = await loadRegionEventList(db, "浜松市", NOW, {});
  assert.deepEqual(list.items.map((i) => i.event_id), ["e-ok"]);
  const html = renderRegionEventsPage({ list, area: "浜松市", lang: "ja", authenticated: false });
  assert.match(html, /<h2 class="re-day">12月5日（土）<\/h2>/);
  assert.match(html, /浜松市のまちの行事 \| ZUKAN/);
  assert.match(html, /出典：浜松市オープンデータ（イベント情報）／取得日 2026-11-27/);
  assert.match(html, /target="_blank" rel="noopener nofollow"/);
  assert.doesNotMatch(html, /出典なし|過去の行事|非表示|他市/);
  assert.doesNotMatch(html.slice(html.indexOf("data-region-events-page")), /<img/);
  assert.match(html, /浜松市のページへ戻る/);
});

test("30 per page with next link", async () => {
  const { db, sqlite } = migratedDb();
  seedExt(sqlite);
  seedMore(sqlite, 40);
  const p1 = await loadRegionEventList(db, "浜松市", NOW, { page: 1 });
  assert.equal(p1.items.length, 30);
  assert.equal(p1.total, 41);
  assert.equal(p1.pages, 2);
  const h1 = renderRegionEventsPage({ list: p1, area: "浜松市", lang: "ja", authenticated: false });
  assert.match(h1, /rel="next" href="[^"]*page=2"/);
  assert.equal((h1.match(/data-region-ext-event=/g) ?? []).length, 30);
  const p2 = await loadRegionEventList(db, "浜松市", NOW, { page: 2 });
  assert.equal(p2.items.length, 11);
  assert.match(renderRegionEventsPage({ list: p2, area: "浜松市", lang: "ja", authenticated: false }), /rel="prev"/);
});

test("category filter uses column or record json; ward filter narrows", async () => {
  const { db, sqlite } = migratedDb();
  seedExt(sqlite);
  seedMore(sqlite, 12);
  const nature = await loadRegionEventList(db, "浜松市", NOW, { cat: "かんきょう" });
  assert.equal(nature.items.length, 7);
  assert.ok(nature.items.some((i) => i.event_id === "m05"));
  const course = await loadRegionEventList(db, "浜松市", NOW, { cat: "講座" });
  assert.equal(course.items.length, 5);
  const ward = await loadRegionEventList(db, "浜松市", NOW, { ward: "22132" });
  assert.deepEqual(ward.items.map((i) => i.event_id), ["m00", "m03", "m06", "m09"]);
  assert.deepEqual(ward.wards.map((w) => w.code), ["22131", "22132"]);
  const html = renderRegionEventsPage({ list: nature, area: "浜松市", lang: "ja", authenticated: false });
  assert.match(html, /aria-current="true"[^>]*>自然・かんきょう/);
  assert.match(html, /data-region-events-wards="1"/);
  const none = await loadRegionEventList(db, "浜松市", NOW, { cat: "スポーツ" });
  assert.match(renderRegionEventsPage({ list: none, area: "浜松市", lang: "ja", authenticated: false }), /この条件の行事はありません/);
});

test("english heading and missing tables render empty page", async () => {
  const { db, sqlite } = migratedDb();
  seedExt(sqlite);
  const list = await loadRegionEventList(db, "浜松市", NOW, {});
  assert.match(renderRegionEventsPage({ list, area: "浜松市", lang: "en", authenticated: false }), /Events in 浜松市/);
  const broken = await loadRegionEventList({ prepare: () => ({ bind: () => ({ all: async () => { throw new Error("no table"); }, first: async () => { throw new Error("no table"); } }) }) }, "浜松市", NOW, {});
  assert.equal(broken.items.length, 0);
  assert.match(renderRegionEventsPage({ list: broken, area: "浜松市", lang: "ja", authenticated: false }), /この条件の行事はありません/);
});
