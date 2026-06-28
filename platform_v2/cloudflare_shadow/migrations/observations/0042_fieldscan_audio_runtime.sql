CREATE TABLE IF NOT EXISTS fieldscan_audio_segments (
  segment_id TEXT PRIMARY KEY,
  external_id TEXT UNIQUE,
  session_id TEXT NOT NULL,
  user_id TEXT,
  visit_id TEXT,
  place_id TEXT,
  recorded_at TEXT NOT NULL,
  duration_sec REAL NOT NULL DEFAULT 0,
  lat REAL,
  lng REAL,
  azimuth REAL,
  storage_key TEXT,
  storage_provider TEXT NOT NULL DEFAULT 'r2_private_audio',
  mime_type TEXT NOT NULL DEFAULT 'audio/webm',
  bytes INTEGER NOT NULL DEFAULT 0,
  privacy_status TEXT NOT NULL DEFAULT 'pending_voice_check',
  voice_flag INTEGER NOT NULL DEFAULT 0,
  fingerprint_json TEXT NOT NULL DEFAULT '{}',
  meta_json TEXT NOT NULL DEFAULT '{}',
  transcription_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fieldscan_audio_segments_session_recorded
  ON fieldscan_audio_segments(session_id, recorded_at);

CREATE TABLE IF NOT EXISTS fieldscan_audio_detections (
  detection_id TEXT PRIMARY KEY,
  segment_id TEXT NOT NULL REFERENCES fieldscan_audio_segments(segment_id) ON DELETE CASCADE,
  detected_taxon TEXT NOT NULL,
  scientific_name TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'perch_v2',
  offset_sec REAL NOT NULL DEFAULT 0,
  duration_sec REAL NOT NULL DEFAULT 0,
  dual_agree INTEGER NOT NULL DEFAULT 0,
  raw_score_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fieldscan_audio_detections_segment
  ON fieldscan_audio_detections(segment_id);
