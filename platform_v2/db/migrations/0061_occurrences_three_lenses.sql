-- 0061: occurrences に 3 レンズ用カラムを追加
--   - サイズ (size_class / size_value_cm / size_assessment_json)
--   - 新種可能性 (novelty_score / novelty_assessment_json)
--   - 外来種 (invasive_status / invasive_assessment_json)
--   - ai_lenses_assessed_at: 直近 reassess で 3 レンズが書き込まれた時刻

ALTER TABLE occurrences
    ADD COLUMN IF NOT EXISTS size_class TEXT NULL,
    ADD COLUMN IF NOT EXISTS size_value_cm NUMERIC(8, 2) NULL,
    ADD COLUMN IF NOT EXISTS size_assessment_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS novelty_score NUMERIC(4, 3) NULL,
    ADD COLUMN IF NOT EXISTS novelty_assessment_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS invasive_status TEXT NULL,
    ADD COLUMN IF NOT EXISTS invasive_assessment_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS ai_lenses_assessed_at TIMESTAMPTZ NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'occurrences_size_class_chk'
    ) THEN
        ALTER TABLE occurrences
            ADD CONSTRAINT occurrences_size_class_chk
            CHECK (size_class IS NULL OR size_class IN ('tiny', 'small', 'typical', 'large', 'exceptional'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'occurrences_novelty_score_chk'
    ) THEN
        ALTER TABLE occurrences
            ADD CONSTRAINT occurrences_novelty_score_chk
            CHECK (novelty_score IS NULL OR (novelty_score >= 0 AND novelty_score <= 1));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'occurrences_invasive_status_chk'
    ) THEN
        ALTER TABLE occurrences
            ADD CONSTRAINT occurrences_invasive_status_chk
            CHECK (invasive_status IS NULL OR invasive_status IN ('iaspecified', 'priority', 'industrial', 'prevention', 'native', 'unknown'));
    END IF;
END $$;

-- ランキング・集計クエリのための部分 index。
-- size_value_cm で「この種としては大物」を抽出する用途。
CREATE INDEX IF NOT EXISTS idx_occurrences_size_value
    ON occurrences (scientific_name, size_value_cm DESC NULLS LAST)
    WHERE size_value_cm IS NOT NULL;

-- 外来種だけを高速に集計するための部分 index（在来は除外）。
CREATE INDEX IF NOT EXISTS idx_occurrences_invasive_status
    ON occurrences (invasive_status)
    WHERE invasive_status IS NOT NULL AND invasive_status <> 'native';

-- 新種可能性スコアの上位だけを引く。
CREATE INDEX IF NOT EXISTS idx_occurrences_novelty_score
    ON occurrences (novelty_score DESC NULLS LAST)
    WHERE novelty_score IS NOT NULL AND novelty_score >= 0.5;
