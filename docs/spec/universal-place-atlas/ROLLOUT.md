# Universal Place Atlas rollout and rollback

## Expand

1. Apply additive PostgreSQL and D1 schema in fresh and existing test databases.
2. Keep `place_atlas_v2_enabled=0`.
3. Deploy read-compatible code; v1 remains the default profile.
4. Run source ingest and Record membership backfill with `--dry-run`.
5. Review totals, ambiguous rows, skipped reasons, and exact-location leak tests.

## Staging canary

1. Enable generic discovery for `park` and `theme_park`.
2. Verify 常磐/常盤 and JUNGLIA.
3. Enable `shopping_mall` and `commercial_complex`.
4. Verify the selected Hamamatsu AEON Mall and dedupe.
5. Verify a school/restricted place and public-cell fallback.
6. Run six-width and browser Visual QA on the exact staging SHA.

## Production boundary

Production deploy and production D1 migration require an active explicit
approval in the central gate. Absence of that approval results in
`NEEDS_PRODUCTION_APPROVAL`.

## Forward rollback

1. Set the rollout state to disabled through the approved operations lane.
2. Return search/profile routing to v1 and disable generic commercial discovery.
3. Leave additive tables and source/audit evidence intact.
4. Verify map, public-cell fallback, and v1 常磐公園 profile.

No destructive down migration, source Record mutation, or membership deletion
is part of routine rollback.
