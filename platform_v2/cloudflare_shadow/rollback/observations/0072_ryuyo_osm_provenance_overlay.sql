-- Safe only when the Z3 prewrite read proved this migration-specific evidence_id absent,
-- the write was performed under the registered single-writer claim, and backup is available.
DELETE FROM production_import_boundary_provenance_readmodel
WHERE evidence_id = 'ryuyo-osm-way-530835577-v1'
  AND field_id = '372eafbd-ea9c-4b2f-ab5f-434b81b928b2'
  AND entity_key = 'osm:way:530835577'
  AND license_code = 'ODbL-1.0'
  AND EXISTS (
    SELECT 1 FROM production_import_boundary_provenance_apply_receipts
     WHERE evidence_id = 'ryuyo-osm-way-530835577-v1'
       AND migration_id = '0072_ryuyo_osm_provenance_overlay'
  );

DELETE FROM production_import_boundary_provenance_apply_receipts
WHERE evidence_id = 'ryuyo-osm-way-530835577-v1'
  AND migration_id = '0072_ryuyo_osm_provenance_overlay';

