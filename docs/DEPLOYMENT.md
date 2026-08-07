# Deployment

ikimon.life の通常deployは、`all-projects-management` の構造化Issueから Cloudflare Queue / Sandbox Executor がportable release scriptを実行する。GitHub Actionsはbuild、test、deploy、verify、Visual QA、rollbackの実行backendに使用しない。
ローカル端末から `git add -A`、`main` への直接push、直接SSH deployは正規ルートにしない。

## 正規ルート

1. 作業ブランチで変更する
2. lint / test / deploy guardrail を通す
3. PRを作成し、対象の40文字commit SHAを固定する
4. `yamaki0102/all-projects-management` に `ops:command` Issueを作る
5. Cloudflare Executorで `dry_run` → staging `deploy` → `verify` → `visual_qa` を実行する
6. productionは同じIssueの30分nonce承認後、同じSHAをportable scriptでdeployする

`manual_emergency` は明示承認済み非常時だけに使い、全経路で同じportable script、migration guard、runtime SHA verificationを再利用する。GitHub Actions fallbackは存在しない。

現行本番は `ikimon-life-cloudflare-prod` を正本とし、VPS SSH や blue/green runtime は
通常の release 経路で使わない。旧VPS deploy 資産は互換調査・退役作業の参照実装として
保持し、Cloudflare production workflow の代替にしない。

## VPS retirement boundary（2026-08-07）

- `ikimon-vps` / `162.43.44.131` は legacy / retirement 対象であり、現行 production、staging、origin fallback、通常releaseの実行先ではない。
- 愛管・LENRI等の共有サーバー `i-kan-xserver` / `sv1102.xserver.jp` は別資産であり、VPS退役の停止・削除・解約対象に含めない。
- この文書のVPS、systemd、nginx、SSH、GitHub Actions deploy記述は rollback/restore evidence のための退役アーカイブ。現行操作手順として実行しない。

## Source of Truth

- low-token deploy entry: `docs/DEPLOY_LOW_TOKEN_PROTOCOL.md`
- central deploy registry / Release Commander: `all-projects-management/operations/deploy_standard/service_deploy_registry.json`
- current Worker deploy manifest: `ops/deploy/deploy_manifest.json`
- retired VPS deploy reference (archive only): `ops/deploy/production_deploy_reference.sh`
- retired blue/green deploy script (archive only): `ops/deploy/deploy_platform_v2_blue_green.sh`
- retired VPS systemd units (archive only): `ops/deploy/ikimon_v2_blue.service`, `ops/deploy/ikimon_v2_green.service`
- staging manifest: `ops/deploy/staging_manifest.json`
- release candidate guard: `scripts/check_release_candidate.ps1`
- staging deploy reference: `ops/deploy/staging_deploy_reference.sh`
- production/staging workflow references: retired archive; use Cloudflare command bus / Release Commander
- production deploy timing: `docs/PRODUCTION_DEPLOY_TIMING.md`
- branch hygiene audit workflow: `.github/workflows/branch-hygiene-audit.yml`
- CI guardrail: `scripts/check_deploy_guardrails.ps1`
- platform migration guardrail: `scripts/check_platform_migration_guardrails.ps1`
- manifest/workflow sync check: `scripts/check_deploy_manifest_sync.ps1`
- remote/reference sync check: `scripts/check_remote_deploy_reference.ps1`
- deploy status summary: `scripts/deploy_status_summary.ps1`
- fresh release worktree: `scripts/new_release_worktree.ps1`
- resumable release autopilot: `scripts/release_autopilot.ps1`
- deploy timing summary: `scripts/summarize_deploy_timing.ps1`
- retired VPS prepare timing summary (archive only): `scripts/summarize_prepare_timing.ps1`
- branch hygiene audit: `scripts/branch_hygiene_audit.ps1`

## Persistent Paths

以下は deploy 対象ではなく、保護対象:

- `upload_package/data/**`
- `upload_package/config/secret.php`
- `upload_package/config/oauth_config.php`
- `upload_package/config/config.php`

これらは repo の通常変更フローに混ぜない。  
「消さないように注意する」ではなく、「変更を CI で止める」が基本。

退役アーカイブのVPS deploy scriptでは、上記のうち runtime に存在する `data/` と
`config.php` / `oauth_config.php` / `secret.php` をバックアップしてから
`git reset --hard` を行い、その後に復元する。

## Local Commands

