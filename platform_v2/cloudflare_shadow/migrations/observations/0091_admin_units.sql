CREATE TABLE IF NOT EXISTS admin_units (
  code TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  parent_code TEXT,
  name_ja TEXT NOT NULL,
  name_en TEXT,
  boundary_version TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_units_parent ON admin_units(parent_code, level);
CREATE INDEX IF NOT EXISTS idx_admin_units_level ON admin_units(level);

CREATE TABLE IF NOT EXISTS admin_unit_boundaries (
  code TEXT PRIMARY KEY,
  bbox_min_lng REAL NOT NULL,
  bbox_min_lat REAL NOT NULL,
  bbox_max_lng REAL NOT NULL,
  bbox_max_lat REAL NOT NULL,
  geometry_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_unit_boundaries_bbox
  ON admin_unit_boundaries(bbox_min_lng, bbox_max_lng, bbox_min_lat, bbox_max_lat);

CREATE TABLE IF NOT EXISTS observation_admin_assignment (
  observation_id TEXT PRIMARY KEY,
  country_code TEXT,
  pref_code TEXT,
  city_code TEXT,
  ward_code TEXT,
  town_code TEXT,
  published_level TEXT NOT NULL DEFAULT 'hidden',
  boundary_version TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_obs_admin_pref ON observation_admin_assignment(pref_code, published_level);
CREATE INDEX IF NOT EXISTS idx_obs_admin_city ON observation_admin_assignment(city_code, published_level);
CREATE INDEX IF NOT EXISTS idx_obs_admin_ward ON observation_admin_assignment(ward_code, published_level);
CREATE INDEX IF NOT EXISTS idx_obs_admin_town ON observation_admin_assignment(town_code, published_level);

CREATE TABLE IF NOT EXISTS place_admin_assignment (
  place_id TEXT PRIMARY KEY,
  country_code TEXT,
  pref_code TEXT,
  city_code TEXT,
  ward_code TEXT,
  town_code TEXT,
  boundary_version TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_place_admin_pref ON place_admin_assignment(pref_code);
CREATE INDEX IF NOT EXISTS idx_place_admin_city ON place_admin_assignment(city_code);
CREATE INDEX IF NOT EXISTS idx_place_admin_ward ON place_admin_assignment(ward_code);
CREATE INDEX IF NOT EXISTS idx_place_admin_town ON place_admin_assignment(town_code);
