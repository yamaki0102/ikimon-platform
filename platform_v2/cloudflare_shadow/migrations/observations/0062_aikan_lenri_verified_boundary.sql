-- Publish the applicant-provided Aikan / Lenri boundary through the native
-- Cloudflare area-polygon read model instead of the coarse public-cell square.
-- The shared shadow/staging D1 has historical migration-ledger drift where
-- 0015 is recorded but this table can be absent, so repair it idempotently.
CREATE TABLE IF NOT EXISTS production_import_area_polygon_readmodel (
  field_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  admin_level TEXT,
  name TEXT NOT NULL,
  prefecture TEXT,
  city TEXT,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  bbox_min_lat REAL NOT NULL,
  bbox_max_lat REAL NOT NULL,
  bbox_min_lng REAL NOT NULL,
  bbox_max_lng REAL NOT NULL,
  area_ha REAL,
  geometry_json TEXT NOT NULL,
  approximate_boundary INTEGER NOT NULL DEFAULT 0,
  boundary_approximation TEXT,
  source_confidence REAL,
  verification_level TEXT,
  verification_label TEXT,
  official_url TEXT,
  owner_url TEXT,
  story_url TEXT,
  certification_url TEXT,
  entity_key TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_production_area_polygon_bbox
  ON production_import_area_polygon_readmodel (bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng);

CREATE INDEX IF NOT EXISTS idx_production_area_polygon_layer_bbox
  ON production_import_area_polygon_readmodel (source, admin_level, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng);

CREATE INDEX IF NOT EXISTS idx_production_area_polygon_source_bbox
  ON production_import_area_polygon_readmodel (source, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng);

INSERT OR REPLACE INTO production_import_area_polygon_readmodel (
  field_id,
  source,
  admin_level,
  name,
  prefecture,
  city,
  center_lat,
  center_lng,
  bbox_min_lat,
  bbox_max_lat,
  bbox_min_lng,
  bbox_max_lng,
  area_ha,
  geometry_json,
  approximate_boundary,
  boundary_approximation,
  source_confidence,
  verification_level,
  verification_label,
  official_url,
  owner_url,
  story_url,
  certification_url,
  entity_key,
  updated_at
) VALUES (
  '7cb246a5-388b-4acb-b701-2bfd698fac13',
  'nature_symbiosis_site',
  'symbiosis',
  '愛管株式会社 連理の木の下で',
  '静岡県',
  '浜松市浜名区',
  34.8144194,
  137.7332325,
  34.8136777,
  34.8151242,
  137.7321382,
  137.7345292,
  1.3,
  '{"type":"Polygon","coordinates":[[[137.7336789,34.8151242],[137.7345292,34.8151167],[137.7343921,34.8146803],[137.733448,34.8146238],[137.7334,34.8136777],[137.7330114,34.8136777],[137.7329794,34.8138658],[137.7328103,34.8138752],[137.732808,34.8138338],[137.7321382,34.8138357],[137.7321382,34.8140144],[137.7323805,34.8140181],[137.7323828,34.8149888],[137.7325977,34.8149455],[137.7325977,34.814464],[137.7328011,34.8144245],[137.7328446,34.8146709],[137.7336606,34.8146539],[137.7336789,34.8151242]]]}',
  0,
  'applicant_workbook_image_digitization',
  1.0,
  'registry_matched',
  '申請者提出資料に基づく境界',
  'https://i-kan.co.jp/company/biodiversity/',
  'https://i-kan.co.jp/company/biodiversity/',
  'https://ikimon.life/guide/aikan-renri-report.php',
  'https://www.env.go.jp/nature/biodic/30by30.html',
  'ikimon:aikan:renri-no-ki',
  CURRENT_TIMESTAMP
);
