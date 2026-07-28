-- ZUKAN Foundation v2 integrity hardening.
-- Additive only: applied Foundation migrations 0134-0138 remain immutable.
-- Same-URI predicate schema evolution is conservative and fail-closed:
-- schemas must remain equal. Enum expansion and other schema edits require a
-- new URI until a formally verified compatibility checker exists.

-- Tenant/workspace scope is historical identity. Metadata may be enriched,
-- and an edition lifecycle may advance, but identity edges cannot be rehomed.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM zukan_source_works AS work
          LEFT JOIN zukan_subject_identities AS publisher
            ON publisher.subject_id = work.publisher_subject_id
         WHERE work.publisher_subject_id IS NOT NULL
           AND (
             publisher.subject_id IS NULL
             OR publisher.tenant_id IS DISTINCT FROM work.tenant_id
             OR publisher.workspace_id IS NOT NULL
           )
    ) THEN
        RAISE EXCEPTION 'existing_source_work_publisher_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION zukan_guard_subject_identity_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'zukan_subject_identity_never_reused'
          USING ERRCODE = '55000';
    END IF;
    IF NEW.subject_id IS DISTINCT FROM OLD.subject_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.subject_kind IS DISTINCT FROM OLD.subject_kind
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'zukan_subject_identity_scope_immutable'
          USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_subject_identities_scope_immutable
  ON zukan_subject_identities;
CREATE TRIGGER trg_zukan_subject_identities_scope_immutable
BEFORE UPDATE OR DELETE ON zukan_subject_identities
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_subject_identity_scope();

CREATE OR REPLACE FUNCTION zukan_validate_source_work_publisher_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.publisher_subject_id IS NOT NULL
       AND NOT EXISTS (
        SELECT 1
          FROM zukan_subject_identities AS publisher
         WHERE publisher.subject_id = NEW.publisher_subject_id
           AND publisher.tenant_id = NEW.tenant_id
           AND publisher.workspace_id IS NULL
    ) THEN
        RAISE EXCEPTION 'zukan_source_work_publisher_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_source_works_publisher_scope
  ON zukan_source_works;
CREATE TRIGGER trg_zukan_source_works_publisher_scope
BEFORE INSERT ON zukan_source_works
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_source_work_publisher_scope();

CREATE OR REPLACE FUNCTION zukan_guard_source_work_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       OR NEW.source_work_id IS DISTINCT FROM OLD.source_work_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.work_kind IS DISTINCT FROM OLD.work_kind
       OR NEW.publisher_subject_id IS DISTINCT FROM OLD.publisher_subject_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'zukan_source_work_identity_immutable'
          USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_source_works_identity_immutable
  ON zukan_source_works;
CREATE TRIGGER trg_zukan_source_works_identity_immutable
BEFORE UPDATE OR DELETE ON zukan_source_works
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_source_work_identity();

CREATE OR REPLACE FUNCTION zukan_guard_source_edition_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       OR NEW.source_edition_id IS DISTINCT FROM OLD.source_edition_id
       OR NEW.source_work_id IS DISTINCT FROM OLD.source_work_id
       OR NEW.edition_label IS DISTINCT FROM OLD.edition_label
       OR NEW.language_tag IS DISTINCT FROM OLD.language_tag
       OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
       OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
       OR NEW.valid_to IS DISTINCT FROM OLD.valid_to
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'zukan_source_edition_identity_immutable'
          USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_source_editions_identity_immutable
  ON zukan_source_editions;
CREATE TRIGGER trg_zukan_source_editions_identity_immutable
BEFORE UPDATE OR DELETE ON zukan_source_editions
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_source_edition_identity();

CREATE OR REPLACE FUNCTION zukan_guard_source_edition_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (OLD.lifecycle_status = 'retired' AND NEW.lifecycle_status <> 'retired')
       OR (
         OLD.lifecycle_status = 'superseded'
         AND NEW.lifecycle_status = 'active'
       ) THEN
        RAISE EXCEPTION 'zukan_source_edition_lifecycle_irreversible'
          USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_source_editions_lifecycle_monotonic
  ON zukan_source_editions;
CREATE TRIGGER trg_zukan_source_editions_lifecycle_monotonic
BEFORE UPDATE ON zukan_source_editions
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_source_edition_lifecycle();

CREATE OR REPLACE FUNCTION zukan_validate_predicate_revision_compatibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    previous zukan_predicate_definitions%ROWTYPE;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.predicate_uri, 0));

    SELECT *
      INTO previous
      FROM zukan_predicate_definitions
     WHERE predicate_uri = NEW.predicate_uri
     ORDER BY predicate_version DESC
     LIMIT 1;

    IF NOT FOUND AND NEW.predicate_version <> 1 THEN
        RAISE EXCEPTION 'zukan_predicate_first_version_must_be_one'
          USING ERRCODE = '23514';
    END IF;

    IF FOUND AND (
        NEW.predicate_version <> previous.predicate_version + 1
        OR NEW.value_type <> previous.value_type
        OR NEW.value_schema IS DISTINCT FROM previous.value_schema
        OR NEW.polarity_mode <> previous.polarity_mode
        OR NEW.temporal_profile <> previous.temporal_profile
        OR (previous.cardinality = 'many' AND NEW.cardinality = 'one')
    ) THEN
        RAISE EXCEPTION 'zukan_predicate_revision_breaking_change_requires_new_uri'
          USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_predicate_definitions_compatible_insert
  ON zukan_predicate_definitions;
CREATE TRIGGER trg_zukan_predicate_definitions_compatible_insert
BEFORE INSERT ON zukan_predicate_definitions
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_predicate_revision_compatibility();

CREATE OR REPLACE FUNCTION zukan_validate_claim_subject_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM zukan_subject_identities AS subject
         WHERE subject.subject_id = NEW.subject_id
           AND subject.tenant_id = NEW.tenant_id
           AND subject.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
    ) THEN
        RAISE EXCEPTION 'zukan_claim_subject_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_claims_subject_scope ON zukan_claims;
CREATE TRIGGER trg_zukan_claims_subject_scope
BEFORE INSERT ON zukan_claims
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_claim_subject_scope();

DROP TRIGGER IF EXISTS trg_zukan_claims_no_update ON zukan_claims;
CREATE TRIGGER trg_zukan_claims_no_update
BEFORE UPDATE OR DELETE ON zukan_claims
FOR EACH ROW
EXECUTE FUNCTION zukan_reject_row_mutation();

CREATE OR REPLACE FUNCTION zukan_validate_resolution_run_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    current_watermark BIGINT;
BEGIN
    -- Identity sequences allocate before commit and may contain an in-flight
    -- gap below a visible MAX(). SHARE waits for every RowExclusive claim
    -- append, then blocks new appends until this run and its watermark commit.
    LOCK TABLE zukan_claim_revisions IN SHARE MODE;

    IF NOT EXISTS (
        SELECT 1
          FROM zukan_subject_identities AS subject
         WHERE subject.subject_id = NEW.subject_id
           AND subject.tenant_id = NEW.tenant_id
           AND subject.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
    ) THEN
        RAISE EXCEPTION 'zukan_resolution_run_subject_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(MAX(recorded_sequence), 0)
      INTO current_watermark
      FROM zukan_claim_revisions;
    IF NEW.claim_store_sequence_watermark > current_watermark THEN
        RAISE EXCEPTION 'zukan_resolution_run_watermark_is_future'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_resolution_runs_scope ON zukan_resolution_runs;
CREATE TRIGGER trg_zukan_resolution_runs_scope
BEFORE INSERT ON zukan_resolution_runs
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_resolution_run_scope();

CREATE OR REPLACE FUNCTION zukan_validate_resolution_run_claim_watermark()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
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
           AND revision.recorded_at <= run.recorded_time_watermark
           AND claim.tenant_id = run.tenant_id
           AND claim.workspace_id IS NOT DISTINCT FROM run.workspace_id
           AND claim.subject_id = run.subject_id
           AND subject.tenant_id = run.tenant_id
           AND subject.workspace_id IS NOT DISTINCT FROM run.workspace_id
           AND revision.predicate_uri = run.predicate_uri
           AND revision.predicate_version = run.predicate_version
           AND NOT EXISTS (
               SELECT 1
                 FROM zukan_claim_revisions AS later_revision
                WHERE later_revision.claim_id = revision.claim_id
                  AND later_revision.revision > revision.revision
                  AND later_revision.recorded_sequence <= run.claim_store_sequence_watermark
                  AND later_revision.recorded_at <= run.recorded_time_watermark
           )
    ) THEN
        RAISE EXCEPTION 'zukan_resolution_run_claim_exceeds_watermark'
          USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_resolution_run_claims_watermark
  ON zukan_resolution_run_claims;
CREATE TRIGGER trg_zukan_resolution_run_claims_watermark
BEFORE INSERT ON zukan_resolution_run_claims
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_resolution_run_claim_watermark();

-- Seal each aggregate once a downstream immutable artifact references it.
-- Both the child-insert and seal-insert paths lock the same parent row. This
-- closes the READ COMMITTED write-skew window where each transaction could
-- otherwise miss the other transaction's uncommitted row.
CREATE OR REPLACE FUNCTION zukan_guard_resolution_run_claim_aggregate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1
      FROM zukan_resolution_runs
     WHERE resolution_run_id = NEW.resolution_run_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'zukan_resolution_run_claim_parent_missing'
          USING ERRCODE = '23503';
    END IF;

    -- ClaimAuthorityLink INSERT locks this same immutable revision row before
    -- checking for run membership, sealing the authority set without write-skew.
    PERFORM 1
      FROM zukan_claim_revisions
     WHERE claim_revision_id = NEW.claim_revision_id
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'zukan_resolution_run_claim_revision_missing'
          USING ERRCODE = '23503';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM zukan_projection_snapshots
         WHERE resolution_run_id = NEW.resolution_run_id
    ) THEN
        RAISE EXCEPTION 'zukan_resolution_run_claims_sealed_by_snapshot'
          USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_resolution_run_claims_aggregate_open
  ON zukan_resolution_run_claims;
CREATE TRIGGER trg_zukan_resolution_run_claims_aggregate_open
BEFORE INSERT ON zukan_resolution_run_claims
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_resolution_run_claim_aggregate();

CREATE OR REPLACE FUNCTION zukan_lock_resolution_run_for_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1
      FROM zukan_resolution_runs
     WHERE resolution_run_id = NEW.resolution_run_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'zukan_projection_snapshot_resolution_run_missing'
          USING ERRCODE = '23503';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_projection_snapshots_lock_resolution_run
  ON zukan_projection_snapshots;
CREATE TRIGGER trg_zukan_projection_snapshots_lock_resolution_run
BEFORE INSERT ON zukan_projection_snapshots
FOR EACH ROW
EXECUTE FUNCTION zukan_lock_resolution_run_for_snapshot();

CREATE OR REPLACE FUNCTION zukan_guard_projection_entry_aggregate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1
      FROM zukan_projection_snapshots
     WHERE projection_snapshot_id = NEW.projection_snapshot_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'zukan_projection_entry_snapshot_missing'
          USING ERRCODE = '23503';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM zukan_publication_editions
         WHERE projection_snapshot_id = NEW.projection_snapshot_id
    ) THEN
        RAISE EXCEPTION 'zukan_projection_entries_sealed_by_publication'
          USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_projection_entries_aggregate_open
  ON zukan_projection_entries;
CREATE TRIGGER trg_zukan_projection_entries_aggregate_open
BEFORE INSERT ON zukan_projection_entries
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_projection_entry_aggregate();

