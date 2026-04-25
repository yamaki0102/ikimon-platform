# ikimon v2 Zero-Base Cutover Master Plan

更新日: 2026-04-11  
この文書を、ikimon の **ゼロベース再構築と本番切替の正本** とする。  
既存の分散した戦略メモは参考資料であり、切替判断はこの文書を基準に行う。

---

## 1. 何を決める文書か

決めることは 4 つだけ。

1. いまの VPS 制約の中で、ikimon をゼロから作り直すなら何を採用するか
2. 移行直前までのユーザーデータ、写真、トラック、JSON をどう引き継ぐか
3. 切替失敗時に、どうやって最短で元に戻すか
4. そのために、いつ何を実装し、どこで Go / No-Go を切るか

---

## 2. 現状の事実

2026-04-11 時点で、ikimon の本番実体は次の通り。

### 2.1 サーバー

- Host: `ikimon-vps` (`162.43.44.131`)
- OS: Ubuntu 系
- CPU: 6 vCPU
- RAM: 11 GiB
- Disk: 約 387 GiB, 空き約 341 GiB
- Web: `nginx`
- PHP: `8.2`
- Node: `22`
- Python: `3.12`
- Process manager: `pm2`
- PostgreSQL: `16.13`
- 利用可能拡張: `postgis 3.6.2`, `timescaledb 2.25.2`

### 2.2 本番配置

- 現行 root: `/var/www/ikimon.life/repo/upload_package/public_html`
- 現行 data: `/var/www/ikimon.life/data`
- 現行 uploads: 主に `/var/www/ikimon.life/persistent/uploads`
- 現行 nginx site: `/etc/nginx/sites-enabled/ikimon.life`
- staging: `/var/www/ikimon.life-staging/...`

### 2.3 本番データの正本

本番の実質正本はまだ **JSON / ファイルストア** であり、SQLite canonical は本番正本ではない。

確認済み事実:

- `/var/www/ikimon.life/data/ikimon.db` は `0 byte`
- `ikimon_prod` という PostgreSQL DB は存在するが、public schema は PostGIS メタテーブルのみ
- 本番の観察データは主に `data/observations/*.json`
- 本番のユーザーは主に `data/users.json`
- 認証継続状態は `data/auth_tokens.json`
- 招待コードは `data/invites.json`
- 写真は主に `persistent/uploads/photos`
- アバターは `persistent/uploads/avatars`
- 音声は `persistent/uploads/audio`
- GPS トラックは `data/tracks/...`
- passive / environment はコード上存在するが、本番では大量運用されていない

### 2.4 観測した量の目安

2026-04-11 時点での観測値:

- `observations/*.json`: 14 ファイル, 合計 298 records
- `users.json`: 30 users
- `auth_tokens.json`: 62 tokens
- `persistent/uploads/photos`: 529 files, 約 713 MB
- `persistent/uploads/audio`: 79 files, 約 56 MB
- `persistent/uploads/avatars`: 4 files, 約 272 KB

この数字は今後増えるので、計画は件数固定でなく **増分同期前提** で作る。

---

## 3. 最終判断

### 3.1 採用

ikimon v2 は、**同一 VPS 上の parallel rebuild** とする。

- 現行 PHP サイトは即廃止しない
- ただし **新システムの中核にはしない**
- 新システムを横に立てる
- データを継続同期する
- 最終同期後に nginx の向き先を切り替える
- 切替後もしばらく dual-write を維持して rollback 可能にする

### 3.2 新アーキテクチャ

- Public / App Web: `Next.js`
- Core API: `TypeScript + Fastify`
- Worker: `Node worker`
- Heavy AI / batch only: `Python`
- Canonical DB: `PostgreSQL 16`
- Spatial: `PostGIS`
- Time-series heavy tables: `TimescaleDB`
- Reverse proxy / TLS: 既存 `nginx`
- Process manager: `pm2` または `systemd`

### 3.3 不採用

- PHP monolith を今後の中核に据え続ける
- SQLite を本番正本として延命する
- いきなり microservices に分割する
- 切替時に旧系を消す
- rollback を「snapshot があるから大丈夫」で済ませる

---

## 4. なぜこの判断か

この判断は 4 つの枝で最適。

### 4.1 データ継承

- JSON / uploads / tracks / auth tokens / invites を段階的に移せる
- `legacy_id` を保持し、既存 URL と observation ID を壊さない
- 直前同期まで設計できる

### 4.2 切替安全性

- 新旧を並行稼働できる
- 旧系の nginx / code / data を残せる
- 切替後も dual-write で rollback 可能

### 4.3 将来拡張

