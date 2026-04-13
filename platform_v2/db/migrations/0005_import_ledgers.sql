CREATE TABLE IF NOT EXISTS migration_ledger (
    migration_ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_run_id UUID REFERENCES migration_runs(migration_run_id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    legacy_source TEXT NOT NULL DEFAULT 'php_json',
    legacy_entity_type TEXT NOT NULL,
    legacy_id TEXT NOT NULL,
    legacy_path TEXT,
    canonical_entity_type TEXT,
    canonical_id TEXT,
    canonical_parent_type TEXT,
    canonical_parent_id TEXT,
    import_status TEXT NOT NULL DEFAULT 'pending',
    skipped_reason TEXT,
    source_checksum TEXT,
    import_version TEXT NOT NULL DEFAULT 'v0',
    observed_at TIMESTAMPTZ,
    imported_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_migration_ledger_identity
    ON migration_ledger (legacy_source, legacy_entity_type, legacy_id, import_version);

CREATE INDEX IF NOT EXISTS idx_migration_ledger_status
    ON migration_ledger (import_status, entity_type, imported_at DESC);

CREATE INDEX IF NOT EXISTS idx_migration_ledger_canonical
    ON migration_ledger (canonical_entity_type, canonical_id);

CREATE TABLE IF NOT EXISTS asset_ledger (
    asset_ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_run_id UUID REFERENCES migration_runs(migration_run_id) ON DELETE SET NULL,
    legacy_source TEXT NOT NULL DEFAULT 'php_fs',
    legacy_relative_path TEXT NOT NULL,
    logical_asset_type TEXT NOT NULL,
    storage_backend TEXT NOT NULL DEFAULT 'local_fs',
    storage_path TEXT,
    blob_id UUID REFERENCES asset_blobs(blob_id) ON DELETE SET NULL,
    asset_id UUID REFERENCES evidence_assets(asset_id) ON DELETE SET NULL,
    import_status TEXT NOT NULL DEFAULT 'pending',
    skipped_reason TEXT,
    sha256 TEXT,
    bytes BIGINT,
    mime_type TEXT,
    import_version TEXT NOT NULL DEFAULT 'v0',
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    imported_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_ledger_legacy_path_version
    ON asset_ledger (legacy_source, legacy_relative_path, import_version);

CREATE INDEX IF NOT EXISTS idx_asset_ledger_status
    ON asset_ledger (import_status, logical_asset_type, imported_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_ledger_blob_id
    ON asset_ledger (blob_id);
