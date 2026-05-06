CREATE INDEX IF NOT EXISTS idx_evidence_assets_visit_role_created
    ON evidence_assets (visit_id, asset_role, created_at ASC)
    INCLUDE (blob_id);
