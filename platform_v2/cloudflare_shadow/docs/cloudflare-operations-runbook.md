# ikimon.life Cloudflare Operations Runbook

This runbook is the operational source of truth for PR #768 and the Cloudflare-managed production lane.

Scope:

- Worker: `ikimon-life-cloudflare-prod`
- D1 core: `ikimon_prod_core`
- D1 observations: `ikimon_prod_observations_2026_06`
- R2 bucket: `ikimon-prod-media`
- Queue: `ikimon-prod-media-jobs`
- Public domain: `https://ikimon.life`
- Routine production entrypoint: GitHub Actions `Deploy to Production`, Cloudflare-only.

Cloudflare staging:

- Worker: `ikimon-life-cloudflare-staging`
- Public domain: `https://staging.ikimon.life`
- Data plane: `ikimon_shadow_core`, `ikimon_shadow_observations_2026_06`, `ikimon-shadow-media`, `ikimon-staging-media-jobs`
- Routine staging entrypoint: GitHub Actions `Deploy Cloudflare Staging`, Cloudflare-only.
- Materialized UI target: `npm run materialize:original-ui -- --target-env staging`

Cloudflare staging is the promotion gate for Cloudflare production changes. It owns `staging.ikimon.life/*` and must not use VPS SSH, `/var/www/ikimon.life-staging`, or `VPS_SSH_KEY`. The legacy VPS staging workflow remains only for old integration jobs until those jobs are migrated or retired. Production Worker config must not own `staging.ikimon.life` routes; `deploy-production-guard.mjs` fails when a production route begins with `staging.ikimon.life/`.

Hard boundaries:

- Do not run direct `wrangler deploy --env production` for routine deploys. Use the guarded npm script.
- Do not change DNS, custom domains, routes, D1 data, secrets, billing, provider settings, or VPS state as part of routine deploy.
- Routine deploy may update only `original-ui/html/*` and `original-ui/static/app-sw.js` objects in `ikimon-prod-media`, generated from the same commit, plus the Worker script.
- Do not delete D1/R2 resources. Rollback of Worker code does not restore deleted or mutated Cloudflare resources.
- Production D1 writes, secret changes, billing changes, DNS changes, and provider/VPS shutdown still require explicit task approval.

References:

- Cloudflare treats `wrangler.jsonc` as the Worker configuration source of truth: https://developers.cloudflare.com/workers/wrangler/configuration/
- Cloudflare Worker rollbacks create a new active deployment from a previous Worker version, but connected resources such as D1/R2/Queues are not reverted: https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/
- Wrangler Worker deployment/version commands: https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Local project validation uses Wrangler `4.100.0` and the help output from this repo.

## 1. Daily Deploy

Use this when deploying reviewed code from this branch or its successor to the production Worker.

Preconditions:

- PR review scope is clear.
- `git status --short --branch` is clean except for the intended change.
- No pending D1 migration, R2 import, secret update, DNS change, route/custom-domain change, billing operation, or VPS/provider operation is included.
- If the change needs D1/R2 mutation outside `original-ui/html/*` and `original-ui/static/app-sw.js` materialization, stop and write a separate data-change plan.

Commands:

```powershell
cd platform_v2/cloudflare_shadow
npm install
npm run deploy:production:dry-run
npm run materialize:original-ui:dry-run -- --concurrency 4
```

Expected dry-run gates:

- `npm run check`
- `npm test`
- production config guard and hardcoded-secret scan
- `npx wrangler --version`
- `npx wrangler deploy --env production --dry-run`
- local render of core `original-ui/html/*` pages and `original-ui/static/app-sw.js`.
- `.deploy/production-preflight-latest.json` written for the fast lane.

For routine low-risk Worker/tooling edits, the quick profile may be used during iteration:

```powershell
npm run test:quick
npm run deploy:production:quick-preflight
```

Quick profile skips only `synthetic 10k daily profile`; it still runs the other Worker contract tests, TypeScript, config guard, secret scan, and Wrangler dry-run. Run `npm run test:heavy` to exercise only the synthetic 10k case, and refresh full evidence with `npm run deploy:production:preflight` before high-risk runtime changes.

If the same git `HEAD` and deploy-input hash have already passed the full dry-run, the fast lane may be used:

```powershell
npm run deploy:production:fast:dry-run
```

The fast lane must still validate the preflight report, re-run the config guard and secret scan, run Wrangler dry-run, and refuse stale or mismatched deploy inputs.

The guard caches `npx wrangler --version` at `.deploy/wrangler-version-cache.json` and reuses it only when both the package lock hash and Worker deploy-input hash match. A Wrangler dependency change, Worker/deploy-tool change, or package lock change refreshes the cache. `wrangler deploy --env production --dry-run` remains mandatory and is not cached.

For the lowest local wait time, have GitHub Actions create the quick preflight artifact first:

```powershell
gh workflow run cloudflare-quick-preflight.yml --ref <branch-or-sha>
npm run deploy:production:artifact:pull
npm run deploy:production:fast:dry-run
```

The helper resolves the latest successful artifact run for the current branch and exact `HEAD`, downloads `cloudflare-production-preflight`, and writes `.deploy/production-preflight-latest.json` plus `.deploy/wrangler-version-cache.json`. It is valid only for the same git `HEAD` and Worker deploy-input hash; the fast lane still rechecks config, scans for hardcoded secrets, runs Wrangler production dry-run, and refuses stale evidence. The production GitHub Actions deploy workflow now creates this artifact before deploy and uses `npm run deploy:production:fast` in the Worker deploy job.

