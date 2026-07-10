-- Backfill an explicit, non-exportable rights envelope for observations that were
-- already public before observation_data_rights became mandatory.
--
-- This records provenance; it does not infer research, enterprise, dataset, media,
-- or external-export consent. Existing explicit rights rows always win.
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
  o.observation_id,
  NULL,
  'public_summary',
  'none',
  'none',
  NULL,
  NULL,
  0,
  'active',
  '{"source":"migration_backfill","marker":"legacy_public_visibility_backfill_20260710","basis":"preexisting_public_visibility","inferred_export_consent":false}',
  CURRENT_TIMESTAMP
FROM observations AS o
WHERE o.visibility = 'public'
  AND o.emergency_hidden = 0
  AND o.processing_state = 'accepted';
