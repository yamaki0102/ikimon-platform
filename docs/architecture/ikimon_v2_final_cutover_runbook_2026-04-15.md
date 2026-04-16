# ikimon v2 Final Cutover Runbook (2026-04-15)

> このファイルは本番 `ikimon.life` の UI を v2 に切り替える **最終直前** の実行手順書。
> Claude Code / 運用者が上から順に実行することを想定。**Step F (flip) は明示許可後のみ**。
> 失敗時は Step R (rollback) を即時実行。

## Quick status (2026-04-15 23:45)

| 項目 | 状態 |
|---|---|
| staging `/` | 🟢 v2 field-note-first (title: `歩いて、見つけて、ノートに残す`) |
| staging `/legacy/` | 🟢 PHP rollback lane (archive) |
| Security findings (CSO v2 audit) | 🟢 3/3 closed (commit 5289a55c) |
| Design findings (design-review v0.17) | 🟢 10/10 closed (commit 5af2aa78) |
| Goodwill Reservoir (Krug) | 🟢 80/100 (from 55) |
| Trunk Test | 🟢 PASS 6/6 (search 追加で partial → pass) |
| Touch targets | 🟢 44px min across nav + lang switch |
| Cutover gate | 🟢 **Flip GO** (D-1/D-2 の DB 方針決定のみ残) |
| PR | `feat/v2-top-production-redesign` → `main` open |

---

## 0. Security pre-flight (必須 — all PASS before Step F)

CSO 監査で上げた 3 件が cutover gate。それぞれ repo 側は commit 5289a55c で対処済。本番環境側で追加確認:

- [ ] **Finding 1 (IDOR)**: 本番 pm2 の env に `ALLOW_QUERY_USER_ID` が含まれていない
  ```bash
  # VPS
  pm2 env ikimon-v2-production-api 2>/dev/null | grep ALLOW_QUERY_USER_ID
  # expected: empty output (env not set)
  ```
  もし production pm2 unit が未作成なら、起動前に `ALLOW_QUERY_USER_ID` を ecosystem.config.js / systemd EnvironmentFile に入れない。
- [ ] **Finding 2 (workflow injection)**: main の `deploy.yml` も同じ branch input pattern を持つなら、`deploy-staging.yml` の fix を backport 済 (PR で並走)。本番が `git push origin main` でのみ発火するなら risk は workflow_dispatch に限定。
- [ ] **Finding 3 (MapLibre SRI)**: `https://ikimon.life/` を開いて dev tools で `maplibre-gl.js` リクエスト見て、integrity attribute が設定されている。CDN 応答の `Access-Control-Allow-Origin` が valid なこと (crossOrigin=anonymous で CORS 強制)。

どれか NG → **Step F へ進まない**。

---

## 1. 現在地 (2026-04-15 時点)

### 完了済み

| # | 項目 | 状態 | 証跡 |
|---|---|---|---|
| 1 | v2 コード (field-note-first + identification 混在ノート) を `feat/v2-top-production-redesign` に集約 | ✅ | HEAD = この branch |
| 2 | staging nginx 一本化 reference conf (`/` → v2, `/legacy/` → PHP) | ✅ | `ops/deploy/staging_ikimon_life_tls_reference.conf` |
| 3 | 本番用 cutover nginx conf | ✅ (既存) | `platform_v2/ops/nginx/ikimon.life-v2-cutover.conf` |
| 4 | 切替 + スナップショット + rollback スクリプト | ✅ (既存) | `platform_v2/scripts/ops/{switch_public_nginx_to_v2,snapshot_cutover_state,rollback_public_nginx_to_legacy}.sh` |
| 5 | Day-0 公開 smoke スクリプト | ✅ (既存) | `platform_v2/scripts/ops/run_day0_public_smoke.sh` |
| 6 | CI: feature branch push は本番 deploy を発火しない | ✅ | `deploy.yml` は `branches: [main]` のみ |
| 7 | Deploy to Staging workflow (PHP lane + v2 rebuild + verify) | ✅ | `.github/workflows/deploy-staging.yml` run 24428899355 green |
| 8 | staging.ikimon.life/v2/ に新 UI (field-note-first) が反映済 | ✅ | curl 確認: title "歩いて、見つけて、ノートに残す" |
| 9 | staging /v2/{notes,lens,scan,map} 全て 200 | ✅ | curl 確認 |
| 10 | v2 サービスマネージャ = pm2 `ikimon-v2-staging-api` | ✅ | Actions log: "Restarted via pm2" |

### 未完了 / 人間確認が必要

