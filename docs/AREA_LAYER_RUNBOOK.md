# Area Layer Runbook — `/ja/map` 公的エリアサイドシート

`/ja/map` で公園・行政エリア(市町村・都道府県・国)をクリックして
**生物相 / 経年変遷 / 調査努力量** を読める機能。

実装は `platform_v2` のみ。PHP lane (`upload_package/`) は無関係。

---

## 1. 構成 (新ファイルだけ列挙)

### Migration

| Migration | 役割 |
|---|---|
| `db/migrations/0079_observation_fields_polygon_index.sql` | bbox 4列 + admin_level + 複合 BTREE |
| `db/migrations/0080_observation_fields_admin_layer.sql` | 既存 `source` 制約は維持し、`admin_level` で osm_park / admin_* を表す。parent_field_id + geom_simplified + **valid_from / valid_to / superseded_by / entity_key** (100年スパン版管理) |
| `db/migrations/0081_field_managers.sql` | `field_managers (owner / steward / viewer_exact)` で「特定権限者だけ希少種の正確値が見える」ゲート |
| `db/migrations/0082_visit_field_resolution.sql` | `visits.resolved_field_ids UUID[]` + GIN 索引 |

### Service / API

- `src/services/geoJsonBbox.ts` — Polygon/MultiPolygon の bbox 計算 (純関数)
- `src/services/areaPolygons.ts` — bbox プリフィルタ + 60s TTL キャッシュで GeoJSON 配信
- `src/services/sensitiveSpeciesMasking.ts` — `risk_status_versions` から CR/EN/VU/NT/EW/EX を 24h cache、`decidePublicCoord` で per-occurrence > risk_lane > 種レベル > exact の優先順
- `src/services/areaPlaceSnapshot.ts` — `composePlaceSnapshot` 流用 + 年別タイムライン + 5指標 effort + 希少種マスキング
- `src/services/fieldManagers.ts` — `field_managers` テーブルの薄い CRUD + role 解決
- `src/services/pointInPolygon.ts` — turf 不要の ray casting (Polygon / MultiPolygon / Feature 対応)
- `src/services/resolveFieldsForPoint.ts` — bbox プリフィルタ + ray casting で観察記録時に該当 field_id を返す
- `src/routes/mapApi.ts` — `GET /api/v1/map/area-polygons?bbox=…&zoom=…&sources=…`
- `src/routes/observationFieldsApi.ts` — `GET /api/v1/fields/:fieldId/area-snapshot`

### Importer / Backfill

- `src/scripts/backfillFieldPolygonBbox.ts` — 既存 polygon に bbox + admin_level を埋める
- `src/scripts/importN03Administrative.ts` — KSJ N03 GeoJSON → `source=user_defined`, `admin_level=admin_municipality/admin_prefecture`
- `src/scripts/importOsmLeisureParks.ts` — Overpass API → `source=user_defined`, `admin_level=osm_park`、`--sweep` で消滅した公園を `valid_to` で閉じる

### Frontend

- `src/ui/mapExplorer.ts` — `area-polygon-fill / outline / selected` 3レイヤー、moveend debounce 250ms、`openAreaSheet` + `renderAreaSheet` (年別棒グラフ + 努力量5枚 + 希少種バナー + 観察会CTA)、専用 CSS

---

## 2. デプロイ手順 (staging → production)

### 2.1 staging

```bash
# 1. migration 適用
cd /var/www/ikimon.life-staging/platform_v2
DATABASE_URL=$(grep DATABASE_URL /etc/ikimon/staging-v2.env | cut -d= -f2-) \
  npm run migrate

# 2. 既存 KSJ 由来 polygon (Phase 1 までに取り込んだ保護区/OECM/symbiosis/tsunag) の bbox 埋め
DATABASE_URL=… npx tsx src/scripts/backfillFieldPolygonBbox.ts

# 3. (任意) 行政界を取り込む
#    KSJ N03 (https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03.html) から
#    年度版 GeoJSON を手動 DL → /tmp/N03-2025.geojson に置く
DATABASE_URL=… npx tsx src/scripts/importN03Administrative.ts \
  --geojson /tmp/N03-2025.geojson \
  --publish-date 2025-04-01 \
  --include-country

# 4. (任意) OSM ローカル公園を取り込む
#    bbox は south,west,north,east (Overpass の流儀)
DATABASE_URL=… npx tsx src/scripts/importOsmLeisureParks.ts \
  --bbox 34.6,137.6,34.85,137.91 \
  --sweep   # 既存の osm_park でこの bbox にもう存在しないものは valid_to で閉じる

# 5. v2 サービス再起動
sudo systemctl restart ikimon-v2-staging.service

# 6. 動作確認
curl -fsS "https://staging.ikimon.life/api/v1/map/area-polygons?bbox=137.6,34.6,137.91,34.85&zoom=12" | jq '.features | length'
# > 0 以上が返れば OK
```

### 2.2 production

YAMAKI の **明示的 OK が必要**。`feedback_cutover_requires_explicit_approval.md` 参照。
staging で目視確認してから:

