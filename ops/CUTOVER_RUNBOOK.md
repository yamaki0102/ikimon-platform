# ikimon.life 本番カットオーバー Runbook

staging.ikimon.life (platform_v2 Node) → 本番 ikimon.life に切り替える手順。

## 前提 (2026-04-19 staging runtime refresh 後)

- 本番 v2 サーバ: blue/green `systemd` (`ikimon-v2-blue.service` :3201 / `ikimon-v2-green.service` :3202, env file `/etc/ikimon/production-v2.env`)
- staging v2: `systemd ikimon-v2-staging.service` (:3200, env file `/etc/ikimon/staging-v2.env`)
- `/ops/readiness` = **near_ready** (最高ランク、全 gates true)
- 本番 DB (`ikimon_v2`): 103 users / 240 visits / 234 occurrences / 229 photos / 682 track points
- parityVerified / deltaSyncHealthy / driftReportHealthy / compatibilityWriteWorking / rollbackSafetyWindowReady 全 true
- 本番 DB に migration 0012-0014 適用済 (contact_submissions / video_upload_requests / audio_segments / audio_detections)

## staging v2 の canonical runtime

- unit reference: `ops/deploy/ikimon_v2_staging.service`
- service user: `ikimon-staging`
- deploy workflow secret: `V2_STAGING_DATABASE_URL`
- staging browser verify secrets: `STAGING_BASIC_AUTH_USER`, `STAGING_BASIC_AUTH_PASS`
- deploy-staging は `pre-flight` → `deploy` → `verify-ssh` → `verify-e2e` で止める

### Release gate: registry sitemap smoke

staging 反映後、production cutover 判断の前に `platform_v2/src/siteMap.ts` の canonical registry から生成される巡回 smoke を必ず通す。`.github/workflows/deploy-staging.yml` の `verify-e2e` job でも `npm run e2e:staging:site-map` を実行する。baseline PNG が commit されている場合は、workflow が `VISUAL_QA_ASSERT_SCREENSHOTS=1` に切り替えて visual diff まで実行する。

```bash
cd platform_v2
npm run e2e:staging:site-map
```

この gate は `/`, `/learn`, `/record`, `/map`, `/explore`, `/notes`, `/community`, `/for-business`, `/specialist/id-workbench` に加えて、QA sitemap から実データの `/home`, `/profile/:userId`, `/observations/:id?subject=:occurrenceId` を解決する。desktop `1440x1200` / mobile `390x844` の対象 viewport で、期待テキスト、許容 status、ready selector、横スクロールなしを確認する。失敗時は release blocker として扱う。

screenshot baseline を承認済みの環境では、同じ registry smoke で visual diff も有効化する。

```bash
cd platform_v2
VISUAL_QA_ASSERT_SCREENSHOTS=1 npm run e2e:staging:site-map
```

baseline を更新する場合は、差分理由を PR に明記したうえで次を実行し、生成された `e2e/sitemap-registry-visual.staging.spec.ts-snapshots/*.png` をレビュー対象に含める。

```bash
cd platform_v2
VISUAL_QA_ASSERT_SCREENSHOTS=1 npm run e2e:staging:site-map -- --update-snapshots
```

## production v2 の canonical runtime

- unit references: `ops/deploy/ikimon_v2_blue.service`, `ops/deploy/ikimon_v2_green.service`
- service user: `www-data`
- env file: `/etc/ikimon/production-v2.env`
- deploy workflow: `.github/workflows/deploy.yml`
- deploy workflow は `deploy.sh` 後に inactive color を prepare → `/healthz` `/readyz` `/ops/readiness` → browser smoke → nginx promote の順で検証する
- active color は `/var/www/ikimon.life/deploy_state/active_color` に保存する。無い場合は nginx の `proxy_pass` から推定する
- 旧 `pm2 ikimon-v2-production-api` は env 移行元としてのみ扱う。通常運用では使わない

## カットオーバー前に必要な環境変数

**正本**: `/etc/ikimon/production-v2.env`

