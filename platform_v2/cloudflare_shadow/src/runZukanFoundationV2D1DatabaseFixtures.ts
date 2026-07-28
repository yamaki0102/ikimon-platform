import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  verifyFoundationMigrationSet,
  verifyFoundationEvidenceSourceSha,
} from "../../src/services/zukanFoundationV2EvidenceSourceProvenance.js";
import {
  assertFoundationFixtureTargetName,
  foundationFixtureUuid,
  runFoundationDatabaseFixtureContract,
  type FoundationDatabaseFixtureDriver,
  type FoundationFixture16Result,
  type FoundationFixture17Result,
  type FoundationFixture18Result,
  type FoundationFixture19Result,
  type FoundationFixture20Result,
  type FoundationFixture21Result,
  type FoundationFixture22Result,
  type FoundationFixture23Result,
  type FoundationFixture24Result,
} from "../../src/services/zukanFoundationV2DatabaseFixtureContract.js";
import {
  canonicalFoundationJson,
} from "../../src/services/zukanFoundationV2RepositoryContract.js";

const PREDICATE = "https://zukan.earth/p/fixture-opening-hours";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const HASH_E = "e".repeat(64);
const HASH_F = "f".repeat(64);

function id(caseNumber: number, offset: number): string {
  return foundationFixtureUuid(caseNumber * 100 + offset);
}

export class FoundationD1DatabaseFixtureDriver implements FoundationDatabaseFixtureDriver {
  readonly dialect = "d1" as const;
  private transactionOpen = false;

  constructor(
    private readonly database: DatabaseSync,
    readonly targetName: string,
  ) {
    assertFoundationFixtureTargetName({ dialect: this.dialect, targetName });
    this.database.exec("PRAGMA foreign_keys = ON");
  }

  async beginCase(): Promise<void> {
    if (this.transactionOpen) throw new Error("foundation_fixture_transaction_already_open");
    this.database.exec("BEGIN IMMEDIATE");
    this.transactionOpen = true;
  }

  async rollbackCase(): Promise<void> {
    if (!this.transactionOpen) return;
    this.database.exec("ROLLBACK");
    this.transactionOpen = false;
  }

  private scalar(sql: string, ...values: Array<string | number>): unknown {
    const row = this.database.prepare(sql).get(...values) as Record<string, unknown> | undefined;
    return row ? Object.values(row)[0] : undefined;
  }

  private expectRejected(sql: string): boolean {
    this.database.exec("SAVEPOINT expected_rejection");
    try {
      this.database.exec(sql);
      this.database.exec("RELEASE expected_rejection");
      return false;
    } catch {
      this.database.exec("ROLLBACK TO expected_rejection");
      this.database.exec("RELEASE expected_rejection");
      return true;
    }
  }

  private canExecute(sql: string): boolean {
    this.database.exec("SAVEPOINT expected_success");
    try {
      this.database.exec(sql);
      this.database.exec("ROLLBACK TO expected_success");
      this.database.exec("RELEASE expected_success");
      return true;
    } catch {
      this.database.exec("ROLLBACK TO expected_success");
      this.database.exec("RELEASE expected_success");
      return false;
    }
  }

  private seedSubjectAndPredicate(caseNumber: number): {
    subject: string;
    owner: string;
  } {
    const subject = id(caseNumber, 1);
    const owner = id(caseNumber, 2);
    this.database.exec(`
      INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
      VALUES ('${subject}', 'fixture-tenant', 'place'),
             ('${owner}', 'fixture-tenant', 'agent');
      INSERT INTO zukan_predicate_definitions(
        predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile
      ) VALUES (
        '${PREDICATE}', 1, 'string', 'one', 'positive_or_negative', 'valid_time'
      );
    `);
    return { subject, owner };
  }

