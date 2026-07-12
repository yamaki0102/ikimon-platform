# GitHub Actions依存削減 Phase 3 — 本番検証証拠と外部実行

更新日: 2026-07-12

## 目的

production検証をGitHub Actionsのjob logだけに閉じ込めず、管理PC・管理サーバーから同じ検証を実行し、構造化JSONとGitHub commit statusへ集約できるようにする。

このPhaseは本番Worker、D1、R2、DNS、Secretsを変更しない。読み取り専用の検証と結果報告のみを追加する。

## portable command

通常監視はtargeted検証を使う。

```bash
SMOKE_TIER=targeted \
PUBLISH_GITHUB_STATUS=false \
  bash scripts/run_production_verification_watch.sh
```

production runtime endpointから現在の40文字SHAを取得し、既存の`verify_cloudflare_production_release.sh`をそのSHAへ固定して実行する。

## 生成物

- `platform_v2/cloudflare_shadow/.deploy/production-verification-latest.json`
- `platform_v2/cloudflare_shadow/.deploy/production-verification-latest.log`
- `platform_v2/cloudflare_shadow/.deploy/production-runtime-version-latest.json`

JSONには以下だけを保存する。

- 成否、exit code、開始・終了・所要時間
- expected SHAとactual SHAの一致
- 実行した検証フェーズ
- HTTP endpointのstatus
- Worker version、UI bundle hash等の公開release identity
- logのSHA-256、bytes、line数

個人情報、Cookie、API token、response body全体は保存しない。

## GitHubへの結果集約

外部runnerで以下を設定すると、対象production SHAへ`ikimon/production-verification` statusを投稿する。

```bash
export GITHUB_REPOSITORY=yamaki0102/ikimon-platform
export GITHUB_TOKEN='repository status write token'
export PUBLISH_GITHUB_STATUS=true
bash scripts/run_production_verification_watch.sh
```

同じcontext・state・description・target URLが既に存在する場合は再投稿しない。15分間隔で動かしてもGitHub statusを無制限に増やさない。

tokenはrepoへ保存しない。管理サーバーでは`/etc/ikimon/production-verification.env`等のroot管理ファイルを使用する。

## systemd template

- `ops/monitoring/systemd/ikimon-production-verification.service`
- `ops/monitoring/systemd/ikimon-production-verification.timer`

テンプレートは`/opt/ikimon/ikimon-platform`と実行ユーザー`ikimon`を前提とする。実環境に合わせてpathとuserを変更し、timerを有効化する。

```bash
sudo install -m 0644 ops/monitoring/systemd/ikimon-production-verification.service /etc/systemd/system/
sudo install -m 0644 ops/monitoring/systemd/ikimon-production-verification.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ikimon-production-verification.timer
```

## production releaseとの統合

production release後の検証もwatch wrapperを経由する。これにより、Actions実行時と外部runner実行時で同じJSON schemaを使う。

production workflowはbest-effortでcommit statusを投稿する。status API障害で本番配備を失敗扱いにはしないが、verification本体の失敗は従来どおりreleaseを失敗させる。

## 運用境界

- targeted: 15分間隔のread-only監視向け。Playwrightを起動しない。
- full: production release直後または明示的な重点確認向け。観察詳細のPlaywrightを含む。
- 定期監視はGitHub Actions scheduleへ戻さない。
- 履歴証拠を残す場合は管理サーバーまたはR2へ14日程度保存し、GitHub Artifactを通常保存先にしない。