CREATE OR REPLACE FUNCTION zukan_lock_projection_snapshot_for_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1
      FROM zukan_projection_snapshots
     WHERE projection_snapshot_id = NEW.projection_snapshot_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'zukan_publication_edition_snapshot_missing'
          USING ERRCODE = '23503';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_publication_editions_lock_snapshot
  ON zukan_publication_editions;
CREATE TRIGGER trg_zukan_publication_editions_lock_snapshot
BEFORE INSERT ON zukan_publication_editions
FOR EACH ROW
EXECUTE FUNCTION zukan_lock_projection_snapshot_for_publication();

CREATE TABLE IF NOT EXISTS zukan_content_fixity_events (
    fixity_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_object_id UUID NOT NULL
        REFERENCES zukan_content_objects(content_object_id) ON DELETE RESTRICT,
    content_sha256 TEXT NOT NULL,
    verification_status TEXT NOT NULL,
    verifier TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
    CHECK (verification_status IN ('verified', 'failed')),
    CHECK (length(trim(verifier)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_content_fixity_events_object
  ON zukan_content_fixity_events(content_object_id, verified_at DESC);

DROP TRIGGER IF EXISTS trg_zukan_content_fixity_events_no_update
  ON zukan_content_fixity_events;
CREATE TRIGGER trg_zukan_content_fixity_events_no_update
BEFORE UPDATE OR DELETE ON zukan_content_fixity_events
FOR EACH ROW
EXECUTE FUNCTION zukan_reject_row_mutation();

CREATE OR REPLACE FUNCTION zukan_validate_content_fixity_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM zukan_content_objects AS object
         WHERE object.content_object_id = NEW.content_object_id
           AND object.content_sha256 = NEW.content_sha256
    ) THEN
        RAISE EXCEPTION 'zukan_content_fixity_digest_must_match_object'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_content_fixity_events_match_object
  ON zukan_content_fixity_events;
CREATE TRIGGER trg_zukan_content_fixity_events_match_object
BEFORE INSERT ON zukan_content_fixity_events
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_content_fixity_event();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM zukan_content_objects
         WHERE object_kind = 'source_object'
           AND availability_status = 'available'
    ) THEN
        RAISE EXCEPTION 'existing_available_source_object_requires_fixity_migration'
          USING ERRCODE = '23514';
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM zukan_content_objects
         WHERE availability_status = 'suppressed'
        UNION ALL
        SELECT 1
          FROM zukan_value_artifacts
         WHERE availability_status = 'suppressed'
    ) THEN
        RAISE EXCEPTION 'existing_suppressed_rows_require_event_migration'
          USING ERRCODE = '23514';
    END IF;
END;
$$;

-- D1 already enforces one row per non-null digest. Match that contract so the
-- dialect-neutral repository cannot accept a duplicate only in PostgreSQL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_zukan_content_objects_digest_unique
  ON zukan_content_objects(content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE OR REPLACE FUNCTION zukan_guard_content_object_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'zukan_content_objects_immutable'
          USING ERRCODE = '55000';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.availability_status = 'suppressed' THEN
            RAISE EXCEPTION 'zukan_content_object_suppression_uses_events'
              USING ERRCODE = '23514';
        END IF;
        IF NEW.object_kind = 'source_object'
           AND (
             NEW.availability_status <> 'missing'
             OR NEW.content_sha256 IS NULL
           ) THEN
            RAISE EXCEPTION 'zukan_source_object_must_stage_missing_with_sha256'
              USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.content_object_id IS DISTINCT FROM OLD.content_object_id
       OR NEW.source_edition_id IS DISTINCT FROM OLD.source_edition_id
       OR NEW.parent_content_object_id IS DISTINCT FROM OLD.parent_content_object_id
       OR NEW.object_kind IS DISTINCT FROM OLD.object_kind
       OR NEW.derivation_kind IS DISTINCT FROM OLD.derivation_kind
       OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.byte_length IS DISTINCT FROM OLD.byte_length
       OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR (
         NEW.storage_locator IS DISTINCT FROM OLD.storage_locator
         AND NOT (
           NEW.storage_locator IS NULL
           AND NEW.availability_status IN ('redacted', 'erased')
         )
       ) THEN
        RAISE EXCEPTION 'zukan_content_object_byte_identity_immutable'
          USING ERRCODE = '55000';
    END IF;

    IF (OLD.availability_status = 'erased' AND NEW.availability_status <> 'erased')
       OR OLD.availability_status = 'suppressed'
       OR NEW.availability_status = 'suppressed'
       OR (
         OLD.availability_status = 'redacted'
         AND NEW.availability_status NOT IN ('redacted', 'erased')
       )
       OR (
         NEW.availability_status IN ('redacted', 'erased')
         AND NEW.storage_locator IS NOT NULL
       ) THEN
        RAISE EXCEPTION 'zukan_content_object_lifecycle_invalid'
          USING ERRCODE = '55000';
    END IF;

    IF NEW.object_kind = 'source_object'
       AND NEW.availability_status = 'available'
       AND OLD.availability_status <> 'available'
       AND NOT EXISTS (
         SELECT 1
           FROM zukan_content_fixity_events AS fixity
          WHERE fixity.content_object_id = NEW.content_object_id
            AND fixity.content_sha256 = NEW.content_sha256
            AND fixity.verification_status = 'verified'
       ) THEN
        RAISE EXCEPTION 'zukan_available_source_object_requires_verified_fixity'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_content_objects_no_update ON zukan_content_objects;
DROP TRIGGER IF EXISTS trg_zukan_content_objects_require_fixity ON zukan_content_objects;
DROP TRIGGER IF EXISTS trg_zukan_content_objects_lifecycle ON zukan_content_objects;
CREATE TRIGGER trg_zukan_content_objects_lifecycle
BEFORE INSERT OR UPDATE OR DELETE ON zukan_content_objects
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_content_object_lifecycle();

CREATE OR REPLACE FUNCTION zukan_guard_public_identifier_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'zukan_public_identifier_uri_never_reused'
          USING ERRCODE = '55000';
    END IF;

    IF NEW.public_identifier_id IS DISTINCT FROM OLD.public_identifier_id
       OR NEW.identifier_uri IS DISTINCT FROM OLD.identifier_uri
       OR NEW.target_kind IS DISTINCT FROM OLD.target_kind
       OR NEW.target_id IS DISTINCT FROM OLD.target_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'zukan_public_identifier_identity_immutable'
          USING ERRCODE = '55000';
    END IF;

    IF (
         OLD.sensitivity_status = 'restricted'
         AND NEW.sensitivity_status <> 'restricted'
       )
       OR (
         OLD.sensitivity_status = 'existence_sensitive'
         AND NEW.sensitivity_status <> 'existence_sensitive'
       )
       OR (
         OLD.retired_at IS NOT NULL
         AND NEW.retired_at IS DISTINCT FROM OLD.retired_at
       ) THEN
        RAISE EXCEPTION 'zukan_public_identifier_privacy_irreversible'
          USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_public_identifiers_identity_immutable
  ON zukan_public_identifiers;
CREATE TRIGGER trg_zukan_public_identifiers_identity_immutable
BEFORE UPDATE OR DELETE ON zukan_public_identifiers
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_public_identifier_identity();

-- A ValueArtifact is historical value identity. Its payload cannot be edited
-- in place after a ClaimRevision or ProjectionEntry references it. The only
-- mutation is a one-way privacy transition that clears every recoverable value
-- field while preserving the stable artifact/content-object identity.
-- owner-sensitive-ok: migration role owns the Foundation tables; rollback drops only this named constraint.
ALTER TABLE zukan_value_artifacts
  ADD CONSTRAINT zukan_value_artifacts_empty_tombstone
  CHECK (
    (
      availability_status NOT IN ('redacted', 'erased')
      AND redacted_at IS NULL
    )
    OR (
      availability_status IN ('redacted', 'erased')
      AND value_json IS NULL
      AND value_text IS NULL
      AND content_sha256 IS NULL
      AND storage_locator IS NULL
      AND redacted_at IS NOT NULL
      AND redacted_at >= created_at
    )
  ) NOT VALID;
ALTER TABLE zukan_value_artifacts
  VALIDATE CONSTRAINT zukan_value_artifacts_empty_tombstone;

CREATE OR REPLACE FUNCTION zukan_guard_value_artifact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'zukan_value_artifact_immutable'
          USING ERRCODE = '55000';
    END IF;

    IF NEW.artifact_id IS DISTINCT FROM OLD.artifact_id
       OR NEW.content_object_id IS DISTINCT FROM OLD.content_object_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'zukan_value_artifact_identity_immutable'
          USING ERRCODE = '55000';
    END IF;

    IF OLD.availability_status = 'available'
       AND NEW.availability_status IN ('redacted', 'erased')
       AND NEW.value_json IS NULL
       AND NEW.value_text IS NULL
       AND NEW.content_sha256 IS NULL
       AND NEW.storage_locator IS NULL
       AND OLD.redacted_at IS NULL
       AND NEW.redacted_at IS NOT NULL
       AND NEW.redacted_at >= OLD.created_at THEN
        RETURN NEW;
    END IF;

    IF OLD.availability_status = 'redacted'
       AND NEW.availability_status = 'erased'
       AND NEW.value_json IS NULL
       AND NEW.value_text IS NULL
       AND NEW.content_sha256 IS NULL
       AND NEW.storage_locator IS NULL
       AND NEW.redacted_at IS NOT DISTINCT FROM OLD.redacted_at THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'zukan_value_artifact_mutation_not_allowed'
      USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_value_artifacts_tombstone_irreversible
  ON zukan_value_artifacts;
DROP TRIGGER IF EXISTS trg_zukan_value_artifacts_mutation_guard
  ON zukan_value_artifacts;
CREATE TRIGGER trg_zukan_value_artifacts_mutation_guard
BEFORE UPDATE OR DELETE ON zukan_value_artifacts
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_value_artifact_mutation();

CREATE OR REPLACE FUNCTION zukan_reject_value_artifact_suppressed_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.availability_status = 'suppressed' THEN
        RAISE EXCEPTION 'zukan_value_artifact_suppression_uses_events'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_value_artifacts_suppression_uses_events
  ON zukan_value_artifacts;
CREATE TRIGGER trg_zukan_value_artifacts_suppression_uses_events
BEFORE INSERT ON zukan_value_artifacts
FOR EACH ROW
EXECUTE FUNCTION zukan_reject_value_artifact_suppressed_row();

CREATE TABLE IF NOT EXISTS zukan_foundation_v2_write_receipts (
    idempotency_key TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_sha256 TEXT NOT NULL,
    attempt_token UUID NOT NULL,
    outcome TEXT NOT NULL DEFAULT 'pending',
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CHECK (operation = 'source_registry_import_v1'),
    CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    CHECK (outcome IN ('pending', 'succeeded'))
);

CREATE OR REPLACE FUNCTION zukan_guard_foundation_write_receipt()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       OR OLD.outcome <> 'pending'
       OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.operation IS DISTINCT FROM OLD.operation
       OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256
       OR NEW.attempt_token IS DISTINCT FROM OLD.attempt_token
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'zukan_foundation_write_receipt_immutable'
          USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_foundation_write_receipts_guard
  ON zukan_foundation_v2_write_receipts;
CREATE TRIGGER trg_zukan_foundation_write_receipts_guard
BEFORE UPDATE OR DELETE ON zukan_foundation_v2_write_receipts
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_foundation_write_receipt();

-- Provenance rows are immutable. ExtractionRun has one narrowly-scoped
-- running-to-terminal completion update.
DROP TRIGGER IF EXISTS trg_zukan_source_fragments_no_update
  ON zukan_source_fragments;
CREATE TRIGGER trg_zukan_source_fragments_no_update
BEFORE UPDATE OR DELETE ON zukan_source_fragments
FOR EACH ROW
EXECUTE FUNCTION zukan_reject_row_mutation();

CREATE OR REPLACE FUNCTION zukan_validate_extraction_run_initial_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (NEW.run_status = 'running'
        AND (NEW.finished_at IS NOT NULL OR NEW.output_hash IS NOT NULL))
       OR (
         NEW.run_status IN ('succeeded', 'partial', 'failed')
         AND (
           NEW.finished_at IS NULL
           OR NEW.finished_at < NEW.started_at
           OR (
             NEW.run_status IN ('succeeded', 'partial')
             AND NEW.output_hash IS NULL
           )
         )
       ) THEN
        RAISE EXCEPTION 'zukan_extraction_run_initial_state_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_extraction_runs_initial_state
  ON zukan_extraction_runs;
CREATE TRIGGER trg_zukan_extraction_runs_initial_state
BEFORE INSERT ON zukan_extraction_runs
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_extraction_run_initial_state();

CREATE OR REPLACE FUNCTION zukan_guard_extraction_run_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       OR OLD.run_status <> 'running'
       OR NEW.run_status NOT IN ('succeeded', 'partial', 'failed')
       OR NEW.extraction_run_id IS DISTINCT FROM OLD.extraction_run_id
       OR NEW.input_content_object_id IS DISTINCT FROM OLD.input_content_object_id
       OR NEW.extractor_kind IS DISTINCT FROM OLD.extractor_kind
       OR NEW.extractor_version IS DISTINCT FROM OLD.extractor_version
       OR NEW.model_name IS DISTINCT FROM OLD.model_name
       OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
       OR NEW.code_version IS DISTINCT FROM OLD.code_version
       OR NEW.input_hash IS DISTINCT FROM OLD.input_hash
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
       OR NEW.finished_at IS NULL
       OR NEW.finished_at < OLD.started_at
       OR (
         NEW.run_status IN ('succeeded', 'partial')
         AND NEW.output_hash IS NULL
       ) THEN
        RAISE EXCEPTION 'zukan_extraction_run_transition_invalid'
          USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_extraction_runs_complete_once
  ON zukan_extraction_runs;
CREATE TRIGGER trg_zukan_extraction_runs_complete_once
BEFORE UPDATE OR DELETE ON zukan_extraction_runs
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_extraction_run_completion();

-- Identity-resolution state closes monotonically.
CREATE OR REPLACE FUNCTION zukan_guard_identity_resolution_set()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       OR NEW.resolution_set_id IS DISTINCT FROM OLD.resolution_set_id
       OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NOT (
         NEW.resolution_status = OLD.resolution_status
         OR (OLD.resolution_status = 'active'
             AND NEW.resolution_status IN ('superseded', 'retired'))
         OR (OLD.resolution_status = 'superseded'
             AND NEW.resolution_status = 'retired')
       )
       OR NOT (
         NEW.valid_to IS NOT DISTINCT FROM OLD.valid_to
         OR (OLD.valid_to IS NULL AND NEW.valid_to IS NOT NULL)
       ) THEN
        RAISE EXCEPTION 'zukan_identity_resolution_set_transition_invalid'
          USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_identity_resolution_sets_monotonic
  ON zukan_identity_resolution_sets;
CREATE TRIGGER trg_zukan_identity_resolution_sets_monotonic
BEFORE UPDATE OR DELETE ON zukan_identity_resolution_sets
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_identity_resolution_set();

CREATE OR REPLACE FUNCTION zukan_guard_identity_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       OR NEW.membership_assertion_id IS DISTINCT FROM OLD.membership_assertion_id
       OR NEW.resolution_set_id IS DISTINCT FROM OLD.resolution_set_id
       OR NEW.subject_id IS DISTINCT FROM OLD.subject_id
       OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
       OR NEW.confidence IS DISTINCT FROM OLD.confidence
       OR NEW.evidence IS DISTINCT FROM OLD.evidence
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NOT (
         NEW.membership_state = OLD.membership_state
         OR (OLD.membership_state = 'candidate'
             AND NEW.membership_state IN ('exact', 'rejected'))
       )
       OR NOT (
         NEW.valid_to IS NOT DISTINCT FROM OLD.valid_to
         OR (OLD.valid_to IS NULL AND NEW.valid_to IS NOT NULL)
       ) THEN
        RAISE EXCEPTION 'zukan_identity_membership_transition_invalid'
          USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_identity_memberships_monotonic
  ON zukan_identity_membership_assertions;
CREATE TRIGGER trg_zukan_identity_memberships_monotonic
BEFORE UPDATE OR DELETE ON zukan_identity_membership_assertions
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_identity_membership();

CREATE OR REPLACE FUNCTION zukan_validate_identity_membership_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    new_subject zukan_subject_identities%ROWTYPE;
BEGIN
    PERFORM 1
      FROM zukan_identity_resolution_sets
     WHERE resolution_set_id = NEW.resolution_set_id
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'zukan_identity_resolution_set_missing'
          USING ERRCODE = '23503';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM zukan_canonical_identity_assertions
         WHERE resolution_set_id = NEW.resolution_set_id
    ) THEN
        RAISE EXCEPTION 'zukan_identity_membership_set_sealed'
          USING ERRCODE = '55000';
    END IF;

    SELECT * INTO new_subject
      FROM zukan_subject_identities
     WHERE subject_id = NEW.subject_id;
    IF NOT FOUND OR EXISTS (
        SELECT 1
          FROM zukan_identity_membership_assertions AS membership
          JOIN zukan_subject_identities AS existing_subject
            ON existing_subject.subject_id = membership.subject_id
         WHERE membership.resolution_set_id = NEW.resolution_set_id
           AND (
             existing_subject.tenant_id IS DISTINCT FROM new_subject.tenant_id
             OR existing_subject.workspace_id IS DISTINCT FROM new_subject.workspace_id
           )
    ) THEN
        RAISE EXCEPTION 'zukan_identity_membership_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_identity_memberships_scope_and_seal
  ON zukan_identity_membership_assertions;