  private seedClaims(
    caseNumber: number,
    cityVisibility: "internal" | "public" = "internal",
  ): {
    subject: string;
    owner: string;
    cityRevision: string;
    ownerRevision: string;
    laterRevision: string;
    cityArtifact: string;
    watermark: number;
  } {
    const { subject, owner } = this.seedSubjectAndPredicate(caseNumber);
    const cityClaim = id(caseNumber, 10);
    const ownerClaim = id(caseNumber, 11);
    const laterClaim = id(caseNumber, 12);
    const cityArtifact = id(caseNumber, 20);
    const ownerArtifact = id(caseNumber, 21);
    const laterArtifact = id(caseNumber, 22);
    const cityRevision = id(caseNumber, 30);
    const ownerRevision = id(caseNumber, 31);
    const laterRevision = id(caseNumber, 32);
    this.database.exec(`
      INSERT INTO zukan_claims(
        claim_id, subject_id, predicate_uri, predicate_version, tenant_id
      ) VALUES
        ('${cityClaim}', '${subject}', '${PREDICATE}', 1, 'fixture-tenant'),
        ('${ownerClaim}', '${subject}', '${PREDICATE}', 1, 'fixture-tenant'),
        ('${laterClaim}', '${subject}', '${PREDICATE}', 1, 'fixture-tenant');
      INSERT INTO zukan_value_artifacts(artifact_id, value_text)
      VALUES ('${cityArtifact}', '09-17'),
             ('${ownerArtifact}', '10-18'),
             ('${laterArtifact}', '24h');
      INSERT INTO zukan_claim_revisions(
        claim_revision_id, claim_id, revision, predicate_uri, predicate_version,
        value_artifact_id, asserted_by_subject_id, observed_at, visibility
      ) VALUES
        ('${cityRevision}', '${cityClaim}', 1, '${PREDICATE}', 1,
         '${cityArtifact}', '${owner}', '2026-01-01T00:00:00.000Z', '${cityVisibility}'),
        ('${ownerRevision}', '${ownerClaim}', 1, '${PREDICATE}', 1,
         '${ownerArtifact}', '${owner}', '2026-01-01T00:00:00.000Z', 'internal');
    `);
    const watermark = Number(this.scalar(
      "SELECT max(recorded_sequence) FROM zukan_claim_revisions",
    ));
    this.database.exec(`
      INSERT INTO zukan_claim_revisions(
        claim_revision_id, claim_id, revision, predicate_uri, predicate_version,
        value_artifact_id, asserted_by_subject_id, observed_at, visibility
      ) VALUES (
        '${laterRevision}', '${laterClaim}', 1, '${PREDICATE}', 1,
        '${laterArtifact}', '${owner}', '2027-01-01T00:00:00.000Z', 'internal'
      );
    `);
    return {
      subject,
      owner,
      cityRevision,
      ownerRevision,
      laterRevision,
      cityArtifact,
      watermark,
    };
  }

  private seedResolution(input: {
    caseNumber: number;
    subject: string;
    watermark: number;
    status: "resolved" | "disputed";
  }): string {
    const policy = id(input.caseNumber, 40);
    const run = id(input.caseNumber, 41);
    this.database.prepare(
      `INSERT INTO zukan_resolution_policy_versions(
         resolution_policy_id, policy_key, policy_version, rules_json
       ) VALUES (?, 'fixture-hours', 1, '{}')`,
    ).run(policy);
    this.database.prepare(
      `INSERT INTO zukan_resolution_runs(
         resolution_run_id, tenant_id, subject_id, predicate_uri, predicate_version,
         candidate_query_id, candidate_query_version, claim_store_snapshot_token,
         claim_store_sequence_watermark, recorded_time_watermark,
         predicate_registry_snapshot_hash, authority_snapshot_hash,
         resolution_policy_id, evaluator_build, input_hash, output_hash, run_status
       ) VALUES (
         ?, 'fixture-tenant', ?, ?, 1, 'fixture-query', 1, ?, ?,
         '2026-12-31T23:59:59.000Z', ?, ?, ?, 'fixture-build', ?, ?, ?
       )`,
    ).run(
      run,
      input.subject,
      PREDICATE,
      `seq:${input.watermark}`,
      input.watermark,
      HASH_A,
      HASH_B,
      policy,
      HASH_C,
      HASH_D,
      input.status,
    );
    return run;
  }

