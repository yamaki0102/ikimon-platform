# Staging Runbook

ikimon.life の改装は **staging 先行** に切り替える。  
本番を直接触らず、まず `軽い public staging` で本番状態を再現する。

## 目的

- 本番データを消さない
- 改装前に本番状態をローカルへ snapshot する
- 本番とほぼ同じデータ・設定で staging を確認する
- 本番 deploy 前に `staging -> review -> production` の順に固定する

## 構成

### Production

- app root: `/var/www/ikimon.life`
- public URL: `https://ikimon.life/`

### Staging

- app root: `/var/www/ikimon.life-staging`
- internal PHP lane: `127.0.0.1:8081`
- internal v2 lane: `127.0.0.1:3200`
- formal public access: `https://staging.ikimon.life/`
- fallback review URL: `https://staging.162-43-44-131.sslip.io/`
- protection: `noindex + basic auth`
- local resolution: formal staging は DNS 運用、`sslip.io` は fallback

基本アクセス:

```text
https://staging.ikimon.life/
```

認証情報は `_archive/staging_access/staging_access_latest.txt` に保存する。

## Source of Truth

- staging manifest: `ops/deploy/staging_manifest.json`
- staging deploy reference: `ops/deploy/staging_deploy_reference.sh`
- staging nginx reference: `ops/deploy/staging_nginx_local_reference.conf`
- staging nginx tls reference: `ops/deploy/staging_nginx_tls_reference.conf`
- staging workflow: `.github/workflows/deploy-staging.yml`
- production snapshot pull: `scripts/pull_production_state_snapshot.ps1`
- staging provision: `scripts/provision_staging_from_production.ps1`

## 実行順

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

## Guardrails

- production data は repo 変更フローに混ぜない
- staging public root は `platform_v2`、PHP lane は `/legacy/` に固定する
- staging は `8081` / `3200` で内部 listen するが、公開面は `noindex + basic auth` に留める
- uploads は repo 配下でなく `persistent/uploads` に置く
- 本番 deploy 前に staging で UI / data / health check を通す

## 既知の注意点

- staging は production の secret を複製するため、OAuth や外部 API は production と同じ資格情報を使う
- そのため staging では `通知送信`, `外部共有`, `実ユーザーへの招待` を乱発しない
- 追加で副作用を切る場合は、別途 `staging overrides` を実装する
- 一部の PHP ページは `HEAD` で `500` を返すため、health check は `curl -s -o /dev/null -w "%{http_code}" <url>` のような `GET` ベースで確認する
- staging では `Google Analytics` と `service worker` を止める。レビュー流入の汚染と PWA キャッシュ混線を避けるため

## Debugging reminders

- `https://staging.ikimon.life/` 配下は `platform_v2` (`127.0.0.1:3200`) が primary。`https://staging.ikimon.life/legacy/` 配下が PHP lane (`127.0.0.1:8081`)。
- `/v2/` は旧構成の名残。現行 staging では root が v2 なので、`/v2` 前提で原因を追うと見当違いになりやすい。
- `E:\Projects\03_ikimon.life_Product\web_site` は実体ではなく `E:\Projects\Playground\upload_package\public_html` への junction。修正対象と deploy 対象を取り違えないこと。
- まず「どの lane の不具合か」「ローカル修正済みか」「staging 未deploy か」を 3 点確認してから手を入れる。
