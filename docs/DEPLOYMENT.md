# Deployment

## Current route — 2026-10-09 owner decision

ZUKAN の通常開発・検証・staging・本番リリースは、自作プラグイン、MCP、executor、Factory、NOCOSIL Work 接続を前提にしない。現在の依頼と有効な承認に従い、git・保護された GitHub PR・案件ごとに登録済みの provider-native 経路を使う。Factory の修復は独立した作業とする。

1. 現在の source SHA と対象範囲を確認し、短命の作業 branch で変更する。同じ mutable scope の writer は 1 体とし、無関係な変更を保持する。
2. 差分の実質的なリスクに応じた検証を行い、PR に「目的・変更・検証」を記す。適用される staging 条件を含む必須 checks・review と有効な承認を満たして merge する。main への直接 push、履歴の強制書換え、必須 checks の迂回は行わない。
3. release に進むときだけ、中央正本 `yamaki0102/all-projects-management` で `php scripts/get_service_deploy_method.php zukan.earth --catalog` を実行し、現在の `effective_route`、対象 Worker、環境、実行能力を確認する。
4. `STANDARD_READY` では登録済み runner `node scripts/run_registered_release.mjs` と選択された provider-native profile を使う。古い Queue/Executor の記述から、追加の `ops:command` Issue、nonce、Factory claim を通常経路の必須条件に戻さない。
5. runner の source/tree pin と exact source read-back、実行直前の current baseline と rollback 先、対象 SHA の staging 証拠、有効な既存本番承認を確認する。source の merge と本番配備を別々に判定する。配備後は Cloudflare API/runtime read-back、登録済み UI 検証（該当する場合は 320px / 375px と PWA を含む）を行い、公開 URL `https://zukan.earth/` も実際に確認する。

Cloud Codex の実行ホストが既存 provider 認証を利用できない場合、中央の現行 runner adapter が登録しているときに限り、既存の認可済み Cloudflare Workers Builds 実行ホストへ同じ登録済み runner を戻す。これはホスト復旧であり、新しい workflow、credential、IAM 権限、deploy backend の追加ではない。source/tree pin と exact source、実行直前 baseline、staging 証拠、既存本番承認、rollback 先、Cloudflare API/runtime と UI（登録対象 viewport と PWA）の read-back を維持する。host/adapter の利用可否や実行成功は都度確認し、事前に完了扱い・固定 ID・配備証拠を記載しない。

ZUKAN の技術識別子は `ikimon-life`、現行 repository は `yamaki0102/ikimon-platform`、公開先は `https://zukan.earth/`。実行時の設定は中央 catalog と provider の現在値を使う。NOCOSIL の `release/production` merge による本番配備を、そのまま ZUKAN の設定とみなさない。

選択された release 経路の権限・接続・能力が不足する場合は、その具体的な release 工程だけを未完了として示す。独立して認可されている実装・検証・PR 作業は継続する。未登録の経路や VPS SSH を代替として作らない。

### Preserved boundaries

- 本番の初回有効化、DB 実適用、secret、IAM・権限、DNS、新規課金、外部送信は、対象サービスに適用される有効な承認と保護境界に従う。通常の code-only release に無関係な承認を追加しない。
- source records、production data、既存 credentials を保護し、secret の値を PR・ログへ出さない。legacy の `upload_package/data/**` と runtime config も明示範囲なく上書き・削除しない。
- 本番に dummy 投稿を作らない。fixture と隔離された staging を使い、本番 read-back は許可済みの通常利用または read-only 確認で行う。
- DB migration と rollback は現在の対象 profile に従う。古い VPS/PostgreSQL の手順を D1 の現行契約へ置き換えて解釈しない。
- build・staging・production・ログイン後の Journey は個別に検証する。HTTP 200 や merge だけで利用完了とは判定しない。

### Current source of truth

- Development entry: [`../AGENTS.md`](../AGENTS.md)
- Shared operating contract: `yamaki0102/all-projects-management:operations/ai_os/noah_operating_contract.md`
- Release lookup: `yamaki0102/all-projects-management:scripts/get_service_deploy_method.php zukan.earth --catalog`
- Registry and effective route: `operations/deploy_standard/service_deploy_registry.json`, `scripts/lib/effective_release_route.php` in that management repository
- Runtime source: `platform_v2/cloudflare_shadow/src/`; shared UI/services: `platform_v2/src/`

## Historical compatibility reference — SUPERSEDED

以下は過去の Queue/Sandbox、GitHub Actions、VPS/blue-green 運用と移行資産の参照であり、通常開発・配備の指示ではない。旧正規経路は **2026-10-09** に上記の Current route と中央 `effective_route` へ置き換えた。明示的な互換調査・rollback 資産の確認・退役作業に必要な箇所だけを読み、古い workflow 名、required checks 件数、branch、nonce、PC 固有手順を現在の要件として復活させない。

### Historical source locators

- low-token deploy entry: `docs/DEPLOY_LOW_TOKEN_PROTOCOL.md`
- deploy manifest: `ops/deploy/deploy_manifest.json`
- server deploy reference: `ops/deploy/production_deploy_reference.sh`
- production platform blue/green deploy script: `ops/deploy/deploy_platform_v2_blue_green.sh`
- production platform systemd units: `ops/deploy/ikimon_v2_blue.service`, `ops/deploy/ikimon_v2_green.service`
- staging manifest: `ops/deploy/staging_manifest.json`
- release candidate guard: `scripts/check_release_candidate.ps1`
- staging deploy reference: `ops/deploy/staging_deploy_reference.sh`
- production workflow: `.github/workflows/deploy.yml`
- staging workflow: `.github/workflows/deploy-cloudflare-staging.yml`
- legacy VPS staging workflow: `.github/workflows/deploy-staging.yml`
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
- VPS prepare timing summary: `scripts/summarize_prepare_timing.ps1`
- branch hygiene audit: `scripts/branch_hygiene_audit.ps1`

### Persistent Paths

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

### Local Commands

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

### Staging First

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

### Branch Hygiene

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

### Migration Guardrails

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

### Server Script Reference

repo 外の実体は `/var/www/ikimon.life/deploy.sh` だが、参照実装を repo に置いた。  
サーバ側を変更するときは `ops/deploy/production_deploy_reference.sh` も同時に更新する。

本番 platform runtime は blue/green systemd unit と
`/etc/ikimon/production-v2.env` を正本にする。旧 `pm2 ikimon-v2-production-api` は
既存 env の移行元であり、通常 deploy の実行単位ではない。

### Deploy Speed Guardrails

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

### Legacy Routes

- `deploy.json` + `.agent/workflows/deploy_wsl.php`
- `bash deploy.sh` での自動 commit / push / SSH deploy

このリポジトリでは旧経路として扱う。  
旧入口を踏んでも本番 deploy しないよう、安全側に倒す。
