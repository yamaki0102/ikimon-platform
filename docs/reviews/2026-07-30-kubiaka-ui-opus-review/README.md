# Kubiaka private-pilot UI — Opus review packet

## Review order

1. `REVIEW_REQUEST.md`
2. `visual-preview.html`
3. `VISUAL_QA.md`
4. `proposed/platform_v2/src/content/kubiakaExperience.ts`
5. `proposed/platform_v2/src/routes/kubiakaExperience.ts`
6. `proposed/platform_v2/src/routes/kubiakaExperience.routes.test.ts`
7. `proposed/platform_v2/src/ui/kubiakaExperience.ts.part00` through `part03`
8. `proposed/platform_v2/src/app.ts.diff`
9. `proposed/docs/implementation/kubiaka-private-pilot-ui-slice_2026-07-29.md`

The four UI parts are consecutive byte ranges of one proposed file. Concatenate `part00`, `part01`, `part02`, and `part03` in that order to reconstruct `platform_v2/src/ui/kubiakaExperience.ts`.

## Canonical context

- Parent safety PR: `yamaki0102/ikimon-platform#1498`
- Parent exact head at packet creation: `fb47e198a828ab37f5935e84c17c30c757b6f186`
- Product strategy: **Receipt-first, Map-later**
- Superseded PR `#1492` must not be used.

## Boundary

This is a review-only packet. It does not wire the proposed route into runtime, apply a database migration, deploy, activate routing, publish a map, or send data externally.
