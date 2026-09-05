# Staging Runbook

ikimon.life は **Cloudflare staging先行** で昇格する。
現行公開面のstaging正本はCloudflare Workerであり、VPS stagingはlegacy integration専用。

## 目的

- 本番データを消さない
- production DB/R2を変更せず、非productionのD1/R2/Queueで確認する
- required checks済みの同一commit SHAをstagingへ配置する
- 本番 deploy 前に `staging -> review -> production` の順に固定する

## Current Cloudflare Staging

### Production

- Worker: `ikimon-life-cloudflare-prod`
- public URL: `https://zukan.earth/`

### Staging

- Worker: `ikimon-life-cloudflare-staging`
- public URL: `https://staging.zukan.earth/`
- D1: `ikimon_shadow_core`, `ikimon_shadow_observations_2026_06`
- R2: `ikimon-shadow-media`
- Queue: `ikimon-staging-media-jobs`
- workflow: `.github/workflows/deploy-cloudflare-staging.yml`
- manifest: `ops/deploy/staging_manifest.json`

通常入口:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\release_autopilot.ps1 -Paths <paths> -CommitMessage "<message>" -Title "<title>"
```

手動dispatchが必要な場合もbranch名だけでdeployしない。PR headの40文字SHAを固定する。

```powershell
gh workflow run deploy-cloudflare-staging.yml --ref main -f branch=<codex-branch> -f commit_sha=<40-char-sha> -f deploy_staging=true -f test_profile=full
```

実deployは対象SHAのopen・non-draft PRと `Quality Gate`、`Record Funnel Browser QA`、
`Ai Review Gate` の成功を、`main` からcheckoutしたrelease controlでworkflow内でも再確認する。
feature branchのpushではこのworkflowを起動しない。staging全体で1本ずつ実行し、途中cancelしない。

## Secretless Renri Browser QA Surface

連理イベント導線の通常のVisual QAは、staging Workerに固定した合成面を使える。
入口・安全境界・証拠項目は
[`docs/operations/renri_synthetic_browser_qa_surface_2026-07-17.md`](operations/renri_synthetic_browser_qa_surface_2026-07-17.md)
を正本とする。

- `GET /__ops/browser-qa/renri/manifest.json`
- `GET /__ops/browser-qa/renri/join`
- `GET /__ops/browser-qa/renri/rally`
- `GET /__ops/browser-qa/renri/live`
- `GET /__ops/browser-qa/renri/recap`

この面は `ENVIRONMENT=staging` のときだけ応答し、query、未登録path、GET/HEAD以外を404にする。
D1、R2、Queue、認証、Cookie、位置情報、顧客データ、実投稿APIを使わず、外部asset・analyticsも読み込まない。
したがってread-only Browser Runnerにsecretを渡さず、最低6 viewportのlayout、console、failed request、
accessibility smoke、入力保持、error、操作結果を検証できる。

これは合成Visual/interaction QAであり、実データ、実ログイン、実端末、現地、人による確認、
本番導線のread-only smokeを置き換えない。

## Legacy VPS Staging Lane

以下は旧PHP/PostgreSQL integrationの調査・退役作業だけに使う。通常のCloudflare promotionでは
実行せず、VPS SSH、production secret複製、`/var/www/ikimon.life-staging`を要求しない。

## Legacy VPS 実行順

### 1. 本番 snapshot をローカルへ取得

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pull_production_state_snapshot.ps1
```

生成先:

- `_archive/prod_state_snapshots/<timestamp>/prod_state_manifest.json`
- `_archive/prod_state_snapshots/<timestamp>/data_latest.tar.gz`
- `_archive/prod_state_snapshots/<timestamp>/nginx_ikimon.life.conf`
- `_archive/prod_state_snapshots/<timestamp>/remote_deploy.sh`

### 2. staging を初期化

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\provision_staging_from_production.ps1
```

この処理で次を行う。

- production repo と同じ origin を持つ staging repo を作る
- production data を staging data に rsync
- production uploads を staging persistent/uploads に rsync
- config.php / oauth_config.php / secret.php を staging に複製
- internal staging nginx site と public proxy vhost を追加
- certbot が使える場合は staging 用 TLS 証明書を取得して HTTPS 化
- staging deploy script を配置
- 初回 health check を実行

### 3. staging に deploy

手動:

```powershell
ssh ikimon-vps "STAGING_BRANCH=staging /var/www/ikimon.life-staging/deploy.sh"
```

または GitHub Actions:

- workflow: `Deploy to Staging`
- branch input: 既定は `staging`。review 用に別ブランチを出したいときだけ上書きする

## Legacy VPS Guardrails

- production data は repo 変更フローに混ぜない
- `staging` branch は staging deploy の入口として残すが、feature queue にしない
- `staging` branch に独自差分を積む場合は短期 review 目的に限定し、review 後は `main` 追従へ戻す
- staging public root は `platform_v2`、PHP lane は `/legacy/` に固定する
- staging は `8081` / `3200` で内部 listen するが、公開面は `noindex + basic auth` に留める
- staging platform の process manager は `pm2` ではなく `ikimon-v2-staging.service` に固定する
- staging platform の DB 接続は peer auth ではなく `V2_STAGING_DATABASE_URL` に固定する
- uploads は repo 配下でなく `persistent/uploads` に置く
- deploy runtime backup の一時dirは `${STAGING_DEPLOY_BACKUP_ROOT:-/var/www/ikimon.life-staging/persistent/deploy-tmp}` を使い、`/tmp` 容量に依存させない
- `upload_package/data/library/` は staging の未追跡/生成物置き場として `git reset --hard` 後もその場に残す。deploy runtime backup では複製しない
- 本番 deploy 前に staging で UI / data / health check を通す

## Legacy VPS Branch Policy

`staging` は長期作業を貯めるブランチではなく、production-like review を行うための
deploy selector。通常の作業は `codex/<task-name>` から `main` へ PR し、必要なときだけ
GitHub Actions の `Deploy to Staging` で review branch を指定する。

`origin/staging` は staging workflow の既定入力として残す。ただし、`main` から長期に
乖離させない。staging 固有の修正が必要な場合は、原因を PR に書き、main へ取り込むか
破棄するかを review 後に決める。

## Legacy VPS staging secrets

- `V2_STAGING_DATABASE_URL` — `postgresql://<app-role>:<password>@127.0.0.1:5432/ikimon_v2_staging`
- `STAGING_BASIC_AUTH_USER` — Playwright verify-e2e 用
- `STAGING_BASIC_AUTH_PASS` — Playwright verify-e2e 用
- `V2_PRIVILEGED_WRITE_API_KEY` — authority gate と browser E2E fixture 用

