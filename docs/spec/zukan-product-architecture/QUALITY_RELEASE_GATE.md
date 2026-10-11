# ZUKAN Milestone Quality / Release Gate

Status: DRAFT CANDIDATE
Scope: M6 and later milestones

## Principle

A slice is not a product release. Targeted tests prove the slice; milestone hardening proves the product remains usable; production read-back proves reflection.

## Gate A — Slice verification

Required for each coherent slice before `staging LIVE_VERIFIED`:

- targeted source/contract/negative tests
- Product Registry trace validity
- typecheck
- exact-source staging deploy/read-back
- focused real-browser Golden Journey for the changed behavior
- console/network failure review for that Journey

Do not rerun unrelated Verified M1-M5 Evidence without invalidation.

## Gate B — Milestone UX hardening

Required once after all slices of a milestone are staging-verified, before production promotion.

Run on the exact milestone source:

- full Node regression (`test:node`)
- Product Registry suite
- full relevant staging E2E set; use existing `e2e:staging`, visual-regression and runtime QA assets rather than inventing another framework
- visual regression / route coverage for all required Product Registry Surfaces
- 375 / 768 / 1280 / 1440 viewport audit of primary journeys
- authenticated and unauthenticated states where applicable
- loading / empty / denied / validation-error / retry / error states on changed surfaces
- keyboard/focus/form-label/basic semantic accessibility pass
- broken-link, overflow, clipping, duplicate CTA, contradictory copy, stale navigation and dead-end audit
- console errors, failed first-party requests and unexpected redirects = 0 on Golden Journeys

Qualitative UX verdict belongs to Noah/product review. Executor records observations and fixes already-canonical defects; it does not choose new product direction.

Release blocker:

- any P0/P1 functional, privacy, rights, authorization or UX defect
- a Golden Journey that cannot be completed without developer/operator intervention
- mobile or desktop primary flow unusable
- source/runtime identity mismatch

## Gate C — Milestone production promotion

Do not request production approval for every slice by default.

After Gate B passes:

1. freeze one exact milestone source SHA
2. obtain one exact-source owner approval
3. promote through the registered native release path
4. verify production runtime identity/read-back
5. run registered production smoke/read-only critical journeys
6. run production writes only when they are explicitly inside the approved bounded release verification and have a cleanup/rollback path
7. verify rollback locator
8. register production Evidence and resolve milestone status

Milestone terminal state requires production `LIVE_VERIFIED` when production reflection is part of the requested outcome.

## Gate D — Post-release product check

After production promotion:

- verify canonical `zukan.earth` reflects the approved exact source
- verify the changed primary Journey on production at least read-only; perform bounded write verification only when approved
- confirm no navigation regression across Home / Capture / Records / Map / Member Home / Program surfaces
- record only new defects or invalidation; do not rebuild equivalent Evidence for reassurance

## M6 application

M6.1 Activation and M6.2 Participation are staging slices, not separate production releases.

M6 closes only after:

- M6.2 Participation staging verification
- M6.3 review → recap → safe template rehost staging verification
- free recap respects the adopted commercial boundary: operational metrics are free; taxon/species inventory, species counts/composition/comparison/report-ready output are not silently exposed as free-core derivatives
- Gate B full milestone UX/regression pass
- one exact-source M6 production promotion and Gate C/D verification

M5 remains deferred unless a separate Noah/owner decision changes it.
