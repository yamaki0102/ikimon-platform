# ikimon.life Cloudflare Shadow Lab

This is a non-production Cloudflare Worker lab for the VPS-exit plan.

It does not replace the current Fastify/PostgreSQL production app. Its job is to prove the minimum write contract for Cloudflare-managed infrastructure before any production cutover:

- canonical observation rows survive even when media processing is delayed
- asset bytes live in R2 and are referenced by a D1 ledger
- job intent is recorded in an outbox before queue dispatch
- exact location is retained in private canonical fields while public read models use blurred cells
- rejected or emergency-hidden records are hidden by metadata first, not deleted

## Local Commands

```powershell
cd platform_v2/cloudflare_shadow
npm install
npm run check
npm run wrangler:check
```

`wrangler.jsonc` uses placeholder D1 database IDs so it can validate locally. Create real non-production Cloudflare resources before deploy.

## Non-Production Resource Names

- Worker: `ikimon-life-cloudflare-shadow-lab`
- D1 core DB: `ikimon_shadow_core` (`e06a7372-6964-4db1-92dd-3491d058f412`)
- D1 observation DB: `ikimon_shadow_observations_2026_06` (`a6d64135-4420-47f7-b2fd-3155c0e0a3be`)
- R2 bucket: `ikimon-shadow-media` (created 2026-06-15T01:19:37Z)
- Queue: `ikimon-shadow-media-jobs`

## 2026-06-15 Validation

