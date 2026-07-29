# ZUKAN Context / AI Usage v4 — source implementation boundary

- Base: `yamaki0102/ikimon-platform@351f80398241dc1ba88894779466ce40339a1c90`
- Date: 2026-07-29
- State: source-only candidate; no migration, deploy, flag, route, secret, or production mutation

## Implemented in this change

1. `aiUsageControl.ts`
   - deterministic execution key
   - `AiUsageRepository` persistence boundary
   - in-memory repository explicitly limited to test/development
   - mutable execution guard with expiring lease
   - append-only attempt events
   - append-only usage and reconciliation adjustment events
   - USD-micro request/hour/feature-month/tenant-month budget decisions
   - retry count, fallback depth, and provider-failure limits
2. `aiUsageLegacyCostProjection.ts`
   - bounded projection into the existing `ai_cost_log` shape
   - provider request ID, pricing version, raw usage, cache, retry, and fallback details retained in metadata
   - negative reconciliation adjustments are not silently projected because the existing table forbids negative cost
3. `zukanSourceImportEvidenceEnvelope.ts`
   - Source Registry read-only evidence is explicitly separated from ContextPacket
   - rights `unknown` always blocks `ai_input`
   - payload digest excludes its own digest field
4. `zukanContextPacketContract.ts`
   - real `ResolutionRun` identity is mandatory; synthetic runs are unsupported
   - reproducible semantic payload is separated from request-specific generation/authorization receipt
   - four time axes, fact-level rights evidence, completeness, conflicts, and governance are retained
   - set-like arrays are normalized before hashing
   - AI-facing `ModelInputEnvelope` is separate and binds both packet digest and receipt ID
5. Provider boundary
   - central `aiModelRouter.ts` imports Google SDK symbols through `services/providers/googleGenAiSdk.ts`
   - new direct SDK imports are rejected by test
   - five remaining legacy direct imports are explicitly owned, justified, and time-bounded to 2026-09-30
6. Regression tests
   - lease retry and settled duplicate behavior
   - append-only usage plus reconciliation adjustment
   - cost, retry, fallback, and provider-failure budget rejection
   - deterministic Source evidence / Context / ModelInput digests
   - Context payload / authorization receipt separation
   - fail-closed rights admission
   - bounded legacy cost projection
   - provider adapter boundary

## Existing cost infrastructure

The repository already contains PostgreSQL `ai_cost_log`, `aiCostLogger.ts`, and `aiBudgetGate.ts`.
They are not replaced or modified by this source-only change. The existing implementation is JPY-led,
logs mainly successful calls, and the budget gate has no confirmed runtime call site.

Do not create a second authoritative cost ledger. Before persistence work, choose and document one path:

1. evolve `ai_cost_log` additively into the authoritative usage/reconciliation event store; or
2. introduce a replacement store with a bounded compatibility projection and an explicit retirement date for `ai_cost_log`.

Parallel indefinite accounting is prohibited. The compatibility projection added here is not an authoritative
second ledger and is not runtime-wired.

## Deliberately not implemented

- Foundation v2 PostgreSQL `0134`–`0139` or D1 `0009`–`0014` changes
- AI telemetry migration or migration application
- durable PostgreSQL/D1 implementation of `AiUsageRepository`
- changes to existing `ai_cost_log`, `aiCostLogger`, or `aiBudgetGate`
- runtime wiring of the compatibility projection
- `SHADOW_READ`, `DUAL_WRITE`, or kill-switch changes
- Foundation runtime adapter wiring
- Source Registry write/apply
- synthetic `ResolutionRun`
- ContextPacket generation from Source Registry dry-run evidence
- Action Plane, external send, publication, merge, staging, or production deploy

## Production gate

Before persistence or runtime wiring, all of the following are required:

1. TypeScript compile and full node test suite green.
2. Provider boundary test is green and the five legacy direct imports are migrated or their expiry is explicitly re-approved.
3. The `ai_cost_log` migration/retirement decision is approved; two authoritative ledgers are not allowed.
4. Durable `AiUsageRepository` storage design is approved as three concerns:
   - atomic mutable execution guard;
   - append-only attempt events;
   - append-only usage/reconciliation events.
5. Provider request IDs and invoice reconciliation are demonstrated with a real provider sandbox response.
6. Any telemetry migration is separate from Foundation v2 migrations and receives its own backup, migration, rollback, and exact-SHA approval.
7. Source Registry evidence remains non-AI-eligible until concrete `RightsEvaluation(purpose=ai_input, basis=allowed)` exists.
8. Foundation routes, responses, migrations, flags, and runtime wiring remain unchanged by this PR.

This change stops before every production approval boundary.
