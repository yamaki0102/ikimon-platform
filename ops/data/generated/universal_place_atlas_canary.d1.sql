INSERT INTO places (
        place_id, canonical_name, canonical_name_normalized, locality_label, place_kind,
        verification_status, public_profile_status, official_status, public_summary,
        metadata_json, updated_at
      ) VALUES (
        'plc_e3293ec4bb9288a0', '常磐公園', '常磐公園',
        '静岡県静岡市葵区', 'park', 'verified',
        'published', 'official', '静岡市葵区常磐町にある都市公園。名称・所在地は静岡市の施設案内で確認。',
        '{"seedVersion":"v1"}', CURRENT_TIMESTAMP
      )
      ON CONFLICT(place_id) DO UPDATE SET
        canonical_name = excluded.canonical_name,
        canonical_name_normalized = excluded.canonical_name_normalized,
        locality_label = excluded.locality_label,
        place_kind = excluded.place_kind,
        verification_status = excluded.verification_status,
        public_profile_status = excluded.public_profile_status,
        official_status = excluded.official_status,
        public_summary = excluded.public_summary,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_source_references (
          source_reference_id, place_id, source_type, source_id, source_url,
          source_confidence, verification_status, precedence_rank, last_checked_at, updated_at
        ) VALUES (
          'src_tokiwa_city_20260723', 'plc_e3293ec4bb9288a0', 'municipality_official',
          'shizuoka:s0000240', 'https://www.city.shizuoka.lg.jp/shisetsu/s0000240.html', 1,
          'verified', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          place_id = excluded.place_id,
          source_url = excluded.source_url,
          source_confidence = excluded.source_confidence,
          verification_status = excluded.verification_status,
          precedence_rank = excluded.precedence_rank,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_source_references (
          source_reference_id, place_id, source_type, source_id, source_url,
          source_confidence, verification_status, precedence_rank, last_checked_at, updated_at
        ) VALUES (
          'src_tokiwa_osm_way_125727939', 'plc_e3293ec4bb9288a0', 'osm',
          'way:125727939', 'https://www.openstreetmap.org/way/125727939', 0.9,
          'source_verified', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          place_id = excluded.place_id,
          source_url = excluded.source_url,
          source_confidence = excluded.source_confidence,
          verification_status = excluded.verification_status,
          precedence_rank = excluded.precedence_rank,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          'plc_e3293ec4bb9288a0_alias_常盤公園', 'plc_e3293ec4bb9288a0', '常盤公園',
          '常盤公園', 'ja', 'orthographic_variant',
          'ikimon_curator', 1, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          'plc_e3293ec4bb9288a0_alias_tokiwapark', 'plc_e3293ec4bb9288a0', 'Tokiwa Park',
          'tokiwapark', 'en', 'multilingual',
          'osm', 0.9, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_boundaries (
        boundary_id, place_id, boundary_kind, geometry_kind, boundary_geojson,
        source_reference_id, source_type, confidence, precision_kind, boundary_version,
        validation_state, validation_details_json, is_primary,
        bbox_west, bbox_south, bbox_east, bbox_north, area_ha, updated_at
      ) VALUES (
        'bnd_plc_e3293ec4bb9288a0_v1', 'plc_e3293ec4bb9288a0', 'primary',
        'Polygon', '{"type":"Polygon","coordinates":[[[138.3797924,34.970775],[138.3794405,34.9702155],[138.3793901,34.9701354],[138.3794774,34.9700961],[138.3795331,34.970071],[138.3797271,34.9699836],[138.3807999,34.9695006],[138.3812408,34.970175],[138.3797924,34.970775]]]}',
        'src_tokiwa_osm_way_125727939', 'osm', 0.9, 'exact', 1,
        'valid', '{"resolvedAtImport":true}', 1,
        138.3793901, 34.9695006,
        138.3812408, 34.970775,
        2.3782492599015215, CURRENT_TIMESTAMP
      )
      ON CONFLICT(boundary_id) DO UPDATE SET
        boundary_geojson = excluded.boundary_geojson,
        validation_state = excluded.validation_state,
        validation_details_json = excluded.validation_details_json,
        bbox_west = excluded.bbox_west,
        bbox_south = excluded.bbox_south,
        bbox_east = excluded.bbox_east,
        bbox_north = excluded.bbox_north,
        area_ha = excluded.area_ha,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_policies (
        place_policy_id, place_id, recording_policy, photography_rule_status,
        public_location_mode, contribution_cta_mode, official_rule_url,
        verification_source_reference_id, verification_status, last_checked_at, updated_at
      ) VALUES (
        'pol_plc_e3293ec4bb9288a0_v1', 'plc_e3293ec4bb9288a0', 'check_rules',
        'unknown', 'place',
        'check_rules', NULL,
        NULL,
        'unverified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT(place_policy_id) DO UPDATE SET
        recording_policy = excluded.recording_policy,
        photography_rule_status = excluded.photography_rule_status,
        public_location_mode = excluded.public_location_mode,
        contribution_cta_mode = excluded.contribution_cta_mode,
        official_rule_url = excluded.official_rule_url,
        verification_source_reference_id = excluded.verification_source_reference_id,
        verification_status = excluded.verification_status,
        last_checked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO places (
        place_id, canonical_name, canonical_name_normalized, locality_label, place_kind,
        verification_status, public_profile_status, official_status, public_summary,
        metadata_json, updated_at
      ) VALUES (
        'plc_1dac5b52233720ee', 'JUNGLIA OKINAWA', 'jungliaokinawa',
        '沖縄県国頭郡今帰仁村', 'theme_park', 'verified',
        'published', 'official', '沖縄県北部のテーマパーク。名称と利用条件は施設公式情報を優先する。',
        '{"seedVersion":"v1"}', CURRENT_TIMESTAMP
      )
      ON CONFLICT(place_id) DO UPDATE SET
        canonical_name = excluded.canonical_name,
        canonical_name_normalized = excluded.canonical_name_normalized,
        locality_label = excluded.locality_label,
        place_kind = excluded.place_kind,
        verification_status = excluded.verification_status,
        public_profile_status = excluded.public_profile_status,
        official_status = excluded.official_status,
        public_summary = excluded.public_summary,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_source_references (
          source_reference_id, place_id, source_type, source_id, source_url,
          source_confidence, verification_status, precedence_rank, last_checked_at, updated_at
        ) VALUES (
          'src_junglia_official_20260723', 'plc_1dac5b52233720ee', 'facility_official',
          'junglia:official', 'https://www.junglia.jp/en', 1,
          'verified', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          place_id = excluded.place_id,
          source_url = excluded.source_url,
          source_confidence = excluded.source_confidence,
          verification_status = excluded.verification_status,
          precedence_rank = excluded.precedence_rank,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_source_references (
          source_reference_id, place_id, source_type, source_id, source_url,
          source_confidence, verification_status, precedence_rank, last_checked_at, updated_at
        ) VALUES (
          'src_junglia_terms_20260723', 'plc_1dac5b52233720ee', 'facility_official_rule',
          'junglia:park_terms', 'https://junglia.jp/terms/park-termsofuse', 1,
          'verified', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          place_id = excluded.place_id,
          source_url = excluded.source_url,
          source_confidence = excluded.source_confidence,
          verification_status = excluded.verification_status,
          precedence_rank = excluded.precedence_rank,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_source_references (
          source_reference_id, place_id, source_type, source_id, source_url,
          source_confidence, verification_status, precedence_rank, last_checked_at, updated_at
        ) VALUES (
          'src_junglia_osm_way_1281984233', 'plc_1dac5b52233720ee', 'osm',
          'way:1281984233', 'https://www.openstreetmap.org/way/1281984233', 0.9,
          'source_verified', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          place_id = excluded.place_id,
          source_url = excluded.source_url,
          source_confidence = excluded.source_confidence,
          verification_status = excluded.verification_status,
          precedence_rank = excluded.precedence_rank,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          'plc_1dac5b52233720ee_alias_ジャングリア沖縄', 'plc_1dac5b52233720ee', 'ジャングリア沖縄',
          'ジャングリア沖縄', 'ja', 'multilingual',
          'official', 1, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          'plc_1dac5b52233720ee_alias_ジャングリア', 'plc_1dac5b52233720ee', 'ジャングリア',
          'ジャングリア', 'ja', 'short_name',
          'ikimon_curator', 1, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          'plc_1dac5b52233720ee_alias_junglia', 'plc_1dac5b52233720ee', 'JUNGLIA',
          'junglia', 'en', 'short_name',
          'official', 1, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_boundaries (
        boundary_id, place_id, boundary_kind, geometry_kind, boundary_geojson,
        source_reference_id, source_type, confidence, precision_kind, boundary_version,
        validation_state, validation_details_json, is_primary,
        bbox_west, bbox_south, bbox_east, bbox_north, area_ha, updated_at
      ) VALUES (
        'bnd_plc_1dac5b52233720ee_v1', 'plc_1dac5b52233720ee', 'primary',
        'Polygon', '{"type":"Polygon","coordinates":[[[127.9730292,26.6421232],[127.9726556,26.6426812],[127.9719392,26.6434057],[127.9717552,26.6438306],[127.9717482,26.6445746],[127.9710012,26.6455664],[127.9708673,26.6456196],[127.9701184,26.6452838],[127.9701065,26.6450509],[127.9686529,26.6442678],[127.9676612,26.6425971],[127.9674261,26.6409197],[127.9675351,26.6402628],[127.9678523,26.6398505],[127.96836,26.6394604],[127.9696081,26.6391448],[127.9700798,26.6386826],[127.9707399,26.6383491],[127.9716177,26.6383951],[127.9718533,26.6388457],[127.9720807,26.6390945],[127.9723661,26.6392807],[127.9726446,26.6395187],[127.9729089,26.6401125],[127.9730935,26.6402552],[127.9732804,26.6403191],[127.9735088,26.6403274],[127.9739241,26.6404793],[127.9739382,26.6408831],[127.9730292,26.6421232]]]}',
        'src_junglia_osm_way_1281984233', 'osm', 0.9, 'exact', 1,
        'valid', '{"resolvedAtImport":true}', 1,
        127.9674261, 26.6383491,
        127.9739382, 26.6456196,
        52.07519799853075, CURRENT_TIMESTAMP
      )
      ON CONFLICT(boundary_id) DO UPDATE SET
        boundary_geojson = excluded.boundary_geojson,
        validation_state = excluded.validation_state,
        validation_details_json = excluded.validation_details_json,
        bbox_west = excluded.bbox_west,
        bbox_south = excluded.bbox_south,
        bbox_east = excluded.bbox_east,
        bbox_north = excluded.bbox_north,
        area_ha = excluded.area_ha,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_policies (
        place_policy_id, place_id, recording_policy, photography_rule_status,
        public_location_mode, contribution_cta_mode, official_rule_url,
        verification_source_reference_id, verification_status, last_checked_at, updated_at
      ) VALUES (
        'pol_plc_1dac5b52233720ee_v1', 'plc_1dac5b52233720ee', 'permission_required',
        'restricted', 'place',
        'suppressed', 'https://junglia.jp/terms/park-termsofuse',
        'src_junglia_official_20260723',
        'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT(place_policy_id) DO UPDATE SET
        recording_policy = excluded.recording_policy,
        photography_rule_status = excluded.photography_rule_status,
        public_location_mode = excluded.public_location_mode,
        contribution_cta_mode = excluded.contribution_cta_mode,
        official_rule_url = excluded.official_rule_url,
        verification_source_reference_id = excluded.verification_source_reference_id,
        verification_status = excluded.verification_status,
        last_checked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO places (
        place_id, canonical_name, canonical_name_normalized, locality_label, place_kind,
        verification_status, public_profile_status, official_status, public_summary,
        metadata_json, updated_at
      ) VALUES (
        'plc_16788e9b2fde5c87', 'イオンモール浜松市野', 'イオンモール浜松市野',
        '静岡県浜松市中央区', 'shopping_mall', 'verified',
        'published', 'official', '浜松市中央区天王町のショッピングモール。施設名は公式サイトを優先する。',
        '{"seedVersion":"v1"}', CURRENT_TIMESTAMP
      )
      ON CONFLICT(place_id) DO UPDATE SET
        canonical_name = excluded.canonical_name,
        canonical_name_normalized = excluded.canonical_name_normalized,
        locality_label = excluded.locality_label,
        place_kind = excluded.place_kind,
        verification_status = excluded.verification_status,
        public_profile_status = excluded.public_profile_status,
        official_status = excluded.official_status,
        public_summary = excluded.public_summary,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_source_references (
          source_reference_id, place_id, source_type, source_id, source_url,
          source_confidence, verification_status, precedence_rank, last_checked_at, updated_at
        ) VALUES (
          'src_aeon_ichino_official_20260723', 'plc_16788e9b2fde5c87', 'facility_official',
          'aeon:hamamatsuichino', 'https://www.aeon.jp/sc/hamamatsuichino/', 1,
          'verified', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          place_id = excluded.place_id,
          source_url = excluded.source_url,
          source_confidence = excluded.source_confidence,
          verification_status = excluded.verification_status,
          precedence_rank = excluded.precedence_rank,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_source_references (
          source_reference_id, place_id, source_type, source_id, source_url,
          source_confidence, verification_status, precedence_rank, last_checked_at, updated_at
        ) VALUES (
          'src_aeon_ichino_osm_way_189307274', 'plc_16788e9b2fde5c87', 'osm',
          'way:189307274', 'https://www.openstreetmap.org/way/189307274', 0.9,
          'source_verified', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          place_id = excluded.place_id,
          source_url = excluded.source_url,
          source_confidence = excluded.source_confidence,
          verification_status = excluded.verification_status,
          precedence_rank = excluded.precedence_rank,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          'plc_16788e9b2fde5c87_alias_aeonmallhamamatsuichino', 'plc_16788e9b2fde5c87', 'AEON MALL Hamamatsu Ichino',
          'aeonmallhamamatsuichino', 'en', 'multilingual',
          'official', 1, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          'plc_16788e9b2fde5c87_alias_イオン浜松市野', 'plc_16788e9b2fde5c87', 'イオン浜松市野',
          'イオン浜松市野', 'ja', 'short_name',
          'ikimon_curator', 0.9, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          'plc_16788e9b2fde5c87_alias_イオンモール', 'plc_16788e9b2fde5c87', 'イオンモール',
          'イオンモール', 'ja', 'brand_query',
          'ikimon_curator', 0.8, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_boundaries (
        boundary_id, place_id, boundary_kind, geometry_kind, boundary_geojson,
        source_reference_id, source_type, confidence, precision_kind, boundary_version,
        validation_state, validation_details_json, is_primary,
        bbox_west, bbox_south, bbox_east, bbox_north, area_ha, updated_at
      ) VALUES (
        'bnd_plc_16788e9b2fde5c87_v1', 'plc_16788e9b2fde5c87', 'primary',
        'Polygon', '{"type":"Polygon","coordinates":[[[137.7611866,34.7406412],[137.7613099,34.7398213],[137.7615138,34.7384768],[137.762533,34.7385605],[137.7624472,34.7391821],[137.7625277,34.7393364],[137.7628012,34.7395877],[137.762989,34.7396626],[137.7636542,34.7397287],[137.7644213,34.7398037],[137.7650597,34.7398478],[137.7650489,34.7399756],[137.7651294,34.73998],[137.7649953,34.741179],[137.763917,34.7410732],[137.7639278,34.7409542],[137.7638205,34.7409454],[137.7638312,34.7408396],[137.7611866,34.7406412]]]}',
        'src_aeon_ichino_osm_way_189307274', 'osm', 0.9, 'exact', 1,
        'valid', '{"resolvedAtImport":true}', 1,
        137.7611866, 34.7384768,
        137.7651294, 34.741179,
        10.77342058779561, CURRENT_TIMESTAMP
      )
      ON CONFLICT(boundary_id) DO UPDATE SET
        boundary_geojson = excluded.boundary_geojson,
        validation_state = excluded.validation_state,
        validation_details_json = excluded.validation_details_json,
        bbox_west = excluded.bbox_west,
        bbox_south = excluded.bbox_south,
        bbox_east = excluded.bbox_east,
        bbox_north = excluded.bbox_north,
        area_ha = excluded.area_ha,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_policies (
        place_policy_id, place_id, recording_policy, photography_rule_status,
        public_location_mode, contribution_cta_mode, official_rule_url,
        verification_source_reference_id, verification_status, last_checked_at, updated_at
      ) VALUES (
        'pol_plc_16788e9b2fde5c87_v1', 'plc_16788e9b2fde5c87', 'check_rules',
        'unknown', 'place',
        'check_rules', NULL,
        NULL,
        'unverified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT(place_policy_id) DO UPDATE SET
        recording_policy = excluded.recording_policy,
        photography_rule_status = excluded.photography_rule_status,
        public_location_mode = excluded.public_location_mode,
        contribution_cta_mode = excluded.contribution_cta_mode,
        official_rule_url = excluded.official_rule_url,
        verification_source_reference_id = excluded.verification_source_reference_id,
        verification_status = excluded.verification_status,
        last_checked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO places (
        place_id, canonical_name, canonical_name_normalized, locality_label, place_kind,
        verification_status, public_profile_status, official_status, public_summary,
        metadata_json, updated_at
      ) VALUES (
        'plc_a7fb32f39a754b5f', 'イオンモール浜松志都呂', 'イオンモール浜松志都呂',
        '静岡県浜松市中央区', 'shopping_mall', 'source_verified',
        'published', 'official', '浜松市中央区志都呂のショッピングモール。retail landuseを親施設として扱い、駐車場や単一店舗は別Placeにしない。',
        '{"seedVersion":"v1"}', CURRENT_TIMESTAMP
      )
      ON CONFLICT(place_id) DO UPDATE SET
        canonical_name = excluded.canonical_name,
        canonical_name_normalized = excluded.canonical_name_normalized,
        locality_label = excluded.locality_label,
        place_kind = excluded.place_kind,
        verification_status = excluded.verification_status,
        public_profile_status = excluded.public_profile_status,
        official_status = excluded.official_status,
        public_summary = excluded.public_summary,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_source_references (
          source_reference_id, place_id, source_type, source_id, source_url,
          source_confidence, verification_status, precedence_rank, last_checked_at, updated_at
        ) VALUES (
          'src_aeon_shitoro_official_20260723', 'plc_a7fb32f39a754b5f', 'facility_official',
          'aeon:hamamatsushitoro', 'https://hamamatsushitoro-aeonmall.com/', 1,
          'verified', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          place_id = excluded.place_id,
          source_url = excluded.source_url,
          source_confidence = excluded.source_confidence,
          verification_status = excluded.verification_status,
          precedence_rank = excluded.precedence_rank,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_source_references (
          source_reference_id, place_id, source_type, source_id, source_url,
          source_confidence, verification_status, precedence_rank, last_checked_at, updated_at
        ) VALUES (
          'src_aeon_shitoro_osm_way_189307792', 'plc_a7fb32f39a754b5f', 'osm',
          'way:189307792', 'https://www.openstreetmap.org/way/189307792', 0.85,
          'source_verified', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          place_id = excluded.place_id,
          source_url = excluded.source_url,
          source_confidence = excluded.source_confidence,
          verification_status = excluded.verification_status,
          precedence_rank = excluded.precedence_rank,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          'plc_a7fb32f39a754b5f_alias_aeonmallhamamatsushitoro', 'plc_a7fb32f39a754b5f', 'AEON MALL Hamamatsu Shitoro',
          'aeonmallhamamatsushitoro', 'en', 'multilingual',
          'official', 1, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          'plc_a7fb32f39a754b5f_alias_イオンモール', 'plc_a7fb32f39a754b5f', 'イオンモール',
          'イオンモール', 'ja', 'brand_query',
          'ikimon_curator', 0.8, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_boundaries (
        boundary_id, place_id, boundary_kind, geometry_kind, boundary_geojson,
        source_reference_id, source_type, confidence, precision_kind, boundary_version,
        validation_state, validation_details_json, is_primary,
        bbox_west, bbox_south, bbox_east, bbox_north, area_ha, updated_at
      ) VALUES (
        'bnd_plc_a7fb32f39a754b5f_v1', 'plc_a7fb32f39a754b5f', 'primary',
        'Polygon', '{"type":"Polygon","coordinates":[[[137.6531919,34.6978024],[137.6530976,34.6977966],[137.6521565,34.6977393],[137.6518243,34.6977191],[137.6510203,34.6976696],[137.6509745,34.6976668],[137.6508712,34.6976605],[137.6506817,34.6976489],[137.6506022,34.6976442],[137.6505378,34.6976403],[137.6501813,34.697619],[137.6500592,34.6976117],[137.6496352,34.6975862],[137.6492591,34.6975639],[137.6486022,34.6975251],[137.6484812,34.697518],[137.6484063,34.6974523],[137.6484057,34.6973383],[137.6484036,34.6973042],[137.648399,34.6972308],[137.6483886,34.6971259],[137.6483785,34.6970699],[137.6483654,34.6969972],[137.6487857,34.696609],[137.6488481,34.6965565],[137.6489144,34.6965079],[137.6489851,34.6964631],[137.6495363,34.6961489],[137.6496145,34.696102],[137.6496891,34.6960496],[137.6497584,34.6959928],[137.6498219,34.6959323],[137.6498631,34.6958904],[137.6499112,34.6958557],[137.6499671,34.6958332],[137.6500313,34.695823],[137.6500897,34.6958185],[137.6501514,34.6958042],[137.6502075,34.6957813],[137.6503201,34.6957231],[137.6504297,34.6957743],[137.6505212,34.6958192],[137.6506154,34.6958636],[137.6507108,34.6959067],[137.6508296,34.6959579],[137.6509499,34.696007],[137.6510714,34.6960539],[137.6511942,34.6960985],[137.6512522,34.6961183],[137.6513182,34.6961409],[137.6514427,34.6961809],[137.6520013,34.6963549],[137.6520393,34.6963667],[137.6523668,34.6964666],[137.6532825,34.696733],[137.6533036,34.6967391],[137.6533371,34.6967775],[137.6532457,34.6977613],[137.6531919,34.6978024]]]}',
        'src_aeon_shitoro_osm_way_189307792', 'osm', 0.9, 'exact', 1,
        'valid', '{"resolvedAtImport":true}', 1,
        137.6483654, 34.6957231,
        137.6533371, 34.6978024,
        10.458746325652998, CURRENT_TIMESTAMP
      )
      ON CONFLICT(boundary_id) DO UPDATE SET
        boundary_geojson = excluded.boundary_geojson,
        validation_state = excluded.validation_state,
        validation_details_json = excluded.validation_details_json,
        bbox_west = excluded.bbox_west,
        bbox_south = excluded.bbox_south,
        bbox_east = excluded.bbox_east,
        bbox_north = excluded.bbox_north,
        area_ha = excluded.area_ha,
        updated_at = CURRENT_TIMESTAMP;
INSERT INTO place_policies (
        place_policy_id, place_id, recording_policy, photography_rule_status,
        public_location_mode, contribution_cta_mode, official_rule_url,
        verification_source_reference_id, verification_status, last_checked_at, updated_at
      ) VALUES (
        'pol_plc_a7fb32f39a754b5f_v1', 'plc_a7fb32f39a754b5f', 'check_rules',
        'unknown', 'place',
        'check_rules', NULL,
        NULL,
        'unverified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT(place_policy_id) DO UPDATE SET
        recording_policy = excluded.recording_policy,
        photography_rule_status = excluded.photography_rule_status,
        public_location_mode = excluded.public_location_mode,
        contribution_cta_mode = excluded.contribution_cta_mode,
        official_rule_url = excluded.official_rule_url,
        verification_source_reference_id = excluded.verification_source_reference_id,
        verification_status = excluded.verification_status,
        last_checked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
