# Incident Report — INC_2026-04-23_v2_cutover_rollback

## Summary

2026-04-23 20:59:16 JST に実施した本番 `ikimon.life` v2 カットオーバー後、
**本番 v2 DB (`ikimon_v2`) に legacy PHP のユーザーデータが bootstrap import されていない**
状態だったため、ログインユーザーが自分の記録・プロフィールを見られない事象が発生。
21:14:54 JST に nginx を pre-cutover に戻して復旧。所要 15 分、データ損失ゼロ。

## Severity

- **Sev**: S2（公開 UI 劣化、データ損失なし、MTTR 15 分）
- **User impact**: ログインユーザーが自分の記録を一時的に表示できない
- **Data impact**: なし（compatibilityWriter が期間中も legacy 側に書き込み）

## Timeline (JST)

| time | event |
|---|---|
| 20:58:24 | 事前バックアップ: `pg_dump ikimon_v2` 5.8MB + uploads rsync 762MB |
| 20:58:45 | nginx 新設定書込（v2 proxy primary + legacy fallback + edge block） |
| 20:58:50 | `nginx -t` syntax OK |
| **20:59:16** | **`systemctl reload nginx` — 本番 DNS が v2 へ** |
| 20:59:18 | 外部 smoke 16 endpoint 全 200 (認証必要 `/record` のみ 401) |
| 21:03 | `npm run build` + `pm2 restart` で audioArchiveReady=true 反映 |
| 21:05 | pm2 `--update-env` で DATABASE_URL が staging に regression → pm2 dump から復元 → 本番 DB 再接続 |
| 21:05 | `/ops/readiness` で status=near_ready、全 6 gates true |
| 21:13 | R1 v2 deploy (`/for-researcher/apply`, `/learn/methodology` 新コンテンツ) |
| 21:14 | ユーザー報告: 「Nats のデータ消えまくってる」 |
| **21:14:54** | **ROLLBACK: `cp ikimon.life.pre-cutover ikimon.life && systemctl reload nginx`** |
| 21:15 | 復旧 smoke: `/`, `/explore.php`, `/post.php`, `/api/get_events.php`, `/dashboard.php` 全 200 |

## Root Cause

**本番 v2 DB (`ikimon_v2`) に legacy PHP のユーザーデータ bootstrap import が完遂していなかった**。

実測値（cutover 時点）:

| 項目 | 本番 v2 DB (`ikimon_v2`) | 本番 legacy (`data/`) | 差 |
|---|---|---|---|
| users | **9** | 約 100（`users.json` 33KB） | 🔴 約 9% のみ |
| occurrences | **136** | 15 json files に複数 entries | 🔴 部分のみ |
| visits | 135 | — | 🟡 |
| trackPoints | **0** | あり（trip データ複数） | 🔴 完全未取込 |
| observationPhotoAssets | 267 | — | 🟢 |

`migration_runs` の履歴:
- 最後の `bootstrap_import`: 2026-04-18 15:37 `completed`, **rows_imported=0**
- → 「completed」ステータスだが **実際は 0 件しか取り込まれていない** 状態だった

## Why the Check Process Missed This

Pre-cutover check (愛) が参照したのは以下:

1. `https://ikimon.life/api/v1/research/occurrences` 等 の endpoint 疎通 — ✅
2. `/ops/readiness` の `gates.rollbackSafetyWindowReady: true` — ✅
3. `gates.parityVerified / deltaSyncHealthy / driftReportHealthy / compatibilityWriteWorking / audioArchiveReady` — 全 true

**しかし以下は見ていなかった**:

- `counts.users` が legacy user 数と乖離していないか（9 vs 100）
- `counts.trackPoints > 0` （0 は完全未取込のシグナル）
- 最新の `bootstrap_import.rows_imported > 0` （0 は空 import）

`gates.parityVerified` は **"canonical drift report が healthy"** を意味するが、これは
staging DB ↔ staging mirror の同期健全性であり、**本番 v2 DB の完成度を示すものではない**。

## Recovery

CUTOVER_RUNBOOK §Step R1 (nginx 戻し) だけで復旧、所要 1 分弱。

データ損失なし。理由:
- compatibilityWriter が cutover 期間中も legacy (`data/observations/*.json`, `data/users.json`,
  `data/auth_tokens.json`) に書き込んでいた
