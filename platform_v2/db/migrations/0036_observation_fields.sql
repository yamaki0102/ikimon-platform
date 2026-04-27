-- Observation Fields: named, reusable observation areas.
--
-- Purpose:
--   観察会の「同じ場所で 2 回目以降」を一発で作れるように、エリアに名前を付けて
--   フィールド DB として保存する。さらに環境省「自然共生サイト」と国交省 TSUNAG
--   (優良緑地確保計画認定制度) の認定地もこのテーブルに取り込み、主催者が
--   検索 / 近隣抽出で簡単に再利用できるようにする。
--
-- 設計:
--   - source 列で出処を区別 (user_defined / nature_symbiosis_site / tsunag)
--   - polygon は GeoJSON Polygon を JSONB で保存。可能ならポリゴン、不可なら NULL
--     にして lat/lng + radius_m で代替する。
--   - 観察会セッションは 1 件のフィールドに紐づけられる(任意)。

CREATE TABLE IF NOT EXISTS observation_fields (
    field_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    source          TEXT         NOT NULL DEFAULT 'user_defined',
    name            TEXT         NOT NULL,
    name_kana       TEXT         NOT NULL DEFAULT '',
    summary         TEXT         NOT NULL DEFAULT '',
    prefecture      TEXT         NOT NULL DEFAULT '',
    city            TEXT         NOT NULL DEFAULT '',
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    radius_m        INTEGER      NOT NULL DEFAULT 1000,
    polygon         JSONB,
    area_ha         DOUBLE PRECISION,
    certification_id TEXT        NOT NULL DEFAULT '',
    certified_at    DATE,
    official_url    TEXT         NOT NULL DEFAULT '',
    owner_user_id   TEXT,
    payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT obs_fields_source_chk
        CHECK (source IN ('user_defined', 'nature_symbiosis_site', 'tsunag', 'protected_area', 'oecm')),
    CONSTRAINT obs_fields_radius_chk
        CHECK (radius_m >= 50 AND radius_m <= 200000)
);

CREATE INDEX IF NOT EXISTS idx_obs_fields_source
    ON observation_fields (source, prefecture, city);

CREATE INDEX IF NOT EXISTS idx_obs_fields_owner
    ON observation_fields (owner_user_id, updated_at DESC)
    WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_obs_fields_name
    ON observation_fields (lower(name));

-- 名前カナ検索(濁点正規化は呼び出し側で行う前提)
CREATE INDEX IF NOT EXISTS idx_obs_fields_name_kana
    ON observation_fields (lower(name_kana))
    WHERE name_kana <> '';

-- 近隣検索用: lat/lng の単純 box scan で 50km 以内まで使える
CREATE INDEX IF NOT EXISTS idx_obs_fields_geo
    ON observation_fields (lat, lng);

-- 公式 ID(natural_symbiosis_site/tsunag は重複防止)
CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_fields_cert_unique
    ON observation_fields (source, certification_id)
    WHERE certification_id <> '';

-- 観察会セッションを field に紐付け
-- owner-sensitive-ok: nullable UUID 列の追加のみ。既存行は NULL となり、staging/prod の app
-- role でも実害がない (rollback 不要、新規セッションから利用)。
ALTER TABLE observation_event_sessions
    ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES observation_fields(field_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS template_source_session_id UUID REFERENCES observation_event_sessions(session_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_obs_event_sessions_field
    ON observation_event_sessions (field_id, started_at DESC)
    WHERE field_id IS NOT NULL;
