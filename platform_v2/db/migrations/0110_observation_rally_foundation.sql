-- Observation Rally foundation.
--
-- Purpose:
--   観察会セッションの上に「地点固定でも、地点非固定でも使える」
--   観察ラリーを載せる。ミッションは count_unit と location_binding を必須にし、
--   100% を超える共同進捗、開催中の差し替え、開催時間限定の位置共有を扱う。
--
-- owner-sensitive-ok: additive tables/columns and live-event CHECK expansion only.
-- rollback is leaving tables unused; do not drop live rally history after events run.

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
            'rally_mission_published', 'rally_mission_paused', 'rally_mission_replaced',
            'rally_mission_extended', 'rally_mission_closed',
            'rally_progress_updated', 'rally_goal_reached', 'rally_goal_exceeded',
            'rally_station_opened', 'rally_arrived', 'rally_task_submitted',
            'rally_task_cleared', 'rally_help_requested', 'rally_next_action',
            'participant_location_ping',
            'fanfare', 'ping'
        ));

ALTER TABLE observation_event_participants
    ADD COLUMN IF NOT EXISTS location_share_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS location_share_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS location_share_consent_type TEXT,
    ADD CONSTRAINT obs_event_participants_location_consent_chk
        CHECK (
            location_share_consent_type IS NULL
            OR location_share_consent_type IN ('self', 'guardian', 'organizer')
        );