  private seedPublishableProjection(input: {
    caseNumber: number;
    publicationRightsValidTo?: string | null;
    snapshotHash?: string;
  }): {
    subject: string;
    owner: string;
    cityRevision: string;
    cityArtifact: string;
    run: string;
    snapshot: string;
  } {
    const seeded = this.seedClaims(input.caseNumber, "public");
    const run = this.seedResolution({
      caseNumber: input.caseNumber,
      subject: seeded.subject,
      watermark: seeded.watermark,
      status: "resolved",
    });
    const snapshot = id(input.caseNumber, 50);
    const validTo = input.publicationRightsValidTo
      ? `'${input.publicationRightsValidTo}'`
      : "NULL";
    this.database.exec(`
      INSERT INTO zukan_rights_evaluations(
        rights_evaluation_id, value_artifact_id, purpose, basis, valid_from, valid_to
      ) VALUES (
        '${id(input.caseNumber, 60)}', '${seeded.cityArtifact}',
        'publication', 'allowed', '2025-01-01T00:00:00.000Z', ${validTo}
      );
      INSERT INTO zukan_resolution_run_claims(
        resolution_run_id, claim_revision_id, decision, reason_code, authority_rank, candidate_ordinal
      ) VALUES ('${run}', '${seeded.cityRevision}', 'accepted', 'fixture', 100, 0);
      INSERT INTO zukan_projection_snapshots(
        projection_snapshot_id, resolution_run_id, snapshot_hash,
        reproducibility_at_issue, issued_at
      ) VALUES (
        '${snapshot}', '${run}', '${input.snapshotHash ?? HASH_E}', 'full', '2026-01-02T00:00:00.000Z'
      );
      INSERT INTO zukan_projection_entries(
        projection_snapshot_id, entry_key, claim_revision_id, value_artifact_id
      ) VALUES ('${snapshot}', 'opening-hours', '${seeded.cityRevision}', '${seeded.cityArtifact}');
    `);
    return {
      subject: seeded.subject,
      owner: seeded.owner,
      cityRevision: seeded.cityRevision,
      cityArtifact: seeded.cityArtifact,
      run,
      snapshot,
    };
  }

  async fixture16IdentitySplit(): Promise<FoundationFixture16Result> {
    const publishable = this.seedPublishableProjection({
      caseNumber: 16,
      snapshotHash: HASH_F,
    });
    const subjectA = publishable.subject;
    const subjectB = id(16, 70);
    const publicIdentifier = id(16, 6);
    const resolutionSet = id(16, 7);
    const assertion = id(16, 8);
    this.database.exec(`
      INSERT INTO zukan_publication_editions(
        publication_edition_id, publication_key, edition_label,
        projection_snapshot_id, manifest_hash, issued_at
      ) VALUES (
        '${id(16, 61)}', 'fixture-old-publication', 'v1',
        '${publishable.snapshot}', '${"9".repeat(64)}', '2026-06-01T00:00:00.000Z'
      );
      INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
      VALUES ('${subjectB}', 'fixture-tenant', 'place');
      INSERT INTO zukan_public_identifiers(
        public_identifier_id, identifier_uri, target_kind, target_id
      ) VALUES (
        '${publicIdentifier}', 'https://zukan.earth/id/fixture-old',
        'subject_identity', '${subjectA}'
      );
      INSERT INTO zukan_identity_resolution_sets(
        resolution_set_id, valid_from
      ) VALUES ('${resolutionSet}', '2027-01-01T00:00:00.000Z');
      INSERT INTO zukan_identity_membership_assertions(
        membership_assertion_id, resolution_set_id, subject_id, membership_state, valid_from
      ) VALUES
        ('${id(16, 9)}', '${resolutionSet}', '${subjectA}', 'candidate', '2027-01-01T00:00:00.000Z'),
        ('${id(16, 10)}', '${resolutionSet}', '${subjectB}', 'candidate', '2027-01-01T00:00:00.000Z');
      INSERT INTO zukan_canonical_identity_assertions(
        canonical_assertion_id, public_identifier_id, assertion_mode, resolution_set_id, valid_from
      ) VALUES (
        '${assertion}', '${publicIdentifier}', 'ambiguous',
        '${resolutionSet}', '2027-01-01T00:00:00.000Z'
      );
      INSERT INTO zukan_canonical_identity_candidates(
        canonical_assertion_id, subject_id, ordinal
      ) VALUES ('${assertion}', '${subjectA}', 0),
               ('${assertion}', '${subjectB}', 1);
    `);
    return {
      assertionMode: String(this.scalar(
        "SELECT assertion_mode FROM zukan_canonical_identity_assertions WHERE canonical_assertion_id = ?",
        assertion,
      )),
      candidateCount: Number(this.scalar(
        "SELECT count(*) FROM zukan_canonical_identity_candidates WHERE canonical_assertion_id = ?",
        assertion,
      )),
      oldSnapshotHash: String(this.scalar(
        "SELECT snapshot_hash FROM zukan_projection_snapshots WHERE projection_snapshot_id = ?",
        publishable.snapshot,
      )),
      oldPublicationManifestHash: String(this.scalar(
        "SELECT manifest_hash FROM zukan_publication_editions WHERE projection_snapshot_id = ?",
        publishable.snapshot,
      )),
    };
  }

