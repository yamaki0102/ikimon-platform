# Deploy Autopilot 実装計画

**目標**: dirty な長期作業ツリーや対話認証に依存せず、最新 `origin/main` から PR、Cloudflare staging、required checks、production deploy までを再開可能な1コマンド運用にする。

**アーキテクチャ**: 作業開始時に task 専用 worktree を作り、release 時は明示パスだけを commit/push する。GitHub CLI は Windows の資格情報ストアを非対話利用し、staging と required checks が成功した場合だけ、明示的な `-PromoteProduction` で auto-merge と production workflow 監視へ進む。

**影響範囲**:

- `scripts/new_release_worktree.ps1`
- `scripts/release_autopilot.ps1`
- `scripts/check_release_candidate.ps1`
- `scripts/release_automation_lib.ps1`
- `scripts/tests/release_automation.tests.ps1`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-cloudflare-staging.yml`
- `.github/workflows/deploy.yml`
- `ops/deploy/staging_manifest.json`
- `docs/DEPLOYMENT.md`
- `AGENTS.md`

## 検証基準

- [x] `powershell -ExecutionPolicy Bypass -File .\scripts\tests\release_automation.tests.ps1` -> 42 assertions pass
- [x] PowerShell parser -> changed `.ps1` files have zero syntax errors
- [x] invalid task name contract test -> rejected without filesystem changes
- [x] `powershell -ExecutionPolicy Bypass -File .\scripts\release_autopilot.ps1 -DryRun -Paths <files>` -> no commit, push, PR, deploy, or merge executed
- [x] `powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1` -> pass
- [x] deploy/staging manifest sync checks -> pass
- [x] `git diff --check` -> no whitespace errors

## 実装順

1. task 名、worktree root、required checks、secret scan、staging 対象判定の失敗テストを追加する。
2. 純粋関数を `release_automation_lib.ps1` に実装する。
3. 最新 `origin/main` から idempotent に専用 worktree を作る入口を実装する。
4. scoped commit、非対話 auth、push、PR再利用、staging、checks、auto-merge、production 監視を実装する。
5. CI で release automation tests を常時実行する。
6. `DEPLOYMENT.md` と `AGENTS.md` を新しい正規入口へ同期する。

## リスク一覧

| リスク | 影響 | 対策 |
|---|---|---|
| dirty 差分の混入 | 高 | `-Paths` 必須、broad add 禁止、cached diff と secret scan を commit 前に実行 |
| stale branch の昇格 | 高 | worktree を最新 `origin/main` から作り、release 前に behind を拒否 |
| staging 失敗後の本番昇格 | 高 | staging run と required checks の成功を merge 前の必須条件にする |
| staging後のPR head差し替え | 高 | checks待機中にhead SHAを固定し、mergeを `--match-head-commit` で条件付ける |
| 再開時の二重staging | 中 | 同じ対象SHAのqueued/in_progress runを再利用し、global concurrencyで直列化 |
| feature branch版workflowの実行 | 高 | staging dispatchは`--ref main`固定、trusted controlをmainのworkflow SHAからcheckout |
| production の意図しない実行 | 高 | `-PromoteProduction` がない限り PR + staging で停止 |
| 認証切れで途中停止 | 中 | 最初に `gh auth status` と non-interactive git remote access を検査し、secret 本文は出力しない |

## Rollback Plan

- **トリガー**: 自動化が誤った branch、path、PR、workflow を選ぶ。
- **手順**: auto-merge を解除し、対象 PR を閉じる。作成済み branch/worktree は証跡として保持し、削除は別承認で行う。
- **データ影響**: staging までは production データ変更なし。production は既存 GitHub Actions の deploy/rollback 契約に従う。
