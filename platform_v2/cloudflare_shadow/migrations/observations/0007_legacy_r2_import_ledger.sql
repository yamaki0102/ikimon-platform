CREATE TABLE IF NOT EXISTS legacy_r2_import_ledger (
  asset_id TEXT PRIMARY KEY,
  asset_role TEXT NOT NULL,
  import_run_id TEXT NOT NULL,
  source_archive TEXT NOT NULL,
  source_member TEXT NOT NULL,
  r2_bucket TEXT NOT NULL,
  r2_object_key TEXT NOT NULL,
  expected_sha256 TEXT NOT NULL,
  expected_bytes INTEGER NOT NULL,
  uploaded_sha256 TEXT NOT NULL,
  uploaded_bytes INTEGER NOT NULL,
  verified_sha256 TEXT,
  verified_bytes INTEGER,
  import_status TEXT NOT NULL
    CHECK (import_status IN ('uploaded_verified', 'uploaded_unverified', 'failed')),
  checked_at TEXT NOT NULL,
  evidence_source TEXT NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_legacy_r2_import_status
  ON legacy_r2_import_ledger (import_status, asset_role);

CREATE INDEX IF NOT EXISTS idx_legacy_r2_import_object
  ON legacy_r2_import_ledger (r2_object_key);
