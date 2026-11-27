import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  AREA_BACKFILL_ACTIVE_LIST_VERSION_SQL,
  buildAreaBackfillSensitiveTaxaSql,
  buildAreaBackfillSql,
  buildAreaPreviewCsv,
  cellLocalityFromNominatim,
  decideAreaLabel,
  localityFromAddress,
  parsePublicCellCenter,
  summarizeAreaDecisions,
  type AreaBackfillRow,
  type CellLocality,
  type SensitiveTier,
} from "./areaLabelBackfill";

const row = (over: Partial<AreaBackfillRow> = {}): AreaBackfillRow => ({
  observation_id: "obs-1", public_cell: "26.64,127.97", visibility: "public", emergency_hidden: 0,
  taxon_label: "ヒヨドリ", names: null, obs_label: null, rm_exists: 1, rm_label: null,
  risk_lane: null, audience_scope: null, public_precision: null, withdrawn: 0, ...over,
});
const jp = (prefecture: string, municipality: string): CellLocality => ({ prefecture, municipality, countryCode: "jp" });
const cells = (entries: Record<string, CellLocality | null>) => new Map(Object.entries(entries));
const none = new Map<string, SensitiveTier>();

test("fixture: 公開セルの中心座標から市区町村ラベルを作る（新規投稿と同じ規則）", () => {
  const d = decideAreaLabel(row(), cells({ "26.64,127.97": jp("沖縄県", "名護市") }), none);
  assert.equal(d.action, "fill");
  assert.equal(d.label, "名護市");
  assert.equal(d.fillObservation, true);
  assert.equal(d.fillReadmodel, true);
});

test("浜松の区は市+区、村は県に粗くする", () => {
  const address = { state: "静岡県", city: "浜松市", city_district: "中央区", country_code: "jp" };
  const loc = cellLocalityFromNominatim({ address })!;
  assert.deepEqual(localityFromAddress(address), { prefecture: "静岡県", municipality: "浜松市中央区" });
  assert.equal(decideAreaLabel(row({ public_cell: "34.70,137.73" }), cells({ "34.70,137.73": loc }), none).label, "浜松市中央区");
  assert.equal(decideAreaLabel(row(), cells({ "26.64,127.97": jp("沖縄県", "恩納村") }), none).label, "沖縄県");
});

test("東京など state が無い応答は ISO コードから県名を補う", () => {
  const loc = cellLocalityFromNominatim({ address: { city: "千代田区", "ISO3166-2-lvl4": "JP-13", country_code: "jp" } })!;
  assert.equal(loc.prefecture, "東京都");
  assert.equal(loc.municipality, "千代田区");
  assert.equal(decideAreaLabel(row({ taxon_label: "ヤンバルクイナ" }), cells({ "26.64,127.97": loc }), new Map<string, SensitiveTier>([["ヤンバルクイナ", "coarse"]])).label, "東京都");
});

test("既存ラベルは上書きしない", () => {
  const d = decideAreaLabel(row({ obs_label: "東京都千代田区", rm_label: "東京都千代田区" }), cells({ "26.64,127.97": jp("沖縄県", "名護市") }), none);
  assert.equal(d.action, "skip");
  assert.equal(d.reason, "already_labeled");
  assert.equal(buildAreaBackfillSql([d]).statementCount, 0);
});

test("観察側にあって読み取りモデルが空なら読み取りモデルだけ同期する", () => {
  const d = decideAreaLabel(row({ obs_label: "那覇市" }), cells({}), none);
  assert.equal(d.action, "sync_readmodel");
  const sql = buildAreaBackfillSql([d]).updates;
  assert.match(sql, /UPDATE readmodel_public_observations/u);
  assert.doesNotMatch(sql, /UPDATE observations/u);
});

test("非公開・緊急非表示・撤回・安全ゲート・セル不明・海外は埋めない", () => {
  const map = cells({ "26.64,127.97": jp("沖縄県", "名護市"), "33.81,-117.92": { prefecture: "California", municipality: "Anaheim", countryCode: "us" } });
  assert.equal(decideAreaLabel(row({ visibility: "private" }), map, none).reason, "not_public");
  assert.equal(decideAreaLabel(row({ emergency_hidden: 1 }), map, none).reason, "emergency_hidden");
  assert.equal(decideAreaLabel(row({ withdrawn: 1 }), map, none).reason, "withdrawn");
  assert.match(decideAreaLabel(row({ risk_lane: "sensitive" }), map, none).reason, /^safety_blocked:risk_lane/u);
  assert.match(decideAreaLabel(row({ audience_scope: "private" }), map, none).reason, /^safety_blocked/u);
  assert.match(decideAreaLabel(row({ public_precision: "exact_private" }), map, none).reason, /^safety_blocked/u);
  assert.equal(decideAreaLabel(row({ public_cell: "unknown" }), map, none).reason, "no_public_cell");
  assert.equal(decideAreaLabel(row({ public_cell: "hidden" }), map, none).reason, "no_public_cell");
  assert.equal(decideAreaLabel(row({ public_cell: "33.81,-117.92" }), map, none).reason, "non_japan");
  assert.equal(decideAreaLabel(row({ public_cell: "35.00,135.00" }), map, none).reason, "cell_unresolved");
});