```bash
ssh -i ~/Downloads/ikimon.pem root@162.43.44.131
cd /var/www/ikimon.life/platform_v2
DATABASE_URL=… npm run migrate
DATABASE_URL=… npx tsx src/scripts/backfillFieldPolygonBbox.ts
sudo systemctl restart ikimon-v2.service
# (importer は staging で結果確認後、production でも再実行する)
```

---

## 3. 100年スパン運用 playbook

### 3.1 行政界が変わったとき (合併・分離)

KSJ N03 の年度更新版が出たら importer を再実行するだけ:

```bash
npx tsx src/scripts/importN03Administrative.ts \
  --geojson ./N03-2030.geojson --publish-date 2030-04-01 --include-country
```

importer は `entity_key=n03:<5桁コード>` で同じ実体を追跡し、
**現行版を `valid_to = 2030-03-31` で閉じ、新版を `valid_from = 2030-04-01` で挿入**、
旧版の `superseded_by` に新版 field_id を入れる。

過去の観察記録は当時の field_id にぶら下がったまま → 「平成大合併前の浜北市での観察」も
当時の境界で集計可能。現行マップは新版だけを表示 (`valid_to IS NULL` フィルタ)。

### 3.2 公園が工場になったとき (種別変更)

1. **OSM の更新を待つ**: `leisure=park` タグが消えれば次回 import で sweep が `valid_to` を立てる
2. **緊急対応**: 直接 SQL で閉じる
   ```sql
   UPDATE observation_fields
      SET valid_to = current_date, updated_at = NOW()
    WHERE entity_key = 'osm:way:1234567' AND valid_to IS NULL;
   ```
3. 新たに別指定 (例: `landuse=industrial`) になった場合、現状は import 対象外なので新版は作らない (= マップから消えるだけ)

過去の観察 (= まだ公園だった頃の記録) は旧版の field_id に紐付いたまま、area-snapshot で見える。
時系列タイムラインに「2030年以降の記録なし (公園廃止)」が自然に出る。

### 3.3 認定地の認定取り消し (自然共生サイト・OECM)

importObservationFields.ts (既存) 側に supersede 連携の口を入れる必要あり。
Phase 2 では importN03 / importOSM だけが版管理対応。
自然共生サイト / TSUNAG / 保護区については、認定取消が起きたら手動で:

```sql
UPDATE observation_fields
   SET valid_to = '2030-03-31'
 WHERE entity_key = 'cert:nss:0042' AND valid_to IS NULL;
```

(scrapeNatureSymbiosisSites.ts の supersede 連携は Phase 3 候補)

### 3.4 「特定権限者」(field_manager) の付与・剥奪

```sql
-- 付与
INSERT INTO field_managers (field_id, user_id, role, granted_by, expires_at, note)
VALUES ('<uuid>', 'user-123', 'steward', 'admin-yamaki', '2031-03-31', '研究プロジェクトA');

-- 剥奪
DELETE FROM field_managers WHERE field_id = '<uuid>' AND user_id = 'user-123';
```

`expires_at` を入れておけば自動失効する (`field_managers` 検索時に `expires_at IS NULL OR expires_at > NOW()` で絞っている)。

---

## 4. 動作確認チェックリスト

`/ja/map` で:

- [ ] 静岡県浜松市西伊場あたりにズームすると、公園ポリゴン (TSUNAG / 自然共生サイト / 保護区) が淡い色で表示される
- [ ] OSM importer 実行後は西伊場第1公園レベルもクリックできる
- [ ] ポリゴンクリック → サイドシートに「ヘッダ + 観察サマリ + 年別棒グラフ + 努力量5枚 + (希少種があれば) バナー + 観察会CTA」が表示される
- [ ] **個人記録CTA「ここを観察する」は無い** (ユーザー指示)
- [ ] 観察会CTA「この場所で観察会を開く」は `community/events/new?field_id=…` に遷移する
- [ ] 既存メッシュセル / frontier クリック / 一覧タブが壊れていない
- [ ] 希少種 (例: ヤマネ Glirulus japonicus) を含むエリアで:
  - anonymous viewer → "1km メッシュに丸めて表示" バナー
  - admin viewer → "正確座標が見える権限です" バナー
  - field_manager (steward 以上) viewer → 同上

---

## 5. 既知の限界 / 技術負債

- **PostGIS 未導入**: bbox プリフィルタ + Node 側 ray casting で十分速いが、OSM 全国全公園 (30万件超) を入れたら見直し
- **geom_simplified は importer が空 (= polygon と同じものを返却フォールバック)**: 大きい行政界の payload が重い。Phase 3 で簡略化バッチを追加
- **OSM relation の inner ring (穴) 未対応**: 全部独立 Polygon として扱っている。粗い近似
- **field_managers の付与 UI なし**: SQL 直叩き。Phase 3 で admin 用エンドポイント追加
- **scrapeNatureSymbiosisSites.ts の supersede 連携なし**: 認定取消は手動 UPDATE
- **国境ポリゴン**: 日本のみ対応。海外は Phase 3 で Natural Earth Admin0 検討
