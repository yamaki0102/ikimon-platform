-- 観察の「絞り込みヒント」を保持するテーブル。
-- legacy PHP 本番の ai_assessments[] フィールドを受け入れる構造。
-- 将来は v2 ネイティブの Gemini パイプラインからも書き込む。
--
-- 1 observation につき複数の assessment が時系列で並ぶが、表示では latest 1件を使う。

CREATE TABLE IF NOT EXISTS observation_ai_assessments (
    assessment_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id            TEXT        REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    visit_id                 TEXT        REFERENCES visits(visit_id) ON DELETE CASCADE,
    legacy_observation_id    TEXT,
    legacy_assessment_id     TEXT,
    confidence_band          TEXT,
    model_used               TEXT        NOT NULL DEFAULT '',
    prompt_version           TEXT        NOT NULL DEFAULT '',
    recommended_rank         TEXT,
    recommended_taxon_name   TEXT,
    best_specific_taxon_name TEXT,
    narrative                TEXT        NOT NULL DEFAULT '',
    simple_summary           TEXT        NOT NULL DEFAULT '',
    -- 主要ヒントのフラット化（検索・フィルタ用）
    observer_boost           TEXT        NOT NULL DEFAULT '',
    next_step_text           TEXT        NOT NULL DEFAULT '',
    stop_reason              TEXT        NOT NULL DEFAULT '',
    fun_fact                 TEXT        NOT NULL DEFAULT '',
    fun_fact_grounded        BOOLEAN     NOT NULL DEFAULT FALSE,
    -- 配列系は JSONB で保持
    diagnostic_features_seen JSONB       NOT NULL DEFAULT '[]'::jsonb,
    missing_evidence         JSONB       NOT NULL DEFAULT '[]'::jsonb,
    similar_taxa             JSONB       NOT NULL DEFAULT '[]'::jsonb,
    distinguishing_tips      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    confirm_more             JSONB       NOT NULL DEFAULT '[]'::jsonb,
    geographic_context       TEXT        NOT NULL DEFAULT '',
    seasonal_context         TEXT        NOT NULL DEFAULT '',
    -- 原本 JSON を残して将来の分析に使う
    raw_json                 JSONB       NOT NULL DEFAULT '{}'::jsonb,
    generated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_assessments_occurrence
    ON observation_ai_assessments (occurrence_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_visit
    ON observation_ai_assessments (visit_id);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_legacy_obs
    ON observation_ai_assessments (legacy_observation_id);
