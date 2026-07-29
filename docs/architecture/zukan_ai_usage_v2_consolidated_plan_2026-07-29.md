# ZUKAN Context and AI Usage v2 — consolidated implementation

- Date: 2026-07-29
- State: Draft-only candidate
- Supersedes: PR #1495 and PR #1496
- No migration application, runtime activation, deployment, or merge is authorized by this document.

## Decisions

1. `ai_usage_events` is the single authoritative USD-micro usage and reconciliation store.
2. Existing `ai_cost_log` is a temporary compatibility projection only. It must not remain a second authority.
3. Runtime activation is fail-closed and requires both:
   - `AI_USAGE_V2_ENABLED=1`
   - an explicit `AI_USAGE_V2_FEATURES` comma-separated allowlist
4. Missing or empty feature allowlist means disabled. `*` is prohibited until a separately reviewed full cutover.
5. Foundation v2 migrations, routes, flags, writers, and data remain unchanged.

## Initial staged feature set

Only the following migrated features may enter the first staging allowlist after all gates pass:

- `guide_tts_audio`
- `guide_tts_text`
- `guide_live_token`
- `curator_*`
- router endpoint names explicitly reviewed in the deployment packet
- `deepseek_flash` / `relationship_score_narrative`

`profile_note_digest` is excluded from the first allowlist. Its existing monthly budget path remains unchanged until its final direct DeepSeek call is migrated and independently tested.

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
- router, TTS, Live token, Gemini Curator, DeepSeek Curator, and DeepSeek Flash calls use `executeMeteredAiOperation`
- every enabled provider attempt records success, error, timeout, refusal, retry, and fallback evidence
- legacy `ai_cost_log` projection remains success-only and non-authoritative
- two standalone knowledge-ingest scripts remain time-bounded migration debt until 2026-09-30
- Profile Notebook remains excluded from the activation allowlist until its direct call is removed

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
- exact-SHA central dry-run requested at `all-projects-management#897`

## Remaining approval gates

1. Canonical repository `typecheck` and full node suite.
2. Fresh disposable PostgreSQL application of `0140`–`0144`.
3. Two-session concurrent lease and stale fencing tests.
4. Direct SQL tests for cross-tenant linkage, provider-request duplication, metadata allowlist, and append-only enforcement.
5. Provider sandbox request ID and invoice reconciliation evidence.
6. Backup, recovery, migration SHA-256, and staging approval.
7. Apply `0140`–`0144` in staging while `AI_USAGE_V2_ENABLED=0`.
8. Run read-only schema and runtime smoke checks.
9. Enable `AI_USAGE_V2_ENABLED=1` with the bounded staging feature allowlist only.
10. Verify success, failure, timeout, retry, fallback, budget rejection, and legacy fallback behavior.
11. Remove or migrate the two remaining standalone script imports by 2026-09-30.
12. Stop authoritative reads/writes to `ai_cost_log` by 2026-10-31; no destructive deletion is included.

## Rollback

- Before activation: leave the feature flag off; new tables are unused.
- After allowlisted activation: remove affected feature names from `AI_USAGE_V2_FEATURES` first.
- If necessary, set `AI_USAGE_V2_ENABLED=0`; existing provider calls continue through their pre-v2 behavior.
- Do not drop telemetry tables during incident response. Preserve evidence and reconcile later.

## Explicitly excluded

- migration application by this PR
- production data mutation
- unbounded `*` feature activation
- Foundation v2 changes
- D1/Durable Object implementation
- Action Plane, external send, publication, merge, or production deploy
