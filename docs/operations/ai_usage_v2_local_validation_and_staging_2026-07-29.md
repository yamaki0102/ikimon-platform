# AI Usage v2 — local validation and staging runbook

Target:

- PR: https://github.com/yamaki0102/ikimon-platform/pull/1497
- branch: `codex/zukan-context-ai-usage-v2-20260729`
- production: prohibited

## 1. Source identity

```powershell
git fetch origin
git checkout codex/zukan-context-ai-usage-v2-20260729
git pull --ff-only origin codex/zukan-context-ai-usage-v2-20260729
git status --short
git rev-parse HEAD
git merge-base --is-ancestor origin/main HEAD
```

Stop if the worktree is dirty, branch identity differs, or latest `main` is not an ancestor.

## 2. Canonical source validation

```powershell
npm --prefix platform_v2 ci
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 exec -- tsx --test `
  src/services/aiUsageControl.test.ts `
  src/services/aiExecutionBoundary.test.ts `
  src/services/aiUsageLegacyCostProjection.test.ts `
  src/services/aiUsagePersistenceMigration.test.ts `
  src/services/aiUsagePostgresRepository.test.ts `
  src/services/aiProviderBoundary.test.ts `
  src/services/aiUsageRuntime.test.ts `
  src/services/zukanContextPacketContract.test.ts `
  src/services/zukanSourceImportEvidenceEnvelope.test.ts
npm --prefix platform_v2 run test:node
npm --prefix platform_v2 run build
```

Fix failures on the same branch, commit normally, push, and restart from source identity.

## 3. Disposable PostgreSQL validation

Use an explicitly disposable PostgreSQL 16 database. Never point this test at staging or production.

```powershell
$env:AI_USAGE_TEST_ALLOW_MUTATION = "1"
$env:AI_USAGE_TEST_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:55432/ai_usage_test"
npm --prefix platform_v2 exec -- tsx --test src/services/aiUsagePostgresIntegration.test.ts
```

Required PASS:

- migrations `0140`–`0144`
- two-session lease exclusion
- lease generation fencing
- cross-tenant usage rejection
- provider request duplication rejection
- unknown metadata rejection
- append-only rejection
- database-owned budget timestamp
- temporary schema removed after the test

## 4. Staging migration preparation

Before any staging mutation:

- record exact source SHA
- record DB identity and current migration inventory
- create and verify a restorable backup
- calculate SHA-256 for migrations `0140`–`0144`
- confirm `AI_USAGE_V2_ENABLED` is absent or `0`
- confirm `AI_USAGE_V2_FEATURES` is empty
- confirm no active migration/deploy lease

Apply `0140`–`0144` as one approval-bound group. Do not enable runtime metering in the same operation.

## 5. Staging schema smoke with metering disabled

Verify:

- application readiness remains healthy
- existing AI calls continue through pre-v2 behavior
- no rows are written to `ai_usage_events`
- Foundation v2 tables, flags, routes, and responses are unchanged
- rollback is flag-off plus application rollback; do not drop telemetry tables during incident response

## 6. Bounded staging activation

Set:

```text
AI_USAGE_V2_ENABLED=1
AI_USAGE_V2_FEATURES=<explicit comma-separated reviewed features>
```

Initial activation must not use `*` and must not include `profile_note_digest`.

Start with one low-risk feature. Verify:

- success event
- provider error event
- timeout event
- retry and fallback lineage
- budget rejection
- provider request ID
- tenant/project/workspace scope
- flag-off rollback

Expand the allowlist one feature at a time only after evidence is recorded.

## Stop boundary

Stop at `READY_FOR_STAGING_ACTIVATION_REVIEW` after staging migration and disabled-mode smoke are green.

Do not:

- merge PR #1497
- deploy to production
- apply production migrations
- enable `*`
- include `profile_note_digest`
- change Foundation v2
- delete `ai_cost_log` or telemetry tables
