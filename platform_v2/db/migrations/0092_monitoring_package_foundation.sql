CREATE TABLE IF NOT EXISTS waterbodies (
    ikimon_waterbody_id TEXT PRIMARY KEY,
    waterbody_type TEXT NOT NULL DEFAULT 'unspecified',
    parent_waterbody_id TEXT REFERENCES waterbodies(ikimon_waterbody_id) ON DELETE SET NULL,
    public_label TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'ikimon',
    source_version TEXT NOT NULL DEFAULT 'v0',
    geometry_precision TEXT NOT NULL DEFAULT 'label_only',
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (waterbody_type IN ('unspecified', 'basin', 'watershed', 'river', 'river_segment', 'lake', 'pond', 'wetland', 'estuary', 'coast', 'port', 'harbor', 'artificial_canal')),
    CHECK (geometry_precision IN ('label_only', 'municipality', 'mesh', 'segment', 'polygon', 'exact_private'))
);

CREATE INDEX IF NOT EXISTS idx_waterbodies_parent
    ON waterbodies (parent_waterbody_id)
    WHERE parent_waterbody_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waterbodies_public_label
    ON waterbodies (lower(public_label));

CREATE TABLE IF NOT EXISTS water_record_extensions (
    extension_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id TEXT NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    waterbody_id TEXT REFERENCES waterbodies(ikimon_waterbody_id) ON DELETE SET NULL,
    catch_outcome TEXT NOT NULL,
    capture_method TEXT,
    participant_count INTEGER,
    effort_minutes NUMERIC(8,2),
    target_taxa_scope TEXT,
    released_count INTEGER,
    kept_count INTEGER,
    public_waterbody_label TEXT,
    environment_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (visit_id),
    CHECK (catch_outcome IN ('caught', 'released', 'kept', 'lost', 'no_catch', 'observed_only')),
    CHECK (participant_count IS NULL OR participant_count >= 1),
    CHECK (effort_minutes IS NULL OR effort_minutes >= 0),
    CHECK (released_count IS NULL OR released_count >= 0),
    CHECK (kept_count IS NULL OR kept_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_water_record_extensions_waterbody
    ON water_record_extensions (waterbody_id, updated_at DESC)
    WHERE waterbody_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_water_record_extensions_outcome
    ON water_record_extensions (catch_outcome, updated_at DESC);

CREATE TABLE IF NOT EXISTS observation_data_rights (
    rights_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id TEXT NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    record_consent TEXT NOT NULL DEFAULT 'private',
    research_use_consent TEXT NOT NULL DEFAULT 'none',
    enterprise_report_consent TEXT NOT NULL DEFAULT 'none',
    dataset_license TEXT,
    media_license TEXT,
    external_export_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    withdrawal_status TEXT NOT NULL DEFAULT 'active',
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (visit_id),
    CHECK (record_consent IN ('private', 'internal', 'public_summary', 'external_export')),
    CHECK (research_use_consent IN ('none', 'internal', 'research_allowed', 'public_export')),
    CHECK (enterprise_report_consent IN ('none', 'internal', 'aggregated', 'identified')),
    CHECK (dataset_license IS NULL OR dataset_license IN ('CC0-1.0', 'CC-BY-4.0')),
    CHECK (media_license IS NULL OR media_license IN ('all_rights_reserved', 'CC-BY-4.0', 'CC-BY-NC-4.0')),
    CHECK (withdrawal_status IN ('active', 'withdrawn', 'delete_requested', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_observation_data_rights_export
    ON observation_data_rights (external_export_allowed, withdrawal_status, updated_at DESC);
