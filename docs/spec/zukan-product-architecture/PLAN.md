# ZUKAN Product Architecture — Implementation Plan

- Status: active plan
- Contract: `SPEC.md`
- Strategy decision: `yamaki0102/ikimon-business-strategy/decisions/2026-07-29-zukan-product-architecture-and-safety-boundary.md`

## Goal

Prove one non-biological regional Record through the common semantic boundary without changing the current public runtime, production data or biodiversity behavior.

## Stage 0 — Product contract

- add the three-layer architecture contract
- fix Record, Claim, Source, Place, Publication and Case responsibilities
- make biodiversity a Domain Pack, not the service boundary
- record the non-emergency and specialist-liability boundary

Exit:

- the contract is linked from `docs/START_HERE.md` and `PROJECT.json`
- a regression test rejects a return to the biodiversity-only product framing

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

Exit:

- targeted node tests pass
- no runtime route imports the planner
- no DB write is possible from the planner

## Stage 2A — Additive generic Record schema

Add first-class persistence primitives without enabling a writer or reader.

Required schema:

- immutable `zukan_records`
- append-only Record-to-Subject links
- append-only Record-to-SourceEdition links with source selector
- append-only ClaimRevision-to-Record links
- monotonic Record sequence
- tenant/workspace scope checks
- payload stored as a distinct erasable ValueArtifact

Rules:

- PostgreSQL and D1 must express the same semantic boundary
- existing Occurrence, Taxon, Observation and biodiversity rows are not migrated
- SourceEdition is referenced; source bytes and layouts are not copied into Record
- Record payload and Claim values remain separate artifacts
- schema application alone cannot activate writes or public reads
- Record governance/public projection remains blocked until status-event and reader contracts exist

Required evidence:

- migration source checks
- D1 scratch apply and insert
- mutation rejection
- cross-tenant Subject, Source and Claim-link rejection
- pinned workerd migration apply
- migration baseline head update

## Stage 2B — Dry-run Foundation mapping

Map the Stage 1 envelope to the Stage 2A schema without applying it.

The plan must produce:

- Record payload ValueArtifact
- Record row
- Subject links
- SourceEdition links
- Claim value artifacts
- Claims and first ClaimRevisions
- ClaimRevision-to-Record links
- explicit dependencies for Subject, SourceEdition, Predicate and Rights rows

Rules:

- `writeEnabled=false`
- only registered predicate URI/version pairs are accepted
- public candidates require accountable Review and Rights dependencies
- unsupported PostgreSQL/D1 semantic drift fails closed
- Publication candidates do not bypass ResolutionRun and ProjectionSnapshot

Exit:

- deterministic dry-run plan
- Record and Claim artifacts are distinct
- equivalent ordering produces the same digest
- unknown predicates and non-canonical references are blocked

## Stage 2C — Shadow writer rehearsal

Only after Stage 2A and 2B are independently green:

- implement an explicit operation and idempotency key
- use a dedicated shadow tenant allowlist
- keep kill switch active by default
- write PostgreSQL scratch first
- add D1 only when a real runtime projection requires it
- prove replay, conflict, rollback and tenant isolation

No staging or production DB application is authorized by this plan alone.

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
npm --prefix platform_v2/cloudflare_shadow run check
```

Targeted tests must cover:

- deterministic ID and digest generation
- Record/Claim separation
- Source/Evidence reference integrity
- reorder invariance
- migration parity and append-only behavior
- tenant/workspace scope rejection
- unknown predicate and rights gates
- emergency action rejection
- specialist conclusion rejection without an accountable reviewer
- unknown provenance represented explicitly rather than invented

## Rollback

Before merge, close the branch.

After merge but before any DB apply, revert the source PR.

After an additive migration is applied, disable every Record writer/reader and retain the audit-bearing tables. Do not drop populated Record tables as the normal rollback.

## Stop conditions

Stop before enabling a writer when any of the following is true:

- the first use can be completed without reusing the Record/Claim boundary
- a generic schema requires deleting or renaming the biodiversity model
- Source or Evidence would need to be embedded into Record payloads
- a Case would become the owner of evidence or canonical truth
- the use requires emergency response guarantees
- the accountable reviewer or publication owner is unknown
- Record suppression/withdrawal cannot be propagated before a public reader exists
- PostgreSQL and D1 semantics diverge without an explicit single-store decision
