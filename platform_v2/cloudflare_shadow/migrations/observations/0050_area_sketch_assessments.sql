CREATE TABLE IF NOT EXISTS area_sketch_assessments (
  assessment_id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'private',
  policy_version TEXT NOT NULL,
  estimate_version TEXT NOT NULL,
  sketch_polygon_json TEXT NOT NULL,
  normalized_polygon_json TEXT NOT NULL,
  land_cover_json TEXT NOT NULL DEFAULT '[]',
  owner_assertion_json TEXT NOT NULL DEFAULT '{}',
  evidence_payload_json TEXT NOT NULL DEFAULT '{}',
  result_payload_json TEXT NOT NULL DEFAULT '{}',
  claim_boundary_json TEXT NOT NULL DEFAULT '{}',
  audit_payload_json TEXT NOT NULL DEFAULT '{}',
  area_ha REAL,
  green_candidate_area_ha REAL,
  conditional_green_candidate_area_ha REAL,
  unknown_area_ha REAL,
  green_ratio REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('draft', 'archived')),
  CHECK (visibility IN ('private', 'field_managers', 'internal'))
);

CREATE INDEX IF NOT EXISTS idx_area_sketch_assessments_field_actor_updated
  ON area_sketch_assessments(field_id, actor_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_area_sketch_assessments_actor_updated
  ON area_sketch_assessments(actor_user_id, updated_at DESC);
