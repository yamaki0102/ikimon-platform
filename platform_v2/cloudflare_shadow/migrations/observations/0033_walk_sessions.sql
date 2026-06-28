CREATE TABLE IF NOT EXISTS walk_sessions (
  walk_session_id TEXT PRIMARY KEY,
  external_id TEXT UNIQUE,
  user_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  distance_m REAL,
  step_count INTEGER,
  passive_detection_count INTEGER NOT NULL DEFAULT 0,
  top_species_json TEXT NOT NULL DEFAULT '[]',
  biome TEXT,
  source TEXT NOT NULL DEFAULT 'fieldscan',
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_walk_sessions_user_started
  ON walk_sessions (user_id, started_at);