## Legacy VPS verify

staging platform の正常系確認は以下を canonical とする。

```bash
sudo systemctl is-active ikimon-v2-staging.service
sudo test -f /etc/ikimon/staging-v2.env
grep '^DATABASE_URL=' /etc/ikimon/staging-v2.env
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3200/healthz
```

### Release gate: public map snapshot alert lifecycle

本番昇格前の release rehearsal では、GitHub Actions `Deploy to Staging` を
`verify_level=full` で実行する。full verify は `public_map_snapshot_alert_lifecycle`
gate として、staging DB の `public_map_snapshots.generated_at` を一時的に古くし、
stale alert 発火、`/ops/public-map-snapshot`、refresh 後の自動 resolve まで確認する。

手動で同じ gate を通す場合:

```bash
set -a
. /etc/ikimon/staging-v2.env
set +a
runuser -u ikimon-staging -- env \
  "DATABASE_URL=${DATABASE_URL}" \
  "PLATFORM_BASE_URL=http://127.0.0.1:3200" \
  "V2_BASE_URL=http://127.0.0.1:3200" \
  "IKIMON_OPS_STALENESS_WEBHOOK_URL=${IKIMON_OPS_STALENESS_WEBHOOK_URL:-}" \
  bash -lc "cd /var/www/ikimon.life-staging/repo/platform_v2 && npm run smoke:public-map-snapshot-alert -- --apply --confirm=public-map-snapshot-staging-smoke --base-url=http://127.0.0.1:3200 --allow-local"
```

この smoke は staging DB を意図的に変更する。`--confirm=public-map-snapshot-staging-smoke`
と `--allow-local` は外さない。production host には向けない。

## Legacy VPS 固定IPバイパス

固定回線からだけ `401` を外したい場合は、Basic Auth 自体は残したまま allowlist で迂回する。

対象ファイル:

- `/etc/nginx/ikimon-staging-allowlist.conf`

初期状態では `scripts/provision_staging_from_production.ps1` が空の雛形を配置する。

例:

```nginx
allow 203.0.113.10;
allow 198.51.100.0/24;
```

反映:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

ルール:

- 許可したIPからは `staging.ikimon.life` でも `401` なしで入れる
- allowlist に入っていないアクセスは従来どおり Basic Auth を要求する
- 動的IP回線は不向き。固定IPか CIDR が確定している回線だけ入れる

## Legacy VPS 既知の注意点

- staging は production の secret を複製するため、OAuth や外部 API は production と同じ資格情報を使う
- そのため staging では `通知送信`, `外部共有`, `実ユーザーへの招待` を乱発しない
- 追加で副作用を切る場合は、別途 `staging overrides` を実装する
- 一部の PHP ページは `HEAD` で `500` を返すため、health check は `curl -s -o /dev/null -w "%{http_code}" <url>` のような `GET` ベースで確認する
- staging では `Google Analytics` と `service worker` を止める。レビュー流入の汚染と PWA キャッシュ混線を避けるため

## Legacy VPS debugging reminders

- `https://staging.ikimon.life/` 配下は `platform_v2` (`127.0.0.1:3200`) が primary。`https://staging.ikimon.life/legacy/` 配下が PHP lane (`127.0.0.1:8081`)。
- `/v2/` は旧構成の名残。現行 staging では root が v2 なので、`/v2` 前提で原因を追うと見当違いになりやすい。
- `pm2 ikimon-v2-staging-api` は旧運用。staging v2 の正式な監視対象は `ikimon-v2-staging.service`。
- `E:\Projects\03_ikimon.life_Product\web_site` は実体ではなく `E:\Projects\Playground\upload_package\public_html` への junction。修正対象と deploy 対象を取り違えないこと。
- まず「どの lane の不具合か」「ローカル修正済みか」「staging 未deploy か」を 3 点確認してから手を入れる。