- `npx wrangler d1 create ikimon_shadow_core`: created in APAC.
- `npx wrangler d1 create ikimon_shadow_observations_2026_06`: created in APAC.
- `npx wrangler queues create ikimon-shadow-media-jobs`: created.
- R2 was enabled from the Cloudflare Dashboard checkout at `$0/month + metered usage above free included limits`, using the existing payment method on file.
- `npx wrangler r2 bucket create ikimon-shadow-media`: created bucket with Standard storage class.
- `npx wrangler d1 execute ... --remote --file migrations/core/0001_core.sql`: applied 2 queries.
- `npx wrangler d1 execute ... --remote --file migrations/observations/0001_observation_write_contract.sql`: applied 9 queries.
- `npx wrangler deploy --dry-run`: Worker bundle and bindings validated.
- `npx wrangler deploy`: deployed to `https://ikimon-life-cloudflare-shadow-lab.yamaki0102.workers.dev`, version `f69bddc4-629a-4579-91ec-54a42805605b`.
- `npm run check`: TypeScript passed.
- `npm test`: passed 2 tests, including a 10,000-record / 30,000-media-ledger synthetic contract test and a queue-failure preservation test.
- `npm audit --omit=optional`: 0 vulnerabilities.
- Local D1 core migration succeeded, but local observation DB migration crashed `workerd` on Windows during `wrangler d1 execute --local`. Treat local 10k load as blocked until this is reproduced in WSL/Linux or fixed by Wrangler/workerd update.
- Remote D1 recheck: `ikimon_shadow_core` has 2 user-defined tables, `ikimon_shadow_observations_2026_06` has 5 user-defined tables.
- Remote Queue recheck: `ikimon-shadow-media-jobs` exists (`0c71f11f5f9542b59e9202a4528d5bf8`) with 1 producer and 1 consumer after Worker deploy.
- Remote smoke: `/health` returned `{ ok: true, environment: "shadow" }`.
- Remote R2 smoke: one object was uploaded via Worker and fetched with `wrangler r2 object get --remote --pipe`; content matched `ikimon shadow r2 smoke`.
- R2 inventory endpoint deployed for shadow-only use: `GET /internal/r2-inventory?prefix=original/2026/06/&limit=10`.
- R2 inventory returned the smoke object with key `original/2026/06/asset_6a33145c-b54d-4bb8-bc0c-75e2f0e4e77d`, size 22, etag/md5 `b354833c57d20389ef75ab605cd9dd0e`.
- D1 asset ledger matched the R2 key, bytes 22, and `processing_state='uploaded'`.
- Remote load: `npm run load:10k -- --url=https://ikimon-life-cloudflare-shadow-lab.yamaki0102.workers.dev` completed 10,000 records, 30,000 media ledger rows, 0 failures, 252.029 seconds, 39.68 records/sec.
- Remote D1 post-load counts: `draft_observations=10001`, `observations=10001`, `asset_ledger=30001`, `outbox=20002`, `readmodel_public_observations=3335`.
- Reconciliation smoke: 1 pending outbox row was cleared via `/internal/drain-outbox`; final outbox state is `dispatched=20002`.
- D1 post-load size: `ikimon_shadow_observations_2026_06` is 28MB. 24h usage after load: 18,554 read queries, 90,958 write queries, 36,722,624 rows read, 240,785 rows written.
- Read amplification fix: added and applied `migrations/observations/0002_asset_observation_index.sql` with `idx_assets_observation`.
- `EXPLAIN QUERY PLAN SELECT COUNT(*) FROM asset_ledger WHERE observation_id = ?` now uses `COVERING INDEX idx_assets_observation`.
- Added and applied `migrations/observations/0003_asset_reconciliation_indexes.sql` with `idx_assets_processing_state_uploaded`.
- `EXPLAIN QUERY PLAN` confirms uploaded-asset reconciliation uses `idx_assets_processing_state_uploaded`.
- Second remote 10k load after the index completed 10,000 records, 30,000 media ledger rows, 0 failures, 237.86 seconds, 42.04 records/sec.
- Second post-load counts: `draft_observations=20001`, `observations=20001`, `asset_ledger=60001`, `outbox=40002`, `readmodel_public_observations=6669`, final outbox state `dispatched=40002`.
- D1 after the second load: 59.1MB, 39,403 read queries, 192,297 write queries, 55,544,734 rows read, 580,856 rows written over 24h. Rows-read delta after the index was about 205,679, rather than tens of millions.
- D1 restore drill passed: exported source D1 SQL, imported into `ikimon_shadow_restore_core_20260615` and `ikimon_shadow_restore_observations_20260615`, and matched counts for users, drafts, observations, assets, outbox, and public read model.
- Restore report: `E:\Projects\00_all_projects_management\operations\ikimon_business_plan\cloudflare_shadow_restore_drill_2026-06-15.md`
- Added and applied `migrations/observations/0004_public_derivative_gate.sql` with `public_derivative_key`, `public_derivative_sha256`, `exif_scrub_state`, `public_ready_at`, and `idx_assets_public_gate`.
- Deployed Worker version `596c0f6c-e328-432f-a699-2bb0a49cbb90`.
- `npm run check`: passed after the public derivative gate.
- `npm test`: passed 4 tests, including a public read-model gate that waits for scrubbed public derivatives.
- Public gate smoke passed on the remote Worker: uploaded asset `asset_64180dfb-c863-458e-8e13-cce25942dd68` reached `processing_state='uploaded'`, `exif_scrub_state='scrubbed'`, had a public derivative key, and read model row `obs_152efb1a-301f-45ae-8dea-068ab770824a` appeared with blurred cell `34.71,137.81`.
- Added and applied `migrations/observations/0005_legacy_asset_import_ledger.sql` with `legacy_asset_import_ledger`.
- Deployed Worker version `a331f1a1-1cfb-4583-8d91-56e10edadbb7` with shadow-only `GET /internal/legacy-asset-import-summary`.
- Imported the 81 unresolved production media references into the non-production D1 ledger from `import_missing_legacy_asset_ledger_20260615.d1.sql`.
- Legacy asset import summary passed:
  - `missing_legacy_asset / avatar = 1`
  - `missing_legacy_asset / observation_photo = 46`
  - `stream_inventory_pending / observation_video = 34`
