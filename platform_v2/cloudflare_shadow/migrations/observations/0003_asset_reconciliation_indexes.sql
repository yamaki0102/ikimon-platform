CREATE INDEX IF NOT EXISTS idx_assets_processing_state_uploaded ON asset_ledger(processing_state, uploaded_at);