Execute only after dry-run passes:

```powershell
npm run deploy:production -- --approval APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY
npm run deploy:production:fast -- --approval APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY
npm run materialize:original-ui -- --approval APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY --concurrency 4
```

The guarded scripts deploy the Worker, update core materialized HTML in R2, and smoke:

- `https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/healthz`
- `https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/readyz`
- `https://ikimon.life/healthz`
- `https://ikimon.life/readyz`

Post-deploy evidence to record:

- commit SHA and PR number
- output JSON from `deploy-production-guard.mjs`
- output JSON from `materialize-original-ui-html.mjs`
- preflight report path and whether `lane` was `full` or `fast`
- Worker version/deployment ID if shown by Wrangler
- healthz/readyz HTTP statuses
- explicit note that DNS, D1 data, secrets, billing, provider, and VPS state were not changed; R2 changes were limited to `original-ui/html/*` and `original-ui/static/app-sw.js`.

Stop and rollback if:

- healthz or readyz fails on either workers.dev or public domain
- auth/session, record creation, map, or field detail routes regress in smoke
- origin fallback telemetry unexpectedly increases for a route that should be native

## 2. Emergency Rollback

Use this only when the deployed Worker code is the likely cause of a production incident.

Rollback scope:

- Worker code only.
- D1 data, R2 objects, Queues, secrets, DNS, routes, billing, provider, and VPS state are not reverted by Worker rollback.
- If the incident involves data corruption or missing media, do not rely on Worker rollback alone; switch to the data preservation procedure.

Initial triage:

```powershell
cd platform_v2/cloudflare_shadow
npx wrangler deployments list --env production --json
npx wrangler versions list --env production --json
```

Choose the last known-good version from the deployment/version list. Record the current active version and target rollback version before executing.

Execute rollback:

```powershell
npx wrangler rollback --env production <VERSION_ID> --message "Emergency rollback: <short reason>" --yes
```

Immediate smoke:

```powershell
curl.exe -fsS https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/healthz
curl.exe -fsS https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev/readyz
curl.exe -fsS https://ikimon.life/healthz
curl.exe -fsS https://ikimon.life/readyz
```

Post-rollback checks:

- Re-run the user-visible failing route that triggered rollback.
- Confirm no data resources were deleted or modified during rollback.
- Open or update the incident note with active version before rollback, rollback target version, command output, smoke result, and next fix branch.

Do not:

- Run D1 imports, R2 deletes, secret changes, or DNS changes during a Worker-code rollback.
- Roll back to a version that expects older bindings or missing resources.
- Assume rollback fixes data written by the bad version.

## 3. Data Preservation

Use this for routine backup evidence, before risky deploys, after incidents, and before any future provider/VPS retirement step.

Preservation contract:

- Canonical records are kept in D1.
- Public read models stay privacy-filtered and must not expose exact lat/lng or geometry.
- Original media stays private in R2; public surfaces use verified derivatives.
- `rollback_write_ledger` is the replay evidence for write rollback/readiness, not a delete log.
- Data export/restore evidence must be stored outside the product repo, under the operator scratch/archive path for the run.

Create a dated evidence directory outside this repo:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$evidence = "E:\Projects\_agent_scratch\ikimon-platform\cloudflare-data-preservation-$stamp"
New-Item -ItemType Directory -Force $evidence | Out-Null
```

Export D1:

```powershell
cd platform_v2/cloudflare_shadow
npx wrangler d1 export ikimon_prod_core --remote --output "$evidence\ikimon_prod_core.sql" --skip-confirmation
npx wrangler d1 export ikimon_prod_observations_2026_06 --remote --output "$evidence\ikimon_prod_observations_2026_06.sql" --skip-confirmation
```

Record checksums:

```powershell
Get-FileHash "$evidence\*.sql" -Algorithm SHA256 | Format-Table
```

Check R2 bucket state:

```powershell
npx wrangler r2 bucket info ikimon-prod-media
```

Application-level media preservation checks:

- Verify the R2 ledger count and unresolved legacy/media ledger counts from the latest approved smoke or internal report.
- Verify public derivative coverage and exact-location privacy checks before treating an export as production-ready.
- Verify no `r2.dev` public access or custom public R2 domain has been enabled without an explicit privacy review.

Minimum evidence packet:

- D1 export paths, file sizes, and SHA256 hashes
- R2 bucket info output
- latest successful healthz/readyz output
- latest read-model/media reconciliation summary
- latest rollback ledger / reverse-delta dry-run result when writes changed
- statement that exports were not committed to git and were stored outside the product repo

Restore drill rule:

- Restore drills must use new temporary D1 databases or a clearly marked non-production lane.
- Never import a drill export into production D1.
- After restore, compare critical counts for users, visits, occurrences, evidence assets, asset blobs, observation fields, public read models, and orphan checks before declaring data preservation healthy.

## Review Checklist

For every PR touching the Cloudflare production lane, reviewers should confirm:

- Routine deploy still goes through `npm run deploy:production:dry-run` and guarded execute.
- Rollback instructions still match local `npx wrangler rollback --help`.
- Data preservation does not commit SQL exports, object dumps, secrets, or production data.
- `wrangler.jsonc` remains the source of truth for Worker config and environment bindings.
- Any D1/R2/secret/DNS/provider operation is called out as a separate approval item.
