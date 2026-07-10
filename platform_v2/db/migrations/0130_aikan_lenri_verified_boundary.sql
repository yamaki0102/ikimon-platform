-- Applicant-provided boundary from 増進活動実施計画【愛管】 ver1.6 添付資料1.
-- destructive-ok: bounded correction for one certified field; rollback restores the previous seed polygon and bbox.
UPDATE observation_fields
SET lat = 34.8144194,
    lng = 137.7332325,
    area_ha = 1.3,
    polygon = '{"type":"Polygon","coordinates":[[[137.7336789,34.8151242],[137.7345292,34.8151167],[137.7343921,34.8146803],[137.733448,34.8146238],[137.7334,34.8136777],[137.7330114,34.8136777],[137.7329794,34.8138658],[137.7328103,34.8138752],[137.732808,34.8138338],[137.7321382,34.8138357],[137.7321382,34.8140144],[137.7323805,34.8140181],[137.7323828,34.8149888],[137.7325977,34.8149455],[137.7325977,34.814464],[137.7328011,34.8144245],[137.7328446,34.8146709],[137.7336606,34.8146539],[137.7336789,34.8151242]]]}'::jsonb,
    bbox_min_lat = 34.8136777,
    bbox_max_lat = 34.8151242,
    bbox_min_lng = 137.7321382,
    bbox_max_lng = 137.7345292,
    payload = COALESCE(payload, '{}'::jsonb) || jsonb_build_object(
      'boundary_source', '増進活動実施計画【愛管】 ver1.6 添付資料1',
      'boundary_method', 'applicant_workbook_image_digitization',
      'boundary_area_ha', 1.3
    ),
    updated_at = NOW()
WHERE entity_key = 'ikimon:aikan:renri-no-ki'
   OR (source = 'nature_symbiosis_site' AND certification_id = 'aikan-renri-ikan-hq');
