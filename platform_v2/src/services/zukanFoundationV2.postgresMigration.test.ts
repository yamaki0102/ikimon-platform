import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationFiles = [
  "0134_zukan_foundation_v2_source_identity.sql",
  "0135_zukan_foundation_v2_predicate_claims.sql",
  "0136_zukan_foundation_v2_authority_resolution.sql",
  "0137_zukan_foundation_v2_governance_rights.sql",
  "0138_zukan_foundation_v2_disputes_coverage.sql",
  "0139_zukan_foundation_v2_integrity_hardening.sql",
] as const;
const migrations = migrationFiles.map((filename) => readFileSync(
  new URL(`../../db/migrations/${filename}`, import.meta.url),
  "utf8",
));
const combined = migrations.join("\n");
const [sourceIdentity = "", claimPart = "", authorityPart = "", governancePart = "", disputePart = ""] = migrations;
const claimResolution = `${claimPart}\n${authorityPart}`;
const governance = `${governancePart}\n${disputePart}`;

test("Foundation v2 PostgreSQL migration is additive and contains the frozen identity/source boundary", () => {
  assert.doesNotMatch(combined, /^\s*(?:UPDATE|DELETE\s+FROM|TRUNCATE)\b/im);
  assert.doesNotMatch(combined, /\bDROP\s+(?:TABLE|COLUMN)\b/i);
  assert.match(sourceIdentity, /CREATE TABLE IF NOT EXISTS zukan_source_works/);
  assert.match(sourceIdentity, /CREATE TABLE IF NOT EXISTS zukan_source_editions/);
  assert.match(sourceIdentity, /CREATE TABLE IF NOT EXISTS zukan_content_objects/);
  assert.match(sourceIdentity, /CREATE TABLE IF NOT EXISTS zukan_extraction_runs/);
  assert.match(sourceIdentity, /CREATE TABLE IF NOT EXISTS zukan_identity_membership_assertions/);
  assert.match(sourceIdentity, /CREATE UNIQUE INDEX IF NOT EXISTS idx_zukan_canonical_assertions_one_current/);
});

test("Foundation v2 PostgreSQL migration locks Claim revisions, predicates, watermarks, and snapshots", () => {
  assert.match(claimResolution, /recorded_sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE/);
  assert.match(claimResolution, /claim_store_snapshot_token TEXT NOT NULL/);
  assert.match(claimResolution, /claim_store_sequence_watermark BIGINT NOT NULL/);
  assert.match(claimResolution, /recorded_time_watermark TIMESTAMPTZ NOT NULL/);
  assert.match(claimResolution, /zukan_claim_revision_must_append_expected_/);
  assert.match(claimResolution, /trg_zukan_predicate_definitions_no_update/);
  assert.match(claimResolution, /trg_zukan_resolution_runs_no_update/);
  assert.match(claimResolution, /trg_zukan_projection_snapshots_no_update/);
  assert.match(claimResolution, /value_artifact_id UUID REFERENCES zukan_value_artifacts\(artifact_id\) ON DELETE RESTRICT/);
});

test("Foundation v2 PostgreSQL migration separates erase impact, rights unknown, disputes, and coverage", () => {
  assert.match(governance, /CREATE TABLE IF NOT EXISTS zukan_content_governance_events/);
  assert.match(governance, /CREATE TABLE IF NOT EXISTS zukan_snapshot_status_events/);
  assert.match(governance, /CREATE TABLE IF NOT EXISTS zukan_suppression_requests/);
  assert.match(governance, /basis TEXT NOT NULL DEFAULT 'unknown'/);
  assert.match(governance, /CREATE TABLE IF NOT EXISTS zukan_dispute_case_events/);
  assert.match(governance, /CREATE TABLE IF NOT EXISTS zukan_detection_outcomes/);
  assert.match(governance, /CREATE TABLE IF NOT EXISTS zukan_coverage_assessments/);
  assert.match(governance, /trg_zukan_rights_evaluations_no_update/);
});

const hardening = migrations.at(-1) ?? "";

function postgresFunction(functionName: string): string {
  const match = hardening.match(new RegExp(
    `CREATE OR REPLACE FUNCTION ${functionName}\\(\\)[\\s\\S]*?\\$\\$;`,
  ));
  assert.ok(match, `missing PostgreSQL function ${functionName}`);
  return match[0];
}

