# INC 2026-04-26 Live Guide staging deploy guardrail failures

## Summary

Live Guide latency-tolerant changes reached PR #132 on `codex/live`.
The first two staging deploy attempts failed before v2 restart. The third
attempt succeeded after migration design and guardrail changes.

## Impact

- Production was not affected.
- Staging PHP lane was reset to the target branch during failed attempts, but
  the v2 rebuild/restart step stopped before public verification.
- Final successful staging run: GitHub Actions run `24944136296`.

## Timeline

- `24943963551`: failed at `npm run migrate`.
  - Cause: `0029_guide_latency_states.sql` contained `ALTER TABLE ... DROP`,
    which `applyMigrations.ts` correctly blocked as destructive.
- `24944030693`: failed at `npm run migrate`.
  - Cause: the migration still used `ALTER TABLE guide_records`, but the
    staging DB role was not owner of `guide_records`.
- `24944136296`: succeeded.
  - Fix: replaced direct `guide_records` alteration with
    `guide_record_latency_states`, a companion metadata table.

## Root Causes

1. `deploy-staging.yml` pre-flight checked the workflow branch, not necessarily
   the branch selected by `workflow_dispatch.inputs.branch`.
2. Static migration checks caught destructive SQL, but did not catch
   owner-sensitive `ALTER TABLE` against existing tables before deploy.
3. The initial schema design coupled new Live Guide metadata to a legacy table
   instead of using an additive companion table.

## Corrective Actions

- `deploy-staging.yml` now checks out the selected deploy branch in pre-flight.
- CI, staging deploy, and production deploy now run
  `scripts/check_platform_v2_migration_guardrails.ps1`.
- The migration guard blocks destructive patterns and owner-sensitive
  `ALTER TABLE` on existing tables unless the migration includes an explicit
  `owner-sensitive-ok: <rollback/deploy note>` comment.
- Live Guide latency metadata now lives in `guide_record_latency_states`.

## Policy

For platform_v2 migrations, prefer additive new tables over altering existing
tables. Existing-table `ALTER TABLE` requires an explicit owner-role deploy
plan and rollback note before merge.
