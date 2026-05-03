-- Observation Fields admin / OSM source layer extension
--
-- Purpose:
--   Phase 2 で OSM ローカル公園 (西伊場第1公園レベル) と国土数値情報 N03 の
--   行政界 (市町村 / 都道府県 / 国) を `observation_fields` に同居させる。
--   別テーブルを切らないことで area-snapshot のクエリ層が単純なまま保てる。
--
-- 設計:
--   - `source` は既存 CHECK 制約を壊さず、OSM/行政界の表示分類は `admin_level`
--     ('osm_park' / 'admin_municipality' / 'admin_prefecture' / 'admin_country') に寄せる
--   - `parent_field_id` で「公園 → 市 → 県 → 国」の階層を持つ (任意、後追い backfill 可)
--   - `geom_simplified`: 行政界は重い → Douglas-Peucker 等で間引いた版を別 JSONB に
--     持って tile/zoom 別に出し分け。NULL の場合は polygon を直接返す。
--
-- owner-sensitive-ok: nullable hierarchy/version columns plus non-destructive
-- indexes. Existing source CHECK constraints stay intact; importers store
-- layer identity in admin_level so app DB roles do not need constraint drops.

ALTER TABLE observation_fields
    ADD COLUMN IF NOT EXISTS parent_field_id UUID
        REFERENCES observation_fields(field_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS geom_simplified JSONB,
    -- 100年スパンでの境界変遷耐性: 行政界の合併/分割、公園の指定変更などを
    -- 「同じ entity の version chain」で追跡する。risk_status_versions と
    -- 同じ手で、現行 = valid_to IS NULL、過去版は superseded_by → 後継 field_id。
    -- 既存行は valid_from = created_at::date, valid_to = NULL を自動付与。
    ADD COLUMN IF NOT EXISTS valid_from DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS superseded_by UUID
        REFERENCES observation_fields(field_id) ON DELETE SET NULL,
    -- 同じ実体 (= 浜松市・西伊場第1公園 etc) を時点を超えて束ねる安定キー。
    -- N03 importer は KSJ の市町村コードを、OSM importer は osm:way:N を入れる。
    -- 既存行は created_at::text を fallback として埋め、後で人手で正規化可能。
    ADD COLUMN IF NOT EXISTS entity_key TEXT;

ALTER TABLE observation_fields
    ALTER COLUMN valid_from SET DEFAULT current_date,
    ALTER COLUMN entity_key SET DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'obs_fields_valid_range_chk'
    ) THEN
        ALTER TABLE observation_fields
            ADD CONSTRAINT obs_fields_valid_range_chk
            CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_obs_fields_parent
    ON observation_fields (parent_field_id)
    WHERE parent_field_id IS NOT NULL;

-- 現行の行政界・公園を引くときの主索引 (area-polygons API のデフォルト)
CREATE INDEX IF NOT EXISTS idx_obs_fields_current
    ON observation_fields (source, admin_level)
    WHERE valid_to IS NULL;

-- entity_key で「合併前後」「指定変更前後」を時点を超えて辿る
CREATE INDEX IF NOT EXISTS idx_obs_fields_entity_history
    ON observation_fields (entity_key, valid_from DESC);

-- 同じ entity の現行版は1つだけ (重複を防ぐ)
CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_fields_entity_current
    ON observation_fields (entity_key)
    WHERE valid_to IS NULL;