CREATE TRIGGER trg_zukan_identity_memberships_scope_and_seal
BEFORE INSERT ON zukan_identity_membership_assertions
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_identity_membership_scope();

CREATE OR REPLACE FUNCTION zukan_guard_canonical_identity_assertion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       OR NEW.canonical_assertion_id IS DISTINCT FROM OLD.canonical_assertion_id
       OR NEW.public_identifier_id IS DISTINCT FROM OLD.public_identifier_id
       OR NEW.assertion_mode IS DISTINCT FROM OLD.assertion_mode
       OR NEW.resolution_set_id IS DISTINCT FROM OLD.resolution_set_id
       OR NEW.successor_public_identifier_id IS DISTINCT FROM OLD.successor_public_identifier_id
       OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NOT (
         NEW.valid_to IS NOT DISTINCT FROM OLD.valid_to
         OR (OLD.valid_to IS NULL AND NEW.valid_to IS NOT NULL)
       ) THEN
        RAISE EXCEPTION 'zukan_canonical_identity_assertion_immutable'
          USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_canonical_assertions_close_only
  ON zukan_canonical_identity_assertions;
CREATE TRIGGER trg_zukan_canonical_assertions_close_only
BEFORE UPDATE OR DELETE ON zukan_canonical_identity_assertions
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_canonical_identity_assertion();

CREATE OR REPLACE FUNCTION zukan_validate_canonical_identity_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.resolution_set_id IS NOT NULL THEN
        PERFORM 1
          FROM zukan_identity_resolution_sets
         WHERE resolution_set_id = NEW.resolution_set_id
           FOR UPDATE;
    END IF;

    IF NEW.assertion_mode IN ('resolved', 'ambiguous') AND NOT EXISTS (
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
                  member.tenant_id IS DISTINCT FROM target.tenant_id
                  OR member.workspace_id IS DISTINCT FROM target.workspace_id
                )
           )
    ) THEN
        RAISE EXCEPTION 'zukan_canonical_identity_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;

    IF NEW.assertion_mode = 'redirect' AND NOT EXISTS (
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
           AND source_subject.tenant_id = successor_subject.tenant_id
           AND source_subject.workspace_id IS NOT DISTINCT FROM successor_subject.workspace_id
    ) THEN
        RAISE EXCEPTION 'zukan_canonical_identity_redirect_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_canonical_assertions_scope
  ON zukan_canonical_identity_assertions;
CREATE TRIGGER trg_zukan_canonical_assertions_scope
BEFORE INSERT ON zukan_canonical_identity_assertions
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_canonical_identity_scope();

CREATE OR REPLACE FUNCTION zukan_validate_canonical_candidate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1
      FROM zukan_canonical_identity_assertions
     WHERE canonical_assertion_id = NEW.canonical_assertion_id
       FOR UPDATE;

    IF NOT FOUND OR NOT EXISTS (
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
           AND target.tenant_id = candidate.tenant_id
           AND target.workspace_id IS NOT DISTINCT FROM candidate.workspace_id
    ) THEN
        RAISE EXCEPTION 'zukan_canonical_identity_candidate_scope_or_seal_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_canonical_candidates_scope
  ON zukan_canonical_identity_candidates;
CREATE TRIGGER trg_zukan_canonical_candidates_scope
BEFORE INSERT ON zukan_canonical_identity_candidates
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_canonical_candidate();

DROP TRIGGER IF EXISTS trg_zukan_canonical_candidates_no_update
  ON zukan_canonical_identity_candidates;
CREATE TRIGGER trg_zukan_canonical_candidates_no_update
BEFORE UPDATE OR DELETE ON zukan_canonical_identity_candidates
FOR EACH ROW
EXECUTE FUNCTION zukan_reject_row_mutation();

-- Strengthen the existing ClaimRevision append trigger with scope and direct
-- predecessor semantics. Legacy private/internal spellings remain non-public;
-- only visibility='public' can pass the publication gate.
CREATE OR REPLACE FUNCTION zukan_validate_claim_revision_append()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_claim zukan_claims%ROWTYPE;
    expected_revision INTEGER;
    previous_revision_id UUID;
BEGIN
    SELECT * INTO parent_claim
      FROM zukan_claims
     WHERE claim_id = NEW.claim_id
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'claim_not_found' USING ERRCODE = '23503';
    END IF;

    IF NEW.predicate_uri <> parent_claim.predicate_uri
       OR NEW.predicate_version <> parent_claim.predicate_version THEN
        RAISE EXCEPTION 'claim_predicate_mismatch' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(MAX(revision), 0) + 1 INTO expected_revision
      FROM zukan_claim_revisions
     WHERE claim_id = NEW.claim_id;
    IF NEW.revision <> expected_revision THEN
        RAISE EXCEPTION 'zukan_claim_revision_must_append_expected_%', expected_revision
          USING ERRCODE = '23514';
    END IF;

    SELECT claim_revision_id INTO previous_revision_id
      FROM zukan_claim_revisions
     WHERE claim_id = NEW.claim_id
       AND revision = NEW.revision - 1;
    IF (NEW.revision = 1 AND NEW.supersedes_claim_revision_id IS NOT NULL)
       OR (NEW.revision > 1
           AND NEW.supersedes_claim_revision_id IS DISTINCT FROM previous_revision_id) THEN
        RAISE EXCEPTION 'zukan_claim_revision_supersedes_must_be_direct_previous'
          USING ERRCODE = '23514';
    END IF;

    IF NEW.asserted_by_subject_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM zukan_subject_identities AS asserted_by
         WHERE asserted_by.subject_id = NEW.asserted_by_subject_id
           AND asserted_by.tenant_id = parent_claim.tenant_id
           AND (
             asserted_by.workspace_id IS NULL
             OR asserted_by.workspace_id IS NOT DISTINCT FROM parent_claim.workspace_id
           )
    ) THEN
        RAISE EXCEPTION 'zukan_claim_revision_asserted_by_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;

    IF parent_claim.workspace_id IS NOT NULL
       AND NEW.visibility IN ('public', 'public_candidate') THEN
        RAISE EXCEPTION 'zukan_workspace_claim_cannot_be_public'
          USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