| # | 項目 | 確認方法 | 対応 |
|---|---|---|---|
| A | staging 公開 URL の /v2/ を basic auth 経由でブラウザ確認 (ビジュアル QA) | `https://staging.ikimon.life/v2/` (user: staging / pass: `uceALmREqM8JAnZHhwhJ`) | Step A 参照 |
| B | staging nginx を 2 スタック構成 (`/v2/` + `/`) から新構成 (`/` → v2, `/legacy/` → PHP) に切替 | VPS で nginx conf 差替 | Step B 参照 |
| C | 本番 v2 が本当に port 3200 で動いているか、`ikimon_v2_staging` DB で動いているか | VPS で `systemctl`/`pm2 list` + `psql \l` 確認 | Step C 参照 |
| D | 本番 DB を `ikimon_v2` に切り替えるのか、staging DB で archive mode (read-only に近い) 運用か方針確定 | 設計判断 | 未解決 — **Step E-7 の go/no-go で人間判断** |
| E | production shadow verify (本番データで parity 確認) | `npm run verify:production-shadow` 実行 | Step E 参照 |
| F | **本番 nginx flip** — `switch_public_nginx_to_v2.sh` 実行 | ユーザー明示許可後のみ | Step F 参照 (**実行しない**) |

---

## A. ブラウザでの staging 視覚 QA (必須)

ログイン済み状態での identifications カード混在 / マップ表示 / フィールドノートメイン / ambient community を人間の目で確認する。

```
https://staging.ikimon.life/v2/           (top)
https://staging.ikimon.life/v2/notes       (field note main — 観察 + 同定)
https://staging.ikimon.life/v2/lens        (AIレンズ supporting)
https://staging.ikimon.life/v2/scan        (フィールドスキャン supporting)
https://staging.ikimon.life/v2/map         (MapLibre)
```

Basic Auth:
- user: `staging`
- pass: `uceALmREqM8JAnZHhwhJ`

チェック項目:
1. Hero `歩いて、見つけて、ノートに残す。` + 第一 CTA「続きを書く / ノートを始める」
2. Quick nav chips 6 個、先頭が 📖 フィールドノート
3. メイン "📖 あなたのフィールドノート" が full-width、視覚的に最大
4. ログイン時: `myFeed` に 📷 観察 / 📝 同定 バッジ混在
5. `/map` が MapLibre タイル + dots を表示
6. AIレンズ・フィールドスキャン カードがノートより明確に小さい

**不合格なら Step F に進まない**。

---

## B. staging nginx 構成を v2 primary / PHP legacy に切替 (任意、Step F 前でなくても可)

現在の staging nginx は `/v2/` + `/` 構成。repo には新 conf (`/` → v2, `/legacy/` → PHP) を置いてある。切替したい場合のみ実施 (本番 cutover 自体には不要)。

```bash
# SSH to VPS
cp /var/www/ikimon.life-staging/repo/ops/deploy/staging_ikimon_life_tls_reference.conf \
   /etc/nginx/sites-available/staging.ikimon.life
nginx -t
systemctl reload nginx
# smoke
curl -s -o /dev/null -w "%{http_code}\n" -u staging:uceALmREqM8JAnZHhwhJ https://staging.ikimon.life/
curl -s -o /dev/null -w "%{http_code}\n" -u staging:uceALmREqM8JAnZHhwhJ https://staging.ikimon.life/legacy/
```

期待: 両方 200。`/` が v2、`/legacy/` が PHP。

---

## C. v2 サービスの健全性チェック (SSH)

```bash
# Service manager
pm2 list | grep ikimon-v2-staging-api
# expect: online

# Port
ss -tlnp | grep ':3200 '

# DB
sudo -u postgres psql -c '\l' | grep ikimon
# expect at least: ikimon_v2_staging (present), ikimon_v2 (may or may not exist)

# Env of the running process
pm2 env ikimon-v2-staging-api | grep -E "DATABASE_URL|APP_BASE_PATH|NODE_ENV"
```

**確認**:
- DATABASE_URL が `ikimon_v2_staging` を指しているか
- 本番差し替え時に `ikimon_v2` に向ける必要があるかを step D で判断

---

## D. 本番 DB の扱いを確定 (go/no-go 前に判断)

選択肢:

**D-1. staging DB で archive mode** (現状ままで flip)  
- 本番アクセスが staging DB を叩く
- `ikimon_v2_staging` は本番データ同期 (shadow cycle 済) なので実害は限定的
- write は PHP legacy 側に回す / または v2 write は一時停止
- **リスク**: staging と本番の DB が実質同じ → staging での実験がすぐ本番に影響

**D-2. production DB (`ikimon_v2`) を事前 bootstrap + 別サービスで起動**  
- `ikimon_v2` DB を dump from shadow で作る
- 別 pm2 unit (`ikimon-v2-production-api`) を別ポート (例 3201) で起動
- 本番 nginx は 3201 に向ける
- **リスク**: 作業量増 + staging で検証できないパス

cutover scripts は `PUBLIC_RUNTIME_PORT` で切替先 port を指定できる。
- D-1: `PUBLIC_RUNTIME_PORT=3200`
- D-2: `PUBLIC_RUNTIME_PORT=3201`

**ユーザーが D-1 / D-2 のどちらを選ぶか確定し、対応する `PUBLIC_RUNTIME_PORT` を決めるまで Step F に進まない**。

---

## E. 本番切替前 pre-flight (全部 PASS が必要)

