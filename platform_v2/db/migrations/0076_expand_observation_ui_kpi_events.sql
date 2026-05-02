CREATE TABLE IF NOT EXISTS observation_ui_kpi_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    event_source TEXT NOT NULL DEFAULT 'web',
    page_path TEXT,
    route_key TEXT,
    action_key TEXT,
    user_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT observation_ui_kpi_events_event_name_check CHECK (event_name IN ('section_view', 'read_depth', 'primary_cta_click'))
);

CREATE INDEX IF NOT EXISTS idx_observation_ui_kpi_events_name_created
    ON observation_ui_kpi_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_observation_ui_kpi_events_subject_created
    ON observation_ui_kpi_events ((metadata->>'subjectId'), created_at DESC);
