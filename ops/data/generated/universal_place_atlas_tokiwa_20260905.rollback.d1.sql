-- Fixed rollback for the exact public Place adoption used by
-- ZUKAN-PLACE-SEARCH-RECOVERY-1423-20260905.
-- Fails closed if the adopted Place has been modified or gained downstream use.

CREATE TABLE zukan_tokiwa_rollback_guard_20260905 (
  assertion INTEGER NOT NULL CHECK (assertion = 1)
);

INSERT INTO zukan_tokiwa_rollback_guard_20260905 (assertion)
SELECT CASE
  WHEN
    NOT EXISTS (SELECT 1 FROM places WHERE place_id = 'plc_e3293ec4bb9288a0')
    AND NOT EXISTS (SELECT 1 FROM place_aliases WHERE alias_id IN ('plc_e3293ec4bb9288a0_alias_常盤公園','plc_e3293ec4bb9288a0_alias_tokiwapark'))
    AND NOT EXISTS (SELECT 1 FROM place_source_references WHERE source_reference_id IN ('src_tokiwa_city_20260723','src_tokiwa_osm_way_125727939'))
    AND NOT EXISTS (SELECT 1 FROM place_boundaries WHERE boundary_id = 'bnd_plc_e3293ec4bb9288a0_v1')
    AND NOT EXISTS (SELECT 1 FROM place_policies WHERE place_policy_id = 'pol_plc_e3293ec4bb9288a0_v1')
  THEN 1
  WHEN
    EXISTS (SELECT 1 FROM places WHERE place_id='plc_e3293ec4bb9288a0' AND canonical_name='常磐公園' AND canonical_name_normalized='常磐公園' AND place_kind='park' AND verification_status='verified' AND public_profile_status='published' AND official_status='official' AND metadata_json='{"adoptionId":"zukan-place-tokiwa-20260905","seedVersion":"v1"}' AND valid_to IS NULL AND superseded_by_place_id IS NULL AND updated_at=created_at)
    AND 2 = (SELECT COUNT(*) FROM place_aliases WHERE place_id='plc_e3293ec4bb9288a0' AND alias_id IN ('plc_e3293ec4bb9288a0_alias_常盤公園','plc_e3293ec4bb9288a0_alias_tokiwapark') AND updated_at=created_at)
    AND 2 = (SELECT COUNT(*) FROM place_source_references WHERE place_id='plc_e3293ec4bb9288a0' AND source_reference_id IN ('src_tokiwa_city_20260723','src_tokiwa_osm_way_125727939') AND updated_at=created_at)
    AND 1 = (SELECT COUNT(*) FROM place_boundaries WHERE place_id='plc_e3293ec4bb9288a0' AND boundary_id='bnd_plc_e3293ec4bb9288a0_v1' AND valid_to IS NULL AND superseded_by_boundary_id IS NULL AND updated_at=created_at)
    AND 1 = (SELECT COUNT(*) FROM place_policies WHERE place_id='plc_e3293ec4bb9288a0' AND place_policy_id='pol_plc_e3293ec4bb9288a0_v1' AND valid_to IS NULL AND updated_at=created_at)
    AND NOT EXISTS (SELECT 1 FROM place_relationships WHERE subject_place_id='plc_e3293ec4bb9288a0' OR object_place_id='plc_e3293ec4bb9288a0')
    AND NOT EXISTS (SELECT 1 FROM record_place_memberships WHERE place_id='plc_e3293ec4bb9288a0')
    AND NOT EXISTS (SELECT 1 FROM place_facilities WHERE place_id='plc_e3293ec4bb9288a0')
    AND NOT EXISTS (SELECT 1 FROM place_content_items WHERE place_id='plc_e3293ec4bb9288a0')
    AND NOT EXISTS (SELECT 1 FROM place_correction_proposals WHERE place_id='plc_e3293ec4bb9288a0')
    AND NOT EXISTS (SELECT 1 FROM place_merge_audit WHERE surviving_place_id='plc_e3293ec4bb9288a0' OR merged_place_id='plc_e3293ec4bb9288a0')
  THEN 1 ELSE 0 END;

DELETE FROM place_policies WHERE place_policy_id='pol_plc_e3293ec4bb9288a0_v1' AND place_id='plc_e3293ec4bb9288a0';
DELETE FROM place_boundaries WHERE boundary_id='bnd_plc_e3293ec4bb9288a0_v1' AND place_id='plc_e3293ec4bb9288a0';
DELETE FROM place_aliases WHERE alias_id IN ('plc_e3293ec4bb9288a0_alias_常盤公園','plc_e3293ec4bb9288a0_alias_tokiwapark') AND place_id='plc_e3293ec4bb9288a0';
DELETE FROM place_source_references WHERE source_reference_id IN ('src_tokiwa_city_20260723','src_tokiwa_osm_way_125727939') AND place_id='plc_e3293ec4bb9288a0';
DELETE FROM places WHERE place_id='plc_e3293ec4bb9288a0' AND metadata_json='{"adoptionId":"zukan-place-tokiwa-20260905","seedVersion":"v1"}';
DROP TABLE zukan_tokiwa_rollback_guard_20260905;
