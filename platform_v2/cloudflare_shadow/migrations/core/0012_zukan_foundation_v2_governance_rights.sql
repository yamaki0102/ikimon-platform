-- ZUKAN Foundation v2 governance, rights, disputes, corrections, suppression,
-- and coverage. Additive only; decisions and status changes are append-only.

CREATE TABLE IF NOT EXISTS zukan_content_governance_events (
  governance_event_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  requested_by_subject_id TEXT REFERENCES zukan_subject_identities(subject_id) ON DELETE SET NULL,
  legal_basis TEXT,
  reason TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  CHECK (action IN ('suppress','redact','erase')),
  CHECK (target_kind IN ('content_object','value_artifact','claim_revision','projection_snapshot','publication_edition')),
  CHECK (length(trim(reason)) > 0),
  CHECK (json_valid(metadata_json))
);

CREATE TABLE IF NOT EXISTS zukan_snapshot_status_events (
  snapshot_status_event_id TEXT PRIMARY KEY,
  projection_snapshot_id TEXT NOT NULL REFERENCES zukan_projection_snapshots(projection_snapshot_id) ON DELETE RESTRICT,
  governance_event_id TEXT REFERENCES zukan_content_governance_events(governance_event_id) ON DELETE RESTRICT,
  reproducibility_status TEXT NOT NULL,
  affected_entry_keys_json TEXT NOT NULL DEFAULT '[]',
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (reproducibility_status IN ('full','redacted','degraded')),
  CHECK (json_valid(affected_entry_keys_json))
);
CREATE INDEX IF NOT EXISTS idx_zukan_snapshot_status_events_snapshot
  ON zukan_snapshot_status_events(projection_snapshot_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS zukan_publication_availability_events (
  publication_availability_event_id TEXT PRIMARY KEY,
  publication_edition_id TEXT NOT NULL REFERENCES zukan_publication_editions(publication_edition_id) ON DELETE RESTRICT,
  governance_event_id TEXT REFERENCES zukan_content_governance_events(governance_event_id) ON DELETE RESTRICT,
  availability_status TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (availability_status IN ('available','suppressed','withdrawn'))
);

CREATE TABLE IF NOT EXISTS zukan_rights_evaluations (
  rights_evaluation_id TEXT PRIMARY KEY,
  content_object_id TEXT REFERENCES zukan_content_objects(content_object_id) ON DELETE RESTRICT,
  value_artifact_id TEXT REFERENCES zukan_value_artifacts(artifact_id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL,
  basis TEXT NOT NULL DEFAULT 'unknown',
  evidence_content_object_id TEXT REFERENCES zukan_content_objects(content_object_id) ON DELETE SET NULL,
  jurisdiction TEXT,
  valid_from TEXT,
  valid_to TEXT,
  basis_review_due TEXT,
  inherited_from_rights_evaluation_id TEXT REFERENCES zukan_rights_evaluations(rights_evaluation_id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (purpose IN ('metadata','acquisition','preservation','processing','indexing','publication','redistribution','embedding','ai_input','model_training')),
  CHECK (basis IN ('allowed','denied','unknown')),
  CHECK ((content_object_id IS NOT NULL AND value_artifact_id IS NULL) OR (content_object_id IS NULL AND value_artifact_id IS NOT NULL)),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);
CREATE INDEX IF NOT EXISTS idx_zukan_rights_evaluations_due
  ON zukan_rights_evaluations(basis, purpose, basis_review_due);
CREATE INDEX IF NOT EXISTS idx_zukan_rights_evaluations_content
  ON zukan_rights_evaluations(content_object_id, purpose, created_at DESC)
  WHERE content_object_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zukan_rights_evaluations_artifact
  ON zukan_rights_evaluations(value_artifact_id, purpose, created_at DESC)
  WHERE value_artifact_id IS NOT NULL;