- Android / iOS は将来 API を叩けばよい
- Web と App が同じ canonical model を使える
- place / visit / evidence / condition を一貫して扱える

### 4.4 開発コスト

- 単一 VPS
- 単一 PostgreSQL
- 単一 API モノリス
- Kubernetes なし
- object storage サービス追加なし

つまり、**理想側に寄せつつ、運用複雑性を増やし過ぎない**。

---

## 5. 新システムの主語

新 ikimon の主語は `post` ではなく `visit`。

中心モデル:

- `users`
- `places`
- `place_boundaries`
- `visits`
- `visit_track_points`
- `occurrences`
- `evidence_assets`
- `identifications`
- `place_conditions`
- `programs`
- `memberships`
- `legacy_sync_ledger`
- `legacy_id_map`

重要方針:

- 既存 `user_id`, `observation_id`, `site_id` は **可能な限りそのまま使う**
- 既存の観察 1 件は v2 では `visit + occurrence + evidence` に分解して保持する
- `FieldScan session` は `visit` として first-class にする
- `place` を first-class にし、将来の地域観測・再訪・site dashboard の基盤にする

---

## 6. データ移行スコープ

移行対象は DB だけではない。`stateful data` を 4 層に分ける。

### 6.1 A: 絶対に引き継ぐ本体

- `data/users.json`
- `data/auth_tokens.json`
- `data/sessions/**` は archive する
- `data/invites.json`
- `data/observations.json`
- `data/observations/*.json`
- `data/events.json`
- `data/surveys/*.json`
- `data/sites/**`
- `data/regions/*.json`
- `data/likes/*.json`
- `data/follows/*.json`
- `data/notifications*.json`
- `data/streaks/**`
- `data/user_events/**`
- `data/tracks/**`
- `data/passive_sessions/**`
- `data/environment_logs/**` if present
- `persistent/uploads/photos/**`
- `persistent/uploads/avatars/**`
- `persistent/uploads/audio/**`
- `data/uploads/scan/**`

### 6.2 B: 引き継ぐが rebuild 可能

- analytics raw
- index cache
- search cache
- weather / geo cache
- recommendation cache
- embeddings snapshots

### 6.3 C: 参照用に archive だけ残す

- old debug outputs
- stress test append files
- temporary exports

### 6.4 D: 新システムでは再生成

- search index
- aggregate dashboards
- place summaries
- contribution summaries

---

## 7. 新保存戦略

### 7.1 DB

正本は PostgreSQL。

- relational truth: normal Postgres tables
- geospatial: PostGIS geometry / geography
- high-write time-series only: Timescale hypertable

Timescale を使う対象:

- `visits`
- `visit_track_points`
- `sensor_events` if retained
- `place_condition_observations` if write-heavy

### 7.2 ファイル

画像・音声・スキャンフレームは **ローカルファイルシステム** に置く。  
S3 や MinIO は今は採用しない。

理由:

- 単一 VPS に最適
- 開発コストが低い
- rollback が単純
- 将来 app でも signed URL / CDN で後付け可能

新配置:

- `/srv/ikimon-v2/storage/assets/original/...`
- `/srv/ikimon-v2/storage/assets/derived/...`

DB 側には `asset_ledger` を持つ。

保持するもの:

- `asset_id`
- `sha256`
- `mime_type`
- `bytes`
- `width`
- `height`
- `duration_ms`
- `storage_path`
- `legacy_relative_path`
- `source_observation_id`
- `created_at`

### 7.3 legacy compatibility

cutover 後の rollback window 中は、新規 asset を次の 2 箇所へ出す。

1. v2 canonical storage
2. legacy 互換パス

これにより、新システム公開後でも旧 PHP へ戻せる。

### 7.4 認証継続

最強プランでは、`ユーザーデータ` だけでなく `ログイン継続` も意識する。

方針:

- `users.json` と `auth_tokens.json` は canonical DB に import する
- v2 は legacy の `ikimon_remember` cookie を解釈できる互換レイヤーを持つ
- PHP session file そのものは canonical session へ変換しない
- ただし remember token と OAuth 連携情報を引き継ぐことで、多くのユーザーは再認証なしで継続できるようにする

明示:

- `data/sessions/**` は archive / forensic 用に保持する
- cutover 瞬間の一時 PHP session は引き継ぎ対象外とする
- それでも `remember token` と `OAuth account binding` は保持する

---

## 8. 新旧並行構成

### 8.1 Legacy lane

- `/var/www/ikimon.life/repo/upload_package/public_html`
- `/var/www/ikimon.life/data`
- `/var/www/ikimon.life/persistent/uploads`

役割:

- 本番稼働
- rollback fallback
- dual-write 受け口

### 8.2 v2 lane

