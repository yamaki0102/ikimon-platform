# Cutover Retry — 本番 v2 DB への bootstrap import 完遂手順

**前提**: 2026-04-23 20:59 の初回 cutover は本番 v2 DB に legacy データが
bootstrap import されていない状態で実行し、15 分で rollback した
（[INC_2026-04-23_v2_cutover_rollback.md](../incidents/INC_2026-04-23_v2_cutover_rollback.md) 参照）。
本 runbook は **再カットオーバー前に本番 v2 DB `ikimon_v2` を legacy と同期させる手順** を
時系列でまとめる。

関連:
- [`ops/CUTOVER_RUNBOOK.md`](../CUTOVER_RUNBOOK.md) — 全体手順の正本
- [`docs/strategy/replacement_final_checklist_2026-04-23.md`](../../docs/strategy/replacement_final_checklist_2026-04-23.md) — Section E.1 F0-F2 で ここの完遂を見る

---

## 0. 前提チェック

```bash
ssh -i ~/Downloads/ikimon.pem root@162.43.44.131

# legacy データのボリューム確認
ls /var/www/ikimon.life/data/users.json                              # ~33KB
find /var/www/ikimon.life/data/observations -name '*.json' | wc -l    # 15 前後
ls /var/www/ikimon.life/data/auth_tokens.json                         # あれば
find /var/www/ikimon.life/data/trips -name '*.json' 2>/dev/null | wc -l  # trip データ

# 本番 v2 DB の現状
sudo -u postgres psql ikimon_v2 -c "
select (select count(*) from users) as users,
       (select count(*) from occurrences) as occurrences,
       (select count(*) from visit_track_points) as track_points,
       (select count(*) from identifications) as identifications;
"
```

**期待（現状）**: users=9, occurrences=136, trackPoints=0, identifications=少
**目標**: users が legacy users.json 件数の ≥ 95%、trackPoints > 0

---

## 1. 本番 DB 向け env を取り出す（必ず pm2 dump から）

**罠**: `/etc/ikimon/staging-v2.env` を `source` したあと `--update-env` は使わない。
DATABASE_URL が staging 側に上書きされる（INC §Side Notes 参照）。

```bash
# pm2 dump から本番 DATABASE_URL を取り出して shell に入れる
export DATABASE_URL=$(python3 -c "
import json
with open('/root/.pm2/dump.pm2') as f: d = json.load(f)
for p in d:
    if p.get('name') == 'ikimon-v2-production-api':
        print(p['env']['DATABASE_URL'])
        break
")
export V2_PRIVILEGED_WRITE_API_KEY=$(python3 -c "
import json
with open('/root/.pm2/dump.pm2') as f: d = json.load(f)
for p in d:
    if p.get('name') == 'ikimon-v2-production-api':
        print(p['env']['V2_PRIVILEGED_WRITE_API_KEY'])
        break
")
export LEGACY_DATA_ROOT=/var/www/ikimon.life/repo/upload_package/data
export LEGACY_PUBLIC_ROOT=/var/www/ikimon.life/repo/upload_package/public_html
export LEGACY_UPLOADS_ROOT=/var/www/ikimon.life/repo/upload_package/public_html/uploads

# 確認
echo "DATABASE_URL host: $(echo $DATABASE_URL | sed -E 's|://[^@]+@||; s|/.*||')"
echo "DATABASE_URL db:   $(echo $DATABASE_URL | sed -E 's|.*/||')"
# => host: 127.0.0.1:5432 / db: ikimon_v2 (本番)
```

**絶対 NG**: `set -a; source /etc/ikimon/staging-v2.env; set +a` の後に作業すること
（staging の DATABASE_URL が効く）

---

## 2. bootstrap import 順次実行（所要 10-30 分）

⚠ **2026-04-23 23:00 追記**: `import:legacy` 以外の 6 scripts は `LEGACY_DATA_ROOT`
環境変数を読まず、ハードコードで `../upload_package/data`（staging repo 側）を参照する
バグあり。**`--legacy-data-root=...` CLI arg を必ず全コマンドに渡す**こと。

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2
CORRECT_ROOT=/var/www/ikimon.life/repo/upload_package/data

