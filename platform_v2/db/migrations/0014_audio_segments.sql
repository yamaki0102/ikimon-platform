-- FieldScan 音声パイプライン（Phase E）。
-- 1観察セッションで連続録音される音声を segment 単位に刻み、
-- 位置情報と時刻を紐付けて保存する。将来同定可能な構造が目的。
--
-- 音声ファイル本体は audio_segments.storage_path に保管（Cloudflare R2 / 外部ストレージ / ローカル）。
-- detection は Perch v2 / Gemini / iNat 等の外部ワーカーが別プロセスで処理し、
-- audio_detections に結果を INSERT する。

CREATE TABLE IF NOT EXISTS audio_segments (
    segment_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id         TEXT        UNIQUE,
    session_id          TEXT        NOT NULL,
    user_id             TEXT,
    visit_id            TEXT,
    place_id            TEXT,
    recorded_at         TIMESTAMPTZ NOT NULL,
    duration_sec        REAL        NOT NULL DEFAULT 0,
    lat                 DOUBLE PRECISION,
    lng                 DOUBLE PRECISION,
    azimuth             REAL,
    storage_path        TEXT        NOT NULL DEFAULT '',
    storage_provider    TEXT        NOT NULL DEFAULT 'local',
    mime_type           TEXT        NOT NULL DEFAULT 'audio/webm',
    bytes               BIGINT      NOT NULL DEFAULT 0,
    transcription_status TEXT       NOT NULL DEFAULT 'pending',
    meta                JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_segments_session
    ON audio_segments (session_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_audio_segments_user_recorded
    ON audio_segments (user_id, recorded_at DESC)
    WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audio_segments_visit
    ON audio_segments (visit_id)
    WHERE visit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audio_segments_place
    ON audio_segments (place_id)
    WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audio_segments_status
    ON audio_segments (transcription_status)
    WHERE transcription_status <> 'done';


CREATE TABLE IF NOT EXISTS audio_detections (
    detection_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id          UUID        NOT NULL REFERENCES audio_segments(segment_id) ON DELETE CASCADE,
    detected_taxon      TEXT        NOT NULL,
    scientific_name     TEXT,
    confidence          REAL        NOT NULL DEFAULT 0,
    provider            TEXT        NOT NULL DEFAULT 'perch_v2',
    offset_sec          REAL        NOT NULL DEFAULT 0,
    duration_sec        REAL        NOT NULL DEFAULT 0,
    dual_agree          BOOLEAN     NOT NULL DEFAULT FALSE,
    raw_score           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_detections_segment
    ON audio_detections (segment_id);
CREATE INDEX IF NOT EXISTS idx_audio_detections_taxon
    ON audio_detections (detected_taxon);
CREATE INDEX IF NOT EXISTS idx_audio_detections_provider_conf
    ON audio_detections (provider, confidence DESC);