- `/srv/ikimon-v2/web`
- `/srv/ikimon-v2/api`
- `/srv/ikimon-v2/worker`
- `/srv/ikimon-v2/storage`
- `/srv/ikimon-v2/import`

### 8.3 Staging v2

- `https://staging.162-43-44-131.sslip.io/` は現行 staging
- v2 は別 upstream で parallel に立てる
- 例: `127.0.0.1:3100` = Next.js, `127.0.0.1:3200` = API
- nginx 側で `staging-v2` site を分離

---

## 9. 移行方式

移行は **4 本のパイプ** に分ける。

### 9.1 Bootstrap import

旧 JSON / uploads / tracks から v2 PostgreSQL / asset ledger へ初回全量投入。

要件:

- 冪等
- 再実行可能
- `legacy_path`, `legacy_mtime`, `legacy_sha256` を保存
- 途中失敗時に resume 可能

### 9.2 Continuous delta sync

legacy 稼働中に、新規・更新・削除を v2 に反映する。

方式:

- file mtime + checksum + cursor
- observation ID / user ID 単位の upsert
- uploads は directory scan + checksum manifest

同期頻度:

- 平常時: 1 分ごと
- cutover 前 1 時間: 15 秒ごと

### 9.3 Verification pipeline

新旧差分を自動で検査する。

検査対象:

- users count
- observations count
- photo asset count
- observation -> photo path referential integrity
- auth token import count
- sample pages parity
- sample API parity

### 9.4 Compatibility dual-write

cutover 後一定期間、新システムの write を legacy 側にも流す。

対象:

- user updates
- observation create/update
- photo upload
- avatar upload
- track upload
- visit summary if old UI が読むもの

期間:

- 最低 7 日
- 理想は 14 日

重要:

- rollback safety window 中の **critical write は非同期で逃がさない**
- canonical DB への commit 後、legacy compatibility write まで成功して初めて成功応答を返す
- compatibility write が失敗した場合は request を失敗扱いにし、切替継続可否を即再評価する

理由:

- 今の本番負荷なら安全性優先の同期互換書き込みが成立する
- ここを非同期 outbox のみで済ませると、rollback 時に「v2 で受けたが legacy にない」書き込みが残る

---

## 10. ロールバック戦略

rollback を 2 段に分ける。

### 10.1 Fast rollback

目的: 数分以内にサービスを旧系へ戻す。

手順:

1. nginx upstream を legacy に戻す
2. v2 public route を閉じる
3. background dual-write queue を停止
4. health check を legacy で確認

条件:

- cutover 後も legacy compatibility dual-write が生きていること
- legacy data path が壊れていないこと

目標復旧時間:

- 5 分以内

### 10.2 Hard rollback

目的: data corruption や asset 不整合が出た場合でも復旧する。

復旧元:

- pre-cutover immutable snapshot
- latest legacy snapshot
- latest PostgreSQL dump
- latest asset manifest
- nginx config snapshot

条件:

- snapshot が cutover 直前に取得済み
- restore rehearsal が staging で一度成功していること

---

## 11. Snapshot / Backup ポリシー

### 11.1 必須 snapshot

#### S-30d

- 直近月次 snapshot

#### S-24h

- cutover 前日 snapshot

#### S-15m

- cutover 15 分前 snapshot

#### S-final

- write drain 後、最終 delta sync 直前 snapshot

### 11.2 Snapshot 対象

- `/var/www/ikimon.life/repo`
- `/var/www/ikimon.life/data`
- `/var/www/ikimon.life/persistent/uploads`
- `/etc/nginx/sites-available/ikimon.life`
- `/etc/nginx/sites-enabled/ikimon.life`
- `ikimon_prod` PostgreSQL dump
- system service definitions

### 11.3 保管ルール

- snapshot は世代保持
- local disk + 別保管先の二重化
- snapshot manifest に SHA256 を残す

---

## 12. 実装フェーズ

### Phase 0: Freeze interfaces

目的:

- 旧系の write surface を確定する

やること:

- legacy write endpoints 一覧を固定
- asset path の全パターンを固定
- auth / session / invite state を固定

完了条件:

- migration inventory が揃う
- 「何を同期すべきか」で曖昧なものが残っていない

### Phase 1: Build canonical v2 core

目的:

- v2 DB schema と import ledger を作る

やること:

- PostgreSQL schema 作成
- PostGIS / Timescale 初期化
- `legacy_id_map`, `migration_ledger`, `asset_ledger` 作成
- import CLI 基盤作成

完了条件:

- 空 DB を何度でも作り直せる
- migration script が idempotent

### Phase 2: Full bootstrap import on staging

目的:

- production snapshot を使って v2 を staging で再現する

