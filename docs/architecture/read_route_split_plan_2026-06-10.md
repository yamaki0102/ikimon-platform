# Read Route Split Plan

Purpose: reduce `platform_v2/src/routes/read.ts` without changing user-facing behavior.

## Rule

Do not split by visual theme first. Split by dependency boundary and route lane, keeping each step typecheck-green.

## 2026-06-29 Safety Gate Update

Double external review confirmed the route split is important, but not the first risk boundary by itself.

Before moving more `read.ts` surface area, keep public location visibility as a single authority:

- Public / anonymous / other-user map surfaces must not emit raw observation coordinates.
- Viewer-owned observation and trace surfaces may expose the viewer's own exact capture / track coordinates.
- Any new public map/list/trace endpoint that needs coordinates must route through `platform_v2/src/services/publicLocation.ts`.
- Location leakage tests must cover anonymous public output and viewer-owned exact output before each route-lane cut.

Acceptance checks for the next route split:

- `npm --prefix platform_v2 run typecheck`
- focused location tests from `platform_v2/`: `npm exec -- tsx --test src/services/publicLocation.test.ts src/services/mapSnapshot.test.ts`
- moved-lane route tests for the affected surface

## Completed First Cut

- Moved specialist read-only JSON endpoints to `platform_v2/src/routes/specialistReadApi.ts`.
- Left specialist SSR pages in `read.ts` because they depend on local layout/render helpers.

## Next Cuts

1. Move remaining specialist SSR pages after extracting shared authority card render helpers.
2. Move observation list/detail API helpers before moving large page HTML blocks.
3. Move `/notes`, `/lens`, `/map`, and `/guide` after shared layout and route copy are no longer local to `read.ts`.

## Gate

Each cut must pass:

- `npm run typecheck`
- focused route tests touching the moved lane
- `npm run test:node` before deploy eligibility