-- Trust and authority facts are immutable; revocation uses the event table.
DROP TRIGGER IF EXISTS trg_zukan_trust_anchors_no_update
  ON zukan_trust_anchors;
CREATE TRIGGER trg_zukan_trust_anchors_no_update
BEFORE UPDATE OR DELETE ON zukan_trust_anchors
FOR EACH ROW
EXECUTE FUNCTION zukan_reject_row_mutation();

CREATE OR REPLACE FUNCTION zukan_validate_trust_anchor_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.anchor_subject_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM zukan_subject_identities AS subject
         WHERE subject.subject_id = NEW.anchor_subject_id
           AND subject.tenant_id = NEW.tenant_id
           AND subject.workspace_id IS NULL
    ) THEN
        RAISE EXCEPTION 'zukan_trust_anchor_subject_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_trust_anchors_scope
  ON zukan_trust_anchors;
CREATE TRIGGER trg_zukan_trust_anchors_scope
BEFORE INSERT ON zukan_trust_anchors
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_trust_anchor_scope();

CREATE OR REPLACE FUNCTION zukan_validate_authority_assertion_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM zukan_trust_anchors AS anchor
          JOIN zukan_subject_identities AS authority
            ON authority.subject_id = NEW.authority_subject_id
         WHERE anchor.trust_anchor_id = NEW.trust_anchor_id
           AND anchor.tenant_id = authority.tenant_id
    ) THEN
        RAISE EXCEPTION 'zukan_authority_assertion_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_authority_assertions_scope
  ON zukan_authority_assertions;
CREATE TRIGGER trg_zukan_authority_assertions_scope
BEFORE INSERT ON zukan_authority_assertions
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_authority_assertion_scope();

DROP TRIGGER IF EXISTS trg_zukan_authority_assertions_no_update
  ON zukan_authority_assertions;
CREATE TRIGGER trg_zukan_authority_assertions_no_update
BEFORE UPDATE OR DELETE ON zukan_authority_assertions
FOR EACH ROW
EXECUTE FUNCTION zukan_reject_row_mutation();

CREATE OR REPLACE FUNCTION zukan_validate_claim_authority_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1
      FROM zukan_claim_revisions
     WHERE claim_revision_id = NEW.claim_revision_id
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'zukan_claim_authority_claim_revision_missing'
          USING ERRCODE = '23503';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM zukan_resolution_run_claims
         WHERE claim_revision_id = NEW.claim_revision_id
    ) OR NOT EXISTS (
        SELECT 1
          FROM zukan_claim_revisions AS revision
          JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
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
             OR authority.workspace_id IS NOT DISTINCT FROM claim.workspace_id
           )
           AND (
             assertion.predicate_uri IS NULL
             OR (
               assertion.predicate_uri = revision.predicate_uri
               AND assertion.predicate_version = revision.predicate_version
             )
           )
    ) THEN
        RAISE EXCEPTION 'zukan_claim_authority_link_scope_or_seal_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_claim_authority_links_scope_and_seal
  ON zukan_claim_authority_links;
CREATE TRIGGER trg_zukan_claim_authority_links_scope_and_seal
BEFORE INSERT ON zukan_claim_authority_links
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_claim_authority_link();

DROP TRIGGER IF EXISTS trg_zukan_claim_authority_links_no_update
  ON zukan_claim_authority_links;
CREATE TRIGGER trg_zukan_claim_authority_links_no_update
BEFORE UPDATE OR DELETE ON zukan_claim_authority_links
FOR EACH ROW
EXECUTE FUNCTION zukan_reject_row_mutation();

CREATE OR REPLACE FUNCTION zukan_validate_projection_entry_semantic_edge()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.claim_revision_id IS NULL
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
           AND claim.workspace_id IS NOT DISTINCT FROM run.workspace_id
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
       ) THEN
        RAISE EXCEPTION 'zukan_projection_entry_semantic_edge_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_projection_entries_semantic_edge
  ON zukan_projection_entries;
CREATE TRIGGER trg_zukan_projection_entries_semantic_edge
BEFORE INSERT ON zukan_projection_entries
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_projection_entry_semantic_edge();

CREATE OR REPLACE FUNCTION zukan_guard_survey_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE'
       OR NEW.survey_event_id IS DISTINCT FROM OLD.survey_event_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.subject_scope IS DISTINCT FROM OLD.subject_scope
       OR NEW.method IS DISTINCT FROM OLD.method
       OR NEW.effort IS DISTINCT FROM OLD.effort
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR OLD.ended_at IS NOT NULL
       OR NEW.ended_at IS NULL
       OR NEW.ended_at < OLD.started_at THEN
        RAISE EXCEPTION 'zukan_survey_event_transition_invalid'
          USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_survey_events_complete_once
  ON zukan_survey_events;
CREATE TRIGGER trg_zukan_survey_events_complete_once
BEFORE UPDATE OR DELETE ON zukan_survey_events
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_survey_event();

CREATE OR REPLACE FUNCTION zukan_validate_detection_outcome_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM zukan_survey_events AS survey
          JOIN zukan_subject_identities AS subject
            ON subject.subject_id = NEW.subject_id
         WHERE survey.survey_event_id = NEW.survey_event_id
           AND survey.tenant_id = subject.tenant_id
           AND survey.workspace_id IS NOT DISTINCT FROM subject.workspace_id
           AND NEW.recorded_at >= survey.started_at
           AND (
             NEW.outcome <> 'not_detected'
             OR (
               survey.ended_at IS NOT NULL
               AND NEW.recorded_at >= survey.ended_at
             )
           )
    ) THEN
        RAISE EXCEPTION 'zukan_detection_outcome_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_detection_outcomes_scope
  ON zukan_detection_outcomes;
CREATE TRIGGER trg_zukan_detection_outcomes_scope
BEFORE INSERT ON zukan_detection_outcomes
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_detection_outcome_scope();

-- Cross-entity semantic edge guards.
CREATE OR REPLACE FUNCTION zukan_validate_rights_inheritance_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Serialize rights decisions for the same publication target.  Without
    -- this lock concurrent allowed/denied inserts can both miss the other's
    -- uncommitted row and violate the overlap invariant.
    IF NEW.content_object_id IS NOT NULL THEN
        PERFORM 1
          FROM zukan_content_objects
         WHERE content_object_id = NEW.content_object_id
         FOR UPDATE;
    ELSE
        PERFORM 1
          FROM zukan_value_artifacts
         WHERE artifact_id = NEW.value_artifact_id
         FOR UPDATE;
    END IF;
    IF NEW.inherited_from_rights_evaluation_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM zukan_rights_evaluations AS parent
         WHERE parent.rights_evaluation_id = NEW.inherited_from_rights_evaluation_id
           AND parent.rights_evaluation_id <> NEW.rights_evaluation_id
           AND parent.purpose = NEW.purpose
           AND parent.basis = NEW.basis
           AND (
             parent.valid_from IS NULL
             OR (NEW.valid_from IS NOT NULL AND NEW.valid_from >= parent.valid_from)
           )
           AND (
             parent.valid_to IS NULL
             OR (NEW.valid_to IS NOT NULL AND NEW.valid_to <= parent.valid_to)
           )
           AND (
             parent.basis_review_due IS NULL
             OR (
               NEW.basis_review_due IS NOT NULL
               AND NEW.basis_review_due <= parent.basis_review_due
             )
           )
           AND (
             (
               parent.content_object_id IS NOT DISTINCT FROM NEW.content_object_id
               AND parent.value_artifact_id IS NOT DISTINCT FROM NEW.value_artifact_id
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
    ) THEN
        RAISE EXCEPTION 'zukan_rights_inheritance_scope_or_validity_mismatch'
          USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1
          FROM zukan_rights_evaluations AS existing
         WHERE existing.purpose = NEW.purpose
           AND existing.content_object_id IS NOT DISTINCT FROM NEW.content_object_id
           AND existing.value_artifact_id IS NOT DISTINCT FROM NEW.value_artifact_id
           AND existing.basis <> NEW.basis
           AND (
             existing.valid_to IS NULL
             OR NEW.valid_from IS NULL
             OR existing.valid_to > NEW.valid_from
           )
           AND (
             NEW.valid_to IS NULL
             OR existing.valid_from IS NULL
             OR NEW.valid_to > existing.valid_from
           )
    ) THEN
        RAISE EXCEPTION 'zukan_rights_interval_conflict'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_rights_evaluations_inheritance_scope
  ON zukan_rights_evaluations;
CREATE TRIGGER trg_zukan_rights_evaluations_inheritance_scope
BEFORE INSERT ON zukan_rights_evaluations
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_rights_inheritance_scope();

CREATE OR REPLACE FUNCTION zukan_validate_dispute_case_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.resolution_run_id IS NOT NULL THEN
        PERFORM 1
          FROM zukan_resolution_runs
         WHERE resolution_run_id = NEW.resolution_run_id
         FOR UPDATE;
    END IF;
    IF NEW.resolution_run_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM zukan_resolution_runs AS run
         WHERE run.resolution_run_id = NEW.resolution_run_id
           AND run.subject_id = NEW.subject_id
           AND run.predicate_uri = NEW.predicate_uri
           AND run.predicate_version = NEW.predicate_version
    ) THEN
        RAISE EXCEPTION 'zukan_dispute_case_resolution_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_dispute_cases_resolution_scope
  ON zukan_dispute_cases;
CREATE TRIGGER trg_zukan_dispute_cases_resolution_scope
BEFORE INSERT ON zukan_dispute_cases
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_dispute_case_scope();

CREATE OR REPLACE FUNCTION zukan_validate_correction_request_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1
      FROM zukan_subject_identities
     WHERE subject_id = NEW.subject_id
     FOR UPDATE;
    IF (NEW.claim_revision_id IS NOT NULL AND NOT EXISTS (
          SELECT 1
            FROM zukan_claim_revisions AS revision
            JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
           WHERE revision.claim_revision_id = NEW.claim_revision_id
             AND claim.subject_id = NEW.subject_id
       ))
       OR (NEW.dispute_case_id IS NOT NULL AND NOT EXISTS (
          SELECT 1
            FROM zukan_dispute_cases AS dispute
           WHERE dispute.dispute_case_id = NEW.dispute_case_id
              AND dispute.subject_id = NEW.subject_id
       ))
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
              AND requester.workspace_id IS NOT DISTINCT FROM target.workspace_id
         )
       ) THEN
        RAISE EXCEPTION 'zukan_correction_request_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_correction_requests_claim_scope
  ON zukan_correction_requests;
CREATE TRIGGER trg_zukan_correction_requests_claim_scope
BEFORE INSERT ON zukan_correction_requests
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_correction_request_scope();

