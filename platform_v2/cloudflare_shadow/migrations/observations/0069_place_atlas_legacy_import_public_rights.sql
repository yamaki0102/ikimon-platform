-- Record the existing public-summary permission for legacy imports before
-- Place Atlas can reuse them. This does not grant research, enterprise,
-- dataset, media, or external-export rights. Existing explicit rights win.
INSERT OR IGNORE INTO observation_data_rights (
  visit_id,
  occurrence_id,
  record_consent,
  research_use_consent,
  enterprise_report_consent,
  dataset_license,
  media_license,
  external_export_allowed,
  withdrawal_status,
  source_payload_json,
  updated_at
)
SELECT
  v.visit_id,
  NULL,
  'public_summary',
  'none',
  'none',
  NULL,
  NULL,
  0,
  'active',
  '{"source":"migration_backfill","marker":"place_atlas_legacy_import_public_visibility_20260724","basis":"preexisting_public_visibility","inferred_export_consent":false}',
  CURRENT_TIMESTAMP
FROM production_import_visits AS v
WHERE v.public_visibility = 'public';