# 順序重要: legacy -> plan -> observations -> evidence -> identifications -> conditions -> tokens -> tracks
npm run import:legacy                                          -- --legacy-data-root=$CORRECT_ROOT
npm run import:plan:observations                               -- --legacy-data-root=$CORRECT_ROOT  # plan を先に必要
npm run import:observations                                    -- --legacy-data-root=$CORRECT_ROOT
npm run import:observations:evidence                           -- --legacy-data-root=$CORRECT_ROOT
npm run import:observations:identifications                    -- --legacy-data-root=$CORRECT_ROOT
npm run import:observations:conditions                         -- --legacy-data-root=$CORRECT_ROOT
npm run import:remember-tokens                                 -- --legacy-data-root=$CORRECT_ROOT
npm run import:tracks                                          -- --legacy-data-root=$CORRECT_ROOT
```

**想定される counts (2026-04-23 実測値)**:
- users: 77（orphan 補完込）
- observations: **6530**
- visits: 6573
- trackPoints: **5725**

これ未満で import が終わるなら path A (`/var/www/ikimon.life/data`) の古いスナップショットを
使っている可能性。path B (`/var/www/ikimon.life/repo/upload_package/data`) を CLI arg で明示。

**各ステップの成功判定**: 終了コード 0 + stdout に `rows_imported: N (N > 0)` が現れる。
0 なら何かがおかしい（legacy データのパス・権限・schema）、止めて調査。

### トラブルシューティング

| 症状 | 原因候補 | 対処 |
|---|---|---|
| `DATABASE_URL is required` | env 未設定 | §1 を再実行 |
| `permission denied` | DB user に権限なし | `sudo -u postgres psql ikimon_v2 -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ikimon_v2;"` |
| `rows_imported: 0` | legacy data path が違う | `LEGACY_DATA_ROOT` を `/var/www/ikimon.life/data` で確認 |
| `duplicate key violation` | 既存 record と衝突 | 既存行を見る。必要なら `DELETE FROM users WHERE id NOT IN (...) ;` で clear 後 retry（destructive 注意） |
| DB connection timeout | pg server 負荷 | `sudo systemctl restart postgresql` 前に service status 確認 |

---

## 3. 取り込み完遂確認

```bash
# DB 実測
sudo -u postgres psql ikimon_v2 -c "
select (select count(*) from users) as users,
       (select count(*) from occurrences) as occurrences,
       (select count(*) from visit_track_points) as track_points,
       (select count(*) from identifications) as identifications,
       (select count(*) from evidence_assets where asset_role='observation_photo') as photos;
"

# legacy 比較
cat /var/www/ikimon.life/data/users.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('legacy_users:', len(d) if isinstance(d, list) else len(d.get('users', [])))"

# 期待
# DB users >= legacy users × 0.95
# DB track_points > 0
# DB occurrences >= legacy observations × 0.9
```

---

## 3.5 v2 service env (LEGACY_*) を path B に統一

**⚠ 2026-04-23 23:15 追記**: v2 は photo/audio 配信で `process.env.LEGACY_UPLOADS_ROOT`
を使う（`platform_v2/src/routes/legacyAssets.ts:102` 等）。env 未設定だと `/thumb/md/...`
が 404 を返し、観察カードの photo が表示されない。

```bash
# staging v2: /etc/ikimon/staging-v2.env に追加
cat >> /etc/ikimon/staging-v2.env <<EOF
LEGACY_DATA_ROOT=/var/www/ikimon.life/repo/upload_package/data
LEGACY_PUBLIC_ROOT=/var/www/ikimon.life/repo/upload_package/public_html
LEGACY_UPLOADS_ROOT=/var/www/ikimon.life/repo/upload_package/public_html/uploads
EOF
systemctl restart ikimon-v2-staging.service

# production v2: pm2 set で個別更新 (path A の古い値を置換)
pm2 set ikimon-v2-production-api:LEGACY_DATA_ROOT /var/www/ikimon.life/repo/upload_package/data
pm2 set ikimon-v2-production-api:LEGACY_PUBLIC_ROOT /var/www/ikimon.life/repo/upload_package/public_html
pm2 set ikimon-v2-production-api:LEGACY_UPLOADS_ROOT /var/www/ikimon.life/repo/upload_package/public_html/uploads
pm2 restart ikimon-v2-production-api  # --update-env は shell env 汚染ポイントなので付けない
```

