CREATE TABLE IF NOT EXISTS waterbodies (
  ikimon_waterbody_id TEXT PRIMARY KEY,
  waterbody_type TEXT NOT NULL DEFAULT 'unspecified',
  parent_waterbody_id TEXT,
  public_label TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ikimon',
  source_version TEXT NOT NULL DEFAULT 'v0',
  geometry_precision TEXT NOT NULL DEFAULT 'label_only',
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS water_record_extensions (
  visit_id TEXT PRIMARY KEY,
  occurrence_id TEXT,
  waterbody_id TEXT,
  catch_outcome TEXT NOT NULL,
  capture_method TEXT,
  participant_count INTEGER,
  effort_minutes REAL,
  target_taxa_scope TEXT,
  released_count INTEGER,
  kept_count INTEGER,
  public_waterbody_label TEXT,
  environment_snapshot_json TEXT NOT NULL DEFAULT '{}',
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_water_record_extensions_occurrence
  ON water_record_extensions (occurrence_id);

CREATE INDEX IF NOT EXISTS idx_water_record_extensions_waterbody
  ON water_record_extensions (waterbody_id);
