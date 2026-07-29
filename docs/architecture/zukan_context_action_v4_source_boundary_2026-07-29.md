# ZUKAN Context / AI Usage v4 — source implementation boundary

- Base: `yamaki0102/ikimon-platform@351f80398241dc1ba88894779466ce40339a1c90`
- Date: 2026-07-29
- State: source-only candidate; no migration, deploy, flag, route, secret, or production mutation

## Implemented in this change

1. `aiUsageControl.ts`
   - deterministic execution key
   - mutable execution guard with expiring lease
   - append-only attempt events
   - append-only usage and reconciliation adjustment events
   - USD-micro request/hour/feature-month/tenant-month budget decisions
2. `zukanSourceImportEvidenceEnvelope.ts`
   - Source Registry read-only evidence is explicitly separated from ContextPacket
   - rights `unknown` always blocks `ai_input`
   - payload digest excludes its own digest field
3. `zukanContextPacketContract.ts`
   - real `ResolutionRun` identity is mandatory; synthetic runs are unsupported
   - principal, tenant/workspace scope, authorization evidence, four time axes, fact-level rights evidence, completeness, conflicts, and governance are retained
   - AI-facing `ModelInputEnvelope` is separate and can only use admitted facts
4. Regression tests
   - lease retry and settled duplicate behavior
   - append-only usage plus reconciliation adjustment
   - four-layer budget rejection
   - deterministic Source evidence / Context / ModelInput digests
   - fail-closed rights admission
   - baseline test preventing new direct `@google/genai` imports

## Deliberately not implemented

- Foundation v2 PostgreSQL `0134`–`0139` or D1 `0009`–`0014` changes
- new remote migration or migration application
- `SHADOW_READ`, `DUAL_WRITE`, or kill-switch changes
- Foundation runtime adapter wiring
- Source Registry write/apply
- synthetic `ResolutionRun`
- ContextPacket generation from Source Registry dry-run evidence
- Action Plane, external send, publication, merge, staging, or production deploy

## Production gate

Before persistence or runtime wiring, all of the following are required:

1. TypeScript compile and full node test suite green.
2. Review confirms the direct-provider import baseline is complete.
3. Storage design is approved as three concerns:
   - mutable execution guard;
   - append-only attempt events;
   - append-only usage/reconciliation events.
4. Provider request IDs and invoice reconciliation are demonstrated with a real provider sandbox response.
5. Any new telemetry migration is separate from Foundation v2 migrations and receives its own backup, migration, rollback, and exact-SHA approval.
6. Source Registry evidence remains non-AI-eligible until concrete `RightsEvaluation(purpose=ai_input, basis=allowed)` exists.

This change stops before every production approval boundary.
