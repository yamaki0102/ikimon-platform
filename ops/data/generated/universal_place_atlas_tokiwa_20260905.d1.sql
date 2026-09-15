-- Exact public Place adoption for ZUKAN-PLACE-SEARCH-RECOVERY-1423-20260905.
-- Requires 0068_universal_place_atlas.sql. This is a candidate for exact
-- registration in the existing 0068 broker, not an automatically applied D1
-- migration. Exact import registration and runtime application are unverified.

CREATE TABLE zukan_tokiwa_import_guard_20260905 (
  assertion INTEGER NOT NULL CHECK (assertion = 1)
);

INSERT INTO zukan_tokiwa_import_guard_20260905 (assertion)
SELECT CASE WHEN
  EXISTS (
    SELECT 1 FROM places
    WHERE place_id = 'plc_e3293ec4bb9288a0'
      AND 1 IS NOT (
        canonical_name = '常磐公園'
        AND canonical_name_normalized = '常磐公園'
        AND locality_label = '静岡県静岡市葵区'
        AND place_kind = 'park'
        AND verification_status = 'verified'
        AND public_profile_status = 'published'
        AND official_status = 'official'
        AND public_summary = '静岡市葵区常磐町にある都市公園。名称・所在地は静岡市の施設案内で確認。'
        AND metadata_json = '{"adoptionId":"zukan-place-tokiwa-20260905","seedVersion":"v1"}'
        AND valid_to IS NULL
        AND superseded_by_place_id IS NULL
      )
  )
  OR EXISTS (
    SELECT 1 FROM places
    WHERE canonical_name_normalized = '常磐公園'
      AND place_id <> 'plc_e3293ec4bb9288a0'
      AND valid_to IS NULL
      AND superseded_by_place_id IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM place_source_references
    WHERE source_reference_id = 'src_tokiwa_city_20260723'
      AND 1 IS NOT (
        place_id = 'plc_e3293ec4bb9288a0'
        AND source_type = 'municipality_official'
        AND source_id = 'shizuoka:s0000240'
        AND source_url = 'https://www.city.shizuoka.lg.jp/shisetsu/s0000240.html'
        AND source_payload_json = '{"use":"fact_reference","retrievedAt":"2026-09-05"}'
        AND source_confidence = 1.0
        AND verification_status = 'verified'
        AND precedence_rank = 10
        AND valid_to IS NULL
        AND superseded_by_source_reference_id IS NULL
      )
  )
  OR EXISTS (
    SELECT 1 FROM place_source_references
    WHERE source_type = 'municipality_official'
      AND source_id = 'shizuoka:s0000240'
      AND source_reference_id <> 'src_tokiwa_city_20260723'
  )
  OR EXISTS (
    SELECT 1 FROM place_source_references
    WHERE source_reference_id = 'src_tokiwa_osm_way_125727939'
      AND 1 IS NOT (
        place_id = 'plc_e3293ec4bb9288a0'
        AND source_type = 'osm'
        AND source_id = 'way:125727939'
        AND source_url = 'https://www.openstreetmap.org/way/125727939'
        AND source_payload_json = '{"attribution":"© OpenStreetMap contributors","license":"ODbL-1.0","osmVersion":5,"retrievedAt":"2026-09-05"}'
        AND source_confidence = 0.9
        AND verification_status = 'source_verified'
        AND precedence_rank = 40
        AND valid_to IS NULL
        AND superseded_by_source_reference_id IS NULL
      )
  )
  OR EXISTS (
    SELECT 1 FROM place_source_references
    WHERE source_type = 'osm'
      AND source_id = 'way:125727939'
      AND source_reference_id <> 'src_tokiwa_osm_way_125727939'
  )
  OR EXISTS (
    SELECT 1 FROM place_aliases
    WHERE alias_id IN (
      'plc_e3293ec4bb9288a0_alias_常盤公園',
      'plc_e3293ec4bb9288a0_alias_tokiwapark'
    )
      AND 1 IS NOT (
        place_id = 'plc_e3293ec4bb9288a0'
        AND (
          (alias_id = 'plc_e3293ec4bb9288a0_alias_常盤公園'
            AND alias = '常盤公園' AND alias_normalized = '常盤公園'
            AND language_code = 'ja' AND alias_kind = 'orthographic_variant'
            AND source_type = 'ikimon_curator' AND source_reference_id IS NULL
            AND confidence = 1.0 AND valid_to IS NULL)
          OR
          (alias_id = 'plc_e3293ec4bb9288a0_alias_tokiwapark'
            AND alias = 'Tokiwa Park' AND alias_normalized = 'tokiwapark'
            AND language_code = 'en' AND alias_kind = 'multilingual'
            AND source_type = 'osm' AND source_reference_id = 'src_tokiwa_osm_way_125727939'
            AND confidence = 0.9 AND valid_to IS NULL)
        )
      )
  )
  OR EXISTS (
    SELECT 1 FROM place_aliases
    WHERE place_id = 'plc_e3293ec4bb9288a0'
      AND (
        (alias_normalized = '常盤公園' AND alias_kind = 'orthographic_variant'
          AND alias_id <> 'plc_e3293ec4bb9288a0_alias_常盤公園')
        OR
        (alias_normalized = 'tokiwapark' AND alias_kind = 'multilingual'
          AND alias_id <> 'plc_e3293ec4bb9288a0_alias_tokiwapark')
      )
  )
  OR EXISTS (
    SELECT 1 FROM place_boundaries
    WHERE boundary_id = 'bnd_plc_e3293ec4bb9288a0_v1'
      AND 1 IS NOT (
        place_id = 'plc_e3293ec4bb9288a0'
        AND geometry_kind = 'Polygon'
        AND boundary_geojson = '{"type":"Polygon","coordinates":[[[138.3797924,34.970775],[138.3794405,34.9702155],[138.3793901,34.9701354],[138.3794774,34.9700961],[138.3795331,34.970071],[138.3797271,34.9699836],[138.3807999,34.9695006],[138.3812408,34.970175],[138.3797924,34.970775]]]}'
        AND source_reference_id = 'src_tokiwa_osm_way_125727939'
        AND source_type = 'osm'
        AND confidence = 0.9
        AND precision_kind = 'exact'
        AND boundary_version = 1
        AND validation_state = 'valid'
        AND is_primary = 1
        AND bbox_west = 138.3793901 AND bbox_south = 34.9695006
        AND bbox_east = 138.3812408 AND bbox_north = 34.970775
        AND valid_to IS NULL AND superseded_by_boundary_id IS NULL
      )
  )
  OR EXISTS (
    SELECT 1 FROM place_boundaries
    WHERE place_id = 'plc_e3293ec4bb9288a0'
      AND is_primary = 1
      AND valid_to IS NULL
      AND superseded_by_boundary_id IS NULL
      AND boundary_id <> 'bnd_plc_e3293ec4bb9288a0_v1'
  )
  OR EXISTS (
    SELECT 1 FROM place_policies
    WHERE place_policy_id = 'pol_plc_e3293ec4bb9288a0_v1'
      AND 1 IS NOT (
        place_id = 'plc_e3293ec4bb9288a0'
        AND place_visibility = 'public'
        AND recording_policy = 'check_rules'
        AND photography_rule_status = 'unknown'
        AND public_location_mode = 'place'
        AND contribution_cta_mode = 'check_rules'
        AND official_rule_url IS NULL
        AND verification_source_reference_id IS NULL
        AND verification_status = 'unverified'
        AND valid_to IS NULL
      )
  )
  OR EXISTS (
    SELECT 1 FROM place_policies
    WHERE place_id = 'plc_e3293ec4bb9288a0'
      AND valid_to IS NULL
      AND place_policy_id <> 'pol_plc_e3293ec4bb9288a0_v1'
  )
