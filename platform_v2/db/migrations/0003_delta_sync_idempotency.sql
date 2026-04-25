ALTER TABLE evidence_assets
    ADD COLUMN IF NOT EXISTS legacy_asset_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_assets_legacy_asset_key
    ON evidence_assets (legacy_asset_key);

ALTER TABLE identifications
    ADD COLUMN IF NOT EXISTS legacy_identification_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_identifications_legacy_identification_key
    ON identifications (legacy_identification_key);
