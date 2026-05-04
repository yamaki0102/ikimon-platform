CREATE TABLE IF NOT EXISTS passive_audio_ingest_events (
    ingest_event_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dedupe_key          TEXT        NOT NULL UNIQUE,
    source_type         TEXT        NOT NULL,
    source_id           TEXT        NOT NULL,
    source_name         TEXT        NOT NULL,
    site_id             TEXT        NOT NULL,
    device_id           TEXT,
    observed_start_at   TIMESTAMPTZ NOT NULL,
    observed_end_at     TIMESTAMPTZ NOT NULL,
    species_label       TEXT        NOT NULL,
    scientific_name     TEXT,
    confidence          REAL        NOT NULL,
    model_id            TEXT,
    model_version       TEXT,
    raw_payload_hash    TEXT,
    visit_id            TEXT        REFERENCES visits(visit_id) ON DELETE SET NULL,
    occurrence_id       TEXT        REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    audio_segment_id    UUID        REFERENCES audio_segments(segment_id) ON DELETE SET NULL,
    evidence_asset_id   UUID        REFERENCES evidence_assets(asset_id) ON DELETE SET NULL,
    review_id           UUID        REFERENCES observation_quality_reviews(review_id) ON DELETE SET NULL,
    tier15_candidate    BOOLEAN     NOT NULL DEFAULT FALSE,
    normalized_event    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    provenance          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    ingest_status       TEXT        NOT NULL DEFAULT 'accepted',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT passive_audio_ingest_events_confidence_chk
        CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT passive_audio_ingest_events_status_chk
        CHECK (ingest_status IN ('accepted', 'duplicate', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_passive_audio_ingest_site_time
    ON passive_audio_ingest_events (site_id, observed_start_at DESC);

CREATE INDEX IF NOT EXISTS idx_passive_audio_ingest_tier15
    ON passive_audio_ingest_events (tier15_candidate, observed_start_at DESC)
    WHERE tier15_candidate = TRUE;

CREATE INDEX IF NOT EXISTS idx_passive_audio_ingest_review
    ON passive_audio_ingest_events (review_id)
    WHERE review_id IS NOT NULL;

COMMENT ON TABLE passive_audio_ingest_events IS
  'Immutable event-only ingest ledger for BirdNET-Go/TinyML passive audio detections. Raw audio is not stored here.';