test("保護対象種: coarse は県だけ、withhold は何も入れない", () => {
  const map = cells({ "26.64,127.97": jp("沖縄県", "名護市") });
  const tiers = new Map<string, SensitiveTier>([["ヤンバルクイナ", "coarse"], ["ナゾノ種", "withhold"]]);
  const coarse = decideAreaLabel(row({ taxon_label: "ヤンバルクイナ" }), map, tiers);
  assert.equal(coarse.label, "沖縄県");
  assert.equal(coarse.reason, "filled_coarse_sensitive");
  const viaIdentification = decideAreaLabel(row({ taxon_label: "同定待ち", names: "ヤンバルクイナ" }), map, tiers);
  assert.equal(viaIdentification.label, "沖縄県");
  const withhold = decideAreaLabel(row({ taxon_label: "ナゾノ種" }), map, tiers);
  assert.equal(withhold.action, "skip");
  assert.equal(withhold.reason, "sensitive_withhold");
});

test("住所らしい・学校等を含む文字列はラベルにしない", () => {
  const d = decideAreaLabel(row(), cells({ "26.64,127.97": jp("沖縄県", "名護市1丁目") }), none);
  assert.equal(d.action, "fill");
  assert.equal(d.label, "沖縄県");
  const bad = decideAreaLabel(row(), cells({ "26.64,127.97": jp("沖縄県", "第一小学校区") }), none);
  assert.equal(bad.label, "沖縄県");
});

test("公開セルの座標は小数2桁（公開精度）以外は受け付けない", () => {
  assert.deepEqual(parsePublicCellCenter("26.64,127.97"), { lat: 26.64, lng: 127.97, key: "26.64,127.97" });
  assert.equal(parsePublicCellCenter("26.6412345,127.9712345"), null);
  assert.equal(parsePublicCellCenter(null), null);
});

test("SQLは空ラベルのみ更新・冪等ガード付き・元に戻すSQLが対応する", () => {
  const d = decideAreaLabel(row({ observation_id: "o'1" }), cells({ "26.64,127.97": jp("沖縄県", "名護市") }), none);
  const { updates, rollback, statementCount } = buildAreaBackfillSql([d]);
  assert.equal(statementCount, 2);
  for (const line of updates.trim().split("\n")) assert.match(line, /public_area_label IS NULL OR TRIM\(public_area_label\) = ''/u);
  assert.match(updates, /observation_id = 'o''1'/u);
  assert.match(updates, /visibility = 'public' AND emergency_hidden = 0/u);
  assert.match(rollback, /public_area_label = NULL WHERE observation_id = 'o''1' AND public_area_label = '名護市'/u);
});

test("プレビューCSVと集計", () => {
  const map = cells({ "26.64,127.97": jp("沖縄県", "名護市") });
  const ds = [decideAreaLabel(row(), map, none), decideAreaLabel(row({ observation_id: "p", visibility: "private" }), map, none)];
  assert.match(buildAreaPreviewCsv(ds), /^observation_id,public_lat,public_lng,action,reason,sensitive_tier,new_label\nobs-1,26\.64,127\.97,fill,filled,none,名護市\n/u);
  const s = summarizeAreaDecisions(ds);
  assert.equal(s.filled, 1);
  assert.equal(s.skipped, 1);
  assert.equal(s.byPrefecture["沖縄県"], 1);
});

test("希少種リスト取得SQLが gbif_sensitive_list_versions と gbif_sensitive_taxa の実列だけで動く", (t) => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE gbif_sensitive_list_versions (list_version TEXT PRIMARY KEY, status TEXT NOT NULL);
    CREATE TABLE gbif_sensitive_taxa (list_version TEXT NOT NULL, name_key TEXT NOT NULL, tier TEXT NOT NULL);
    INSERT INTO gbif_sensitive_list_versions (list_version, status) VALUES ('v1', 'active');
    INSERT INTO gbif_sensitive_taxa (list_version, name_key, tier) VALUES ('v1', 'yanbarukuina', 'coarse');
  `);
  const ver = db.prepare(AREA_BACKFILL_ACTIVE_LIST_VERSION_SQL).get() as { list_version: string } | undefined;
  assert.equal(ver?.list_version, "v1");
  const taxa = db.prepare(buildAreaBackfillSensitiveTaxaSql(ver!.list_version)).all() as Array<{ name_key: string; tier: string }>;
  assert.deepEqual(taxa.map((r) => ({ name_key: r.name_key, tier: r.tier })), [{ name_key: "yanbarukuina", tier: "coarse" }]);
});