test("PostgreSQL freezes Subject, SourceWork, and SourceEdition tenant-scope identity edges", () => {
  assert.match(hardening, /zukan_guard_subject_identity_scope/);
  assert.match(hardening, /NEW\.tenant_id IS DISTINCT FROM OLD\.tenant_id/);
  assert.match(hardening, /NEW\.workspace_id IS DISTINCT FROM OLD\.workspace_id/);
  assert.match(hardening, /zukan_validate_source_work_publisher_scope/);
  assert.match(hardening, /publisher\.tenant_id = NEW\.tenant_id/);
  assert.match(hardening, /publisher\.workspace_id IS NULL/);
  assert.match(hardening, /zukan_guard_source_work_identity/);
  assert.match(hardening, /NEW\.publisher_subject_id IS DISTINCT FROM OLD\.publisher_subject_id/);
  assert.match(hardening, /zukan_guard_source_edition_identity/);
  assert.match(hardening, /NEW\.source_work_id IS DISTINCT FROM OLD\.source_work_id/);
  assert.match(hardening, /BEFORE UPDATE OR DELETE ON zukan_source_editions/);
  assert.match(hardening, /zukan_guard_source_edition_lifecycle/);
  assert.match(hardening, /OLD\.lifecycle_status = 'retired'/);
});

test("PostgreSQL rejects resolution candidates recorded after the frozen watermark", () => {
  const runGuard = postgresFunction("zukan_validate_resolution_run_scope");
  assert.match(hardening, /zukan_validate_resolution_run_claim_watermark/);
  assert.match(hardening, /revision\.recorded_sequence <= run\.claim_store_sequence_watermark/);
  assert.match(hardening, /revision\.recorded_at <= run\.recorded_time_watermark/);
  assert.match(hardening, /later_revision\.revision > revision\.revision/);
  assert.match(hardening, /claim\.workspace_id IS NOT DISTINCT FROM run\.workspace_id/);
  assert.match(hardening, /subject\.tenant_id = run\.tenant_id/);
  assert.match(hardening, /trg_zukan_claims_no_update/);
  assert.match(hardening, /BEFORE UPDATE OR DELETE ON zukan_claims/);
  assert.match(hardening, /zukan_resolution_run_watermark_is_future/);
  assert.match(hardening, /COALESCE\(MAX\(recorded_sequence\), 0\)/);
  assert.match(runGuard, /LOCK TABLE zukan_claim_revisions IN SHARE MODE/);
});

test("PostgreSQL seals issued aggregates with symmetric parent-row locks", () => {
  const claimGuard = postgresFunction("zukan_guard_resolution_run_claim_aggregate");
  const snapshotSeal = postgresFunction("zukan_lock_resolution_run_for_snapshot");
  const entryGuard = postgresFunction("zukan_guard_projection_entry_aggregate");
  const publicationSeal = postgresFunction("zukan_lock_projection_snapshot_for_publication");

  assert.match(claimGuard, /FROM zukan_resolution_runs[\s\S]*FOR UPDATE/);
  assert.match(claimGuard, /zukan_resolution_run_claims_sealed_by_snapshot/);
  assert.match(snapshotSeal, /FROM zukan_resolution_runs[\s\S]*FOR UPDATE/);
  assert.match(entryGuard, /FROM zukan_projection_snapshots[\s\S]*FOR UPDATE/);
  assert.match(entryGuard, /zukan_projection_entries_sealed_by_publication/);
  assert.match(publicationSeal, /FROM zukan_projection_snapshots[\s\S]*FOR UPDATE/);
  assert.match(hardening, /trg_zukan_resolution_run_claims_aggregate_open/);
  assert.match(hardening, /trg_zukan_projection_snapshots_lock_resolution_run/);
  assert.match(hardening, /trg_zukan_projection_entries_aggregate_open/);
  assert.match(hardening, /trg_zukan_publication_editions_lock_snapshot/);
});

test("PostgreSQL rejects erased or redacted artifacts that retain value or locator data", () => {
  assert.match(hardening, /zukan_value_artifacts_empty_tombstone/);
  assert.match(hardening, /content_sha256 IS NULL/);
  assert.match(hardening, /redacted_at >= created_at/);
});

