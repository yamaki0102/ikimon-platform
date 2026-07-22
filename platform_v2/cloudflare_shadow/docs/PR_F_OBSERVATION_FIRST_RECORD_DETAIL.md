# PR-F: observation-first record detail cutover

## Viewer presentation correction (2026-07-23)

The observation-first foundation remains canonical, while the normal record-detail presentation is media-first:

- record photos, videos, and audio appear once in a record-wide gallery before text or management state;
- zero observations produces no observation empty state; one observation does not emphasize a count; many observations share one summary with at most three visible rows;
- accepted human identification, AI suggestions, and community proposals remain separate, but full details open only after a viewer action;
- visual evidence and additional-shooting advice are rendered only when already present in `rationale_json`; seasonality, ecology, and regional context are not fabricated;
- the latest privacy-safe environment record is converted from internal values to a light viewer summary only when data exists;
- records without an active biological observation use durable assessment facts to distinguish completed non-detection from an unassessable photo, and neither state is presented as absence;
- photo-derived environment values can produce a bounded scene-element list; internal JSON, confidence values, and unknown codes remain hidden;
- prior-change UI exists only for an evidence-backed privacy-safe comparison; the current production read model supplies no comparison because the required same-place contract is not yet available;
- proposal forms are on demand and proposal-zero states are absent;
- split, merge, exclude, restore, media reassignment, proposal policy, and owner decisions remain no-JavaScript operations under one detailed-edit disclosure;
- all new viewer copy uses the existing language selection for Japanese, English, Spanish, and Brazilian Portuguese.

No schema, migration, backfill, new AI request, observation state transition, permission policy, or exact-location surface changes in this presentation correction. PostgreSQL `visual_observation_signals` and `place_environment_snapshots` are not joined into this D1 detail without a verified privacy-safe record link.

## Scope

The record-detail reader can render one record container with zero, one, or many observations. The normal page summarizes them without expanding a management card stack. Its detail disclosures keep owner, AI, community, curator, and imported provenance separate. AI suggestions remain provisional and a candidate claim is never presented as an accepted human decision.

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
- rendered-output scans reject latitude, longitude, cell, mesh, geohash, coordinate-derived IDs, and exact-place locators
- photo, video, and audio are deduplicated at record level; 0 / 1 / N summary contracts are covered by HTML tests
- `completed_no_candidate`, failed/unassessable, scene elements, absent comparison data, and four-locale wording are covered by HTML contracts
