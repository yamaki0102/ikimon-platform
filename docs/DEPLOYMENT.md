# Deployment

ikimon.life の本番 deploy は `main` マージ起点の GitHub Actions に一本化する。  
ローカル端末から `git add -A`、`main` への自動 merge、直接 SSH deploy は正規ルートにしない。

## 正規ルート

1. 作業ブランチで変更する
2. lint / test / deploy guardrail を通す
3. PR を作る
4. `main` にマージする
5. GitHub Actions が VPS の deploy script を実行する

## Source of Truth

- deploy manifest: `ops/deploy/deploy_manifest.json`
- server deploy reference: `ops/deploy/production_deploy_reference.sh`
- staging manifest: `ops/deploy/staging_manifest.json`
- staging deploy reference: `ops/deploy/staging_deploy_reference.sh`
- production workflow: `.github/workflows/deploy.yml`
- staging workflow: `.github/workflows/deploy-staging.yml`
- CI guardrail: `scripts/check_deploy_guardrails.ps1`
- manifest/workflow sync check: `scripts/check_deploy_manifest_sync.ps1`
- remote/reference sync check: `scripts/check_remote_deploy_reference.ps1`

## Persistent Paths

以下は deploy 対象ではなく、保護対象:

- `upload_package/data/**`
- `upload_package/config/secret.php`
- `upload_package/config/oauth_config.php`
- `upload_package/config/config.php`

これらは repo の通常変更フローに混ぜない。  
「消さないように注意する」ではなく、「変更を CI で止める」が基本。

VPS 側 deploy script では、上記のうち runtime に存在する `data/` と
`config.php` / `oauth_config.php` / `secret.php` をバックアップしてから
`git reset --hard` を行い、その後に復元する。

## Local Commands

```powershell
php tools/lint.php
composer test
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_manifest_sync.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_staging_manifest_sync.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_remote_deploy_reference.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\pull_production_state_snapshot.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\provision_staging_from_production.ps1
```

## Staging First

改装や大きい UI 変更は、production へ直接入れない。  
必ず次の順にする。

1. production state snapshot をローカルへ取得
2. lightweight staging を production data で初期化
3. staging deploy
4. review
5. production deploy

staging の詳細は `docs/STAGING_RUNBOOK.md` を参照。

## Server Script Reference

repo 外の実体は `/var/www/ikimon.life/deploy.sh` だが、参照実装を repo に置いた。  
サーバ側を変更するときは `ops/deploy/production_deploy_reference.sh` も同時に更新する。

## Legacy Routes

- `deploy.json` + `.agent/workflows/deploy_wsl.php`
- `bash deploy.sh` での自動 commit / push / SSH deploy

このリポジトリでは旧経路として扱う。  
旧入口を踏んでも本番 deploy しないよう、安全側に倒す。
