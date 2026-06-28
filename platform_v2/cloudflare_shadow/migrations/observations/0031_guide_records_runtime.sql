CREATE TABLE IF NOT EXISTS guide_records (
  guide_record_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  occurrence_id TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  scene_hash TEXT NOT NULL DEFAULT '',
  scene_summary TEXT NOT NULL DEFAULT '',
  detected_species_json TEXT NOT NULL DEFAULT '[]',
  detected_features_json TEXT NOT NULL DEFAULT '[]',
  tts_script TEXT,
  lang TEXT NOT NULL DEFAULT 'ja',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_records_user_session
  ON guide_records (user_id, session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_guide_records_session
  ON guide_records (session_id, created_at);

CREATE TABLE IF NOT EXISTS guide_record_latency_states (
  guide_record_id TEXT PRIMARY KEY,
  captured_at TEXT,
  returned_at TEXT,
  current_distance_m REAL,
  delivery_state TEXT NOT NULL DEFAULT 'ready',
  seen_state TEXT NOT NULL DEFAULT 'unseen',
  frame_thumb TEXT,
  primary_subject_json TEXT NOT NULL DEFAULT '{}',
  environment_context TEXT,
  seasonal_note TEXT,
  coexisting_taxa_json TEXT NOT NULL DEFAULT '[]',
  confidence_context_json TEXT NOT NULL DEFAULT '{}',
  media_refs_json TEXT NOT NULL DEFAULT '{}',
  meta_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_route_points (
  point_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  client_point_id TEXT,
  point_kind TEXT NOT NULL DEFAULT 'telemetry',
  guide_mode TEXT NOT NULL DEFAULT 'walk',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  observed_at TEXT NOT NULL,
  accuracy_m REAL,
  speed_mps REAL,
  heading_degrees REAL,
  session_distance_m REAL,
  camera_active INTEGER NOT NULL DEFAULT 0,
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, client_point_id)
);

CREATE INDEX IF NOT EXISTS idx_guide_route_points_session
  ON guide_route_points (session_id, observed_at);

CREATE TABLE IF NOT EXISTS guide_session_public_summary (
  summary_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ja',
  visibility TEXT NOT NULL DEFAULT 'viewer_only',
  record_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  ended_at TEXT,
  representative_guide_record_id TEXT,
  headline TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  evidence_line TEXT NOT NULL DEFAULT '',
  motivation_line TEXT NOT NULL DEFAULT '',
  claim_boundary TEXT NOT NULL DEFAULT '',
  primary_theme TEXT NOT NULL DEFAULT 'place',
  featured_subjects_json TEXT NOT NULL DEFAULT '[]',
  feature_counts_json TEXT NOT NULL DEFAULT '{}',
  public_location_label TEXT,
  observer_avatar_url TEXT,
  media_thumb_url TEXT,
  source_checksum TEXT NOT NULL DEFAULT '',
  generated_by TEXT NOT NULL DEFAULT 'cloudflare_worker_guide_runtime_v1',
  summary_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, session_id, lang)
);

CREATE TABLE IF NOT EXISTS mobile_field_scene_receipts (
  receipt_id TEXT PRIMARY KEY,
  install_id TEXT NOT NULL,
  client_scene_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  guide_record_id TEXT NOT NULL,
  movement_mode TEXT NOT NULL DEFAULT 'walk',
  scene_digest TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (install_id, client_scene_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_field_receipts_session
  ON mobile_field_scene_receipts (session_id, created_at);