- ただし本番 v2 で新規作成された record は legacy 側にも残る（compatibility_write_ledger で
  succeeded 確認済）
- 既存 legacy data は一切触れられていない

副次:
- `pg_dump` 5.8MB の snapshot と uploads rsync 762MB は `/var/www/ikimon.life-staging/backups/`
  に保存、次回のカットオーバーでも参考として維持

## Corrective Actions（再カットオーバー前に必須）

### 1. 本番 v2 DB への bootstrap import を正しく実行

本番 DB を対象に以下を完遂:

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2
# 本番 DB 向け env (pm2 dump の値) で
DATABASE_URL="postgres://ikimon_v2:<prod_pass>@127.0.0.1:5432/ikimon_v2" \
LEGACY_DATA_ROOT=/var/www/ikimon.life/data \
LEGACY_PUBLIC_ROOT=/var/www/ikimon.life/public_html \
LEGACY_UPLOADS_ROOT=/var/www/ikimon.life/public_html/uploads \
  npm run import:legacy && \
  npm run import:observations && \
  npm run import:observations:evidence && \
  npm run import:observations:identifications && \
  npm run import:observations:conditions && \
  npm run import:remember-tokens && \
  npm run import:tracks
```

完遂後 `counts.users`, `counts.occurrences`, `counts.trackPoints` が legacy とほぼ一致する
ことを確認。

### 2. `docs/strategy/replacement_final_checklist_2026-04-23.md` Section D に
Data Freshness gate 追加:

- `counts.users >= legacy user count × 0.95`
- `counts.trackPoints > 0`
- 最新 `bootstrap_import.rows_imported > 0`

### 3. `ops/CUTOVER_RUNBOOK.md` のトリガー条件に追加:

> - cutover 後、`counts.users` / `counts.occurrences` が legacy 比で 10% 以上少ない
>   → **即 rollback**（bootstrap import 未完遂の疑い）

### 4. `ops/runbooks/cutover_retry_bootstrap_2026-04-23.md` (新規)

本番 v2 DB への bootstrap 手順と各ステップの期待値を時系列でまとめる。

## Side Notes

### R1 Foundation Fixes の扱い

commit `30d44244` (R1 v2: `/for-researcher/apply` + `/learn/methodology` §1.5) は
**rollback 対象ではない**。R1 は v2 コード変更のみで、nginx が legacy 向けに戻った
現在、本番 ikimon.life からはアクセス不可（v2 proxy されないため）。

staging.ikimon.life からは変わらずアクセス可能（staging v2 :3200 は触っていない）:
- https://staging.ikimon.life/for-researcher/apply
- https://staging.ikimon.life/learn/methodology

次回再カットオーバー時に本番公開面にも反映される。

### pm2 `--update-env` の罠

今回の副作用として、`--update-env` flag を使って pm2 restart すると、呼び出した
shell env が本番 pm2 process に流れ込む問題を発見。`/etc/ikimon/staging-v2.env` を
`source` したあとに本番 pm2 に対して `--update-env` すると DATABASE_URL が staging に
上書きされる。

**対処**: pm2 dump (`/root/.pm2/dump.pm2`) に本番 env が保存されているため、そこから
`pm2 set` で個別 env を書き戻すことで復元できる。今回これで対処済。

handoff 表と runbook にこの罠を明記して予防する。

## 2026-04-23 23:00 追補 — Path 誤認 + import script env 無視

INC の corrective action として v2 DB TRUNCATE + bootstrap を試みたが、**初回は誤った
legacy data path**（`/var/www/ikimon.life/data`、古いスナップショット）を使用していた。
これにより:
- 初回 bootstrap: users 103, obs **237**, trackPoints 682 (古いデータ)
- 正しい path B (`/var/www/ikimon.life/repo/upload_package/data`) で再 bootstrap:
  users 77, obs **6530**, trackPoints **5725**（27 倍差）

path 誤認の原因:
1. **真の本番 data path** は `/var/www/ikimon.life/repo/upload_package/data`（nginx root
   と同じ `upload_package/` 配下）。`/var/www/ikimon.life/data/` は古いバックアップ用
2. CLAUDE.md の `DATA_DIR = ROOT_DIR/data` の `ROOT_DIR` は `upload_package/` を意味する

**import script 7本中 6 本が `LEGACY_DATA_ROOT` env を読まないバグ**:
- `planObservationLedger.ts`, `importObservationMeaning.ts`, `importObservationEvidence.ts`,
  `importObservationIdentification.ts`, `importObservationPlaceCondition.ts`,
  `importRememberTokens.ts`, `importTrackSessions.ts` が `path.resolve(projectRoot, "../upload_package/data")`
  ハードコード
- `--legacy-data-root=` CLI arg は各 script 対応しているため、これを必ず渡す運用で当面対応
- long-term fix: 7 scripts 全部に `process.env.LEGACY_DATA_ROOT || <default>` を追加する PR

**ユーザーから追加判明した差**:
初回 bootstrap 時の staging `/` には Nats さんの 2026-03-19 掛川観察しか表示されておらず、
本番 `/index.php` で見える 2026-04-23 13:24 浜松 / 2026-04-19 京都 の観察が出なかった。
path B で再 bootstrap した後、`user_69be85c688371`（Nats さんの second user_id）の観察
5 件以上が staging DB に正しく取り込まれ、Nats の 4月観察が表示された。

**Nats さんの dual user_id**:
- `user_69a01379b962e`（users.json 正規登録、3月19日掛川まで）
- `user_69be85c688371`（users.json 未登録、4月観察の user_id）

これは legacy 認証で user_id が新規発行された状態と推定。bootstrap は
`orphanUsersFromObservations` で後者を補完しているが、display_name が空のため
フィードでは user_id がそのまま出る。後日 merge が必要。

## 2026-04-23 23:15 追補 — 写真配信 404 の発見と修正

staging `/` の観察カードが全て「写真なし」表示になっていた。原因:

- v2 の `/thumb/:preset/*` route (`legacyAssets.ts`) は `loadConfig().legacyUploadsRoot`
  = `process.env.LEGACY_UPLOADS_ROOT` を使う
- **staging v2 service env に `LEGACY_*` 全て未設定** → `legacyUploadsRoot` undefined
  → thumb 配信が 404
- **本番 v2 pm2 env は `LEGACY_UPLOADS_ROOT=/var/www/ikimon.life/public_html/uploads`**
  = path A（空 dir）を指していた → 本番 cutover 後も同じ 404 問題が発生する状態だった

修正:
- `/etc/ikimon/staging-v2.env` に LEGACY_DATA_ROOT / PUBLIC_ROOT / UPLOADS_ROOT を追加 → restart
- `pm2 set ikimon-v2-production-api:LEGACY_*` で本番側も path B (`/var/www/ikimon.life/repo/upload_package/...`) に更新 → restart

検証:
- サンプル UUID で thumb 200 / 100KB webp 配信確認（staging + production）
- staging `/` に 6 obs cards 分の photo_0.webp が含まれて表示

## 2026-04-23 23:35 追補 — 観察詳細ページの画像 404 + symlink 修正

thumb は復活したがユーザー指摘で「カードから詳細ページへ行くと画像がない」と判明。
詳細ページは `/uploads/photos/<uuid>/photo_N.webp` を直接 img src に使い、これは nginx
の `location /uploads/ alias /var/www/ikimon.life-staging/repo/upload_package/public_html/uploads/`
を経由する。staging-side の該当 path に `photos/` dir は存在したが、最新 UUID (4月23日
浜松 Nats 等) は入っていなかった。

対処:
```bash
cd /var/www/ikimon.life-staging/repo/upload_package/public_html/uploads/
ln -sfn /var/www/ikimon.life/repo/upload_package/public_html/uploads/photos photos
```

staging の photos/ を本番 photos への symlink に置換。staging v2 は本番 legacy の photos
を filesystem 越しに直接 serve する構成に。

検証: `curl http://127.0.0.1:8081/uploads/photos/b210c514-.../photo_0.webp` → 200 / 27KB

注意: staging と本番の uploads を physically shared する設計。独立運用必要なら rsync
copy に切り替え（本タスク外）。

## 2026-04-23 23:50 追補 — legacy AI 同定結果の import

ユーザー指示「AI 再同定までやって。1 つの観察投稿から読み取れるだけ読み取れるとか、
そこがうまく表現されているか把握したい」対応:

**発見**: legacy `upload_package/data/observations/*.json` の各 observation record に
`ai_assessments[]` field が既存（`recommended_taxon` / `scientific_name` / `rank` 等、
gemini-3.1-flash-lite-preview で既に同定済）。v2 DB の `observation_ai_*` 3 テーブルは
bootstrap import で取り込まれず全 0 行。

**対応**: import script を新規作成:
- `platform_v2/src/scripts/importLegacyAiAssessments.ts` (TypeScript 正規版)
- `ops/` 側の Python equivalent で VPS 実機実行（tempfile permission 問題回避のため stdin 経由）

**結果**（staging / production v2 DB 両方）:
- `observation_ai_runs`: 151 件
- `observation_ai_assessments`: 151 件
- `observation_ai_subject_candidates`: 148 件
- 取り込まれた候補例: ゴマダラカミキリ (species)、タヌキ (family)、Prunus (genus)、
  マキ属 (genus)、Magnoliopsida (class) 等

**残タスク (明日以降の independent issue)**:
- obs card UI の「近くで見つかっているもの」グリッドにユーザー情報/日付表示（`app.ts` の
  landing renderer 500行超を弄る、深夜リスク大のため延期）
- observation 詳細ページの画像クリック/複数枚切替のバグ調査

## 2026-04-24 00:05 追補 — ゴミデータ purge (案A)

ユーザー判断「Natsのが消えないならOK、Aの方向性で丁寧に進めて」:

**発見**: bootstrap 後の 6573 visits の内訳調査で **user_admin_001 が 6384 visits** (97%) 占有、うち photos 49 枚以外は実質ゴミ（passive scan / live-scan / pocket walk の自動投稿集積）。system_import (愛管 生物調査チーム) 54 件 seed + install_*/field_user_* 9 件も無写真。