- Cloudflare Stream inventory was checked through the production app's existing Stream API credentials without printing secrets.
- Added and applied `migrations/observations/0006_legacy_stream_inventory.sql` with `legacy_stream_inventory`.
- Deployed Worker version `5c4a5178-a94e-4c0d-b617-2baddb098767`.
- Imported 34 Stream inventory rows from `stream_inventory_20260615.json`; D1 summary is `exists_on_stream=1, ready_to_stream=1, status_state='ready': 32` and `exists_on_stream=1, ready_to_stream=0, status_state='inprogress': 2`.
- Stream inventory total size is 45,207,490 bytes.
- Added and applied `migrations/observations/0007_legacy_r2_import_ledger.sql` with `legacy_r2_import_ledger`.
- Deployed Worker version `619d79b0-649b-408a-8063-48cd1733567b` with shadow-only `GET /internal/r2-import-summary`.
- Uploads-archive R2 import uploaded all 1,156 matched objects from `uploads_20260615_093438.tar.gz` to `ikimon-shadow-media/import-smoke/20260615/`: 4 avatars and 1,152 observation photos.
- Uploads-archive R2 download verification recomputed SHA256 and bytes for all 1,156 objects; all 1,156 matched the production preservation manifest and were recorded as `uploaded_verified`.
- Uploads-archive R2 import total uploaded bytes: 1,528,180,221.
- Data-archive R2 import uploaded all 795 `observation_photo_original` objects from `data_20260615_060001.tar.gz` to `ikimon-shadow-media/import-smoke/20260615-data/original/`.
- Data-archive R2 download verification recomputed SHA256 and bytes for all 795 objects; all 795 matched the production preservation manifest and were recorded as `uploaded_verified`.
- Data-archive R2 import total uploaded bytes: 810,434,887.
- Deployed Worker version `77767197-141e-4462-b0c8-fdd58fea63b0` with cursor-capable shadow-only `GET /internal/r2-inventory`.
- R2 inventory paging returned 2 pages, 795 objects, and 810,434,887 bytes for prefix `import-smoke/20260615-data/original/`.
- R2 inventory paging returned 3 pages, 1,156 objects, and 1,528,180,221 bytes for prefix `import-smoke/20260615/`.
- Matched media R2 proof now covers all 1,951 backup-tar references, 2,338,615,108 bytes total.
- Added and applied `migrations/observations/0008_production_restore_parity.sql` with `production_restore_parity_runs` and `production_restore_parity_metrics`.
- Deployed Worker version `3d7ae89a-6d33-4851-92c4-67137286e161` with shadow-only `GET /internal/production-restore-parity-summary`.
- Restored PostgreSQL parity ledger imported run `restore-parity-20260615-v1`: 181 public tables counted, 210 metrics, critical counts `users=1931`, `visits=659`, `occurrences=1332`, `evidence_assets=2032`, `asset_blobs=5251`, `observation_fields=122677`, and core orphan check sum `0`.
- Added and applied `migrations/observations/0009_production_canonical_import.sql` with core `production_import_*` tables and a blurred public read model.
- Deployed Worker version `d8f2da6d-1901-402d-a2a0-f8c975d06718` with shadow-only `GET /internal/production-import-summary`.
- Core canonical import shadow passed: users `1,931`, visits `659`, occurrences `1,332`, asset blobs `5,251`, evidence assets `2,032`, public read model rows `588`, core orphan checks `0`, media coverage `2,032 = 1,951 R2 verified + 81 legacy ledgered`, Stream-existing assets `34`.
- Regenerated the core canonical import after fixing multiline legacy-ledger parsing; live source summary now reports public unresolved assets `55`, not `0`.
- Post-import D1 restore drill passed from exported source D1 SQL into `ikimon_shadow_restore_observations_postimport_20260615` (`f03ea8a2-5522-4719-8207-f0387da868bf`): export size `81,860,749` bytes, SHA256 `f7bb43f5fd32bc89fa6771d36f19d1ba2c9bfd05f9d996ff05cf3a426d483d51`, import result `160,788` SQL queries and `665,905` rows written.
- Restored public read model was rebuilt from restored canonical import tables and verified: users `1,931`, visits `659`, occurrences `1,332`, evidence assets `2,032`, public read model rows `588`, orphan checks `0`, R2 verified `1,951`, legacy ledgered `81`, Stream exists `34`, public unresolved assets `55`.
- Added current app compatibility smoke routes: `POST /api/v1/observations/upsert` and `POST /api/v1/observations/:id/photos/upload`.
- `npm test`: passed 7 tests after adding v1 observation upsert and v1 photo upload contract coverage.
- Deployed Worker version `7d3b2626-689f-460b-9bb8-0a0f35a95f7a`.
- Live v1 compatibility smoke passed with `shadow-contract-20260615162349`: upsert returned `ok`, `visitId`, `occurrenceId`, `occurrenceIds`, `placeId`, `impact`, `compatibility`, `placeMemorySample`, and `contributionReceipts`; photo upload returned `ok`, `visitId`, `occurrenceId`, `relativePath`, `publicUrl`, `facePrivacy`, and `dispatch`.
- D1/R2 live proof: exact coordinates `34.71234,137.81234` are retained in D1, public read model uses blurred cell `34.71,137.81`, R2 stores one object under `original/v1-compat/shadow-contract-20260615162349/`, SHA256 `da672ac84fab165eeb7c4eeaaf62bc0d28f73272cbd6f6985f7416eac9bcb386`, 18 bytes, and read model asset count `1`.
- Added and applied `migrations/core/0002_auth_session_contract.sql` with `auth_sessions`.
- Deployed Worker version `08ce5f45-aebe-444f-99e7-83f0c0ee72a9`.
- `npm test`: passed 8 tests after adding v1 auth session issue/get/logout contract coverage.
- Live auth/session smoke passed: required guest session returns `401`, optional guest hydration returns `session:null`, issued `ikimon_v2_session` cookie resolves to the same session token hash, and logout revokes the shadow session.
- Added and applied `migrations/observations/0010_shadow_video_upload_contract.sql` with `video_upload_requests`.
- Deployed Worker version `3130f2b6-ba15-4607-bd81-8a0d6c2ff2d5`.
- `npm run check`: passed after adding v1 video direct upload/finalize compatibility.
- `npm test`: passed 9 tests after adding v1 video contract coverage.
- `npx wrangler deploy --dry-run`: passed.
- `npm audit --omit=optional`: 0 vulnerabilities.
- Live video smoke passed with `stream_0414fa3d-9608-40b2-a03e-37a6ddb0a07f`: direct upload requires session, missing TUS length returns `video_tus_upload_length_required`, upload body wrote 12 bytes to R2, finalize returned provider `cloudflare_stream`, `uploadStatus=ready`, `readyToStream=true`, `durationMs=9000`, `visitId=shadow-video-contract-20260615164436`, and `occurrenceId=occ:shadow-video-contract-20260615164436:0`.
- D1/R2 live proof: `video_upload_requests` is `ready`, `asset_ledger` has `video_asset_stream_0414fa3d-9608-40b2-a03e-37a6ddb0a07f` as `video/mp4` and `uploaded`, R2 has one object under `original/v1-compat-video/stream_0414fa3d-9608-40b2-a03e-37a6ddb0a07f/`, and public read model has `asset_count=1`.
- Added public map read compatibility routes: `GET /api/v1/map/cells`, `GET /api/v1/map/observations`, and guest-safe `GET /api/v1/map/my-places`.
- Deployed Worker version `be9b54b8-3a7c-4d9c-8fdd-5f9a416b237d`.
- `npm run check`: passed after adding public map read compatibility.
- `npm test`: passed 10 tests after adding map cells/list/my-places coverage.
- `npx wrangler deploy --dry-run`: passed.
- `npm audit --omit=optional`: 0 vulnerabilities.
- Live public map smoke passed with `shadow-map-contract-20260615165322`: unscoped `GET /api/v1/map/observations` returns `400 { error:"missing_scope" }`, `GET /api/v1/map/cells` returns a `FeatureCollection`, `GET /api/v1/map/observations?cell_id=cell%3A34.71%2C137.81` returns list `items` without a `features` field, and guest `GET /api/v1/map/my-places` returns `{ signedIn:false, items:[] }`.
- Public map privacy proof: after Queue propagation, matching cell `cell:34.71,137.81` had count `5`, latest observed time `2026-06-15T08:08:00Z`, matching item `visitId=shadow-map-contract-20260615165322`, and JSON output did not contain exact coordinates `34.71234` or `137.81234`.
- Added public observation detail read compatibility routes: `GET /api/v1/observations/:id/public-detail` and `GET /observations/:id`.
- Deployed first detail Worker version `31e93e30-0d04-445e-84b6-cd070f6e990d`, then fixed Queue ordering and deployed version `8ef70453-df3c-40f9-9141-2d03f89687ba`.
- `npm run check`: passed after adding public observation detail read compatibility.
- `npm test`: passed 12 tests after adding public detail JSON/HTML and out-of-order Queue coverage.
- `npx wrangler deploy --dry-run`: passed.
- `npm audit --omit=optional`: 0 vulnerabilities.
- Live detail smoke passed with `shadow-detail-contract-20260615170409`: JSON detail resolves from `occ:shadow-detail-contract-20260615170409:0`, HTML detail resolves from `/observations/shadow-detail-contract-20260615170409`, one public-ready image is exposed, 404 works for missing observation, and JSON + HTML do not contain exact coordinates `34.71234` or `137.81234`.
- Queue ordering bug found and fixed during the live smoke: `readmodel.refresh` can run before `media.process`; `media.process` now marks derivatives public-ready and idempotently refreshes the public read model so publication no longer depends on Queue message order.
- Added shadow browser smoke routes: `GET /shadow-smoke/record`, `GET /shadow-smoke/map`, and public derivative serving under `GET /derived/*`.
- Deployed Worker version `713452ce-f9a7-46a9-be9a-12910889323f`.
- `npm run check`: passed after adding public derivative serving and browser smoke routes.
- `npm test`: passed 13 tests, including public derivative fetch coverage.
- `npx wrangler deploy --dry-run`: passed.
- `npm audit --omit=optional`: 0 vulnerabilities.
- Playwright desktop/mobile browser smoke passed: record creation, photo upload, public detail readback, map readback, no broken images, no horizontal overflow, and no exact coordinate leak in detail JSON/HTML or map HTML.
- Browser smoke evidence: `E:\Projects\_agent_scratch\ikimon-platform\cloudflare-managed-migration-20260615\browser-smoke-20260615\`.
- Added and applied `migrations/observations/0011_logical_partition_month.sql` with `partition_month` columns and month indexes for drafts, observations, assets, outbox, and public read models.
- Deployed Worker version `42040c03-51ee-4408-9a9c-5818d852e115` with `GET /internal/d1-partition-routing-proof`.
- D1 partition routing strategy selected: `single_active_d1_logical_month`.
- Remote migration result: 15 queries, 544,095 rows read, 293,538 rows written, database size 80.71MB, bookmark `00000027-00000034-0000508b-5e79bdf011952ad3a14cda66ef8b5f51`.
- `npm run check`: passed after partition routing implementation.
- `npm test`: passed 14 tests, including logical month partition routing.
- `npx wrangler deploy --dry-run`: passed.
- `npm audit --omit=optional`: 0 vulnerabilities.
- Live partition proof passed with `shadow-partition-july-202606151739`: `partition_month=2026-07`, `selectedBinding=OBS_DB`, `manualMonthlyBindingRequired=false`, `crossD1TransactionRequired=false`, month distribution `2026-06:20016`, `2026-07:1`.
- Remote `EXPLAIN QUERY PLAN` confirmed `idx_observations_partition_month` is used for `partition_month` filtering.
- Added and applied `migrations/observations/0012_public_derivative_binary_verification.sql` with `public_derivative_verified_at`, `public_derivative_metadata_json`, and `idx_assets_public_binary_gate`.
- Deployed Worker version `daea3914-b603-494a-88ae-a9ce84876c82` with byte-level public derivative verification and `GET /internal/public-derivative-verification-summary`.
- Remote migration result: 3 queries, 122,423 rows read, 60,019 rows written, database size 85.46MB, bookmark `00000028-0000000a-0000508b-bdc9bcbcaf9a7b60380a72f94251c560`.
- `npm run check`: passed after public derivative binary verification.
- `npm test`: passed 14 tests, including SHA256, verification timestamp, metadata JSON, and `gpsExifPresent=false` assertions.
- `npx wrangler deploy --dry-run`: passed.
- `npm audit --omit=optional`: 0 vulnerabilities.
- Live public derivative verification passed with `shadow-exif-gate-202606151752`: one public photo, derivative SHA256 `ef1cae976ed79e11eeb9bbbdf8a12ae574d6bf521bc200d71eb1536461f2a95c`, `verified_assets=1`, `gps_exif_present=0`, derivative HTTP 200, and no literal EXIF/GPS or exact coordinate leak in the derivative bytes.
- Added and applied `migrations/observations/0013_reverse_delta_ledger.sql` with `rollback_write_ledger`.
- Deployed Worker version `0068b2a1-7cb9-427c-9ab8-223440ecbafd` with shadow-only `GET /internal/reverse-delta-dry-run`.
- Remote migration result: 3 queries, 5 rows read, 5 rows written, database size 85.49MB, bookmark `00000029-00000006-0000508b-895648ef302d8bcccf428aacadc6bcf4`.
- `npm run check`: passed after reverse delta ledger implementation.
- `npm test`: passed 15 tests, including rollback write ledger drift-zero dry-run coverage.
- `npx wrangler deploy --dry-run`: passed.
- `npm audit --omit=optional`: 0 vulnerabilities.
- Live reverse delta dry-run passed with `shadow-reverse-delta-20260615-1911`: one observation, one photo, and one pseudo-Stream video produced 3 rollback ledger events; `/internal/reverse-delta-dry-run?target_prefix=shadow-reverse-delta-20260615-1911&limit=20` returned `rollbackLedger=3`, `observations=1`, `assets=2`, `ledgerObservations=1`, `ledgerAssets=2`, and all drift fields `0` with `mutationPerformed=false`.
- Deployed Worker version `59b565ae-1a1e-406e-b480-8a37d6185cd5` with a bearer-token guard for all `/internal/*` routes. Production returns 404, shadow requires `INTERNAL_AUTH_TOKEN`, and shadow returns 403 while the token is unset. Public unauthenticated checks confirmed `/health` stays 200 while `/internal/production-import-summary`, `/internal/production-restore-parity-summary`, and `/internal/reverse-delta-dry-run` return 403. R2 `r2.dev` public access is disabled and no custom domain is attached to `ikimon-shadow-media`.
- Added shadow-only `GET /shadow-smoke/reverse-delta-proof` for integrated staging-route proof without exposing `/internal/*`.
- Deployed Worker version `c1ed5d2a-5290-4d68-8579-b7209c1dbd16`.
- `npm run check`: passed after adding the staging-safe reverse-delta proof endpoint.
- `npm test`: passed 20 tests, including the public shadow-smoke proof and production 404 guard.
- `npx wrangler deploy --dry-run`: passed.
- The proof endpoint returns counts, drift, and replay metadata only; it does not return replay SQL events and reports `mutationPerformed=false` / `productionTrafficAffected=false`.

## Data-Safety Contract

- Canonical observation and outbox rows are written in the same observation D1 `batch()`.
- Cloudflare's D1 Worker API documents `batch()` as a SQL transaction that rolls back the entire sequence on statement failure.
- Queue dispatch happens after the canonical/outbox batch. If dispatch fails, the HTTP response still accepts the record and the outbox rows remain `pending` with `attempts` / `last_error`.
- Public read models contain `public_cell`, not exact coordinates. Exact coordinates stay in the canonical private row.
- Public read models are not created while uploaded media lacks a scrubbed public derivative. The current shadow implementation marks uploaded media as `scrubbed` through the `media.process` job before `readmodel.refresh` can publish it.
- The atomic write unit is the observation D1 database. Core DB side effects such as user counters must remain asynchronous/outbox-driven and outside the canonical observation transaction.
- Unresolved legacy media references are stored in `legacy_asset_import_ledger`; they are not represented as successful media imports and are not deleted from canonical history.
- Public read-model `asset_count` counts public-ready uploaded assets, not unresolved legacy references.
- Cloudflare Stream references are backed by `legacy_stream_inventory`. Stream existence is treated separately from local/R2 object import because Stream stores the binary in Cloudflare Stream, not in the local uploads tar.
- Existing local media can be imported into R2 with checksum-preserving ledger rows. The first non-production smokes use `legacy_r2_import_ledger` under `import-smoke/20260615/` and `import-smoke/20260615-data/original/`.
- The video compatibility route is a shadow-only pseudo-Stream ledger. It validates the current app response shape and D1/R2/readmodel behavior without mutating production Cloudflare Stream media.
- Public map read routes are built from `readmodel_public_observations.public_cell`, not exact canonical coordinates.
- Public observation detail reads are also built from the public read model and public-ready derivatives; they do not expose exact canonical coordinates.
- Public derivative routes serve only `derived/` keys from the non-production R2 bucket; original upload keys remain private to the shadow storage contract.
- Observation D1 partition routing uses one active `OBS_DB` binding with indexed `partition_month`; month-level archive/export is the cutover unit and normal writes do not require monthly Worker binding edits.
- Public read models require public derivative binary verification: `public_derivative_verified_at` and `public_derivative_metadata_json` must be present, and generated derivatives that scan positive for EXIF/GPS/XMP/exact coordinate literals are not marked public-ready.
- Reverse delta rollback readiness starts from `rollback_write_ledger`. The shadow Worker records replayable observation/photo/video events in the same D1 batch as canonical writes, and the dry-run endpoint proves ledger-to-canonical drift without mutating VPS/PostgreSQL.
- Integrated staging proof uses `/shadow-smoke/reverse-delta-proof?target_prefix=<observation-id>` to verify a staging-created observation, photo, and video have matching rollback ledger coverage without opening `/internal/*` or mutating VPS/PostgreSQL.

## Required Before Production

This lab is not cutover-ready until:

1. D1 partition routing is green for the selected initial strategy, but archive/export automation still needs dress rehearsal before cutover.
2. R2 object checksums are reconciled with D1 ledger rows beyond the single-object smoke.
3. Queue delivery and outbox reconciliation are tested under retry/failure.
4. A restore drill exports D1, checks R2 inventory, and rebuilds read models.
5. Production import and rollback still need a final route-change dress rehearsal that includes full app compatibility, write-drain or reverse-delta on the integrated staging route, R2 inventory recheck, and rollback smoke.
6. Real production media references must reconcile to R2 objects or provider inventory. The first backup-tar reconciliation still has 47 non-Stream unresolved legacy references and 34 Stream references; these now have non-production ledger, Stream inventory, full 1,951-object matched-media R2 import proof, restored PostgreSQL parity ledger proof, core canonical D1 import proof, post-import D1 restore proof, write/auth/video/public-map/public-detail/browser-flow contract smoke proof, second-location archive proof, and shadow reverse-delta mechanics proof, but production cutover still needs existing app staging integration, full observation detail SSR parity, missing-media provenance, video-container metadata verification, takedown propagation smoke, budget guard, and final rollback rehearsal.
7. The shadow derivative byte scanner is green for generated SVG derivatives, but production cutover still needs a metadata parser or exiftool-equivalent proof for actual WebP/JPEG/MP4-poster derivatives from the real media processor.
8. If future internal diagnostics are needed, configure `INTERNAL_AUTH_TOKEN` through explicit secret-update approval and call `/internal/*` with `Authorization: Bearer <token>`.