```powershell
# 作業開始: 最新 main から task 専用レーンを作る
powershell -ExecutionPolicy Bypass -File .\scripts\new_release_worktree.ps1 -TaskName <task-name>

# release: 明示パスだけを commit/push し、PR・staging・required checks まで進める
powershell -ExecutionPolicy Bypass -File .\scripts\release_autopilot.ps1 -Paths <file1>,<file2> -CommitMessage "<message>" -Title "<PR title>"

# 本番反映が依頼に含まれる場合だけ、同じコマンドへ明示的に追加する
powershell -ExecutionPolicy Bypass -File .\scripts\release_autopilot.ps1 -PromoteProduction

powershell -ExecutionPolicy Bypass -File .\scripts\local_deploy_preflight.ps1 -RequireCodexBranch -RequireUpstreamSync
powershell -ExecutionPolicy Bypass -File .\scripts\check_worktree_clean.ps1
php tools/lint.php
composer test
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_platform_migration_guardrails.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_manifest_sync.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_staging_manifest_sync.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_remote_deploy_reference.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\deploy_status_summary.ps1 -Pr <number>
powershell -ExecutionPolicy Bypass -File .\scripts\branch_hygiene_audit.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\pull_production_state_snapshot.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\provision_staging_from_production.ps1
```

`local_deploy_preflight.ps1` は GitHub Actions では検知できないローカル未コミットを
deploy 判断前に止めるための入口。`platform_v2/db/migrations/`,
`.github/workflows/`, `platform_v2/src/routes/`, `platform_v2/src/services/`,
`ops/deploy/`, guardrail scripts, persistent data/config boundary が dirty な場合は
high-risk path として表示する。

`release_autopilot.ps1` は clean gate を弱めない。dirty な長期作業ツリーを見つけた場合は
明示された `-Paths` だけを扱い、範囲外の変更が1件でもあれば専用 worktree の利用を要求する。
GitHub CLI と Git Credential Manager は非対話モードで使い、認証が切れている場合は変更前に
失敗する。Cloudflare staging が必要な差分は full staging と required checks が成功するまで
merge せず、`-PromoteProduction` がある場合だけ auto-merge と production workflow 監視へ進む。

## Staging First

改装や大きい UI 変更は、production へ直接入れない。  
必ず次の順にする。

1. 最新 `origin/main` から task 専用 worktree を作る
2. scoped commit / push / PR を作る
3. required checks 3件を対象SHAで通す
4. 同じSHAを Cloudflare staging へ full deploy し、D1 migration、Worker、R2 materialize、browser smokeを通す
5. squash auto-merge で `main` へ昇格する
6. `main` push起点の Cloudflare production workflow と production smoke を完了まで確認する

Cloudflare staging は `ikimon-life-cloudflare-staging` と非productionのD1/R2/Queueを使う。
通常のpromotionでVPS SSH、`/var/www/ikimon.life-staging`、`VPS_SSH_KEY`は使わない。
workflowはfeature branchのpushから起動せず、`main`上のtrusted release controlから
検証済みPR head SHAをcheckoutする。同じSHAの実行中runがあれば再開時に再利用する。
旧VPS stagingは互換integrationの調査・退役作業だけに限定する。
旧VPS full smoke の互換契約には `public_map_snapshot_alert_lifecycle` が残るが、
これは Cloudflare staging / production の promotion gate ではない。

staging の詳細は `docs/STAGING_RUNBOOK.md` を参照。

## Branch Hygiene

GitHub repository setting `delete_branch_on_merge` must stay enabled. If it is disabled,
merged PR branches accumulate and the repo quickly returns to stale branch triage.
GitHub repository setting `allow_auto_merge` must also stay enabled so a verified release
can finish after the initiating local session exits.

Merge policy is squash-only:

- `allow_auto_merge=true`
- `allow_squash_merge=true`
- `allow_merge_commit=false`
- `allow_rebase_merge=false`
- `main` branch protection requires linear history

Active release branches are limited to:

- `main` — production source. Protected; never push directly from Codex.

Cloudflare staging deploys the verified PR commit SHA directly and does not use the legacy
`staging` branch. That branch remains only for separately approved history maintenance;
normal release automation must not force-update or delete it.

All feature/rescue work uses short-lived branches, normally `codex/<task-name>`, then PR to
`main`. After merge, GitHub deletes the merged branch automatically. If a branch must remain
after merge, document the owner and reason in the PR.

Weekly audit:

- workflow: `.github/workflows/branch-hygiene-audit.yml`
- local/manual command: `powershell -ExecutionPolicy Bypass -File .\scripts\branch_hygiene_audit.ps1`
- reports: delete-branch-on-merge setting, operational branches, open PRs, stale branches,
  merged non-operational branches, and recent production/staging deploy runs

