-- Add independently keyed OSM evidence without rewriting existing field/polygon rows.
CREATE TABLE IF NOT EXISTS production_import_boundary_provenance_readmodel (
  evidence_id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL,
  source TEXT NOT NULL,
  admin_level TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  license_code TEXT NOT NULL,
  attribution TEXT NOT NULL,
  verification_level TEXT NOT NULL,
  verification_method TEXT NOT NULL,
  verification_label TEXT NOT NULL,
  source_confidence REAL NOT NULL,
  geometry_json TEXT NOT NULL,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  bbox_min_lat REAL NOT NULL,
  bbox_max_lat REAL NOT NULL,
  bbox_min_lng REAL NOT NULL,
  bbox_max_lng REAL NOT NULL,
  approximate_boundary INTEGER NOT NULL DEFAULT 0,
  boundary_approximation TEXT NOT NULL,
  official_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_boundary_provenance_field
  ON production_import_boundary_provenance_readmodel (field_id, entity_key);

CREATE TABLE IF NOT EXISTS production_import_boundary_provenance_apply_receipts (
  evidence_id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO production_import_boundary_provenance_apply_receipts (evidence_id, migration_id)
SELECT 'ryuyo-osm-way-530835577-v1', '0072_ryuyo_osm_provenance_overlay'
WHERE NOT EXISTS (
  SELECT 1 FROM production_import_boundary_provenance_readmodel
   WHERE evidence_id = 'ryuyo-osm-way-530835577-v1'
);

INSERT OR IGNORE INTO production_import_boundary_provenance_readmodel (
  evidence_id, field_id, source, admin_level, entity_key, license_code, attribution,
  verification_level, verification_method, verification_label, source_confidence,
  geometry_json, center_lat, center_lng,
  bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng,
  approximate_boundary, boundary_approximation, official_url
) VALUES (
  'ryuyo-osm-way-530835577-v1',
  '372eafbd-ea9c-4b2f-ab5f-434b81b928b2',
  'osm_park', 'osm_park', 'osm:way:530835577', 'ODbL-1.0',
  '© OpenStreetMap contributors', 'registry_matched', 'official_site_and_osm_way',
  '竜洋昆虫自然観察公園の園内境界：OpenStreetMap Way 530835577（ODbL 1.0）', 0.9,
  '{"type":"Polygon","coordinates":[[[137.8393578,34.6684471],[137.8391405,34.6708363],[137.8391517,34.6712001],[137.8394498,34.6708521],[137.8405761,34.6693071],[137.8407421,34.6690781],[137.8393578,34.6684471]]]}',
  34.6698, 137.8398, 34.6684471, 34.6712001, 137.8391405, 137.8407421,
  0, 'osm_way', 'https://ryu-yo.jp/'
);

