import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import type { Env } from "./core/env";
import * as flagDef from "./flags/PLACE_CATEGORIES_ENABLED";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import { migratedDb } from "./externalAggregation/sqliteDb.testkit";
import { seedExt } from "./externalAggregation/regionShelf.testkit";
import {
  HIDDEN_CATEGORY, PLACE_CATEGORIES, canOverwriteAssignment, classifyPlace, type PlaceClassifyInput,
} from "./placeCategories";
import { loadRegionCategories, renderRegionCategoryEntrances, runPlaceCategoryBackfill } from "./placeCategoryRegion";

const c = (name: string, extra: Partial<PlaceClassifyInput> = {}) => classifyPlace({ canonical_name: name, place_kind: "other_named_area", ...extra });
const meta = (tags: Record<string, string>, nested = true) => JSON.stringify(nested ? { tags } : tags);

test("12 categories defined with at most 3 examples each", () => {
  assert.equal(PLACE_CATEGORIES.length, 12);
  assert.equal(PLACE_CATEGORIES[0]!.label, "自然を歩く");
  assert.equal(new Set(PLACE_CATEGORIES.map((d) => d.id)).size, 12);
  for (const d of PLACE_CATEGORIES) assert.equal(d.examples.length, 3);
});

test("flag is registered in zukan_region and off by default", () => {
  assert.equal(flagDef.flag, "PLACE_CATEGORIES_ENABLED");
  assert.equal(flagDef.lane, "zukan_region");
  assert.equal(flagDef.staging, false);
  assert.equal(flagDef.production, false);
  assert.ok(PROTOTYPE_FLAGS.some((f) => f.flag === "PLACE_CATEGORIES_ENABLED"));
});

test("boundary: 整骨院・接骨院・鍼灸は診てもらう、整体・エステは整える・癒やす", () => {
  assert.equal(c("たかはし整骨院")!.primary, "medical");
  assert.equal(c("やまだ接骨院")!.primary, "medical");
  assert.equal(c("鍼灸院ひだまり")!.primary, "medical");
  assert.equal(c("ほぐし整体院")!.primary, "care");
  assert.equal(c("エステサロンA")!.primary, "care");
  assert.equal(c("美容室ルーチェ")!.primary, "care");
  assert.equal(c("駅前温泉")!.primary, "care");
});

test("boundary: 運動施設は公営・民営で割らず遊ぶ・観る", () => {
  for (const n of ["市民体育館", "スポーツジム ゴールド", "ホットヨガ ルーナ", "市営プール", "フィットネスクラブ"]) assert.equal(c(n)!.primary, "play", n);
});

test("boundary: 博物館・美術館・科学館は遊ぶ・観る、学校・図書館は学ぶ・通う", () => {
  for (const n of ["市立博物館", "県立美術館", "こども科学館"]) assert.equal(c(n)!.primary, "play", n);
  for (const n of ["浜松北高等学校", "中央図書館", "さくら幼稚園", "進学塾ステップ"]) assert.equal(c(n)!.primary, "learn", n);
  assert.equal(classifyPlace({ canonical_name: "郷土のもの", place_kind: "museum" })!.primary, "play");
});

test("boundary: 福祉・介護は診てもらう", () => {
  for (const n of ["デイサービスひまわり", "特別養護老人ホーム", "子育て支援センター", "訪問看護ステーション"]) assert.equal(c(n)!.primary, "medical", n);
  for (const n of ["市民病院", "山田歯科", "みどり動物病院"]) assert.equal(c(n)!.primary, "medical", n);
});

test("boundary: 薬の線（薬局=診てもらう、ドラッグストア=買う、調剤ありは実際に受け付ける店だけ）", () => {
  const pharmacy = c("みらい薬局")!;
  assert.equal(pharmacy.primary, "medical");
  assert.deepEqual(pharmacy.tags, []);
  const dispensingPharmacy = c("みらい薬局", { metadata_json: meta({ dispensing: "yes" }) })!;
  assert.deepEqual(dispensingPharmacy.tags, ["dispensing"]);
  const drug = c("ウエルシアドラッグストア")!;
  assert.equal(drug.primary, "buy");
  assert.deepEqual(drug.tags, []);
  const drugDispensing = c("マツモトドラッグストア", { metadata_json: meta({ dispensing: "yes" }) })!;
  assert.equal(drugDispensing.primary, "buy");
  assert.ok(drugDispensing.tags.includes("dispensing"));
  assert.ok(drugDispensing.tags.includes("medical"));
});

