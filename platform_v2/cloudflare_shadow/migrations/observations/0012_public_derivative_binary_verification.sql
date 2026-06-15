ALTER TABLE asset_ledger ADD COLUMN public_derivative_verified_at TEXT;
ALTER TABLE asset_ledger ADD COLUMN public_derivative_metadata_json TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_public_binary_gate
  ON asset_ledger (observation_id, processing_state, exif_scrub_state, public_ready_at, public_derivative_verified_at);
