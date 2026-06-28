CREATE TABLE IF NOT EXISTS passive_audio_ingest_events (
  ingest_event_id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  site_id TEXT NOT NULL,
  device_id TEXT,
  plot_id TEXT,
  timezone TEXT NOT NULL,
  device_deployment_id TEXT,
  observation_method TEXT NOT NULL DEFAULT 'passive_audio',
  protocol_id TEXT NOT NULL,
  sampling_effort_json TEXT NOT NULL DEFAULT '{}',
  sensor_status_json TEXT NOT NULL DEFAULT '{}',
  observed_start_at TEXT NOT NULL,
  observed_end_at TEXT NOT NULL,
  species_label TEXT NOT NULL,
  scientific_name TEXT,
  confidence REAL NOT NULL,
  model_id TEXT,
  model_version TEXT,
  raw_payload_hash TEXT,
  tier15_candidate INTEGER NOT NULL DEFAULT 0,
  normalized_event_json TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  ingest_status TEXT NOT NULL DEFAULT 'accepted',
  visit_id TEXT,
  occurrence_id TEXT,
  audio_segment_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_passive_audio_ingest_events_site_time
  ON passive_audio_ingest_events (site_id, observed_start_at);

CREATE INDEX IF NOT EXISTS idx_passive_audio_ingest_events_visit
  ON passive_audio_ingest_events (visit_id);