  async fixture17NonDetectionThenDetection(): Promise<FoundationFixture17Result> {
    const taxon = id(17, 1);
    const surveyA = id(17, 2);
    const surveyB = id(17, 3);
    this.database.exec(`
      INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
      VALUES ('${taxon}', 'fixture-tenant', 'taxon');
      INSERT INTO zukan_survey_events(
        survey_event_id, tenant_id, subject_scope_json, method_json, effort_json,
        started_at, ended_at
      ) VALUES
        ('${surveyA}', 'fixture-tenant', '{}', '{}', '{}',
         '2024-01-01T00:00:00.000Z', '2024-01-02T00:00:00.000Z'),
        ('${surveyB}', 'fixture-tenant', '{}', '{}', '{}',
         '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
      INSERT INTO zukan_detection_outcomes(
        detection_outcome_id, survey_event_id, subject_id, outcome, recorded_at
      ) VALUES
        ('${id(17, 4)}', '${surveyA}', '${taxon}', 'not_detected', '2024-01-02T00:00:01.000Z'),
        ('${id(17, 5)}', '${surveyB}', '${taxon}', 'detected', '2026-01-01T12:00:00.000Z');
    `);
    return {
      outcomeCount: Number(this.scalar(
        "SELECT count(*) FROM zukan_detection_outcomes WHERE subject_id = ?",
        taxon,
      )),
      distinctSurveyCount: Number(this.scalar(
        "SELECT count(DISTINCT survey_event_id) FROM zukan_detection_outcomes WHERE subject_id = ?",
        taxon,
      )),
      claimCount: Number(this.scalar("SELECT count(*) FROM zukan_claims")),
    };
  }

  async fixture18PendingDisputePublicationGate(): Promise<FoundationFixture18Result> {
    const publishable = this.seedPublishableProjection({ caseNumber: 18 });
    const dispute = id(18, 51);
    this.database.exec(`
      INSERT INTO zukan_dispute_cases(
        dispute_case_id, subject_id, predicate_uri, predicate_version, resolution_run_id, opened_at
      ) VALUES (
        '${dispute}', '${publishable.subject}', '${PREDICATE}', 1,
        '${publishable.run}', '2027-01-01T00:00:00.000Z'
      );
      INSERT INTO zukan_dispute_case_events(
        dispute_case_event_id, dispute_case_id, event_type, recorded_at
      ) VALUES (
        '${id(18, 52)}', '${dispute}', 'opened', '2027-01-01T00:00:01.000Z'
      );
    `);
    const publicationSql = `
      INSERT INTO zukan_publication_editions(
        publication_edition_id, publication_key, edition_label,
        projection_snapshot_id, manifest_hash, issued_at
      ) VALUES (
        '${id(18, 53)}', 'fixture-publication', 'v1',
        '${publishable.snapshot}', '${HASH_F}', '2027-01-02T00:00:00.000Z'
      )
    `;
    const rejected = this.expectRejected(publicationSql);
    const pendingDisputeCount = Number(this.scalar(
      `SELECT count(*) FROM zukan_dispute_cases
        WHERE dispute_case_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM zukan_dispute_case_events
             WHERE dispute_case_id = ? AND event_type IN ('resolved', 'dismissed')
          )`,
      dispute,
      dispute,
    ));
    this.database.exec(`
      INSERT INTO zukan_dispute_case_events(
        dispute_case_event_id, dispute_case_id, event_type, recorded_at
      ) VALUES (
        '${id(18, 54)}', '${dispute}', 'resolved', '2027-01-01T00:00:02.000Z'
      )
    `);
    const publicationAfterDisputeClosed = this.canExecute(publicationSql);
    return {
      pendingDisputeCount,
      publicationRejected: rejected,
      publicationAfterDisputeClosed,
    };
  }

