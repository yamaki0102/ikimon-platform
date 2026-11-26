import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import { pickFieldCardRecords, renderFieldCardPage, type FieldCardRecord } from "./fieldCard";

const ROWS = [
  { observation_id: "o1", taxon_label: "ナミアゲハ", observed_at: "2026-06-10T03:00:00Z", asset_id: "a1" },
  { observation_id: "o2", taxon_label: "不明", observed_at: "2026-07-20T03:00:00Z", asset_id: "a2" },
  { observation_id: "o3", taxon_label: "ヤマボウシ", observed_at: "2026-05-02T03:00:00Z", asset_id: "a3" },
  { observation_id: "o4", taxon_label: "ツバメ", observed_at: "2026-04-02T03:00:00Z", asset_id: "a4" },
  { observation_id: "o5", taxon_label: "ナミアゲハ", observed_at: "2026-03-02T03:00:00Z", asset_id: "a1" },
];

const makeDb = (rows: unknown[]) => ({
  prepare(sql: string) {
    return {
      bind() {
        return {
          async first() {
            return { place_id: "place_sanaru", canonical_name: "佐鳴湖公園", public_profile_status: "published" };
          },
          async all() {
            assert.ok(/public_precision = 'place'/.test(sql) && /visibility = 'public'/.test(sql));
            return { results: rows };
          },
        };
      },
    };
  },
});

const get = (flagOn: boolean, rows: unknown[], path = "/ja/places/place_sanaru/card") =>
  worker.fetch(new Request(`https://shadow.test${path}`), { OBS_DB: makeDb(rows), ...(flagOn ? { FIELD_CARD_ENABLED: "true" } : {}) } as any);

test("flag off: card route behaves like an unknown sub-route (404)", async () => {
  const res = await get(false, ROWS);
  assert.equal(res.status, 404);
  assert.ok(!(await res.text()).includes("出発前カード"));
});

test("flag on: 3 distinct-photo cards, weak name shows placeholder, names come from input, no coordinates, safety block", async () => {
  const res = await get(true, ROWS);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.equal((html.match(/data-fc-card/g) ?? []).length, 3);
  assert.match(html, /<h1>出発前カード<\/h1>/);
  assert.ok(html.includes("佐鳴湖公園で見つかった生きもの"));
  const names = [...html.matchAll(/<h2 class="fc-name">([^<]*)<\/h2>/g)].map((m) => m[1]);
  const inputNames = ROWS.map((r) => r.taxon_label);
  for (const n of names) assert.ok(n === "名前はこれから" || inputNames.includes(n ?? ""), n);
  assert.deepEqual(names, ["ナミアゲハ", "ヤマボウシ", "ツバメ"]);
  assert.ok(!/exact_lat|exact_lng|latitude|longitude|coordinate|lat=|lng=/i.test(html));
  assert.ok(html.includes("6月の記録"));
  for (const t of ["やくそく", "生きものは見るだけ。持ち帰らない", "さわる前に、おとなに聞く", "水辺や道路では、おとなと一緒に", "ZUKANの公開記録から作りました", "どんな色やもようが見える？", "気づいたところを指さしてもらおう", "こどもに", "おとなから", "data-fc-print"]) {
    assert.ok(html.includes(t), t);
  }
  assert.ok(html.includes('href="/ja/places/place_sanaru"'));
});

test("weak-only records show 名前はこれから and fewer than 3 shows what exists", async () => {
  const html = await (await get(true, [ROWS[1]])).text();
  assert.equal((html.match(/data-fc-card/g) ?? []).length, 1);
  assert.ok(html.includes("名前はこれから"));
});

test("0 records: empty state with record link", async () => {
  const html = await (await get(true, [])).text();
  assert.ok(html.includes("この場所の写真の記録がまだありません"));
  assert.ok(html.includes('href="/ja/record?placeId=place_sanaru"'));
  assert.equal((html.match(/data-fc-card/g) ?? []).length, 0);
});

test("non-ja card route is 404 even when flag is on", async () => {
  assert.equal((await get(true, ROWS, "/en/places/place_sanaru/card")).status, 404);
});

test("taxon group selects fixed question and prompt copy", () => {
  const rec = (group: FieldCardRecord["group"], i: number): FieldCardRecord => ({ observationId: `o${i}`, name: "ナミアゲハ", observedAt: "2026-06-10T03:00:00Z", assetId: `a${i}`, group });
  const html = renderFieldCardPage({ placeId: "p", placeName: "場所", authenticated: false, records: pickFieldCardRecords([rec("insect", 1), rec("plant", 2), rec("bird", 3)]) });
  for (const t of ["足は何本見える？もようはある？", "見つけたら、足やもようを指さしてもらおう", "葉っぱはどんな形？ふちはギザギザ？", "同じ形の葉っぱを探してもらおう", "くちばしは長い？短い？どんな色？", "鳴き声が聞こえたら、まねしてもらおう"]) {
    assert.ok(html.includes(t), t);
  }
});
