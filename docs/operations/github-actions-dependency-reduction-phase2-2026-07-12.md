# GitHub Actions依存削減 Phase 2 — production release

更新日: 2026-07-12

> 2026-07-16 追記: この文書の単一process release記述は履歴情報。現行正本は `ops/deploy/deploy_manifest.json` の `ikimon_production_phase_interface/v1` で、preflight / materialize / deploy / verify を別fresh sandboxで実行する。通常production deployでD1 migrationは実行しない。

## 目的

production releaseをGitHub Actions固有の長大なYAMLから、リポジトリ内の再利用可能なコマンドへ移す。

GitHubは引き続き次を担当する。

- main pushの検知
- exact commit SHAの固定
- production environment承認
- guardrailの実行
- 実行結果の集約
- 失敗時証拠の短期保存

ビルド、Cloudflare preflight、D1 migration、R2 materialization、Worker deploy、post-deploy verificationの実処理は `scripts/run_cloudflare_production_release.sh` を正本とする。

## 今回の変更

### production mutationの対象を限定

`plan_production_release_scope.mjs` が変更ファイルを次へ分ける。

- production runtime: Worker、アプリ、依存関係、D1 migration、wrangler config、materialized UI
- production control plane: workflow、manifest、guard、portable release script
- production影響なし: docs、E2E・unit testだけの変更

control-planeだけの変更ではguardrailを実行するが、Worker、D1、R2を変更しない。

### workflowを2 jobへ縮小

従来は、分類、全pre-flight、quick preflight Artifact生成、Artifact取得、deploy、post-deploy verifyに分かれていた。

新構成は次の2 job。

1. Plan and Guard Production Release
2. Deploy and Verify Cloudflare Production

Artifactによるpreflight受け渡しを廃止し、同じcheckout・同じ依存関係・同じSHAの中でpreflightからdeployまで実行する。

### PR CIとの重複を削減

main merge後のproduction workflowでは、PRで完了済みの全Node/PHPテストを再実行しない。

production jobでは次を維持する。

- deploy/manifest/migration guardrail
- current app build
- Worker typecheck・quick tests・Wrangler dry-run
- exact SHAとdeploy input hashの照合
- D1 migration
- R2 materialization
- guarded Worker deploy
- release identity確認
- public route、PWA、map、record、area、observation detailのpost-deploy verification

## 安全条件

- production deployはmain pushのみ
- workflow_dispatchは追加しない
- production environment gateを維持
- control-plane-only変更でproduction mutationを実行しない
- deploy対象SHAとcheckout SHAの不一致は拒否
- normal releaseでsecretを書き換えない
- VPS SSHを使用しない
- 成功時Artifactは保存しない
- 失敗時証拠だけ3日保存

## 次の段階

Phase 3では、`verify_cloudflare_production_release.sh` の結果を構造化し、Cloudflare側または管理サーバーから同じverificationを定期実行できるようにする。GitHub Actionsは結果の表示と緊急fallbackへさらに寄せる。
