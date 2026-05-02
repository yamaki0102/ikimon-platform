CREATE TABLE IF NOT EXISTS regional_knowledge_cards (
    card_id           TEXT        PRIMARY KEY,
    region_scope      TEXT        NOT NULL,
    locale            TEXT        NOT NULL DEFAULT 'ja-JP',
    source_type       TEXT        NOT NULL DEFAULT 'official_archive',
    place_hint        TEXT        NOT NULL DEFAULT '',
    place_keys        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    historical_place_names JSONB  NOT NULL DEFAULT '[]'::jsonb,
    latitude          DOUBLE PRECISION,
    longitude         DOUBLE PRECISION,
    bbox_json         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    geometry_confidence TEXT      NOT NULL DEFAULT 'unknown',
    category          TEXT        NOT NULL,
    title             TEXT        NOT NULL,
    summary           TEXT        NOT NULL,
    retrieval_text    TEXT        NOT NULL DEFAULT '',
    source_url        TEXT        NOT NULL,
    source_label      TEXT        NOT NULL,
    source_fingerprint TEXT       NOT NULL DEFAULT '',
    license           TEXT        NOT NULL DEFAULT '',
    valid_from        DATE,
    valid_to          DATE,
    temporal_scope    TEXT        NOT NULL DEFAULT 'unspecified',
    source_issued_at  DATE,
    source_accessed_at DATE       NOT NULL DEFAULT CURRENT_DATE,
    tags              JSONB       NOT NULL DEFAULT '[]'::jsonb,
    observation_hooks JSONB       NOT NULL DEFAULT '[]'::jsonb,
    sensitivity_level TEXT        NOT NULL DEFAULT 'public',
    review_status     TEXT        NOT NULL DEFAULT 'approved',
    quality_score     NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT regional_knowledge_cards_category_chk
        CHECK (category IN (
            'history',
            'cultural_asset',
            'landform',
            'water',
            'agriculture',
            'industry',
            'disaster_memory',
            'ecology',
            'policy',
            'local_life'
        )),
    CONSTRAINT regional_knowledge_cards_sensitivity_chk
        CHECK (sensitivity_level IN ('public', 'coarse', 'restricted')),
    CONSTRAINT regional_knowledge_cards_temporal_scope_chk
        CHECK (temporal_scope IN ('current', 'historical', 'mixed', 'legendary', 'unspecified')),
    CONSTRAINT regional_knowledge_cards_geometry_confidence_chk
        CHECK (geometry_confidence IN ('exact', 'approximate', 'historical_map', 'text_only', 'unknown')),
    CONSTRAINT regional_knowledge_cards_source_type_chk
        CHECK (source_type IN ('official_archive', 'municipal_open_data', 'official_plan', 'library_catalog', 'museum_catalog', 'community_history', 'field_note', 'other')),
    CONSTRAINT regional_knowledge_cards_review_status_chk
        CHECK (review_status IN ('draft', 'review', 'approved', 'retrieval', 'rejected')),
    CONSTRAINT regional_knowledge_cards_quality_score_chk
        CHECK (quality_score >= 0 AND quality_score <= 1),
    CONSTRAINT regional_knowledge_cards_source_url_chk
        CHECK (char_length(source_url) > 0),
    CONSTRAINT regional_knowledge_cards_title_chk
        CHECK (char_length(title) BETWEEN 1 AND 160),
    CONSTRAINT regional_knowledge_cards_summary_chk
        CHECK (char_length(summary) BETWEEN 1 AND 600)
);

CREATE INDEX IF NOT EXISTS idx_regional_knowledge_region_category
    ON regional_knowledge_cards (region_scope, category)
    WHERE review_status = 'approved';

CREATE INDEX IF NOT EXISTS idx_regional_knowledge_region_locale
    ON regional_knowledge_cards (region_scope, locale, review_status);

CREATE INDEX IF NOT EXISTS idx_regional_knowledge_place_hint
    ON regional_knowledge_cards (place_hint);

CREATE INDEX IF NOT EXISTS idx_regional_knowledge_tags
    ON regional_knowledge_cards USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_regional_knowledge_observation_hooks
    ON regional_knowledge_cards USING GIN (observation_hooks);

CREATE INDEX IF NOT EXISTS idx_regional_knowledge_source_fingerprint
    ON regional_knowledge_cards (source_fingerprint);

CREATE INDEX IF NOT EXISTS idx_regional_knowledge_place_keys
    ON regional_knowledge_cards USING GIN (place_keys);

CREATE INDEX IF NOT EXISTS idx_regional_knowledge_historical_place_names
    ON regional_knowledge_cards USING GIN (historical_place_names);

CREATE TABLE IF NOT EXISTS user_regional_story_exposures (
    exposure_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        TEXT        NOT NULL,
    card_id        TEXT        NOT NULL REFERENCES regional_knowledge_cards(card_id) ON DELETE CASCADE,
    place_id       TEXT,
    surface        TEXT        NOT NULL,
    shown_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    angle_key      TEXT        NOT NULL,
    observation_id TEXT,
    metadata       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT user_regional_story_surface_chk
        CHECK (surface IN ('landing', 'profile', 'observation'))
);

