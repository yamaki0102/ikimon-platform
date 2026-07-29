# ZUKAN AI usage persistence rollout

- Date: 2026-07-29
- Base source contract: PR #1495 / `codex/zukan-context-cost-foundation-20260729`
- State: source-only persistence candidate; migrations are not applied and runtime is not wired

## Decision

`ai_usage_events` is the single authoritative USD-micro usage and reconciliation store.
The existing `ai_cost_log` is retained only as a bounded compatibility projection during migration.
It must not remain a second authority.

Target retirement date for authoritative reads from `ai_cost_log`: **2026-10-31**.
Deletion is not authorized by this plan; retirement means no new authoritative reads or writes except an explicitly approved compatibility window.

## Implemented

### Approval-bound PostgreSQL migration group

- `0140_ai_usage_control.sql`
  - atomic mutable execution guard
  - append-only execution attempt events
  - append-only usage and reconciliation events
  - database-enforced retry and adjustment lineage
  - safe provider usage metadata constraints
  - temporary budget override grants
- `0141_ai_usage_control_hardening.sql`
  - raw usage must be a JSON object
  - usage events bind to an existing execution guard and started attempt
  - retry and adjustment require exact tenant/project/feature/execution scope
  - override TTL capped at 24 hours
  - only one audited revocation transition is permitted
  - override deletion and post-revocation mutation are rejected
- `0142_ai_usage_metadata_allowlist.sql`
  - provider usage metadata uses an explicit allowlist
  - count fields must be numeric/null
  - known detail containers are bounded recursively
  - unknown keys, prompt/response bodies, arbitrary text, and unexpected types are rejected

The three files are one ordered telemetry migration group. Partial application is not an approved runtime state.

### Repository

`AiUsagePostgresRepository` provides:

- advisory-lock + row-lock acquisition across workers
- idempotent active-attempt replay
- new attempt requirement after expiry or failure
- idempotent settle and caller-supplied usage event replay
- transactional append of attempt and usage evidence
- gross-usage budget snapshots; reconciliation adjustments never lower the safety budget
- input filtering before a transaction is opened
- a type-safe `pg.Pool` adapter without runtime wiring

## Existing `ai_cost_log`

The source PR includes a bounded projection for legacy dashboards. It does not project negative adjustments and stores only a SHA-256 of raw usage metadata.

Cutover sequence:

1. Apply and validate `0140`–`0142` on a disposable PostgreSQL database.
2. Apply to staging through a separate approval-bound migration operation with backup and exact-SHA evidence.
3. Wire the new repository behind a disabled feature flag.
4. Dual-record the same normalized usage event to `ai_usage_events` and the non-authoritative `ai_cost_log` projection.
5. Compare call count, gross USD totals, provider/model distribution, cache evidence, and event lineage.
6. Switch budget reads to gross usage from `ai_usage_events`.
7. Stop authoritative writes and reads against `ai_cost_log` after the approved compatibility window.
8. Keep historical `ai_cost_log` rows; no destructive migration is included.

## D1 / Worker boundary

This persistence implementation is PostgreSQL-only because the current canonical `ai_cost_log` and server AI router are PostgreSQL-backed.

Cloudflare Worker or D1 AI execution must not use the in-memory repository. Before Worker routing is activated, add a D1/Durable Object implementation with equivalent atomic lease, append-only event, retry-lineage, metadata allowlist, and USD-budget semantics.

## Validation completed in source

- isolated Node 22 strict TypeScript reconstruction: PASS
- source-contract and provider-boundary tests from PR #1495: 24 PASS / 0 FAIL
- PostgreSQL repository transaction tests: 4 PASS / 0 FAIL
- migration contract tests added for `0140`–`0142`

## Validation still required before migration approval

- canonical `npm --prefix platform_v2 run typecheck`
- canonical `npm --prefix platform_v2 run test:node`
- fresh PostgreSQL application of `0140`–`0142`
- direct SQL attempts proving append-only triggers reject UPDATE/DELETE
- concurrent lease acquisition test with at least two sessions
- retry and adjustment cross-tenant/execution rejection test
- raw usage unknown-key and content rejection test
- database/session timezone fixed to UTC for hourly/monthly budget windows
- provider sandbox request ID and invoice reconciliation evidence
- backup/recovery evidence and exact migration SHA-256

## Explicitly excluded

- migration application
- production or staging data mutation
- runtime feature-flag wiring
- replacement of `aiBudgetGate`
- D1/Durable Object implementation
- Foundation v2 migration, flag, route, or writer changes
- Action Plane, external send, publication, merge, or deploy

The implementation stops immediately before migration application and runtime activation.