test("PostgreSQL freezes ValueArtifact identity and payload except one-way privacy erasure", () => {
  const mutationGuard = postgresFunction("zukan_guard_value_artifact_mutation");
  const suppressionGuard = postgresFunction("zukan_reject_value_artifact_suppressed_row");
  assert.match(mutationGuard, /TG_OP = 'DELETE'/);
  assert.match(mutationGuard, /NEW\.artifact_id IS DISTINCT FROM OLD\.artifact_id/);
  assert.match(mutationGuard, /NEW\.content_object_id IS DISTINCT FROM OLD\.content_object_id/);
  assert.match(mutationGuard, /NEW\.created_at IS DISTINCT FROM OLD\.created_at/);
  assert.match(mutationGuard, /OLD\.availability_status = 'available'/);
  assert.match(mutationGuard, /NEW\.availability_status IN \('redacted', 'erased'\)/);
  assert.match(mutationGuard, /OLD\.availability_status = 'redacted'/);
  assert.match(mutationGuard, /NEW\.availability_status = 'erased'/);
  assert.match(mutationGuard, /NEW\.value_json IS NULL/);
  assert.match(mutationGuard, /NEW\.value_text IS NULL/);
  assert.match(mutationGuard, /NEW\.content_sha256 IS NULL/);
  assert.match(mutationGuard, /NEW\.storage_locator IS NULL/);
  assert.match(mutationGuard, /NEW\.redacted_at IS NOT DISTINCT FROM OLD\.redacted_at/);
  assert.match(suppressionGuard, /zukan_value_artifact_suppression_uses_events/);
  assert.match(hardening, /existing_suppressed_rows_require_event_migration/);
  assert.match(hardening, /BEFORE UPDATE OR DELETE ON zukan_value_artifacts/);
});

test("PostgreSQL keeps PublicIdentifier identity permanent while allowing retirement fields", () => {
  assert.match(hardening, /zukan_guard_public_identifier_identity/);
  assert.match(hardening, /TG_OP = 'DELETE'/);
  assert.match(hardening, /NEW\.identifier_uri IS DISTINCT FROM OLD\.identifier_uri/);
  assert.match(hardening, /zukan_public_identifier_privacy_irreversible/);
  assert.match(hardening, /OLD\.retired_at IS NOT NULL/);
});

test("PostgreSQL stages ContentObjects and requires matching FK-backed verified fixity", () => {
  assert.match(hardening, /zukan_source_object_must_stage_missing_with_sha256/);
  assert.match(hardening, /REFERENCES zukan_content_objects\(content_object_id\) ON DELETE RESTRICT/);
  assert.match(hardening, /zukan_content_fixity_digest_must_match_object/);
  assert.match(hardening, /zukan_content_object_byte_identity_immutable/);
  assert.match(hardening, /CREATE UNIQUE INDEX IF NOT EXISTS idx_zukan_content_objects_digest_unique/);
  assert.match(hardening, /NEW\.storage_locator IS NULL/);
  assert.match(hardening, /zukan_available_source_object_requires_verified_fixity/);
});

test("PostgreSQL rejects breaking predicate revisions and requires version one first", () => {
  assert.match(hardening, /zukan_validate_predicate_revision_compatibility/);
  assert.match(hardening, /pg_advisory_xact_lock/);
  assert.match(hardening, /NOT FOUND AND NEW\.predicate_version <> 1/);
  assert.match(hardening, /NEW\.value_schema IS DISTINCT FROM previous\.value_schema/);
  assert.match(hardening, /previous\.cardinality = 'many' AND NEW\.cardinality = 'one'/);
});

test("PostgreSQL serializes conflicting rights decisions on the publication target", () => {
  const rightsGuard = postgresFunction("zukan_validate_rights_inheritance_scope");
  assert.match(
    rightsGuard,
    /FROM zukan_content_objects[\s\S]*content_object_id = NEW\.content_object_id[\s\S]*FOR UPDATE/,
  );
  assert.match(
    rightsGuard,
    /FROM zukan_value_artifacts[\s\S]*artifact_id = NEW\.value_artifact_id[\s\S]*FOR UPDATE/,
  );
  assert.match(rightsGuard, /zukan_rights_interval_conflict/);
});

test("PostgreSQL closes ExtractionRun once and requires a completed survey for non-detection", () => {
  const initialRun = postgresFunction("zukan_validate_extraction_run_initial_state");
  const completeRun = postgresFunction("zukan_guard_extraction_run_completion");
  const surveyGuard = postgresFunction("zukan_guard_survey_event");
  const detectionGuard = postgresFunction("zukan_validate_detection_outcome_scope");

  assert.match(initialRun, /NEW\.run_status = 'running'/);
  assert.match(initialRun, /NEW\.finished_at IS NOT NULL OR NEW\.output_hash IS NOT NULL/);
  assert.match(initialRun, /NEW\.run_status IN \('succeeded', 'partial', 'failed'\)/);
  assert.match(completeRun, /OLD\.run_status <> 'running'/);
  assert.match(completeRun, /NEW\.run_status NOT IN \('succeeded', 'partial', 'failed'\)/);
  assert.match(completeRun, /NEW\.input_hash IS DISTINCT FROM OLD\.input_hash/);
  assert.match(completeRun, /NEW\.finished_at IS NULL/);
  assert.match(surveyGuard, /OLD\.ended_at IS NOT NULL/);
  assert.match(surveyGuard, /NEW\.ended_at < OLD\.started_at/);
  assert.match(detectionGuard, /NEW\.outcome <> 'not_detected'/);
  assert.match(detectionGuard, /survey\.ended_at IS NOT NULL/);
  assert.match(detectionGuard, /NEW\.recorded_at >= survey\.ended_at/);
});

