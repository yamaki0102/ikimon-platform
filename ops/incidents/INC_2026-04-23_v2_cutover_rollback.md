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

## Verification

- nginx: `/etc/nginx/sites-available/ikimon.life` は pre-cutover と一致
- `/etc/nginx/sites-available/ikimon.life.v2-cutover-snapshot` に v2 設定を保存済（次回再利用可）
- smoke 再実行: 復旧後の全 endpoint 200/302 確認
- 本番 v2 pm2 は DATABASE_URL=ikimon_v2 で稼働中（rollback しても v2 自体は動いている）

## Approver / Comms

- 判断者: YAMAKI（rollback 指示）+ 愛（検知・実行）
- 対外告知: 不要（MTTR 15 分、データ損失なし、大半のユーザーは未気付推定）
- 内部記録: 本文書、および checklist / runbook / action plan への反映
