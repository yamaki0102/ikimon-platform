# ZUKAN Product Architecture — Implementation Plan

- Status: active plan
- Contract: `SPEC.md`
- Strategy decision: `yamaki0102/ikimon-business-strategy/decisions/2026-07-29-zukan-product-architecture-and-safety-boundary.md`

## Goal

Prove one non-biological regional Record through the common semantic boundary without changing the current public runtime, database state or biodiversity behavior.

## Product delivery roadmap

The dependency order for the Product Registry and later implementation is:

1. M1 — Personal Record/media integrity
2. M2 — Safe Publication + rights/data lifecycle
3. M3 — Program/Event/Quest/Workspace collaboration
4. M4 — Regional knowledge / PublicationEdition / portability / correction
5. M5 — Live-camera POC

Live-camera remains deferred until M5. The Registry supplies static navigation only; resolved status and executor eligibility come from `operations/ai_os/verified_outcome_status_resolver.mjs#resolveStatus`.

## Stage 0 — Product contract

- add the three-layer architecture contract
- fix Record, Claim, Source, Place, Publication and Case responsibilities
- make biodiversity a Domain Pack, not the service boundary
- record the non-emergency and specialist-liability boundary
- load stable requirements through the normal Product Registry loader
- validate evidence lanes, verification levels, invalidation keys and quality/journey references

Exit:

- the contract is linked from `docs/START_HERE.md` and `PROJECT.json`
- a regression test rejects a return to the biodiversity-only product framing
- Product Registry tests reject unknown evidence lanes and incomplete invalidation contracts

## Stage 1 — Source-only shadow envelope

Implement a pure TypeScript planner that accepts:

- one immutable Record input
- Place / Entity references
- SourceEdition / Evidence references
- zero or more Claim candidates
- an optional non-emergency Action candidate

The planner must:

- create deterministic opaque IDs
- canonicalize arrays and payloads
- keep Record and Claim objects separate
- keep Source and Evidence as references
- reject claims whose subject or evidence is outside the Record boundary
- reject emergency or guaranteed-SLA action requests
- emit `mode=shadow_only`
- remain stable when equivalent input arrays are reordered

First fixture:

- a non-biological regional source/heritage Record connected to an Iwata Place reference
- one name or status Claim supported by a SourceEdition reference
- one Publication candidate

The fixture is synthetic contract data and must not be presented as a verified real-world heritage fact.

Exit:

- targeted node tests pass
- no runtime route imports the planner
- no DB write is possible from the planner

## Stage 2 — Existing Foundation mapping

After Stage 1 review, map the envelope to the already-expanded Foundation v2 schema.

Rules:

- additive writer behind explicit feature flag and tenant allowlist
- a dedicated operation and idempotency key
- shadow tenant only
- no current public reader
- no existing Occurrence or biodiversity row migration
- SourceEdition and Evidence references must already exist or fail closed
- Claim predicate/version must exist or fail closed

Required evidence:

- dry-run diff
- deterministic replay
- conflict behavior
- transaction rollback
- tenant isolation
- PostgreSQL and D1 parity or an explicit decision to use only one store

## Stage 3 — Read-only regional View

Use a private or fixture-only reader to generate:

- one regional View candidate
- one Publication manifest candidate

The reader must not expose:

- private or restricted Records
- source payloads without republication rights
- unresolved high-impact identity merges
- candidate Claims as confirmed facts
- exact protected locations

Exit:

- the same Record/Claim selection is reproducible from a frozen input watermark
- Publication candidate records selected IDs, source editions, policy and exclusions

## Stage 4 — Real use validation

Select one concrete use with a named owner, output and writeback path.

Candidate:

- Iwata regional View and a cultural/history Publication output

Measure:

- input preparation time
- rights/review time
- correction flow
- reuse in more than one View or Publication
- whether an external source owner accepts or acts on a correction

Do not generalize Action/Reporting until a concrete non-emergency case requires it.

## Verification

Source change verification:

```bash
npm --prefix platform_v2 run typecheck
npm --prefix platform_v2 run test:node
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_zukan_product_registry.ps1
```

Targeted tests must cover:

- deterministic ID and digest generation
- Record/Claim separation
- Source/Evidence reference integrity
- reorder invariance
- emergency action rejection
- specialist conclusion rejection without an accountable reviewer
- unknown provenance represented explicitly rather than invented

## Rollback

Before merge, close the branch.

After merge, the Stage 1 planner is unused by runtime routes and has no database side effect. Reverting its files and documentation restores the previous source state. Foundation migrations and existing runtime data are not changed by this plan.

The evidence interoperability slice is also source-only. Reverting the requirement fields, loader validation, tests and ADR restores the earlier Product Registry without changing runtime or stored data.

## Stop conditions

Stop before enabling a writer when any of the following is true:

- the first use can be completed without reusing the Record/Claim boundary
- a generic schema requires deleting or renaming the biodiversity model
- Source or Evidence would need to be embedded into Record payloads
- a Case would become the owner of evidence or canonical truth
- the use requires emergency response guarantees
- the accountable reviewer or publication owner is unknown
