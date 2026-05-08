CREATE TABLE IF NOT EXISTS field_scan_contexts (
    field_scan_context_id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    scan_mode TEXT NOT NULL,
    fixed_point_id TEXT,
    route_id TEXT,
    area_id TEXT,
    footprint_geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
    calibration_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    method_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    quality_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (visit_id),
    CHECK (scan_mode IN ('site_snapshot', 'fixed_point', 'route', 'area_footprint', 'calibration_evidence'))
);

CREATE INDEX IF NOT EXISTS idx_field_scan_contexts_mode
    ON field_scan_contexts (scan_mode, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_scan_contexts_route
    ON field_scan_contexts (route_id, updated_at DESC)
    WHERE route_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS observation_governance_contexts (
    governance_context_id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    local_knowledge_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    site_policy_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    role_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    public_precision_policy TEXT NOT NULL DEFAULT 'system_risk_cap',
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (visit_id),
    CHECK (public_precision_policy IN ('system_risk_cap', 'admin_reviewer', 'site_policy', 'user_preference'))
);

CREATE INDEX IF NOT EXISTS idx_observation_governance_contexts_policy
    ON observation_governance_contexts (public_precision_policy, updated_at DESC);

CREATE TABLE IF NOT EXISTS observation_package_events (
    package_event_id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    event_stage TEXT NOT NULL,
    event_kind TEXT NOT NULL,
    actor_kind TEXT NOT NULL DEFAULT 'system',
    actor_user_id TEXT,
    decision_authority TEXT NOT NULL DEFAULT 'human_required',
    human_review_required BOOLEAN NOT NULL DEFAULT TRUE,
    event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (event_stage IN ('raw_observation', 'reviewed_data', 'indicator_candidate', 'report_output', 'export_package')),
    CHECK (decision_authority IN ('human_required', 'observer', 'trusted_reviewer', 'expert_reviewer', 'admin', 'site_policy', 'system_risk_cap'))
);

CREATE INDEX IF NOT EXISTS idx_observation_package_events_visit
    ON observation_package_events (visit_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_observation_package_events_stage
    ON observation_package_events (event_stage, created_at DESC);
