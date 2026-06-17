CREATE TABLE IF NOT EXISTS production_import_runs (
  run_id TEXT PRIMARY KEY,
  source_db TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS production_import_users (
  user_id TEXT PRIMARY KEY,
  legacy_user_id TEXT,
  display_name TEXT,
  avatar_asset_id TEXT,
  role_name TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS production_import_visits (
  visit_id TEXT PRIMARY KEY,
  legacy_observation_id TEXT,
  place_id TEXT,
  user_id TEXT,
  observed_at TEXT,
  exact_lat REAL,
  exact_lng REAL,
  coordinate_uncertainty_m REAL,
  public_visibility TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS production_import_occurrences (
  occurrence_id TEXT PRIMARY KEY,
  visit_id TEXT,
  scientific_name TEXT,
  vernacular_name TEXT,
  taxon_rank TEXT,
  confidence_score REAL,
  quality_grade TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS production_import_asset_blobs (
  blob_id TEXT PRIMARY KEY,
  storage_backend TEXT,
  storage_path TEXT,
  media_type TEXT,
  mime_type TEXT,
  sha256 TEXT,
  bytes INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS production_import_evidence_assets (
  asset_id TEXT PRIMARY KEY,
  blob_id TEXT,
  occurrence_id TEXT,
  visit_id TEXT,
  asset_role TEXT,
  legacy_relative_path TEXT,
  legacy_asset_key TEXT,
  captured_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS production_import_public_readmodel (
  visit_id TEXT PRIMARY KEY,
  public_cell TEXT NOT NULL,
  observed_at TEXT,
  occurrence_count INTEGER NOT NULL,
  asset_count INTEGER NOT NULL,
  public_ready_asset_count INTEGER NOT NULL,
  unresolved_asset_count INTEGER NOT NULL,
  visibility TEXT
);

CREATE INDEX IF NOT EXISTS idx_production_import_visits_user
  ON production_import_visits (user_id);

CREATE INDEX IF NOT EXISTS idx_production_import_occurrences_visit
  ON production_import_occurrences (visit_id);

CREATE INDEX IF NOT EXISTS idx_production_import_assets_visit
  ON production_import_evidence_assets (visit_id);

CREATE INDEX IF NOT EXISTS idx_production_import_assets_occurrence
  ON production_import_evidence_assets (occurrence_id);

CREATE INDEX IF NOT EXISTS idx_production_import_assets_blob
  ON production_import_evidence_assets (blob_id);

CREATE INDEX IF NOT EXISTS idx_production_import_blobs_sha
  ON production_import_asset_blobs (sha256);
