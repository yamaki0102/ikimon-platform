-- Phase 2: 音声クラスタ
--
-- audio_embeddings を未知音含めて束ねる sound_clusters / sound_cluster_members を追加。
-- 1 cluster = 「似た音グループ」。代表音 (representative_segment_id) を 1 件選び、
-- 検証 UI で人が確認した結果を confirmed_taxon_id として焼き込む。
-- 旧 sound_bundles (fingerprint 方式) には cluster_id 列を増やして並走させ、
-- Phase 4 cleanup で fingerprint 路線を停止する想定。

CREATE TABLE IF NOT EXISTS sound_clusters (
    cluster_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_method          TEXT         NOT NULL,                 -- 'kmeans_v1' | 'hdbscan_v1' | 'manual'
    cluster_run_id          UUID,
    model_name              TEXT         NOT NULL DEFAULT 'perch_v2',
    model_version           TEXT         NOT NULL DEFAULT 'v2',
    representative_segment_id UUID       REFERENCES audio_segments(segment_id) ON DELETE SET NULL,
    centroid_embedding      VECTOR(1280) NOT NULL,
    member_count            INTEGER      NOT NULL DEFAULT 0,
    dominant_taxon_guess    TEXT,
    taxon_confidence        REAL,
    frequency_band_low_hz   INTEGER,
    frequency_band_high_hz  INTEGER,
    review_status           TEXT         NOT NULL DEFAULT 'pending',  -- 'pending' | 'representative_picked' | 'confirmed' | 'rejected' | 'mixed'
    confirmed_taxon_id      TEXT,
    confirmed_label         TEXT,
    confirmed_by            TEXT,
    confirmed_at            TIMESTAMPTZ,
    propagated_count        INTEGER      NOT NULL DEFAULT 0,
    notes                   TEXT,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sound_clusters_run
    ON sound_clusters (cluster_run_id, created_at DESC)
    WHERE cluster_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sound_clusters_status
    ON sound_clusters (review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sound_clusters_taxon
    ON sound_clusters (confirmed_taxon_id)
    WHERE confirmed_taxon_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sound_clusters_model
    ON sound_clusters (model_name, model_version);

CREATE INDEX IF NOT EXISTS idx_sound_clusters_centroid_cosine
    ON sound_clusters
    USING ivfflat (centroid_embedding vector_cosine_ops)
    WITH (lists = 50);

CREATE TABLE IF NOT EXISTS sound_cluster_members (
    cluster_id              UUID NOT NULL REFERENCES sound_clusters(cluster_id) ON DELETE CASCADE,
    segment_id              UUID NOT NULL REFERENCES audio_segments(segment_id) ON DELETE CASCADE,
    distance_to_centroid    REAL NOT NULL DEFAULT 0,
    propagated_label_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'propagated' | 'rejected'
    added_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (cluster_id, segment_id)
);

CREATE INDEX IF NOT EXISTS idx_sound_cluster_members_segment
    ON sound_cluster_members (segment_id);

-- 既存 sound_bundles と並走できるよう cluster_id を追加 (Phase 4 で fingerprint 路線停止)。
-- owner-sensitive-ok: nullable UUID 列追加のみ。app role でも安全。
ALTER TABLE sound_bundles
    ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES sound_clusters(cluster_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sound_bundles_cluster
    ON sound_bundles (cluster_id)
    WHERE cluster_id IS NOT NULL;
