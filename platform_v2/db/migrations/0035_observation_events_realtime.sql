-- Observation Events: Realtime cooperative observation sessions.
--
-- Purpose:
--   観察会の実時間協力体験を v2 で完結させる。
--   - 5 モード(Discovery / Effort Maximize / Bingo / Absence Confirm / AI Quest)
--   - 班(team)機構、班員位置(同班のみ opt-in 100m 粒度)
--   - PostgreSQL LISTEN/NOTIFY による SSE 1秒 fanout
--   - Absence 記録、AI Quest 履歴、事後 recap 永続アクセス
--
-- 関連設計: plans/ikimon-life-uxui-os-zany-deer.md
-- 既存資産: guideApi SSE pattern, ObservationEffort.php (TS port 予定)

-- =====================================================================
-- セッション本体
-- =====================================================================
CREATE TABLE IF NOT EXISTS observation_event_sessions (
    session_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_event_id     TEXT,
    event_code          TEXT         UNIQUE,
    title               TEXT         NOT NULL DEFAULT '',
    organizer_user_id   TEXT         NOT NULL,
    corporation_id      TEXT,
    plan                TEXT         NOT NULL DEFAULT 'community',
    primary_mode        TEXT         NOT NULL DEFAULT 'discovery',
    active_modes        TEXT[]       NOT NULL DEFAULT ARRAY['discovery']::TEXT[],
    location_lat        DOUBLE PRECISION,
    location_lng        DOUBLE PRECISION,
    location_radius_m   INTEGER      NOT NULL DEFAULT 1000,
    started_at          TIMESTAMPTZ  NOT NULL,
    ended_at            TIMESTAMPTZ,
    target_species      TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    config              JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT obs_event_session_plan_chk
        CHECK (plan IN ('community', 'public')),
    CONSTRAINT obs_event_session_primary_mode_chk
        CHECK (primary_mode IN ('discovery', 'effort_maximize', 'bingo', 'absence_confirm', 'ai_quest'))
);