THEN 0 ELSE 1 END;

INSERT INTO places (
  place_id, canonical_name, canonical_name_normalized, locality_label, place_kind,
  verification_status, public_profile_status, official_status, public_summary,
  metadata_json, valid_from
) VALUES (
  'plc_e3293ec4bb9288a0', '常磐公園', '常磐公園', '静岡県静岡市葵区', 'park',
  'verified', 'published', 'official',
  '静岡市葵区常磐町にある都市公園。名称・所在地は静岡市の施設案内で確認。',
  '{"adoptionId":"zukan-place-tokiwa-20260905","seedVersion":"v1"}',
  '2026-09-05T00:00:00Z'
) ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_source_references (
  source_reference_id, place_id, source_type, source_id, source_url,
  source_payload_json, source_confidence, verification_status, precedence_rank,
  observed_at, last_checked_at, valid_from
) VALUES
  (
    'src_tokiwa_city_20260723', 'plc_e3293ec4bb9288a0', 'municipality_official',
    'shizuoka:s0000240', 'https://www.city.shizuoka.lg.jp/shisetsu/s0000240.html',
    '{"use":"fact_reference","retrievedAt":"2026-09-05"}', 1.0, 'verified', 10,
    '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z'
  ),
  (
    'src_tokiwa_osm_way_125727939', 'plc_e3293ec4bb9288a0', 'osm',
    'way:125727939', 'https://www.openstreetmap.org/way/125727939',
    '{"attribution":"© OpenStreetMap contributors","license":"ODbL-1.0","osmVersion":5,"retrievedAt":"2026-09-05"}',
    0.9, 'source_verified', 40,
    '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z'
  )
