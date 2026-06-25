ALTER TABLE municipal_walk_map_creators ADD COLUMN registration_kind TEXT NOT NULL DEFAULT 'municipality';
ALTER TABLE municipal_walk_map_creators ADD COLUMN commercial_intent TEXT NOT NULL DEFAULT 'none';
ALTER TABLE municipal_walk_map_creators ADD COLUMN verified_by_user_id TEXT;
ALTER TABLE municipal_walk_map_creators ADD COLUMN verified_at TEXT;
ALTER TABLE municipal_walk_map_creators ADD COLUMN notes TEXT NOT NULL DEFAULT '';

ALTER TABLE municipal_walk_maps ADD COLUMN creator_name TEXT NOT NULL DEFAULT '';
ALTER TABLE municipal_walk_maps ADD COLUMN creator_profile_json TEXT NOT NULL DEFAULT '{"creatorId":null,"registrationKind":"unknown","verificationStatus":"pending","commercialIntent":"none"}';
ALTER TABLE municipal_walk_maps ADD COLUMN area_scope_json TEXT NOT NULL DEFAULT '{"municipalityCodes":[],"placeIds":[],"polygonIds":[]}';
ALTER TABLE municipal_walk_maps ADD COLUMN record_modes_json TEXT NOT NULL DEFAULT '["photo","memo","unknown_species"]';
ALTER TABLE municipal_walk_maps ADD COLUMN route_flexibility_json TEXT NOT NULL DEFAULT '{"routeStyle":"loose_stops","mobilityModes":["walk"],"offRoutePolicy":"off_route_allowed","returnCues":[]}';
ALTER TABLE municipal_walk_maps ADD COLUMN public_precision_policy TEXT NOT NULL DEFAULT 'mesh_or_coarser';
ALTER TABLE municipal_walk_maps ADD COLUMN claim_boundary_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE municipal_walk_maps ADD COLUMN publication_review_json TEXT NOT NULL DEFAULT '{"publicAccessAttested":false,"sourceRightsAttested":false,"emergencyHidden":false}';
ALTER TABLE municipal_walk_maps ADD COLUMN created_by_user_id TEXT;
ALTER TABLE municipal_walk_maps ADD COLUMN updated_by_user_id TEXT;

ALTER TABLE municipal_walk_map_stops ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE municipal_walk_map_stops ADD COLUMN area_kind TEXT NOT NULL DEFAULT 'other';
ALTER TABLE municipal_walk_map_stops ADD COLUMN linked_field_id TEXT;
ALTER TABLE municipal_walk_map_stops ADD COLUMN access TEXT NOT NULL DEFAULT 'public_access';
ALTER TABLE municipal_walk_map_stops ADD COLUMN sensitive_context TEXT NOT NULL DEFAULT 'none';
ALTER TABLE municipal_walk_map_stops ADD COLUMN estimated_minutes INTEGER;
ALTER TABLE municipal_walk_map_stops ADD COLUMN notice_cues_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE municipal_walk_map_stops ADD COLUMN record_cues_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE municipal_walk_map_stops ADD COLUMN safety_notes_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE municipal_walk_map_stops ADD COLUMN internal_memo TEXT;

ALTER TABLE municipal_walk_map_audit ADD COLUMN actor_user_id TEXT;
ALTER TABLE municipal_walk_map_audit ADD COLUMN before_payload_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE municipal_walk_map_audit ADD COLUMN after_payload_json TEXT NOT NULL DEFAULT '{}';

UPDATE municipal_walk_map_creators
SET
  registration_kind = CASE
    WHEN creator_type = 'municipality' THEN 'municipality'
    WHEN creator_type = 'company' THEN 'registered_company'
    ELSE 'registered_group'
  END,
  commercial_intent = CASE
    WHEN commercial_policy = 'restricted' THEN 'limited'
    ELSE 'none'
  END,
  verified_at = CASE
    WHEN verification_status IN ('verified', 'official_source_referenced') THEN COALESCE(verified_at, updated_at)
    ELSE verified_at
  END;

UPDATE municipal_walk_maps
SET
  creator_name = CASE WHEN creator_name = '' THEN municipality ELSE creator_name END,
  creator_profile_json = CASE
    WHEN creator_profile_json LIKE '%"creatorId":null%' THEN '{"creatorId":"' || creator_id || '","registrationKind":"municipality","verificationStatus":"verified","commercialIntent":"none"}'
    ELSE creator_profile_json
  END,
  area_scope_json = CASE
    WHEN area_scope_json = '{"municipalityCodes":[],"placeIds":[],"polygonIds":[]}' THEN '{"municipalityCodes":["' || municipality_code || '"],"placeIds":[],"polygonIds":[]}'
    ELSE area_scope_json
  END,
  route_flexibility_json = CASE
    WHEN route_flexibility_json LIKE '%"mobilityModes":["walk"]%' THEN '{"routeStyle":"' || route_style || '","mobilityModes":' || mobility_modes_json || ',"offRoutePolicy":"off_route_allowed","returnCues":[]}'
    ELSE route_flexibility_json
  END,
  publication_review_json = CASE
    WHEN publish_mode IN ('public_preview', 'public') THEN '{"publicAccessAttested":true,"sourceRightsAttested":true,"emergencyHidden":false}'
    ELSE publication_review_json
  END;

UPDATE municipal_walk_map_stops
SET
  position = display_order,
  safety_notes_json = '[]';

CREATE INDEX IF NOT EXISTS idx_municipal_walk_map_creators_admin
  ON municipal_walk_map_creators (registration_kind, verification_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_maps_admin_review
  ON municipal_walk_maps (publish_mode, updated_at);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_maps_creator
  ON municipal_walk_maps (creator_id, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_municipal_walk_map_stops_map_stop
  ON municipal_walk_map_stops (walk_map_id, stop_id);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_map_stops_position
  ON municipal_walk_map_stops (walk_map_id, position);

CREATE INDEX IF NOT EXISTS idx_municipal_walk_map_audit_recent
  ON municipal_walk_map_audit (walk_map_id, created_at);