CREATE INDEX IF NOT EXISTS idx_obs_event_sessions_organizer
    ON observation_event_sessions (organizer_user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_event_sessions_active
    ON observation_event_sessions (started_at, ended_at)
    WHERE ended_at IS NULL;

-- =====================================================================
-- 班(team)
-- =====================================================================
CREATE TABLE IF NOT EXISTS observation_event_teams (
    team_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID         NOT NULL REFERENCES observation_event_sessions(session_id) ON DELETE CASCADE,
    name         TEXT         NOT NULL,
    color        TEXT         NOT NULL DEFAULT '#4f9d69',
    lead_user_id TEXT,
    target_taxa  TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    centroid_lat DOUBLE PRECISION,
    centroid_lng DOUBLE PRECISION,
    centroid_updated_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_event_teams_session
    ON observation_event_teams (session_id);

-- =====================================================================
-- 参加者
-- =====================================================================
CREATE TABLE IF NOT EXISTS observation_event_participants (
    participant_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID         NOT NULL REFERENCES observation_event_sessions(session_id) ON DELETE CASCADE,
    user_id         TEXT,
    guest_token     TEXT,
    display_name    TEXT         NOT NULL DEFAULT '',
    team_id         UUID         REFERENCES observation_event_teams(team_id) ON DELETE SET NULL,
    role            TEXT         NOT NULL DEFAULT 'participant',
    declared_job    TEXT,
    status          TEXT         NOT NULL DEFAULT 'registered',
    checked_in_at   TIMESTAMPTZ,
    last_ping_at    TIMESTAMPTZ,
    last_lat        DOUBLE PRECISION,
    last_lng        DOUBLE PRECISION,
    share_location  BOOLEAN      NOT NULL DEFAULT TRUE,
    is_minor        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT obs_event_participants_role_chk
        CHECK (role IN ('participant', 'crew_lead', 'organizer', 'mentor')),
    CONSTRAINT obs_event_participants_status_chk
        CHECK (status IN ('registered', 'checked_in', 'offline', 'left')),
    CONSTRAINT obs_event_participants_declared_job_chk
        CHECK (declared_job IS NULL OR declared_job IN ('shoot', 'identify', 'map', 'record', 'absence', 'free')),
    CONSTRAINT obs_event_participants_identity_chk
        CHECK (user_id IS NOT NULL OR guest_token IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_event_participants_user_unique
    ON observation_event_participants (session_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_event_participants_guest_unique
    ON observation_event_participants (session_id, guest_token)
    WHERE guest_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_obs_event_participants_team
    ON observation_event_participants (team_id);

-- =====================================================================
-- リアルタイムイベントログ + LISTEN/NOTIFY
-- =====================================================================
CREATE TABLE IF NOT EXISTS observation_event_live_events (
    live_event_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID         NOT NULL REFERENCES observation_event_sessions(session_id) ON DELETE CASCADE,
    type           TEXT         NOT NULL,
    scope          TEXT         NOT NULL DEFAULT 'all',
    actor_user_id  TEXT,
    actor_guest_token TEXT,
    team_id        UUID         REFERENCES observation_event_teams(team_id) ON DELETE SET NULL,
    payload        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT obs_event_live_type_chk
        CHECK (type IN (
            'observation_added', 'absence_recorded',
            'target_hit', 'rare_species', 'milestone',
            'announce', 'moderation', 'help_request',
            'checkin', 'team_update', 'mode_switch',
            'quest_offered', 'quest_accepted', 'quest_declined', 'quest_completed',
            'fanfare', 'ping'
        ))
);

CREATE INDEX IF NOT EXISTS idx_obs_event_live_session_time
    ON observation_event_live_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_event_live_team
    ON observation_event_live_events (team_id, created_at DESC)
    WHERE team_id IS NOT NULL;

CREATE OR REPLACE FUNCTION fn_obs_event_notify_live() RETURNS TRIGGER AS $$
DECLARE
    channel_name TEXT;
BEGIN
    channel_name := 'obs_evt_' || replace(NEW.session_id::text, '-', '');
    PERFORM pg_notify(
        channel_name,
        json_build_object(
            'id', NEW.live_event_id,
            'type', NEW.type,
            'scope', NEW.scope,
            'team_id', NEW.team_id,
            'created_at', NEW.created_at
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_obs_event_live_notify ON observation_event_live_events;
CREATE TRIGGER trg_obs_event_live_notify
    AFTER INSERT ON observation_event_live_events
    FOR EACH ROW EXECUTE FUNCTION fn_obs_event_notify_live();

-- =====================================================================
-- Absence 記録(知識OS Critical 最優先)
-- =====================================================================
CREATE TABLE IF NOT EXISTS observation_event_absences (
    absence_id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID         NOT NULL REFERENCES observation_event_sessions(session_id) ON DELETE CASCADE,
    user_id        TEXT,
    guest_token    TEXT,
    team_id        UUID         REFERENCES observation_event_teams(team_id) ON DELETE SET NULL,
    searched_taxon TEXT         NOT NULL,
    searched_at    TIMESTAMPTZ  NOT NULL,
    effort_seconds INTEGER      NOT NULL,
    lat            DOUBLE PRECISION NOT NULL,
    lng            DOUBLE PRECISION NOT NULL,
    confidence     TEXT         NOT NULL DEFAULT 'searched',
    notes          TEXT         NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT obs_event_absences_confidence_chk
        CHECK (confidence IN ('searched', 'confirmed_absent', 'expert_verified')),
    CONSTRAINT obs_event_absences_effort_chk
        CHECK (effort_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_obs_event_absences_session
    ON observation_event_absences (session_id, searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_event_absences_taxon
    ON observation_event_absences (lower(searched_taxon));

-- =====================================================================
-- AI Quest 履歴
-- =====================================================================
CREATE TABLE IF NOT EXISTS observation_event_quests (
    quest_id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID         NOT NULL REFERENCES observation_event_sessions(session_id) ON DELETE CASCADE,
    team_id      UUID         REFERENCES observation_event_teams(team_id) ON DELETE SET NULL,
    scope        TEXT         NOT NULL DEFAULT 'team',
    kind         TEXT         NOT NULL,
    prompt       TEXT         NOT NULL,
    payload      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    generated_by TEXT         NOT NULL DEFAULT 'gemini-flash-lite',
    status       TEXT         NOT NULL DEFAULT 'offered',
    decided_by   TEXT,
    decided_at   TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT obs_event_quests_kind_chk
        CHECK (kind IN ('spatial', 'taxa', 'effort', 'absence', 'recovery', 'surprise')),
    CONSTRAINT obs_event_quests_status_chk
        CHECK (status IN ('offered', 'accepted', 'declined', 'completed', 'expired')),
    CONSTRAINT obs_event_quests_scope_chk
        CHECK (scope IN ('event', 'team', 'participant'))
);

CREATE INDEX IF NOT EXISTS idx_obs_event_quests_active
    ON observation_event_quests (session_id, status, expires_at)
    WHERE status IN ('offered', 'accepted');

-- =====================================================================
-- メッシュカバレッジ(Effort Maximize モード用)
-- =====================================================================
CREATE TABLE IF NOT EXISTS observation_event_mesh_cells (
    mesh_cell_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID         NOT NULL REFERENCES observation_event_sessions(session_id) ON DELETE CASCADE,
    mesh_key       TEXT         NOT NULL,
    center_lat     DOUBLE PRECISION NOT NULL,
    center_lng     DOUBLE PRECISION NOT NULL,
    visit_seconds  INTEGER      NOT NULL DEFAULT 0,
    observation_count INTEGER   NOT NULL DEFAULT 0,
    absence_count  INTEGER      NOT NULL DEFAULT 0,
    last_visited_at TIMESTAMPTZ,
    visited_team_ids UUID[]     NOT NULL DEFAULT ARRAY[]::UUID[],
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT obs_event_mesh_unique UNIQUE (session_id, mesh_key)
);

CREATE INDEX IF NOT EXISTS idx_obs_event_mesh_session_visit
    ON observation_event_mesh_cells (session_id, visit_seconds DESC);

-- =====================================================================
-- 事後 recap アクセス記録 (永続アクセス監査)
-- =====================================================================
CREATE TABLE IF NOT EXISTS observation_event_recap_views (
    view_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     UUID         NOT NULL REFERENCES observation_event_sessions(session_id) ON DELETE CASCADE,
    user_id        TEXT,
    guest_token    TEXT,
    view_type      TEXT         NOT NULL,
    viewed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT obs_event_recap_view_type_chk
        CHECK (view_type IN ('public', 'personal', 'team', 'map_replay'))
);

CREATE INDEX IF NOT EXISTS idx_obs_event_recap_views_session
    ON observation_event_recap_views (session_id, viewed_at DESC);

-- =====================================================================
-- 観察記録の科学的影響履歴 (月次バッチで追記)
-- =====================================================================
CREATE TABLE IF NOT EXISTS observation_impact_records (
    impact_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id TEXT         NOT NULL,
    session_id     UUID         REFERENCES observation_event_sessions(session_id) ON DELETE SET NULL,
    impact_type    TEXT         NOT NULL,
    description    TEXT         NOT NULL,
    external_ref   TEXT,
    recorded_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT obs_impact_type_chk
        CHECK (impact_type IN ('tier_up', 'local_strategy', 'tnfd_brief', 'research_cite', 'occupancy_lift'))
);

CREATE INDEX IF NOT EXISTS idx_obs_impact_observation
    ON observation_impact_records (observation_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_impact_session
    ON observation_impact_records (session_id, recorded_at DESC);
