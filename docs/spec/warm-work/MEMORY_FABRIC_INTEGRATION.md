# ZUKAN Memory Fabric Integration

Status: CANDIDATE PROFILE
Parent: `docs/spec/warm-work/SPEC.md`
Shared architecture: `yamaki0102/all-projects-management/operations/work_fabric/MEMORY_WORK_FABRIC_v1.md`

ZUKAN adopts the shared Memory + Work Fabric principle without changing its Knowledge Core authority model.

## Boundary

ZUKAN canonical Record, Claim/ClaimRevision, Source, Evidence, Rights, Review, Resolution and Publication state remain authoritative according to the active ZUKAN product architecture.

Compiled Memory Editions, Context Packs, retrieval indexes, summaries and Artifacts-backed caches are rebuildable projections. They never replace Record/Claim/Evidence or Review authority.

## Useful Memory Editions

Initial ZUKAN compiled memory targets include:

- Place current context;
- Entity current context;
- Taxon / Identification review context inside the Biodiversity Pack;
- Quest / Program current context;
- recent changes and corrections;
- verified review patterns;
- code/development Work Memory for `platform_v2`.

Each edition remains purpose-, rights-, time- and source-bound. Public-safe editions are distinct from restricted/internal editions.

## Context compilation

A user/agent request should resolve purpose, rights, Place/Entity/Record anchors and currentness before context allocation. The Context Compiler then selects the minimum relevant Memory Editions and Evidence refs rather than sending the full regional corpus or entire project history to a model.

Where a prior compiled edition remains valid, reuse is preferred. When a Record, ClaimRevision, Review, Rights policy or relevant source edition changes, affected compiled context is invalidated and rebuilt incrementally.

## Artifacts

Cloudflare Artifacts may back compiled context and software Work state. It is not the source of biological, regional, publication or rights truth and must not become a direct publication authority.

Private NOCOSIL memory cannot be used as ZUKAN context except through explicit rights-safe exchange/publication. Public ZUKAN knowledge may be referenced by NOCOSIL under the receiving Workspace's purpose and policy.

## Development acceleration

For software Work, ZUKAN should reuse exact baseline-derived Context Packs, affected-test maps, dependency/build caches and verified repair history so that agents read only the changed/relevant surface of `platform_v2` where safe.

Prior success never waives fresh validation for security, rights, migration, release or public behavior changes.

## Acceptance

A later staging proof should demonstrate both:

1. product-memory behavior: an unchanged regional context edition is reused, a changed Claim/Review invalidates only affected context, and unauthorized/private context is denied;
2. software-work behavior: a ZUKAN Work Object resumes on a different executor using durable Context/Artifacts state and runs only the required validation set plus mandatory fresh gates.
