# ADR-002: ZUKANのRecord・Claim・Publication・Action境界

- Status: accepted
- Date: 2026-07-29
- Contract: `docs/spec/zukan-product-architecture/SPEC.md`

## Context

The current runtime grew from biodiversity observation features. Its strongest reusable assets are provenance, evidence, review, rights, Place linkage, publication and reporting controls.

Using the current `Observation`, `Occurrence`, `Taxon` or invasive-reporting model as the universal parent would preserve implementation convenience at the cost of incorrect semantics. A document, testimony, event, heritage record and road-maintenance outcome are not biological occurrences.

The opposite shortcut—putting every domain into generic `subject / issue / severity` rows—would erase specialist vocabulary, evidence requirements and liability boundaries.

## Decision

Use the following stable responsibilities:

- `Record`: immutable account of submission, acquisition, observation, activity or result
- `Claim / ClaimRevision`: correctable assertion about a Place or Entity
- `Source / Evidence`: independent provenance objects referenced by Records and Claims
- `Place / Entity Identity`: stable axes with time-scoped assertions
- `PublicationEdition`: frozen output for an audience and purpose
- `Case`: optional response workflow, separate from canonical knowledge

`Observation` is a Record kind. Biodiversity `Occurrence`, `Taxon` and `Identification` remain inside the Biodiversity Domain Pack.

Knowledge and Action connect only when Assessment reads stable references and when a Case result returns as a new Record.

## Safety decision

ZUKAN is not an emergency channel and does not infer a guaranteed response SLA from a queued or sent operation.

Specialist safety conclusions require an explicitly accountable reviewer or integrated specialist service. A general-purpose model result is only a candidate.

## Rejected alternatives

### Make Observation the universal root

Rejected because documents and historical sources would have to masquerade as observations and because current biodiversity semantics would leak into every domain.

### Rename Taxon/Occurrence into Subject/Record

Rejected because it would weaken a valid specialist model and create a high-risk migration with no user value.

### Generic subject/issue/severity EAV

Rejected because evidence protocol, review authority, publication rules and liability differ by domain. Shared structure is implemented as a contract plus Domain Packs, not as one untyped table.

### Put action workflow inside Claim state

Rejected because Claims are corrected and projected over time, while Cases have restricted permissions, deadlines and terminal workflow states.

### Make Source a Record payload

Rejected because a Source has independent editions, fixity, rights, fragments and derived objects and may support many Records and Publications.

## Consequences

Positive:

- non-biological regional knowledge can use the common core without rewriting biodiversity
- original records survive correction and response
- publication and official writeback remain traceable
- specialist and emergency liability boundaries are explicit

Costs:

- additional references and projections are required
- the system cannot treat every AI output as a directly publishable field
- Action/Reporting generalization must wait for a concrete accountable use

## Compatibility

This ADR changes no current route, database row, migration, public response or deployment. The first implementation is a pure shadow planner and contract tests.
