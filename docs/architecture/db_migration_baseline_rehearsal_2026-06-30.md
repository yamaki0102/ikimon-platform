# DB Migration Baseline Rehearsal

Generated: 2026-07-29T00:00:00.000Z  
Schema version: platform_migration_baseline_rehearsal/v0
Migration dir: db/migrations

## Summary

- Total migrations: 147
- First migration: 0001_extensions_and_core.sql
- Head migration: 0144_ai_usage_invocation_identity.sql
- Extension requirements: timescaledb, vector
- Duplicate sequences: 8
- Missing sequences: 0010, 0041, 0042, 0043, 0044, 0078, 0084

## Risk Summary

- Destructive approved: 14
- Destructive unapproved historical debt: 1
- Owner-sensitive approved: 39
- Owner-sensitive unapproved historical debt: 9

Foundation v2 migrations `0134`–`0139` create the persistence model and harden its invariants. `0139` adds triggers, a named tombstone constraint and the bounded-write receipt table; it does not rename, backfill or delete existing product rows.

AI usage control migrations `0140`–`0144` are one approval-bound telemetry group. `0140` creates `ai_execution_guards`, `ai_execution_attempt_events`, `ai_usage_events` and `ai_usage_budget_overrides`; `0141`, `0143` and `0144` only alter those same tables, so they carry `owner-sensitive-ok` rather than adding historical debt. The group changes no Foundation v2 table and no pre-existing product table.

## Stop Conditions

- This report is DB-less and must not be used as proof that production DB has been migrated.
- Any production or staging DATABASE_URL migration rehearsal remains a separate L4 operation.
- New migrations must update this baseline report when sequence head, risk summary, or extension requirements change.

## Rehearsal Commands

- `npx tsx src/scripts/reportMigrationBaseline.ts --format=markdown`
- `npx tsx src/scripts/reportMigrationBaseline.ts --format=json`
- `npm run migrate -- --allow-destructive`

## Duplicate Sequences

| Sequence | Files |
|---|---|
| 0018 | 0018_ai_runs_and_visit_display_state.sql, 0018_specialist_authorities.sql |
| 0104 | 0104_observation_event_capsules.sql, 0104_reference_library_and_commerce.sql |
| 0107 | 0107_record_conversion_kpi_daily_view.sql, 0107_text_ids_for_ai_hot_cache.sql |
| 0109 | 0109_fix_aikan_renri_city.sql, 0109_invasive_reporting_foundation.sql |
| 0110 | 0110_guide_session_public_summary.sql, 0110_observation_rally_foundation.sql |
| 0114 | 0114_continuous_visit_windows.sql, 0114_landing_snapshot_media_indexes.sql, 0114_repair_non_biological_subject_labels.sql |
| 0117 | 0117_glossary_terms.sql, 0117_observation_rally_submission_idempotency.sql, 0117_public_map_snapshots.sql |
| 0119 | 0119_area_sketch_assessments.sql, 0119_taxon_insight_context_key.sql |

## Unapproved Destructive Historical Debt

| File | Checksum | Detail |
|---|---|---|
| 0075_normalize_shizuoka_locality_labels.sql | 5c8e6a8a | UPDATE |

## Unapproved Owner-sensitive Historical Debt

| File | Checksum | Detail |
|---|---|---|
| 0003_delta_sync_idempotency.sql | a1ff0562 | target:evidence_assets, target:identifications |
| 0004_normalize_delta_conflict_indexes.sql | 30fb8352 | target:evidence_assets, target:identifications |
| 0017_taxa_gbif_cache.sql | 91fc6a6b | target:occurrences |
| 0018_ai_runs_and_visit_display_state.sql | a71af039 | target:observation_ai_assessments |
| 0020_audio_privacy_and_bundles.sql | 573cff62 | target:audio_segments |
| 0023_identification_accepted_rank.sql | 62a8a68f | target:identifications |
| 0024_observation_ai_area_inference.sql | e66e5949 | target:observation_ai_assessments |
| 0025_evidence_asset_role_tag.sql | 8e68debc | target:evidence_assets |
| 0027_observation_quality_reviews.sql | f67244fc | target:visits |
