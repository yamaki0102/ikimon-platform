-- 観察詳細ページのリッチ化 (Layer 0-6) 向け追加テーブル。
--
-- observation_reactions: 観察への「いいね」「興味ある」等の反応
-- taxon_insights_cache: 学名・分類群ごとの豆知識を Gemini 生成で蓄積 (TTL あり)
-- observer_daily_stats: 観察者ごとの日次集計のマテビュー代替 (累計・今月・ストリーク計算の土台)

CREATE TABLE IF NOT EXISTS observation_reactions (
    reaction_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id    TEXT        NOT NULL REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    user_id          TEXT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reaction_type    TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (occurrence_id, user_id, reaction_type)
);
CREATE INDEX IF NOT EXISTS idx_observation_reactions_occurrence
    ON observation_reactions (occurrence_id);
CREATE INDEX IF NOT EXISTS idx_observation_reactions_user
    ON observation_reactions (user_id);

-- 有効な reaction_type: like, helpful, curious, thanks
-- (UI 文言は層外、内部コードは英語)

-- 豆知識キャッシュ: taxon(学名) ごとに Gemini 生成の insight を貯める。
-- TTL = 30日、古くなったら再生成。
CREATE TABLE IF NOT EXISTS taxon_insights_cache (
    cache_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scientific_name  TEXT        NOT NULL,
    vernacular_name  TEXT        NOT NULL DEFAULT '',
    lang             TEXT        NOT NULL DEFAULT 'ja',
    etymology        TEXT        NOT NULL DEFAULT '',
    ecology_note     TEXT        NOT NULL DEFAULT '',
    look_alike_note  TEXT        NOT NULL DEFAULT '',
    rarity_note      TEXT        NOT NULL DEFAULT '',
    model_used       TEXT        NOT NULL DEFAULT '',
    generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scientific_name, lang)
);
CREATE INDEX IF NOT EXISTS idx_taxon_insights_lookup
    ON taxon_insights_cache (scientific_name, lang);
CREATE INDEX IF NOT EXISTS idx_taxon_insights_generated
    ON taxon_insights_cache (generated_at DESC);