  async fixture19PredicateBreakingChange(): Promise<FoundationFixture19Result> {
    const { subject } = this.seedSubjectAndPredicate(19);
    const claim = id(19, 10);
    this.database.exec(`
      INSERT INTO zukan_claims(
        claim_id, subject_id, predicate_uri, predicate_version, tenant_id
      ) VALUES ('${claim}', '${subject}', '${PREDICATE}', 1, 'fixture-tenant');
    `);
    const rejected = this.expectRejected(`
      UPDATE zukan_predicate_definitions
         SET polarity_mode = 'positive_only'
       WHERE predicate_uri = '${PREDICATE}' AND predicate_version = 1
    `);
    this.database.exec(`
      INSERT INTO zukan_predicate_definitions(
        predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile
      ) VALUES (
        '${PREDICATE}-v2', 1, 'string', 'one', 'positive_only', 'valid_time'
      )
    `);
    return {
      destructiveMutationRejected: rejected,
      replacementPredicateCount: Number(this.scalar(
        "SELECT count(*) FROM zukan_predicate_definitions WHERE predicate_uri = ?",
        `${PREDICATE}-v2`,
      )),
      legacyClaimPredicateVersion: Number(this.scalar(
        "SELECT predicate_version FROM zukan_claims WHERE claim_id = ?",
        claim,
      )),
    };
  }

  async fixture20PolicyAndWatermark(): Promise<FoundationFixture20Result> {
    const seeded = this.seedClaims(20);
    const run = this.seedResolution({
      caseNumber: 20,
      subject: seeded.subject,
      watermark: seeded.watermark,
      status: "disputed",
    });
    const rejected = this.expectRejected(`
      UPDATE zukan_resolution_runs
         SET claim_store_sequence_watermark = 999
       WHERE resolution_run_id = '${run}'
    `);
    return {
      revisionsAtWatermark: Number(this.scalar(
        "SELECT count(*) FROM zukan_claim_revisions WHERE recorded_sequence <= ?",
        seeded.watermark,
      )),
      allRevisions: Number(this.scalar("SELECT count(*) FROM zukan_claim_revisions")),
      watermarkMutationRejected: rejected,
    };
  }

  async fixture21RightsExpiry(): Promise<FoundationFixture21Result> {
    const publishable = this.seedPublishableProjection({
      caseNumber: 21,
      publicationRightsValidTo: "2027-01-01T00:00:00.000Z",
    });
    const embedding = id(21, 2);
    this.database.exec(`
      INSERT INTO zukan_content_objects(content_object_id, object_kind)
      VALUES ('${embedding}', 'embedding');
      INSERT INTO zukan_rights_evaluations(
        rights_evaluation_id, value_artifact_id, content_object_id,
        purpose, basis, valid_from, valid_to
      ) VALUES
        ('${id(21, 4)}', '${publishable.cityArtifact}', NULL, 'preservation', 'allowed',
         '2025-01-01T00:00:00.000Z', NULL),
        ('${id(21, 5)}', NULL, '${embedding}', 'embedding', 'unknown',
         '2025-01-01T00:00:00.000Z', NULL);
    `);
    const publicationSql = (publicationId: string, manifestHash: string, issuedAt: string) => `
      INSERT INTO zukan_publication_editions(
        publication_edition_id, publication_key, edition_label,
        projection_snapshot_id, manifest_hash, issued_at
      ) VALUES (
        '${publicationId}', 'fixture-rights', '${issuedAt}',
        '${publishable.snapshot}', '${manifestHash}', '${issuedAt}'
      )
    `;
    const publicationAt2026 = this.canExecute(publicationSql(
      id(21, 70),
      HASH_F,
      "2026-06-01T00:00:00.000Z",
    ));
    const publicationAt2028Rejected = this.expectRejected(publicationSql(
      id(21, 71),
      "8".repeat(64),
      "2028-01-01T00:00:00.000Z",
    ));
    return {
      publicationAt2026: publicationAt2026 ? "allow" : "deny",
      publicationAt2028: publicationAt2028Rejected ? "deny" : "allow",
      preservationAt2028: String(this.scalar(
        "SELECT CASE WHEN basis = 'allowed' AND valid_to IS NULL THEN 'allow' ELSE 'deny' END FROM zukan_rights_evaluations WHERE value_artifact_id = ? AND purpose = 'preservation'",
        publishable.cityArtifact,
      )) as "allow" | "deny",
      embeddingAt2026: String(this.scalar(
        "SELECT CASE WHEN basis = 'unknown' THEN 'review' ELSE basis END FROM zukan_rights_evaluations WHERE content_object_id = ? AND purpose = 'embedding'",
        embedding,
      )) as "allow" | "deny" | "review",
    };
  }