CREATE INDEX IF NOT EXISTS idx_user_regional_story_recent
    ON user_regional_story_exposures (user_id, place_id, shown_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_regional_story_card_angle
    ON user_regional_story_exposures (user_id, card_id, angle_key, shown_at DESC);

INSERT INTO regional_knowledge_cards (
    card_id,
    region_scope,
    place_hint,
    place_keys,
    historical_place_names,
    category,
    title,
    summary,
    source_url,
    source_label,
    license,
    valid_from,
    temporal_scope,
    source_issued_at,
    tags,
    observation_hooks,
    sensitivity_level
) VALUES
(
    'hamamatsu-adeac-overview',
    'JP-22-Hamamatsu',
    '浜松市',
    '{"prefecture":"静岡県","municipality":"浜松市"}'::jsonb,
    '[]'::jsonb,
    'history',
    '浜松市文化遺産デジタルアーカイブ',
    '浜松市立図書館・博物館・美術館などが所蔵する浜松ゆかりの歴史資料を、高精細画像や目録でたどれる入口です。',
    'https://adeac.jp/hamamatsu-city/top/',
    '浜松市文化遺産デジタルアーカイブ',
    '出典先の利用規定に従う',
    '2023-03-31',
    'mixed',
    '2023-03-31',
    '["浜松市", "文化遺産", "図書館", "博物館", "美術館", "地域資料"]'::jsonb,
    '["昔の写真と今の景色を比べる", "地名や案内板を一緒に撮る", "同じ道を少し引いて撮る"]'::jsonb,
    'public'
),
(
    'hamamatsu-adeac-local-culture-books',
    'JP-22-Hamamatsu',
    '浜松市',
    '{"prefecture":"静岡県","municipality":"浜松市"}'::jsonb,
    '["旧浜松市","旧浜北市","旧舞阪町","旧天竜市","旧細江町","旧三ヶ日町","旧引佐町"]'::jsonb,
    'local_life',
    'わがまち文化誌',
    '浜松の各地区では、住民と公民館などが地域の歴史、文化、産業、生活、伝説を調べた文化誌がまとめられています。',
    'https://adeac.jp/hamamatsu-city/text-list',
    '浜松市文化遺産デジタルアーカイブ テキスト一覧',
    '出典先の利用規定に従う',
    '2023-10-31',
    'mixed',
    '2023-10-31',
    '["わがまち文化誌", "地域史", "生活", "伝説", "公民館", "住民調査"]'::jsonb,
    '["草刈り跡を見る", "人が通る道端を見る", "花壇や畑の縁を見る", "地域の行事や管理の跡を見る"]'::jsonb,
    'public'
),
(
    'hamamatsu-adeac-castle',
    'JP-22-Hamamatsu',
    '浜松城',
    '{"prefecture":"静岡県","municipality":"浜松市"}'::jsonb,
    '["浜松城下","城下町"]'::jsonb,
    'cultural_asset',
    '浜松城と城下の移り変わり',
    '浜松城の資料群では、近世から近代の城絵図や城下絵図などを通じて、浜松の中心部の移り変わりを見返せます。',
    'https://adeac.jp/hamamatsu-city/catalog-list/list00005',
    '浜松市文化遺産デジタルアーカイブ 浜松城',
    '出典先の利用規定に従う',
    '2023-03-31',
    'historical',
    '2023-03-31',
    '["浜松城", "城下町", "絵図", "地図", "中心市街地", "近世"]'::jsonb,
    '["石垣や堀の近くを見る", "高低差を見る", "道の曲がり方を見る", "公園の端を引いて撮る"]'::jsonb,
    'public'
),
(
    'hamamatsu-adeac-landscape',
    'JP-22-Hamamatsu',
    '浜松市',
    '{"prefecture":"静岡県","municipality":"浜松市"}'::jsonb,
    '[]'::jsonb,
    'history',
    '浜松の風景を見返す',
    '写真や絵はがきなどの風景資料は、同じ場所を昔の眺めと重ねて見る手がかりになります。',
    'https://adeac.jp/hamamatsu-city/catalog-list/list00019',
    '浜松市文化遺産デジタルアーカイブ 浜松の風景',
    '出典先の利用規定に従う',
    '2023-03-31',
    'mixed',
    '2023-03-31',
    '["浜松の風景", "写真", "絵はがき", "景観", "今昔"]'::jsonb,
    '["同じ向きで撮り直す", "建物や木の位置を入れる", "遠景と足元をセットで残す"]'::jsonb,
    'public'
),
(
    'hamamatsu-adeac-transport',
    'JP-22-Hamamatsu',
    '浜松市',
    '{"prefecture":"静岡県","municipality":"浜松市"}'::jsonb,
    '["奥山線","姫街道","東海道"]'::jsonb,
    'industry',
    '交通の記憶から場所を見る',
    '鉄道、バス、街道などの交通資料は、今の道や駅前の観察を、移動と暮らしの記憶につなげます。',
    'https://adeac.jp/hamamatsu-city/top/',
    '浜松市文化遺産デジタルアーカイブ 交通・関連コンテンツ',
    '出典先の利用規定に従う',
    '2023-03-31',
    'mixed',
    '2023-03-31',
    '["交通", "奥山線", "浜松市営バス", "街道", "駅", "移動"]'::jsonb,
    '["旧道や路地を見る", "踏まれた草を見る", "駅前や道端の植生を見る", "道幅が変わる場所を見る"]'::jsonb,
    'public'
),
(
    'hamamatsu-opendata-cultural-assets',
    'JP-22-Hamamatsu',
    '浜松市',
    '{"prefecture":"静岡県","municipality":"浜松市"}'::jsonb,
    '[]'::jsonb,
    'cultural_asset',
    '文化財一覧から場所を見る',
    '静岡県オープンデータには浜松市の文化財一覧があり、身近な場所を文化財や地域資料の入口として見返せます。',
    'https://opendata.pref.shizuoka.jp/dataset/chiiki/shizuoka/hamamatu/',
    '静岡県オープンデータ 浜松市データカタログ',
    'CC BY 等、出典先のライセンスに従う',
    '2023-04-17',
    'current',
    '2023-04-17',
    '["文化財", "オープンデータ", "浜松市", "静岡県"]'::jsonb,
    '["案内板を確認する", "境内や史跡周りの植生を見る", "石垣や水路の際を見る"]'::jsonb,
    'public'
),
(
    'hamamatsu-environment-biodiversity',
    'JP-22-Hamamatsu',
    '浜松市',
    '{"prefecture":"静岡県","municipality":"浜松市"}'::jsonb,
    '[]'::jsonb,
    'ecology',
    '浜松市の自然環境との共生',
    '浜松市の環境計画では、貴重な動植物、生物多様性、自然共生サイト、市民参加の生きもの調査が自然環境施策に位置づけられています。',
    'https://www.city.hamamatsu.shizuoka.jp/documents/7353/dai3ji_kankyoukihonkeikaku_honpen.pdf',
    '第3次浜松市環境基本計画',
    '出典先の利用規定に従う',
    '2025-01-01',
    'current',
    '2025-01-01',
    '["生物多様性", "自然共生サイト", "環境計画", "市民参加", "生きもの調査"]'::jsonb,
    '["草丈を見る", "草刈り跡を見る", "日当たりを見る", "湿った土を見る", "水路を見る", "踏まれ方を見る", "花から綿毛まで比べる"]'::jsonb,
    'public'
),
(
    'hamamatsu-history-city-books',
    'JP-22-Hamamatsu',
    '浜松市',
    '{"prefecture":"静岡県","municipality":"浜松市"}'::jsonb,
    '["浜北","舞阪","天竜","細江","三ヶ日","引佐","春野","佐久間","水窪","龍山"]'::jsonb,
    'history',
    '浜松市史・旧市町村史',
    '浜松市史や旧市町村史は、中心部だけでなく浜北、舞阪、天竜、細江、三ヶ日、引佐などを含む地域の時間をたどる入口です。',
    'https://adeac.jp/hamamatsu-city/text-list',
    '浜松市文化遺産デジタルアーカイブ テキスト一覧',
    '出典先の利用規定に従う',
    '2023-10-31',
    'mixed',
    '2023-10-31',
    '["浜松市史", "旧市町村史", "浜北", "舞阪", "天竜", "細江", "三ヶ日", "引佐"]'::jsonb,
    '["旧地名を手がかりに見る", "里山や農地の縁を見る", "水辺と道の関係を見る", "集落の端を見る"]'::jsonb,
    'public'
)
ON CONFLICT (card_id) DO UPDATE SET
    region_scope = EXCLUDED.region_scope,
    place_hint = EXCLUDED.place_hint,
    category = EXCLUDED.category,
    place_keys = regional_knowledge_cards.place_keys || EXCLUDED.place_keys,
    historical_place_names = EXCLUDED.historical_place_names,
    geometry_confidence = EXCLUDED.geometry_confidence,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    source_url = EXCLUDED.source_url,
    source_label = EXCLUDED.source_label,
    license = EXCLUDED.license,
    valid_from = EXCLUDED.valid_from,
    valid_to = EXCLUDED.valid_to,
    temporal_scope = EXCLUDED.temporal_scope,
    source_issued_at = EXCLUDED.source_issued_at,
    source_accessed_at = CURRENT_DATE,
    tags = EXCLUDED.tags,
    observation_hooks = EXCLUDED.observation_hooks,
    sensitivity_level = EXCLUDED.sensitivity_level,
    updated_at = NOW();
