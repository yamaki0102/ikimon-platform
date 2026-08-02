# ZUKAN Product Experience Registry

This directory is the machine-readable product contract for ZUKAN's main user-facing experience.

## Files

- `product.json`: product identity, required surfaces, global registry rules
- `surfaces.json`: pages/screens, roles, privacy, capabilities, states, entry points, transitions
- `capabilities.json`: user/system abilities, write failure and retry contracts, prohibited side effects
- `journeys.json`: end-to-end user goals and required outcomes
- `design.json`: foundation, brand, archetype, surface design contracts, time-bounded exceptions
- `content.json`: audience, message, CTA, prohibited claims, SEO and analytics contracts
- `quality.json`: acceptance criteria, state coverage, tests and release gates

## Validation

```bash
cd platform_v2
npx tsx src/scripts/checkProductRegistry.ts
npm run typecheck
npm run test:node -- --test-name-pattern="product registry|kubiaka"
```

`src/productRegistry.test.ts` runs under the normal `test:node` glob and fails when:

- a required surface is missing
- a registered route does not exist in `siteMap.ts` or the Kubiaka route constants
- a capability, transition, entry point, design/content/quality contract points to an unknown ID
- owner-only surfaces omit the denied state
- write capabilities omit failure or retry contracts
- design or quality contracts omit a registered state
- a Journey points to unknown surfaces or states
- a design exception lacks a rule, reason, owner or expiry

## Update rule

Any change to a main route, CTA, privacy boundary, user-visible state, campaign message, design exception, or release test must update this registry in the same PR.

The registry does not replace source code or runtime evidence. Source code remains the implementation truth; exact-SHA staging and runtime read-back remain the release truth. This registry is the contract that makes drift between intent, implementation, design and tests detectable.