CREATE OR REPLACE FUNCTION zukan_validate_suppression_governance_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (NEW.event_type = 'executed' AND NEW.governance_event_id IS NULL)
       OR (NEW.governance_event_id IS NOT NULL AND NOT EXISTS (
         SELECT 1
           FROM zukan_suppression_requests AS request
           JOIN zukan_content_governance_events AS governance
             ON governance.governance_event_id = NEW.governance_event_id
          WHERE request.suppression_request_id = NEW.suppression_request_id
            AND governance.target_kind = request.target_kind
            AND governance.target_id = request.target_id
            AND governance.action = request.requested_action
       )) THEN
        RAISE EXCEPTION 'zukan_suppression_governance_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_suppression_events_governance_scope
  ON zukan_suppression_request_events;
CREATE TRIGGER trg_zukan_suppression_events_governance_scope
BEFORE INSERT ON zukan_suppression_request_events
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_suppression_governance_scope();

CREATE OR REPLACE FUNCTION zukan_governance_target_exists(
    p_target_kind TEXT,
    p_target_id UUID
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT CASE p_target_kind
      WHEN 'content_object' THEN EXISTS (
        SELECT 1 FROM zukan_content_objects
         WHERE content_object_id = p_target_id
      )
      WHEN 'value_artifact' THEN EXISTS (
        SELECT 1 FROM zukan_value_artifacts
         WHERE artifact_id = p_target_id
      )
      WHEN 'claim_revision' THEN EXISTS (
        SELECT 1 FROM zukan_claim_revisions
         WHERE claim_revision_id = p_target_id
      )
      WHEN 'projection_snapshot' THEN EXISTS (
        SELECT 1 FROM zukan_projection_snapshots
         WHERE projection_snapshot_id = p_target_id
      )
      WHEN 'publication_edition' THEN EXISTS (
        SELECT 1 FROM zukan_publication_editions
         WHERE publication_edition_id = p_target_id
      )
      ELSE false
    END
$$;

CREATE OR REPLACE FUNCTION zukan_governance_target_scopes(
    p_target_kind TEXT,
    p_target_id UUID
)
RETURNS TABLE(target_tenant_id TEXT, target_workspace_id TEXT)
LANGUAGE sql
STABLE
AS $$
    SELECT claim.tenant_id, claim.workspace_id
      FROM zukan_claim_revisions AS revision
      JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
     WHERE p_target_kind = 'claim_revision'
       AND revision.claim_revision_id = p_target_id
    UNION
    SELECT claim.tenant_id, claim.workspace_id
      FROM zukan_value_artifacts AS artifact
      JOIN zukan_claim_revisions AS revision
        ON revision.value_artifact_id = artifact.artifact_id
      JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
     WHERE p_target_kind = 'value_artifact'
       AND artifact.artifact_id = p_target_id
    UNION
    SELECT work.tenant_id, NULL::TEXT
      FROM zukan_content_objects AS object
      JOIN zukan_source_editions AS edition
        ON edition.source_edition_id = object.source_edition_id
      JOIN zukan_source_works AS work ON work.source_work_id = edition.source_work_id
     WHERE p_target_kind = 'content_object'
       AND object.content_object_id = p_target_id
    UNION
    SELECT run.tenant_id, run.workspace_id
      FROM zukan_projection_snapshots AS snapshot
      JOIN zukan_resolution_runs AS run
        ON run.resolution_run_id = snapshot.resolution_run_id
     WHERE p_target_kind = 'projection_snapshot'
       AND snapshot.projection_snapshot_id = p_target_id
    UNION
    SELECT run.tenant_id, run.workspace_id
      FROM zukan_publication_editions AS publication
      JOIN zukan_projection_snapshots AS snapshot
        ON snapshot.projection_snapshot_id = publication.projection_snapshot_id
      JOIN zukan_resolution_runs AS run
        ON run.resolution_run_id = snapshot.resolution_run_id
     WHERE p_target_kind = 'publication_edition'
       AND publication.publication_edition_id = p_target_id
$$;

CREATE OR REPLACE FUNCTION zukan_validate_governance_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM snapshot.projection_snapshot_id
      FROM zukan_projection_snapshots AS snapshot
     WHERE (
       (NEW.target_kind = 'projection_snapshot'
        AND snapshot.projection_snapshot_id = NEW.target_id)
       OR (NEW.target_kind = 'publication_edition'
           AND snapshot.projection_snapshot_id IN (
             SELECT publication.projection_snapshot_id
               FROM zukan_publication_editions AS publication
              WHERE publication.publication_edition_id = NEW.target_id
           ))
       OR EXISTS (
         SELECT 1
           FROM zukan_projection_entries AS entry
           LEFT JOIN zukan_claim_revisions AS revision
             ON revision.claim_revision_id = entry.claim_revision_id
           LEFT JOIN zukan_value_artifacts AS artifact
             ON artifact.artifact_id = entry.value_artifact_id
          WHERE entry.projection_snapshot_id = snapshot.projection_snapshot_id
            AND (
              (NEW.target_kind = 'claim_revision'
               AND entry.claim_revision_id = NEW.target_id)
              OR (NEW.target_kind = 'value_artifact'
                  AND (
                    entry.value_artifact_id = NEW.target_id
                    OR revision.value_artifact_id = NEW.target_id
                  ))
              OR (NEW.target_kind = 'content_object'
                  AND artifact.content_object_id IN (
                    WITH RECURSIVE closure(content_object_id) AS (
                        SELECT NEW.target_id
                        UNION ALL
                        SELECT child.content_object_id
                          FROM zukan_content_objects AS child
                          JOIN closure
                            ON child.parent_content_object_id = closure.content_object_id
                    )
                    SELECT content_object_id FROM closure
                  ))
            )
       )
     )
     ORDER BY snapshot.projection_snapshot_id
     FOR UPDATE OF snapshot;
    IF NEW.target_kind = 'content_object' THEN
        PERFORM 1 FROM zukan_content_objects
         WHERE content_object_id = NEW.target_id FOR UPDATE;
    ELSIF NEW.target_kind = 'value_artifact' THEN
        PERFORM 1 FROM zukan_value_artifacts
         WHERE artifact_id = NEW.target_id FOR UPDATE;
    ELSIF NEW.target_kind = 'claim_revision' THEN
        PERFORM 1 FROM zukan_claim_revisions
         WHERE claim_revision_id = NEW.target_id FOR UPDATE;
    ELSIF NEW.target_kind = 'projection_snapshot' THEN
        PERFORM 1 FROM zukan_projection_snapshots
         WHERE projection_snapshot_id = NEW.target_id FOR UPDATE;
    ELSIF NEW.target_kind = 'publication_edition' THEN
        PERFORM 1 FROM zukan_publication_editions
         WHERE publication_edition_id = NEW.target_id FOR UPDATE;
    END IF;
    IF NOT zukan_governance_target_exists(NEW.target_kind, NEW.target_id) THEN
        RAISE EXCEPTION 'zukan_governance_target_invalid'
          USING ERRCODE = '23514';
    END IF;
    IF NEW.requested_by_subject_id IS NOT NULL AND (
        NOT EXISTS (
          SELECT 1 FROM zukan_governance_target_scopes(NEW.target_kind, NEW.target_id)
        )
        OR EXISTS (
          SELECT 1
            FROM zukan_governance_target_scopes(NEW.target_kind, NEW.target_id) AS scope
            JOIN zukan_subject_identities AS requester
              ON requester.subject_id = NEW.requested_by_subject_id
           WHERE requester.tenant_id <> scope.target_tenant_id
              OR requester.workspace_id IS DISTINCT FROM scope.target_workspace_id
        )
    ) THEN
        RAISE EXCEPTION 'zukan_governance_target_scope_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_governance_events_target_valid
  ON zukan_content_governance_events;
CREATE TRIGGER trg_zukan_governance_events_target_valid
BEFORE INSERT ON zukan_content_governance_events
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_governance_target();

CREATE OR REPLACE FUNCTION zukan_validate_suppression_request_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM snapshot.projection_snapshot_id
      FROM zukan_projection_snapshots AS snapshot
     WHERE (
       (NEW.target_kind = 'projection_snapshot'
        AND snapshot.projection_snapshot_id = NEW.target_id)
       OR (NEW.target_kind = 'publication_edition'
           AND snapshot.projection_snapshot_id IN (
             SELECT publication.projection_snapshot_id
               FROM zukan_publication_editions AS publication
              WHERE publication.publication_edition_id = NEW.target_id
           ))
       OR EXISTS (
         SELECT 1
           FROM zukan_projection_entries AS entry
           LEFT JOIN zukan_claim_revisions AS revision
             ON revision.claim_revision_id = entry.claim_revision_id
           LEFT JOIN zukan_value_artifacts AS artifact
             ON artifact.artifact_id = entry.value_artifact_id
          WHERE entry.projection_snapshot_id = snapshot.projection_snapshot_id
            AND (
              (NEW.target_kind = 'claim_revision'
               AND entry.claim_revision_id = NEW.target_id)
              OR (NEW.target_kind = 'value_artifact'
                  AND (
                    entry.value_artifact_id = NEW.target_id
                    OR revision.value_artifact_id = NEW.target_id
                  ))
              OR (NEW.target_kind = 'content_object'
                  AND artifact.content_object_id IN (
                    WITH RECURSIVE closure(content_object_id) AS (
                        SELECT NEW.target_id
                        UNION ALL
                        SELECT child.content_object_id
                          FROM zukan_content_objects AS child
                          JOIN closure
                            ON child.parent_content_object_id = closure.content_object_id
                    )
                    SELECT content_object_id FROM closure
                  ))
            )
       )
     )
     ORDER BY snapshot.projection_snapshot_id
     FOR UPDATE OF snapshot;
    IF NEW.target_kind = 'content_object' THEN
        PERFORM 1 FROM zukan_content_objects
         WHERE content_object_id = NEW.target_id FOR UPDATE;
    ELSIF NEW.target_kind = 'value_artifact' THEN
        PERFORM 1 FROM zukan_value_artifacts
         WHERE artifact_id = NEW.target_id FOR UPDATE;
    ELSIF NEW.target_kind = 'claim_revision' THEN
        PERFORM 1 FROM zukan_claim_revisions
         WHERE claim_revision_id = NEW.target_id FOR UPDATE;
    ELSIF NEW.target_kind = 'projection_snapshot' THEN
        PERFORM 1 FROM zukan_projection_snapshots
         WHERE projection_snapshot_id = NEW.target_id FOR UPDATE;
    ELSIF NEW.target_kind = 'publication_edition' THEN
        PERFORM 1 FROM zukan_publication_editions
         WHERE publication_edition_id = NEW.target_id FOR UPDATE;
    END IF;
    IF NOT zukan_governance_target_exists(NEW.target_kind, NEW.target_id) THEN
        RAISE EXCEPTION 'zukan_suppression_target_invalid'
          USING ERRCODE = '23514';
    END IF;
    IF NEW.requested_by_subject_id IS NOT NULL AND (
        NOT EXISTS (
          SELECT 1 FROM zukan_governance_target_scopes(NEW.target_kind, NEW.target_id)
        )
        OR EXISTS (
          SELECT 1
            FROM zukan_governance_target_scopes(NEW.target_kind, NEW.target_id) AS scope
            JOIN zukan_subject_identities AS requester
              ON requester.subject_id = NEW.requested_by_subject_id
           WHERE requester.tenant_id <> scope.target_tenant_id
              OR requester.workspace_id IS DISTINCT FROM scope.target_workspace_id
        )
    ) THEN
        RAISE EXCEPTION 'zukan_suppression_target_scope_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_suppression_requests_target_valid
  ON zukan_suppression_requests;
CREATE TRIGGER trg_zukan_suppression_requests_target_valid
BEFORE INSERT ON zukan_suppression_requests
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_suppression_request_target();

CREATE OR REPLACE FUNCTION zukan_validate_retroactive_revocation_impact()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1
      FROM zukan_authority_assertions
     WHERE authority_assertion_id = NEW.authority_assertion_id
     FOR UPDATE;
    IF NEW.revocation_mode <> 'retroactive' THEN
        RETURN NEW;
    END IF;
    IF jsonb_typeof(NEW.impact_manifest) <> 'array'
       OR jsonb_array_length(NEW.impact_manifest) = 0 THEN
        RAISE EXCEPTION 'zukan_retroactive_revocation_impact_incomplete'
          USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1
          FROM jsonb_array_elements(NEW.impact_manifest) AS impacted(value)
         WHERE jsonb_typeof(impacted.value) <> 'string'
            OR NOT EXISTS (
              SELECT 1
                FROM zukan_projection_snapshots AS snapshot
                JOIN zukan_resolution_run_claims AS run_claim
                  ON run_claim.resolution_run_id = snapshot.resolution_run_id
                JOIN zukan_claim_authority_links AS authority_link
                  ON authority_link.claim_revision_id = run_claim.claim_revision_id
               WHERE to_jsonb(snapshot.projection_snapshot_id::TEXT) = impacted.value
                 AND authority_link.authority_assertion_id = NEW.authority_assertion_id
            )
            OR COALESCE((
              SELECT status.reproducibility_status
                FROM zukan_snapshot_status_events AS status
               WHERE to_jsonb(status.projection_snapshot_id::TEXT) = impacted.value
                 AND status.recorded_at >= NEW.effective_at
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
            AND NOT (NEW.impact_manifest ? snapshot.projection_snapshot_id::TEXT)
       )
       OR (
         SELECT COUNT(*) FROM jsonb_array_elements(NEW.impact_manifest)
       ) <> (
         SELECT COUNT(DISTINCT value)
           FROM jsonb_array_elements_text(NEW.impact_manifest) AS listed(value)
       ) THEN
        RAISE EXCEPTION 'zukan_retroactive_revocation_impact_incomplete'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_authority_revocations_retroactive_impact
  ON zukan_authority_revocation_events;
CREATE TRIGGER trg_zukan_authority_revocations_retroactive_impact
BEFORE INSERT ON zukan_authority_revocation_events
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_retroactive_revocation_impact();

-- Parent-row locks serialize each append-only workflow. Timestamps are strict,
-- so a same-time tie is rejected instead of resolved with a client-chosen ID.
CREATE OR REPLACE FUNCTION zukan_guard_dispute_event_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    opened_time TIMESTAMPTZ;
    previous_type TEXT;
    previous_time TIMESTAMPTZ;
BEGIN
    SELECT opened_at
      INTO opened_time
      FROM zukan_dispute_cases
     WHERE dispute_case_id = NEW.dispute_case_id
     FOR UPDATE;
    SELECT event_type, recorded_at
      INTO previous_type, previous_time
      FROM zukan_dispute_case_events
     WHERE dispute_case_id = NEW.dispute_case_id
     ORDER BY recorded_at DESC
     LIMIT 1;
    IF NEW.recorded_at < opened_time
       OR (previous_time IS NOT NULL AND NEW.recorded_at <= previous_time)
       OR (previous_type IS NULL AND NEW.event_type <> 'opened')
       OR (
         previous_type IS NOT NULL
         AND NOT (
           (previous_type IN ('opened', 'reopened')
            AND NEW.event_type IN ('under_review', 'resolved', 'dismissed'))
           OR (previous_type = 'under_review'
               AND NEW.event_type IN ('resolved', 'dismissed'))
           OR (previous_type IN ('resolved', 'dismissed')
               AND NEW.event_type = 'reopened')
         )
       ) THEN
        RAISE EXCEPTION 'zukan_dispute_event_transition_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_dispute_case_events_state_machine
  ON zukan_dispute_case_events;
CREATE TRIGGER trg_zukan_dispute_case_events_state_machine
BEFORE INSERT ON zukan_dispute_case_events
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_dispute_event_transition();

CREATE OR REPLACE FUNCTION zukan_guard_correction_event_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    request_time TIMESTAMPTZ;
    previous_type TEXT;
    previous_time TIMESTAMPTZ;
BEGIN
    SELECT requested_at
      INTO request_time
      FROM zukan_correction_requests
     WHERE correction_request_id = NEW.correction_request_id
     FOR UPDATE;
    SELECT event_type, recorded_at
      INTO previous_type, previous_time
      FROM zukan_correction_request_events
     WHERE correction_request_id = NEW.correction_request_id
     ORDER BY recorded_at DESC
     LIMIT 1;
    IF NEW.recorded_at < request_time
       OR (previous_time IS NOT NULL AND NEW.recorded_at <= previous_time)
       OR (previous_type IS NULL AND NEW.event_type <> 'submitted')
       OR (
         previous_type IS NOT NULL
         AND NOT (
           (previous_type = 'submitted'
            AND NEW.event_type IN ('under_review', 'withdrawn'))
           OR (previous_type = 'under_review'
               AND NEW.event_type IN (
                 'accepted', 'partially_accepted', 'rejected', 'withdrawn'
               ))
         )
       ) THEN
        RAISE EXCEPTION 'zukan_correction_event_transition_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_correction_request_events_state_machine
  ON zukan_correction_request_events;
CREATE TRIGGER trg_zukan_correction_request_events_state_machine
BEFORE INSERT ON zukan_correction_request_events
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_correction_event_transition();

CREATE OR REPLACE FUNCTION zukan_guard_suppression_event_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    request_time TIMESTAMPTZ;
    previous_type TEXT;
    previous_time TIMESTAMPTZ;
BEGIN
    SELECT requested_at
      INTO request_time
      FROM zukan_suppression_requests
     WHERE suppression_request_id = NEW.suppression_request_id
     FOR UPDATE;
    SELECT event_type, recorded_at
      INTO previous_type, previous_time
      FROM zukan_suppression_request_events
     WHERE suppression_request_id = NEW.suppression_request_id
     ORDER BY recorded_at DESC
     LIMIT 1;
    IF NEW.recorded_at < request_time
       OR (previous_time IS NOT NULL AND NEW.recorded_at <= previous_time)
       OR (previous_type IS NULL AND NEW.event_type <> 'submitted')
       OR (
         previous_type IS NOT NULL
         AND NOT (
           (previous_type = 'submitted'
            AND NEW.event_type IN ('under_review', 'withdrawn'))
           OR (previous_type = 'under_review'
               AND NEW.event_type IN ('approved', 'rejected', 'withdrawn'))
           OR (previous_type = 'approved'
               AND NEW.event_type IN ('executed', 'withdrawn'))
         )
       ) THEN
        RAISE EXCEPTION 'zukan_suppression_event_transition_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_suppression_request_events_state_machine
  ON zukan_suppression_request_events;
CREATE TRIGGER trg_zukan_suppression_request_events_state_machine
BEFORE INSERT ON zukan_suppression_request_events
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_suppression_event_transition();

CREATE OR REPLACE FUNCTION zukan_guard_snapshot_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    snapshot_row zukan_projection_snapshots%ROWTYPE;
    governance_row zukan_content_governance_events%ROWTYPE;
    previous_status TEXT;
    previous_time TIMESTAMPTZ;
BEGIN
    SELECT *
      INTO snapshot_row
      FROM zukan_projection_snapshots
     WHERE projection_snapshot_id = NEW.projection_snapshot_id
     FOR UPDATE;
    SELECT * INTO governance_row
      FROM zukan_content_governance_events
     WHERE governance_event_id = NEW.governance_event_id;
    SELECT reproducibility_status, recorded_at
      INTO previous_status, previous_time
      FROM zukan_snapshot_status_events
     WHERE projection_snapshot_id = NEW.projection_snapshot_id
     ORDER BY recorded_at DESC
     LIMIT 1;
    IF NEW.governance_event_id IS NULL THEN
        IF previous_time IS NOT NULL
           OR NEW.reproducibility_status <> snapshot_row.reproducibility_at_issue
           OR NEW.affected_entry_keys <> '[]'::jsonb
           OR NEW.recorded_at < snapshot_row.created_at THEN
            RAISE EXCEPTION 'zukan_snapshot_status_initial_state_invalid'
              USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    previous_status := COALESCE(previous_status, snapshot_row.reproducibility_at_issue);
    IF NEW.recorded_at < snapshot_row.created_at
       OR NEW.recorded_at < governance_row.recorded_at
       OR NEW.recorded_at < governance_row.effective_at
       OR (previous_time IS NOT NULL AND NEW.recorded_at <= previous_time)
       OR NOT (
         (previous_status = 'full'
          AND NEW.reproducibility_status IN ('redacted', 'degraded'))
         OR (previous_status = 'redacted'
             AND NEW.reproducibility_status = 'degraded')
       )
       OR NOT (
         (governance_row.action IN ('suppress', 'redact')
          AND NEW.reproducibility_status IN ('redacted', 'degraded'))
         OR (governance_row.action = 'erase'
             AND NEW.reproducibility_status = 'degraded')
       )
       OR NOT (
         (
           governance_row.target_kind = 'projection_snapshot'
           AND governance_row.target_id = NEW.projection_snapshot_id
         )
         OR (
           governance_row.target_kind = 'claim_revision'
           AND EXISTS (
             SELECT 1 FROM zukan_projection_entries AS entry
              WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
                AND entry.claim_revision_id = governance_row.target_id
           )
         )
         OR (
           governance_row.target_kind = 'value_artifact'
           AND EXISTS (
             SELECT 1
               FROM zukan_projection_entries AS entry
               LEFT JOIN zukan_claim_revisions AS revision
                 ON revision.claim_revision_id = entry.claim_revision_id
              WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
                AND (
                  entry.value_artifact_id = governance_row.target_id
                  OR revision.value_artifact_id = governance_row.target_id
                )
           )
         )
         OR (
           governance_row.target_kind = 'content_object'
           AND EXISTS (
             WITH RECURSIVE closure(content_object_id) AS (
                 SELECT governance_row.target_id
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
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(NEW.affected_entry_keys) AS affected(value)
          WHERE jsonb_typeof(affected.value) <> 'string'
             OR NOT EXISTS (
               SELECT 1 FROM zukan_projection_entries AS entry
                WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
                  AND to_jsonb(entry.entry_key) = affected.value
             )
       )
       OR EXISTS (
         SELECT 1
           FROM zukan_projection_entries AS entry
          WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
            AND (
              governance_row.target_kind = 'projection_snapshot'
              OR (governance_row.target_kind = 'claim_revision'
                  AND entry.claim_revision_id = governance_row.target_id)
              OR (governance_row.target_kind = 'value_artifact'
                  AND (
                    entry.value_artifact_id = governance_row.target_id
                    OR EXISTS (
                      SELECT 1 FROM zukan_claim_revisions AS revision
                       WHERE revision.claim_revision_id = entry.claim_revision_id
                         AND revision.value_artifact_id = governance_row.target_id
                    )
                  ))
              OR (governance_row.target_kind = 'content_object'
                  AND EXISTS (
                    WITH RECURSIVE closure(content_object_id) AS (
                        SELECT governance_row.target_id
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
                  ))
            )
            AND NOT (NEW.affected_entry_keys ? entry.entry_key)
       ) THEN
        RAISE EXCEPTION 'zukan_snapshot_status_transition_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_snapshot_status_events_state_machine
  ON zukan_snapshot_status_events;
CREATE TRIGGER trg_zukan_snapshot_status_events_state_machine
BEFORE INSERT ON zukan_snapshot_status_events
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_snapshot_status_transition();

CREATE OR REPLACE FUNCTION zukan_guard_publication_availability_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    publication_row zukan_publication_editions%ROWTYPE;
    snapshot_id UUID;
    governance_row zukan_content_governance_events%ROWTYPE;
    previous_status TEXT;
    previous_time TIMESTAMPTZ;
BEGIN
    SELECT publication.*
      INTO publication_row
      FROM zukan_publication_editions AS publication
     WHERE publication.publication_edition_id = NEW.publication_edition_id
     FOR UPDATE;
    snapshot_id := publication_row.projection_snapshot_id;
    SELECT * INTO governance_row
      FROM zukan_content_governance_events
     WHERE governance_event_id = NEW.governance_event_id;
    SELECT availability_status, recorded_at
      INTO previous_status, previous_time
      FROM zukan_publication_availability_events
     WHERE publication_edition_id = NEW.publication_edition_id
     ORDER BY recorded_at DESC
     LIMIT 1;
    IF NEW.governance_event_id IS NULL THEN
        IF previous_time IS NOT NULL
           OR NEW.availability_status <> 'available'
           OR NEW.recorded_at < publication_row.created_at
           OR NEW.effective_at < publication_row.issued_at THEN
            RAISE EXCEPTION 'zukan_publication_availability_initial_state_invalid'
              USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    previous_status := COALESCE(previous_status, 'available');
    IF NEW.recorded_at < publication_row.created_at
       OR NEW.effective_at < publication_row.issued_at
       OR NEW.recorded_at < governance_row.recorded_at
       OR NEW.effective_at < governance_row.effective_at
       OR (previous_time IS NOT NULL AND NEW.recorded_at <= previous_time)
       OR NOT (
         (previous_status = 'available'
          AND NEW.availability_status IN ('suppressed', 'withdrawn'))
         OR (previous_status = 'suppressed'
             AND NEW.availability_status = 'withdrawn')
       )
       OR NOT (
         (governance_row.action IN ('suppress', 'redact')
          AND NEW.availability_status IN ('suppressed', 'withdrawn'))
         OR (governance_row.action = 'erase'
             AND NEW.availability_status = 'withdrawn')
       )
       OR NOT (
         (
           governance_row.target_kind = 'publication_edition'
           AND governance_row.target_id = NEW.publication_edition_id
         )
         OR (
           governance_row.target_kind = 'projection_snapshot'
           AND governance_row.target_id = snapshot_id
         )
         OR (
           governance_row.target_kind IN ('claim_revision', 'value_artifact', 'content_object')
           AND EXISTS (
             SELECT 1
               FROM zukan_projection_entries AS entry
               LEFT JOIN zukan_value_artifacts AS artifact
                 ON artifact.artifact_id = entry.value_artifact_id
              WHERE entry.projection_snapshot_id = snapshot_id
                AND (
                  (governance_row.target_kind = 'claim_revision'
                   AND entry.claim_revision_id = governance_row.target_id)
                  OR (governance_row.target_kind = 'value_artifact'
                      AND entry.value_artifact_id = governance_row.target_id)
                  OR (governance_row.target_kind = 'content_object'
                      AND EXISTS (
                        WITH RECURSIVE closure(content_object_id) AS (
                            SELECT governance_row.target_id
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
       ) THEN
        RAISE EXCEPTION 'zukan_publication_availability_transition_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_publication_availability_events_state_machine
  ON zukan_publication_availability_events;
CREATE TRIGGER trg_zukan_publication_availability_events_state_machine
BEFORE INSERT ON zukan_publication_availability_events
FOR EACH ROW
EXECUTE FUNCTION zukan_guard_publication_availability_transition();

DO $$
BEGIN
    IF EXISTS (
        WITH
        dispute_ordered AS (
          SELECT event.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY dispute_case_id
                   ORDER BY recorded_at, dispute_case_event_id
                 ) AS ordinal,
                 LAG(event_type) OVER (
                   PARTITION BY dispute_case_id
                   ORDER BY recorded_at, dispute_case_event_id
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
                   ORDER BY recorded_at, correction_request_event_id
                 ) AS ordinal,
                 LAG(event_type) OVER (
                   PARTITION BY correction_request_id
                   ORDER BY recorded_at, correction_request_event_id
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
                   ORDER BY recorded_at, suppression_request_event_id
                 ) AS ordinal,
                 LAG(event_type) OVER (
                   PARTITION BY suppression_request_id
                   ORDER BY recorded_at, suppression_request_event_id
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
                   ORDER BY recorded_at, snapshot_status_event_id
                 ) AS ordinal,
                 LAG(reproducibility_status) OVER (
                   PARTITION BY projection_snapshot_id
                   ORDER BY recorded_at, snapshot_status_event_id
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
                   ORDER BY recorded_at, publication_availability_event_id
                 ) AS ordinal,
                 LAG(availability_status) OVER (
                   PARTITION BY publication_edition_id
                   ORDER BY recorded_at, publication_availability_event_id
                 ) AS previous_status,
                 COUNT(*) OVER (
                   PARTITION BY publication_edition_id, recorded_at
                 ) AS tie_count
            FROM zukan_publication_availability_events AS event
        )
        SELECT 1
          FROM dispute_ordered AS event
          JOIN zukan_dispute_cases AS dispute
            ON dispute.dispute_case_id = event.dispute_case_id
         WHERE event.tie_count > 1
            OR event.recorded_at < dispute.opened_at
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
            OR event.recorded_at < request.requested_at
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
            OR event.recorded_at < request.requested_at
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
            OR event.recorded_at < snapshot.created_at
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
            OR event.recorded_at < publication.created_at
            OR event.effective_at < publication.issued_at
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
    ) THEN
        RAISE EXCEPTION 'existing_append_only_event_history_is_invalid'
          USING ERRCODE = '23514';
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        WITH RECURSIVE walk(
          origin_id, current_id, origin_edition_id, path, cycle
        ) AS (
          SELECT content_object_id,
                 parent_content_object_id,
                 source_edition_id,
                 ARRAY[content_object_id],
                 false
            FROM zukan_content_objects
          UNION ALL
          SELECT walk.origin_id,
                 parent.parent_content_object_id,
                 walk.origin_edition_id,
                 walk.path || parent.content_object_id,
                 parent.content_object_id = ANY(walk.path)
            FROM walk
            JOIN zukan_content_objects AS parent
              ON parent.content_object_id = walk.current_id
           WHERE walk.current_id IS NOT NULL
             AND NOT walk.cycle
        )
        SELECT 1 FROM walk WHERE cycle
        UNION ALL
        SELECT 1
          FROM zukan_content_objects AS child
          JOIN zukan_content_objects AS parent
            ON parent.content_object_id = child.parent_content_object_id
         WHERE child.source_edition_id IS NOT NULL
           AND parent.source_edition_id IS NOT NULL
           AND child.source_edition_id <> parent.source_edition_id
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
         WHERE own_work.tenant_id <> ancestor_work.tenant_id
    ) THEN
        RAISE EXCEPTION 'existing_content_graph_is_not_acyclic_and_scoped'
          USING ERRCODE = '23514';
    END IF;
END;
$$;

-- Immutable content graphs are acyclic and cannot cross SourceWork tenants.
CREATE OR REPLACE FUNCTION zukan_validate_content_object_graph()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.parent_content_object_id = NEW.content_object_id THEN
        RAISE EXCEPTION 'zukan_content_object_self_parent_invalid'
          USING ERRCODE = '23514';
    END IF;

    IF NEW.parent_content_object_id IS NOT NULL THEN
        PERFORM 1
          FROM zukan_content_objects
         WHERE content_object_id = NEW.parent_content_object_id
           FOR KEY SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'zukan_content_object_parent_must_preexist'
              USING ERRCODE = '23503';
        END IF;
    END IF;

    IF NEW.parent_content_object_id IS NOT NULL
       AND NEW.source_edition_id IS NOT NULL
       AND EXISTS (
         SELECT 1
           FROM zukan_content_objects AS parent
          WHERE parent.content_object_id = NEW.parent_content_object_id
            AND parent.source_edition_id IS NOT NULL
            AND parent.source_edition_id <> NEW.source_edition_id
       ) THEN
        RAISE EXCEPTION 'zukan_content_object_parent_edition_mismatch'
          USING ERRCODE = '23514';
    END IF;

    IF NEW.source_edition_id IS NOT NULL AND EXISTS (
        WITH RECURSIVE ancestors AS (
            SELECT content_object_id, parent_content_object_id, source_edition_id
              FROM zukan_content_objects
             WHERE content_object_id = NEW.parent_content_object_id
            UNION
            SELECT parent.content_object_id,
                   parent.parent_content_object_id,
                   parent.source_edition_id
              FROM zukan_content_objects AS parent
              JOIN ancestors
                ON parent.content_object_id = ancestors.parent_content_object_id
        )
        SELECT 1
          FROM zukan_source_editions AS own_edition
          JOIN zukan_source_works AS own_work
            ON own_work.source_work_id = own_edition.source_work_id
          CROSS JOIN ancestors
          JOIN zukan_source_editions AS ancestor_edition
            ON ancestor_edition.source_edition_id = ancestors.source_edition_id
          JOIN zukan_source_works AS ancestor_work
            ON ancestor_work.source_work_id = ancestor_edition.source_work_id
         WHERE own_edition.source_edition_id = NEW.source_edition_id
           AND own_work.tenant_id <> ancestor_work.tenant_id
    ) THEN
        RAISE EXCEPTION 'zukan_content_object_graph_scope_invalid'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_content_objects_graph_integrity
  ON zukan_content_objects;
CREATE TRIGGER trg_zukan_content_objects_graph_integrity
BEFORE INSERT ON zukan_content_objects
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_content_object_graph();

CREATE OR REPLACE FUNCTION zukan_validate_claim_revision_evidence_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.value_artifact_id IS NOT NULL AND EXISTS (
        WITH RECURSIVE ancestors AS (
            SELECT object.content_object_id,
                   object.parent_content_object_id,
                   object.source_edition_id
              FROM zukan_value_artifacts AS artifact
              JOIN zukan_content_objects AS object
                ON object.content_object_id = artifact.content_object_id
             WHERE artifact.artifact_id = NEW.value_artifact_id
            UNION
            SELECT parent.content_object_id,
                   parent.parent_content_object_id,
                   parent.source_edition_id
              FROM zukan_content_objects AS parent
              JOIN ancestors
                ON parent.content_object_id = ancestors.parent_content_object_id
        )
        SELECT 1
          FROM zukan_claims AS claim
          CROSS JOIN ancestors
          JOIN zukan_source_editions AS edition
            ON edition.source_edition_id = ancestors.source_edition_id
          JOIN zukan_source_works AS work
            ON work.source_work_id = edition.source_work_id
         WHERE claim.claim_id = NEW.claim_id
           AND work.tenant_id <> claim.tenant_id
    ) THEN
        RAISE EXCEPTION 'zukan_claim_revision_evidence_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_claim_revision_evidence_scope
  ON zukan_claim_revisions;
CREATE TRIGGER trg_zukan_claim_revision_evidence_scope
BEFORE INSERT ON zukan_claim_revisions
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_claim_revision_evidence_scope();

CREATE OR REPLACE FUNCTION zukan_validate_trust_anchor_evidence_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.evidence_content_object_id IS NOT NULL AND EXISTS (
        WITH RECURSIVE ancestors AS (
            SELECT content_object_id, parent_content_object_id, source_edition_id
              FROM zukan_content_objects
             WHERE content_object_id = NEW.evidence_content_object_id
            UNION
            SELECT parent.content_object_id,
                   parent.parent_content_object_id,
                   parent.source_edition_id
              FROM zukan_content_objects AS parent
              JOIN ancestors
                ON parent.content_object_id = ancestors.parent_content_object_id
        )
        SELECT 1
          FROM ancestors
          JOIN zukan_source_editions AS edition
            ON edition.source_edition_id = ancestors.source_edition_id
          JOIN zukan_source_works AS work
            ON work.source_work_id = edition.source_work_id
         WHERE work.tenant_id <> NEW.tenant_id
    ) THEN
        RAISE EXCEPTION 'zukan_trust_anchor_evidence_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_trust_anchor_evidence_scope
  ON zukan_trust_anchors;
CREATE TRIGGER trg_zukan_trust_anchor_evidence_scope
BEFORE INSERT ON zukan_trust_anchors
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_trust_anchor_evidence_scope();

CREATE OR REPLACE FUNCTION zukan_validate_detection_evidence_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.evidence_content_object_id IS NOT NULL AND EXISTS (
        WITH RECURSIVE ancestors AS (
            SELECT content_object_id, parent_content_object_id, source_edition_id
              FROM zukan_content_objects
             WHERE content_object_id = NEW.evidence_content_object_id
            UNION
            SELECT parent.content_object_id,
                   parent.parent_content_object_id,
                   parent.source_edition_id
              FROM zukan_content_objects AS parent
              JOIN ancestors
                ON parent.content_object_id = ancestors.parent_content_object_id
        )
        SELECT 1
          FROM zukan_survey_events AS survey
          CROSS JOIN ancestors
          JOIN zukan_source_editions AS edition
            ON edition.source_edition_id = ancestors.source_edition_id
          JOIN zukan_source_works AS work
            ON work.source_work_id = edition.source_work_id
         WHERE survey.survey_event_id = NEW.survey_event_id
           AND work.tenant_id <> survey.tenant_id
    ) THEN
        RAISE EXCEPTION 'zukan_detection_evidence_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_detection_evidence_scope
  ON zukan_detection_outcomes;
CREATE TRIGGER trg_zukan_detection_evidence_scope
BEFORE INSERT ON zukan_detection_outcomes
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_detection_evidence_scope();

CREATE OR REPLACE FUNCTION zukan_validate_public_identifier_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.retired_at IS NOT NULL AND NEW.retired_at < NEW.created_at THEN
        RAISE EXCEPTION 'zukan_public_identifier_retirement_invalid'
          USING ERRCODE = '23514';
    END IF;

    IF NEW.target_kind = 'dataset'
       OR (NEW.target_kind = 'subject_identity' AND NOT EXISTS (
             SELECT 1 FROM zukan_subject_identities WHERE subject_id = NEW.target_id
          ))
       OR (NEW.target_kind = 'source_work' AND NOT EXISTS (
             SELECT 1 FROM zukan_source_works WHERE source_work_id = NEW.target_id
          ))
       OR (NEW.target_kind = 'source_edition' AND NOT EXISTS (
             SELECT 1 FROM zukan_source_editions WHERE source_edition_id = NEW.target_id
          ))
       OR (NEW.target_kind = 'content_object' AND NOT EXISTS (
             SELECT 1 FROM zukan_content_objects WHERE content_object_id = NEW.target_id
          ))
       OR (NEW.target_kind = 'publication_edition' AND NOT EXISTS (
             SELECT 1 FROM zukan_publication_editions WHERE publication_edition_id = NEW.target_id
          )) THEN
        RAISE EXCEPTION 'zukan_public_identifier_target_invalid'
          USING ERRCODE = '23514';
    END IF;

    IF NEW.sensitivity_status = 'normal' AND (
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
    ) THEN
        RAISE EXCEPTION 'zukan_public_identifier_workspace_target_requires_restriction'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_public_identifiers_target_valid
  ON zukan_public_identifiers;
CREATE TRIGGER trg_zukan_public_identifiers_target_valid
BEFORE INSERT ON zukan_public_identifiers
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_public_identifier_target();

-- Privacy transitions require a matching governance event plus every affected
-- snapshot/publication status event to be recorded first.
CREATE OR REPLACE FUNCTION zukan_require_value_artifact_governance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.availability_status IN ('redacted', 'erased')
       AND NEW.availability_status IS DISTINCT FROM OLD.availability_status
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
                      AND status.affected_entry_keys ? entry.entry_key
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
       ) THEN
        RAISE EXCEPTION 'zukan_value_artifact_governance_incomplete'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_value_artifacts_governance_required
  ON zukan_value_artifacts;
CREATE TRIGGER trg_zukan_value_artifacts_governance_required
BEFORE UPDATE ON zukan_value_artifacts
FOR EACH ROW
EXECUTE FUNCTION zukan_require_value_artifact_governance();

CREATE OR REPLACE FUNCTION zukan_require_content_object_governance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.availability_status IN ('redacted', 'erased')
       AND NEW.availability_status IS DISTINCT FROM OLD.availability_status
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
                    JOIN closure
                      ON child.parent_content_object_id = closure.content_object_id
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
                    JOIN closure
                      ON child.parent_content_object_id = closure.content_object_id
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
                    JOIN closure
                      ON child.parent_content_object_id = closure.content_object_id
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
                    AND status.affected_entry_keys ? entry.entry_key
               )
            )
            AND NOT EXISTS (
              WITH RECURSIVE closure(content_object_id) AS (
                  SELECT OLD.content_object_id
                  UNION
                  SELECT child.content_object_id
                    FROM zukan_content_objects AS child
                    JOIN closure
                      ON child.parent_content_object_id = closure.content_object_id
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
       ) THEN
        RAISE EXCEPTION 'zukan_content_object_governance_incomplete'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_content_objects_governance_required
  ON zukan_content_objects;
CREATE TRIGGER trg_zukan_content_objects_governance_required
BEFORE UPDATE ON zukan_content_objects
FOR EACH ROW
EXECUTE FUNCTION zukan_require_content_object_governance();

-- Publication is the public trust boundary.
CREATE UNIQUE INDEX IF NOT EXISTS idx_zukan_publication_editions_key_label_unique
  ON zukan_publication_editions(publication_key, edition_label);

CREATE OR REPLACE FUNCTION zukan_validate_publication_edition_gate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM run.resolution_run_id
      FROM zukan_projection_snapshots AS snapshot
      JOIN zukan_resolution_runs AS run
        ON run.resolution_run_id = snapshot.resolution_run_id
     WHERE snapshot.projection_snapshot_id = NEW.projection_snapshot_id
     FOR UPDATE OF run;
    PERFORM subject.subject_id
      FROM zukan_projection_snapshots AS snapshot
      JOIN zukan_resolution_runs AS run
        ON run.resolution_run_id = snapshot.resolution_run_id
      JOIN zukan_subject_identities AS subject ON subject.subject_id = run.subject_id
     WHERE snapshot.projection_snapshot_id = NEW.projection_snapshot_id
     FOR UPDATE OF subject;
    PERFORM revision.claim_revision_id
      FROM zukan_projection_entries AS entry
      JOIN zukan_claim_revisions AS revision
        ON revision.claim_revision_id = entry.claim_revision_id
     WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
     ORDER BY revision.claim_revision_id
     FOR UPDATE OF revision;
    PERFORM artifact.artifact_id
      FROM zukan_projection_entries AS entry
      JOIN zukan_value_artifacts AS artifact
        ON artifact.artifact_id = entry.value_artifact_id
     WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
     ORDER BY artifact.artifact_id
     FOR UPDATE OF artifact;
    PERFORM object.content_object_id
      FROM zukan_projection_entries AS entry
      JOIN zukan_value_artifacts AS artifact
        ON artifact.artifact_id = entry.value_artifact_id
      JOIN zukan_content_objects AS object
        ON object.content_object_id = artifact.content_object_id
     WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
     ORDER BY object.content_object_id
     FOR UPDATE OF object;
    PERFORM assertion.authority_assertion_id
      FROM zukan_projection_entries AS entry
      JOIN zukan_claim_authority_links AS authority_link
        ON authority_link.claim_revision_id = entry.claim_revision_id
      JOIN zukan_authority_assertions AS assertion
        ON assertion.authority_assertion_id = authority_link.authority_assertion_id
     WHERE entry.projection_snapshot_id = NEW.projection_snapshot_id
     ORDER BY assertion.authority_assertion_id
     FOR UPDATE OF assertion;

    IF NOT EXISTS (
        SELECT 1
          FROM zukan_projection_snapshots AS snapshot
          JOIN zukan_resolution_runs AS run
            ON run.resolution_run_id = snapshot.resolution_run_id
         WHERE snapshot.projection_snapshot_id = NEW.projection_snapshot_id
           AND run.resolution_status = 'resolved'
           AND run.workspace_id IS NULL
           AND snapshot.reproducibility_at_issue = 'full'
           AND NEW.issued_at >= snapshot.created_at
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
                  OR revision.value_artifact_id IS DISTINCT FROM artifact.artifact_id
                  OR claim.tenant_id IS DISTINCT FROM run.tenant_id
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
                          OR rights.basis_review_due > NEW.issued_at
                        )
                       AND (rights.valid_from IS NULL OR rights.valid_from <= NEW.issued_at)
                       AND (rights.valid_to IS NULL OR rights.valid_to > NEW.issued_at)
                  )
                  OR EXISTS (
                    SELECT 1
                      FROM zukan_rights_evaluations AS rights
                     WHERE rights.value_artifact_id = artifact.artifact_id
                       AND rights.purpose = 'publication'
                       AND rights.basis IN ('denied', 'unknown')
                       AND (rights.valid_from IS NULL OR rights.valid_from <= NEW.issued_at)
                       AND (rights.valid_to IS NULL OR rights.valid_to > NEW.issued_at)
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
                              OR rights.basis_review_due > NEW.issued_at
                            )
                           AND (rights.valid_from IS NULL OR rights.valid_from <= NEW.issued_at)
                           AND (rights.valid_to IS NULL OR rights.valid_to > NEW.issued_at)
                      )
                      OR EXISTS (
                        SELECT 1
                          FROM zukan_rights_evaluations AS rights
                         WHERE rights.content_object_id = artifact.content_object_id
                           AND rights.purpose = 'publication'
                           AND rights.basis IN ('denied', 'unknown')
                           AND (rights.valid_from IS NULL OR rights.valid_from <= NEW.issued_at)
                           AND (rights.valid_to IS NULL OR rights.valid_to > NEW.issued_at)
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
                AND revocation.effective_at <= NEW.issued_at
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
                OR (
                  request.target_kind = 'content_object'
                  AND EXISTS (
                    WITH RECURSIVE closure(content_object_id) AS (
                        SELECT request.target_id
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
                AND COALESCE((
                  SELECT event.event_type
                    FROM zukan_suppression_request_events AS event
                   WHERE event.suppression_request_id = request.suppression_request_id
                   ORDER BY event.recorded_at DESC, event.suppression_request_event_id DESC
                   LIMIT 1
                ), 'submitted') NOT IN ('rejected', 'withdrawn')
           )
    ) THEN
        RAISE EXCEPTION 'zukan_publication_edition_public_gate_failed'
          USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_publication_editions_public_gate
  ON zukan_publication_editions;
CREATE TRIGGER trg_zukan_publication_editions_public_gate
BEFORE INSERT ON zukan_publication_editions
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_publication_edition_gate();
