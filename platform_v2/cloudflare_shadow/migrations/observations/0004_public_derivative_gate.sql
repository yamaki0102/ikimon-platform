ALTER TABLE asset_ledger ADD COLUMN public_derivative_key TEXT;
ALTER TABLE asset_ledger ADD COLUMN public_derivative_sha256 TEXT;
ALTER TABLE asset_ledger ADD COLUMN exif_scrub_state TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE asset_ledger ADD COLUMN public_ready_at TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_public_gate
  ON asset_ledger (observation_id, processing_state, exif_scrub_state, public_ready_at);
