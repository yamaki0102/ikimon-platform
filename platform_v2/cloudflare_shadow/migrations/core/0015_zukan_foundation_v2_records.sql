-- ZUKAN Foundation v2: first-class generic Record persistence for D1.
-- Additive only. No runtime writer or public reader is enabled by this migration.

CREATE TABLE IF NOT EXISTS zukan_record_payload_scopes (
  payload_artifact_id TEXT PRIMARY KEY REFERENCES zukan_value_artifacts(artifact_id) ON DELETE RESTRICT,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(tenant_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_record_payload_scopes_tenant
  ON zukan_record_payload_scopes(tenant_id, workspace_id, payload_artifact_id);

CREATE TABLE IF NOT EXISTS zukan_records (
  recorded_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT,
  record_kind TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  occurred_at TEXT,
  actor_subject_id TEXT REFERENCES zukan_subject_identities(subject_id) ON DELETE SET NULL,
  payload_artifact_id TEXT NOT NULL REFERENCES zukan_record_payload_scopes(payload_artifact_id) ON DELETE RESTRICT,
  provenance_status TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(tenant_id)) > 0),
  CHECK (record_kind IN (
    'source_record',
    'field_observation',
    'activity_record',
    'event_record',
    'testimony',
    'case_outcome'
  )),
  CHECK (provenance_status IN ('known','partial','unknown')),
  CHECK (visibility IN ('private','workspace','restricted','public_candidate','public')),
  CHECK (occurred_at IS NULL OR occurred_at <= recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_zukan_records_scope_time
  ON zukan_records(tenant_id, workspace_id, recorded_sequence, recorded_at);
CREATE INDEX IF NOT EXISTS idx_zukan_records_kind_time
  ON zukan_records(record_kind, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_zukan_records_payload
  ON zukan_records(payload_artifact_id);

CREATE TABLE IF NOT EXISTS zukan_record_subject_links (
  record_id TEXT NOT NULL REFERENCES zukan_records(record_id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL REFERENCES zukan_subject_identities(subject_id) ON DELETE RESTRICT,
  subject_role TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(record_id, subject_id, subject_role),
  UNIQUE(record_id, subject_role, ordinal),
  CHECK (subject_role IN ('place','entity','actor','about','other')),
  CHECK (ordinal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_record_subject_links_subject
  ON zukan_record_subject_links(subject_id, subject_role, record_id);

CREATE TABLE IF NOT EXISTS zukan_record_source_links (
  record_id TEXT NOT NULL REFERENCES zukan_records(record_id) ON DELETE RESTRICT,
  source_edition_id TEXT NOT NULL REFERENCES zukan_source_editions(source_edition_id) ON DELETE RESTRICT,
  link_role TEXT NOT NULL,
  source_selector_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(record_id, source_edition_id, link_role),
  CHECK (link_role IN ('provenance','evidence','derived_from')),
  CHECK (json_valid(source_selector_json)),
  CHECK (json_type(source_selector_json) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_zukan_record_source_links_edition
  ON zukan_record_source_links(source_edition_id, link_role, record_id);

CREATE TABLE IF NOT EXISTS zukan_claim_record_links (
  claim_revision_id TEXT NOT NULL REFERENCES zukan_claim_revisions(claim_revision_id) ON DELETE RESTRICT,
  record_id TEXT NOT NULL REFERENCES zukan_records(record_id) ON DELETE RESTRICT,
  link_role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(claim_revision_id, record_id, link_role),
  CHECK (link_role IN ('asserted_from','reviewed_from','superseded_by','case_result'))
);

CREATE INDEX IF NOT EXISTS idx_zukan_claim_record_links_record
  ON zukan_claim_record_links(record_id, link_role, claim_revision_id);

CREATE TRIGGER IF NOT EXISTS trg_zukan_records_payload_scope
BEFORE INSERT ON zukan_records
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_record_payload_scopes AS scope
    JOIN zukan_value_artifacts AS artifact
      ON artifact.artifact_id = scope.payload_artifact_id
   WHERE scope.payload_artifact_id = NEW.payload_artifact_id
     AND scope.tenant_id = NEW.tenant_id
     AND scope.workspace_id IS NEW.workspace_id
     AND artifact.availability_status = 'available'
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_record_payload_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_records_actor_scope
BEFORE INSERT ON zukan_records
WHEN NEW.actor_subject_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM zukan_subject_identities AS s
   WHERE s.subject_id = NEW.actor_subject_id
     AND s.tenant_id = NEW.tenant_id
     AND s.workspace_id IS NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_record_actor_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_record_subject_links_scope
BEFORE INSERT ON zukan_record_subject_links
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_records AS r
    JOIN zukan_subject_identities AS s ON s.subject_id = NEW.subject_id
   WHERE r.record_id = NEW.record_id
     AND s.tenant_id = r.tenant_id
     AND s.workspace_id IS r.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_record_subject_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_record_source_links_scope
BEFORE INSERT ON zukan_record_source_links
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_records AS r
    JOIN zukan_source_editions AS e ON e.source_edition_id = NEW.source_edition_id
    JOIN zukan_source_works AS w ON w.source_work_id = e.source_work_id
   WHERE r.record_id = NEW.record_id
     AND w.tenant_id = r.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_record_source_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_record_links_scope
BEFORE INSERT ON zukan_claim_record_links
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_records AS r
    JOIN zukan_claim_revisions AS revision
      ON revision.claim_revision_id = NEW.claim_revision_id
    JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
   WHERE r.record_id = NEW.record_id
     AND claim.tenant_id = r.tenant_id
     AND claim.workspace_id IS r.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_record_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_record_payload_scopes_no_update
BEFORE UPDATE ON zukan_record_payload_scopes
BEGIN
  SELECT RAISE(ABORT, 'zukan_record_payload_scopes_immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_zukan_record_payload_scopes_no_delete
BEFORE DELETE ON zukan_record_payload_scopes
BEGIN
  SELECT RAISE(ABORT, 'zukan_record_payload_scopes_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_records_no_update
BEFORE UPDATE ON zukan_records
BEGIN
  SELECT RAISE(ABORT, 'zukan_records_immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_zukan_records_no_delete
BEFORE DELETE ON zukan_records
BEGIN
  SELECT RAISE(ABORT, 'zukan_records_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_record_subject_links_no_update
BEFORE UPDATE ON zukan_record_subject_links
BEGIN
  SELECT RAISE(ABORT, 'zukan_record_subject_links_immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_zukan_record_subject_links_no_delete
BEFORE DELETE ON zukan_record_subject_links
BEGIN
  SELECT RAISE(ABORT, 'zukan_record_subject_links_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_record_source_links_no_update
BEFORE UPDATE ON zukan_record_source_links
BEGIN
  SELECT RAISE(ABORT, 'zukan_record_source_links_immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_zukan_record_source_links_no_delete
BEFORE DELETE ON zukan_record_source_links
BEGIN
  SELECT RAISE(ABORT, 'zukan_record_source_links_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_record_links_no_update
BEFORE UPDATE ON zukan_claim_record_links
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_record_links_immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_record_links_no_delete
BEFORE DELETE ON zukan_claim_record_links
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_record_links_immutable');
END;
