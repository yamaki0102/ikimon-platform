DROP INDEX IF EXISTS idx_evidence_assets_legacy_asset_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_assets_legacy_asset_key
    ON evidence_assets (legacy_asset_key);

DROP INDEX IF EXISTS idx_identifications_legacy_identification_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_identifications_legacy_identification_key
    ON identifications (legacy_identification_key);
