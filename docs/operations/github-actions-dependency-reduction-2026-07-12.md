# GitHub Actions依存削減 — 実装方針と運用

更新日: 2026-07-12

## 判断

GitHub Actions自体を廃止するのではなく、役割を次へ限定する。

- コード・PR・承認・必須チェックの集約
- immutableなcommit SHAとrelease candidateの検証
- production environment承認
- 外部またはportable runnerが返す結果の表示
- 緊急時のフォールバック

ビルド、テスト、Visual QA、Cloudflare配備、証拠生成の実処理は、まずリポジトリ内の再利用可能なコマンドへ移す。これにより、GitHub-hosted runnerが混雑・上限・障害で使えない場合でも、Codex管理PC、管理サーバー、Cloudflare Builds等から同じ処理を再現できる。

## 今回実装した境界

### CI

CI変更範囲分類の正本は `scripts/plan_ci_scope.mjs`。

変更ファイルを以下の面へ分類し、関係するブラウザQAだけを実行する。

- record/upload/auth
- map/place/location
- observation/scene/identification
- shared shell/browser infrastructure/migration/Cloudflare runtime（フル実行）

手動 `workflow_dispatch` はフル実行を維持する。required check名は変更しない。

テスト:

```bash
node --test scripts/tests/plan_ci_scope.tests.mjs
```

### Cloudflare staging

staging releaseの実処理正本:

```text
scripts/run_cloudflare_staging_release.sh
```

GitHub workflowは、SHA固定、release candidate確認、environment承認、portable script呼び出し、結果表示だけを担当する。

preflightのみ:

```bash
CLOUDFLARE_API_TOKEN=... \
DEPLOY_STAGING=false \
TEST_PROFILE=quick \
BROWSER_QA=none \
./scripts/run_cloudflare_staging_release.sh
```

staging deploy（通常）:

```bash
CLOUDFLARE_API_TOKEN=... \
DEPLOY_STAGING=true \
TEST_PROFILE=quick \
BROWSER_QA=none \
./scripts/run_cloudflare_staging_release.sh
```

フルVisual QAを含むrelease evidence:

```bash
CLOUDFLARE_API_TOKEN=... \
V2_PRIVILEGED_WRITE_API_KEY=... \
DEPLOY_STAGING=true \
TEST_PROFILE=full \
BROWSER_QA=full \
./scripts/run_cloudflare_staging_release.sh
```

通常releaseでは既存のstaging secretを再利用する。ローテーション時のみ `SYNC_STAGING_WRITE_SECRET=true` を明示する。

## Artifact運用

通常成功時のPlaywrightログ・画像をGitHub Artifactへ毎回保存しない。

- 失敗時: 3日保存
- 明示的なfull release evidence: 3日保存
- 長期保存が必要なVisual QA: R2等の案件別evidence storeへ移す

これにより、調査に必要な失敗証拠は残しながら、成功runの重複保存を抑える。

## 棚卸し

Actions利用状況は次で機械的に棚卸しできる。

```bash
node scripts/report_github_actions_dependency.mjs \
  --json tmp/actions-dependency.json \
  --markdown tmp/actions-dependency.md
```

レポートは料金推計ではなく、hosted runner job、`npm ci`重複、browser処理、Artifact、deploy処理の集中箇所を見つけるためのもの。

## productionの扱い

production deployは今回移動しない。現行の以下を維持する。

- main mergeのみ
- Cloudflare production environment
- D1 migration
- original UI materialization
- release identity
- health/readiness/runtime SHA一致
- post-deploy smoke

staging portable runnerが安定し、同一SHA・同一preflight・同一postdeploy evidenceを複数回確認した後、productionのビルドとversion uploadをprovider-nativeへ段階移行する。production promotionと最終確認は薄いGitHub gateとして残す。

## Cloudflare Builds移行時の注意

Cloudflare Git integrationはpushを契機にbuild/deployでき、成功buildごとにWorker versionとpreview URLを作成できる。ただし、現行 `wrangler.jsonc` のWorker名とDashboard側Worker名を一致させる必要がある。

IKIMONでは、D1 migrationやproduction traffic promotionを単純なbranch pushへ混ぜない。最初はbuild/version uploadとpreviewまでをCloudflare側へ移し、migration・materialization・production promotionは承認済みrelease commandとして分離する。

参考:

- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- https://developers.cloudflare.com/browser-rendering/

## 次段階の完了条件

1. staging portable releaseがActions内外で同じpreflight reportを生成する。
2. Visual QAの長期証拠がGitHub Artifact以外へ保存できる。
3. Cloudflare Buildsでversion/previewを作成し、現行GitHub deployとrelease identityが一致する。
4. production promotionを移す前にrollback手順と緊急Actions fallbackを実証する。
