CREATE TABLE IF NOT EXISTS programs (
    program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    program_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    membership_role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE (program_id, user_id, membership_role)
);

CREATE TABLE IF NOT EXISTS legacy_id_map (
    legacy_id_map_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_source TEXT NOT NULL,
    legacy_entity_type TEXT NOT NULL,
    legacy_id TEXT NOT NULL,
    canonical_entity_type TEXT NOT NULL,
    canonical_id TEXT NOT NULL,
    legacy_path TEXT,
    checksum_sha256 TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (legacy_source, legacy_entity_type, legacy_id)
);

CREATE TABLE IF NOT EXISTS migration_runs (
    migration_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    cursor_value TEXT,
    rows_seen BIGINT DEFAULT 0,
    rows_imported BIGINT DEFAULT 0,
    rows_skipped BIGINT DEFAULT 0,
    rows_failed BIGINT DEFAULT 0,
    details JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sync_cursors (
    sync_cursor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL UNIQUE,
    cursor_kind TEXT NOT NULL,
    cursor_value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS compatibility_write_ledger (
    compatibility_write_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    canonical_id TEXT NOT NULL,
    legacy_target TEXT NOT NULL,
    write_status TEXT NOT NULL,
    request_id TEXT,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_compatibility_write_lookup
    ON compatibility_write_ledger (entity_type, canonical_id, attempted_at DESC);

CREATE TABLE IF NOT EXISTS asset_import_manifest (
    asset_import_manifest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_relative_path TEXT NOT NULL UNIQUE,
    asset_id UUID REFERENCES evidence_assets(asset_id) ON DELETE SET NULL,
    sha256 TEXT,
    bytes BIGINT,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    imported_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);