  async fixture22EraseAndDegradedReplay(): Promise<FoundationFixture22Result> {
    const seeded = this.seedClaims(22);
    const run = this.seedResolution({
      caseNumber: 22,
      subject: seeded.subject,
      watermark: seeded.watermark,
      status: "resolved",
    });
    const snapshot = id(22, 50);
    const governance = id(22, 51);
    this.database.exec(`
      INSERT INTO zukan_resolution_run_claims(
        resolution_run_id, claim_revision_id, decision, reason_code, authority_rank, candidate_ordinal
      ) VALUES ('${run}', '${seeded.cityRevision}', 'accepted', 'fixture', 100, 0);
      INSERT INTO zukan_projection_snapshots(
        projection_snapshot_id, resolution_run_id, snapshot_hash,
        reproducibility_at_issue, issued_at
      ) VALUES (
        '${snapshot}', '${run}', '${HASH_E}', 'full', '2027-01-01T00:00:00.000Z'
      );
      INSERT INTO zukan_projection_entries(
        projection_snapshot_id, entry_key, claim_revision_id, value_artifact_id
      ) VALUES ('${snapshot}', 'person', '${seeded.cityRevision}', '${seeded.cityArtifact}');
      INSERT INTO zukan_content_governance_events(
        governance_event_id, action, target_kind, target_id, reason, effective_at, recorded_at
      ) VALUES (
        '${governance}', 'erase', 'value_artifact', '${seeded.cityArtifact}',
        'fixture-legal', '2027-01-01T00:01:00.000Z', '2027-01-01T00:02:00.000Z'
      );
      INSERT INTO zukan_snapshot_status_events(
        snapshot_status_event_id, projection_snapshot_id, governance_event_id,
        reproducibility_status, affected_entry_keys_json, recorded_at
      ) VALUES (
        '${id(22, 52)}', '${snapshot}', '${governance}', 'degraded',
        '["person"]', '2027-01-01T00:03:00.000Z'
      );
      UPDATE zukan_value_artifacts
         SET value_text = NULL,
             content_sha256 = NULL,
             storage_locator = NULL,
             availability_status = 'erased',
             redacted_at = '2027-01-01T00:04:00.000Z'
       WHERE artifact_id = '${seeded.cityArtifact}';
    `);
    return {
      snapshotHash: String(this.scalar(
        "SELECT snapshot_hash FROM zukan_projection_snapshots WHERE projection_snapshot_id = ?",
        snapshot,
      )),
      artifactAvailability: String(this.scalar(
        "SELECT availability_status FROM zukan_value_artifacts WHERE artifact_id = ?",
        seeded.cityArtifact,
      )),
      reproducibilityStatus: String(this.scalar(
        "SELECT reproducibility_status FROM zukan_snapshot_status_events WHERE projection_snapshot_id = ?",
        snapshot,
      )),
    };
  }

