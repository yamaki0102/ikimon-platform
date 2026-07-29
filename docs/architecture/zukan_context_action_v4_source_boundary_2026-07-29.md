# ZUKAN Context / AI Usage v4 — source implementation boundary

- Base: `yamaki0102/ikimon-platform@351f80398241dc1ba88894779466ce40339a1c90`
- Date: 2026-07-29
- State: source-only candidate; no migration, deploy, flag, route, secret, or production mutation

## Implemented

1. AI usage control
   - deterministic execution key
   - `AiUsageRepository` persistence boundary
   - in-memory implementation explicitly limited to test/development
   - expiring execution lease with idempotent replay
   - expired or failed execution requires a new attempt ID
   - append-only attempt, usage, and reconciliation events
   - distinct retry and reconciliation target fields
   - USD-micro request/hour/feature-month/tenant-month limits
   - retry, fallback-depth, and provider-failure limits
   - raw provider usage metadata rejects prompt/response content and oversized structures
2. Existing cost-log compatibility
   - bounded projection into existing `ai_cost_log`
   - provider request ID, pricing version, retry, fallback, and cache evidence retained
   - raw provider usage is represented by SHA-256 only
   - negative reconciliation adjustments fail closed because current `ai_cost_log` forbids negative cost
3. Source evidence and Context
   - Source Registry evidence remains separate from ContextPacket
   - rights `unknown` always blocks `ai_input`
   - real `ResolutionRun` identity is mandatory; synthetic runs are unsupported
   - semantic packet is separated from generation/authorization receipt
   - tenant/workspace scope, receipt digest, and authorization expiry are enforced
   - ModelInput text is generated only from admitted Context values; callers cannot inject replacement text
4. Provider boundary
   - runtime Google SDK imports are centralized through `services/providers/googleGenAiSdk.ts`
   - `aiModelRouter`, curator, guide-live, and guide-TTS no longer import the SDK directly
   - two standalone knowledge-ingest scripts remain explicitly owned and time-bounded to 2026-09-30
   - static, dynamic, and `require` direct imports are rejected outside the reviewed boundary
5. Validation
   - strict TypeScript reconstruction: PASS
   - changed-contract tests: 19 PASS / 0 FAIL
   - provider-boundary tests: 2 PASS / 0 FAIL

## Existing cost infrastructure

The repository already contains PostgreSQL `ai_cost_log`, `aiCostLogger.ts`, and `aiBudgetGate.ts`.
They are not replaced or modified by this source-only change. Do not create a second authoritative ledger.
Before persistence work, choose one path:

1. evolve `ai_cost_log` additively into the authoritative usage/reconciliation event store; or
2. introduce a replacement store with a bounded compatibility projection and an explicit retirement date.

Parallel indefinite accounting is prohibited. The compatibility projection in this PR is not runtime-wired
and is not a second authoritative ledger.

## Deliberately not implemented

- Foundation v2 PostgreSQL `0134`–`0139` or D1 `0009`–`0014` changes
- AI telemetry migration or migration application
- durable PostgreSQL/D1 `AiUsageRepository`
- changes to existing `ai_cost_log`, `aiCostLogger`, or `aiBudgetGate`
- runtime wiring of usage control or the compatibility projection
- Foundation runtime adapter wiring
- Source Registry write/apply
- `SHADOW_READ`, `DUAL_WRITE`, or kill-switch changes
- ContextPacket generation from Source Registry dry-run evidence
- Action Plane, external send, publication, merge, staging, or production deploy

## Production gate

Before persistence or runtime wiring:

1. Canonical repository typecheck and full node suite must be green.
2. The two standalone direct-import scripts must migrate by 2026-09-30 or receive explicit re-approval.
3. The `ai_cost_log` migration/retirement decision must be approved.
4. Durable storage must provide atomic execution guard plus append-only attempt and usage events.
5. Provider request IDs and invoice reconciliation must be demonstrated with a real sandbox response.
6. Telemetry migration must be separate from Foundation migrations and receive backup, rollback, and exact-SHA approval.
7. Source Registry evidence remains non-AI-eligible until `RightsEvaluation(purpose=ai_input, basis=allowed)` exists.
8. Foundation routes, responses, migrations, flags, and runtime wiring must remain unchanged by this PR.

This change stops before every production approval boundary.
