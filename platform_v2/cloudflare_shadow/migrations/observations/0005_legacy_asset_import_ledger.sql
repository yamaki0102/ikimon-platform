CREATE TABLE IF NOT EXISTS legacy_asset_import_ledger (
  legacy_asset_id TEXT PRIMARY KEY,
  import_run_id TEXT NOT NULL,
  asset_id TEXT,
  asset_role TEXT NOT NULL,
  observation_id TEXT,
  visit_id TEXT,
  legacy_relative_path TEXT,
  storage_backend TEXT,
  storage_path TEXT,
  expected_sha256 TEXT,
  expected_bytes INTEGER,
  archive_member TEXT,
  archive_sha256 TEXT,
  archive_bytes INTEGER,
  import_status TEXT NOT NULL
    CHECK (import_status IN ('imported', 'missing_legacy_asset', 'stream_inventory_pending')),
  evidence_source TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legacy_asset_import_status
  ON legacy_asset_import_ledger (import_status, asset_role);

CREATE INDEX IF NOT EXISTS idx_legacy_asset_import_observation
  ON legacy_asset_import_ledger (observation_id);