test("boundary: 公園の線（遊具・広場=遊ぶ・観る、地形・生態=自然を歩く）", () => {
  assert.equal(c("あおば児童公園", { place_kind: "park" })!.primary, "play");
  assert.equal(c("中央公園", { place_kind: "park" })!.primary, "play");
  assert.equal(c("佐鳴湖公園", { place_kind: "park" })!.primary, "nature");
  assert.equal(c("森林公園", { place_kind: "park" })!.primary, "nature");
  assert.equal(c("遊具の広場公園", { place_kind: "park", metadata_json: meta({ leisure: "playground" }) })!.primary, "play");
  assert.equal(c("湿地公園", { place_kind: "park", metadata_json: meta({ natural: "wetland" }) })!.primary, "nature");
  assert.equal(classifyPlace({ canonical_name: "ふれあい広場", place_kind: "park" })!.primary, "play");
});

test("boundary: 寺が運営する寺カフェは祈る・弔うでタグ、入居した別経営のカフェは食べる・飲む", () => {
  const templeCafe = c("龍潭寺 寺カフェ")!;
  assert.equal(templeCafe.primary, "pray");
  assert.deepEqual(templeCafe.tags, ["eat"]);
  const temple = c("龍潭寺", { metadata_json: meta({ amenity: "place_of_worship", cafe: "yes" }) })!;
  assert.equal(temple.primary, "pray");
  assert.deepEqual(temple.tags, ["eat"]);
  const tenant = c("カフェ ひだまり")!;
  assert.equal(tenant.primary, "eat");
  assert.deepEqual(tenant.tags, []);
  assert.equal(c("浜松八幡宮")!.primary, "pray");
  assert.equal(c("市営霊園")!.primary, "pray");
});

test("categories from the 中身の例 table", () => {
  const expected: Record<string, string> = {
    "ホテルクレスト": "stay", "民宿みどり": "stay", "ふじキャンプ場": "stay",
    "山田クリーニング": "service", "ミツワ車検": "service", "駅前不動産": "service", "結婚式場アルカディア": "service", "コワーキングスペースB": "service",
    "浜松市役所": "admin", "中央郵便局": "admin", "遠州信用金庫": "admin", "中央交番": "admin",
    "浜松駅": "transit", "市役所前バス停": "transit", "第一駐車場": "transit", "出光ガソリンスタンド": "transit",
    "ラーメン一番": "eat", "居酒屋まる": "eat", "ベーカリーMUGI": "eat",
    "ダイエースーパー": "buy", "朝市直売所": "buy",
    "天竜川": "nature", "遠州灘海岸": "nature",
    "動物園": "play", "映画館シネマ": "play",
  };
  for (const [name, primary] of Object.entries(expected)) assert.equal(c(name)?.primary, primary, name);
});

test("metadata tags decide when the name is silent; place_kind is the last resort", () => {
  assert.equal(c("A", { metadata_json: meta({ amenity: "cafe" }) })!.primary, "eat");
  assert.equal(c("B", { metadata_json: meta({ shop: "hairdresser" }) })!.primary, "care");
  assert.equal(c("C", { metadata_json: meta({ shop: "bakery" }, false) })!.primary, "buy");
  assert.equal(c("D", { metadata_json: meta({ natural: "peak" }) })!.primary, "nature");
  assert.equal(c("E", { metadata_json: JSON.stringify({ tags: ["amenity=hospital"] }) })!.primary, "medical");
  assert.equal(classifyPlace({ canonical_name: "F", place_kind: "nature_area" })!.primary, "nature");
  assert.equal(c("G", { metadata_json: meta({ shop: "yes", name: "x" }) })!.primary, "buy");
});

test("働く場所・インフラ・私有の生産地は入口に出さない（hidden）", () => {
  for (const n of ["山田工場", "中部事務所", "東倉庫", "西部浄水場", "天竜ダム", "浜松消防署"]) assert.equal(c(n)!.primary, HIDDEN_CATEGORY, n);
  assert.equal(c("X", { metadata_json: meta({ landuse: "farmland" }) })!.primary, HIDDEN_CATEGORY);
});