CREATE TABLE IF NOT EXISTS observation_rally_courses (
    course_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID NOT NULL UNIQUE REFERENCES observation_event_sessions(session_id) ON DELETE CASCADE,
    title          TEXT NOT NULL DEFAULT '観察ラリー',
    status         TEXT NOT NULL DEFAULT 'draft',
    config         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('draft', 'preflight', 'live', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_courses_session
    ON observation_rally_courses (session_id);

CREATE TABLE IF NOT EXISTS observation_rally_stations (
    station_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id      UUID NOT NULL REFERENCES observation_rally_courses(course_id) ON DELETE CASCADE,
    field_id       UUID REFERENCES observation_fields(field_id) ON DELETE SET NULL,
    code           TEXT NOT NULL DEFAULT '',
    name           TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    lat            DOUBLE PRECISION,
    lng            DOUBLE PRECISION,
    radius_m       INTEGER,
    polygon        JSONB,
    route_geojson  JSONB,
    is_private     BOOLEAN NOT NULL DEFAULT FALSE,
    access_note    TEXT NOT NULL DEFAULT '',
    danger_note    TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'open',
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('open', 'paused', 'closed')),
    CHECK (radius_m IS NULL OR (radius_m >= 5 AND radius_m <= 200000))
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_stations_course
    ON observation_rally_stations (course_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS observation_rally_missions (
    mission_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id         UUID NOT NULL REFERENCES observation_rally_courses(course_id) ON DELETE CASCADE,
    station_id        UUID REFERENCES observation_rally_stations(station_id) ON DELETE SET NULL,
    replacement_for_mission_id UUID REFERENCES observation_rally_missions(mission_id) ON DELETE SET NULL,
    scope             TEXT NOT NULL,
    location_binding  TEXT NOT NULL,
    title             TEXT NOT NULL,
    target            TEXT NOT NULL,
    count_unit        TEXT NOT NULL,
    goal_count        NUMERIC(12,2) NOT NULL,
    counting_policy   JSONB NOT NULL DEFAULT '{}'::jsonb,
    verification_policy TEXT NOT NULL DEFAULT 'auto',
    weather_sensitivity TEXT NOT NULL DEFAULT 'all_weather',
    fallback_group    TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'draft',
    starts_at         TIMESTAMPTZ,
    ends_at           TIMESTAMPTZ,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    created_by        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (scope IN ('event', 'team', 'participant', 'station')),
    CHECK (location_binding IN ('none', 'station_required', 'within_area', 'near_route', 'any_registered_station')),
    CHECK (count_unit IN ('scene', 'individual', 'location', 'comparison_pair', 'station_clear', 'team_completion')),
    CHECK (goal_count > 0),
    CHECK (verification_policy IN ('auto', 'organizer_review', 'ai_assisted', 'qr')),
    CHECK (weather_sensitivity IN ('all_weather', 'rain_ok', 'dry_only', 'sunny_only', 'wind_sensitive', 'temperature_sensitive')),
    CHECK (status IN ('draft', 'published', 'paused', 'replaced', 'closed')),
    CHECK (
        (location_binding = 'station_required' AND station_id IS NOT NULL)
        OR location_binding <> 'station_required'
    )
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_missions_course_status
    ON observation_rally_missions (course_id, status, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_obs_rally_missions_station
    ON observation_rally_missions (station_id, status)
    WHERE station_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS observation_rally_submissions (
    submission_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID NOT NULL REFERENCES observation_event_sessions(session_id) ON DELETE CASCADE,
    course_id      UUID NOT NULL REFERENCES observation_rally_courses(course_id) ON DELETE CASCADE,
    mission_id     UUID NOT NULL REFERENCES observation_rally_missions(mission_id) ON DELETE CASCADE,
    station_id     UUID REFERENCES observation_rally_stations(station_id) ON DELETE SET NULL,
    user_id        TEXT,
    guest_token    TEXT,
    team_id        UUID REFERENCES observation_event_teams(team_id) ON DELETE SET NULL,
    source_type    TEXT NOT NULL DEFAULT 'manual_rally',
    source_ref     TEXT,
    count_value    NUMERIC(12,2) NOT NULL DEFAULT 1,
    lat            DOUBLE PRECISION,
    lng            DOUBLE PRECISION,
    payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_status  TEXT NOT NULL DEFAULT 'pending',
    reviewed_by    TEXT,
    reviewed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (count_value > 0),
    CHECK (review_status IN ('pending', 'auto_accepted', 'accepted', 'rejected')),
    CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_submissions_mission
    ON observation_rally_submissions (mission_id, review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_rally_submissions_session
    ON observation_rally_submissions (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS observation_rally_progress (
    progress_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID NOT NULL REFERENCES observation_rally_courses(course_id) ON DELETE CASCADE,
    mission_id      UUID NOT NULL REFERENCES observation_rally_missions(mission_id) ON DELETE CASCADE,
    progress_scope  TEXT NOT NULL DEFAULT 'event',
    team_id         UUID REFERENCES observation_event_teams(team_id) ON DELETE CASCADE,
    participant_key TEXT,
    station_id      UUID REFERENCES observation_rally_stations(station_id) ON DELETE CASCADE,
    actual_count    NUMERIC(12,2) NOT NULL DEFAULT 0,
    goal_count      NUMERIC(12,2) NOT NULL,
    percent         NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (progress_scope IN ('event', 'team', 'participant', 'station')),
    CHECK (goal_count > 0),
    CHECK (actual_count >= 0),
    CHECK (status IN ('active', 'reached', 'exceeded', 'closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_rally_progress_unique
    ON observation_rally_progress (
        mission_id,
        progress_scope,
        COALESCE(team_id::text, ''),
        COALESCE(participant_key, ''),
        COALESCE(station_id::text, '')
    );

CREATE TABLE IF NOT EXISTS observation_rally_revisions (
    revision_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id       UUID NOT NULL REFERENCES observation_rally_courses(course_id) ON DELETE CASCADE,
    mission_id      UUID REFERENCES observation_rally_missions(mission_id) ON DELETE SET NULL,
    action          TEXT NOT NULL,
    reason          TEXT NOT NULL DEFAULT '',
    before_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_payload   JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor_user_id   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (action IN ('publish', 'pause', 'replace', 'extend', 'close', 'create', 'station_create'))
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_revisions_course
    ON observation_rally_revisions (course_id, created_at DESC);
