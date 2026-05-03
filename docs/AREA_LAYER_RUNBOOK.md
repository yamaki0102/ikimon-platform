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

---

## 6. Phase 3 backlog (ユーザー要望、実装待ち)

### 6.1 Sentinel/JAXA/MLIT 取り込みを定期 worker 化

現状 `placeEnvironmentSignals.ts` (siteBrief レーン) は座標毎に Overpass を即時叩く同期型。
広域の「衛星から見えた変化 (緑地が減った / 水域が変化した)」を `site_environment_snapshots`
(migration 0077) に蓄える定期 worker を Phase 3 で実装する。

- ソース: Sentinel-2 L2A (ESA Copernicus, NDVI/NDWI)、JAXA ALOS-2 PALSAR、JAXA GSMaP、
  MLIT 国土数値情報の更新差分
- 周期: Sentinel-2 は 5日ごとの再訪、worker は 1日 1回 (前夜分を翌朝バッチ)
- 投入先: `site_environment_snapshots` の `change_hint` (stable / greening / browning /
  water_change / bare_ground_change) + `vegetation_index` / `water_index`
- area-snapshot の `environmentChange` フィールドに集約して可視化 (Phase 3 で実装予定)

### 6.2 定点ページを「同じ場所の時系列比較」中心に再設計

現状 `fixedPointStation.ts` は単一スナップショット表示。Phase 3 で「写真・動画・管理行為・
衛星変化」を 1 画面で時系列比較できる UI に再構成する。

- 写真/動画スワイプ (左右で年を跨ぐ)
- 管理行為 (`stewardship_actions`) と観察結果の前後比較 (`stewardshipImpact` を強化)
- 衛星変化 (上記 6.1 から) を年次レイヤとして重ね描画
- 種構成 sankey (年→年への種の出入り)

UX 検証は staging で先行公開、研究者協力者からのフィードバックを取った上で本番反映の流れ。

### 6.3 KSJ N03 全国 GeoJSON のストリーミング取り込み

`importN03Administrative.ts` は `JSON.parse(readFile(...))` で全件メモリに載せる実装。
KSJ N03 2025 の `N03-20250101.geojson` は 531MB あり、Node `--max-old-space-size=4096`
を渡しても V8 OOM。Phase 3 で stream-json 依存を入れて FeatureCollection を 1 feature
ずつ流す改修を入れる。

```bash
# 1. 依存追加
cd platform_v2
npm install --save stream-json

# 2. importer に streaming モード追加
# src/scripts/importN03Administrative.ts に以下を追加:
import StreamArray from "stream-json/streamers/StreamArray.js";
import { parser } from "stream-json";
// readFile / JSON.parse の代わりに createReadStream + pipe(parser()) + StreamArray.withParser()
# featureGenerator() で 1 件ずつ buildJobsForFeature → applyJob を呼ぶ。
# transaction は 1000件ごとに commit (long-running tx を避ける)。

# 3. 取り込み手順 (production VPS)
ssh -i ~/Downloads/ikimon.pem root@162.43.44.131
cd /tmp
curl -sSLO "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_GML.zip"
unzip N03-20250101_GML.zip
cd /var/www/ikimon.life/repo/platform_v2
DATABASE_URL=… node --max-old-space-size=2048 \
  ./node_modules/.bin/tsx src/scripts/importN03Administrative.ts \
  --geojson /tmp/N03-20250101.geojson \
  --publish-date 2025-01-01 \
  --include-country \
  --batch-size 1000

# 4. データ規模 (見積もり)
# 約 1900 市町村 × 平均 5KB = 10MB (polygon を含めて)
# admin_municipality だけで 1900 行追加、area-polygons API のキャッシュは
# 60s TTL で問題ない範囲
```

prefecture 境界は別 GeoJSON (`N03-20250101_prefecture.geojson` 376MB) で、importer に
`--prefecture-mode` を加えて N03_001 をキーに取り込む。47件のみなので軽い。

### 6.4b Overpass mirror rotation (= 着地済み)

`importOsmLeisureParks.ts` は overpass-api.de → overpass.kumi.systems →
overpass.openstreetmap.ru → overpass.private.coffee を順に試し、失敗ごとに
2s × 試行回数の backoff。`--source-url` で primary を上書きでき、それ以外の
ミラーは fallback として残る。これで rate-limit に当たった都市 (大阪・名古屋・
仙台・京都 etc) は自動で別ミラーに流れて recovery する。

### 6.4 Overpass rate limit 対応 (OSM 公園 全国網羅)

現状 `importOsmLeisureParks.ts` を 8 都市 bbox で順次走らせると、4都市は
HTTP 429 / 504 で失敗する (overpass-api.de の rate policy)。

Phase 3 改修案:
- `--source-url` に kumi.systems / overpass.kumi.systems の代替ミラーを切替できるよう
  にし、ミラーをローテーション
