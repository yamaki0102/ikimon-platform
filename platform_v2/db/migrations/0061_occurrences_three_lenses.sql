-- 0061: occurrence_three_lenses (companion table)
--
-- 観察 1 件あたりの「3 レンズ」AI 評価結果を保持する付帯テーブル。
-- 当初は occurrences への ALTER TABLE 案だったが、本番 DB の app role が
-- occurrences の owner ではないため (CI guardrail と本番 deploy エラー
-- code 42501 で確認済み)、companion table パターンに変更した。
--
-- 1:1 (occurrence_id PRIMARY KEY) でぶら下がり、reassess の確定 tx 内で
-- INSERT ... ON CONFLICT (occurrence_id) DO UPDATE で書き込まれる。
--
-- ランキング・集計クエリは observations を JOIN するか、
-- occurrence_three_lenses を主表として scientific_name を occurrences から
-- LEFT JOIN で引く運用にする。
--
-- DDL は app role (=このテーブルの owner) で実行されるので ALTER 権限問題は
-- 発生しない。

CREATE TABLE IF NOT EXISTS occurrence_three_lenses (
    occurrence_id            TEXT         PRIMARY KEY REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    -- サイズレンズ
    size_class               TEXT,
    size_value_cm            NUMERIC(8, 2),
    size_assessment_json     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    -- 新種可能性レンズ
    novelty_score            NUMERIC(4, 3),
    novelty_assessment_json  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    -- 外来種レンズ
    invasive_status          TEXT,
    invasive_assessment_json JSONB        NOT NULL DEFAULT '{}'::jsonb,
    -- 監査
    ai_lenses_assessed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT occurrence_three_lenses_size_class_chk
        CHECK (size_class IS NULL OR size_class IN ('tiny', 'small', 'typical', 'large', 'exceptional')),
    CONSTRAINT occurrence_three_lenses_novelty_score_chk
        CHECK (novelty_score IS NULL OR (novelty_score >= 0 AND novelty_score <= 1)),
    CONSTRAINT occurrence_three_lenses_invasive_status_chk
        CHECK (invasive_status IS NULL OR invasive_status IN ('iaspecified', 'priority', 'industrial', 'prevention', 'native', 'unknown'))
);

-- ランキング・集計用 partial index。
-- size_value_cm で「この種としては大物」を抽出する用途。
-- scientific_name は occurrences との JOIN で引くため、ここでは
-- occurrence_id ベースのみ。
CREATE INDEX IF NOT EXISTS idx_occurrence_three_lenses_size_value
    ON occurrence_three_lenses (size_value_cm DESC NULLS LAST)
    WHERE size_value_cm IS NOT NULL;

-- 外来種だけを高速に集計するための部分 index (在来は除外)。
CREATE INDEX IF NOT EXISTS idx_occurrence_three_lenses_invasive_status
    ON occurrence_three_lenses (invasive_status)
    WHERE invasive_status IS NOT NULL AND invasive_status <> 'native';

-- 新種可能性スコアの上位だけを引く。
CREATE INDEX IF NOT EXISTS idx_occurrence_three_lenses_novelty_score
    ON occurrence_three_lenses (novelty_score DESC NULLS LAST)
    WHERE novelty_score IS NOT NULL AND novelty_score >= 0.5;