やること:

- users import
- observations import
- uploads import
- tracks import
- auth token import
- place / visit / occurrence split

完了条件:

- counts parity
- asset parity
- sample observation rendering parity

### Phase 3: Continuous sync on staging

目的:

- incremental sync と再実行性を固める

やること:

- cursor-driven delta sync
- changed file detection
- delete / tombstone handling
- verifier dashboard

完了条件:

- 同じ投入を何度回しても壊れない
- drift report が見える

### Phase 4: Build v2 product surface

目的:

- 新 UI を staging で production-like に動かす

やること:

- auth gateway
- home / record / discover / my places / community
- visit / place pages
- photo upload / track upload

完了条件:

- staging で主要導線が end-to-end で通る

### Phase 5: Production shadow sync

目的:

- 本番 legacy を主系のまま、v2 へ継続同期する

やること:

- production read-only mirror import
- drift checks
- cutover rehearsal

完了条件:

- production delta sync が安定
- 重大 drift なし

### Phase 6: Cutover

目的:

- 本番公開先を v2 へ切り替える

やること:

1. short write drain
2. S-final snapshot
3. final delta sync
4. verifier pass
5. nginx switch
6. smoke test
7. dual-write on

完了条件:

- public traffic が v2 に乗る
- major errors なし

### Phase 7: Rollback-safe stabilization

目的:

- すぐ戻せる状態のまま安定化する

やること:

- dual-write 維持
- error budget monitoring
- rollback drill

完了条件:

- 7-14 日重大事故なし
- legacy compatibility write を止めてもよいと判断できる

---

## 13. Go / No-Go Gate

Go 条件は 1 つでも欠けたら満たさない。

### Gate A: Data parity

- users parity 100%
- observations parity 100%
- auth token parity 100%
- invites parity 100%
- photo file count parity 100%
- photo SHA256 parity 100%

### Gate B: Referential integrity

- observation -> user 解決率 100%
- observation -> asset 解決率 100%
- track -> visit 解決率 100%
- site / place mapping の孤児なし

### Gate C: Functional parity

- login
- logout
- observation create
- photo upload
- observation detail
- explore
- profile

### Gate D: Rollback readiness

- fast rollback rehearsal 済み
- latest snapshot 取得済み
- nginx rollback script 用意済み
- dual-write compatibility が動いている

---

## 14. 切替当日の手順

### T-24h

- S-24h snapshot
- staging final rehearsal
- freeze notice

### T-15m

- S-15m snapshot
- sync cadence を 15 秒に上げる

### T-2m

- write drain
- queue flush

### T-0

1. S-final snapshot
2. final delta sync
3. verifier run
4. nginx switch
5. smoke test
6. dual-write enable

### T+5m

- login
- post
- photo upload
- detail page
- API health

### T+30m

- error rate
- queue lag
- asset write failures
- DB locks

---

## 15. どこまで legacy を残すか

残す。

ただし役割は限定する。

- cutover 前: 本番主系
- cutover 直後: rollback fallback + compatibility sink
- 安定化後: archive + emergency fallback

legacy を今すぐ削除する案は採らない。  
これは sunk cost 配慮ではなく、**rollback capability のため**。

---

## 16. 直ちにやるべき実装順

1. `migration inventory` をコード起点で確定する
2. PostgreSQL schema を v2 用に作る
3. bootstrap importer を作る
4. asset importer を作る
5. delta sync daemon を作る
6. verifier を作る
7. v2 staging web/api を立てる
8. production shadow sync を動かす
9. cutover rehearsal
10. production cutover

---

## 17. 採用条件 / 不採用条件 / 計測指標

### 採用条件

- 既存 user / observation / asset ID を維持できる
- final sync 後の切替で停止時間を数分以内に抑えられる
- cutover 後も dual-write で rollback できる
- Android / iOS を将来追加しても API / canonical model を変えずに済む

### 不採用条件

- 旧データを一括 dump/import して終わりにする
- uploads の checksum 検証なしで切る
- cutover 後に rollback すると新規投稿が消える
- JSON と PostgreSQL のどちらが正本か曖昧なまま進める

### 計測指標

- data parity rate
- asset checksum parity rate
- cutover downtime
- rollback time
- dual-write failure rate
- post-cutover error rate
- drift backlog count

---

## 18. この計画の要点

この計画の本質は 3 行で足りる。

1. **新 ikimon を横に作る**
2. **旧 ikimon のデータを継続同期し、切替直前まで追う**
3. **切替後もしばらく dual-write して、いつでも戻せる状態を保つ**

これが、`ユーザーデータを最後まで引き継ぐ` と `最悪戻せる` を両立する最強プラン。
