CREATE TABLE IF NOT EXISTS site_plots (
    plot_id TEXT PRIMARY KEY,
    place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    legacy_site_id TEXT,
    label TEXT NOT NULL,
    plot_kind TEXT NOT NULL DEFAULT 'fixed',
    status TEXT NOT NULL DEFAULT 'active',
    area_square_meters NUMERIC(12,2),
    center_latitude DOUBLE PRECISION,
    center_longitude DOUBLE PRECISION,
    geometry_json JSONB DEFAULT '{}'::jsonb,
    fixed_photo_points_json JSONB DEFAULT '[]'::jsonb,
    baseline_json JSONB DEFAULT '{}'::jsonb,
    source_payload JSONB DEFAULT '{}'::jsonb,
    created_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    updated_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (plot_kind <> ''),
    CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_site_plots_place
    ON site_plots (place_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_plots_legacy_site
    ON site_plots (legacy_site_id)
    WHERE legacy_site_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS site_plot_visits (
    plot_visit_id TEXT PRIMARY KEY,
    plot_id TEXT NOT NULL REFERENCES site_plots(plot_id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL,
    surveyor_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    canopy_cover_percent NUMERIC(5,2),
    tree_count INTEGER,
    mean_dbh_cm NUMERIC(8,2),
    notes TEXT,
    measurements_json JSONB DEFAULT '{}'::jsonb,
    photo_points_json JSONB DEFAULT '[]'::jsonb,
    source_payload JSONB DEFAULT '{}'::jsonb,
    created_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    updated_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_plot_visits_plot_observed
    ON site_plot_visits (plot_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS plot_satellite_contexts (
    context_id TEXT PRIMARY KEY,
    scope_type TEXT NOT NULL,
    place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    plot_id TEXT REFERENCES site_plots(plot_id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ NOT NULL,
    provider TEXT NOT NULL DEFAULT 'manual',
    metrics_json JSONB DEFAULT '{}'::jsonb,
    source_payload JSONB DEFAULT '{}'::jsonb,
    created_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (scope_type IN ('site', 'plot')),
    CHECK (
        (scope_type = 'site' AND plot_id IS NULL)
        OR (scope_type = 'plot' AND plot_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_plot_satellite_contexts_site
    ON plot_satellite_contexts (place_id, captured_at DESC)
    WHERE scope_type = 'site';

CREATE INDEX IF NOT EXISTS idx_plot_satellite_contexts_plot
    ON plot_satellite_contexts (plot_id, captured_at DESC)
    WHERE scope_type = 'plot';