  async fixture23ProspectiveRevocation(): Promise<FoundationFixture23Result> {
    const seeded = this.seedClaims(23, "public");
    const owner = seeded.owner;
    const trustAnchor = id(23, 2);
    const assertion = id(23, 3);
    const prospective = id(23, 4);
    const retroactive = id(23, 5);
    this.database.exec(`
      INSERT INTO zukan_trust_anchors(
        trust_anchor_id, tenant_id, anchor_method, external_reference,
        assurance_level, valid_from, policy_version
      ) VALUES (
        '${trustAnchor}', 'fixture-tenant', 'authenticated_account',
        'fixture-owner', 90, '2025-01-01T00:00:00.000Z', 'v1'
      );
      INSERT INTO zukan_authority_assertions(
        authority_assertion_id, authority_subject_id, trust_anchor_id,
        authority_rank, valid_from
      ) VALUES (
        '${assertion}', '${owner}', '${trustAnchor}', 100,
        '2025-01-01T00:00:00.000Z'
      );
      INSERT INTO zukan_claim_authority_links(claim_revision_id, authority_assertion_id)
      VALUES ('${seeded.cityRevision}', '${assertion}');
    `);
    const run = this.seedResolution({
      caseNumber: 23,
      subject: seeded.subject,
      watermark: seeded.watermark,
      status: "resolved",
    });
    const snapshot = id(23, 50);
    const governance = id(23, 51);
    this.database.exec(`
      INSERT INTO zukan_resolution_run_claims(
        resolution_run_id, claim_revision_id, decision, reason_code, authority_rank, candidate_ordinal
      ) VALUES ('${run}', '${seeded.cityRevision}', 'accepted', 'fixture', 100, 0);
      INSERT INTO zukan_projection_snapshots(
        projection_snapshot_id, resolution_run_id, snapshot_hash,
        reproducibility_at_issue, issued_at
      ) VALUES (
        '${snapshot}', '${run}', '${HASH_E}', 'full', '2026-01-02T00:00:00.000Z'
      );
      INSERT INTO zukan_projection_entries(
        projection_snapshot_id, entry_key, claim_revision_id, value_artifact_id
      ) VALUES ('${snapshot}', 'opening-hours', '${seeded.cityRevision}', '${seeded.cityArtifact}');
      INSERT INTO zukan_authority_revocation_events(
        revocation_event_id, authority_assertion_id, revocation_mode, effective_at, reason
      ) VALUES (
        '${prospective}', '${assertion}', 'prospective',
        '2027-01-01T00:00:00.000Z', 'delegation-ended'
      );
      INSERT INTO zukan_content_governance_events(
        governance_event_id, action, target_kind, target_id, reason, effective_at, recorded_at
      ) VALUES (
        '${governance}', 'redact', 'claim_revision', '${seeded.cityRevision}',
        'retroactive-authority-revocation',
        '2028-01-01T00:00:00.000Z', '2028-01-01T00:00:01.000Z'
      );
      INSERT INTO zukan_snapshot_status_events(
        snapshot_status_event_id, projection_snapshot_id, governance_event_id,
        reproducibility_status, affected_entry_keys_json, recorded_at
      ) VALUES (
        '${id(23, 52)}', '${snapshot}', '${governance}', 'redacted',
        '["opening-hours"]', '2028-01-01T00:00:02.000Z'
      );
      INSERT INTO zukan_authority_revocation_events(
        revocation_event_id, authority_assertion_id, revocation_mode,
        effective_at, reason, impact_json
      ) VALUES (
        '${retroactive}', '${assertion}', 'retroactive',
        '2028-01-01T00:00:00.000Z', 'impersonation', '["${snapshot}"]'
      );
    `);
    const rejected = this.expectRejected(`
      UPDATE zukan_authority_revocation_events
         SET revocation_mode = 'retroactive'
       WHERE revocation_event_id = '${prospective}'
    `);
    const prospectiveEffective = String(this.scalar(
      "SELECT effective_at FROM zukan_authority_revocation_events WHERE revocation_event_id = ?",
      prospective,
    ));
    return {
      prospectivePastValid: "2026-01-01T00:00:00.000Z" < prospectiveEffective,
      prospectiveFutureValid: "2028-01-01T00:00:00.000Z" < prospectiveEffective,
      retroactivePastValid: Number(this.scalar(
        `SELECT CASE WHEN EXISTS (
           SELECT 1 FROM zukan_authority_revocation_events
            WHERE authority_assertion_id = ? AND revocation_mode = 'retroactive'
              AND julianday(effective_at) <= julianday('2028-01-01T00:00:00.000Z')
         ) THEN 0 ELSE 1 END`,
        assertion,
      )) === 1,
      prospectiveMutationRejected: rejected,
    };
  }

  async fixture24EqualAuthorityDispute(): Promise<FoundationFixture24Result> {
    const seeded = this.seedClaims(24);
    const run = this.seedResolution({
      caseNumber: 24,
      subject: seeded.subject,
      watermark: seeded.watermark,
      status: "disputed",
    });
    const dispute = id(24, 50);
    this.database.exec(`
      INSERT INTO zukan_resolution_run_claims(
        resolution_run_id, claim_revision_id, decision, reason_code, authority_rank, candidate_ordinal
      ) VALUES
        ('${run}', '${seeded.cityRevision}', 'candidate', 'equal_authority', 100, 0),
        ('${run}', '${seeded.ownerRevision}', 'candidate', 'equal_authority', 100, 1);
      INSERT INTO zukan_dispute_cases(
        dispute_case_id, subject_id, predicate_uri, predicate_version, resolution_run_id
      ) VALUES ('${dispute}', '${seeded.subject}', '${PREDICATE}', 1, '${run}');
      INSERT INTO zukan_dispute_case_events(
        dispute_case_event_id, dispute_case_id, event_type
      ) VALUES ('${id(24, 51)}', '${dispute}', 'opened');
    `);
    return {
      acceptedCount: Number(this.scalar(
        "SELECT count(*) FROM zukan_resolution_run_claims WHERE resolution_run_id = ? AND decision = 'accepted'",
        run,
      )),
      disputeEvent: String(this.scalar(
        "SELECT event_type FROM zukan_dispute_case_events WHERE dispute_case_id = ?",
        dispute,
      )),
    };
  }
}

