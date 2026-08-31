# ZUKAN Product Experience Registry

This directory is ZUKAN's machine-readable product and delivery contract. It evolves the existing Registry; do not create a parallel product-management framework.

Canonical chain:

`Outcome → Golden Journey → Capability → Requirement → Design → Dependency → Roadmap → Task → Acceptance/Eval → Runtime Evidence → Learning`

## Files

- `product.json`: identity, canonical chain, required surfaces, registry index
- `outcomes.json`: North Star, actor jobs, intent/source/runtime/learning truth separation
- `surfaces.json`: actual user-facing routes/states/transitions and source binding
- `capabilities.json`: current capabilities plus capture/records/map/home/workspace matrix
- `journeys.json`: actor-based Golden Journeys, success/recovery and Requirement trace
- `requirements.json`: stable product/trust/resilience contracts; `status` is legacy source hint only
- `design.json`: visible states, layout/interaction contracts and bounded exceptions
- `content.json`: audience/message/CTA/prohibited claims/SEO/analytics contracts
- `quality.json`: acceptance, existing test binding, negative/property contracts, desktop/mobile Journey evaluator
- `delivery.json`: Requirement dependency graph, next 1–2 detailed milestones, deterministic next-slice and Luna task rules
- `evidence.json`: evidence record contract and derived `planned → source-only → staging-verified → production-verified` progression
- `learning.json`: production learning, evidence invalidation and explicit spec supersession loop

## Truth and status

- Intent truth: Registry stable contract. It does not imply implementation.
- Source truth: exact git SHA source/test/build evidence. It does not imply runtime.
- Runtime truth: exact environment identity plus observed Journey/privacy behavior.
- Learning truth: production observation. It may invalidate evidence or propose supersession but never silently rewrites stable intent.

Progression is evidence-derived. `blocked`, `stale`, and `unknown` are orthogonal flags. Production being on the current SHA is runtime-active, not automatically production-verified.

## Update flow

1. Change the stable Requirement/Golden Journey first when behavior meaning changes.
2. Follow `delivery.json` dependencies and select the smallest unmet topological frontier.
3. Give Luna only `Source / Delta / Done`; do not delegate product strategy, privacy/publication meaning, or scope expansion.
4. Implement against current source; reuse existing tests/evidence before creating new mechanisms.
5. Run static/integration/desktop+mobile Journey and negative/property evaluation as required.
6. Bind exact runtime identity before claiming staging/production verification.
7. Record production learning; invalidate evidence or supersede the contract explicitly.

Only the next 1–2 milestones are detailed. Later work stays dependency-centered until it becomes the active frontier. Workspace/collaboration is product intent and remains planned until current source/runtime evidence proves otherwise. Do not pre-abstract with NOCOSIL.

## Validation

```bash
cd platform_v2
npx tsx src/scripts/checkProductRegistry.ts
npm run test:product-registry
npm run typecheck
```

The registry tests fail on route/surface drift, missing state/transition contracts, unsafe write contracts, unknown Requirement references, incomplete Requirement coverage, dependency cycles, roadmap gaps, invalid evidence references, and non-deterministic task-chain drift.

## Privacy/trust invariants

Private/unknown/rejected/quarantined/blocked content fails closed on public projections. Exact coordinates are not a public projection. Face/person/living-place/private-land risk never silently expands public scope. AI output is a candidate, not human/expert verification. Public reuse permission is not external inference permission. Existing data, visibility, consent and rights are preserved unless an explicit approved migration changes them.