test("PostgreSQL serializes workflow and status histories with strict time", () => {
  const dispute = postgresFunction("zukan_guard_dispute_event_transition");
  const correction = postgresFunction("zukan_guard_correction_event_transition");
  const suppression = postgresFunction("zukan_guard_suppression_event_transition");
  const snapshot = postgresFunction("zukan_guard_snapshot_status_transition");
  const publication = postgresFunction("zukan_guard_publication_availability_transition");

  for (const guard of [dispute, correction, suppression, snapshot, publication]) {
    assert.match(guard, /FOR UPDATE/);
    assert.match(guard, /NEW\.recorded_at <= previous_time/);
  }
  assert.match(dispute, /previous_type IS NULL AND NEW\.event_type <> 'opened'/);
  assert.match(correction, /previous_type IS NULL AND NEW\.event_type <> 'submitted'/);
  assert.match(suppression, /previous_type IS NULL AND NEW\.event_type <> 'submitted'/);
  assert.match(snapshot, /NEW\.governance_event_id IS NULL/);
  assert.match(snapshot, /NEW\.reproducibility_status <> snapshot_row\.reproducibility_at_issue/);
  assert.match(snapshot, /NEW\.recorded_at < snapshot_row\.created_at/);
  assert.doesNotMatch(snapshot, /snapshot_row\.issued_at/);
  assert.match(publication, /NEW\.availability_status <> 'available'/);
  assert.match(publication, /previous_status = 'suppressed'[\s\S]*NEW\.availability_status = 'withdrawn'/);
});

test("PostgreSQL validates existing event histories and semantic graph state before activation", () => {
  assert.match(hardening, /existing_append_only_event_history_is_invalid/);
  assert.match(hardening, /existing_content_graph_is_not_acyclic_and_scoped/);
  assert.match(hardening, /existing_suppressed_rows_require_event_migration/);
  assert.match(hardening, /zukan_validate_projection_entry_semantic_edge/);
  assert.match(hardening, /run_claim\.decision = 'accepted'/);
  assert.match(hardening, /artifact\.availability_status = 'available'/);
  assert.match(hardening, /zukan_validate_governance_target/);
  assert.match(hardening, /zukan_validate_suppression_request_target/);
});

test("PostgreSQL publication gate rejects stale, governed, disputed, or revoked inputs", () => {
  const publicationGate = postgresFunction("zukan_validate_publication_edition_gate");
  assert.match(hardening, /idx_zukan_publication_editions_key_label_unique/);
  assert.match(publicationGate, /run\.workspace_id IS NULL/);
  assert.match(publicationGate, /snapshot\.reproducibility_at_issue = 'full'/);
  assert.match(publicationGate, /NEW\.issued_at >= snapshot\.created_at/);
  assert.doesNotMatch(publicationGate, /snapshot\.issued_at/);
  assert.match(publicationGate, /status\.governance_event_id IS NOT NULL/);
  assert.match(publicationGate, /status\.reproducibility_status <> 'full'/);
  assert.match(publicationGate, /run_claim\.decision = 'accepted'/);
  assert.match(publicationGate, /rights\.basis = 'allowed'/);
  assert.match(publicationGate, /rights\.basis IN \('denied', 'unknown'\)/);
  assert.match(publicationGate, /rights\.basis_review_due > NEW\.issued_at/);
  assert.match(publicationGate, /governance\.action IN \('suppress', 'redact', 'erase'\)/);
  assert.match(publicationGate, /revocation\.revocation_mode = 'retroactive'/);
  assert.match(publicationGate, /event\.event_type[\s\S]*'opened', 'under_review', 'reopened'/);
  assert.match(publicationGate, /NOT IN \('rejected', 'withdrawn'\)/);
  assert.match(publicationGate, /zukan_publication_edition_public_gate_failed/);
});

test("PostgreSQL hardening adds bounded-write audit receipts without destructive DML", () => {
  assert.match(hardening, /zukan_foundation_v2_write_receipts/);
  assert.doesNotMatch(hardening, /^\s*(?:UPDATE|DELETE\s+FROM|TRUNCATE)\b/im);
  assert.doesNotMatch(hardening, /\bDROP\s+(?:TABLE|COLUMN)\b/i);
});
