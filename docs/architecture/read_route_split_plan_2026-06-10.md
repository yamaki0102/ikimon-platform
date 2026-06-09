# Read Route Split Plan

Purpose: reduce `platform_v2/src/routes/read.ts` without changing user-facing behavior.

## Rule

Do not split by visual theme first. Split by dependency boundary and route lane, keeping each step typecheck-green.

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
