-- Place Event Capsule: post-event package for fixed-place observation events.
--
-- The capsule keeps generated drafts and review state separate from raw live
-- event logs. Public output must be reviewed before publication.
-- owner-sensitive-ok: alters observation_event_live_events CHECK constraint to admit guide/field-scan source events; rollback by reapplying the prior obs_event_live_type_chk list after deleting those source event rows if needed.

ALTER TABLE observation_event_live_events
    DROP CONSTRAINT IF EXISTS obs_event_live_type_chk;

ALTER TABLE observation_event_live_events
    ADD CONSTRAINT obs_event_live_type_chk
        CHECK (type IN (
            'observation_added', 'guide_scene_added', 'field_scan_added', 'absence_recorded',
            'target_hit', 'rare_species', 'milestone',
            'announce', 'moderation', 'help_request',
            'checkin', 'team_update', 'mode_switch',
            'quest_offered', 'quest_accepted', 'quest_declined', 'quest_completed',
            'fanfare', 'ping'
        ));

CREATE TABLE IF NOT EXISTS observation_event_capsules (
    session_id          UUID        PRIMARY KEY REFERENCES observation_event_sessions(session_id) ON DELETE CASCADE,
    source_counts       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    source_clusters     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    private_digest      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    public_story_draft  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    record_candidates   JSONB       NOT NULL DEFAULT '[]'::jsonb,
    privacy_risk_queue  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    readiness           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    source_hash         TEXT        NOT NULL,
    model_metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    review_status       TEXT        NOT NULL DEFAULT 'draft',
    reviewed_by         TEXT,
    reviewed_at         TIMESTAMPTZ,
    published_at        TIMESTAMPTZ,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT obs_event_capsules_review_status_chk
        CHECK (review_status IN ('draft', 'needs_review', 'approved_private', 'approved_public', 'published'))
);

CREATE INDEX IF NOT EXISTS idx_obs_event_capsules_status
    ON observation_event_capsules (review_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_event_capsules_generated
    ON observation_event_capsules (generated_at DESC);