test("判定不能は null（分類待ち）、壊れた metadata_json でも落ちない", () => {
  assert.equal(c("不明な場所")!, null);
  assert.equal(c("", { metadata_json: "{not json" }), null);
  assert.equal(classifyPlace({}), null);
});

test("human は上書きしない", async (t) => {
  assert.equal(canOverwriteAssignment("human"), false);
  assert.equal(canOverwriteAssignment("ai"), false);
  assert.equal(canOverwriteAssignment("rule"), true);
  assert.equal(canOverwriteAssignment(null), true);
  const { db, sqlite } = migratedDb();
  t.after(() => sqlite.close());
  sqlite.exec(`INSERT INTO places (place_id,canonical_name,canonical_name_normalized,place_kind,public_profile_status,municipality) VALUES ('h1','市営霊園','市営霊園','other_named_area','published','浜松市')`);
  sqlite.exec(`INSERT INTO place_category_assignments (place_id,primary_category,status,source,decided_at) VALUES ('h1','nature','confirmed','human','2026-11-28T00:00:00Z')`);
  const r = await runPlaceCategoryBackfill({ PLACE_CATEGORY_BACKFILL: "on", OBS_DB: db as never });
  assert.equal(r.scanned, 0);
  assert.equal((sqlite.prepare(`SELECT primary_category p, source s FROM place_category_assignments WHERE place_id='h1'`).get() as { p: string; s: string }).p, "nature");
  sqlite.exec(`INSERT OR IGNORE INTO place_category_assignments (place_id,primary_category,status,source,decided_at) VALUES ('h1','pray','confirmed','rule','2026-11-28T00:00:00Z')`);
  assert.equal((sqlite.prepare(`SELECT source s FROM place_category_assignments WHERE place_id='h1'`).get() as { s: string }).s, "human");
});

const seedPlaces = (sqlite: ReturnType<typeof migratedDb>["sqlite"]) => {
  const rows: Array<[string, string, string, string?]> = [
    ["p1", "佐鳴湖公園", "park"], ["p2", "中央公園", "park"], ["p3", "龍潭寺 寺カフェ", "other_named_area"], ["p4", "カフェ ひだまり", "other_named_area"],
    ["p5", "みらい薬局", "other_named_area"], ["p6", "山田工場", "other_named_area"], ["p7", "名前だけの場所", "other_named_area"], ["p8", "天竜川", "nature_area"],
  ] as never;
  for (const [id, name, kind] of rows) {
    sqlite.prepare(`INSERT INTO places (place_id,canonical_name,canonical_name_normalized,place_kind,public_profile_status,municipality,prefecture) VALUES (?,?,?,?, 'published','浜松市','静岡県')`).run(id, name, name, kind);
  }
  sqlite.exec(`INSERT INTO places (place_id,canonical_name,canonical_name_normalized,place_kind,public_profile_status,municipality) VALUES ('px','他市の寺','他市の寺','other_named_area','published','磐田市')`);
};

test("backfill is off by default, then classifies unassigned published places in batches and never reprocesses", async (t) => {
  const { db, sqlite } = migratedDb();
  t.after(() => sqlite.close());
  seedPlaces(sqlite);
  const off = await runPlaceCategoryBackfill({ OBS_DB: db as never });
  assert.equal(off.scanned, 0);
  assert.equal((sqlite.prepare("SELECT COUNT(*) n FROM place_category_assignments").get() as { n: number }).n, 0);
  const r = await runPlaceCategoryBackfill({ PLACE_CATEGORY_BACKFILL: "on", OBS_DB: db as never });
  assert.equal(r.scanned, 9);
  assert.equal(r.hidden, 1);
  assert.equal(r.pending, 1);
  const again = await runPlaceCategoryBackfill({ PLACE_CATEGORY_BACKFILL: "on", OBS_DB: db as never });
  assert.equal(again.scanned, 0);
  const tags = JSON.parse(JSON.stringify(sqlite.prepare("SELECT place_id, tag FROM place_category_tags WHERE place_id='p3'").all()));
  assert.deepEqual(tags, [{ place_id: "p3", tag: "eat" }]);
});

