import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationFiles = [
  "0134_zukan_foundation_v2_source_identity.sql",
  "0135_zukan_foundation_v2_predicate_claims.sql",
  "0136_zukan_foundation_v2_authority_resolution.sql",
  "0137_zukan_foundation_v2_governance_rights.sql",
  "0138_zukan_foundation_v2_disputes_coverage.sql",
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
