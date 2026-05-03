CREATE TABLE IF NOT EXISTS civic_observation_contexts (
    context_id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    context_kind TEXT NOT NULL DEFAULT 'ordinary',
    activity_label TEXT,
    activity_intent TEXT,
    participant_role TEXT,
    audience_scope TEXT NOT NULL DEFAULT 'private',
    public_precision TEXT NOT NULL DEFAULT 'municipality',
    risk_lane TEXT NOT NULL DEFAULT 'normal',
    report_consent TEXT NOT NULL DEFAULT 'none',
    revisit_of_visit_id TEXT REFERENCES visits(visit_id) ON DELETE SET NULL,
    field_id TEXT,
    route_id TEXT,
    plot_id TEXT REFERENCES site_plots(plot_id) ON DELETE SET NULL,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (visit_id),
    CHECK (context_kind IN ('ordinary', 'event', 'school', 'satoyama', 'risk', 'site_summary')),
    CHECK (activity_intent IS NULL OR activity_intent IN ('discover', 'revisit', 'compare', 'learn', 'manage', 'confirm', 'share')),
    CHECK (participant_role IS NULL OR participant_role IN ('finder', 'photographer', 'context_recorder', 'note_taker', 'guide', 'reviewer', 'manager', 'teacher', 'student', 'participant')),
    CHECK (audience_scope IN ('private', 'class_group', 'event_participants', 'public', 'partner_internal', 'research_internal')),
    CHECK (public_precision IN ('exact_private', 'site', 'mesh', 'municipality', 'hidden')),
    CHECK (risk_lane IN ('normal', 'danger_candidate', 'invasive_candidate', 'tree_anomaly', 'rare_sensitive')),
    CHECK (report_consent IN ('none', 'internal', 'public_summary', 'research_export'))
);

CREATE INDEX IF NOT EXISTS idx_civic_observation_contexts_kind
    ON civic_observation_contexts (context_kind, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_observation_contexts_revisit
    ON civic_observation_contexts (revisit_of_visit_id)
    WHERE revisit_of_visit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_civic_observation_contexts_field
    ON civic_observation_contexts (field_id)
    WHERE field_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_civic_observation_contexts_plot
    ON civic_observation_contexts (plot_id)
    WHERE plot_id IS NOT NULL;
