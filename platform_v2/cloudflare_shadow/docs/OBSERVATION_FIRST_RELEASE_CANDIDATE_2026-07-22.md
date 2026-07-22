# Observation-first record release candidate evidence

Date: 2026-07-22
Base source: `52011106d01c90561b0e46a252ea665e6d0fa509`

This note records the immutable release-candidate gates for the observation-first record detail rollout. It does not authorize or perform a deployment, database mutation, secret change, DNS change, access change, or customer send.

## Integrated changes

- Observation-first record foundation, read model, comparison, detail interactions, and release flags are merged through PRs #1381, #1382, #1387, #1388, #1389, #1390, #1391, #1392, #1393, #1394, #1395, #1396, #1397, #1398, and #1399.
- The public reader is fail-closed: an authoritative private policy returns `404` with `Cache-Control: no-store`; an unavailable observation reader returns `503`; only a genuinely missing observation may use the legacy fallback.
- Staging and production configuration explicitly enable the observation-first read, write, and compare contracts.

## Verification gates completed before release promotion

- `npm run check`: passed.
- `npm run test:quick`: 344/344 passed.
- Migration `0067_record_observation_foundation.sql` checksum: `fab41be712e12df227af1aa17101d69386de37e02c4bfc1c5dd8bf52a2daefb6`.
- Production migration integrity: 12 tables, 19 explicit indexes, 6 triggers, and zero foreign-key violations.
- Production backfill: 704 record observations (687 owner-authored and 17 AI-provisional), 2,020 active media links, 2,711 consistency-ledger rows, 4 quarantined legacy assets, and zero unresolved consistency rows.
- Backfill replay was idempotent; no raw coordinates, private note body, or object key was copied into release evidence.
- Production shadow comparison sample: 120 records, P0=0, P1=0, P2=0, privacy violations=0.
- Staging visual QA passed at 320, 375, 390, 768, and 1280 CSS pixels with no horizontal overflow, broken image, response error, missing label, or private-record exposure.

## Rollback anchor before promotion

- Source: `3b38c30bbfdf3e5d407a3ff555d8c08210035e35`
- Runtime: `portable-3b38c30bbfdf-20260719060520.773`

The final staging and production runtime identities, Worker versions, HTTP readbacks, visual QA, and mutation counters must be appended to the central release ledger after promotion.
