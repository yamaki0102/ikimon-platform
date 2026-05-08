-- Site-Based Biodiversity Monitoring OS foundation.
--
-- D2.23/BioMonWeek follow-up: keep observation method, sensor effort,
-- AI uncertainty, human review, and export identifiers separate enough
-- for audit, reporting, and future FAIR/DwC/CamTrap/eDNA links.
--
-- owner-sensitive-ok: additive ALTER/INDEX on passive_audio_ingest_events;
-- deploy with migration owner role. Rollback is to leave nullable columns and
-- companion tables unused; do not drop audit data after smoke records exist.

ALTER TABLE passive_audio_ingest_events
    ADD COLUMN IF NOT EXISTS plot_id TEXT,
    ADD COLUMN IF NOT EXISTS timezone TEXT,
    ADD COLUMN IF NOT EXISTS device_deployment_id TEXT,
    ADD COLUMN IF NOT EXISTS observation_method TEXT NOT NULL DEFAULT 'passive_audio',
    ADD COLUMN IF NOT EXISTS protocol_id TEXT,
    ADD COLUMN IF NOT EXISTS sampling_effort JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS sensor_status JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS recording_window_sec NUMERIC(10,3),
    ADD COLUMN IF NOT EXISTS sample_rate_hz INTEGER,
    ADD COLUMN IF NOT EXISTS frequency_range_hz INT4RANGE,
    ADD COLUMN IF NOT EXISTS inference_window_sec NUMERIC(10,3),
    ADD COLUMN IF NOT EXISTS embedding_model_id TEXT,
    ADD COLUMN IF NOT EXISTS embedding_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_passive_audio_ingest_plot_time
    ON passive_audio_ingest_events (site_id, plot_id, observed_start_at DESC)
    WHERE plot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_passive_audio_ingest_deployment_time
    ON passive_audio_ingest_events (device_deployment_id, observed_start_at DESC)
    WHERE device_deployment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS observation_method_contexts (
    method_context_id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    observation_method TEXT NOT NULL,
    protocol_id TEXT,
    device_deployment_id TEXT,
    sampling_effort JSONB NOT NULL DEFAULT '{}'::jsonb,
    sensor_status JSONB NOT NULL DEFAULT '{}'::jsonb,
    method_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    quality_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (visit_id),
    CHECK (observation_method IN (
        'casual_photo',
        'guided_survey',
        'field_scan',
        'passive_audio',
        'camera_trap',
        'ias_route_camera',
        'edna_reference'
    ))
);

CREATE INDEX IF NOT EXISTS idx_observation_method_contexts_method
    ON observation_method_contexts (observation_method, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_observation_method_contexts_deployment
    ON observation_method_contexts (device_deployment_id, updated_at DESC)
    WHERE device_deployment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sensor_deployments (
    device_deployment_id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    plot_id TEXT,
    device_id TEXT,
    observation_method TEXT NOT NULL DEFAULT 'passive_audio',
    deployed_at TIMESTAMPTZ,
    removed_at TIMESTAMPTZ,
    timezone TEXT,
    position_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    protocol_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    maintenance_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (observation_method IN ('passive_audio', 'camera_trap', 'ias_route_camera'))
);

CREATE INDEX IF NOT EXISTS idx_sensor_deployments_site_plot
    ON sensor_deployments (site_id, plot_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_confidence_calibration_registry (
    calibration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id TEXT NOT NULL,
    model_version TEXT NOT NULL,
    taxon_name TEXT NOT NULL,
    taxon_rank TEXT,
    region_key TEXT NOT NULL DEFAULT 'global',
    observation_method TEXT NOT NULL DEFAULT 'passive_audio',
    recommended_threshold NUMERIC(6,5) NOT NULL,
    target_precision NUMERIC(6,5),
    minimum_review_count INTEGER,
    calibration_status TEXT NOT NULL DEFAULT 'draft',
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (model_id, model_version, taxon_name, region_key, observation_method),
    CHECK (recommended_threshold >= 0 AND recommended_threshold <= 1),
    CHECK (target_precision IS NULL OR (target_precision >= 0 AND target_precision <= 1)),
    CHECK (calibration_status IN ('draft', 'active', 'deprecated'))
);

CREATE INDEX IF NOT EXISTS idx_ai_confidence_calibration_lookup
    ON ai_confidence_calibration_registry (model_id, model_version, taxon_name, region_key, observation_method)
    WHERE calibration_status = 'active';

CREATE TABLE IF NOT EXISTS taxon_external_ids (
    taxon_external_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    taxon_name TEXT NOT NULL,
    taxon_rank TEXT,
    authority TEXT NOT NULL,
    external_id TEXT NOT NULL,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (authority, external_id),
    CHECK (authority IN ('gbif', 'easin', 'dwc_taxon', 'inat', 'local_authority'))
);

CREATE INDEX IF NOT EXISTS idx_taxon_external_ids_name
    ON taxon_external_ids (lower(taxon_name), authority);

CREATE TABLE IF NOT EXISTS edna_reference_evidence (
    edna_reference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id TEXT REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    sample_id TEXT,
    sample_matrix TEXT,
    marker_gene TEXT,
    primer_set TEXT,
    reference_database TEXT,
    taxonomic_resolution TEXT,
    storage_method TEXT,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edna_reference_evidence_visit
    ON edna_reference_evidence (visit_id, updated_at DESC)
    WHERE visit_id IS NOT NULL;

COMMENT ON TABLE observation_method_contexts IS
  'Normalized observation method and effort context for site-based evidence reports.';

COMMENT ON TABLE ai_confidence_calibration_registry IS
  'Species/region/model-specific thresholds; AI candidates remain provisional until human review.';
