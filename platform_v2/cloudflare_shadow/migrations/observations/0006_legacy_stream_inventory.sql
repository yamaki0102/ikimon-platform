CREATE TABLE IF NOT EXISTS legacy_stream_inventory (
  stream_uid TEXT PRIMARY KEY,
  asset_id TEXT,
  observation_id TEXT,
  visit_id TEXT,
  exists_on_stream INTEGER NOT NULL DEFAULT 0,
  ready_to_stream INTEGER NOT NULL DEFAULT 0,
  status_state TEXT,
  size_bytes INTEGER,
  duration_seconds REAL,
  created_at_stream TEXT,
  modified_at_stream TEXT,
  checked_at TEXT NOT NULL,
  evidence_source TEXT NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_legacy_stream_inventory_state
  ON legacy_stream_inventory (exists_on_stream, ready_to_stream, status_state);
