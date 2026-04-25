ALTER TABLE audio_segments
    ADD COLUMN IF NOT EXISTS blob_id UUID REFERENCES asset_blobs(blob_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS privacy_status TEXT NOT NULL DEFAULT 'clean',
    ADD COLUMN IF NOT EXISTS privacy_checked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS privacy_reason TEXT,
    ADD COLUMN IF NOT EXISTS voice_flag BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'owner_only',
    ADD COLUMN IF NOT EXISTS compression_profile TEXT,
    ADD COLUMN IF NOT EXISTS fingerprint JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audio_segments_privacy_status
    ON audio_segments (privacy_status, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_audio_segments_blob_id
    ON audio_segments (blob_id)
    WHERE blob_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sound_bundles (
    bundle_id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id                   TEXT        NOT NULL,
    user_id                      TEXT,
    visit_id                     TEXT,
    place_id                     TEXT,
    bundle_key                   TEXT        NOT NULL,
    representative_segment_id    UUID        REFERENCES audio_segments(segment_id) ON DELETE SET NULL,
    representative_fingerprint   JSONB       NOT NULL DEFAULT '{}'::jsonb,
    segment_count                INTEGER     NOT NULL DEFAULT 0,
    total_duration_sec           REAL        NOT NULL DEFAULT 0,
    first_recorded_at            TIMESTAMPTZ,
    last_recorded_at             TIMESTAMPTZ,
    candidate_taxon              TEXT,
    best_confidence              REAL,
    dual_agree                   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, bundle_key)
);

CREATE INDEX IF NOT EXISTS idx_sound_bundles_session
    ON sound_bundles (session_id, first_recorded_at);

CREATE TABLE IF NOT EXISTS sound_bundle_members (
    bundle_id        UUID        NOT NULL REFERENCES sound_bundles(bundle_id) ON DELETE CASCADE,
    segment_id       UUID        NOT NULL REFERENCES audio_segments(segment_id) ON DELETE CASCADE,
    added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bundle_id, segment_id)
);

CREATE INDEX IF NOT EXISTS idx_sound_bundle_members_segment
    ON sound_bundle_members (segment_id);