| 変数 | 状態 | 備考 |
|---|---|---|
| `GEMINI_API_KEY` | ✅ 設定済 | 本番/staging 共通 |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ 設定済 | |
| `CLOUDFLARE_STREAM_API_TOKEN` | ✅ 設定済 | |
| `CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN` | ✅ 設定済 | |
| `DATABASE_URL` | ✅ 設定済 | |
| `V2_PRIVILEGED_WRITE_API_KEY` | ✅ 設定済 | |
| `COMPATIBILITY_WRITE_ENABLED` | ✅ `1` | 明示 |
| `PORT` | unit 側で固定 | blue=3201 / green=3202 |
| `LEGACY_DATA_ROOT` | ✅ `/var/www/ikimon.life/repo/upload_package/data` | path B が正本 |
| `LEGACY_PUBLIC_ROOT` | ✅ `/var/www/ikimon.life/repo/upload_package/public_html` | path B が正本 |
| `LEGACY_UPLOADS_ROOT` | ✅ `/var/www/ikimon.life/repo/upload_package/public_html/uploads` | path B が正本 |

`pm2 restart --update-env` は使わない。shell env の混入で `DATABASE_URL` が staging に
regression した実績があるため、systemd + env file に一本化する。

## カットオーバー前の必須 bootstrap import (2026-04-23 INC 再発防止)

再カットオーバー前に、**本番 v2 DB (`ikimon_v2`) に legacy PHP 全データを取り込む**。
これをサボると S2 incident (INC_2026-04-23) が再発する。

```bash
cd /var/www/ikimon.life/repo/platform_v2
# 本番 DB 向け env (/etc/ikimon/production-v2.env の値を使う)
DATABASE_URL="postgres://ikimon_v2:<prod_pass>@127.0.0.1:5432/ikimon_v2" \
LEGACY_DATA_ROOT=/var/www/ikimon.life/repo/upload_package/data \
LEGACY_PUBLIC_ROOT=/var/www/ikimon.life/repo/upload_package/public_html \
LEGACY_UPLOADS_ROOT=/var/www/ikimon.life/repo/upload_package/public_html/uploads \
  npm run import:legacy && \
  npm run import:plan:observations && \
  npm run import:observations && \
  npm run import:observations:evidence && \
  npm run import:observations:identifications && \
  npm run import:observations:conditions && \
  npm run import:remember-tokens && \
  npm run import:tracks
```

### 成功判定（本番 DB でこれが達成されるまで cutover NG）

```bash
# 本番 DB 実測
sudo -u postgres psql ikimon_v2 -c "
select (select count(*) from users) as users,
       (select count(*) from occurrences) as occurrences,
       (select count(*) from visit_track_points) as track_points,
       (select count(*) from identifications) as identifications;
"
# 期待: legacy data/ の件数とほぼ同数、trackPoints > 0
```

```bash
# /ops/readiness で counts 確認（本番 v2 上）
curl -s http://127.0.0.1:3201/ops/readiness | jq '.counts'
# 期待: users >= 法人 users.json の ~95%、trackPoints > 0
```

詳細手順: [`ops/runbooks/cutover_retry_bootstrap_2026-04-23.md`](runbooks/cutover_retry_bootstrap_2026-04-23.md)

## カットオーバー手順

### Step 1: 事前バックアップ

```bash
# DB snapshot
ssh root@162.43.44.131 "sudo -u postgres pg_dump ikimon_v2 > /var/www/ikimon.life-staging/backups/ikimon_v2_$(date +%Y%m%d_%H%M%S).sql"

# アップロードファイル rsync
ssh root@162.43.44.131 "rsync -a /var/www/ikimon.life/public_html/uploads/ /var/www/ikimon.life-staging/backups/uploads_$(date +%Y%m%d_%H%M%S)/"
```

### Step 2: 最終 readiness 再チェック

```bash
curl -s http://127.0.0.1:3201/ops/readiness | jq .status
# → "near_ready" を確認

curl -s http://127.0.0.1:3201/healthz
# → 200 OK
```

