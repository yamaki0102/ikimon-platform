CREATE TABLE IF NOT EXISTS track_sessions (
  visit_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  field_id TEXT,
  place_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  distance_meters REAL,
  step_count INTEGER,
  first_lat REAL NOT NULL,
  first_lng REAL NOT NULL,
  municipality TEXT,
  prefecture TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS track_points (
  point_id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy_m REAL,
  altitude_m REAL,
  raw_payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_track_sessions_user_started
  ON track_sessions (user_id, started_at);

CREATE INDEX IF NOT EXISTS idx_track_points_visit_sequence
  ON track_points (visit_id, sequence_no);
