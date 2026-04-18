# ikimon.life 本番カットオーバー Runbook

staging.ikimon.life (platform_v2 Node) → 本番 ikimon.life に切り替える手順。

## 前提 (2026-04-18 Phase I 時点)

- 本番 v2 サーバ: `pm2 ikimon-v2-production-api` (:3201, uptime 確認済)
- staging v2: `pm2 ikimon-v2-staging-api` (:3200)
- `/ops/readiness` = **near_ready** (最高ランク、全 gates true)
- 本番 DB (`ikimon_v2`): 103 users / 240 visits / 234 occurrences / 229 photos / 682 track points
- parityVerified / deltaSyncHealthy / driftReportHealthy / compatibilityWriteWorking / rollbackSafetyWindowReady 全 true
- 本番 DB に migration 0012-0014 適用済 (contact_submissions / video_upload_requests / audio_segments / audio_detections)

## カットオーバー前に必要な環境変数追加 (🚨 要対応)

本番 v2 `pm2 ikimon-v2-production-api` の env に以下を**追加**する必要がある:

```bash
# AI ガイド (contact は msmtp 直接なので不要)
pm2 set ikimon-v2-production-api:GEMINI_API_KEY "<value>"

# Cloudflare Stream (動画対応)
pm2 set ikimon-v2-production-api:CLOUDFLARE_ACCOUNT_ID "<value>"
pm2 set ikimon-v2-production-api:CLOUDFLARE_STREAM_API_TOKEN "<value>"
pm2 set ikimon-v2-production-api:CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN "<value>"

# Compatibility writer (default true だが明示推奨)
pm2 set ikimon-v2-production-api:COMPATIBILITY_WRITE_ENABLED 1

pm2 restart ikimon-v2-production-api --update-env
```

- staging にある `GEMINI_API_KEY` をそのまま使うか本番用 key を別途発行するかは要判断
- `CLOUDFLARE_*` は staging/本番ともに未設定 → Cloudflare ダッシュボードで発行して設定

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

`/etc/nginx/sites-available/ikimon.life` を編集し、**staging.ikimon.life と同じ構成** にする:

- 現状 `location /` が `try_files $uri $uri/ $uri.php =404` → PHP fallback
- 切替後 `location /` が `proxy_pass http://127.0.0.1:3201` (v2 production)
- 既存 PHP は `location /legacy/` に退避（rollback 用）
- `location /uploads/` は `alias /var/www/ikimon.life/public_html/uploads/` を維持

参考: `/etc/nginx/sites-available/staging.ikimon.life` の v2 primary 構成。

```bash
# nginx 設定テスト
sudo nginx -t

# 問題なければ reload
sudo systemctl reload nginx
```

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
pm2 logs ikimon-v2-production-api --lines 100
```

### Step 5: 既存ユーザー認証継続確認

- Chrome でログイン済みのアカウントで https://ikimon.life を開く
- Cookie `ikimon_remember` が残っていれば v2 が自動的に新セッション発行
- /profile/:userId で過去の投稿が見えることを確認
- /record で新規投稿 → 成功すれば compatibilityWriter で legacy JSON にも書き込み

## ロールバック手順 (v2 で障害発生時)

### 即時ロールバック (nginx だけ戻す)

```bash
# /etc/nginx/sites-available/ikimon.life を戻す
sudo cp /etc/nginx/sites-available/ikimon.life.pre-cutover /etc/nginx/sites-available/ikimon.life
sudo nginx -t && sudo systemctl reload nginx
```

→ リクエストは PHP legacy に戻る。compatibilityWriter で書き込んだ期間分の legacy 側データは保持されているので、閲覧は連続。

### データ復元 (最悪の場合)

```bash
# PHP legacy はデプロイ時点の data/ を `deploy.sh` が backup するので通常問題ない
# v2 DB が破損した場合は pg_dump snapshot を restore
sudo -u postgres psql ikimon_v2 < /var/www/ikimon.life-staging/backups/ikimon_v2_YYYYMMDD_HHMMSS.sql
```

## カットオーバー後 24h 監視

- `pm2 logs ikimon-v2-production-api --lines 200` で Error/Fatal 監視
- `/ops/readiness` が near_ready を維持しているか
- Gemini API quota (Cloudflare dashboard)
- Cloudflare Stream の動画アップロード件数
- `contact_submissions` テーブルへの書込み → `notification_sent=true` 率
- `compatibility_write_ledger` の `write_status=failed` 件数 (0 であるべき)

## 付録: 本番 v2 で pm2 managed でない問題

**現状**: 本番 v2 は pm2 で起動されているが systemd unit が無く、VPS 再起動時に手動で `pm2 resurrect` が必要。

**対処**: カットオーバー後に `pm2 startup && pm2 save` で systemd に登録する。

```bash
pm2 startup systemd -u root --hp /root
pm2 save
```

## 付録: 未対応項目 (カットオーバー直前では不要)

- `readiness.status` が "ready" という文字列を返すようにする実装 (現状 "near_ready" が最高、これでOK)
- Phase 3 で legacy PHP 側の CanonicalSync テスト isolation 問題 (マージ前から存在、v2 には無関係)
- /for-business/index.php:756 persona[href] warning (legacy 側、非致命)
