-- Apply only when the pre-apply backup/read-back proves both Ryuyo rows were absent.
-- If either row existed before apply, restore the registered full backup instead.
DELETE FROM production_import_area_polygon_readmodel
WHERE field_id = '372eafbd-ea9c-4b2f-ab5f-434b81b928b2'
  AND source = 'osm_park'
  AND admin_level = 'osm_park'
  AND entity_key = 'osm:way:530835577';

DELETE FROM production_import_field_detail_readmodel
WHERE field_id = '372eafbd-ea9c-4b2f-ab5f-434b81b928b2'
  AND source = 'osm_park'
  AND admin_level = 'osm_park'
  AND entity_key = 'osm:way:530835577';
