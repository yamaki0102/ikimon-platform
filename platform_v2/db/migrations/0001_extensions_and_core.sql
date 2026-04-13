CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    legacy_user_id TEXT UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT,
    avatar_asset_id UUID,
    role_name TEXT DEFAULT 'Observer',
    rank_label TEXT DEFAULT '観察者',
    auth_provider TEXT DEFAULT 'local',
    oauth_id TEXT,
    observer_rank_json JSONB DEFAULT '{}'::jsonb,
    stats_json JSONB DEFAULT '{}'::jsonb,
    is_seed BOOLEAN DEFAULT FALSE,
    banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
    ON users (LOWER(email))
    WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS oauth_accounts (
    oauth_account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    profile_json JSONB DEFAULT '{}'::jsonb,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS remember_tokens (
    remember_token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    token_family TEXT,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_remember_tokens_user_id
    ON remember_tokens (user_id);

CREATE TABLE IF NOT EXISTS invites (
    invite_id TEXT PRIMARY KEY,
    legacy_code TEXT UNIQUE,
    owner_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    code TEXT NOT NULL UNIQUE,
    accept_count INTEGER DEFAULT 0,
    accepted_user_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS places (
    place_id TEXT PRIMARY KEY,
    legacy_place_key TEXT UNIQUE,
    legacy_site_id TEXT,
    canonical_name TEXT NOT NULL,
    locality_label TEXT,
    source_kind TEXT NOT NULL DEFAULT 'legacy',
    country_code TEXT DEFAULT 'JP',
    prefecture TEXT,
    municipality TEXT,
    mesh3 TEXT,
    mesh4 TEXT,
    center_latitude DOUBLE PRECISION,
    center_longitude DOUBLE PRECISION,
    bbox_json JSONB DEFAULT '{}'::jsonb,
    first_visit_at TIMESTAMPTZ,
    last_visit_at TIMESTAMPTZ,
    visit_count INTEGER DEFAULT 0,
    occurrence_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS place_boundaries (
    boundary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    boundary_kind TEXT NOT NULL DEFAULT 'primary',
    boundary_geojson JSONB NOT NULL,
    source TEXT DEFAULT 'legacy',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visits (
    visit_id TEXT PRIMARY KEY,
    legacy_observation_id TEXT UNIQUE,
    place_id TEXT REFERENCES places(place_id) ON DELETE SET NULL,
    user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    session_mode TEXT,
    visit_mode TEXT DEFAULT 'manual',
    complete_checklist_flag BOOLEAN DEFAULT FALSE,
    target_taxa_scope TEXT,
    movement_mode TEXT,
    route_hash TEXT,
    effort_minutes NUMERIC(8,2),
    distance_meters NUMERIC(12,2),
    step_count INTEGER,
    point_latitude DOUBLE PRECISION,
    point_longitude DOUBLE PRECISION,
    coordinate_uncertainty_m NUMERIC(10,2),
    observed_country TEXT,
    observed_prefecture TEXT,
    observed_municipality TEXT,
    locality_note TEXT,
    note TEXT,
    source_kind TEXT NOT NULL DEFAULT 'legacy_observation',
    source_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visits_observed_at
    ON visits (observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_visits_place_id
    ON visits (place_id);

CREATE INDEX IF NOT EXISTS idx_visits_user_id
    ON visits (user_id);

CREATE TABLE IF NOT EXISTS visit_track_points (
    visit_track_point_id BIGINT GENERATED ALWAYS AS IDENTITY,
    visit_id TEXT NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL,
    sequence_no INTEGER NOT NULL,
    point_latitude DOUBLE PRECISION NOT NULL,
    point_longitude DOUBLE PRECISION NOT NULL,
    accuracy_m NUMERIC(10,2),
    altitude_m NUMERIC(10,2),
    speed_mps NUMERIC(10,3),
    heading_degrees NUMERIC(6,2),
    raw_payload JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (observed_at, visit_track_point_id)
);

CREATE INDEX IF NOT EXISTS idx_visit_track_points_visit_sequence
    ON visit_track_points (visit_id, sequence_no);

SELECT create_hypertable('visit_track_points', by_range('observed_at'), if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS occurrences (
    occurrence_id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    legacy_observation_id TEXT,
    subject_index INTEGER DEFAULT 0,
    scientific_name TEXT,
    vernacular_name TEXT,
    taxon_rank TEXT,
    taxon_concept_version TEXT,
    basis_of_record TEXT DEFAULT 'HumanObservation',
    organism_origin TEXT,
    cultivation TEXT,
    occurrence_status TEXT DEFAULT 'present',
    individual_count INTEGER,
    confidence_score NUMERIC(6,5),
    evidence_tier NUMERIC(4,2),
    data_quality TEXT,
    quality_grade TEXT,
    ai_assessment_status TEXT,
    best_supported_descendant_taxon TEXT,
    biome TEXT,
    substrate_tags JSONB DEFAULT '[]'::jsonb,
    evidence_tags JSONB DEFAULT '[]'::jsonb,
    source_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_occurrences_visit_id
    ON occurrences (visit_id);

CREATE INDEX IF NOT EXISTS idx_occurrences_scientific_name
    ON occurrences (scientific_name);

CREATE TABLE IF NOT EXISTS asset_blobs (
    blob_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_backend TEXT NOT NULL DEFAULT 'local_fs',
    storage_path TEXT NOT NULL,
    media_type TEXT NOT NULL,
    mime_type TEXT,
    public_url TEXT,
    sha256 TEXT,
    bytes BIGINT,
    width_px INTEGER,
    height_px INTEGER,
    duration_ms INTEGER,
    source_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_blobs_storage_path
    ON asset_blobs (storage_backend, storage_path);

CREATE INDEX IF NOT EXISTS idx_asset_blobs_sha256
    ON asset_blobs (sha256)
    WHERE sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS evidence_assets (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blob_id UUID REFERENCES asset_blobs(blob_id) ON DELETE RESTRICT,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    visit_id TEXT REFERENCES visits(visit_id) ON DELETE CASCADE,
    asset_role TEXT NOT NULL,
    captured_at TIMESTAMPTZ,
    legacy_relative_path TEXT,
    source_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_assets_occurrence_id
    ON evidence_assets (occurrence_id);

CREATE INDEX IF NOT EXISTS idx_evidence_assets_blob_id
    ON evidence_assets (blob_id);

CREATE TABLE IF NOT EXISTS identifications (
    identification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id TEXT NOT NULL REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    actor_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    actor_kind TEXT NOT NULL DEFAULT 'human',
    proposed_name TEXT NOT NULL,
    proposed_rank TEXT,
    identification_method TEXT,
    confidence_score NUMERIC(6,5),
    is_current BOOLEAN DEFAULT TRUE,
    notes TEXT,
    source_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identifications_occurrence_id
    ON identifications (occurrence_id);

CREATE TABLE IF NOT EXISTS place_conditions (
    place_condition_id UUID DEFAULT gen_random_uuid(),
    place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    visit_id TEXT REFERENCES visits(visit_id) ON DELETE SET NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    biome TEXT,
    managed_context_type TEXT,
    managed_site_name TEXT,
    substrate_tags JSONB DEFAULT '[]'::jsonb,
    evidence_tags JSONB DEFAULT '[]'::jsonb,
    organism_origin TEXT,
    cultivation TEXT,
    locality_note TEXT,
    summary TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (observed_at, place_condition_id)
);

CREATE INDEX IF NOT EXISTS idx_place_conditions_place_id
    ON place_conditions (place_id);

SELECT create_hypertable('place_conditions', by_range('observed_at'), if_not_exists => TRUE);
