CREATE TABLE IF NOT EXISTS source_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_url TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  content_bytes INTEGER NOT NULL,
  storage_backend TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  license TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_kind, content_sha256)
);

CREATE TABLE IF NOT EXISTS place_environment_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  metric_kind TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_unit TEXT NOT NULL DEFAULT '',
  tile_z INTEGER,
  tile_x INTEGER,
  tile_y INTEGER,
  observed_on TEXT NOT NULL,
  source_snapshot_id TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  superseded_by TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_place_environment_current
  ON place_environment_snapshots (place_id, metric_kind, valid_to, valid_from);

CREATE INDEX IF NOT EXISTS idx_place_environment_source
  ON place_environment_snapshots (source_snapshot_id);
