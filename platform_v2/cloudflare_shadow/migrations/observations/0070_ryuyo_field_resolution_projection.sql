-- Existing imported field normalization and D1 projection for native point resolution.
-- This is not a new area model: it preserves the existing field_id/entity_key semantics.
ALTER TABLE observations ADD COLUMN resolved_field_ids_json TEXT NOT NULL DEFAULT '[]';

UPDATE production_import_field_detail_readmodel
   SET source = 'user_defined',
       admin_level = 'osm_park',
       name = '竜洋昆虫自然観察公園',
       summary = '昆虫と自然にふれあえる磐田市の自然観察公園です。',
       prefecture = '静岡県',
       city = '磐田市',
       public_cell = '34.67,137.84',
       public_lat = 34.6700000,
       public_lng = 137.8400000,
       radius_m = 169,
       has_polygon = 1,
       has_simplified_geometry = 0,
       certification_id = 'osm:way:530835577',
       certification_url = 'https://www.openstreetmap.org/way/530835577',
       official_url = 'https://ryu-yo.jp/',
       owner_url = NULL,
       story_url = NULL,
       verification_level = 'registry_matched',
       verification_method = 'official_site_and_osm_way',
       verification_label = '公式施設情報・OSM公園境界と一致',
       source_confidence = 0.9,
       entity_key = 'osm:way:530835577',
       updated_at = CURRENT_TIMESTAMP
 WHERE field_id = '372eafbd-ea9c-4b2f-ab5f-434b81b928b2';

INSERT OR REPLACE INTO production_import_area_polygon_readmodel (
  field_id, source, admin_level, name, prefecture, city,
  center_lat, center_lng,
  bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng,
  area_ha, geometry_json, approximate_boundary, boundary_approximation,
  source_confidence, verification_level, verification_label,
  official_url, owner_url, story_url, certification_url, entity_key, updated_at
) VALUES (
  '372eafbd-ea9c-4b2f-ab5f-434b81b928b2',
  'user_defined',
  'osm_park',
  '竜洋昆虫自然観察公園',
  '静岡県',
  '磐田市',
  34.6698000,
  137.8398000,
  34.6684471,
  34.6712001,
  137.8391405,
  137.8407421,
  NULL,
  '{"type":"Polygon","coordinates":[[[137.8393578,34.6684471],[137.8391405,34.6708363],[137.8391517,34.6712001],[137.8394498,34.6708521],[137.8405761,34.6693071],[137.8407421,34.6690781],[137.8393578,34.6684471]]]}',
  0,
  'osm_way',
  0.9,
  'registry_matched',
  '公式施設情報・OSM公園境界と一致',
  'https://ryu-yo.jp/',
  NULL,
  NULL,
  'https://www.openstreetmap.org/way/530835577',
  'osm:way:530835577',
  CURRENT_TIMESTAMP
);
