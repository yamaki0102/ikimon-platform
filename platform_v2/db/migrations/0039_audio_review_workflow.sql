-- Phase 2: 音声検証ワークフロー
--
-- sound_clusters に対する検証ステータス遷移を audio_review_queue で管理する。
-- 'ai_candidate' → 'needs_review' → 'confirmed' → 'published'  (or 'rejected')
-- observation_quality_reviews の品質ゲートと同じパターンで、確定済みのものだけ
-- Darwin Core / GBIF へ流せる素材として残す。

CREATE TABLE IF NOT EXISTS audio_review_queue (
    queue_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id            UUID         NOT NULL REFERENCES sound_clusters(cluster_id) ON DELETE CASCADE,
    priority              TEXT         NOT NULL DEFAULT 'normal',  -- 'high' | 'normal' | 'archive'
    review_status         TEXT         NOT NULL DEFAULT 'ai_candidate',
        -- 'ai_candidate' | 'needs_review' | 'confirmed' | 'published' | 'rejected'
    assigned_to           TEXT,
    reviewed_by           TEXT,
    reviewed_at           TIMESTAMPTZ,
    rejection_reason      TEXT,
    gbif_publish_eligible BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_audio_review_queue_status
    ON audio_review_queue (review_status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audio_review_queue_assigned
    ON audio_review_queue (assigned_to, review_status)
    WHERE assigned_to IS NOT NULL;
