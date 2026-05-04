CREATE TABLE IF NOT EXISTS record_ui_kpi_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    event_source TEXT NOT NULL DEFAULT 'web',
    page_path TEXT,
    route_key TEXT,
    action_key TEXT,
    user_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT record_ui_kpi_events_event_name_check CHECK (event_name IN ('funnel_step', 'funnel_error'))
);

CREATE INDEX IF NOT EXISTS idx_record_ui_kpi_events_name_created
    ON record_ui_kpi_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_record_ui_kpi_events_route_created
    ON record_ui_kpi_events (route_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_record_ui_kpi_events_action_created
    ON record_ui_kpi_events (action_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_record_ui_kpi_events_session_created
    ON record_ui_kpi_events ((metadata->>'recordSessionId'), created_at DESC);
