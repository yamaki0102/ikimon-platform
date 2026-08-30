# ZUKAN Product Experience Registry

This directory is the machine-readable product contract for ZUKAN's main user-facing experience.

## Files

- `product.json`: product identity, required surfaces, global registry rules
- `surfaces.json`: pages/screens, roles, privacy, capabilities, states, entry points, transitions
- `capabilities.json`: user/system abilities, write failure and retry contracts, prohibited side effects
- `journeys.json`: end-to-end user goals, required outcomes and stable requirement references
- `design.json`: foundation, brand, archetype, surface design contracts, time-bounded exceptions
- `content.json`: audience, message, CTA, prohibited claims, SEO and analytics contracts
- `quality.json`: acceptance criteria, stable requirement references, state coverage, tests and release gates
- `requirements.json`: product-owned stable requirement IDs, acceptance meaning, required evidence lanes, verification levels and selective-invalidation keys

Requirement meaning and the evidence categories affected by a product change belong here. Evidence claim IDs, Collector authority, freshness, evidence identity and SHA-binding rules belong to the central Universal Outcome Resolver and are intentionally not duplicated in this repository.

## Validation

```bash
cd platform_v2
npx tsx src/scripts/checkProductRegistry.ts
npm run typecheck
npm run test:node -- --test-name-pattern="product registry|requirements|quality contracts"
```

`src/productRegistry.test.ts` and `src/productRegistryRequirements.test.ts` run under the normal `test:node` glob and fail when:

- a required surface is missing
- a registered route does not exist in `siteMap.ts`
- a capability, transition, entry point, design/content/quality contract points to an unknown ID
- owner-only surfaces omit the denied state
- write capabilities omit failure or retry contracts
- design or quality contracts omit a registered state
- a Journey points to unknown surfaces or states
- a stable requirement is duplicated, empty, references an unknown quality contract or is not referenced by quality/journey data
- a requirement has an unknown/duplicate evidence lane or verification level, or an empty/invalid selective-invalidation key
- a design exception lacks a rule, reason, owner or expiry

## Update rule

Any change to a main route, CTA, privacy boundary, user-visible state, campaign message, design exception, stable requirement, or release test must update this registry in the same PR.

The registry does not replace source code or runtime evidence. Source code remains the implementation truth; exact-SHA staging and runtime read-back remain the release truth. This registry is the contract that makes drift between intent, implementation, design and tests detectable.
