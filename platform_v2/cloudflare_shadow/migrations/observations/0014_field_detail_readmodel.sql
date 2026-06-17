CREATE TABLE IF NOT EXISTS production_import_field_detail_readmodel (
  field_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  admin_level TEXT,
  name TEXT NOT NULL,
  name_kana TEXT,
  summary TEXT,
  prefecture TEXT,
  city TEXT,
  public_cell TEXT NOT NULL,
  public_lat REAL NOT NULL,
  public_lng REAL NOT NULL,
  radius_m INTEGER,
  area_ha REAL,
  has_polygon INTEGER NOT NULL DEFAULT 0,
  has_simplified_geometry INTEGER NOT NULL DEFAULT 0,
  certification_id TEXT,
  certification_url TEXT,
  official_url TEXT,
  owner_url TEXT,
  story_url TEXT,
  verification_level TEXT,
  verification_method TEXT,
  verification_label TEXT,
  source_confidence REAL,
  valid_from TEXT,
  valid_to TEXT,
  entity_key TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_production_field_detail_public_cell
  ON production_import_field_detail_readmodel (public_cell);

CREATE INDEX IF NOT EXISTS idx_production_field_detail_source
  ON production_import_field_detail_readmodel (source, verification_level);