SSH で実行:

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2

# 1. Shadow verify (parity)
sudo -u postgres env DATABASE_URL='postgresql:///ikimon_v2_shadow?host=%2Fvar%2Frun%2Fpostgresql' \
  npm run verify:production-shadow

# 2. Smoke read + write lanes
npm run smoke:v2-read-lane
npm run smoke:v2-write-lane

# 3. Readiness
PUBLIC_RUNTIME_PORT=3201 curl -s http://127.0.0.1:3201/ops/readiness | jq .status
# expect: "near_ready" or "ready"

# 4. Dry-run flip
PUBLIC_RUNTIME_PORT=3201 bash scripts/ops/switch_public_nginx_to_v2.sh --dry-run --label=prelive-dryrun-$(date +%Y%m%d%H%M)
# expect: "dry-run ok"

# 5. Rollback rehearsal from the latest dry-run snapshot
LATEST=$(ls -1t /var/www/ikimon.life-staging/cutover-snapshots/ | head -1)
bash scripts/ops/rollback_public_nginx_to_legacy.sh "/var/www/ikimon.life-staging/cutover-snapshots/$LATEST" --dry-run 2>&1 || true
# (実 rollback は flip 後にのみ意味があるが、スクリプトの存在と引数解釈を確認)

# 6. Production health pre-flip (PHP は今も live)
curl -sfS https://ikimon.life/index.php | grep -q ikimon && echo "PHP live OK"

# 7. go/no-go ← 人間判断
#    - ビジュアル QA (Step A) PASS
#    - D-1 or D-2 確定
#    - 上記 1-6 all green
#    - 切替窓 (低トラフィック時間) 合意済
```

---

## F. 本番 flip ← **ここで停止**

**このセクションのコマンドは Claude は自動実行しない**。
ユーザー明示許可後、ユーザーまたは運用者が SSH で実行する。

```bash
# VPS, as root
cd /var/www/ikimon.life-staging/repo/platform_v2/scripts/ops
LABEL="live-cutover-$(date +%Y%m%d%H%M)"
PUBLIC_RUNTIME_PORT=3201 bash switch_public_nginx_to_v2.sh --label="$LABEL"
# 想定出力:
#   mode: archive-active
#   public runtime target: v2 (127.0.0.1:3201)
#   legacy php role: rollback/archive artifact only
#   /var/www/ikimon.life-staging/cutover-snapshots/<LABEL>

# 即時 smoke
FIXTURE_PREFIX="$LABEL" bash run_day0_public_smoke.sh
```

**flip 直後の Go/No-Go (<= 5 分以内)**:

| Check | Pass 条件 |
|---|---|
| `curl -sfS https://ikimon.life/healthz` | 200 |
| `curl -sfS https://ikimon.life/ -H 'Accept: text/html' \| grep -q フィールドノート` | match |
| `curl -sfS https://ikimon.life/notes -H 'Accept: text/html'` | 200 |
| `curl -sfS https://ikimon.life/map -H 'Accept: text/html'` | 200 |
| Day-0 smoke exit code | 0 |
| 5xx 率 (tailnginx log) | < 1% |

**いずれか fail → 即 Step R**。

---

## R. Rollback (flip が失敗した時)

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2/scripts/ops
# LABEL は Step F で使ったもの
bash rollback_public_nginx_to_legacy.sh /var/www/ikimon.life-staging/cutover-snapshots/$LABEL

# smoke
curl -sfS https://ikimon.life/index.php | grep -q ikimon && echo "rollback OK"
```

復旧想定: `https://ikimon.life/` が PHP トップを返す。uploads は persistent から配信継続。

---

## G. post-cutover todos (flip 後、別スプリント)

- **フィールドノートの実体化**: `/notes` を「場所×時間の1冊」として完成 (月別、PDF 出力、公開 URL)
- **AIレンズ実装**: /record upload → AI 候補 → note 直書込
- **マップ拡張**: クラスタリング、自分の足跡、scan ヒートマップ
- **`/v2/` プレフィックス履歴の 301**: 古いリンクを新 `/` に寄せる
- **本番 v2 用 DB bootstrap** (D-2 に移行する場合)
- **crontab**: `run_production_shadow_cycle.sh` 等が cutover 後も適切に動くか確認

---

## H. 停止ポイントの明示

Claude はこの runbook を最後まで書いた時点で停止する。
`bash switch_public_nginx_to_v2.sh --label=live-cutover-...` は **人間が明示的に Go を出した後でのみ実行する**。

Go 条件の最終確認:
- [ ] Step A (ブラウザ視覚 QA) PASS
- [ ] Step C (サービス健全性) PASS
- [ ] Step D (DB 方針 D-1 / D-2 のどちらか確定)
- [ ] Step E.1-6 全て green
- [ ] Step E.7 (人間判断) OK
- [ ] rollback 手順 (Step R) をオペレーターが読了
- [ ] 低トラフィック時間帯に入った (推奨: JST 03:00-05:00)

一つでも NG なら flip しない。
