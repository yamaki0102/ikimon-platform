import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
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
} from "../services/zukanFoundationV2DatabaseFixtureContract.js";
import {
  verifyFoundationMigrationSet,
  verifyFoundationEvidenceSourceSha,
} from "../services/zukanFoundationV2EvidenceSourceProvenance.js";
import {
  canonicalFoundationJson,
} from "../services/zukanFoundationV2RepositoryContract.js";

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

export class FoundationPostgresDatabaseFixtureDriver implements FoundationDatabaseFixtureDriver {
  readonly dialect = "postgres" as const;
  private client: PoolClient | null = null;

  constructor(
    private readonly pool: Pool,
    readonly targetName: string,
  ) {
    assertFoundationFixtureTargetName({ dialect: this.dialect, targetName });
  }

  async beginCase(): Promise<void> {
    if (this.client) throw new Error("foundation_fixture_transaction_already_open");
    const client = await this.pool.connect();
    this.client = client;
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path = public");
      await client.query("SET LOCAL statement_timeout = '30s'");
    } catch (error) {
      this.client = null;
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
      throw error;
    }
  }

  async rollbackCase(): Promise<void> {
    if (!this.client) return;
    const client = this.client;
    this.client = null;
    try {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  private connection(): PoolClient {
    if (!this.client) throw new Error("foundation_fixture_transaction_not_open");
    return this.client;
  }

  private async exec(sql: string, params?: unknown[]): Promise<void> {
    await this.connection().query(sql, params);
  }

  private async scalar(sql: string, params?: unknown[]): Promise<unknown> {
    const result = await this.connection().query(sql, params);
    const row = result.rows[0];
    return row ? Object.values(row)[0] : undefined;
  }

  private async expectRejected(sql: string): Promise<boolean> {
    const client = this.connection();
    await client.query("SAVEPOINT expected_rejection");
    try {
      await client.query(sql);
      await client.query("RELEASE SAVEPOINT expected_rejection");
      return false;
    } catch {
      await client.query("ROLLBACK TO SAVEPOINT expected_rejection");
      await client.query("RELEASE SAVEPOINT expected_rejection");
      return true;
    }
  }

  private async canExecute(sql: string): Promise<boolean> {
    const client = this.connection();
    await client.query("SAVEPOINT expected_success");
    try {
      await client.query(sql);
      await client.query("ROLLBACK TO SAVEPOINT expected_success");
      await client.query("RELEASE SAVEPOINT expected_success");
      return true;
    } catch {
      await client.query("ROLLBACK TO SAVEPOINT expected_success");
      await client.query("RELEASE SAVEPOINT expected_success");
      return false;
    }
  }

  private async seedSubjectAndPredicate(caseNumber: number): Promise<{
    subject: string;
    owner: string;
  }> {
    const subject = id(caseNumber, 1);
    const owner = id(caseNumber, 2);
    await this.exec(`
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

  private async seedClaims(
    caseNumber: number,
    cityVisibility: "private" | "public" = "private",
  ): Promise<{
    subject: string;
    owner: string;
    cityRevision: string;
    ownerRevision: string;
    laterRevision: string;
    cityArtifact: string;
    watermark: number;
  }> {
    const { subject, owner } = await this.seedSubjectAndPredicate(caseNumber);
    const cityClaim = id(caseNumber, 10);
    const ownerClaim = id(caseNumber, 11);
    const laterClaim = id(caseNumber, 12);
    const cityArtifact = id(caseNumber, 20);
    const ownerArtifact = id(caseNumber, 21);
    const laterArtifact = id(caseNumber, 22);
    const cityRevision = id(caseNumber, 30);
    const ownerRevision = id(caseNumber, 31);
    const laterRevision = id(caseNumber, 32);
    await this.exec(`
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
         '${ownerArtifact}', '${owner}', '2026-01-01T00:00:00.000Z', 'private');
    `);
    const watermark = Number(await this.scalar(
      "SELECT max(recorded_sequence) FROM zukan_claim_revisions",
    ));
    await this.exec(`
      INSERT INTO zukan_claim_revisions(
        claim_revision_id, claim_id, revision, predicate_uri, predicate_version,
        value_artifact_id, asserted_by_subject_id, observed_at, visibility
      ) VALUES (
        '${laterRevision}', '${laterClaim}', 1, '${PREDICATE}', 1,
        '${laterArtifact}', '${owner}', '2027-01-01T00:00:00.000Z', 'private'
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

  private async seedResolution(input: {
    caseNumber: number;
    subject: string;
    watermark: number;
    status: "resolved" | "disputed";
  }): Promise<string> {
    const policy = id(input.caseNumber, 40);
    const run = id(input.caseNumber, 41);
    await this.exec(`
      INSERT INTO zukan_resolution_policy_versions(
        policy_id, policy_version, policy_definition, evaluator_contract_version
      ) VALUES ('${policy}', 1, '{}'::jsonb, 'fixture-v1');
      INSERT INTO zukan_resolution_runs(
        resolution_run_id, tenant_id, subject_id, predicate_uri, predicate_version,
        candidate_query_id, candidate_query_version, claim_store_snapshot_token,
        claim_store_sequence_watermark, recorded_time_watermark,
        predicate_registry_snapshot_hash, authority_snapshot_hash,
        policy_id, policy_version, evaluator_build,
        input_hash, output_hash, resolution_status
      ) VALUES (
        '${run}', 'fixture-tenant', '${input.subject}', '${PREDICATE}', 1,
        'fixture-query', 1, 'seq:${input.watermark}', ${input.watermark},
        '2026-12-31T23:59:59.000Z', '${HASH_A}', '${HASH_B}',
        '${policy}', 1, 'fixture-build', '${HASH_C}', '${HASH_D}', '${input.status}'
      );
    `);
    return run;
  }

  private async seedPublishableProjection(input: {
    caseNumber: number;
    publicationRightsValidTo?: string | null;
    snapshotHash?: string;
  }): Promise<{
    subject: string;
    owner: string;
    cityRevision: string;
    cityArtifact: string;
    run: string;
    snapshot: string;
  }> {
    const seeded = await this.seedClaims(input.caseNumber, "public");
    const run = await this.seedResolution({
      caseNumber: input.caseNumber,
      subject: seeded.subject,
      watermark: seeded.watermark,
      status: "resolved",
    });
    const snapshot = id(input.caseNumber, 50);
    const validTo = input.publicationRightsValidTo
      ? `'${input.publicationRightsValidTo}'::timestamptz`
      : "NULL";
    await this.exec(`
      INSERT INTO zukan_rights_evaluations(
        rights_evaluation_id, value_artifact_id, purpose, basis, valid_from, valid_to
      ) VALUES (
        '${id(input.caseNumber, 60)}', '${seeded.cityArtifact}',
        'publication', 'allowed', '2025-01-01T00:00:00.000Z', ${validTo}
      );
      INSERT INTO zukan_resolution_run_claims(
        resolution_run_id, claim_revision_id, candidate_ordinal, decision, reason_codes
      ) VALUES ('${run}', '${seeded.cityRevision}', 0, 'accepted', '["fixture"]'::jsonb);
      INSERT INTO zukan_projection_snapshots(
        projection_snapshot_id, resolution_run_id, snapshot_hash,
        reproducibility_at_issue, created_at
      ) VALUES (
        '${snapshot}', '${run}', '${input.snapshotHash ?? HASH_E}',
        'full', '2026-01-02T00:00:00.000Z'
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
    const publishable = await this.seedPublishableProjection({
      caseNumber: 16,
      snapshotHash: HASH_F,
    });
    const subjectB = id(16, 70);
    const publicIdentifier = id(16, 6);
    const resolutionSet = id(16, 7);
    const assertion = id(16, 8);
    await this.exec(`
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
        'subject_identity', '${publishable.subject}'
      );
      INSERT INTO zukan_identity_resolution_sets(resolution_set_id, valid_from)
      VALUES ('${resolutionSet}', '2027-01-01T00:00:00.000Z');
      INSERT INTO zukan_identity_membership_assertions(
        membership_assertion_id, resolution_set_id, subject_id, membership_state, valid_from
      ) VALUES
        ('${id(16, 9)}', '${resolutionSet}', '${publishable.subject}', 'candidate',
         '2027-01-01T00:00:00.000Z'),
        ('${id(16, 10)}', '${resolutionSet}', '${subjectB}', 'candidate',
         '2027-01-01T00:00:00.000Z');
      INSERT INTO zukan_canonical_identity_assertions(
        canonical_assertion_id, public_identifier_id, assertion_mode, resolution_set_id, valid_from
      ) VALUES (
        '${assertion}', '${publicIdentifier}', 'ambiguous',
        '${resolutionSet}', '2027-01-01T00:00:00.000Z'
      );
      INSERT INTO zukan_canonical_identity_candidates(
        canonical_assertion_id, subject_id, ordinal
      ) VALUES ('${assertion}', '${publishable.subject}', 0),
               ('${assertion}', '${subjectB}', 1);
    `);
    return {
      assertionMode: String(await this.scalar(
        "SELECT assertion_mode FROM zukan_canonical_identity_assertions WHERE canonical_assertion_id = $1",
        [assertion],
      )),
      candidateCount: Number(await this.scalar(
        "SELECT count(*) FROM zukan_canonical_identity_candidates WHERE canonical_assertion_id = $1",
        [assertion],
      )),
      oldSnapshotHash: String(await this.scalar(
        "SELECT snapshot_hash FROM zukan_projection_snapshots WHERE projection_snapshot_id = $1",
        [publishable.snapshot],
      )),
      oldPublicationManifestHash: String(await this.scalar(
        "SELECT manifest_hash FROM zukan_publication_editions WHERE projection_snapshot_id = $1",
        [publishable.snapshot],
      )),
    };
  }

  async fixture17NonDetectionThenDetection(): Promise<FoundationFixture17Result> {
    const taxon = id(17, 1);
    const surveyA = id(17, 2);
    const surveyB = id(17, 3);
    await this.exec(`
      INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
      VALUES ('${taxon}', 'fixture-tenant', 'taxon');
      INSERT INTO zukan_survey_events(
        survey_event_id, tenant_id, subject_scope, method, effort, started_at, ended_at
      ) VALUES
        ('${surveyA}', 'fixture-tenant', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         '2024-01-01T00:00:00.000Z', '2024-01-02T00:00:00.000Z'),
        ('${surveyB}', 'fixture-tenant', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
      INSERT INTO zukan_detection_outcomes(
        detection_outcome_id, survey_event_id, subject_id, outcome, recorded_at
      ) VALUES
        ('${id(17, 4)}', '${surveyA}', '${taxon}', 'not_detected',
         '2024-01-02T00:00:01.000Z'),
        ('${id(17, 5)}', '${surveyB}', '${taxon}', 'detected',
         '2026-01-01T12:00:00.000Z');
    `);
    return {
      outcomeCount: Number(await this.scalar(
        "SELECT count(*) FROM zukan_detection_outcomes WHERE subject_id = $1",
        [taxon],
      )),
      distinctSurveyCount: Number(await this.scalar(
        "SELECT count(DISTINCT survey_event_id) FROM zukan_detection_outcomes WHERE subject_id = $1",
        [taxon],
      )),
      claimCount: Number(await this.scalar("SELECT count(*) FROM zukan_claims")),
    };
  }

  async fixture18PendingDisputePublicationGate(): Promise<FoundationFixture18Result> {
    const publishable = await this.seedPublishableProjection({ caseNumber: 18 });
    const dispute = id(18, 51);
    await this.exec(`
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
    const publicationRejected = await this.expectRejected(publicationSql);
    const pendingDisputeCount = Number(await this.scalar(
      `SELECT count(*) FROM zukan_dispute_cases
        WHERE dispute_case_id = $1
          AND NOT EXISTS (
            SELECT 1 FROM zukan_dispute_case_events
             WHERE dispute_case_id = $1 AND event_type IN ('resolved', 'dismissed')
          )`,
      [dispute],
    ));
    await this.exec(`
      INSERT INTO zukan_dispute_case_events(
        dispute_case_event_id, dispute_case_id, event_type, recorded_at
      ) VALUES (
        '${id(18, 54)}', '${dispute}', 'resolved', '2027-01-01T00:00:02.000Z'
      )
    `);
    return {
      pendingDisputeCount,
      publicationRejected,
      publicationAfterDisputeClosed: await this.canExecute(publicationSql),
    };
  }

  async fixture19PredicateBreakingChange(): Promise<FoundationFixture19Result> {
    const { subject } = await this.seedSubjectAndPredicate(19);
    const claim = id(19, 10);
    await this.exec(`
      INSERT INTO zukan_claims(
        claim_id, subject_id, predicate_uri, predicate_version, tenant_id
      ) VALUES ('${claim}', '${subject}', '${PREDICATE}', 1, 'fixture-tenant')
    `);
    const destructiveMutationRejected = await this.expectRejected(`
      UPDATE zukan_predicate_definitions
         SET polarity_mode = 'positive_only'
       WHERE predicate_uri = '${PREDICATE}' AND predicate_version = 1
    `);
    await this.exec(`
      INSERT INTO zukan_predicate_definitions(
        predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile
      ) VALUES (
        '${PREDICATE}-v2', 1, 'string', 'one', 'positive_only', 'valid_time'
      )
    `);
    return {
      destructiveMutationRejected,
      replacementPredicateCount: Number(await this.scalar(
        "SELECT count(*) FROM zukan_predicate_definitions WHERE predicate_uri = $1",
        [`${PREDICATE}-v2`],
      )),
      legacyClaimPredicateVersion: Number(await this.scalar(
        "SELECT predicate_version FROM zukan_claims WHERE claim_id = $1",
        [claim],
      )),
    };
  }

  async fixture20PolicyAndWatermark(): Promise<FoundationFixture20Result> {
    const seeded = await this.seedClaims(20);
    const run = await this.seedResolution({
      caseNumber: 20,
      subject: seeded.subject,
      watermark: seeded.watermark,
      status: "disputed",
    });
    const watermarkMutationRejected = await this.expectRejected(`
      UPDATE zukan_resolution_runs
         SET claim_store_sequence_watermark = 999
       WHERE resolution_run_id = '${run}'
    `);
    return {
      revisionsAtWatermark: Number(await this.scalar(
        "SELECT count(*) FROM zukan_claim_revisions WHERE recorded_sequence <= $1",
        [seeded.watermark],
      )),
      allRevisions: Number(await this.scalar("SELECT count(*) FROM zukan_claim_revisions")),
      watermarkMutationRejected,
    };
  }

  async fixture21RightsExpiry(): Promise<FoundationFixture21Result> {
    const publishable = await this.seedPublishableProjection({
      caseNumber: 21,
      publicationRightsValidTo: "2027-01-01T00:00:00.000Z",
    });
    const embedding = id(21, 2);
    await this.exec(`
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
    const publicationAt2026 = await this.canExecute(publicationSql(
      id(21, 70),
      HASH_F,
      "2026-06-01T00:00:00.000Z",
    ));
    const publicationAt2028Rejected = await this.expectRejected(publicationSql(
      id(21, 71),
      "8".repeat(64),
      "2028-01-01T00:00:00.000Z",
    ));
    return {
      publicationAt2026: publicationAt2026 ? "allow" : "deny",
      publicationAt2028: publicationAt2028Rejected ? "deny" : "allow",
      preservationAt2028: String(await this.scalar(
        "SELECT CASE WHEN basis = 'allowed' AND valid_to IS NULL THEN 'allow' ELSE 'deny' END FROM zukan_rights_evaluations WHERE value_artifact_id = $1 AND purpose = 'preservation'",
        [publishable.cityArtifact],
      )) as "allow" | "deny",
      embeddingAt2026: String(await this.scalar(
        "SELECT CASE WHEN basis = 'unknown' THEN 'review' ELSE basis END FROM zukan_rights_evaluations WHERE content_object_id = $1 AND purpose = 'embedding'",
        [embedding],
      )) as "allow" | "deny" | "review",
    };
  }

  async fixture22EraseAndDegradedReplay(): Promise<FoundationFixture22Result> {
    const seeded = await this.seedClaims(22);
    const run = await this.seedResolution({
      caseNumber: 22,
      subject: seeded.subject,
      watermark: seeded.watermark,
      status: "resolved",
    });
    const snapshot = id(22, 50);
    const governance = id(22, 51);
    await this.exec(`
      INSERT INTO zukan_resolution_run_claims(
        resolution_run_id, claim_revision_id, candidate_ordinal, decision, reason_codes
      ) VALUES ('${run}', '${seeded.cityRevision}', 0, 'accepted', '["fixture"]'::jsonb);
      INSERT INTO zukan_projection_snapshots(
        projection_snapshot_id, resolution_run_id, snapshot_hash,
        reproducibility_at_issue, created_at
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
        reproducibility_status, affected_entry_keys, recorded_at
      ) VALUES (
        '${id(22, 52)}', '${snapshot}', '${governance}', 'degraded',
        '["person"]'::jsonb, '2027-01-01T00:03:00.000Z'
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
      snapshotHash: String(await this.scalar(
        "SELECT snapshot_hash FROM zukan_projection_snapshots WHERE projection_snapshot_id = $1",
        [snapshot],
      )),
      artifactAvailability: String(await this.scalar(
        "SELECT availability_status FROM zukan_value_artifacts WHERE artifact_id = $1",
        [seeded.cityArtifact],
      )),
      reproducibilityStatus: String(await this.scalar(
        "SELECT reproducibility_status FROM zukan_snapshot_status_events WHERE projection_snapshot_id = $1",
        [snapshot],
      )),
    };
  }

  async fixture23ProspectiveRevocation(): Promise<FoundationFixture23Result> {
    const seeded = await this.seedClaims(23, "public");
    const trustAnchor = id(23, 2);
    const assertion = id(23, 3);
    const prospective = id(23, 4);
    const retroactive = id(23, 5);
    await this.exec(`
      INSERT INTO zukan_trust_anchors(
        trust_anchor_id, tenant_id, anchor_method, anchor_subject_id,
        assurance_level, valid_from, policy_version
      ) VALUES (
        '${trustAnchor}', 'fixture-tenant', 'authenticated_account',
        '${seeded.owner}', 5, '2025-01-01T00:00:00.000Z', 'v1'
      );
      INSERT INTO zukan_authority_assertions(
        authority_assertion_id, authority_subject_id, trust_anchor_id,
        authority_rank, valid_from
      ) VALUES (
        '${assertion}', '${seeded.owner}', '${trustAnchor}', 100,
        '2025-01-01T00:00:00.000Z'
      );
      INSERT INTO zukan_claim_authority_links(claim_revision_id, authority_assertion_id)
      VALUES ('${seeded.cityRevision}', '${assertion}');
    `);
    const run = await this.seedResolution({
      caseNumber: 23,
      subject: seeded.subject,
      watermark: seeded.watermark,
      status: "resolved",
    });
    const snapshot = id(23, 50);
    const governance = id(23, 51);
    await this.exec(`
      INSERT INTO zukan_resolution_run_claims(
        resolution_run_id, claim_revision_id, candidate_ordinal, decision, reason_codes
      ) VALUES ('${run}', '${seeded.cityRevision}', 0, 'accepted', '["fixture"]'::jsonb);
      INSERT INTO zukan_projection_snapshots(
        projection_snapshot_id, resolution_run_id, snapshot_hash,
        reproducibility_at_issue, created_at
      ) VALUES (
        '${snapshot}', '${run}', '${HASH_E}', 'full', '2026-01-02T00:00:00.000Z'
      );
      INSERT INTO zukan_projection_entries(
        projection_snapshot_id, entry_key, claim_revision_id, value_artifact_id
      ) VALUES ('${snapshot}', 'opening-hours', '${seeded.cityRevision}', '${seeded.cityArtifact}');
      INSERT INTO zukan_authority_revocation_events(
        authority_revocation_event_id, authority_assertion_id, revocation_mode,
        effective_at, reason
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
        reproducibility_status, affected_entry_keys, recorded_at
      ) VALUES (
        '${id(23, 52)}', '${snapshot}', '${governance}', 'redacted',
        '["opening-hours"]'::jsonb, '2028-01-01T00:00:02.000Z'
      );
      INSERT INTO zukan_authority_revocation_events(
        authority_revocation_event_id, authority_assertion_id, revocation_mode,
        effective_at, reason, impact_manifest
      ) VALUES (
        '${retroactive}', '${assertion}', 'retroactive',
        '2028-01-01T00:00:00.000Z', 'impersonation', '["${snapshot}"]'::jsonb
      );
    `);
    const prospectiveMutationRejected = await this.expectRejected(`
      UPDATE zukan_authority_revocation_events
         SET revocation_mode = 'retroactive'
       WHERE authority_revocation_event_id = '${prospective}'
    `);
    const prospectiveEffective = String(await this.scalar(
      "SELECT effective_at FROM zukan_authority_revocation_events WHERE authority_revocation_event_id = $1",
      [prospective],
    ));
    return {
      prospectivePastValid: Date.parse("2026-01-01T00:00:00.000Z") < Date.parse(prospectiveEffective),
      prospectiveFutureValid: Date.parse("2028-01-01T00:00:00.000Z") < Date.parse(prospectiveEffective),
      retroactivePastValid: Number(await this.scalar(
        `SELECT CASE WHEN EXISTS (
           SELECT 1 FROM zukan_authority_revocation_events
            WHERE authority_assertion_id = $1 AND revocation_mode = 'retroactive'
              AND effective_at <= '2028-01-01T00:00:00.000Z'
         ) THEN 0 ELSE 1 END`,
        [assertion],
      )) === 1,
      prospectiveMutationRejected,
    };
  }

  async fixture24EqualAuthorityDispute(): Promise<FoundationFixture24Result> {
    const seeded = await this.seedClaims(24);
    const run = await this.seedResolution({
      caseNumber: 24,
      subject: seeded.subject,
      watermark: seeded.watermark,
      status: "disputed",
    });
    const dispute = id(24, 50);
    await this.exec(`
      INSERT INTO zukan_resolution_run_claims(
        resolution_run_id, claim_revision_id, candidate_ordinal, decision, reason_codes
      ) VALUES
        ('${run}', '${seeded.cityRevision}', 0, 'tied', '["equal_authority"]'::jsonb),
        ('${run}', '${seeded.ownerRevision}', 1, 'tied', '["equal_authority"]'::jsonb);
      INSERT INTO zukan_dispute_cases(
        dispute_case_id, subject_id, predicate_uri, predicate_version, resolution_run_id,
        opened_at
      ) VALUES (
        '${dispute}', '${seeded.subject}', '${PREDICATE}', 1, '${run}',
        '2027-01-01T00:00:00.000Z'
      );
      INSERT INTO zukan_dispute_case_events(
        dispute_case_event_id, dispute_case_id, event_type, recorded_at
      ) VALUES (
        '${id(24, 51)}', '${dispute}', 'opened', '2027-01-01T00:00:01.000Z'
      );
    `);
    return {
      acceptedCount: Number(await this.scalar(
        "SELECT count(*) FROM zukan_resolution_run_claims WHERE resolution_run_id = $1 AND decision = 'accepted'",
        [run],
      )),
      disputeEvent: String(await this.scalar(
        "SELECT event_type FROM zukan_dispute_case_events WHERE dispute_case_id = $1",
        [dispute],
      )),
    };
  }
}

export const FOUNDATION_POSTGRES_FIXTURE_MIGRATIONS = [
  "0134_zukan_foundation_v2_source_identity.sql",
  "0135_zukan_foundation_v2_predicate_claims.sql",
  "0136_zukan_foundation_v2_authority_resolution.sql",
  "0137_zukan_foundation_v2_governance_rights.sql",
  "0138_zukan_foundation_v2_disputes_coverage.sql",
  "0139_zukan_foundation_v2_integrity_hardening.sql",
] as const;

export async function applyFoundationPostgresFixtureMigrations(
  pool: Pool,
  migrationDirectory: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL search_path = public");
    const inventory = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'zukan_%'`,
    );
    if (Number(inventory.rows[0]?.count ?? "0") !== 0) {
      throw new Error("foundation_fixture_postgres_migrations_require_empty_target");
    }
    for (const migration of FOUNDATION_POSTGRES_FIXTURE_MIGRATIONS) {
      await client.query(readFileSync(path.join(migrationDirectory, migration), "utf8"));
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type FoundationPostgresFixtureCli = {
  databaseUrl: string;
  targetName: string;
  sourceSha: string;
  migrationDirectory: string | null;
};

function argument(argv: readonly string[], prefix: string): string | null {
  const values = argv.filter((item) => item.startsWith(prefix));
  if (values.length > 1) throw new Error(`foundation_fixture_duplicate_argument:${prefix}`);
  return values.length === 0 ? null : values[0]!.slice(prefix.length).trim();
}

export function parseFoundationPostgresFixtureCli(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>> = process.env,
): FoundationPostgresFixtureCli {
  const prefixes = [
    "--database-url=",
    "--migration-directory=",
    "--source-sha=",
    "--confirm-scratch-target=",
  ];
  const unknown = argv.find((item) => !prefixes.some((prefix) => item.startsWith(prefix)));
  if (unknown) throw new Error(`foundation_fixture_unknown_argument:${unknown}`);
  const databaseUrl = argument(argv, "--database-url=")
    ?? environment.FOUNDATION_FIXTURE_DATABASE_URL?.trim()
    ?? "";
  if (!databaseUrl) throw new Error("foundation_fixture_postgres_database_url_required");
  const parsed = new URL(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("foundation_fixture_postgres_database_url_invalid");
  }
  const targetName = decodeURIComponent(parsed.pathname.slice(1));
  assertFoundationFixtureTargetName({ dialect: "postgres", targetName });
  if ((argument(argv, "--confirm-scratch-target=") ?? "") !== targetName) {
    throw new Error("foundation_fixture_scratch_confirmation_mismatch");
  }
  const sourceSha = argument(argv, "--source-sha=") ?? "";
  if (!/^[0-9a-fA-F]{40}$/u.test(sourceSha)) {
    throw new Error("foundation_fixture_source_sha_must_be_full_commit");
  }
  const migrationDirectory = argument(argv, "--migration-directory=");
  return {
    databaseUrl,
    targetName,
    sourceSha: sourceSha.toLowerCase(),
    migrationDirectory: migrationDirectory ? path.resolve(migrationDirectory) : null,
  };
}

async function main(): Promise<void> {
  const options = parseFoundationPostgresFixtureCli(process.argv.slice(2));
  const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
  verifyFoundationEvidenceSourceSha({
    sourceSha: options.sourceSha,
    repositoryRoot,
  });
  const migrationProvenance = options.migrationDirectory
    ? verifyFoundationMigrationSet({
      repositoryRoot,
      migrationDirectory: options.migrationDirectory,
      expectedRelativeDirectory: "platform_v2/db/migrations",
      migrationFiles: FOUNDATION_POSTGRES_FIXTURE_MIGRATIONS,
    })
    : null;
  const pool = new Pool({
    connectionString: options.databaseUrl,
    application_name: "zukan_foundation_v2_database_fixtures",
  });
  try {
    const actualDatabase = String((await pool.query(
      "SELECT current_database() AS database_name",
    )).rows[0]?.database_name ?? "");
    if (actualDatabase !== options.targetName) {
      throw new Error("foundation_fixture_postgres_connected_target_mismatch");
    }
    if (options.migrationDirectory) {
      await applyFoundationPostgresFixtureMigrations(pool, options.migrationDirectory);
    }
    const evidence = await runFoundationDatabaseFixtureContract(
      new FoundationPostgresDatabaseFixtureDriver(pool, options.targetName),
    );
    process.stdout.write(`${canonicalFoundationJson({
      ...evidence,
      sourceSha: options.sourceSha,
      migrationExecution: {
        appliedByRunner: migrationProvenance !== null,
        provenance: migrationProvenance,
      },
    })}\n`);
    if (evidence.failed > 0) process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
