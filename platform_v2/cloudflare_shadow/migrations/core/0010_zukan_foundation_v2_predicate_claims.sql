-- ZUKAN Foundation v2 claims, authority, resolution, and immutable projections.
-- Additive only. Claims and snapshots are append-only; value artifacts remain erasable.

CREATE TABLE IF NOT EXISTS zukan_predicate_definitions (
  predicate_uri TEXT NOT NULL,
  predicate_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  value_type TEXT NOT NULL,
  value_schema_json TEXT NOT NULL DEFAULT '{}',
  cardinality TEXT NOT NULL,
  polarity_mode TEXT NOT NULL,
  temporal_profile TEXT NOT NULL,
  authority_profile_json TEXT NOT NULL DEFAULT '{}',
  external_mappings_json TEXT NOT NULL DEFAULT '[]',
  superseded_by_uri TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (predicate_uri, predicate_version),
  CHECK (predicate_version >= 1),
  CHECK (status IN ('proposed','active','deprecated','retired')),
  CHECK (value_type IN ('string','number','boolean','date','datetime','geometry','reference','json')),
  CHECK (cardinality IN ('one','many')),
  CHECK (polarity_mode IN ('positive_only','positive_or_negative')),
  CHECK (temporal_profile IN ('atemporal','valid_time','observation_time','bitemporal')),
  CHECK (json_valid(value_schema_json)),
  CHECK (json_valid(authority_profile_json)),
  CHECK (json_valid(external_mappings_json))
);

CREATE TABLE IF NOT EXISTS zukan_value_artifacts (
  artifact_id TEXT PRIMARY KEY,
  content_object_id TEXT REFERENCES zukan_content_objects(content_object_id) ON DELETE SET NULL,
  value_json TEXT,
  value_text TEXT,
  content_sha256 TEXT,
  storage_locator TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  redacted_at TEXT,
  CHECK (availability_status IN ('available','suppressed','redacted','erased','missing')),
  CHECK (value_json IS NULL OR json_valid(value_json)),
  CHECK (content_sha256 IS NULL OR length(content_sha256) = 64)
);

CREATE TABLE IF NOT EXISTS zukan_claims (
  claim_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES zukan_subject_identities(subject_id) ON DELETE RESTRICT,
  predicate_uri TEXT NOT NULL,
  predicate_version INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (predicate_uri, predicate_version)
    REFERENCES zukan_predicate_definitions(predicate_uri, predicate_version)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS zukan_claim_revisions (
  recorded_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_revision_id TEXT NOT NULL UNIQUE,
  claim_id TEXT NOT NULL REFERENCES zukan_claims(claim_id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL,
  predicate_uri TEXT NOT NULL,
  predicate_version INTEGER NOT NULL,
  value_artifact_id TEXT REFERENCES zukan_value_artifacts(artifact_id) ON DELETE RESTRICT,
  asserted_by_subject_id TEXT REFERENCES zukan_subject_identities(subject_id) ON DELETE SET NULL,
  polarity TEXT NOT NULL DEFAULT 'positive',
  valid_from TEXT,
  valid_to TEXT,
  observed_at TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  publication_time TEXT,
  visibility TEXT NOT NULL DEFAULT 'internal',
  supersedes_claim_revision_id TEXT REFERENCES zukan_claim_revisions(claim_revision_id) ON DELETE SET NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  CHECK (revision >= 1),
  CHECK (polarity IN ('positive','negative')),
  CHECK (visibility IN ('private','workspace','internal','public_candidate','public')),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from),
  CHECK (json_valid(metadata_json)),
  FOREIGN KEY (predicate_uri, predicate_version)
    REFERENCES zukan_predicate_definitions(predicate_uri, predicate_version)
    ON DELETE RESTRICT,
  UNIQUE (claim_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_zukan_claim_revisions_lookup
  ON zukan_claim_revisions(claim_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_zukan_claim_revisions_watermark
  ON zukan_claim_revisions(recorded_sequence, recorded_at);
CREATE INDEX IF NOT EXISTS idx_zukan_claim_revisions_subject_predicate
  ON zukan_claim_revisions(predicate_uri, predicate_version, recorded_sequence);

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_revision_sequence
BEFORE INSERT ON zukan_claim_revisions
WHEN NEW.revision <> COALESCE((SELECT MAX(revision) + 1 FROM zukan_claim_revisions WHERE claim_id = NEW.claim_id), 1)
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_revision_must_append');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_revision_predicate_match
BEFORE INSERT ON zukan_claim_revisions
WHEN NOT EXISTS (
  SELECT 1 FROM zukan_claims AS c
  WHERE c.claim_id = NEW.claim_id
    AND c.predicate_uri = NEW.predicate_uri
    AND c.predicate_version = NEW.predicate_version
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_predicate_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_revisions_no_update
BEFORE UPDATE ON zukan_claim_revisions
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_revisions_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_revisions_no_delete
BEFORE DELETE ON zukan_claim_revisions
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_revisions_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_predicate_definitions_no_update
BEFORE UPDATE ON zukan_predicate_definitions
BEGIN
  SELECT RAISE(ABORT, 'zukan_predicate_definitions_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_predicate_definitions_no_delete
BEFORE DELETE ON zukan_predicate_definitions
BEGIN
  SELECT RAISE(ABORT, 'zukan_predicate_definitions_immutable');
END;

