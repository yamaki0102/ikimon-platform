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
ls /var/www/ikimon.life/repo/upload_package/data/users.json                              # ~33KB
find /var/www/ikimon.life/repo/upload_package/data/observations -name '*.json' | wc -l    # 15 前後
ls /var/www/ikimon.life/repo/upload_package/data/auth_tokens.json                         # あれば
find /var/www/ikimon.life/repo/upload_package/data/trips -name '*.json' 2>/dev/null | wc -l  # trip データ

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

## 1. 本番 DB 向け env を取り出す（production systemd env から）

**罠**: `/etc/ikimon/staging-v2.env` を `source` しない。DATABASE_URL が staging 側に
上書きされる（INC §Side Notes 参照）。production は `/etc/ikimon/production-v2.env` を正本にする。

```bash
export DATABASE_URL="$(python3 -c "
from pathlib import Path
for line in Path('/etc/ikimon/production-v2.env').read_text().splitlines():
    if line.startswith('DATABASE_URL='):
        print(line.split('=', 1)[1])
        break
")"
export V2_PRIVILEGED_WRITE_API_KEY="$(python3 -c "
from pathlib import Path
for line in Path('/etc/ikimon/production-v2.env').read_text().splitlines():
    if line.startswith('V2_PRIVILEGED_WRITE_API_KEY='):
        print(line.split('=', 1)[1])
        break
")"
export LEGACY_DATA_ROOT=/var/www/ikimon.life/repo/upload_package/data
export LEGACY_PUBLIC_ROOT=/var/www/ikimon.life/repo/upload_package/public_html
export LEGACY_UPLOADS_ROOT=/var/www/ikimon.life/repo/upload_package/public_html/uploads

# 確認
echo "DATABASE_URL host: $(echo $DATABASE_URL | sed -E 's|://[^@]+@||; s|/.*||')"
echo "DATABASE_URL db:   $(echo $DATABASE_URL | sed -E 's|.*/||')"
# => host: 127.0.0.1:5432 / db: ikimon_v2 (本番)
```

**絶対 NG**: `/etc/ikimon/staging-v2.env` を読み込んだ shell で作業すること
（staging の DATABASE_URL が効く）

---

## 2. bootstrap import 順次実行（所要 10-30 分）

`LEGACY_DATA_ROOT` / `LEGACY_PUBLIC_ROOT` / `LEGACY_UPLOADS_ROOT` を正本として使う。
CLI arg は一時的な上書き用で、通常運用では不要。

```bash
cd /var/www/ikimon.life/repo/platform_v2
CORRECT_ROOT=/var/www/ikimon.life/repo/upload_package/data

# 順序重要: legacy -> plan -> observations -> evidence -> identifications -> conditions -> tokens -> tracks
export LEGACY_DATA_ROOT=$CORRECT_ROOT
export LEGACY_PUBLIC_ROOT=/var/www/ikimon.life/repo/upload_package/public_html
export LEGACY_UPLOADS_ROOT=/var/www/ikimon.life/repo/upload_package/public_html/uploads
npm run import:legacy
npm run import:plan:observations
npm run import:observations
npm run import:observations:evidence
npm run import:observations:identifications
npm run import:observations:conditions
npm run import:remember-tokens
npm run import:tracks
```

**想定される counts (2026-04-23 実測値)**:
- users: 77（orphan 補完込）
- observations: **6530**
- visits: 6573
- trackPoints: **5725**

これ未満で import が終わるなら path A の古いスナップショットを使っている可能性。
`LEGACY_DATA_ROOT=/var/www/ikimon.life/repo/upload_package/data` を確認する。

**各ステップの成功判定**: 終了コード 0 + stdout に `rows_imported: N (N > 0)` が現れる。
0 なら何かがおかしい（legacy データのパス・権限・schema）、止めて調査。

### トラブルシューティング

| 症状 | 原因候補 | 対処 |
|---|---|---|
| `DATABASE_URL is required` | env 未設定 | §1 を再実行 |
| `permission denied` | DB user に権限なし | `sudo -u postgres psql ikimon_v2 -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO ikimon_v2;"` |
| `rows_imported: 0` | legacy data path が違う | `LEGACY_DATA_ROOT` が `/var/www/ikimon.life/repo/upload_package/data` か確認 |
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
cat /var/www/ikimon.life/repo/upload_package/data/users.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('legacy_users:', len(d) if isinstance(d, list) else len(d.get('users', [])))"

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

# production v2: /etc/ikimon/production-v2.env を正本として active/inactive runtime を restart
grep -q '^LEGACY_DATA_ROOT=/var/www/ikimon.life/repo/upload_package/data$' /etc/ikimon/production-v2.env
grep -q '^LEGACY_PUBLIC_ROOT=/var/www/ikimon.life/repo/upload_package/public_html$' /etc/ikimon/production-v2.env
grep -q '^LEGACY_UPLOADS_ROOT=/var/www/ikimon.life/repo/upload_package/public_html/uploads$' /etc/ikimon/production-v2.env
systemctl restart ikimon-v2-blue.service || true
systemctl restart ikimon-v2-green.service || true
```

検証:
```bash
# サンプル UUID で thumb 配信確認
UUID=$(ls /var/www/ikimon.life/repo/upload_package/public_html/uploads/photos/ | head -1)
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3201/thumb/md/photos/${UUID}/photo_0.webp"
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

journalctl / エラーレート / `compatibility_write_ledger.write_status=failed` を watch。
