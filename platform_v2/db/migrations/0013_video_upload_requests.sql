-- Cloudflare Stream 直接アップロード発行の監査テーブル。
-- Stream 実体は Cloudflare 側、このテーブルは発行履歴・状態追跡のみ。
-- ready_to_stream=true になった動画は evidence_assets 側に別途紐付け (将来実装)。

CREATE TABLE IF NOT EXISTS video_upload_requests (
    stream_uid              TEXT        PRIMARY KEY,
    actor_id                TEXT        NOT NULL,
    observation_id          TEXT,
    upload_status           TEXT        NOT NULL DEFAULT 'issued',
    max_duration_seconds    INTEGER     NOT NULL DEFAULT 15,
    filename                TEXT        NOT NULL DEFAULT '',
    meta                    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    stream_duration_ms      INTEGER     NOT NULL DEFAULT 0,
    stream_bytes            BIGINT      NOT NULL DEFAULT 0,
    ready_to_stream         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_upload_requests_actor
    ON video_upload_requests (actor_id);
CREATE INDEX IF NOT EXISTS idx_video_upload_requests_observation
    ON video_upload_requests (observation_id)
    WHERE observation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_upload_requests_created_at
    ON video_upload_requests (created_at DESC);
