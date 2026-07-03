-- Field profile generation history.
--
-- Purpose:
--   Preserve how a public/internal area profile was generated: which source
--   records were included or suppressed, which AI runs and human decisions were
--   used, and which ruleset/version produced the snapshot.

CREATE TABLE IF NOT EXISTS field_profile_generation_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES observation_fields(field_id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ruleset_version TEXT NOT NULL,
    input_record_count INTEGER NOT NULL DEFAULT 0,
    public_record_count INTEGER NOT NULL DEFAULT 0,
    suppressed_record_count INTEGER NOT NULL DEFAULT 0,
    ai_run_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    human_decision_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_by TEXT NOT NULL DEFAULT 'system',
    visibility TEXT NOT NULL DEFAULT 'internal',
    generation_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (visibility IN ('internal', 'manager', 'public')),
    CHECK (input_record_count >= 0),
    CHECK (public_record_count >= 0),
    CHECK (suppressed_record_count >= 0),
    CHECK (length(trim(ruleset_version)) > 0)
);

CREATE TABLE IF NOT EXISTS field_profile_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES field_profile_generation_runs(run_id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES observation_fields(field_id) ON DELETE CASCADE,
    visibility TEXT NOT NULL DEFAULT 'internal',
    profile_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    limitations_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (visibility IN ('internal', 'manager', 'public'))
);

CREATE TABLE IF NOT EXISTS field_profile_source_records (
    source_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES field_profile_generation_runs(run_id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES observation_fields(field_id) ON DELETE CASCADE,
    visit_id TEXT REFERENCES visits(visit_id) ON DELETE SET NULL,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    contribution_status TEXT NOT NULL DEFAULT 'internal',
    policy_reason TEXT NOT NULL DEFAULT '',
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (contribution_status IN ('public', 'suppressed', 'internal'))
);

CREATE INDEX IF NOT EXISTS idx_field_profile_generation_runs_field
    ON field_profile_generation_runs (field_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_profile_snapshots_field
    ON field_profile_snapshots (field_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_profile_source_records_run
    ON field_profile_source_records (run_id, contribution_status);
