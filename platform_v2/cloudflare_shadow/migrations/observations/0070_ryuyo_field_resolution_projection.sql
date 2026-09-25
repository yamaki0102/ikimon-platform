-- Bind the existing Ryuyo field and area polygon projection to the canonical
-- OSM way. This is additive source truth; it creates no new area database.
ALTER TABLE observations ADD COLUMN resolved_field_ids_json TEXT NOT NULL DEFAULT '[]';

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

INSERT INTO production_import_field_detail_readmodel (
  field_id, source, admin_level, name, name_kana, summary, prefecture, city,
  public_cell, public_lat, public_lng, radius_m, area_ha, has_polygon,
  has_simplified_geometry, certification_id, certification_url, official_url,
  owner_url, story_url, verification_level, verification_method,
  verification_label, source_confidence, valid_from, valid_to, entity_key, updated_at
) VALUES (
  '372eafbd-ea9c-4b2f-ab5f-434b81b928b2',
  'user_defined', 'osm_park', '竜洋昆虫自然観察公園', NULL,
  '昆虫と自然にふれあえる磐田市の自然観察公園です。', '静岡県', '磐田市',
  '34.67,137.84', 34.6700000, 137.8400000, 169, NULL, 1, 0,
  'osm:way:530835577', 'https://www.openstreetmap.org/way/530835577',
  'https://ryu-yo.jp/', NULL, NULL, 'registry_matched',
  'official_site_and_osm_way', '公式施設情報・OSM公園境界と一致', 0.9,
  NULL, NULL, 'osm:way:530835577', CURRENT_TIMESTAMP
)
ON CONFLICT(field_id) DO UPDATE SET
  source = excluded.source,
  admin_level = excluded.admin_level,
  name = excluded.name,
  name_kana = excluded.name_kana,
  summary = excluded.summary,
  prefecture = excluded.prefecture,
  city = excluded.city,
  public_cell = excluded.public_cell,
  public_lat = excluded.public_lat,
  public_lng = excluded.public_lng,
  radius_m = excluded.radius_m,
  area_ha = excluded.area_ha,
  has_polygon = excluded.has_polygon,
  has_simplified_geometry = excluded.has_simplified_geometry,
  certification_id = excluded.certification_id,
  certification_url = excluded.certification_url,
  official_url = excluded.official_url,
  owner_url = excluded.owner_url,
  story_url = excluded.story_url,
  verification_level = excluded.verification_level,
  verification_method = excluded.verification_method,
  verification_label = excluded.verification_label,
  source_confidence = excluded.source_confidence,
  valid_from = excluded.valid_from,
  valid_to = excluded.valid_to,
  entity_key = excluded.entity_key,
  updated_at = excluded.updated_at;

INSERT OR REPLACE INTO production_import_area_polygon_readmodel (
  field_id, source, admin_level, name, prefecture, city,
  center_lat, center_lng,
  bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng,
  area_ha, geometry_json, approximate_boundary, boundary_approximation,
  source_confidence, verification_level, verification_label,
  official_url, owner_url, story_url, certification_url, entity_key, updated_at
) VALUES (
  '372eafbd-ea9c-4b2f-ab5f-434b81b928b2',
  'user_defined', 'osm_park', '竜洋昆虫自然観察公園', '静岡県', '磐田市',
  34.6698000, 137.8398000,
  34.6684471, 34.6712001, 137.8391405, 137.8407421,
  NULL,
  '{"type":"Polygon","coordinates":[[[137.8393578,34.6684471],[137.8391405,34.6708363],[137.8391517,34.6712001],[137.8394498,34.6708521],[137.8405761,34.6693071],[137.8407421,34.6690781],[137.8393578,34.6684471]]]}',
  0, 'osm_way', 0.9, 'registry_matched',
  '公式施設情報・OSM公園境界と一致', 'https://ryu-yo.jp/',
  NULL, NULL, 'https://www.openstreetmap.org/way/530835577',
  'osm:way:530835577', CURRENT_TIMESTAMP
);
