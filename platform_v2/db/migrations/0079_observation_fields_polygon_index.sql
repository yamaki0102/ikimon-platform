-- Observation Fields polygon bbox + admin level
--
-- Purpose:
--   /ja/map のエリアサイドシートが「公園・行政エリアをクリックして生物相・変遷・努力量を見る」
--   ためには、ビューポート bbox からポリゴンを高速に絞り込むインデックスが要る。
--   PostGIS は未導入なので、polygon (GeoJSON Polygon を JSONB で保存) の外接矩形を
--   通常の DOUBLE PRECISION 列として持ち、複合 BTREE で空間プリフィルタする。
--
-- 設計:
--   - bbox_min_lat / bbox_max_lat / bbox_min_lng / bbox_max_lng (NULL 可)
--     polygon が NULL の field は bbox も NULL のまま (中心 lat/lng + radius_m で近隣検索される)。
--   - admin_level: ズームレベル別表示の WHERE 高速化用。source 列との二重持ちだが、
--     'osm_park' / 'admin_municipality' などの拡張源に備えて分離。
--     既存値は backfill スクリプトで埋める。
--   - createField / updateField / upsertCertifiedField の polygon 保存時に
--     アプリ側で bbox を計算して同時に書き込む (registry 側で実装)。
--
-- owner-sensitive-ok: adds nullable observation_fields columns plus non-destructive
-- indexes/constraint for map area lookup; rollback is dropping only these new
-- columns/indexes before app code depends on them.

ALTER TABLE observation_fields
    ADD COLUMN IF NOT EXISTS bbox_min_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS bbox_max_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS bbox_min_lng DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS bbox_max_lng DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS admin_level TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'obs_fields_admin_level_chk'
    ) THEN
        ALTER TABLE observation_fields
            ADD CONSTRAINT obs_fields_admin_level_chk
            CHECK (admin_level IS NULL OR admin_level IN (
                'park', 'protected', 'oecm', 'symbiosis', 'tsunag',
                'osm_park', 'admin_municipality', 'admin_prefecture', 'admin_country'
            ));
    END IF;
END $$;

-- bbox が埋まっている行のみインデックス
CREATE INDEX IF NOT EXISTS idx_obs_fields_polygon_bbox
    ON observation_fields (bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng)
    WHERE bbox_min_lat IS NOT NULL;

-- admin_level によるレイヤー絞り込み (将来の zoom 別取得用)
CREATE INDEX IF NOT EXISTS idx_obs_fields_admin_level
    ON observation_fields (admin_level)
    WHERE admin_level IS NOT NULL;
