CREATE TABLE IF NOT EXISTS ui_kpi_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    event_source TEXT NOT NULL DEFAULT 'web',
    page_path TEXT,
    route_key TEXT,
    action_key TEXT,
    user_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ui_kpi_events_event_name_check CHECK (event_name IN ('first_action', 'task_completion'))
);

CREATE INDEX IF NOT EXISTS idx_ui_kpi_events_name_created
    ON ui_kpi_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ui_kpi_events_route_created
    ON ui_kpi_events (route_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ui_kpi_events_page_created
    ON ui_kpi_events (page_path, created_at DESC);
