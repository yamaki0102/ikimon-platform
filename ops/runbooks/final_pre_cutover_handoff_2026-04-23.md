# Final Pre-Cutover Handoff — 2026-04-23

YAMAKI が VPS で実行する作業だけを時系列で抽出した一枚物。
関連:
- [`ops/CUTOVER_RUNBOOK.md`](../CUTOVER_RUNBOOK.md) — 全手順の正本
- [`docs/strategy/replacement_final_checklist_2026-04-23.md`](../../docs/strategy/replacement_final_checklist_2026-04-23.md) — Go/No-Go
- [`docs/strategy/replacement_action_plan_2026-04-23.md`](../../docs/strategy/replacement_action_plan_2026-04-23.md) — Phase 構造

## 前提

- **D-Day**: 今週内（2026-04-24 ～ 2026-04-25 想定）
- **Primary 判断者**: YAMAKI
- **rollback Primary / Backup**: いずれも YAMAKI（単独運用）
- **VPS**: `ssh -i ~/Downloads/ikimon.pem root@162.43.44.131`
- **staging repo on VPS**: `/var/www/ikimon.life-staging/repo`
- **production v2**: pm2 `ikimon-v2-production-api` on :3201
- **staging v2**: systemd `ikimon-v2-staging.service` on :3200

## 現在の状態 (2026-04-23 16:53 JST 実機検証済)

**本番 v2 :3201 `/ops/readiness`**:
- `status: "near_ready"` ✅
- `gates.rollbackSafetyWindowReady: true` ✅
- **cutover GO 条件達成**

### Known Limitation (cutover 後整備)

| 項目 | 状態 | 対処タイミング |
|---|---|---|
| migration 0020 (audio) 未適用 | audio 機能 limited | cutover 後 T+30m に `npm run migrate` |
| `specialist_authorities` テーブル不在 | internal review lane 未構築、public face 無影響 | 別途 Phase |
| ~~`CLOUDFLARE_STREAM_*` env 未設定~~ | ✅ 2026-04-23 再確認で既設定 | — |

## 時系列タスク

### T-24h (前日、推定所要 15分)

> 2026-04-23 16:53 JST に愛 (Claude) が SSH で以下を実機実行済:
> `npm run report:legacy-drift` / `npm run materialize:legacy-verify-snapshot` /
> `npm run report:replacement-readiness`（本番 DB 向け）。本番 v2 本体 gates が
> 全 GREEN に到達済。残るのはこのセクションの確認ステップのみ。

#### 1. 本番 v2 readiness 再確認 (最優先)

```bash
ssh -i ~/Downloads/ikimon.pem root@162.43.44.131 \
  'curl -s http://127.0.0.1:3201/ops/readiness | jq ".status, .gates.rollbackSafetyWindowReady"'
# 期待: "near_ready" と true
```

#### 2. staging 側 drift refresh (任意、ポスト差し替え影響なし)

```bash
ssh -i ~/Downloads/ikimon.pem root@162.43.44.131

# staging で drift report を走らせる (必要なら staging / production を両方)
cd /var/www/ikimon.life-staging/repo/platform_v2
sudo -u ikimon-staging bash -c 'cd /var/www/ikimon.life-staging/repo/platform_v2 && npm run report:legacy-drift'
```

**成功判定**: コマンドが exit 0、`migration_runs` テーブルに status='succeeded' の
legacy_drift_report 行が追加される。

```bash
# 確認
sudo -u postgres psql ikimon_v2 -c "select run_type, status, finished_at from migration_runs where run_type='legacy_drift_report' order by started_at desc limit 3;"
```