ON CONFLICT(source_reference_id) DO NOTHING;

INSERT INTO place_aliases (
  alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
  source_type, source_reference_id, confidence, valid_from
) VALUES
  (
    'plc_e3293ec4bb9288a0_alias_常盤公園', 'plc_e3293ec4bb9288a0',
    '常盤公園', '常盤公園', 'ja', 'orthographic_variant',
    'ikimon_curator', NULL, 1.0, '2026-09-05T00:00:00Z'
  ),
  (
    'plc_e3293ec4bb9288a0_alias_tokiwapark', 'plc_e3293ec4bb9288a0',
    'Tokiwa Park', 'tokiwapark', 'en', 'multilingual',
    'osm', 'src_tokiwa_osm_way_125727939', 0.9, '2026-09-05T00:00:00Z'
  )
ON CONFLICT(alias_id) DO NOTHING;

INSERT INTO place_boundaries (
  boundary_id, place_id, boundary_kind, geometry_kind, boundary_geojson,
  source_reference_id, source_type, confidence, precision_kind, valid_from,
  boundary_version, validation_state, validation_details_json, is_primary,
  bbox_west, bbox_south, bbox_east, bbox_north, area_ha
) VALUES (
  'bnd_plc_e3293ec4bb9288a0_v1', 'plc_e3293ec4bb9288a0', 'primary', 'Polygon',
  '{"type":"Polygon","coordinates":[[[138.3797924,34.970775],[138.3794405,34.9702155],[138.3793901,34.9701354],[138.3794774,34.9700961],[138.3795331,34.970071],[138.3797271,34.9699836],[138.3807999,34.9695006],[138.3812408,34.970175],[138.3797924,34.970775]]]}',
  'src_tokiwa_osm_way_125727939', 'osm', 0.9, 'exact', '2026-09-05T00:00:00Z',
  1, 'valid', '{"adoptionId":"zukan-place-tokiwa-20260905","osmVersion":5}', 1,
  138.3793901, 34.9695006, 138.3812408, 34.970775, 2.3782492599015215
) ON CONFLICT(boundary_id) DO NOTHING;

INSERT INTO place_policies (
  place_policy_id, place_id, place_visibility, recording_policy,
  photography_rule_status, public_location_mode, contribution_cta_mode,
  official_rule_url, verification_source_reference_id, verification_status,
  last_checked_at, valid_from
) VALUES (
  'pol_plc_e3293ec4bb9288a0_v1', 'plc_e3293ec4bb9288a0', 'public', 'check_rules',
  'unknown', 'place', 'check_rules', NULL, NULL, 'unverified',
  '2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z'
) ON CONFLICT(place_policy_id) DO NOTHING;

DROP TABLE zukan_tokiwa_import_guard_20260905;
