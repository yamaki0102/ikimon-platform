-- ZUKAN Foundation v2 source and identity persistence.
-- Additive only. Existing runtime tables and data are unchanged.

CREATE TABLE IF NOT EXISTS zukan_subject_identities (
  subject_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT,
  subject_kind TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(subject_id)) > 0),
  CHECK (length(trim(tenant_id)) > 0),
  CHECK (length(trim(subject_kind)) > 0)
);

CREATE TABLE IF NOT EXISTS zukan_source_works (
  source_work_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  work_kind TEXT NOT NULL,
  publisher_subject_id TEXT REFERENCES zukan_subject_identities(subject_id) ON DELETE SET NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (json_valid(metadata_json)),
  CHECK (length(trim(title)) > 0)
);

CREATE TABLE IF NOT EXISTS zukan_source_editions (
  source_edition_id TEXT PRIMARY KEY,
  source_work_id TEXT NOT NULL REFERENCES zukan_source_works(source_work_id) ON DELETE RESTRICT,
  edition_label TEXT NOT NULL,
  language_tag TEXT,
  issued_at TEXT,
  valid_from TEXT,
  valid_to TEXT,
  lifecycle_status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (lifecycle_status IN ('active','superseded','retired')),
  CHECK (json_valid(metadata_json)),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_zukan_source_editions_work
  ON zukan_source_editions(source_work_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS zukan_content_objects (
  content_object_id TEXT PRIMARY KEY,
  source_edition_id TEXT REFERENCES zukan_source_editions(source_edition_id) ON DELETE SET NULL,
  parent_content_object_id TEXT REFERENCES zukan_content_objects(content_object_id) ON DELETE SET NULL,
  object_kind TEXT NOT NULL,
  derivation_kind TEXT,
  mime_type TEXT,
  byte_length INTEGER,
  content_sha256 TEXT,
  storage_locator TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (object_kind IN ('source_object','ocr','thumbnail','translation','embedding','index','value_artifact','other')),
  CHECK (availability_status IN ('available','suppressed','redacted','erased','missing')),
  CHECK (byte_length IS NULL OR byte_length >= 0),
  CHECK (content_sha256 IS NULL OR length(content_sha256) = 64)
);

CREATE INDEX IF NOT EXISTS idx_zukan_content_objects_edition
  ON zukan_content_objects(source_edition_id, object_kind);
CREATE INDEX IF NOT EXISTS idx_zukan_content_objects_parent
  ON zukan_content_objects(parent_content_object_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zukan_content_objects_digest
  ON zukan_content_objects(content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS zukan_source_fragments (
  source_fragment_id TEXT PRIMARY KEY,
  content_object_id TEXT NOT NULL REFERENCES zukan_content_objects(content_object_id) ON DELETE RESTRICT,
  fragment_kind TEXT NOT NULL,
  selector_json TEXT NOT NULL DEFAULT '{}',
  fragment_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (json_valid(selector_json)),
  CHECK (fragment_hash IS NULL OR length(fragment_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_zukan_source_fragments_object
  ON zukan_source_fragments(content_object_id, fragment_kind);

CREATE TABLE IF NOT EXISTS zukan_extraction_runs (
  extraction_run_id TEXT PRIMARY KEY,
  input_content_object_id TEXT NOT NULL REFERENCES zukan_content_objects(content_object_id) ON DELETE RESTRICT,
  extractor_kind TEXT NOT NULL,
  extractor_version TEXT NOT NULL,
  model_name TEXT,
  prompt_version TEXT,
  code_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output_hash TEXT,
  run_status TEXT NOT NULL DEFAULT 'running',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  CHECK (run_status IN ('running','succeeded','partial','failed')),
  CHECK (length(input_hash) = 64),
  CHECK (output_hash IS NULL OR length(output_hash) = 64),
  CHECK (json_valid(warnings_json))
);

CREATE INDEX IF NOT EXISTS idx_zukan_extraction_runs_input
  ON zukan_extraction_runs(input_content_object_id, started_at DESC);

CREATE TABLE IF NOT EXISTS zukan_public_identifiers (
  public_identifier_id TEXT PRIMARY KEY,
  identifier_uri TEXT NOT NULL UNIQUE,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  sensitivity_status TEXT NOT NULL DEFAULT 'normal',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retired_at TEXT,
  CHECK (target_kind IN ('subject_identity','source_work','source_edition','content_object','publication_edition','dataset')),
  CHECK (sensitivity_status IN ('normal','restricted','existence_sensitive'))
);

CREATE INDEX IF NOT EXISTS idx_zukan_public_identifiers_target
  ON zukan_public_identifiers(target_kind, target_id);

CREATE TABLE IF NOT EXISTS zukan_identity_resolution_sets (
  resolution_set_id TEXT PRIMARY KEY,
  resolution_status TEXT NOT NULL DEFAULT 'active',
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  reason_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (resolution_status IN ('active','superseded','retired')),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK (json_valid(reason_json))
);

CREATE TABLE IF NOT EXISTS zukan_identity_membership_assertions (
  membership_assertion_id TEXT PRIMARY KEY,
  resolution_set_id TEXT NOT NULL REFERENCES zukan_identity_resolution_sets(resolution_set_id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL REFERENCES zukan_subject_identities(subject_id) ON DELETE RESTRICT,
  membership_state TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  confidence REAL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (membership_state IN ('exact','candidate','rejected')),
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK (json_valid(evidence_json)),
  UNIQUE (resolution_set_id, subject_id, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_zukan_identity_memberships_subject
  ON zukan_identity_membership_assertions(subject_id, valid_from, valid_to);

CREATE TABLE IF NOT EXISTS zukan_canonical_identity_assertions (
  canonical_assertion_id TEXT PRIMARY KEY,
  public_identifier_id TEXT NOT NULL REFERENCES zukan_public_identifiers(public_identifier_id) ON DELETE RESTRICT,
  assertion_mode TEXT NOT NULL,
  resolution_set_id TEXT REFERENCES zukan_identity_resolution_sets(resolution_set_id) ON DELETE RESTRICT,
  successor_public_identifier_id TEXT REFERENCES zukan_public_identifiers(public_identifier_id) ON DELETE RESTRICT,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  reason_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (assertion_mode IN ('resolved','ambiguous','redirect')),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK (json_valid(reason_json)),
  CHECK (
    (assertion_mode IN ('resolved','ambiguous') AND resolution_set_id IS NOT NULL AND successor_public_identifier_id IS NULL)
    OR (assertion_mode = 'redirect' AND resolution_set_id IS NULL AND successor_public_identifier_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_zukan_canonical_assertions_lookup
  ON zukan_canonical_identity_assertions(public_identifier_id, valid_from DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zukan_canonical_assertions_one_current
  ON zukan_canonical_identity_assertions(public_identifier_id)
  WHERE valid_to IS NULL;

CREATE TABLE IF NOT EXISTS zukan_canonical_identity_candidates (
  canonical_assertion_id TEXT NOT NULL REFERENCES zukan_canonical_identity_assertions(canonical_assertion_id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES zukan_subject_identities(subject_id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (canonical_assertion_id, subject_id),
  CHECK (ordinal >= 0)
);