#### 2. verify:legacy 再実行 (最新 verify 失敗の上書き)

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2
sudo -u ikimon-staging bash -c 'npm run verify:legacy'
```

**成功判定**: 最新 `verify_legacy_parity` run が status='succeeded' で mismatch 0。

#### 3. readiness 再取得して全 GREEN 確認

```bash
curl -s https://staging.ikimon.life/ops/readiness | jq '.status, .gates'
```

**期待出力**:
```json
"near_ready"
{
  "parityVerified": true,
  "deltaSyncHealthy": true,
  "driftReportHealthy": true,
  "compatibilityWriteWorking": true,
  "audioArchiveReady": true,
  "rollbackSafetyWindowReady": true
}
```

**失敗時**: どの gate が false か確認 →
[`docs/strategy/replacement_final_checklist_2026-04-23.md`](../../docs/strategy/replacement_final_checklist_2026-04-23.md) Section D.1 の
mitigation に従う。

#### 4. replacement readiness report 実行 (Section D 自動指標を取る)

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2
sudo -u ikimon-staging bash -c '
  STAGING_BASE_URL=https://staging.ikimon.life \
  PRODUCTION_BASE_URL=https://ikimon.life \
  npm run report:replacement-readiness
'
# 出力: platform_v2/ops/reports/replacement-readiness-YYYY-MM-DD-HH-MM-SS.md
ls -lt /var/www/ikimon.life-staging/repo/platform_v2/ops/reports/ | head -5
```

**成功判定**:
- `authorityFill.percentWithRank >= 90` (checklist D3)
- endpoint mismatches == 0 (checklist Section D.2)

#### 5. Section E.1 の result / evidence_link を最終確定

[`checklist.md`](../../docs/strategy/replacement_final_checklist_2026-04-23.md) の Section E.1
を開き、D1/D2/D3 の result を `🟡 STALE` / `⏳ PENDING` から `✅ PASS` に更新して commit。

---

### T-6h (本番 v2 env 確認、所要 5分)

2026-04-23 16:55 JST 再確認で `GEMINI_API_KEY` / `CLOUDFLARE_*` / `DATABASE_URL` /
`V2_PRIVILEGED_WRITE_API_KEY` は既設定。未設定は `COMPATIBILITY_WRITE_ENABLED` のみ
(default=true で稼働中なので**明示はオプション**)。

```bash
# 確認 (既設定の再認)
ssh -i ~/Downloads/ikimon.pem root@162.43.44.131 "
  PID=\$(pm2 jlist | python3 -c 'import json,sys; [print(p[\"pid\"]) for p in json.load(sys.stdin) if p[\"name\"]==\"ikimon-v2-production-api\"]')
  cat /proc/\$PID/environ | tr '\0' '\n' | grep -E '^(GEMINI|CLOUDFLARE|DATABASE_URL|V2_PRIVILEGED)' | cut -d= -f1
"

# (任意) COMPATIBILITY_WRITE_ENABLED を明示
# pm2 set ikimon-v2-production-api:COMPATIBILITY_WRITE_ENABLED 1
# pm2 restart ikimon-v2-production-api --update-env
```

---

### T-2h (事前バックアップ)