### Step 3: nginx 設定切替

GitHub Actions の `deploy.yml` が `ops/deploy/deploy_platform_v2_blue_green.sh promote` で
inactive color を public nginx に昇格する。手動で切り替える場合も同じ script を使う:

```bash
bash /var/www/ikimon.life/repo/ops/deploy/deploy_platform_v2_blue_green.sh status
bash /var/www/ikimon.life/repo/ops/deploy/deploy_platform_v2_blue_green.sh promote
```

promote は nginx snapshot を保存し、`nginx -t` / reload / public smoke 失敗時は直前設定に戻す。

### Step 4: スモークテスト (本番 DNS で)

```bash
# 外部から
curl -s -o /dev/null -w '%{http_code}\n' https://ikimon.life/
curl -s -o /dev/null -w '%{http_code}\n' https://ikimon.life/explore
curl -s -o /dev/null -w '%{http_code}\n' https://ikimon.life/contact
curl -s -o /dev/null -w '%{http_code}\n' https://ikimon.life/observations/c1f39c8a-c0e7-429c-b02d-52c9d48a40e8

# contact POST (送信テスト)
curl -X POST https://ikimon.life/api/v1/contact/submit \
  -H 'Content-Type: application/json' \
  -d '{"category":"question","message":"本番カットオーバー直後の疎通テスト","email":"yamaki0102@gmail.com"}'

# ログ監視
journalctl -u ikimon-v2-blue.service -n 50 --no-pager
journalctl -u ikimon-v2-green.service -n 50 --no-pager
```

### Step 5: 既存ユーザー認証継続確認

- Chrome でログイン済みのアカウントで https://ikimon.life を開く
- Cookie `ikimon_remember` が残っていれば v2 が自動的に新セッション発行
- /profile/:userId で過去の投稿が見えることを確認
- /record で新規投稿 → 成功すれば compatibilityWriter で legacy JSON にも書き込み

## ロールバック手順 (v2 で障害発生時)

関連: [`docs/strategy/replacement_final_checklist_2026-04-23.md`](../docs/strategy/replacement_final_checklist_2026-04-23.md)
Section E の hard_stop FAIL を観測したら本セクションへ。

### トリガー条件 (1つ以上満たせば即ロールバック検討)

| 条件 | 閾値 | 観測元 |
|---|---|---|
| `/healthz` または `/readyz` 5xx | 2分以上継続 | `curl http://127.0.0.1:3201/healthz` |
| エラーレート急上昇 | 平常 +0.5%pt 超 が 5分以上 | `journalctl -u ikimon-v2-blue.service` / `ikimon-v2-green.service` / アクセスログ |
| `/record` POST 成功率 | < 95% が 5分以上 | active color の journalctl grep |
| `compatibility_write_ledger.write_status=failed` | 直近10分で 3件以上 | `psql ikimon_v2 -c "select count(*) from compatibility_write_ledger where attempted_at > now()-interval '10 min' and write_status='failed'"` |
| **`counts.users` / `counts.occurrences` が legacy 比で 10% 以上少ない** | users: legacy users.json 件数 × 0.9 未満 / occurrences: legacy data/observations/ 合算 × 0.9 未満 | `/ops/readiness` の counts と legacy データ比較（※ 2026-04-23 INC 再発防止） |
| **`counts.trackPoints == 0`** | 0 のまま cutover に突入 | `/ops/readiness` counts — import:tracks 未完遂のシグナル |
| チェック表 Section E.3-E.5 の hard_stop=true FAIL | 1件でも | 目視 |
| ユーザーからの致命的障害報告 | 無限ループ/データ消失/認証断絶など | Twitter / 問い合わせ |

### 判断者

- **Primary**: YAMAKI (プロダクトオーナー)
- **Backup**: YAMAKI (2026-04-23 時点で単独運用、別担当指名なし)

### Step R1: 即時ロールバック (nginx だけ戻す、所要 1-2分)

