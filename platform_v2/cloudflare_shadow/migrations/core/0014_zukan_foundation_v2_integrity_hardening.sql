-- ZUKAN Foundation v2 integrity hardening.
-- Additive only: applied Foundation migrations 0009-0013 remain immutable.

-- PostgreSQL already carries SubjectIdentity metadata. Add the missing D1
-- projection column so the source-import contract can be lossless in both
-- dialects.
ALTER TABLE zukan_subject_identities
  ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json));

-- Abort the migration instead of silently accepting pre-existing tombstones
-- that still expose payload or storage locators.
CREATE TABLE IF NOT EXISTS zukan_foundation_v2_schema_assertions (
  assertion_key TEXT PRIMARY KEY,
  assertion_holds INTEGER NOT NULL CHECK (assertion_holds = 1),
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tenant/workspace scope is historical identity. Metadata may be enriched,
-- and an edition lifecycle may advance, but identity edges cannot be rehomed.
INSERT INTO zukan_foundation_v2_schema_assertions(assertion_key, assertion_holds)
SELECT
  '0014_source_work_publishers_share_tenant_scope',
  CASE WHEN EXISTS (
    SELECT 1
      FROM zukan_source_works AS work
      LEFT JOIN zukan_subject_identities AS publisher
        ON publisher.subject_id = work.publisher_subject_id
     WHERE work.publisher_subject_id IS NOT NULL
       AND (
         publisher.subject_id IS NULL
         OR publisher.tenant_id IS NOT work.tenant_id
         OR publisher.workspace_id IS NOT NULL
       )
  ) THEN 0 ELSE 1 END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_subject_identities_scope_immutable
BEFORE UPDATE ON zukan_subject_identities
WHEN NEW.subject_id IS NOT OLD.subject_id
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.workspace_id IS NOT OLD.workspace_id
  OR NEW.subject_kind IS NOT OLD.subject_kind
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'zukan_subject_identity_scope_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_subject_identities_no_delete
BEFORE DELETE ON zukan_subject_identities
BEGIN
  SELECT RAISE(ABORT, 'zukan_subject_identity_never_reused');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_source_works_publisher_scope
BEFORE INSERT ON zukan_source_works
WHEN NEW.publisher_subject_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
    FROM zukan_subject_identities AS publisher
   WHERE publisher.subject_id = NEW.publisher_subject_id
     AND publisher.tenant_id = NEW.tenant_id
     AND publisher.workspace_id IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_source_work_publisher_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_source_works_identity_immutable
BEFORE UPDATE ON zukan_source_works
WHEN NEW.source_work_id IS NOT OLD.source_work_id
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.title IS NOT OLD.title
  OR NEW.work_kind IS NOT OLD.work_kind
  OR NEW.publisher_subject_id IS NOT OLD.publisher_subject_id
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'zukan_source_work_identity_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_source_works_no_delete
BEFORE DELETE ON zukan_source_works
BEGIN
  SELECT RAISE(ABORT, 'zukan_source_work_identity_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_source_editions_identity_immutable
BEFORE UPDATE ON zukan_source_editions
WHEN NEW.source_edition_id IS NOT OLD.source_edition_id
  OR NEW.source_work_id IS NOT OLD.source_work_id
  OR NEW.edition_label IS NOT OLD.edition_label
  OR NEW.language_tag IS NOT OLD.language_tag
  OR NEW.issued_at IS NOT OLD.issued_at
  OR NEW.valid_from IS NOT OLD.valid_from
  OR NEW.valid_to IS NOT OLD.valid_to
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'zukan_source_edition_identity_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_source_editions_no_delete
BEFORE DELETE ON zukan_source_editions
BEGIN
  SELECT RAISE(ABORT, 'zukan_source_edition_identity_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_source_editions_lifecycle_monotonic
BEFORE UPDATE ON zukan_source_editions
WHEN (
  OLD.lifecycle_status = 'retired'
  AND NEW.lifecycle_status <> 'retired'
)
OR (
  OLD.lifecycle_status = 'superseded'
  AND NEW.lifecycle_status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_source_edition_lifecycle_irreversible');
END;

INSERT INTO zukan_foundation_v2_schema_assertions(assertion_key, assertion_holds)
SELECT
  '0014_value_artifact_tombstones_are_empty',
  CASE WHEN EXISTS (
    SELECT 1
      FROM zukan_value_artifacts
     WHERE (
       availability_status IN ('redacted', 'erased')
       AND (
         value_json IS NOT NULL
         OR value_text IS NOT NULL
         OR content_sha256 IS NOT NULL
         OR storage_locator IS NOT NULL
         OR redacted_at IS NULL
         OR julianday(redacted_at) IS NULL
         OR julianday(redacted_at) < julianday(created_at)
       )
     )
     OR (
       availability_status NOT IN ('redacted', 'erased')
       AND redacted_at IS NOT NULL
     )
  ) THEN 0 ELSE 1 END;

-- Suppression is represented by append-only governance/status events.  Fail
-- closed if a legacy row encoded suppression by mutating byte/value identity.
INSERT INTO zukan_foundation_v2_schema_assertions(assertion_key, assertion_holds)
SELECT
  '0014_suppression_is_event_only',
  CASE WHEN EXISTS (
    SELECT 1
      FROM zukan_content_objects
     WHERE availability_status = 'suppressed'
    UNION ALL
    SELECT 1
      FROM zukan_value_artifacts
     WHERE availability_status = 'suppressed'
  ) THEN 0 ELSE 1 END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_value_artifacts_empty_tombstone_insert
BEFORE INSERT ON zukan_value_artifacts
WHEN (
  NEW.availability_status IN ('redacted', 'erased')
  AND (
    NEW.value_json IS NOT NULL
    OR NEW.value_text IS NOT NULL
    OR NEW.content_sha256 IS NOT NULL
    OR NEW.storage_locator IS NOT NULL
    OR NEW.redacted_at IS NULL
    OR julianday(NEW.redacted_at) IS NULL
    OR julianday(NEW.redacted_at) < julianday(NEW.created_at)
  )
)
OR (
  NEW.availability_status NOT IN ('redacted', 'erased')
  AND NEW.redacted_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_value_artifact_tombstone_must_be_empty');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_value_artifacts_empty_tombstone_update
BEFORE UPDATE ON zukan_value_artifacts
WHEN (
  NEW.availability_status IN ('redacted', 'erased')
  AND (
    NEW.value_json IS NOT NULL
    OR NEW.value_text IS NOT NULL
    OR NEW.content_sha256 IS NOT NULL
    OR NEW.storage_locator IS NOT NULL
    OR NEW.redacted_at IS NULL
    OR julianday(NEW.redacted_at) IS NULL
    OR julianday(NEW.redacted_at) < julianday(NEW.created_at)
  )
)
OR (
  NEW.availability_status NOT IN ('redacted', 'erased')
  AND NEW.redacted_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_value_artifact_tombstone_must_be_empty');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_value_artifacts_identity_immutable
BEFORE UPDATE ON zukan_value_artifacts
WHEN NEW.artifact_id IS NOT OLD.artifact_id
  OR NEW.content_object_id IS NOT OLD.content_object_id
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'zukan_value_artifact_identity_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_value_artifacts_mutation_guard
BEFORE UPDATE ON zukan_value_artifacts
WHEN NOT (
  (
    OLD.availability_status = 'available'
    AND NEW.availability_status IN ('redacted', 'erased')
    AND NEW.value_json IS NULL
    AND NEW.value_text IS NULL
    AND NEW.content_sha256 IS NULL
    AND NEW.storage_locator IS NULL
    AND OLD.redacted_at IS NULL
    AND NEW.redacted_at IS NOT NULL
    AND COALESCE(
      julianday(NEW.redacted_at) >= julianday(OLD.created_at),
      0
    )
  )
  OR (
    OLD.availability_status = 'redacted'
    AND NEW.availability_status = 'erased'
    AND NEW.value_json IS NULL
    AND NEW.value_text IS NULL
    AND NEW.content_sha256 IS NULL
    AND NEW.storage_locator IS NULL
    AND NEW.redacted_at IS OLD.redacted_at
  )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_value_artifact_mutation_not_allowed');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_value_artifacts_no_delete
BEFORE DELETE ON zukan_value_artifacts
BEGIN
  SELECT RAISE(ABORT, 'zukan_value_artifact_immutable');
END;

-- Source bytes are staged as missing, then a matching append-only fixity event
-- is recorded, then the object can make the guarded transition to available.
CREATE TABLE IF NOT EXISTS zukan_content_fixity_events (
  fixity_event_id TEXT PRIMARY KEY,
  content_object_id TEXT NOT NULL
    REFERENCES zukan_content_objects(content_object_id) ON DELETE RESTRICT,
  content_sha256 TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  verifier TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    length(content_sha256) = 64
    AND content_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  CHECK (verification_status IN ('verified', 'failed')),
  CHECK (length(trim(verifier)) > 0),
  CHECK (julianday(verified_at) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_zukan_content_fixity_events_object
  ON zukan_content_fixity_events(content_object_id, verified_at);

CREATE TRIGGER IF NOT EXISTS trg_zukan_content_fixity_events_no_update
BEFORE UPDATE ON zukan_content_fixity_events
BEGIN
  SELECT RAISE(ABORT, 'zukan_content_fixity_events_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_content_fixity_events_no_delete
BEFORE DELETE ON zukan_content_fixity_events
BEGIN
  SELECT RAISE(ABORT, 'zukan_content_fixity_events_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_content_fixity_events_match_object
BEFORE INSERT ON zukan_content_fixity_events
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_content_objects AS object
   WHERE object.content_object_id = NEW.content_object_id
     AND object.content_sha256 = NEW.content_sha256
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_content_fixity_digest_must_match_object');
END;

INSERT INTO zukan_foundation_v2_schema_assertions(assertion_key, assertion_holds)
SELECT
  '0014_available_source_objects_have_fixity',
  CASE WHEN EXISTS (
    SELECT 1
      FROM zukan_content_objects
     WHERE object_kind = 'source_object'
       AND availability_status = 'available'
  ) THEN 0 ELSE 1 END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_content_objects_stage_source
BEFORE INSERT ON zukan_content_objects
WHEN NEW.object_kind = 'source_object'
 AND (
   NEW.availability_status <> 'missing'
   OR NEW.content_sha256 IS NULL
   OR NEW.content_sha256 GLOB '*[^0-9a-f]*'
 )
BEGIN
  SELECT RAISE(ABORT, 'zukan_source_object_must_stage_missing_with_sha256');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_content_objects_identity_immutable
BEFORE UPDATE ON zukan_content_objects
WHEN NEW.content_object_id IS NOT OLD.content_object_id
  OR NEW.source_edition_id IS NOT OLD.source_edition_id
  OR NEW.parent_content_object_id IS NOT OLD.parent_content_object_id
  OR NEW.object_kind IS NOT OLD.object_kind
  OR NEW.derivation_kind IS NOT OLD.derivation_kind
  OR NEW.mime_type IS NOT OLD.mime_type
  OR NEW.byte_length IS NOT OLD.byte_length
  OR NEW.content_sha256 IS NOT OLD.content_sha256
  OR NEW.created_at IS NOT OLD.created_at
  OR (
    NEW.storage_locator IS NOT OLD.storage_locator
    AND NOT (
      NEW.storage_locator IS NULL
      AND NEW.availability_status IN ('redacted', 'erased')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_content_object_byte_identity_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_content_objects_lifecycle
BEFORE UPDATE ON zukan_content_objects
WHEN (
  OLD.availability_status = 'suppressed'
  OR NEW.availability_status = 'suppressed'
)
OR (
  OLD.availability_status = 'erased'
  AND NEW.availability_status <> 'erased'
)
OR (
  OLD.availability_status = 'redacted'
  AND NEW.availability_status NOT IN ('redacted', 'erased')
)
OR (
  NEW.availability_status IN ('redacted', 'erased')
  AND NEW.storage_locator IS NOT NULL
)
OR (
  NEW.object_kind = 'source_object'
  AND NEW.availability_status = 'available'
  AND OLD.availability_status <> 'available'
  AND NOT EXISTS (
    SELECT 1
      FROM zukan_content_fixity_events AS fixity
     WHERE fixity.content_object_id = NEW.content_object_id
       AND fixity.content_sha256 = NEW.content_sha256
       AND fixity.verification_status = 'verified'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_content_object_lifecycle_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_content_objects_suppression_uses_events
BEFORE INSERT ON zukan_content_objects
WHEN NEW.availability_status = 'suppressed'
BEGIN
  SELECT RAISE(ABORT, 'zukan_content_object_suppression_uses_events');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_value_artifacts_suppression_uses_events
BEFORE INSERT ON zukan_value_artifacts
WHEN NEW.availability_status = 'suppressed'
BEGIN
  SELECT RAISE(ABORT, 'zukan_value_artifact_suppression_uses_events');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_content_objects_no_delete
BEFORE DELETE ON zukan_content_objects
BEGIN
  SELECT RAISE(ABORT, 'zukan_content_objects_immutable');
END;

-- A PublicIdentifier may be retired or made more sensitive, but its URI and
-- target can never change and the row can never be deleted/reused.
CREATE TRIGGER IF NOT EXISTS trg_zukan_public_identifiers_identity_immutable
BEFORE UPDATE ON zukan_public_identifiers
WHEN NEW.public_identifier_id IS NOT OLD.public_identifier_id
  OR NEW.identifier_uri IS NOT OLD.identifier_uri
  OR NEW.target_kind IS NOT OLD.target_kind
  OR NEW.target_id IS NOT OLD.target_id
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'zukan_public_identifier_identity_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_public_identifiers_no_delete
BEFORE DELETE ON zukan_public_identifiers
BEGIN
  SELECT RAISE(ABORT, 'zukan_public_identifier_uri_never_reused');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_public_identifiers_privacy_monotonic
BEFORE UPDATE ON zukan_public_identifiers
WHEN (
  OLD.sensitivity_status = 'restricted'
  AND NEW.sensitivity_status <> 'restricted'
)
OR (
  OLD.sensitivity_status = 'existence_sensitive'
  AND NEW.sensitivity_status <> 'existence_sensitive'
)
OR (
  OLD.retired_at IS NOT NULL
  AND NEW.retired_at IS NOT OLD.retired_at
)
OR (
  NEW.retired_at IS NOT NULL
  AND julianday(NEW.retired_at) IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_public_identifier_privacy_irreversible');
END;

-- Same-URI evolution is deliberately conservative: schemas must be
-- semantically identical (object-key order is ignored), while cardinality may
-- widen from one to many. Enum expansion and other schema changes require a
-- new URI until a formally verified compatibility checker exists.
CREATE TRIGGER IF NOT EXISTS trg_zukan_predicate_definitions_compatible_insert
BEFORE INSERT ON zukan_predicate_definitions
WHEN (
  NEW.predicate_version <> 1
  AND NOT EXISTS (
    SELECT 1
      FROM zukan_predicate_definitions AS first_version
     WHERE first_version.predicate_uri = NEW.predicate_uri
  )
)
OR EXISTS (
  SELECT 1
    FROM zukan_predicate_definitions AS previous
   WHERE previous.predicate_uri = NEW.predicate_uri
     AND previous.predicate_version = (
       SELECT MAX(latest.predicate_version)
         FROM zukan_predicate_definitions AS latest
        WHERE latest.predicate_uri = NEW.predicate_uri
     )
     AND (
       NEW.predicate_version <> previous.predicate_version + 1
       OR NEW.value_type <> previous.value_type
       OR EXISTS (
         SELECT fullkey, type, atom FROM json_tree(NEW.value_schema_json)
         EXCEPT
         SELECT fullkey, type, atom FROM json_tree(previous.value_schema_json)
       )
       OR EXISTS (
         SELECT fullkey, type, atom FROM json_tree(previous.value_schema_json)
         EXCEPT
         SELECT fullkey, type, atom FROM json_tree(NEW.value_schema_json)
       )
       OR NEW.polarity_mode <> previous.polarity_mode
       OR NEW.temporal_profile <> previous.temporal_profile
       OR (previous.cardinality = 'many' AND NEW.cardinality = 'one')
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_predicate_revision_breaking_change_requires_new_uri');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claims_subject_scope
BEFORE INSERT ON zukan_claims
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_subject_identities AS subject
   WHERE subject.subject_id = NEW.subject_id
     AND subject.tenant_id = NEW.tenant_id
     AND subject.workspace_id IS NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_subject_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claims_no_update
BEFORE UPDATE ON zukan_claims
BEGIN
  SELECT RAISE(ABORT, 'zukan_claims_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claims_no_delete
BEFORE DELETE ON zukan_claims
BEGIN
  SELECT RAISE(ABORT, 'zukan_claims_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_resolution_runs_subject_scope
BEFORE INSERT ON zukan_resolution_runs
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_subject_identities AS subject
   WHERE subject.subject_id = NEW.subject_id
     AND subject.tenant_id = NEW.tenant_id
     AND subject.workspace_id IS NEW.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_resolution_run_subject_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_resolution_runs_watermark_not_future
BEFORE INSERT ON zukan_resolution_runs
WHEN julianday(NEW.recorded_time_watermark) IS NULL
 OR NEW.claim_store_sequence_watermark > COALESCE(
  (SELECT MAX(recorded_sequence) FROM zukan_claim_revisions),
  0
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_resolution_run_watermark_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_revisions_recorded_at_valid
BEFORE INSERT ON zukan_claim_revisions
WHEN julianday(NEW.recorded_at) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_revision_recorded_at_invalid');
END;

-- A resolution run may only link revisions in its authoritative
-- tenant/workspace/subject/predicate scope that existed at the watermark.
CREATE TRIGGER IF NOT EXISTS trg_zukan_resolution_run_claims_watermark
BEFORE INSERT ON zukan_resolution_run_claims
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_resolution_runs AS run
    JOIN zukan_claim_revisions AS revision
      ON revision.claim_revision_id = NEW.claim_revision_id
    JOIN zukan_claims AS claim
      ON claim.claim_id = revision.claim_id
    JOIN zukan_subject_identities AS subject
      ON subject.subject_id = claim.subject_id
   WHERE run.resolution_run_id = NEW.resolution_run_id
     AND revision.recorded_sequence <= run.claim_store_sequence_watermark
     AND julianday(revision.recorded_at) IS NOT NULL
     AND julianday(run.recorded_time_watermark) IS NOT NULL
     AND julianday(revision.recorded_at) <= julianday(run.recorded_time_watermark)
     AND claim.tenant_id = run.tenant_id
     AND claim.workspace_id IS run.workspace_id
     AND claim.subject_id = run.subject_id
     AND subject.tenant_id = run.tenant_id
     AND subject.workspace_id IS run.workspace_id
     AND revision.predicate_uri = run.predicate_uri
     AND revision.predicate_version = run.predicate_version
     AND NOT EXISTS (
       SELECT 1
         FROM zukan_claim_revisions AS later_revision
        WHERE later_revision.claim_id = revision.claim_id
          AND later_revision.revision > revision.revision
          AND later_revision.recorded_sequence <= run.claim_store_sequence_watermark
          AND julianday(later_revision.recorded_at) IS NOT NULL
          AND julianday(later_revision.recorded_at) <= julianday(run.recorded_time_watermark)
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_resolution_run_claim_exceeds_watermark');
END;

-- SQLite/D1 serializes writers. These fail-closed guards therefore seal the
-- aggregate without the dual-sided parent-row locks required by PostgreSQL.
CREATE TRIGGER IF NOT EXISTS trg_zukan_resolution_run_claims_aggregate_open
BEFORE INSERT ON zukan_resolution_run_claims
WHEN EXISTS (
  SELECT 1
    FROM zukan_projection_snapshots AS snapshot
   WHERE snapshot.resolution_run_id = NEW.resolution_run_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_resolution_run_claims_sealed_by_snapshot');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_projection_entries_aggregate_open
BEFORE INSERT ON zukan_projection_entries
WHEN EXISTS (
  SELECT 1
    FROM zukan_publication_editions AS publication
   WHERE publication.projection_snapshot_id = NEW.projection_snapshot_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_projection_entries_sealed_by_publication');
END;

-- Durable idempotency and audit receipt for the bounded Foundation source
-- import. The runtime only exposes the single allowlisted operation.
CREATE TABLE IF NOT EXISTS zukan_foundation_v2_write_receipts (
  idempotency_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  attempt_token TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'pending',
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  CHECK (operation = 'source_registry_import_v1'),
  CHECK (length(payload_sha256) = 64),
  CHECK (
    length(attempt_token) = 36
    AND substr(attempt_token, 9, 1) = '-'
    AND substr(attempt_token, 14, 1) = '-'
    AND substr(attempt_token, 19, 1) = '-'
    AND substr(attempt_token, 24, 1) = '-'
    AND attempt_token NOT GLOB '*[^0-9a-f-]*'
  ),
  CHECK (outcome IN ('pending', 'succeeded')),
  CHECK (json_valid(summary_json))
);

CREATE TRIGGER IF NOT EXISTS trg_zukan_foundation_write_receipts_guard_update
BEFORE UPDATE ON zukan_foundation_v2_write_receipts
WHEN OLD.outcome <> 'pending'
  OR NEW.idempotency_key IS NOT OLD.idempotency_key
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.operation IS NOT OLD.operation
  OR NEW.payload_sha256 IS NOT OLD.payload_sha256
  OR NEW.attempt_token IS NOT OLD.attempt_token
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'zukan_foundation_write_receipt_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_foundation_write_receipts_no_delete
BEFORE DELETE ON zukan_foundation_v2_write_receipts
BEGIN
  SELECT RAISE(ABORT, 'zukan_foundation_write_receipt_immutable');
END;

-- Provenance rows are immutable. ExtractionRun has one narrowly-scoped
-- running-to-terminal completion update.
CREATE TRIGGER IF NOT EXISTS trg_zukan_source_fragments_no_update
BEFORE UPDATE ON zukan_source_fragments
BEGIN
  SELECT RAISE(ABORT, 'zukan_source_fragments_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_source_fragments_no_delete
BEFORE DELETE ON zukan_source_fragments
BEGIN
  SELECT RAISE(ABORT, 'zukan_source_fragments_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_extraction_runs_initial_state
BEFORE INSERT ON zukan_extraction_runs
WHEN julianday(NEW.started_at) IS NULL
  OR (
    NEW.run_status = 'running'
    AND (NEW.finished_at IS NOT NULL OR NEW.output_hash IS NOT NULL)
  )
  OR (
    NEW.run_status IN ('succeeded', 'partial', 'failed')
    AND (
      NEW.finished_at IS NULL
      OR julianday(NEW.finished_at) IS NULL
      OR julianday(NEW.finished_at) < julianday(NEW.started_at)
      OR (
        NEW.run_status IN ('succeeded', 'partial')
        AND NEW.output_hash IS NULL
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_extraction_run_initial_state_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_extraction_runs_complete_once
BEFORE UPDATE ON zukan_extraction_runs
WHEN NOT (
  OLD.run_status = 'running'
  AND NEW.run_status IN ('succeeded', 'partial', 'failed')
  AND NEW.extraction_run_id IS OLD.extraction_run_id
  AND NEW.input_content_object_id IS OLD.input_content_object_id
  AND NEW.extractor_kind IS OLD.extractor_kind
  AND NEW.extractor_version IS OLD.extractor_version
  AND NEW.model_name IS OLD.model_name
  AND NEW.prompt_version IS OLD.prompt_version
  AND NEW.code_version IS OLD.code_version
  AND NEW.input_hash IS OLD.input_hash
  AND NEW.started_at IS OLD.started_at
  AND NEW.finished_at IS NOT NULL
  AND julianday(NEW.finished_at) IS NOT NULL
  AND julianday(NEW.finished_at) >= julianday(OLD.started_at)
  AND (
    NEW.run_status = 'failed'
    OR NEW.output_hash IS NOT NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_extraction_run_transition_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_extraction_runs_no_delete
BEFORE DELETE ON zukan_extraction_runs
BEGIN
  SELECT RAISE(ABORT, 'zukan_extraction_runs_immutable');
END;

-- Identity-resolution assertions close monotonically. A canonical assertion
-- seals its membership set; closing an assertion seals its candidate set.
CREATE TRIGGER IF NOT EXISTS trg_zukan_identity_resolution_sets_monotonic
BEFORE UPDATE ON zukan_identity_resolution_sets
WHEN NEW.resolution_set_id IS NOT OLD.resolution_set_id
  OR NEW.valid_from IS NOT OLD.valid_from
  OR NEW.reason_json IS NOT OLD.reason_json
  OR NEW.created_at IS NOT OLD.created_at
  OR NOT (
    NEW.resolution_status = OLD.resolution_status
    OR (OLD.resolution_status = 'active' AND NEW.resolution_status IN ('superseded', 'retired'))
    OR (OLD.resolution_status = 'superseded' AND NEW.resolution_status = 'retired')
  )
  OR NOT (
    NEW.valid_to IS OLD.valid_to
    OR (OLD.valid_to IS NULL AND NEW.valid_to IS NOT NULL)
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_identity_resolution_set_transition_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_identity_resolution_sets_no_delete
BEFORE DELETE ON zukan_identity_resolution_sets
BEGIN
  SELECT RAISE(ABORT, 'zukan_identity_resolution_sets_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_identity_memberships_monotonic
BEFORE UPDATE ON zukan_identity_membership_assertions
WHEN NEW.membership_assertion_id IS NOT OLD.membership_assertion_id
  OR NEW.resolution_set_id IS NOT OLD.resolution_set_id
  OR NEW.subject_id IS NOT OLD.subject_id
  OR NEW.valid_from IS NOT OLD.valid_from
  OR NEW.confidence IS NOT OLD.confidence
  OR NEW.evidence_json IS NOT OLD.evidence_json
  OR NEW.created_at IS NOT OLD.created_at
  OR NOT (
    NEW.membership_state = OLD.membership_state
    OR (
      OLD.membership_state = 'candidate'
      AND NEW.membership_state IN ('exact', 'rejected')
    )
  )
  OR NOT (
    NEW.valid_to IS OLD.valid_to
    OR (OLD.valid_to IS NULL AND NEW.valid_to IS NOT NULL)
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_identity_membership_transition_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_identity_memberships_no_delete
BEFORE DELETE ON zukan_identity_membership_assertions
BEGIN
  SELECT RAISE(ABORT, 'zukan_identity_memberships_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_identity_memberships_scope_and_seal
BEFORE INSERT ON zukan_identity_membership_assertions
WHEN EXISTS (
  SELECT 1
    FROM zukan_canonical_identity_assertions
   WHERE resolution_set_id = NEW.resolution_set_id
)
OR EXISTS (
  SELECT 1
    FROM zukan_identity_membership_assertions AS membership
    JOIN zukan_subject_identities AS existing_subject
      ON existing_subject.subject_id = membership.subject_id
    JOIN zukan_subject_identities AS new_subject
      ON new_subject.subject_id = NEW.subject_id
   WHERE membership.resolution_set_id = NEW.resolution_set_id
     AND (
       existing_subject.tenant_id IS NOT new_subject.tenant_id
       OR existing_subject.workspace_id IS NOT new_subject.workspace_id
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_identity_membership_scope_or_seal_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_canonical_assertions_close_only
BEFORE UPDATE ON zukan_canonical_identity_assertions
WHEN NEW.canonical_assertion_id IS NOT OLD.canonical_assertion_id
  OR NEW.public_identifier_id IS NOT OLD.public_identifier_id
  OR NEW.assertion_mode IS NOT OLD.assertion_mode
  OR NEW.resolution_set_id IS NOT OLD.resolution_set_id
  OR NEW.successor_public_identifier_id IS NOT OLD.successor_public_identifier_id
  OR NEW.valid_from IS NOT OLD.valid_from
  OR NEW.reason_json IS NOT OLD.reason_json
  OR NEW.created_at IS NOT OLD.created_at
  OR NOT (
    NEW.valid_to IS OLD.valid_to
    OR (OLD.valid_to IS NULL AND NEW.valid_to IS NOT NULL)
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_canonical_identity_assertion_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_canonical_assertions_no_delete
BEFORE DELETE ON zukan_canonical_identity_assertions
BEGIN
  SELECT RAISE(ABORT, 'zukan_canonical_identity_assertions_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_canonical_assertions_scope
BEFORE INSERT ON zukan_canonical_identity_assertions
WHEN (
  NEW.assertion_mode IN ('resolved', 'ambiguous')
  AND (
    NOT EXISTS (
      SELECT 1
        FROM zukan_public_identifiers AS identifier
        JOIN zukan_subject_identities AS target
          ON identifier.target_kind = 'subject_identity'
         AND target.subject_id = identifier.target_id
       WHERE identifier.public_identifier_id = NEW.public_identifier_id
         AND EXISTS (
           SELECT 1
             FROM zukan_identity_membership_assertions
            WHERE resolution_set_id = NEW.resolution_set_id
         )
         AND NOT EXISTS (
           SELECT 1
             FROM zukan_identity_membership_assertions AS membership
             JOIN zukan_subject_identities AS member
               ON member.subject_id = membership.subject_id
            WHERE membership.resolution_set_id = NEW.resolution_set_id
              AND (
                member.tenant_id IS NOT target.tenant_id
                OR member.workspace_id IS NOT target.workspace_id
              )
         )
    )
  )
)
OR (
  NEW.assertion_mode = 'redirect'
  AND NOT EXISTS (
    SELECT 1
      FROM zukan_public_identifiers AS source_identifier
      JOIN zukan_subject_identities AS source_subject
        ON source_identifier.target_kind = 'subject_identity'
       AND source_subject.subject_id = source_identifier.target_id
      JOIN zukan_public_identifiers AS successor_identifier
        ON successor_identifier.public_identifier_id = NEW.successor_public_identifier_id
       AND successor_identifier.target_kind = 'subject_identity'
      JOIN zukan_subject_identities AS successor_subject
        ON successor_subject.subject_id = successor_identifier.target_id
     WHERE source_identifier.public_identifier_id = NEW.public_identifier_id
       AND source_subject.tenant_id IS successor_subject.tenant_id
       AND source_subject.workspace_id IS successor_subject.workspace_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_canonical_identity_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_canonical_candidates_scope
BEFORE INSERT ON zukan_canonical_identity_candidates
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_canonical_identity_assertions AS assertion
    JOIN zukan_public_identifiers AS identifier
      ON identifier.public_identifier_id = assertion.public_identifier_id
     AND identifier.target_kind = 'subject_identity'
    JOIN zukan_subject_identities AS target
      ON target.subject_id = identifier.target_id
    JOIN zukan_subject_identities AS candidate
      ON candidate.subject_id = NEW.subject_id
    JOIN zukan_identity_membership_assertions AS membership
      ON membership.resolution_set_id = assertion.resolution_set_id
     AND membership.subject_id = NEW.subject_id
   WHERE assertion.canonical_assertion_id = NEW.canonical_assertion_id
     AND assertion.assertion_mode = 'ambiguous'
     AND assertion.valid_to IS NULL
     AND target.tenant_id IS candidate.tenant_id
     AND target.workspace_id IS candidate.workspace_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_canonical_identity_candidate_scope_or_seal_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_canonical_candidates_no_update
BEFORE UPDATE ON zukan_canonical_identity_candidates
BEGIN
  SELECT RAISE(ABORT, 'zukan_canonical_identity_candidates_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_canonical_candidates_no_delete
BEFORE DELETE ON zukan_canonical_identity_candidates
BEGIN
  SELECT RAISE(ABORT, 'zukan_canonical_identity_candidates_immutable');
END;

-- Claim provenance and publication visibility share one fail-closed scope
-- contract despite legacy private/internal enum spelling differences.
CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_revisions_scope
BEFORE INSERT ON zukan_claim_revisions
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_claims AS claim
   WHERE claim.claim_id = NEW.claim_id
     AND (
       NEW.asserted_by_subject_id IS NULL
       OR EXISTS (
         SELECT 1
           FROM zukan_subject_identities AS asserted_by
          WHERE asserted_by.subject_id = NEW.asserted_by_subject_id
            AND asserted_by.tenant_id = claim.tenant_id
            AND (
              asserted_by.workspace_id IS NULL
              OR asserted_by.workspace_id IS claim.workspace_id
            )
       )
     )
     AND NOT (
       claim.workspace_id IS NOT NULL
       AND NEW.visibility IN ('public', 'public_candidate')
     )
     AND (
       (
         NEW.revision = 1
         AND NEW.supersedes_claim_revision_id IS NULL
       )
       OR (
         NEW.revision > 1
         AND NEW.supersedes_claim_revision_id = (
           SELECT previous.claim_revision_id
             FROM zukan_claim_revisions AS previous
            WHERE previous.claim_id = NEW.claim_id
              AND previous.revision = NEW.revision - 1
         )
       )
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_revision_scope_or_supersession_invalid');
END;

-- Trust and authority facts are append-only; revocation is represented by the
-- dedicated event table.
CREATE TRIGGER IF NOT EXISTS trg_zukan_trust_anchors_no_update
BEFORE UPDATE ON zukan_trust_anchors
BEGIN
  SELECT RAISE(ABORT, 'zukan_trust_anchors_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_trust_anchors_no_delete
BEFORE DELETE ON zukan_trust_anchors
BEGIN
  SELECT RAISE(ABORT, 'zukan_trust_anchors_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_authority_assertions_scope
BEFORE INSERT ON zukan_authority_assertions
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_trust_anchors AS anchor
    JOIN zukan_subject_identities AS authority
      ON authority.subject_id = NEW.authority_subject_id
   WHERE anchor.trust_anchor_id = NEW.trust_anchor_id
     AND anchor.tenant_id = authority.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_authority_assertion_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_authority_assertions_no_update
BEFORE UPDATE ON zukan_authority_assertions
BEGIN
  SELECT RAISE(ABORT, 'zukan_authority_assertions_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_authority_assertions_no_delete
BEFORE DELETE ON zukan_authority_assertions
BEGIN
  SELECT RAISE(ABORT, 'zukan_authority_assertions_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_authority_links_scope_and_seal
BEFORE INSERT ON zukan_claim_authority_links
WHEN EXISTS (
  SELECT 1
    FROM zukan_resolution_run_claims
   WHERE claim_revision_id = NEW.claim_revision_id
)
OR NOT EXISTS (
  SELECT 1
    FROM zukan_claim_revisions AS revision
    JOIN zukan_claims AS claim
      ON claim.claim_id = revision.claim_id
    JOIN zukan_authority_assertions AS assertion
      ON assertion.authority_assertion_id = NEW.authority_assertion_id
    JOIN zukan_trust_anchors AS anchor
      ON anchor.trust_anchor_id = assertion.trust_anchor_id
    JOIN zukan_subject_identities AS authority
      ON authority.subject_id = assertion.authority_subject_id
   WHERE revision.claim_revision_id = NEW.claim_revision_id
     AND anchor.tenant_id = claim.tenant_id
     AND authority.tenant_id = claim.tenant_id
     AND (
       authority.workspace_id IS NULL
       OR authority.workspace_id IS claim.workspace_id
     )
     AND (
       assertion.predicate_uri IS NULL
       OR (
         assertion.predicate_uri = revision.predicate_uri
         AND assertion.predicate_version = revision.predicate_version
       )
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_authority_link_scope_or_seal_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_authority_links_no_update
BEFORE UPDATE ON zukan_claim_authority_links
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_authority_links_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_authority_links_no_delete
BEFORE DELETE ON zukan_claim_authority_links
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_authority_links_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_projection_entries_semantic_edge
BEFORE INSERT ON zukan_projection_entries
WHEN NEW.claim_revision_id IS NULL
  OR NEW.value_artifact_id IS NULL
  OR NOT EXISTS (
    SELECT 1
      FROM zukan_projection_snapshots AS snapshot
      JOIN zukan_resolution_runs AS run
        ON run.resolution_run_id = snapshot.resolution_run_id
      JOIN zukan_resolution_run_claims AS run_claim
        ON run_claim.resolution_run_id = snapshot.resolution_run_id
       AND run_claim.claim_revision_id = NEW.claim_revision_id
       AND run_claim.decision = 'accepted'
      JOIN zukan_claim_revisions AS revision
        ON revision.claim_revision_id = NEW.claim_revision_id
       AND revision.value_artifact_id = NEW.value_artifact_id
      JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
      JOIN zukan_value_artifacts AS artifact
        ON artifact.artifact_id = NEW.value_artifact_id
     WHERE snapshot.projection_snapshot_id = NEW.projection_snapshot_id
       AND claim.tenant_id = run.tenant_id
       AND claim.workspace_id IS run.workspace_id
       AND claim.subject_id = run.subject_id
       AND revision.predicate_uri = run.predicate_uri
       AND revision.predicate_version = run.predicate_version
       AND artifact.availability_status = 'available'
       AND (
         artifact.content_object_id IS NULL
         OR EXISTS (
           SELECT 1
             FROM zukan_content_objects AS object
            WHERE object.content_object_id = artifact.content_object_id
              AND object.availability_status = 'available'
         )
       )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_projection_entry_semantic_edge_invalid');
END;

-- Survey definition is stable; only ended_at may be set once. Detection
-- outcomes cannot cross the survey tenant/workspace boundary.
CREATE TRIGGER IF NOT EXISTS trg_zukan_survey_events_complete_once
BEFORE UPDATE ON zukan_survey_events
WHEN NEW.survey_event_id IS NOT OLD.survey_event_id
  OR NEW.tenant_id IS NOT OLD.tenant_id
  OR NEW.workspace_id IS NOT OLD.workspace_id
  OR NEW.subject_scope_json IS NOT OLD.subject_scope_json
  OR NEW.method_json IS NOT OLD.method_json
  OR NEW.effort_json IS NOT OLD.effort_json
  OR NEW.started_at IS NOT OLD.started_at
  OR NEW.created_at IS NOT OLD.created_at
  OR OLD.ended_at IS NOT NULL
  OR NEW.ended_at IS NULL
  OR julianday(NEW.ended_at) IS NULL
  OR julianday(NEW.ended_at) < julianday(OLD.started_at)
BEGIN
  SELECT RAISE(ABORT, 'zukan_survey_event_transition_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_survey_events_no_delete
BEFORE DELETE ON zukan_survey_events
BEGIN
  SELECT RAISE(ABORT, 'zukan_survey_events_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_detection_outcomes_scope
BEFORE INSERT ON zukan_detection_outcomes
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_survey_events AS survey
    JOIN zukan_subject_identities AS subject
      ON subject.subject_id = NEW.subject_id
   WHERE survey.survey_event_id = NEW.survey_event_id
     AND survey.tenant_id = subject.tenant_id
     AND survey.workspace_id IS subject.workspace_id
     AND julianday(NEW.recorded_at) IS NOT NULL
     AND julianday(NEW.recorded_at) >= julianday(survey.started_at)
     AND (
       NEW.outcome <> 'not_detected'
       OR (
         survey.ended_at IS NOT NULL
         AND julianday(survey.ended_at) IS NOT NULL
         AND julianday(NEW.recorded_at) >= julianday(survey.ended_at)
       )
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_detection_outcome_scope_mismatch');
END;

-- Cross-entity semantic edge guards.
CREATE TRIGGER IF NOT EXISTS trg_zukan_rights_evaluations_inheritance_scope
BEFORE INSERT ON zukan_rights_evaluations
WHEN NEW.inherited_from_rights_evaluation_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
    FROM zukan_rights_evaluations AS parent
   WHERE parent.rights_evaluation_id = NEW.inherited_from_rights_evaluation_id
     AND parent.purpose = NEW.purpose
     AND (
       (
         parent.content_object_id IS NEW.content_object_id
         AND parent.value_artifact_id IS NEW.value_artifact_id
       )
       OR (
         NEW.content_object_id IS NOT NULL
         AND NEW.value_artifact_id IS NULL
         AND parent.value_artifact_id IS NULL
         AND parent.content_object_id = (
           SELECT child.parent_content_object_id
             FROM zukan_content_objects AS child
            WHERE child.content_object_id = NEW.content_object_id
         )
       )
       OR (
         NEW.value_artifact_id IS NOT NULL
         AND NEW.content_object_id IS NULL
         AND parent.value_artifact_id IS NULL
         AND parent.content_object_id = (
           SELECT artifact.content_object_id
             FROM zukan_value_artifacts AS artifact
            WHERE artifact.artifact_id = NEW.value_artifact_id
         )
       )
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_rights_inheritance_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_dispute_cases_resolution_scope
BEFORE INSERT ON zukan_dispute_cases
WHEN NEW.resolution_run_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
    FROM zukan_resolution_runs AS run
   WHERE run.resolution_run_id = NEW.resolution_run_id
     AND run.subject_id = NEW.subject_id
     AND run.predicate_uri = NEW.predicate_uri
     AND run.predicate_version = NEW.predicate_version
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_dispute_case_resolution_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_correction_requests_claim_scope
BEFORE INSERT ON zukan_correction_requests
WHEN (
  NEW.claim_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM zukan_claim_revisions AS revision
      JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
     WHERE revision.claim_revision_id = NEW.claim_revision_id
       AND claim.subject_id = NEW.subject_id
  )
)
OR (
  NEW.dispute_case_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM zukan_dispute_cases AS dispute
     WHERE dispute.dispute_case_id = NEW.dispute_case_id
       AND dispute.subject_id = NEW.subject_id
  )
)
OR (
  NEW.dispute_case_id IS NOT NULL
  AND NEW.claim_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM zukan_dispute_cases AS dispute
      JOIN zukan_claim_revisions AS revision
        ON revision.claim_revision_id = NEW.claim_revision_id
      JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
     WHERE dispute.dispute_case_id = NEW.dispute_case_id
       AND dispute.subject_id = claim.subject_id
       AND dispute.predicate_uri = revision.predicate_uri
       AND dispute.predicate_version = revision.predicate_version
  )
)
OR (
  NEW.requested_by_subject_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM zukan_subject_identities AS target
      JOIN zukan_subject_identities AS requester
        ON requester.subject_id = NEW.requested_by_subject_id
     WHERE target.subject_id = NEW.subject_id
       AND requester.tenant_id = target.tenant_id
       AND requester.workspace_id IS target.workspace_id
  )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_correction_request_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_suppression_events_governance_scope
BEFORE INSERT ON zukan_suppression_request_events
WHEN (
  NEW.event_type = 'executed'
  AND NEW.governance_event_id IS NULL
)
OR (
  NEW.governance_event_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM zukan_suppression_requests AS request
      JOIN zukan_content_governance_events AS governance
        ON governance.governance_event_id = NEW.governance_event_id
     WHERE request.suppression_request_id = NEW.suppression_request_id
       AND governance.target_kind = request.target_kind
       AND governance.target_id = request.target_id
       AND governance.action = request.requested_action
  )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_suppression_governance_scope_mismatch');
END;

-- Rights inheritance cannot widen the parent decision in target, purpose,
-- basis, validity, or review horizon. Conflicting decisions may not overlap.
CREATE TRIGGER IF NOT EXISTS trg_zukan_rights_evaluations_inheritance_validity
BEFORE INSERT ON zukan_rights_evaluations
WHEN NEW.inherited_from_rights_evaluation_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
    FROM zukan_rights_evaluations AS parent
   WHERE parent.rights_evaluation_id = NEW.inherited_from_rights_evaluation_id
     AND parent.rights_evaluation_id IS NOT NEW.rights_evaluation_id
     AND parent.purpose = NEW.purpose
     AND parent.basis = NEW.basis
     AND (
       parent.valid_from IS NULL
       OR (
         NEW.valid_from IS NOT NULL
         AND julianday(NEW.valid_from) IS NOT NULL
         AND julianday(NEW.valid_from) >= julianday(parent.valid_from)
       )
     )
     AND (
       parent.valid_to IS NULL
       OR (
         NEW.valid_to IS NOT NULL
         AND julianday(NEW.valid_to) IS NOT NULL
         AND julianday(NEW.valid_to) <= julianday(parent.valid_to)
       )
     )
     AND (
       parent.basis_review_due IS NULL
       OR (
         NEW.basis_review_due IS NOT NULL
         AND julianday(NEW.basis_review_due) IS NOT NULL
         AND julianday(NEW.basis_review_due) <= julianday(parent.basis_review_due)
       )
     )
 )
BEGIN
  SELECT RAISE(ABORT, 'zukan_rights_inheritance_validity_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_rights_evaluations_interval_consistency
BEFORE INSERT ON zukan_rights_evaluations
WHEN (NEW.valid_from IS NOT NULL AND julianday(NEW.valid_from) IS NULL)
  OR (NEW.valid_to IS NOT NULL AND julianday(NEW.valid_to) IS NULL)
  OR (NEW.basis_review_due IS NOT NULL AND julianday(NEW.basis_review_due) IS NULL)
  OR EXISTS (
    SELECT 1
      FROM zukan_rights_evaluations AS existing
     WHERE existing.purpose = NEW.purpose
       AND existing.content_object_id IS NEW.content_object_id
       AND existing.value_artifact_id IS NEW.value_artifact_id
       AND existing.basis <> NEW.basis
       AND (
         existing.valid_to IS NULL
         OR NEW.valid_from IS NULL
         OR julianday(existing.valid_to) > julianday(NEW.valid_from)
       )
       AND (
         NEW.valid_to IS NULL
         OR existing.valid_from IS NULL
         OR julianday(NEW.valid_to) > julianday(existing.valid_from)
       )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_rights_interval_conflict');
END;

-- Polymorphic governance and suppression targets must exist. When an actor is
-- recorded, every derivable target scope must match that actor exactly.
CREATE TRIGGER IF NOT EXISTS trg_zukan_governance_events_target_valid
BEFORE INSERT ON zukan_content_governance_events
WHEN (
  (NEW.target_kind = 'content_object'
   AND NOT EXISTS (
     SELECT 1 FROM zukan_content_objects WHERE content_object_id = NEW.target_id
   ))
  OR (NEW.target_kind = 'value_artifact'
      AND NOT EXISTS (
        SELECT 1 FROM zukan_value_artifacts WHERE artifact_id = NEW.target_id
      ))
  OR (NEW.target_kind = 'claim_revision'
      AND NOT EXISTS (
        SELECT 1 FROM zukan_claim_revisions WHERE claim_revision_id = NEW.target_id
      ))
  OR (NEW.target_kind = 'projection_snapshot'
      AND NOT EXISTS (
        SELECT 1 FROM zukan_projection_snapshots WHERE projection_snapshot_id = NEW.target_id
      ))
  OR (NEW.target_kind = 'publication_edition'
      AND NOT EXISTS (
        SELECT 1 FROM zukan_publication_editions WHERE publication_edition_id = NEW.target_id
      ))
)
OR (
  NEW.requested_by_subject_id IS NOT NULL
  AND (
    NOT EXISTS (
      WITH target_scope(tenant_id, workspace_id) AS (
        SELECT claim.tenant_id, claim.workspace_id
          FROM zukan_claim_revisions AS revision
          JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
         WHERE NEW.target_kind = 'claim_revision'
           AND revision.claim_revision_id = NEW.target_id
        UNION
        SELECT claim.tenant_id, claim.workspace_id
          FROM zukan_value_artifacts AS artifact
          JOIN zukan_claim_revisions AS revision
            ON revision.value_artifact_id = artifact.artifact_id
          JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
         WHERE NEW.target_kind = 'value_artifact'
           AND artifact.artifact_id = NEW.target_id
        UNION
        SELECT work.tenant_id, NULL
          FROM zukan_content_objects AS object
          JOIN zukan_source_editions AS edition
            ON edition.source_edition_id = object.source_edition_id
          JOIN zukan_source_works AS work ON work.source_work_id = edition.source_work_id
         WHERE NEW.target_kind = 'content_object'
           AND object.content_object_id = NEW.target_id
        UNION
        SELECT run.tenant_id, run.workspace_id
          FROM zukan_projection_snapshots AS snapshot
          JOIN zukan_resolution_runs AS run
            ON run.resolution_run_id = snapshot.resolution_run_id
         WHERE NEW.target_kind = 'projection_snapshot'
           AND snapshot.projection_snapshot_id = NEW.target_id
        UNION
        SELECT run.tenant_id, run.workspace_id
          FROM zukan_publication_editions AS publication
          JOIN zukan_projection_snapshots AS snapshot
            ON snapshot.projection_snapshot_id = publication.projection_snapshot_id
          JOIN zukan_resolution_runs AS run
            ON run.resolution_run_id = snapshot.resolution_run_id
         WHERE NEW.target_kind = 'publication_edition'
           AND publication.publication_edition_id = NEW.target_id
      )
      SELECT 1 FROM target_scope
    )
    OR EXISTS (
      WITH target_scope(tenant_id, workspace_id) AS (
        SELECT claim.tenant_id, claim.workspace_id
          FROM zukan_claim_revisions AS revision
          JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
         WHERE NEW.target_kind = 'claim_revision'
           AND revision.claim_revision_id = NEW.target_id
        UNION
        SELECT claim.tenant_id, claim.workspace_id
          FROM zukan_value_artifacts AS artifact
          JOIN zukan_claim_revisions AS revision
            ON revision.value_artifact_id = artifact.artifact_id
          JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
         WHERE NEW.target_kind = 'value_artifact'
           AND artifact.artifact_id = NEW.target_id
        UNION
        SELECT work.tenant_id, NULL
          FROM zukan_content_objects AS object
          JOIN zukan_source_editions AS edition
            ON edition.source_edition_id = object.source_edition_id
          JOIN zukan_source_works AS work ON work.source_work_id = edition.source_work_id
         WHERE NEW.target_kind = 'content_object'
           AND object.content_object_id = NEW.target_id
        UNION
        SELECT run.tenant_id, run.workspace_id
          FROM zukan_projection_snapshots AS snapshot
          JOIN zukan_resolution_runs AS run
            ON run.resolution_run_id = snapshot.resolution_run_id
         WHERE NEW.target_kind = 'projection_snapshot'
           AND snapshot.projection_snapshot_id = NEW.target_id
        UNION
        SELECT run.tenant_id, run.workspace_id
          FROM zukan_publication_editions AS publication
          JOIN zukan_projection_snapshots AS snapshot
            ON snapshot.projection_snapshot_id = publication.projection_snapshot_id
          JOIN zukan_resolution_runs AS run
            ON run.resolution_run_id = snapshot.resolution_run_id
         WHERE NEW.target_kind = 'publication_edition'
           AND publication.publication_edition_id = NEW.target_id
      )
      SELECT 1
        FROM target_scope
        JOIN zukan_subject_identities AS requester
          ON requester.subject_id = NEW.requested_by_subject_id
       WHERE requester.tenant_id IS NOT target_scope.tenant_id
          OR requester.workspace_id IS NOT target_scope.workspace_id
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_governance_target_scope_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_suppression_requests_target_valid
BEFORE INSERT ON zukan_suppression_requests
WHEN (
  (NEW.target_kind = 'content_object'
   AND NOT EXISTS (
     SELECT 1 FROM zukan_content_objects WHERE content_object_id = NEW.target_id
   ))
  OR (NEW.target_kind = 'value_artifact'
      AND NOT EXISTS (
        SELECT 1 FROM zukan_value_artifacts WHERE artifact_id = NEW.target_id
      ))
  OR (NEW.target_kind = 'claim_revision'
      AND NOT EXISTS (
        SELECT 1 FROM zukan_claim_revisions WHERE claim_revision_id = NEW.target_id
      ))
  OR (NEW.target_kind = 'projection_snapshot'
      AND NOT EXISTS (
        SELECT 1 FROM zukan_projection_snapshots WHERE projection_snapshot_id = NEW.target_id
      ))
  OR (NEW.target_kind = 'publication_edition'
      AND NOT EXISTS (
        SELECT 1 FROM zukan_publication_editions WHERE publication_edition_id = NEW.target_id
      ))
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_suppression_target_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_suppression_requests_actor_scope
BEFORE INSERT ON zukan_suppression_requests
WHEN NEW.requested_by_subject_id IS NOT NULL
 AND NOT EXISTS (
  SELECT 1
    FROM zukan_subject_identities AS requester
   WHERE requester.subject_id = NEW.requested_by_subject_id
     AND (
       EXISTS (
         SELECT 1
           FROM zukan_claim_revisions AS revision
           JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
          WHERE NEW.target_kind = 'claim_revision'
            AND revision.claim_revision_id = NEW.target_id
            AND claim.tenant_id = requester.tenant_id
            AND claim.workspace_id IS requester.workspace_id
       )
       OR EXISTS (
         SELECT 1
           FROM zukan_value_artifacts AS artifact
           JOIN zukan_claim_revisions AS revision
             ON revision.value_artifact_id = artifact.artifact_id
           JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
          WHERE NEW.target_kind = 'value_artifact'
            AND artifact.artifact_id = NEW.target_id
            AND claim.tenant_id = requester.tenant_id
            AND claim.workspace_id IS requester.workspace_id
       )
       OR EXISTS (
         SELECT 1
           FROM zukan_content_objects AS object
           JOIN zukan_source_editions AS edition
             ON edition.source_edition_id = object.source_edition_id
           JOIN zukan_source_works AS work ON work.source_work_id = edition.source_work_id
          WHERE NEW.target_kind = 'content_object'
            AND object.content_object_id = NEW.target_id
            AND work.tenant_id = requester.tenant_id
            AND requester.workspace_id IS NULL
       )
       OR EXISTS (
         SELECT 1
           FROM zukan_projection_snapshots AS snapshot
           JOIN zukan_resolution_runs AS run
             ON run.resolution_run_id = snapshot.resolution_run_id
          WHERE NEW.target_kind = 'projection_snapshot'
            AND snapshot.projection_snapshot_id = NEW.target_id
            AND run.tenant_id = requester.tenant_id
            AND run.workspace_id IS requester.workspace_id
       )
       OR EXISTS (
         SELECT 1
           FROM zukan_publication_editions AS publication
           JOIN zukan_projection_snapshots AS snapshot
             ON snapshot.projection_snapshot_id = publication.projection_snapshot_id
           JOIN zukan_resolution_runs AS run
             ON run.resolution_run_id = snapshot.resolution_run_id
          WHERE NEW.target_kind = 'publication_edition'
            AND publication.publication_edition_id = NEW.target_id
            AND run.tenant_id = requester.tenant_id
            AND run.workspace_id IS requester.workspace_id
       )
     )
 )
BEGIN
  SELECT RAISE(ABORT, 'zukan_suppression_target_scope_invalid');
END;

-- A retroactive authority revocation must enumerate exactly the snapshots
-- derived from that authority and those snapshots must already be degraded.
CREATE TRIGGER IF NOT EXISTS trg_zukan_authority_revocations_retroactive_impact
BEFORE INSERT ON zukan_authority_revocation_events
WHEN NEW.revocation_mode = 'retroactive'
 AND (
  json_type(NEW.impact_json) <> 'array'
  OR json_array_length(NEW.impact_json) = 0
  OR json(NEW.impact_json) <> NEW.impact_json
  OR (
    SELECT COUNT(*) FROM json_each(NEW.impact_json)
  ) <> (
    SELECT COUNT(DISTINCT value) FROM json_each(NEW.impact_json)
  )
  OR EXISTS (
    SELECT 1
      FROM json_each(NEW.impact_json) AS impacted
     WHERE impacted.type <> 'text'
        OR NOT EXISTS (
          SELECT 1
            FROM zukan_projection_snapshots AS snapshot
            JOIN zukan_resolution_run_claims AS run_claim
              ON run_claim.resolution_run_id = snapshot.resolution_run_id
            JOIN zukan_claim_authority_links AS authority_link
              ON authority_link.claim_revision_id = run_claim.claim_revision_id
           WHERE snapshot.projection_snapshot_id = impacted.value
             AND authority_link.authority_assertion_id = NEW.authority_assertion_id
        )
        OR COALESCE((
          SELECT status.reproducibility_status
            FROM zukan_snapshot_status_events AS status
           WHERE status.projection_snapshot_id = impacted.value
             AND julianday(status.recorded_at) >= julianday(NEW.effective_at)
           ORDER BY status.recorded_at DESC
           LIMIT 1
        ), 'full') NOT IN ('redacted', 'degraded')
  )
  OR EXISTS (
    SELECT 1
      FROM zukan_projection_snapshots AS snapshot
      JOIN zukan_resolution_run_claims AS run_claim
        ON run_claim.resolution_run_id = snapshot.resolution_run_id
      JOIN zukan_claim_authority_links AS authority_link
        ON authority_link.claim_revision_id = run_claim.claim_revision_id
     WHERE authority_link.authority_assertion_id = NEW.authority_assertion_id
       AND NOT EXISTS (
         SELECT 1
           FROM json_each(NEW.impact_json) AS impacted
          WHERE impacted.value = snapshot.projection_snapshot_id
       )
  )
 )
BEGIN
  SELECT RAISE(ABORT, 'zukan_retroactive_revocation_impact_incomplete');
END;

-- Every workflow has a single initial event and a strict, tie-free timestamp
-- order. IDs can no longer be used to choose a different "latest" event.
CREATE TRIGGER IF NOT EXISTS trg_zukan_dispute_case_events_state_machine
BEFORE INSERT ON zukan_dispute_case_events
WHEN julianday(NEW.recorded_at) IS NULL
  OR EXISTS (
    SELECT 1 FROM zukan_dispute_cases AS dispute
     WHERE dispute.dispute_case_id = NEW.dispute_case_id
       AND julianday(NEW.recorded_at) < julianday(dispute.opened_at)
  )
  OR EXISTS (
    SELECT 1 FROM zukan_dispute_case_events AS existing
     WHERE existing.dispute_case_id = NEW.dispute_case_id
       AND julianday(existing.recorded_at) >= julianday(NEW.recorded_at)
  )
  OR (
    NOT EXISTS (
      SELECT 1 FROM zukan_dispute_case_events
       WHERE dispute_case_id = NEW.dispute_case_id
    )
    AND NEW.event_type <> 'opened'
  )
  OR (
    EXISTS (
      SELECT 1 FROM zukan_dispute_case_events
       WHERE dispute_case_id = NEW.dispute_case_id
    )
    AND NOT EXISTS (
      SELECT 1
        FROM zukan_dispute_case_events AS previous
       WHERE previous.dispute_case_id = NEW.dispute_case_id
         AND previous.recorded_at = (
           SELECT MAX(latest.recorded_at)
             FROM zukan_dispute_case_events AS latest
            WHERE latest.dispute_case_id = NEW.dispute_case_id
         )
         AND (
           (previous.event_type IN ('opened', 'reopened')
            AND NEW.event_type IN ('under_review', 'resolved', 'dismissed'))
           OR (previous.event_type = 'under_review'
               AND NEW.event_type IN ('resolved', 'dismissed'))
           OR (previous.event_type IN ('resolved', 'dismissed')
               AND NEW.event_type = 'reopened')
         )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_dispute_event_transition_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_correction_request_events_state_machine
BEFORE INSERT ON zukan_correction_request_events
WHEN julianday(NEW.recorded_at) IS NULL
  OR EXISTS (
    SELECT 1 FROM zukan_correction_requests AS request
     WHERE request.correction_request_id = NEW.correction_request_id
       AND julianday(NEW.recorded_at) < julianday(request.requested_at)
  )
  OR EXISTS (
    SELECT 1 FROM zukan_correction_request_events AS existing
     WHERE existing.correction_request_id = NEW.correction_request_id
       AND julianday(existing.recorded_at) >= julianday(NEW.recorded_at)
  )
  OR (
    NOT EXISTS (
      SELECT 1 FROM zukan_correction_request_events
       WHERE correction_request_id = NEW.correction_request_id
    )
    AND NEW.event_type <> 'submitted'
  )
  OR (
    EXISTS (
      SELECT 1 FROM zukan_correction_request_events
       WHERE correction_request_id = NEW.correction_request_id
    )
    AND NOT EXISTS (
      SELECT 1
        FROM zukan_correction_request_events AS previous
       WHERE previous.correction_request_id = NEW.correction_request_id
         AND previous.recorded_at = (
           SELECT MAX(latest.recorded_at)
             FROM zukan_correction_request_events AS latest
            WHERE latest.correction_request_id = NEW.correction_request_id
         )
         AND (
           (previous.event_type = 'submitted'
            AND NEW.event_type IN ('under_review', 'withdrawn'))
           OR (previous.event_type = 'under_review'
               AND NEW.event_type IN (
                 'accepted', 'partially_accepted', 'rejected', 'withdrawn'
               ))
         )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_correction_event_transition_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_suppression_request_events_state_machine
BEFORE INSERT ON zukan_suppression_request_events
WHEN julianday(NEW.recorded_at) IS NULL
  OR EXISTS (
    SELECT 1 FROM zukan_suppression_requests AS request
     WHERE request.suppression_request_id = NEW.suppression_request_id
       AND julianday(NEW.recorded_at) < julianday(request.requested_at)
  )
  OR EXISTS (
    SELECT 1 FROM zukan_suppression_request_events AS existing
     WHERE existing.suppression_request_id = NEW.suppression_request_id
       AND julianday(existing.recorded_at) >= julianday(NEW.recorded_at)
  )
  OR (
    NOT EXISTS (
      SELECT 1 FROM zukan_suppression_request_events
       WHERE suppression_request_id = NEW.suppression_request_id
    )
    AND NEW.event_type <> 'submitted'
  )
  OR (
    EXISTS (
      SELECT 1 FROM zukan_suppression_request_events
       WHERE suppression_request_id = NEW.suppression_request_id
    )
    AND NOT EXISTS (
      SELECT 1
        FROM zukan_suppression_request_events AS previous
       WHERE previous.suppression_request_id = NEW.suppression_request_id
         AND previous.recorded_at = (
           SELECT MAX(latest.recorded_at)
             FROM zukan_suppression_request_events AS latest
            WHERE latest.suppression_request_id = NEW.suppression_request_id
         )
         AND (
           (previous.event_type = 'submitted'
            AND NEW.event_type IN ('under_review', 'withdrawn'))
           OR (previous.event_type = 'under_review'
               AND NEW.event_type IN ('approved', 'rejected', 'withdrawn'))
           OR (previous.event_type = 'approved'
               AND NEW.event_type IN ('executed', 'withdrawn'))
         )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_suppression_event_transition_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_snapshot_status_events_state_machine
BEFORE INSERT ON zukan_snapshot_status_events
WHEN (
    NEW.governance_event_id IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM zukan_snapshot_status_events
         WHERE projection_snapshot_id = NEW.projection_snapshot_id
      )
      OR NEW.reproducibility_status IS NOT (
        SELECT reproducibility_at_issue
          FROM zukan_projection_snapshots
         WHERE projection_snapshot_id = NEW.projection_snapshot_id
      )
      OR json_array_length(NEW.affected_entry_keys_json) <> 0
    )
  )
  OR julianday(NEW.recorded_at) IS NULL
  OR EXISTS (
    SELECT 1 FROM zukan_projection_snapshots AS snapshot
     WHERE snapshot.projection_snapshot_id = NEW.projection_snapshot_id
       AND julianday(NEW.recorded_at) < julianday(snapshot.issued_at)
  )
  OR EXISTS (
    SELECT 1 FROM zukan_snapshot_status_events AS existing
     WHERE existing.projection_snapshot_id = NEW.projection_snapshot_id
       AND julianday(existing.recorded_at) >= julianday(NEW.recorded_at)
  )
  OR (
    NEW.governance_event_id IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
      FROM zukan_projection_snapshots AS snapshot
      JOIN zukan_content_governance_events AS governance
        ON governance.governance_event_id = NEW.governance_event_id
     WHERE snapshot.projection_snapshot_id = NEW.projection_snapshot_id
       AND julianday(NEW.recorded_at) >= julianday(governance.recorded_at)
       AND julianday(NEW.recorded_at) >= julianday(governance.effective_at)
       AND (
         (COALESCE((
            SELECT previous.reproducibility_status
              FROM zukan_snapshot_status_events AS previous
             WHERE previous.projection_snapshot_id = NEW.projection_snapshot_id
             ORDER BY previous.recorded_at DESC
             LIMIT 1
          ), snapshot.reproducibility_at_issue) = 'full'
          AND NEW.reproducibility_status IN ('redacted', 'degraded'))
         OR (
           COALESCE((
             SELECT previous.reproducibility_status
               FROM zukan_snapshot_status_events AS previous
              WHERE previous.projection_snapshot_id = NEW.projection_snapshot_id
              ORDER BY previous.recorded_at DESC
              LIMIT 1
           ), snapshot.reproducibility_at_issue) = 'redacted'
           AND NEW.reproducibility_status = 'degraded'
         )
       )
       AND (
         (governance.action IN ('suppress', 'redact')
          AND NEW.reproducibility_status IN ('redacted', 'degraded'))
         OR (governance.action = 'erase'
             AND NEW.reproducibility_status = 'degraded')
       )
       AND (
         (governance.target_kind = 'projection_snapshot'
          AND governance.target_id = NEW.projection_snapshot_id)
         OR (
           governance.target_kind = 'claim_revision'
           AND EXISTS (
             SELECT 1 FROM zukan_projection_entries AS entry
              WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
                AND entry.claim_revision_id = governance.target_id
           )
         )
         OR (
           governance.target_kind = 'value_artifact'
           AND EXISTS (
             SELECT 1
               FROM zukan_projection_entries AS entry
               LEFT JOIN zukan_claim_revisions AS revision
                 ON revision.claim_revision_id = entry.claim_revision_id
              WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
                AND (
                  entry.value_artifact_id = governance.target_id
                  OR revision.value_artifact_id = governance.target_id
                )
           )
         )
         OR (
           governance.target_kind = 'content_object'
           AND EXISTS (
             WITH RECURSIVE closure(content_object_id) AS (
               SELECT governance.target_id
               UNION ALL
               SELECT child.content_object_id
                 FROM zukan_content_objects AS child
                 JOIN closure
                   ON child.parent_content_object_id = closure.content_object_id
             )
             SELECT 1
               FROM zukan_projection_entries AS entry
               JOIN zukan_value_artifacts AS artifact
                 ON artifact.artifact_id = entry.value_artifact_id
               JOIN closure ON closure.content_object_id = artifact.content_object_id
              WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
           )
         )
       )
       AND json_type(NEW.affected_entry_keys_json) = 'array'
       AND NOT EXISTS (
         SELECT 1
           FROM json_each(NEW.affected_entry_keys_json) AS affected
          WHERE affected.type <> 'text'
             OR NOT EXISTS (
               SELECT 1 FROM zukan_projection_entries AS entry
                WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
                  AND entry.entry_key = affected.value
             )
       )
       AND NOT EXISTS (
         SELECT 1
           FROM zukan_projection_entries AS entry
          WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
            AND (
              governance.target_kind = 'projection_snapshot'
              OR (
                governance.target_kind = 'claim_revision'
                AND entry.claim_revision_id = governance.target_id
              )
              OR (
                governance.target_kind = 'value_artifact'
                AND (
                  entry.value_artifact_id = governance.target_id
                  OR EXISTS (
                    SELECT 1 FROM zukan_claim_revisions AS revision
                     WHERE revision.claim_revision_id = entry.claim_revision_id
                       AND revision.value_artifact_id = governance.target_id
                  )
                )
              )
              OR (
               governance.target_kind = 'content_object'
               AND EXISTS (
                  WITH RECURSIVE closure(content_object_id) AS (
                    SELECT governance.target_id
                    UNION ALL
                    SELECT child.content_object_id
                      FROM zukan_content_objects AS child
                      JOIN closure
                        ON child.parent_content_object_id = closure.content_object_id
                  )
                  SELECT 1
                    FROM zukan_value_artifacts AS artifact
                    JOIN closure ON closure.content_object_id = artifact.content_object_id
                   WHERE artifact.artifact_id = entry.value_artifact_id
                )
              )
            )
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.affected_entry_keys_json)
               WHERE value = entry.entry_key
            )
       )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_snapshot_status_transition_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_publication_availability_events_state_machine
BEFORE INSERT ON zukan_publication_availability_events
WHEN (
    NEW.governance_event_id IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM zukan_publication_availability_events
         WHERE publication_edition_id = NEW.publication_edition_id
      )
      OR NEW.availability_status <> 'available'
    )
  )
  OR julianday(NEW.recorded_at) IS NULL
  OR julianday(NEW.effective_at) IS NULL
  OR EXISTS (
    SELECT 1 FROM zukan_publication_editions AS publication
     WHERE publication.publication_edition_id = NEW.publication_edition_id
       AND (
         julianday(NEW.recorded_at) < julianday(publication.created_at)
         OR julianday(NEW.effective_at) < julianday(publication.issued_at)
       )
  )
  OR EXISTS (
    SELECT 1 FROM zukan_publication_availability_events AS existing
     WHERE existing.publication_edition_id = NEW.publication_edition_id
       AND julianday(existing.recorded_at) >= julianday(NEW.recorded_at)
  )
  OR (
    NEW.governance_event_id IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
      FROM zukan_publication_editions AS publication
      JOIN zukan_projection_snapshots AS snapshot
        ON snapshot.projection_snapshot_id = publication.projection_snapshot_id
      JOIN zukan_content_governance_events AS governance
        ON governance.governance_event_id = NEW.governance_event_id
     WHERE publication.publication_edition_id = NEW.publication_edition_id
       AND julianday(NEW.recorded_at) >= julianday(governance.recorded_at)
       AND julianday(NEW.effective_at) >= julianday(governance.effective_at)
       AND (
         (
           COALESCE((
             SELECT previous.availability_status
               FROM zukan_publication_availability_events AS previous
              WHERE previous.publication_edition_id = NEW.publication_edition_id
              ORDER BY previous.recorded_at DESC
              LIMIT 1
           ), 'available') = 'available'
           AND NEW.availability_status IN ('suppressed', 'withdrawn')
         )
         OR (
           COALESCE((
             SELECT previous.availability_status
               FROM zukan_publication_availability_events AS previous
              WHERE previous.publication_edition_id = NEW.publication_edition_id
              ORDER BY previous.recorded_at DESC
              LIMIT 1
           ), 'available') = 'suppressed'
           AND NEW.availability_status = 'withdrawn'
         )
       )
       AND (
         (governance.action IN ('suppress', 'redact')
          AND NEW.availability_status IN ('suppressed', 'withdrawn'))
         OR (governance.action = 'erase'
             AND NEW.availability_status = 'withdrawn')
       )
       AND (
         (governance.target_kind = 'publication_edition'
          AND governance.target_id = NEW.publication_edition_id)
         OR (governance.target_kind = 'projection_snapshot'
             AND governance.target_id = snapshot.projection_snapshot_id)
         OR (
           governance.target_kind IN ('claim_revision', 'value_artifact', 'content_object')
           AND EXISTS (
             SELECT 1
               FROM zukan_projection_entries AS entry
               LEFT JOIN zukan_value_artifacts AS artifact
                 ON artifact.artifact_id = entry.value_artifact_id
              WHERE entry.projection_snapshot_id = snapshot.projection_snapshot_id
                AND (
                  (governance.target_kind = 'claim_revision'
                   AND entry.claim_revision_id = governance.target_id)
                  OR (governance.target_kind = 'value_artifact'
                      AND entry.value_artifact_id = governance.target_id)
                  OR (governance.target_kind = 'content_object'
                      AND EXISTS (
                        WITH RECURSIVE closure(content_object_id) AS (
                          SELECT governance.target_id
                          UNION ALL
                          SELECT child.content_object_id
                            FROM zukan_content_objects AS child
                            JOIN closure
                              ON child.parent_content_object_id = closure.content_object_id
                        )
                        SELECT 1 FROM closure
                         WHERE closure.content_object_id = artifact.content_object_id
                      ))
                )
           )
         )
       )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_publication_availability_transition_invalid');
END;

-- Existing append-only histories must satisfy the same deterministic state
-- machines. This also rejects same-time ties before the new triggers take over.
INSERT INTO zukan_foundation_v2_schema_assertions(assertion_key, assertion_holds)
WITH
dispute_ordered AS (
  SELECT event.*,
         ROW_NUMBER() OVER (
           PARTITION BY dispute_case_id
           ORDER BY julianday(recorded_at), dispute_case_event_id
         ) AS ordinal,
         LAG(event_type) OVER (
           PARTITION BY dispute_case_id
           ORDER BY julianday(recorded_at), dispute_case_event_id
         ) AS previous_type,
         COUNT(*) OVER (
           PARTITION BY dispute_case_id, recorded_at
         ) AS tie_count
    FROM zukan_dispute_case_events AS event
),
correction_ordered AS (
  SELECT event.*,
         ROW_NUMBER() OVER (
           PARTITION BY correction_request_id
           ORDER BY julianday(recorded_at), correction_request_event_id
         ) AS ordinal,
         LAG(event_type) OVER (
           PARTITION BY correction_request_id
           ORDER BY julianday(recorded_at), correction_request_event_id
         ) AS previous_type,
         COUNT(*) OVER (
           PARTITION BY correction_request_id, recorded_at
         ) AS tie_count
    FROM zukan_correction_request_events AS event
),
suppression_ordered AS (
  SELECT event.*,
         ROW_NUMBER() OVER (
           PARTITION BY suppression_request_id
           ORDER BY julianday(recorded_at), suppression_request_event_id
         ) AS ordinal,
         LAG(event_type) OVER (
           PARTITION BY suppression_request_id
           ORDER BY julianday(recorded_at), suppression_request_event_id
         ) AS previous_type,
         COUNT(*) OVER (
           PARTITION BY suppression_request_id, recorded_at
         ) AS tie_count
    FROM zukan_suppression_request_events AS event
),
snapshot_ordered AS (
  SELECT event.*,
         ROW_NUMBER() OVER (
           PARTITION BY projection_snapshot_id
           ORDER BY julianday(recorded_at), snapshot_status_event_id
         ) AS ordinal,
         LAG(reproducibility_status) OVER (
           PARTITION BY projection_snapshot_id
           ORDER BY julianday(recorded_at), snapshot_status_event_id
         ) AS previous_status,
         COUNT(*) OVER (
           PARTITION BY projection_snapshot_id, recorded_at
         ) AS tie_count
    FROM zukan_snapshot_status_events AS event
),
publication_ordered AS (
  SELECT event.*,
         ROW_NUMBER() OVER (
           PARTITION BY publication_edition_id
           ORDER BY julianday(recorded_at), publication_availability_event_id
         ) AS ordinal,
         LAG(availability_status) OVER (
           PARTITION BY publication_edition_id
           ORDER BY julianday(recorded_at), publication_availability_event_id
         ) AS previous_status,
         COUNT(*) OVER (
           PARTITION BY publication_edition_id, recorded_at
         ) AS tie_count
    FROM zukan_publication_availability_events AS event
),
invalid_history AS (
  SELECT 1
    FROM dispute_ordered AS event
    JOIN zukan_dispute_cases AS dispute
      ON dispute.dispute_case_id = event.dispute_case_id
   WHERE event.tie_count > 1
      OR julianday(event.recorded_at) IS NULL
      OR julianday(event.recorded_at) < julianday(dispute.opened_at)
      OR (event.ordinal = 1 AND event.event_type <> 'opened')
      OR (event.ordinal > 1 AND NOT (
        (event.previous_type IN ('opened', 'reopened')
         AND event.event_type IN ('under_review', 'resolved', 'dismissed'))
        OR (event.previous_type = 'under_review'
            AND event.event_type IN ('resolved', 'dismissed'))
        OR (event.previous_type IN ('resolved', 'dismissed')
            AND event.event_type = 'reopened')
      ))
  UNION ALL
  SELECT 1
    FROM correction_ordered AS event
    JOIN zukan_correction_requests AS request
      ON request.correction_request_id = event.correction_request_id
   WHERE event.tie_count > 1
      OR julianday(event.recorded_at) IS NULL
      OR julianday(event.recorded_at) < julianday(request.requested_at)
      OR (event.ordinal = 1 AND event.event_type <> 'submitted')
      OR (event.ordinal > 1 AND NOT (
        (event.previous_type = 'submitted'
         AND event.event_type IN ('under_review', 'withdrawn'))
        OR (event.previous_type = 'under_review'
            AND event.event_type IN (
              'accepted', 'partially_accepted', 'rejected', 'withdrawn'
            ))
      ))
  UNION ALL
  SELECT 1
    FROM suppression_ordered AS event
    JOIN zukan_suppression_requests AS request
      ON request.suppression_request_id = event.suppression_request_id
   WHERE event.tie_count > 1
      OR julianday(event.recorded_at) IS NULL
      OR julianday(event.recorded_at) < julianday(request.requested_at)
      OR (event.ordinal = 1 AND event.event_type <> 'submitted')
      OR (event.ordinal > 1 AND NOT (
        (event.previous_type = 'submitted'
         AND event.event_type IN ('under_review', 'withdrawn'))
        OR (event.previous_type = 'under_review'
            AND event.event_type IN ('approved', 'rejected', 'withdrawn'))
        OR (event.previous_type = 'approved'
            AND event.event_type IN ('executed', 'withdrawn'))
      ))
  UNION ALL
  SELECT 1
    FROM snapshot_ordered AS event
    JOIN zukan_projection_snapshots AS snapshot
      ON snapshot.projection_snapshot_id = event.projection_snapshot_id
   WHERE event.tie_count > 1
      OR julianday(event.recorded_at) IS NULL
      OR julianday(event.recorded_at) < julianday(snapshot.issued_at)
      OR (
        event.ordinal = 1
        AND NOT (
          (event.reproducibility_status = snapshot.reproducibility_at_issue
           AND event.governance_event_id IS NULL)
          OR (snapshot.reproducibility_at_issue = 'full'
              AND event.reproducibility_status IN ('redacted', 'degraded')
              AND event.governance_event_id IS NOT NULL)
          OR (snapshot.reproducibility_at_issue = 'redacted'
              AND event.reproducibility_status = 'degraded'
              AND event.governance_event_id IS NOT NULL)
        )
      )
      OR (
        event.ordinal > 1
        AND (
          event.governance_event_id IS NULL
          OR NOT (
            (event.previous_status = 'full'
             AND event.reproducibility_status IN ('redacted', 'degraded'))
            OR (event.previous_status = 'redacted'
                AND event.reproducibility_status = 'degraded')
          )
        )
      )
  UNION ALL
  SELECT 1
    FROM publication_ordered AS event
    JOIN zukan_publication_editions AS publication
      ON publication.publication_edition_id = event.publication_edition_id
   WHERE event.tie_count > 1
      OR julianday(event.recorded_at) IS NULL
      OR julianday(event.effective_at) IS NULL
      OR julianday(event.recorded_at) < julianday(publication.created_at)
      OR julianday(event.effective_at) < julianday(publication.issued_at)
      OR (
        event.ordinal = 1
        AND NOT (
          (event.availability_status = 'available'
           AND event.governance_event_id IS NULL)
          OR (event.availability_status IN ('suppressed', 'withdrawn')
              AND event.governance_event_id IS NOT NULL)
        )
      )
      OR (
        event.ordinal > 1
        AND (
          event.governance_event_id IS NULL
          OR NOT (
            (event.previous_status = 'available'
             AND event.availability_status IN ('suppressed', 'withdrawn'))
            OR (event.previous_status = 'suppressed'
                AND event.availability_status = 'withdrawn')
          )
        )
      )
)
SELECT
  '0014_append_only_event_histories_are_deterministic',
  CASE WHEN EXISTS (SELECT 1 FROM invalid_history) THEN 0 ELSE 1 END;

-- D1 legacy tables checked digest length only. Abort migration on any existing
-- non-canonical digest and reject every future non-lowercase-hex value.
INSERT INTO zukan_foundation_v2_schema_assertions(assertion_key, assertion_holds)
SELECT
  '0014_all_audit_hashes_lowercase_hex',
  CASE WHEN
    EXISTS (
      SELECT 1 FROM zukan_content_objects
       WHERE content_sha256 IS NOT NULL
         AND (length(content_sha256) <> 64 OR content_sha256 GLOB '*[^0-9a-f]*')
    )
    OR EXISTS (
      SELECT 1 FROM zukan_source_fragments
       WHERE length(fragment_hash) <> 64 OR fragment_hash GLOB '*[^0-9a-f]*'
    )
    OR EXISTS (
      SELECT 1 FROM zukan_extraction_runs
       WHERE length(input_hash) <> 64 OR input_hash GLOB '*[^0-9a-f]*'
          OR length(output_hash) <> 64 OR output_hash GLOB '*[^0-9a-f]*'
    )
    OR EXISTS (
      SELECT 1 FROM zukan_value_artifacts
       WHERE content_sha256 IS NOT NULL
         AND (length(content_sha256) <> 64 OR content_sha256 GLOB '*[^0-9a-f]*')
    )
    OR EXISTS (
      SELECT 1 FROM zukan_content_fixity_events
       WHERE length(content_sha256) <> 64 OR content_sha256 GLOB '*[^0-9a-f]*'
    )
    OR EXISTS (
      SELECT 1 FROM zukan_resolution_runs
       WHERE length(predicate_registry_snapshot_hash) <> 64
          OR predicate_registry_snapshot_hash GLOB '*[^0-9a-f]*'
          OR length(authority_snapshot_hash) <> 64
          OR authority_snapshot_hash GLOB '*[^0-9a-f]*'
          OR length(input_hash) <> 64
          OR input_hash GLOB '*[^0-9a-f]*'
          OR length(output_hash) <> 64
          OR output_hash GLOB '*[^0-9a-f]*'
    )
    OR EXISTS (
      SELECT 1 FROM zukan_projection_snapshots
       WHERE length(snapshot_hash) <> 64 OR snapshot_hash GLOB '*[^0-9a-f]*'
    )
    OR EXISTS (
      SELECT 1 FROM zukan_publication_editions
       WHERE length(manifest_hash) <> 64 OR manifest_hash GLOB '*[^0-9a-f]*'
    )
    OR EXISTS (
      SELECT 1 FROM zukan_foundation_v2_write_receipts
       WHERE length(payload_sha256) <> 64 OR payload_sha256 GLOB '*[^0-9a-f]*'
    )
  THEN 0 ELSE 1 END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_content_objects_hash_canonical
BEFORE INSERT ON zukan_content_objects
WHEN NEW.content_sha256 IS NOT NULL
 AND (
   length(NEW.content_sha256) <> 64
   OR NEW.content_sha256 GLOB '*[^0-9a-f]*'
 )
BEGIN
  SELECT RAISE(ABORT, 'zukan_audit_hash_must_be_lowercase_hex');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_source_fragments_hash_canonical
BEFORE INSERT ON zukan_source_fragments
WHEN NEW.fragment_hash IS NOT NULL
 AND (
   length(NEW.fragment_hash) <> 64
   OR NEW.fragment_hash GLOB '*[^0-9a-f]*'
 )
BEGIN
  SELECT RAISE(ABORT, 'zukan_audit_hash_must_be_lowercase_hex');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_extraction_runs_hash_canonical
BEFORE INSERT ON zukan_extraction_runs
WHEN length(NEW.input_hash) <> 64
  OR NEW.input_hash GLOB '*[^0-9a-f]*'
  OR (
    NEW.output_hash IS NOT NULL
    AND (
      length(NEW.output_hash) <> 64
      OR NEW.output_hash GLOB '*[^0-9a-f]*'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_audit_hash_must_be_lowercase_hex');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_extraction_runs_output_hash_canonical
BEFORE UPDATE ON zukan_extraction_runs
WHEN NEW.output_hash IS NOT NULL
 AND (
   length(NEW.output_hash) <> 64
   OR NEW.output_hash GLOB '*[^0-9a-f]*'
 )
BEGIN
  SELECT RAISE(ABORT, 'zukan_audit_hash_must_be_lowercase_hex');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_value_artifacts_hash_canonical
BEFORE INSERT ON zukan_value_artifacts
WHEN NEW.content_sha256 IS NOT NULL
 AND (
   length(NEW.content_sha256) <> 64
   OR NEW.content_sha256 GLOB '*[^0-9a-f]*'
 )
BEGIN
  SELECT RAISE(ABORT, 'zukan_audit_hash_must_be_lowercase_hex');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_resolution_runs_hash_canonical
BEFORE INSERT ON zukan_resolution_runs
WHEN length(NEW.predicate_registry_snapshot_hash) <> 64
  OR NEW.predicate_registry_snapshot_hash GLOB '*[^0-9a-f]*'
  OR length(NEW.authority_snapshot_hash) <> 64
  OR NEW.authority_snapshot_hash GLOB '*[^0-9a-f]*'
  OR length(NEW.input_hash) <> 64
  OR NEW.input_hash GLOB '*[^0-9a-f]*'
  OR length(NEW.output_hash) <> 64
  OR NEW.output_hash GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'zukan_audit_hash_must_be_lowercase_hex');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_projection_snapshots_hash_canonical
BEFORE INSERT ON zukan_projection_snapshots
WHEN length(NEW.snapshot_hash) <> 64
  OR NEW.snapshot_hash GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'zukan_audit_hash_must_be_lowercase_hex');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_publication_editions_hash_canonical
BEFORE INSERT ON zukan_publication_editions
WHEN length(NEW.manifest_hash) <> 64
  OR NEW.manifest_hash GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'zukan_audit_hash_must_be_lowercase_hex');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_foundation_receipts_hash_canonical
BEFORE INSERT ON zukan_foundation_v2_write_receipts
WHEN length(NEW.payload_sha256) <> 64
  OR NEW.payload_sha256 GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'zukan_audit_hash_must_be_lowercase_hex');
END;

INSERT INTO zukan_foundation_v2_schema_assertions(assertion_key, assertion_holds)
WITH RECURSIVE walk(
  origin_id, current_id, origin_edition_id, path, cycle
) AS (
  SELECT content_object_id,
         parent_content_object_id,
         source_edition_id,
         '|' || content_object_id || '|',
         0
    FROM zukan_content_objects
  UNION ALL
  SELECT walk.origin_id,
         parent.parent_content_object_id,
         walk.origin_edition_id,
         walk.path || parent.content_object_id || '|',
         instr(walk.path, '|' || parent.content_object_id || '|') > 0
    FROM walk
    JOIN zukan_content_objects AS parent
      ON parent.content_object_id = walk.current_id
   WHERE walk.current_id IS NOT NULL
     AND walk.cycle = 0
),
invalid_graph AS (
  SELECT 1 FROM walk WHERE cycle = 1
  UNION ALL
  SELECT 1
    FROM zukan_content_objects AS child
    JOIN zukan_content_objects AS parent
      ON parent.content_object_id = child.parent_content_object_id
   WHERE child.source_edition_id IS NOT NULL
     AND parent.source_edition_id IS NOT NULL
     AND child.source_edition_id IS NOT parent.source_edition_id
  UNION ALL
  SELECT 1
    FROM walk
    JOIN zukan_source_editions AS own_edition
      ON own_edition.source_edition_id = walk.origin_edition_id
    JOIN zukan_source_works AS own_work
      ON own_work.source_work_id = own_edition.source_work_id
    JOIN zukan_content_objects AS ancestor
      ON ancestor.content_object_id = walk.current_id
    JOIN zukan_source_editions AS ancestor_edition
      ON ancestor_edition.source_edition_id = ancestor.source_edition_id
    JOIN zukan_source_works AS ancestor_work
      ON ancestor_work.source_work_id = ancestor_edition.source_work_id
   WHERE own_work.tenant_id IS NOT ancestor_work.tenant_id
)
SELECT
  '0014_existing_content_graph_is_acyclic_and_scoped',
  CASE WHEN EXISTS (SELECT 1 FROM invalid_graph) THEN 0 ELSE 1 END;

-- Immutable content graphs must be acyclic and cannot cross the SourceWork
-- tenant boundary. Parents must already exist, which also rejects multi-row
-- forward-reference cycles.
CREATE TRIGGER IF NOT EXISTS trg_zukan_content_objects_graph_integrity
BEFORE INSERT ON zukan_content_objects
WHEN NEW.parent_content_object_id IS NEW.content_object_id
  OR (
    NEW.parent_content_object_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
        FROM zukan_content_objects
       WHERE content_object_id = NEW.parent_content_object_id
    )
  )
  OR (
    NEW.parent_content_object_id IS NOT NULL
    AND NEW.source_edition_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM zukan_content_objects AS parent
       WHERE parent.content_object_id = NEW.parent_content_object_id
         AND parent.source_edition_id IS NOT NULL
         AND parent.source_edition_id IS NOT NEW.source_edition_id
    )
  )
  OR (
    NEW.source_edition_id IS NOT NULL
    AND EXISTS (
      WITH RECURSIVE ancestors(content_object_id, parent_content_object_id, source_edition_id) AS (
        SELECT content_object_id, parent_content_object_id, source_edition_id
          FROM zukan_content_objects
         WHERE content_object_id = NEW.parent_content_object_id
        UNION
        SELECT parent.content_object_id, parent.parent_content_object_id, parent.source_edition_id
          FROM zukan_content_objects AS parent
          JOIN ancestors ON parent.content_object_id = ancestors.parent_content_object_id
      )
      SELECT 1
        FROM zukan_source_editions AS own_edition
        JOIN zukan_source_works AS own_work
          ON own_work.source_work_id = own_edition.source_work_id
        JOIN ancestors
        JOIN zukan_source_editions AS ancestor_edition
          ON ancestor_edition.source_edition_id = ancestors.source_edition_id
        JOIN zukan_source_works AS ancestor_work
          ON ancestor_work.source_work_id = ancestor_edition.source_work_id
       WHERE own_edition.source_edition_id = NEW.source_edition_id
         AND own_work.tenant_id IS NOT ancestor_work.tenant_id
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_content_object_graph_scope_invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_revision_evidence_scope
BEFORE INSERT ON zukan_claim_revisions
WHEN NEW.value_artifact_id IS NOT NULL
 AND EXISTS (
  WITH RECURSIVE ancestors(content_object_id, parent_content_object_id, source_edition_id) AS (
    SELECT object.content_object_id, object.parent_content_object_id, object.source_edition_id
      FROM zukan_value_artifacts AS artifact
      JOIN zukan_content_objects AS object
        ON object.content_object_id = artifact.content_object_id
     WHERE artifact.artifact_id = NEW.value_artifact_id
    UNION
    SELECT parent.content_object_id, parent.parent_content_object_id, parent.source_edition_id
      FROM zukan_content_objects AS parent
      JOIN ancestors ON parent.content_object_id = ancestors.parent_content_object_id
  )
  SELECT 1
    FROM zukan_claims AS claim
    JOIN ancestors
    JOIN zukan_source_editions AS edition
      ON edition.source_edition_id = ancestors.source_edition_id
    JOIN zukan_source_works AS work
      ON work.source_work_id = edition.source_work_id
   WHERE claim.claim_id = NEW.claim_id
     AND work.tenant_id IS NOT claim.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_revision_evidence_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_trust_anchor_evidence_scope
BEFORE INSERT ON zukan_trust_anchors
WHEN NEW.evidence_content_object_id IS NOT NULL
 AND EXISTS (
  WITH RECURSIVE ancestors(content_object_id, parent_content_object_id, source_edition_id) AS (
    SELECT content_object_id, parent_content_object_id, source_edition_id
      FROM zukan_content_objects
     WHERE content_object_id = NEW.evidence_content_object_id
    UNION
    SELECT parent.content_object_id, parent.parent_content_object_id, parent.source_edition_id
      FROM zukan_content_objects AS parent
      JOIN ancestors ON parent.content_object_id = ancestors.parent_content_object_id
  )
  SELECT 1
    FROM ancestors
    JOIN zukan_source_editions AS edition
      ON edition.source_edition_id = ancestors.source_edition_id
    JOIN zukan_source_works AS work
      ON work.source_work_id = edition.source_work_id
   WHERE work.tenant_id IS NOT NEW.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_trust_anchor_evidence_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_detection_evidence_scope
BEFORE INSERT ON zukan_detection_outcomes
WHEN NEW.evidence_content_object_id IS NOT NULL
 AND EXISTS (
  WITH RECURSIVE ancestors(content_object_id, parent_content_object_id, source_edition_id) AS (
    SELECT content_object_id, parent_content_object_id, source_edition_id
      FROM zukan_content_objects
     WHERE content_object_id = NEW.evidence_content_object_id
    UNION
    SELECT parent.content_object_id, parent.parent_content_object_id, parent.source_edition_id
      FROM zukan_content_objects AS parent
      JOIN ancestors ON parent.content_object_id = ancestors.parent_content_object_id
  )
  SELECT 1
    FROM zukan_survey_events AS survey
    JOIN ancestors
    JOIN zukan_source_editions AS edition
      ON edition.source_edition_id = ancestors.source_edition_id
    JOIN zukan_source_works AS work
      ON work.source_work_id = edition.source_work_id
   WHERE survey.survey_event_id = NEW.survey_event_id
     AND work.tenant_id IS NOT survey.tenant_id
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_detection_evidence_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_public_identifiers_target_valid
BEFORE INSERT ON zukan_public_identifiers
WHEN substr(NEW.identifier_uri, 1, 8) <> 'https://'
  OR length(NEW.identifier_uri) <= 8
  OR (
    NEW.retired_at IS NOT NULL
    AND (
      julianday(NEW.retired_at) IS NULL
      OR julianday(NEW.retired_at) < julianday(NEW.created_at)
    )
  )
  OR (
    NEW.target_kind = 'subject_identity'
    AND NOT EXISTS (
      SELECT 1 FROM zukan_subject_identities WHERE subject_id = NEW.target_id
    )
  )
  OR (
    NEW.target_kind = 'source_work'
    AND NOT EXISTS (
      SELECT 1 FROM zukan_source_works WHERE source_work_id = NEW.target_id
    )
  )
  OR (
    NEW.target_kind = 'source_edition'
    AND NOT EXISTS (
      SELECT 1 FROM zukan_source_editions WHERE source_edition_id = NEW.target_id
    )
  )
  OR (
    NEW.target_kind = 'content_object'
    AND NOT EXISTS (
      SELECT 1 FROM zukan_content_objects WHERE content_object_id = NEW.target_id
    )
  )
  OR (
    NEW.target_kind = 'publication_edition'
    AND NOT EXISTS (
      SELECT 1 FROM zukan_publication_editions WHERE publication_edition_id = NEW.target_id
    )
  )
  OR NEW.target_kind = 'dataset'
  OR (
    NEW.sensitivity_status = 'normal'
    AND (
      EXISTS (
        SELECT 1
          FROM zukan_subject_identities
         WHERE NEW.target_kind = 'subject_identity'
           AND subject_id = NEW.target_id
           AND workspace_id IS NOT NULL
      )
      OR EXISTS (
        SELECT 1
          FROM zukan_publication_editions AS publication
          JOIN zukan_projection_snapshots AS snapshot
            ON snapshot.projection_snapshot_id = publication.projection_snapshot_id
          JOIN zukan_resolution_runs AS run
            ON run.resolution_run_id = snapshot.resolution_run_id
         WHERE NEW.target_kind = 'publication_edition'
           AND publication.publication_edition_id = NEW.target_id
           AND run.workspace_id IS NOT NULL
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'zukan_public_identifier_target_invalid');
END;

-- Privacy transitions require a matching governance event plus every affected
-- snapshot/publication status event to be recorded first in the transaction.
CREATE TRIGGER IF NOT EXISTS trg_zukan_value_artifacts_governance_required
BEFORE UPDATE ON zukan_value_artifacts
WHEN NEW.availability_status IN ('redacted', 'erased')
 AND NEW.availability_status IS NOT OLD.availability_status
 AND NOT EXISTS (
  SELECT 1
    FROM zukan_content_governance_events AS governance
   WHERE governance.target_kind = 'value_artifact'
     AND governance.target_id = OLD.artifact_id
     AND governance.action = CASE NEW.availability_status
       WHEN 'redacted' THEN 'redact'
       ELSE 'erase'
     END
     AND NOT EXISTS (
       SELECT 1
         FROM zukan_projection_entries AS entry
         LEFT JOIN zukan_claim_revisions AS revision
           ON revision.claim_revision_id = entry.claim_revision_id
        WHERE (
          entry.value_artifact_id = OLD.artifact_id
          OR revision.value_artifact_id = OLD.artifact_id
        )
          AND NOT EXISTS (
            SELECT 1
              FROM zukan_snapshot_status_events AS status
             WHERE status.projection_snapshot_id = entry.projection_snapshot_id
               AND status.governance_event_id = governance.governance_event_id
               AND (
                 (NEW.availability_status = 'redacted'
                  AND status.reproducibility_status IN ('redacted', 'degraded'))
                 OR (NEW.availability_status = 'erased'
                     AND status.reproducibility_status = 'degraded')
               )
               AND EXISTS (
                 SELECT 1
                   FROM json_each(status.affected_entry_keys_json)
                  WHERE value = entry.entry_key
               )
          )
     )
     AND NOT EXISTS (
       SELECT 1
         FROM zukan_projection_entries AS entry
         LEFT JOIN zukan_claim_revisions AS revision
           ON revision.claim_revision_id = entry.claim_revision_id
         JOIN zukan_publication_editions AS publication
           ON publication.projection_snapshot_id = entry.projection_snapshot_id
        WHERE (
          entry.value_artifact_id = OLD.artifact_id
          OR revision.value_artifact_id = OLD.artifact_id
        )
          AND NOT EXISTS (
            SELECT 1
              FROM zukan_publication_availability_events AS availability
             WHERE availability.publication_edition_id = publication.publication_edition_id
               AND availability.governance_event_id = governance.governance_event_id
               AND (
                 (NEW.availability_status = 'redacted'
                  AND availability.availability_status IN ('suppressed', 'withdrawn'))
                 OR (NEW.availability_status = 'erased'
                     AND availability.availability_status = 'withdrawn')
               )
          )
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_value_artifact_governance_incomplete');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_content_objects_governance_required
BEFORE UPDATE ON zukan_content_objects
WHEN NEW.availability_status IN ('redacted', 'erased')
 AND NEW.availability_status IS NOT OLD.availability_status
 AND NOT EXISTS (
  SELECT 1
    FROM zukan_content_governance_events AS governance
   WHERE governance.target_kind = 'content_object'
     AND governance.target_id = OLD.content_object_id
     AND governance.action = CASE NEW.availability_status
       WHEN 'redacted' THEN 'redact'
       ELSE 'erase'
     END
     AND NOT EXISTS (
       WITH RECURSIVE closure(content_object_id) AS (
         SELECT OLD.content_object_id
         UNION
         SELECT child.content_object_id
           FROM zukan_content_objects AS child
           JOIN closure ON child.parent_content_object_id = closure.content_object_id
       )
       SELECT 1
         FROM closure
         JOIN zukan_content_objects AS object
           ON object.content_object_id = closure.content_object_id
        WHERE object.content_object_id <> OLD.content_object_id
          AND (
            (NEW.availability_status = 'redacted'
             AND object.availability_status NOT IN ('redacted', 'erased'))
            OR (NEW.availability_status = 'erased'
                AND object.availability_status <> 'erased')
          )
     )
     AND NOT EXISTS (
       WITH RECURSIVE closure(content_object_id) AS (
         SELECT OLD.content_object_id
         UNION
         SELECT child.content_object_id
           FROM zukan_content_objects AS child
           JOIN closure ON child.parent_content_object_id = closure.content_object_id
       )
       SELECT 1
         FROM closure
         JOIN zukan_value_artifacts AS artifact
           ON artifact.content_object_id = closure.content_object_id
        WHERE (
          (NEW.availability_status = 'redacted'
           AND artifact.availability_status NOT IN ('redacted', 'erased'))
          OR (NEW.availability_status = 'erased'
              AND artifact.availability_status <> 'erased')
        )
     )
     AND NOT EXISTS (
       WITH RECURSIVE closure(content_object_id) AS (
         SELECT OLD.content_object_id
         UNION
         SELECT child.content_object_id
           FROM zukan_content_objects AS child
           JOIN closure ON child.parent_content_object_id = closure.content_object_id
       )
       SELECT 1
         FROM closure
         JOIN zukan_value_artifacts AS artifact
           ON artifact.content_object_id = closure.content_object_id
         JOIN zukan_projection_entries AS entry
           ON entry.value_artifact_id = artifact.artifact_id
        WHERE NOT EXISTS (
          SELECT 1
            FROM zukan_snapshot_status_events AS status
           WHERE status.projection_snapshot_id = entry.projection_snapshot_id
             AND status.governance_event_id = governance.governance_event_id
             AND (
               (NEW.availability_status = 'redacted'
                AND status.reproducibility_status IN ('redacted', 'degraded'))
               OR (NEW.availability_status = 'erased'
                   AND status.reproducibility_status = 'degraded')
             )
             AND EXISTS (
               SELECT 1
                 FROM json_each(status.affected_entry_keys_json)
                WHERE value = entry.entry_key
             )
        )
     )
     AND NOT EXISTS (
       WITH RECURSIVE closure(content_object_id) AS (
         SELECT OLD.content_object_id
         UNION
         SELECT child.content_object_id
           FROM zukan_content_objects AS child
           JOIN closure ON child.parent_content_object_id = closure.content_object_id
       )
       SELECT 1
         FROM closure
         JOIN zukan_value_artifacts AS artifact
           ON artifact.content_object_id = closure.content_object_id
         JOIN zukan_projection_entries AS entry
           ON entry.value_artifact_id = artifact.artifact_id
         JOIN zukan_publication_editions AS publication
           ON publication.projection_snapshot_id = entry.projection_snapshot_id
        WHERE NOT EXISTS (
          SELECT 1
            FROM zukan_publication_availability_events AS availability
           WHERE availability.publication_edition_id = publication.publication_edition_id
             AND availability.governance_event_id = governance.governance_event_id
             AND (
               (NEW.availability_status = 'redacted'
                AND availability.availability_status IN ('suppressed', 'withdrawn'))
               OR (NEW.availability_status = 'erased'
                   AND availability.availability_status = 'withdrawn')
             )
        )
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_content_object_governance_incomplete');
END;

-- Publication is the public trust boundary. It accepts only a resolved,
-- tenant-global run whose entries are public, accepted, rights-cleared and not
-- subject to an open dispute/correction/suppression workflow.
CREATE UNIQUE INDEX IF NOT EXISTS idx_zukan_publication_editions_key_label_unique
  ON zukan_publication_editions(publication_key, edition_label);

CREATE TRIGGER IF NOT EXISTS trg_zukan_publication_editions_public_gate
BEFORE INSERT ON zukan_publication_editions
WHEN julianday(NEW.issued_at) IS NULL
 OR NOT EXISTS (
  SELECT 1
    FROM zukan_projection_snapshots AS snapshot
    JOIN zukan_resolution_runs AS run
      ON run.resolution_run_id = snapshot.resolution_run_id
   WHERE snapshot.projection_snapshot_id = NEW.projection_snapshot_id
     AND run.run_status = 'resolved'
     AND run.workspace_id IS NULL
     AND snapshot.reproducibility_at_issue = 'full'
     AND julianday(snapshot.issued_at) IS NOT NULL
     AND julianday(NEW.issued_at) >= julianday(snapshot.issued_at)
     AND NOT EXISTS (
       SELECT 1
         FROM zukan_snapshot_status_events AS status
        WHERE status.projection_snapshot_id = snapshot.projection_snapshot_id
          AND (
            status.governance_event_id IS NOT NULL
            OR status.reproducibility_status <> 'full'
          )
     )
     AND EXISTS (
       SELECT 1
         FROM zukan_projection_entries
        WHERE projection_snapshot_id = snapshot.projection_snapshot_id
     )
     AND NOT EXISTS (
       SELECT 1
         FROM zukan_projection_entries AS entry
         LEFT JOIN zukan_claim_revisions AS revision
           ON revision.claim_revision_id = entry.claim_revision_id
         LEFT JOIN zukan_claims AS claim
           ON claim.claim_id = revision.claim_id
         LEFT JOIN zukan_value_artifacts AS artifact
           ON artifact.artifact_id = entry.value_artifact_id
        WHERE entry.projection_snapshot_id = snapshot.projection_snapshot_id
          AND (
            revision.claim_revision_id IS NULL
            OR artifact.artifact_id IS NULL
            OR revision.value_artifact_id IS NOT artifact.artifact_id
            OR claim.tenant_id IS NOT run.tenant_id
            OR claim.workspace_id IS NOT NULL
            OR revision.visibility <> 'public'
            OR artifact.availability_status <> 'available'
            OR (
              artifact.content_object_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                  FROM zukan_content_objects AS object
                 WHERE object.content_object_id = artifact.content_object_id
                   AND object.availability_status = 'available'
              )
            )
            OR NOT EXISTS (
              SELECT 1
                FROM zukan_resolution_run_claims AS run_claim
               WHERE run_claim.resolution_run_id = run.resolution_run_id
                 AND run_claim.claim_revision_id = revision.claim_revision_id
                 AND run_claim.decision = 'accepted'
            )
            OR NOT EXISTS (
              SELECT 1
                FROM zukan_rights_evaluations AS rights
               WHERE rights.value_artifact_id = artifact.artifact_id
                 AND rights.content_object_id IS NULL
                 AND rights.purpose = 'publication'
                  AND rights.basis = 'allowed'
                  AND (
                    rights.basis_review_due IS NULL
                    OR (
                      julianday(rights.basis_review_due) IS NOT NULL
                      AND julianday(rights.basis_review_due) > julianday(NEW.issued_at)
                    )
                  )
                 AND (rights.valid_from IS NULL
                      OR (julianday(rights.valid_from) IS NOT NULL
                          AND julianday(rights.valid_from) <= julianday(NEW.issued_at)))
                 AND (rights.valid_to IS NULL
                      OR (julianday(rights.valid_to) IS NOT NULL
                          AND julianday(rights.valid_to) > julianday(NEW.issued_at)))
            )
            OR EXISTS (
              SELECT 1
                FROM zukan_rights_evaluations AS rights
               WHERE rights.value_artifact_id = artifact.artifact_id
                 AND rights.purpose = 'publication'
                 AND rights.basis IN ('denied', 'unknown')
                 AND (rights.valid_from IS NULL
                      OR julianday(rights.valid_from) <= julianday(NEW.issued_at))
                 AND (rights.valid_to IS NULL
                      OR julianday(rights.valid_to) > julianday(NEW.issued_at))
            )
            OR (
              artifact.content_object_id IS NOT NULL
              AND (
                NOT EXISTS (
                  SELECT 1
                    FROM zukan_rights_evaluations AS rights
                   WHERE rights.content_object_id = artifact.content_object_id
                     AND rights.value_artifact_id IS NULL
                     AND rights.purpose = 'publication'
                      AND rights.basis = 'allowed'
                      AND (
                        rights.basis_review_due IS NULL
                        OR (
                          julianday(rights.basis_review_due) IS NOT NULL
                          AND julianday(rights.basis_review_due) > julianday(NEW.issued_at)
                        )
                      )
                     AND (rights.valid_from IS NULL
                          OR julianday(rights.valid_from) <= julianday(NEW.issued_at))
                     AND (rights.valid_to IS NULL
                          OR julianday(rights.valid_to) > julianday(NEW.issued_at))
                )
                OR EXISTS (
                  SELECT 1
                    FROM zukan_rights_evaluations AS rights
                   WHERE rights.content_object_id = artifact.content_object_id
                     AND rights.purpose = 'publication'
                     AND rights.basis IN ('denied', 'unknown')
                     AND (rights.valid_from IS NULL
                          OR julianday(rights.valid_from) <= julianday(NEW.issued_at))
                     AND (rights.valid_to IS NULL
                          OR julianday(rights.valid_to) > julianday(NEW.issued_at))
                )
              )
            )
          )
     )
     AND NOT EXISTS (
       SELECT 1
         FROM zukan_content_governance_events AS governance
        WHERE governance.action IN ('suppress', 'redact', 'erase')
          AND (
            (governance.target_kind = 'projection_snapshot'
             AND governance.target_id = snapshot.projection_snapshot_id)
            OR (governance.target_kind = 'claim_revision'
                AND governance.target_id IN (
                  SELECT claim_revision_id
                    FROM zukan_projection_entries
                   WHERE projection_snapshot_id = snapshot.projection_snapshot_id
                ))
            OR (governance.target_kind = 'value_artifact'
                AND governance.target_id IN (
                  SELECT value_artifact_id
                    FROM zukan_projection_entries
                   WHERE projection_snapshot_id = snapshot.projection_snapshot_id
                ))
            OR (
              governance.target_kind = 'content_object'
              AND EXISTS (
                WITH RECURSIVE closure(content_object_id) AS (
                  SELECT governance.target_id
                  UNION ALL
                  SELECT child.content_object_id
                    FROM zukan_content_objects AS child
                    JOIN closure
                      ON child.parent_content_object_id = closure.content_object_id
                )
                SELECT 1
                  FROM zukan_projection_entries AS entry
                  JOIN zukan_value_artifacts AS artifact
                    ON artifact.artifact_id = entry.value_artifact_id
                  JOIN closure
                    ON closure.content_object_id = artifact.content_object_id
                 WHERE entry.projection_snapshot_id = snapshot.projection_snapshot_id
              )
            )
          )
     )
     AND NOT EXISTS (
       SELECT 1
         FROM zukan_projection_entries AS entry
         JOIN zukan_claim_authority_links AS authority_link
           ON authority_link.claim_revision_id = entry.claim_revision_id
         JOIN zukan_authority_revocation_events AS revocation
           ON revocation.authority_assertion_id = authority_link.authority_assertion_id
        WHERE entry.projection_snapshot_id = snapshot.projection_snapshot_id
          AND revocation.revocation_mode = 'retroactive'
          AND julianday(revocation.effective_at) IS NOT NULL
          AND julianday(revocation.effective_at) <= julianday(NEW.issued_at)
     )
     AND NOT EXISTS (
       SELECT 1
         FROM zukan_dispute_cases AS dispute
        WHERE dispute.resolution_run_id = run.resolution_run_id
          AND COALESCE((
            SELECT event.event_type
              FROM zukan_dispute_case_events AS event
             WHERE event.dispute_case_id = dispute.dispute_case_id
             ORDER BY event.recorded_at DESC, event.dispute_case_event_id DESC
             LIMIT 1
          ), 'opened') IN ('opened', 'under_review', 'reopened')
     )
     AND NOT EXISTS (
       SELECT 1
         FROM zukan_correction_requests AS correction
        WHERE (
          correction.subject_id = run.subject_id
          OR
          correction.dispute_case_id IN (
            SELECT dispute_case_id
              FROM zukan_dispute_cases
             WHERE resolution_run_id = run.resolution_run_id
          )
          OR correction.claim_revision_id IN (
            SELECT claim_revision_id
              FROM zukan_projection_entries
             WHERE projection_snapshot_id = snapshot.projection_snapshot_id
          )
        )
          AND COALESCE((
            SELECT event.event_type
              FROM zukan_correction_request_events AS event
             WHERE event.correction_request_id = correction.correction_request_id
             ORDER BY event.recorded_at DESC, event.correction_request_event_id DESC
             LIMIT 1
          ), 'submitted') NOT IN ('rejected', 'withdrawn')
     )
     AND NOT EXISTS (
       SELECT 1
         FROM zukan_suppression_requests AS request
        WHERE (
          (request.target_kind = 'publication_edition'
           AND request.target_id = NEW.publication_edition_id)
          OR (request.target_kind = 'projection_snapshot'
              AND request.target_id = snapshot.projection_snapshot_id)
          OR (request.target_kind = 'claim_revision'
              AND request.target_id IN (
                SELECT claim_revision_id
                  FROM zukan_projection_entries
                 WHERE projection_snapshot_id = snapshot.projection_snapshot_id
              ))
          OR (request.target_kind = 'value_artifact'
              AND request.target_id IN (
                SELECT value_artifact_id
                  FROM zukan_projection_entries
                 WHERE projection_snapshot_id = snapshot.projection_snapshot_id
              ))
          OR (request.target_kind = 'content_object'
              AND request.target_id IN (
                SELECT artifact.content_object_id
                  FROM zukan_projection_entries AS entry
                  JOIN zukan_value_artifacts AS artifact
                    ON artifact.artifact_id = entry.value_artifact_id
                 WHERE entry.projection_snapshot_id = snapshot.projection_snapshot_id
              ))
        )
          AND COALESCE((
            SELECT event.event_type
              FROM zukan_suppression_request_events AS event
             WHERE event.suppression_request_id = request.suppression_request_id
             ORDER BY event.recorded_at DESC, event.suppression_request_event_id DESC
             LIMIT 1
          ), 'submitted') NOT IN ('rejected', 'withdrawn')
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_publication_edition_public_gate_failed');
END;
