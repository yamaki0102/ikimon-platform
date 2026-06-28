CREATE TABLE IF NOT EXISTS observation_data_rights (
  visit_id TEXT PRIMARY KEY,
  occurrence_id TEXT,
  record_consent TEXT NOT NULL DEFAULT 'private',
  research_use_consent TEXT NOT NULL DEFAULT 'none',
  enterprise_report_consent TEXT NOT NULL DEFAULT 'none',
  dataset_license TEXT,
  media_license TEXT,
  external_export_allowed INTEGER NOT NULL DEFAULT 0,
  withdrawal_status TEXT NOT NULL DEFAULT 'active',
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observation_data_rights_external_export
  ON observation_data_rights(external_export_allowed, withdrawal_status);

CREATE INDEX IF NOT EXISTS idx_observation_data_rights_occurrence
  ON observation_data_rights(occurrence_id);
