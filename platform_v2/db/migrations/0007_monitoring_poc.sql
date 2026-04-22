CREATE TABLE IF NOT EXISTS monitoring_plots (
    plot_id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    plot_code TEXT NOT NULL,
    plot_name TEXT,
    area_m2 NUMERIC(12,2),
    status TEXT NOT NULL DEFAULT 'active',
    baseline_forest_type TEXT,
    geometry_summary JSONB DEFAULT '{}'::jsonb,
    fixed_photo_points JSONB DEFAULT '[]'::jsonb,
    imagery_context JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (place_id, plot_code)
);

CREATE INDEX IF NOT EXISTS idx_monitoring_plots_place_id
    ON monitoring_plots (place_id, plot_code);

CREATE TABLE IF NOT EXISTS monitoring_plot_visits (
    plot_visit_id TEXT PRIMARY KEY,
    plot_id TEXT NOT NULL REFERENCES monitoring_plots(plot_id) ON DELETE CASCADE,
    visit_id TEXT REFERENCES visits(visit_id) ON DELETE SET NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    protocol_code TEXT NOT NULL,
    complete_checklist_flag BOOLEAN NOT NULL DEFAULT FALSE,
    target_taxa_scope TEXT,
    observer_count INTEGER,
    site_condition_summary TEXT,
    evidence_summary JSONB DEFAULT '{}'::jsonb,
    imagery_context JSONB DEFAULT '{}'::jsonb,
    next_action TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_plot_visits_plot_id
    ON monitoring_plot_visits (plot_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_plot_visits_visit_id
    ON monitoring_plot_visits (visit_id)
    WHERE visit_id IS NOT NULL;
