ALTER TABLE observations ADD COLUMN organism_origin TEXT;

CREATE TABLE IF NOT EXISTS observation_detail_edit_events (
  edit_id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  edit_kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS observation_environment_records (
  record_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  structured_json TEXT NOT NULL,
  source_lang TEXT NOT NULL DEFAULT 'ja',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observation_detail_edit_events_observation
  ON observation_detail_edit_events(observation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_observation_environment_records_occurrence
  ON observation_environment_records(occurrence_id, created_at);
