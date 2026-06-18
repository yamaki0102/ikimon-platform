CREATE INDEX IF NOT EXISTS idx_production_field_detail_public_lat_lng
  ON production_import_field_detail_readmodel (public_lat, public_lng);

CREATE INDEX IF NOT EXISTS idx_production_field_detail_layer_public_lat_lng
  ON production_import_field_detail_readmodel (source, admin_level, public_lat, public_lng);

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
