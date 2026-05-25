--
-- Place Memory Full V1
-- Anonymous echoes unlocked only after the viewer records in the same public cell.
-- Photos are shown from privacy-redacted derivatives only.
-- owner-sensitive-ok: alert_deliveries is an existing production table owned by
-- the deploy role path. Rollback by removing place_memory_like/place_memory_admin
-- rows, dropping the trigger_kind CHECK, and restoring the previous CHECK list.

CREATE TABLE IF NOT EXISTS place_memory_entries (
    entry_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id              TEXT         NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id          TEXT         NOT NULL REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    user_id                TEXT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    cell_id                TEXT         NOT NULL,
    cell_grid_m            INT          NOT NULL DEFAULT 1000,
    memory_tags            TEXT[]       NOT NULL DEFAULT '{}'::text[],
    tags_public            BOOLEAN      NOT NULL DEFAULT true,
    echo_note              TEXT         NOT NULL DEFAULT '',
    private_note           TEXT         NOT NULL DEFAULT '',
    photo_echo_enabled     BOOLEAN      NOT NULL DEFAULT true,
    photo_echo_visibility  TEXT         NOT NULL DEFAULT 'processing',
    moderation_status      TEXT         NOT NULL DEFAULT 'visible',
    report_count           INT          NOT NULL DEFAULT 0,
    source_payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at             TIMESTAMPTZ,
    CONSTRAINT place_memory_entry_visit_unique UNIQUE (visit_id),
    CONSTRAINT place_memory_echo_note_len_chk CHECK (char_length(echo_note) <= 80),
    CONSTRAINT place_memory_private_note_len_chk CHECK (char_length(private_note) <= 600),
    CONSTRAINT place_memory_photo_visibility_chk CHECK (photo_echo_visibility IN (
        'no_photo',
        'processing',
        'ready',
        'hidden_by_user',
        'blocked_sensitive',
        'blocked_privacy_processing',
        'blocked_moderation'
    )),
    CONSTRAINT place_memory_moderation_status_chk CHECK (moderation_status IN (
        'visible',
        'hidden_by_report_threshold',
        'hidden_by_admin',
        'deleted_by_owner'
    ))
);

CREATE INDEX IF NOT EXISTS idx_place_memory_entries_cell_visible
    ON place_memory_entries (cell_id, created_at DESC)
    WHERE deleted_at IS NULL AND moderation_status = 'visible';

CREATE INDEX IF NOT EXISTS idx_place_memory_entries_user_recent
    ON place_memory_entries (user_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS place_memory_photo_derivatives (
    derivative_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id               UUID         NOT NULL REFERENCES place_memory_entries(entry_id) ON DELETE CASCADE,
    source_asset_id         UUID         REFERENCES evidence_assets(asset_id) ON DELETE SET NULL,
    redacted_blob_id        UUID         REFERENCES asset_blobs(blob_id) ON DELETE SET NULL,
    processing_status      TEXT         NOT NULL DEFAULT 'pending',
    face_status            TEXT         NOT NULL DEFAULT 'pending',
    license_plate_status   TEXT         NOT NULL DEFAULT 'pending',
    sensitive_status       TEXT         NOT NULL DEFAULT 'pending',
    retry_count            INT          NOT NULL DEFAULT 0,
    next_retry_at          TIMESTAMPTZ,
    last_error             TEXT,
    reviewer_note          TEXT,
    source_payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT place_memory_photo_derivative_entry_unique UNIQUE (entry_id),
    CONSTRAINT place_memory_processing_status_chk CHECK (processing_status IN (
        'pending',
        'processing',
        'ready',
        'sensitive_blocked',
        'failed_retryable',
        'failed_final',
        'not_required'
    ))
);

CREATE INDEX IF NOT EXISTS idx_place_memory_photo_derivatives_retry
    ON place_memory_photo_derivatives (processing_status, next_retry_at)
    WHERE processing_status IN ('pending','failed_retryable');

CREATE TABLE IF NOT EXISTS place_memory_likes (
    entry_id               UUID         NOT NULL REFERENCES place_memory_entries(entry_id) ON DELETE CASCADE,
    liker_user_id           TEXT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entry_id, liker_user_id)
);

CREATE TABLE IF NOT EXISTS place_memory_reports (
    report_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id               UUID         NOT NULL REFERENCES place_memory_entries(entry_id) ON DELETE CASCADE,
    reporter_user_id        TEXT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason_code            TEXT         NOT NULL DEFAULT 'other',
    reason_note            TEXT         NOT NULL DEFAULT '',
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT place_memory_report_unique UNIQUE (entry_id, reporter_user_id)
);

CREATE TABLE IF NOT EXISTS place_memory_user_hides (
    entry_id               UUID         NOT NULL REFERENCES place_memory_entries(entry_id) ON DELETE CASCADE,
    user_id                TEXT         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    hide_reason            TEXT         NOT NULL DEFAULT 'self',
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (entry_id, user_id)
);

CREATE TABLE IF NOT EXISTS place_memory_controls (
    control_key            TEXT         PRIMARY KEY,
    enabled                BOOLEAN      NOT NULL DEFAULT true,
    control_payload        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO place_memory_controls (control_key, enabled, control_payload)
VALUES
    ('feature', true, '{"label":"Place Memory feature"}'::jsonb),
    ('posting', true, '{"label":"Place Memory posting"}'::jsonb),
    ('photos', true, '{"label":"Place Memory photos"}'::jsonb),
    ('likes', true, '{"label":"Place Memory likes"}'::jsonb),
    ('notifications', true, '{"label":"Place Memory like notifications"}'::jsonb)
ON CONFLICT (control_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS place_memory_cell_controls (
    cell_id                TEXT         PRIMARY KEY,
    blocked                BOOLEAN      NOT NULL DEFAULT false,
    reason                 TEXT         NOT NULL DEFAULT '',
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS place_memory_user_controls (
    user_id                TEXT         PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    posting_blocked        BOOLEAN      NOT NULL DEFAULT false,
    reading_blocked        BOOLEAN      NOT NULL DEFAULT false,
    reason                 TEXT         NOT NULL DEFAULT '',
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS place_memory_user_preferences (
    user_id                    TEXT         PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    default_photo_echo_enabled BOOLEAN      NOT NULL DEFAULT true,
    default_tags_public        BOOLEAN      NOT NULL DEFAULT true,
    updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS place_memory_audit_events (
    audit_id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id               UUID         REFERENCES place_memory_entries(entry_id) ON DELETE SET NULL,
    actor_user_id           TEXT         REFERENCES users(user_id) ON DELETE SET NULL,
    event_kind             TEXT         NOT NULL,
    event_payload          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE alert_deliveries
    DROP CONSTRAINT IF EXISTS alert_deliveries_trigger_chk;

ALTER TABLE alert_deliveries
    ADD CONSTRAINT alert_deliveries_trigger_chk
    CHECK (trigger_kind IN (
        'invasive',
        'rare',
        'novelty',
        'taxon_match',
        'municipality_invasive',
        'subject_proposal',
        'area_watch',
        'place_memory_like',
        'place_memory_admin'
    ));