const D1_MIGRATIONS = [
  "0009_zukan_foundation_v2_source_identity.sql",
  "0010_zukan_foundation_v2_predicate_claims.sql",
  "0011_zukan_foundation_v2_authority_resolution.sql",
  "0012_zukan_foundation_v2_governance_rights.sql",
  "0013_zukan_foundation_v2_disputes_coverage.sql",
  "0014_zukan_foundation_v2_integrity_hardening.sql",
] as const;

export function applyFoundationD1FixtureMigrations(
  database: DatabaseSync,
  migrationDirectory: string,
): void {
  const existing = Number((database.prepare(
    "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name LIKE 'zukan_%'",
  ).get() as { count: number }).count);
  if (existing !== 0) throw new Error("foundation_fixture_d1_migrations_require_empty_target");
  database.exec("PRAGMA foreign_keys = ON");
  for (const migration of D1_MIGRATIONS) {
    database.exec(readFileSync(path.join(migrationDirectory, migration), "utf8"));
  }
}

type D1FixtureCli = {
  databasePath: string;
  migrationDirectory: string;
  sourceSha: string;
  confirmation: string;
};

function argument(argv: readonly string[], prefix: string): string | null {
  const values = argv.filter((item) => item.startsWith(prefix));
  if (values.length > 1) throw new Error(`foundation_fixture_duplicate_argument:${prefix}`);
  return values.length === 0 ? null : values[0]!.slice(prefix.length).trim();
}

export function parseFoundationD1FixtureCli(argv: readonly string[]): D1FixtureCli {
  const prefixes = [
    "--database-path=",
    "--migration-directory=",
    "--source-sha=",
    "--confirm-scratch-target=",
  ];
  const unknown = argv.find((item) => !prefixes.some((prefix) => item.startsWith(prefix)));
  if (unknown) throw new Error(`foundation_fixture_unknown_argument:${unknown}`);
  const databasePath = path.resolve(argument(argv, "--database-path=") ?? "");
  const targetName = path.basename(databasePath);
  assertFoundationFixtureTargetName({ dialect: "d1", targetName });
  const confirmation = argument(argv, "--confirm-scratch-target=") ?? "";
  if (confirmation !== targetName) {
    throw new Error("foundation_fixture_scratch_confirmation_mismatch");
  }
  const sourceSha = argument(argv, "--source-sha=") ?? "";
  if (!/^[0-9a-fA-F]{40}$/u.test(sourceSha)) {
    throw new Error("foundation_fixture_source_sha_must_be_full_commit");
  }
  const migrationDirectoryRaw = argument(argv, "--migration-directory=");
  if (!migrationDirectoryRaw) {
    throw new Error("foundation_fixture_migration_directory_required");
  }
  return {
    databasePath,
    migrationDirectory: path.resolve(migrationDirectoryRaw),
    sourceSha: sourceSha.toLowerCase(),
    confirmation,
  };
}

export function assertFoundationD1ScratchFileAbsent(
  databasePath: string,
  fileExists: (value: string) => boolean = existsSync,
): void {
  if (fileExists(databasePath)) {
    throw new Error("foundation_fixture_existing_database_refused");
  }
}

async function main(): Promise<void> {
  const options = parseFoundationD1FixtureCli(process.argv.slice(2));
  const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
  verifyFoundationEvidenceSourceSha({
    sourceSha: options.sourceSha,
    repositoryRoot,
  });
  const migrationProvenance = verifyFoundationMigrationSet({
    repositoryRoot,
    migrationDirectory: options.migrationDirectory,
    expectedRelativeDirectory: "platform_v2/cloudflare_shadow/migrations/core",
    migrationFiles: D1_MIGRATIONS,
  });
  assertFoundationD1ScratchFileAbsent(options.databasePath);
  const database = new DatabaseSync(options.databasePath, {
    enableForeignKeyConstraints: true,
  });
  try {
    applyFoundationD1FixtureMigrations(database, options.migrationDirectory);
    const evidence = await runFoundationDatabaseFixtureContract(
      new FoundationD1DatabaseFixtureDriver(database, path.basename(options.databasePath)),
    );
    process.stdout.write(`${canonicalFoundationJson({
      ...evidence,
      sourceSha: options.sourceSha,
      migrationExecution: {
        appliedByRunner: true,
        provenance: migrationProvenance,
      },
    })}\n`);
    if (evidence.failed > 0) process.exitCode = 2;
  } finally {
    database.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