## Migration Guardrails

`platform_v2/db/migrations/` の新規 migration は、CI / staging / production の
pre-flight で `scripts/check_platform_migration_guardrails.ps1` を通す。

このガードは次を merge 前に止める。

- `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM`, `UPDATE`
- 同じ migration ファイル内で作成していない既存 table への `ALTER TABLE`

staging / production の app DB role は、既存 table の owner とは限らない。
そのため既存 table へ列追加したい場合でも、原則は companion table を作る。
どうしても既存 table を `ALTER TABLE` する場合は、SQL内に
`owner-sensitive-ok: <rollback/deploy note>` を書き、owner role での適用手順と
rollback plan をPR本文または incident / runbook に残す。

2026-04-26 の Live Guide staging deploy では、`guide_records` への `ALTER TABLE`
が staging DB owner 権限で止まった。以後、既存 table を拡張するだけの目的なら
`guide_record_latency_states` のような companion table を優先する。

## Server Script Reference

> **退役アーカイブ:** 以下は旧VPS runtimeの復旧・証拠確認用の参照実装であり、現行Cloudflare production/stagingのdeploy、fallback、migration適用には使用しない。

repo 外の実体は `/var/www/ikimon.life/deploy.sh` だが、参照実装を repo に置いた。  
サーバ側を変更するときは `ops/deploy/production_deploy_reference.sh` も同時に更新する。

旧VPS platform runtime は blue/green systemd unit と
`/etc/ikimon/production-v2.env` を正本にする。旧 `pm2 ikimon-v2-production-api` は
既存 env の移行元であり、通常 deploy の実行単位ではない。現行本番の正本はCloudflare Workerである。

## Deploy Speed Guardrails

Production deploy keeps rollback, readiness, and candidate smoke checks intact. Speed improvements
must remove repeated deterministic work, not safety checks.

- The production workflow is serialized with `concurrency.group: production-deploy` and
  `cancel-in-progress: false`. A running production deploy must finish or fail before a later
  push/manual dispatch starts; do not cancel an in-flight promote path for speed.
- Production candidate smoke is tiered by changed files. UI, route, content, runtime, dependency,
  or unknown path changes run the full Playwright browser smoke. Deploy, import, and docs-only
  changes run targeted candidate smoke against `/healthz`, `/readyz`, `/ops/readiness`, `/`,
  `/explore`, `/map`, `/learn`, and `/contact`.
- The legacy lane is also tiered by changed files. Missing base refs, empty/manual classification,
  `upload_package/**`, any `.php`, `.htaccess`, `composer.json` / `composer.lock`, and the legacy
  deploy runtime boundary files run the full `/var/www/ikimon.life/deploy.sh` path. Other changes
  back up and restore the runtime allowlisted `upload_package/data/**` files plus runtime config
  while syncing `/var/www/ikimon.life/repo` to the release SHA, then let the blue/green
  `platform_v2` prepare, smoke, promote, and verify gates continue as usual. This avoids
  dirtying legacy delta inputs with a bare `git reset --hard`.
- VPS-side `npm ci` uses `${APP_ROOT}/cache/npm` with `--prefer-offline`. Lockfile validation still
  runs through `npm ci`; the cache only avoids repeated package downloads.
- Production candidate build uses `npm run build:server`. The full `npm run build` quality checks
  remain in GitHub Actions pre-flight for the same SHA.
- Fixed static imports are skipped only when their marker/hash under
  `${APP_ROOT}/deploy_state/static_imports` matches the current source. Set
  `FORCE_STATIC_IMPORTS=1` for recovery, DB recreation, or intentional full reseeding.
- The N03 Shizuoka ZIP is cached under `${APP_ROOT}/cache/ksj`; changing the publish-date/version
  marker forces a fresh import.
- Legacy shadow sync runs in cursor-based delta mode during deploy and passes changed legacy
  file paths to the importer. Partitioned `observations/*.json` and
  `tracks/<user>/<session>.json` files are imported in scoped mode. `users.json`,
  `auth_tokens.json`, and `invites.json` update only their user/auth/invite lanes. Root
  `observations.json` and unknown files fall back to a full import. It still executes the
  production shadow verify and drift report gates after sync. Set `FORCE_LEGACY_SYNC=1` for
  recovery, cursor repair, or an intentional full legacy re-import.

## Legacy Routes

- `deploy.json` + `.agent/workflows/deploy_wsl.php`
- `bash deploy.sh` での自動 commit / push / SSH deploy

このリポジトリでは旧経路として扱う。  
旧入口を踏んでも本番 deploy しないよう、安全側に倒す。