```bash
# /etc/nginx/sites-available/ikimon.life を戻す
sudo cp /etc/nginx/sites-available/ikimon.life.pre-cutover /etc/nginx/sites-available/ikimon.life
sudo nginx -t && sudo systemctl reload nginx

# 疎通確認
curl -s -o /dev/null -w '%{http_code}\n' https://ikimon.life/
curl -s -o /dev/null -w '%{http_code}\n' https://ikimon.life/explore
```

→ リクエストは PHP legacy に戻る。compatibilityWriter で書き込んだ期間分の legacy 側データは保持されているので、閲覧は連続。

### Step R2: ユーザー通知 (rollback 実行直後)

Twitter / サイトバナーで告知:

```
【ikimon.life メンテナンス通知】
一時的にシステムを旧版に戻しました。投稿は継続できます。
復旧作業中です。ご不便をおかけします。
- 発生時刻: YYYY-MM-DD HH:MM JST
- 対応完了予定: 確認中
```

### Step R3: データ復元 (v2 DB 破損時のみ、所要 5-15分)

```bash
# v2 DB が破損した場合は pg_dump snapshot を restore
# スナップショットは Step 1 で取得済み: /var/www/ikimon.life-staging/backups/ikimon_v2_YYYYMMDD_HHMMSS.sql
sudo -u postgres psql ikimon_v2 -c "drop schema public cascade; create schema public;"
sudo -u postgres psql ikimon_v2 < /var/www/ikimon.life-staging/backups/ikimon_v2_YYYYMMDD_HHMMSS.sql

# PHP legacy はデプロイ時点の data/ を `deploy.sh` が backup するので通常問題ない
```

### Step R4: 事後処理 (rollback 完了後)

1. インシデントログを以下テンプレで記録:
   ```
   ## Incident: v2 cutover rollback YYYY-MM-DD
   - トリガー: (上記トリガー条件のどれか + 実測値)
   - 発生時刻: YYYY-MM-DD HH:MM:SS JST
   - rollback 実行時刻: YYYY-MM-DD HH:MM:SS JST
   - MTTR: X分
   - 影響範囲: (影響ユーザー推定)
   - 原因仮説: (判明時点で)
   - 次回再発防止アクション: (checklist Section E のどのチェックを強化すべきか)
   ```
2. `docs/strategy/replacement_final_checklist_2026-04-23.md` の Section E に
   「rollback実施済、次回 checklist 強化点」を追記
3. Section D の `gates.rollbackSafetyWindowReady` が再び true になるまで再挑戦を凍結

### Step R5: 再挑戦前ゲート

以下がすべて満たされるまで次のカットオーバーを試みない:

- インシデント原因が特定され、修正 PR が merge 済
- `replacementReadinessReport` を再実行して全 endpoint match
- `gates.rollbackSafetyWindowReady == true`
- incident log の次回再発防止アクションが実装済

## カットオーバー後 24h 監視

- active color の `journalctl -u ikimon-v2-{blue|green}.service -n 200 --no-pager` で Error/Fatal 監視
- `/ops/readiness` が near_ready を維持しているか
- Gemini API quota (Cloudflare dashboard)
- Cloudflare Stream の動画アップロード件数
- `contact_submissions` テーブルへの書込み → `notification_sent=true` 率
- `compatibility_write_ledger` の `write_status=failed` 件数 (0 であるべき)

## 付録: pm2 から systemd への移行

本番 v2 は `ikimon-v2-blue.service` / `ikimon-v2-green.service` に統一する。
旧 `pm2 ikimon-v2-production-api` は、初回 deploy 時に `/root/.pm2/dump.pm2` から既存 env を
拾うための移行元としてのみ参照する。

## 付録: 未対応項目 (カットオーバー直前では不要)

- `readiness.status` が "ready" という文字列を返すようにする実装 (現状 "near_ready" が最高、これでOK)
- Phase 3 で legacy PHP 側の CanonicalSync テスト isolation 問題 (マージ前から存在、v2 には無関係)
- /for-business/index.php:756 persona[href] warning (legacy 側、非致命)
