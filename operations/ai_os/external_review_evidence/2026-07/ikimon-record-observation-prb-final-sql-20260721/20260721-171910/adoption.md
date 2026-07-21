# Final SQL review adoption

## Review status

- paired review status: `partial`
- Claude model: `claude-opus-4-8`; invocation succeeded but the raw response contains only attempted tool-call narration and no substantive verdict
- Gemini paired-review model: `gemini-3-flash-preview`; verdict `approve` before validation-trigger hardening
- final trigger review model: `gemini-3-flash-preview`; verdict `approve with changes`
- final trigger raw review: `final-trigger-gemini-review.md`

## Adopted

- limited the observation eligibility trigger to the four state columns it evaluates;
- made projection claim/consent foreign keys deferred;
- changed active rights/privacy/quality JSON checks to fail closed with `COALESCE(..., FALSE/0)` when keys are missing;
- retained aborting validation triggers instead of automatic state-changing triggers;
- documented the D1 write order: insert an observation with no accepted pointer, then insert the human claim and update the pointer in one batch.

## Rejected or deferred

- Rejected adding `PRAGMA foreign_keys = ON`: Cloudflare D1 documentation states that foreign keys are enforced for all queries and migrations by default, equivalent to SQLite with that pragma enabled.
- Rejected an extra index on `operation_key`: its `UNIQUE` constraint already creates the lookup index.
- Deferred claim timestamp ordering to the shared transition service because mixed timestamp text formats make a D1 lexical constraint unsafe; actor, decision and non-null decision timestamp are already mandatory.
- Classified large backfill performance as a PR-D batch-design gate. Migration replay creates schema only and does not fire row triggers.

## Verification after adoption

- D1 empty/replay/legacy fixture/negative constraint tests pass.
- PostgreSQL 16 fresh apply and replay pass in an ephemeral local container.
- Full Node suite: 1,356 passed.
- Cloudflare quick suite: 315 passed.

## Primary documentation consulted

- https://developers.cloudflare.com/d1/sql-api/foreign-keys/
- https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