test("region categories: counts include tag holders, hide zero entries, total = primaries + pending", async (t) => {
  const { db, sqlite } = migratedDb();
  t.after(() => sqlite.close());
  seedPlaces(sqlite);
  await runPlaceCategoryBackfill({ PLACE_CATEGORY_BACKFILL: "on", OBS_DB: db as never });
  const cats = await loadRegionCategories(db as never, "浜松市");
  assert.ok(cats);
  assert.equal(cats.total, 8);
  assert.equal(cats.primaryTotal, 6);
  assert.equal(cats.pending, 2);
  assert.equal(cats.total, cats.primaryTotal + cats.pending);
  const byId = Object.fromEntries(cats.entries.map((e) => [e.id, e.count]));
  assert.equal(byId.nature, 2);
  assert.equal(byId.play, 1);
  assert.equal(byId.pray, 1);
  assert.equal(byId.eat, 2);
  assert.equal(byId.medical, 1);
  assert.equal(byId.stay, undefined);
  assert.ok(cats.entries.every((e) => e.count > 0));
  sqlite.exec(`DELETE FROM place_category_assignments WHERE place_id='p1'`);
  const afterDelete = await loadRegionCategories(db as never, "浜松市");
  assert.equal(afterDelete!.pending, 3);
  assert.equal(afterDelete!.total, afterDelete!.primaryTotal + afterDelete!.pending);
  const html = renderRegionCategoryEntrances("ja", "/ja/regions/jp/shizuoka/hamamatsu", cats, 173);
  assert.match(html, /data-region-category-featured="1"/);
  assert.match(html, /目的から探す/);
  assert.match(html, /\/places\?cat=eat/);
  assert.doesNotMatch(html, /data-region-category="stay"/);
  assert.doesNotMatch(html, /分類待ち/);
  assert.equal(renderRegionCategoryEntrances("ja", "/x", { total: 3, primaryTotal: 0, pending: 3, entries: [] }), "");
});

test("region page: no entrances with the flag off; with it on only entrances with count>0; list page filters by category", async (t) => {
  const { db, sqlite } = migratedDb();
  t.after(() => sqlite.close());
  seedExt(sqlite);
  seedPlaces(sqlite);
  await runPlaceCategoryBackfill({ PLACE_CATEGORY_BACKFILL: "on", OBS_DB: db as never });
  const base = { ENVIRONMENT: "staging", CORE_DB: db, OBS_DB: db } as unknown as Env;
  const rollouts = (state: string) => JSON.stringify({ REGION_SURFACE_V1_ENABLED: { state: "all" }, PLACE_CATEGORIES_ENABLED: { state } });
  const get = (path: string, state: string) => worker.fetch(new Request(`https://zukan.earth${path}`), { ...base, ZUKAN_FEATURE_ROLLOUTS: rollouts(state) } as unknown as Env, undefined as never);
  const off = await get("/ja/regions/jp/shizuoka/hamamatsu", "off");
  assert.equal(off.status, 200);
  assert.doesNotMatch(await off.text(), /data-region-shelf="categories"/);
  const on = await get("/ja/regions/jp/shizuoka/hamamatsu", "all");
  assert.equal(on.status, 200);
  const html = await on.text();
  assert.match(html, /data-region-shelf="categories"/);
  assert.match(html, /data-region-category="nature"/);
  assert.match(html, /data-region-category="eat"/);
  assert.doesNotMatch(html, /data-region-category="stay"/);
  assert.doesNotMatch(html, /data-region-category="admin"/);
  const listOff = await get("/ja/regions/jp/shizuoka/hamamatsu/places?cat=eat", "off");
  assert.notEqual(listOff.status, 200);
  const list = await get("/ja/regions/jp/shizuoka/hamamatsu/places?cat=eat", "all");
  assert.equal(list.status, 200);
  const listHtml = await list.text();
  assert.match(listHtml, /data-region-place="p3"/);
  assert.match(listHtml, /data-region-place="p4"/);
  assert.doesNotMatch(listHtml, /data-region-place="p1"/);
  const bad = await get("/ja/regions/jp/shizuoka/hamamatsu/places?cat=zzz", "all");
  assert.equal(bad.status, 404);
});
