-- Phase 1: 音声 embedding 基盤
--
-- Perch v2 等の生物音響モデルが出す埋め込みベクトルを audio_segments に紐付け、
-- pgvector で類似音検索・未知音クラスタリング・少量ラベル学習を可能にする。
--
-- 既存 sound_bundles (fingerprint方式) と並走させ、Phase 4 で fingerprint 路線を停止する。
-- audio_segments.fingerprint カラムは後方互換のため当面残す。

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS audio_embeddings (
    embedding_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id          UUID         NOT NULL REFERENCES audio_segments(segment_id) ON DELETE CASCADE,
    model_name          TEXT         NOT NULL,
    model_version       TEXT         NOT NULL,
    embedding           VECTOR(1280) NOT NULL,
    frame_offset_sec    REAL         NOT NULL DEFAULT 0,
    frame_duration_sec  REAL         NOT NULL DEFAULT 5.0,
    quality_score       REAL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (segment_id, model_name, model_version, frame_offset_sec)
);

CREATE INDEX IF NOT EXISTS idx_audio_embeddings_segment
    ON audio_embeddings (segment_id);

CREATE INDEX IF NOT EXISTS idx_audio_embeddings_model
    ON audio_embeddings (model_name, model_version);

-- ivfflat index for cosine similarity. lists=100 は ~100k 行までの初期値、
-- 行数が増えたら ALTER INDEX で REINDEX し lists を調整する。
CREATE INDEX IF NOT EXISTS idx_audio_embeddings_vector_cosine
    ON audio_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- audio_segments に PAM/外部録音メタの受け皿を追加 (Phase 3 で本格利用)。
-- owner-sensitive-ok: nullable INTEGER 列の追加のみ。既存行は NULL となり、
-- staging/prod の app role でも実害がないことを確認済 (rollback 不要、Phase 3 で利用開始)。
ALTER TABLE audio_segments
    ADD COLUMN IF NOT EXISTS frequency_band_hz_low  INTEGER,
    ADD COLUMN IF NOT EXISTS frequency_band_hz_high INTEGER,
    ADD COLUMN IF NOT EXISTS sample_rate_hz         INTEGER,
    ADD COLUMN IF NOT EXISTS bit_depth              INTEGER;
