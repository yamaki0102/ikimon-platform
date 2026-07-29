# ZUKAN Context and AI Usage v2 — consolidated implementation

- Date: 2026-07-29
- State: Draft-only candidate
- Supersedes: PR #1495 and PR #1496
- No migration application, runtime activation, deployment, or merge is authorized by this document.

## Decisions

1. `ai_usage_events` is the single authoritative USD-micro usage and reconciliation store.
2. Existing `ai_cost_log` is a temporary compatibility projection only. It must not remain a second authority.
3. `AI_USAGE_V2_ENABLED=1` is the explicit runtime activation gate. It remains disabled until migrations and staging evidence are approved.
4. Foundation v2 migrations, routes, flags, writers, and data remain unchanged.

## Implemented

### Execution identity and concurrency

- execution identity includes tenant, project, workspace, provider, model, operation version, logical invocation ID, canonical input digest, source digest, policy/prompt versions, and target time
- one logical invocation may retry with new attempt IDs without blocking later legitimate invocations of the same canonical input
- repository-controlled or database-controlled time
- 15-minute maximum lease
- monotonic lease generation used as a fencing token
- explicit lease renewal
- expired or stale workers cannot settle or write usage
- usage and settlement can be committed in one transaction

### Usage, budgets, and reconciliation

- append-only attempt and usage events
- retry and adjustment lineage must remain in the same tenant/project/workspace/feature/provider/model/operation/execution scope
- provider request ID uniqueness is scoped by provider account
- budget evaluation includes projected request cost, retries, fallback depth, and provider failures
- budget SQL prefilters tenant and UTC month boundaries
- reconciliation adjustments never lower the safety budget
- provider usage metadata uses a strict allowlist in TypeScript and PostgreSQL

### Context and rights

- Source Registry Evidence remains separate from ContextPacket
- evidence stability, item-diff digests, and before/after state equality are recomputed before sealing
- real ResolutionRun provenance is mandatory; synthetic runs are prohibited
- semantic ContextPacket and authorization receipt are separated
- reproducibility hashes and required identities are validated
- duplicate Claim revisions are rejected
- visibility is derived from facts, authority assertions, evidence links, conflicts, and governance cases
- empty packets default to internal visibility
- rights evaluation time, validity window, review deadline, and rights-object digest are preserved
- ModelInput is rejected before Context generation or after authorization/rights expiry

### Provider boundary

- low-level Google SDK access is isolated in `services/providers/googleGenAiOperations.ts`
- router, TTS, Live token, Gemini Curator, and DeepSeek Curator calls use `executeMeteredAiOperation`
- every enabled provider attempt records success, error, timeout, refusal, retry, and fallback evidence
- legacy `ai_cost_log` projection remains success-only and non-authoritative
- two standalone knowledge-ingest scripts remain time-bounded migration debt until 2026-09-30

### Persistence

Approval-bound PostgreSQL group:

1. `0140_ai_usage_control.sql`
2. `0141_ai_usage_control_hardening.sql`
3. `0142_ai_usage_metadata_allowlist.sql`
4. `0143_ai_usage_contract_v2.sql`
5. `0144_ai_usage_invocation_identity.sql`

The group must be applied as one operation before any runtime writes.

## Validation completed

- isolated strict TypeScript validation for core contracts: PASS
- core source tests: 16 PASS / 0 FAIL
- static provider and migration contract tests added
- disposable PostgreSQL integration harness added; it runs only when both:
  - `AI_USAGE_TEST_ALLOW_MUTATION=1`
  - `AI_USAGE_TEST_DATABASE_URL` points to an explicitly disposable PostgreSQL database

## Remaining approval gates

1. Canonical repository `typecheck` and full node suite.
2. Fresh disposable PostgreSQL application of `0140`–`0144`.
3. Two-session concurrent lease and stale fencing tests.
4. Direct SQL tests for cross-tenant linkage, provider-request duplication, metadata allowlist, and append-only enforcement.
5. Provider sandbox request ID and invoice reconciliation evidence.
6. Backup, recovery, migration SHA-256, and staging approval.
7. Enable `AI_USAGE_V2_ENABLED=1` only after the above gates are green.
8. Remove or migrate the two remaining standalone script imports by 2026-09-30.
9. Stop authoritative reads/writes to `ai_cost_log` by 2026-10-31; no destructive deletion is included.

## Explicitly excluded

- migration application
- staging or production data mutation
- feature-flag activation
- Foundation v2 changes
- D1/Durable Object implementation
- Action Plane, external send, publication, merge, or deploy
