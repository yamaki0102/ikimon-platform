-- Forward correction for staging, where the historical Ryuyo 0070 was already
-- recorded with source=user_defined. Only the exact OSM-backed Ryuyo rows are
-- corrected, so unrelated user-defined fields and polygons remain untouched.
UPDATE production_import_field_detail_readmodel
SET source = 'osm_park',
    updated_at = CURRENT_TIMESTAMP
WHERE field_id = '372eafbd-ea9c-4b2f-ab5f-434b81b928b2'
  AND entity_key = 'osm:way:530835577'
  AND admin_level = 'osm_park'
  AND source = 'user_defined';

UPDATE production_import_area_polygon_readmodel
SET source = 'osm_park',
    updated_at = CURRENT_TIMESTAMP
WHERE field_id = '372eafbd-ea9c-4b2f-ab5f-434b81b928b2'
  AND entity_key = 'osm:way:530835577'
  AND admin_level = 'osm_park'
  AND source = 'user_defined';