検証:
```bash
# サンプル UUID で thumb 配信確認
UUID=$(ls /var/www/ikimon.life/repo/upload_package/public_html/uploads/photos/ | head -1)
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3200/thumb/md/photos/${UUID}/photo_0.webp"
# 期待: 200
```

## 4. `/ops/readiness` で gates + counts を最終確認

```bash
curl -s http://127.0.0.1:3201/ops/readiness | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('status:', d['status'])
print('gates:', json.dumps(d['gates'], indent=2))
print('counts:', json.dumps(d['counts'], indent=2))
"

# 期待
# status: near_ready
# gates: 全 true (特に rollbackSafetyWindowReady: true)
# counts: users >> 9, trackPoints > 0, occurrences > 136
```

---

## 5. 最新 `migration_runs` を確認

```bash
sudo -u postgres psql ikimon_v2 -c "
select run_type, source_name, status, rows_imported, started_at::text
from migration_runs
where run_type like 'bootstrap_%' or run_type = 'legacy_observation_import'
order by started_at desc
limit 10;
"
# 期待: 最新の bootstrap_import が rows_imported > 0 で completed
```

---

## 6. checklist Section E.1 の F0-F2 を PASS に塗る

[`docs/strategy/replacement_final_checklist_2026-04-23.md`](../../docs/strategy/replacement_final_checklist_2026-04-23.md) Section E.1 の:

- F0 `counts.users >= legacy × 0.95` → ✅ PASS
- F1 `counts.trackPoints > 0` → ✅ PASS
- F2 最新 `bootstrap_import.rows_imported > 0` → ✅ PASS

全部 PASS になれば再 cutover GO。

---

## 7. 再カットオーバー実行

```bash
# nginx 設定を v2 cutover スナップショットから復元
cp /etc/nginx/sites-available/ikimon.life.v2-cutover-snapshot /etc/nginx/sites-available/ikimon.life
nginx -t  # syntax ok を確認
systemctl reload nginx

# 即 smoke (ログインしてない curl 視点)
for p in / /home /record /notes /explore /map /lens /guide /learn /about /for-business /contact /healthz /readyz; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://ikimon.life$p")
  printf '%3s  %s\n' "$code" "$p"
done

# 認証ユーザー smoke（ブラウザで自分のアカウントで見る）
# - /home にログイン状態で自分の観察記録が出る
# - /profile で自分のプロフィールが見える
# - /notes で過去の観察が並ぶ
```

**NG 時**: 即 rollback ([`CUTOVER_RUNBOOK.md` §Step R1](../CUTOVER_RUNBOOK.md#step-r1-即時ロールバック-nginx-だけ戻す所要-1-2分)) で戻す。

---

## 8. R1 v2 の再配置確認

R1 (`/for-researcher/apply`, `/learn/methodology` §1.5) は前回 deploy 時に repo 上の
`platform_v2/src/content/...` と `routes/marketing.ts` に反映済。本番 v2 の dist は
既に build 済で pm2 も restart 済なので、**再カットオーバーで自動的に公開される**。

追加作業不要。`curl https://ikimon.life/for-researcher/apply` で 200 が返ること確認。

---

## 9. 24h カナリア観測へ

[`CUTOVER_RUNBOOK.md` §カットオーバー後 24h 監視](../CUTOVER_RUNBOOK.md#カットオーバー後-24h-監視) に従う。

pm2 logs / エラーレート / `compatibility_write_ledger.write_status=failed` を watch。