ref: [`ops/CUTOVER_RUNBOOK.md` §Step 1](../CUTOVER_RUNBOOK.md#step-1-事前バックアップ)

```bash
STAMP=$(date +%Y%m%d_%H%M%S)
ssh root@162.43.44.131 "sudo -u postgres pg_dump ikimon_v2 > /var/www/ikimon.life-staging/backups/ikimon_v2_${STAMP}.sql"
ssh root@162.43.44.131 "rsync -a /var/www/ikimon.life/public_html/uploads/ /var/www/ikimon.life-staging/backups/uploads_${STAMP}/"

# 確認
ssh root@162.43.44.131 "ls -lh /var/www/ikimon.life-staging/backups/ikimon_v2_${STAMP}.sql"
```

**成功判定**: `.sql` ファイルが数 MB 以上、`uploads_${STAMP}/` が既存 uploads と同等サイズ。

---

### T-30m (本番 v2 readiness 最終確認)

```bash
# 本番 v2 内部エンドポイント
ssh root@162.43.44.131 "curl -s http://127.0.0.1:3201/ops/readiness | jq .status"
# => "near_ready"

ssh root@162.43.44.131 "curl -s http://127.0.0.1:3201/healthz"
# => 200
```

**FAIL 時**: **No-Go**。rollback 不要（まだ切替前）、原因調査のみ。

---

### T-5m (nginx 設定の切替準備)

ref: [`ops/CUTOVER_RUNBOOK.md` §Step 3](../CUTOVER_RUNBOOK.md#step-3-nginx-設定切替)

```bash
ssh root@162.43.44.131

# 退避コピー (rollback 用)
sudo cp /etc/nginx/sites-available/ikimon.life /etc/nginx/sites-available/ikimon.life.pre-cutover

# staging の nginx 設定を参考に本番向け設定を作る
sudo cat /etc/nginx/sites-available/staging.ikimon.life
# -> location / を proxy_pass http://127.0.0.1:3201 に
# -> location /legacy/ を既存 PHP fallback に退避
# -> location /uploads/ alias を維持

# 差し替え前テスト
sudo nginx -t
```

**成功判定**: `nginx -t` が `syntax is ok` / `test is successful`。

---

### T-0 (差し替え瞬間、所要 1-2分)

```bash
sudo systemctl reload nginx

# 即 smoke
for u in / /home /record /notes /explore /map /lens /guide /learn /about /for-business /faq /contact /healthz /readyz; do
  printf '%3d  %s\n' "$(curl -s -o /dev/null -w '%{http_code}' https://ikimon.life$u)" "$u"
done
```

**成功判定**: 全 endpoint 200 (または認証必須 route は 401/200)。5xx が 1 件でもあれば
即 rollback 検討（[`ops/CUTOVER_RUNBOOK.md` §Step R1](../CUTOVER_RUNBOOK.md#step-r1-即時ロールバック-nginx-だけ戻す所要-1-2分)）。

---

### T+5m (外部 smoke + contact POST 疎通)

ref: [`ops/CUTOVER_RUNBOOK.md` §Step 4](../CUTOVER_RUNBOOK.md#step-4-スモークテスト-本番-dns-で)

```bash
# contact POST 疎通
curl -X POST https://ikimon.life/api/v1/contact/submit \
  -H 'Content-Type: application/json' \
  -d '{"category":"question","message":"cutover 疎通テスト","email":"yamaki0102@gmail.com"}'

# ログ
ssh root@162.43.44.131 "pm2 logs ikimon-v2-production-api --lines 100 --nostream"
```

---

### T+15m (カナリア観測)

Section E.4 (H1-H5) に従う:
- H1 エラーレート < 平常 +0.5%pt
- H2 主要 10 ページ手動 smoke 全 PASS
- H3 `/record` POST 1 件成功（認証済みブラウザで）
- H5 `/post.php` → `/record` へ 301 リダイレクト確認

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -L https://ikimon.life/post.php
# 期待: 200 最終的には /record
```

---

### T+1h (安定化判定)

[`docs/strategy/replacement_final_checklist_2026-04-23.md`](../../docs/strategy/replacement_final_checklist_2026-04-23.md) Section E.5 を塗る。
- I1 エラーレート平常域
- I4 rollback 不要を最終宣言

宣言後、24h 監視フェーズへ。詳細: [`ops/CUTOVER_RUNBOOK.md` §カットオーバー後 24h 監視](../CUTOVER_RUNBOOK.md#カットオーバー後-24h-監視)

---

## 失敗時

どのフェーズでも hard_stop FAIL を観測したら即:
1. [`ops/CUTOVER_RUNBOOK.md` §ロールバック手順 §トリガー条件](../CUTOVER_RUNBOOK.md#トリガー条件-1つ以上満たせば即ロールバック検討) に該当するか確認
2. Step R1 (nginx 戻し、1-2分) 実行
3. Step R2 (ユーザー通知)
4. Step R4 (インシデントログ)

## ポスト差し替え TODO（D-Day 後）

- [ ] `.github/workflows/deploy.yml` の health check を v2 路線 (`/healthz` / `/readyz` / `/`) に書き換え
  - 現在: `index.php` `explore.php` `post.php` `api/get_events.php` (legacy PHP 向け)
  - cutover 後の次の push で fail する可能性あり、事前の PR 推奨
- [ ] `views/dashboard_*.php` 6件 (orphaned partial) の削除
- [ ] レガシー PHP API の段階撤去計画（`legacy_continued` family の 1 週間後撤退開始）