**実行**: `ops/sql/purge_admin_seed_garbage_2026-04-23.sql` を staging + production v2 DB 両方に適用:

Before / After:
|       | Before | After | Delta |
|---|---|---|---|
| users | 77 | 77 | 0 |
| visits | 6573 | 171 | -6402 |
| occurrences | 6530 | 170 | -6360 |
| track_points | 5725 | 1122 | -4603 |
| identifications | 201 | 56 | -145 |
| photos | 365 | 361 | -4 (e2e) |

**保護 assert 通過**: Nats (user_69be85c688371) 132 visits / 269 photos、YAMAKI 9/23、
よー 5/5 すべて保持。admin photos 付き 20 visits / 49 photos も残置。

SQL は `BEGIN; ... COMMIT;` で transactional、`DO $$ ... RAISE EXCEPTION $$`
で保護対象が誤ヒット時には即ロールバック。

Backups:
- `ikimon_v2_staging_pre_purge_20260423_222231.sql` (45MB)
- `ikimon_v2_pre_purge_<timestamp>.sql`

## Verification

## Follow-up Issues (ユーザーから指摘、別途対応)

cutover rollback 後の staging 確認で、YAMAKI から以下 4 件の UX/バグ指摘あり。本 INC
とは独立の課題として別 issue で対応:

1. **観察カードの情報量が少ない** — v2 の obs-card が legacy feed-card より簡素
2. **AI 未同定 observations の再実行プログラム** — 未同定状態を自動的に detector に流す仕組み
3. **観察詳細ページ: 画像クリック無反応 + 複数枚切替不能 + 動画対応の実効性確認** —
   `/observations/:id` の UI バグ
4. **観察詳細ページが本番より見にくい** — UI 全般の polish

## Verification

- nginx: `/etc/nginx/sites-available/ikimon.life` は pre-cutover と一致
- `/etc/nginx/sites-available/ikimon.life.v2-cutover-snapshot` に v2 設定を保存済（次回再利用可）
- smoke 再実行: 復旧後の全 endpoint 200/302 確認
- 本番 v2 pm2 は DATABASE_URL=ikimon_v2 で稼働中（rollback しても v2 自体は動いている）

## Approver / Comms

- 判断者: YAMAKI（rollback 指示）+ 愛（検知・実行）
- 対外告知: 不要（MTTR 15 分、データ損失なし、大半のユーザーは未気付推定）
- 内部記録: 本文書、および checklist / runbook / action plan への反映