- 失敗時に exponential backoff (10s, 30s, 60s) で 3 回再試行
- 都市 bbox を 47 都道府県全件にする per-prefecture mode を追加
- 取り込み済み bbox を `osm_import_runs` テーブルに記録して再実行時に skip

### 6.6 Phase 3-1 骨組み (= 着地済み、運用は手動オプトイン)

`platform_v2/src/services/sentinelStatistics.ts` + `environmentSnapshotWriter.ts`
+ `scripts/runSentinelEnvironmentWorker.ts` で Microsoft Planetary Computer の
Sentinel-2 L2A STAC を叩く骨組みを実装済み。

#### 動作モード
- **既定 (worker 未登録)**: 何もしない。production の挙動には影響なし。
- **MPC_DISABLED=1**: 明示的に no-op。CI / dev 環境用。
- **手動 1 回実行**:
  ```bash
  ssh -i ~/Downloads/ikimon.pem root@162.43.44.131
  cd /var/www/ikimon.life/runtime/blue
  DATABASE_URL=… node ./node_modules/.bin/tsx \
    src/scripts/runSentinelEnvironmentWorker.ts --dry-run --limit 5
  ```
  問題なければ `--dry-run` を外して `--limit 50` 程度から本番稼働開始。
- **systemd timer 化**: `platform_v2/ops/deploy/ikimon_v2_sentinel.service` +
  `.timer` を `/etc/systemd/system/` に install して
  `systemctl enable --now ikimon-v2-sentinel.timer`。
  03:30 JST に nightly 実行 (RandomizedDelaySec=15min)。

#### 現状の制限
- metric_value はまだ 0 で書く (raster reduce 未実装)。Phase 3-1b で B04/B08
  の bytes を MPC SAS Token 経由で fetch して NDVI を計算、UPDATE で埋める。
- source_snapshots には STAC item の self link だけ記録 (storage_path は
  inline://stac/... の placeholder)。実 raster を保存する場合は `storage_backend`
  を `s3` に切替えて Cloudflare R2 / AWS S3 に格納する。

### 6.6b Phase 3-1b (= 着地済み、worker 起動で実 NDVI が入る)

`sentinelStatistics.ts` が MPC の Statistics API を叩いて NDVI/NDWI mean+max
を返すようになった。worker は scene 取得後、その itemId と bbox を渡して
server-side reduce を 1 リクエストで取得 (raster bytes は流れない)。

worker 1 件あたりのレイテンシ目安: 500ms〜1.5s。500 places を nightly で
処理する場合 ~10 分。timer の TimeoutStartSec=2h で十分余裕がある。

NDVI が null で返るケース (= cloud 100%、polar night など) は ndvi_mean=0 の
"pending_stats: true" placeholder を書いて lineage だけ残す。後続再実行で
別シーンが取れれば valid_to chain が自然に伸びる。

### 6.7 Phase 3-2 (= 着地済み、表示は本番反映後すぐ有効)

`fixedPointStation.ts` のレスポンスに以下が追加された:
- `environmentSnapshots[]`: place_environment_snapshots を読んで versioned で返す
- `yearlyTimeline[]`: visits / stewardship / env を年バケットに集約

UI (`ui/fixedPointStation.ts`) は hero 直下に「同じ場所の年比較」セクションを
追加し、年ごとに観察数 / 種数 / 管理行為 / 写真+動画 / 衛星指標 (NDVI 等) を
1 枚のカードに集約。横スクロールで「去年・5年前と比べる」が即できる UX。

Phase 3-1 worker が走るまで `environmentDigest` は空、UI は「衛星指標はまだ
この年に届いていません」と表示するフォールバックあり。

### 6.3b N03 streaming import (= 着地済み)

`importN03Administrative.ts --stream --batch-size 500` で stream-json 経由の
ファイル別 feature 走査が動く。`--max-old-space-size=2048` 程度で 531MB の
N03-20250101.geojson が完走する想定。500 件ごとに transaction を区切るので
1 回の rollback で失う行数は最大 500。

### 6.5b area-polygon cache invalidation (= 着地済み)

POST `/api/v1/internal/flush-area-cache` (X-V2-Privileged-Write-Api-Key 認証)
で in-memory キャッシュを即時クリア。OSM / N03 importer は完走時に blue/green/
staging の 3 ports に対して best-effort flush を投げるので、import 直後に
systemctl restart しなくても新ポリゴンが反映される。

### 6.5 area-polygons in-memory キャッシュの invalidation hook

`areaPolygons.ts` は 60s TTL の Map ベースキャッシュ。importer 直後に古い空キャッシュ
が残る問題を毎回 systemctl restart で対処している。Phase 3 で:

```ts
// areaPolygons.ts に
export function flushAreaPolygonCache(): void { cache.clear(); }
```

を export し、importer (`importOsmLeisureParks.ts` / `importN03Administrative.ts`) の
最後で `await fetch('http://127.0.0.1:3201/api/v1/internal/flush-area-cache', { method:'POST', headers:{'X-V2-Privileged-Write-Api-Key': key }})` を呼んで blue/green
両方をクリアする。
