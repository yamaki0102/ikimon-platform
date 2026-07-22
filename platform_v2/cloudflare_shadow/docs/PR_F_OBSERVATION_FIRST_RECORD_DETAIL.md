# PR-F: observation-first record detail cutover

## Scope

The record-detail reader can now render one record container with zero, one, or many observation cards. Each card keeps owner, AI, community, curator, and imported provenance separate. AI suggestions remain provisional and a candidate claim is never presented as an accepted human decision.

Owner-only no-JavaScript forms support split, merge, exclude, restore, and media reassignment. Public candidate-identification forms follow the record policy. Private and limited records fail closed for non-owners. Pet, unknown subject, and group records receive explicit labels.

## Flags and rollout

- `OBSERVATION_READ_CUTOVER_MODE=on` selects the new reader.
- `OBSERVATION_DUAL_WRITE_MODE=on` is additionally required for every observation-first mutation.
- Both flags default to `off` in shadow, staging, and production configuration in this PR.
- With the read flag off, the existing record reader remains unchanged.
- If the new read model is absent, the Worker falls back to the verified existing reader without changing data.

Rollout order is staging dual-write, staging shadow comparison, staging read cutover, production deploy with both flags off, production dual-write, production read cutover. Rollback is both flags off plus the prior verified Worker version. Additive schema is retained; no reverse migration or destructive cleanup is required.

## Privacy and authority

The new reader queries no latitude, longitude, cell, mesh, geohash, object key, or coordinate-derived identifier. Media URLs come from the existing public-derivative projection. Exact location is never included in the record-detail model. Accepted identification is shown only when `accepted_identification_id` references an accepted human claim. AI suggestions are displayed in a separate provisional section and are never counted as community activity.

POST actions require both feature flags, a same-origin request, a valid session, record-level policy checks, target membership checks, and deterministic action-specific idempotency keys. Owner lifecycle changes preserve rows and write lifecycle evidence; no delete path is introduced.

## Verification

- TypeScript check
- full Worker test suite, including foundation migration and controlled-backfill replay tests
- focused lifecycle, read-model, privacy, and no-JavaScript HTML contract tests
- Wrangler shadow dry-run
- staging and production command-bus exact-SHA chain
- at least 100 old/new shadow comparisons with zero unexplained P0/P1 and zero privacy findings before read cutover
- visual QA at 320, 375, 390, and desktop widths, plus keyboard/focus/label/contrast smoke
