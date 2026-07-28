import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { REGIONAL_SOURCE_ASSETS } from "./regionalSourceRegistry.js";
import {
  canonicalFoundationJson,
  foundationSourceImportPayloadForDigest,
} from "./zukanFoundationV2RepositoryContract.js";
import {
  deterministicFoundationUuid,
  lookupForFoundationSourceImport,
  planRegionalSourceFoundationImport,
} from "./zukanFoundationV2SourceRegistryImport.js";
import {
  type FoundationPostgresClient,
  type FoundationPostgresPool,
  ZukanFoundationV2PostgresRepository,
} from "./zukanFoundationV2PostgresRepository.js";

function withVerifiedContent(
  plan: ReturnType<typeof planRegionalSourceFoundationImport>,
) {
  const source = REGIONAL_SOURCE_ASSETS[0];
  const edition = plan.batch.sourceEditions[0];
  assert.ok(source && edition);
  const contentObjectId = deterministicFoundationUuid({
    tenantId: plan.tenantId,
    entityKind: "content_object",
    externalId: source.sourceAssetId,
  });
  const contentSha256 = "a".repeat(64);
  const withoutDigest = {
    ...plan.batch,
    contentFixityEvents: [{
      fixityEventId: deterministicFoundationUuid({
        tenantId: plan.tenantId,
        entityKind: "content_fixity_event",
        externalId: source.sourceAssetId,
      }),
      contentObjectId,
      contentSha256,
      verificationStatus: "verified" as const,
      verifier: "adapter-test",
      verifiedAt: "2026-07-28T00:00:00.000Z",
    }],
    contentObjects: [{
      contentObjectId,
      sourceEditionId: edition.sourceEditionId,
      parentContentObjectId: null,
      objectKind: "source_object" as const,
      derivationKind: null,
      mimeType: "application/pdf",
      byteLength: 1234,
      contentSha256,
      storageLocator: "r2://zukan/source.pdf",
      availabilityStatus: "available" as const,
    }],
  };
  return {
    ...withoutDigest,
    payloadSha256: createHash("sha256")
      .update(canonicalFoundationJson(foundationSourceImportPayloadForDigest(withoutDigest)))
      .digest("hex"),
  };
}

test("PostgreSQL adapter performs one bounded transaction and replays idempotently", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const batch = withVerifiedContent(plan);
  const sql: string[] = [];
  let receipt: { tenant_id: string; operation: string; payload_sha256: string; outcome: string } | null = null;
  const query = async <T extends Record<string, unknown>>(
    statement: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: T[] }> => {
    sql.push(statement);
    if (statement.includes("FROM zukan_foundation_v2_write_receipts") && statement.includes("FOR UPDATE")) {
      return { rows: receipt ? [receipt as unknown as T] : [] };
    }
    if (statement.includes("INSERT INTO zukan_foundation_v2_write_receipts")) {
      receipt = {
        tenant_id: String(params[1]),
        operation: String(params[2]),
        payload_sha256: String(params[3]),
        outcome: "pending",
      };
    }
    if (statement.includes("UPDATE zukan_foundation_v2_write_receipts") && receipt) {
      receipt.outcome = "succeeded";
    }
    if (statement.includes("FROM zukan_public_identifiers AS identifier")) {
      return { rows: plan.batch.publicIdentifiers.map((item) => ({
        public_identifier_id: item.publicIdentifierId,
        identifier_uri: item.identifierUri,
        target_kind: item.targetKind,
        target_id: item.targetId,
        sensitivity_status: item.sensitivityStatus,
      })) as unknown as T[] };
    }
    if (statement.includes("FROM zukan_content_fixity_events AS fixity")) {
      return { rows: batch.contentFixityEvents.map((item) => ({
        fixity_event_id: item.fixityEventId,
        content_object_id: item.contentObjectId,
        content_sha256: item.contentSha256,
        verification_status: item.verificationStatus,
        verifier: item.verifier,
        verified_at: item.verifiedAt,
      })) as unknown as T[] };
    }
    if (statement.includes("FROM zukan_content_objects AS object")) {
      return { rows: batch.contentObjects.map((item) => ({
        content_object_id: item.contentObjectId,
        source_edition_id: item.sourceEditionId,
        parent_content_object_id: item.parentContentObjectId,
        object_kind: item.objectKind,
        derivation_kind: item.derivationKind,
        mime_type: item.mimeType,
        byte_length: item.byteLength,
        content_sha256: item.contentSha256,
        storage_locator: item.storageLocator,
        availability_status: item.availabilityStatus,
      })) as unknown as T[] };
    }
    if (statement.includes("FROM zukan_subject_identities")) {
      return { rows: plan.batch.subjects.map((item) => ({
        subject_id: item.subjectId,
        tenant_id: item.tenantId,
        workspace_id: item.workspaceId,
        subject_kind: item.subjectKind,
        metadata: JSON.parse(item.metadataJson),
      })) as unknown as T[] };
    }
    if (statement.includes("FROM zukan_source_works")) {
      return { rows: plan.batch.sourceWorks.map((item) => ({
        source_work_id: item.sourceWorkId,
        tenant_id: item.tenantId,
        title: item.title,
        work_kind: item.workKind,
        publisher_subject_id: item.publisherSubjectId,
        metadata: JSON.parse(item.metadataJson),
      })) as unknown as T[] };
    }
    if (statement.includes("FROM zukan_source_editions")) {
      return { rows: plan.batch.sourceEditions.map((item) => ({
        source_edition_id: item.sourceEditionId,
        source_work_id: item.sourceWorkId,
        edition_label: item.editionLabel,
        language_tag: item.languageTag,
        issued_at: item.issuedAt,
        valid_from: item.validFrom,
        valid_to: item.validTo,
        lifecycle_status: item.lifecycleStatus,
        metadata: JSON.parse(item.metadataJson),
      })) as unknown as T[] };
    }
    return { rows: [] };
  };
  const client: FoundationPostgresClient = {
    query,
    release: () => {
      sql.push("RELEASE");
    },
  };
  let connects = 0;
  const pool: FoundationPostgresPool = {
    query,
    connect: async () => {
      connects += 1;
      return client;
    },
  };
  const repository = new ZukanFoundationV2PostgresRepository(pool);
  const request = {
    batch,
    idempotencyKey: "regional-source:run-0001",
    policy: {
      enabled: true,
      killSwitch: false,
      allowedTenants: ["tenant-a"],
      allowedOperations: ["source_registry_import_v1"] as const,
      maxEntities: 16,
    },
  };
  const first = await repository.applySourceImport(request);
  assert.equal(first.status, "succeeded");
  assert.equal(sql.filter((item) => item === "BEGIN").length, 1);
  assert.equal(sql.filter((item) => item === "COMMIT").length, 1);
  assert.equal(sql.filter((item) => item === "ROLLBACK").length, 0);
  assert.ok(sql.some((item) => item.includes("$1::uuid")));
  const receiptLock = sql.findIndex((item) => item.includes("pg_advisory_xact_lock"));
  const receiptRead = sql.findIndex((item) =>
    item.includes("FROM zukan_foundation_v2_write_receipts") && item.includes("FOR UPDATE"));
  assert.ok(receiptLock > sql.indexOf("BEGIN") && receiptRead > receiptLock);
  const stage = sql.findIndex((item) => item.includes("INSERT INTO zukan_content_objects"));
  const fixity = sql.findIndex((item) => item.includes("INSERT INTO zukan_content_fixity_events"));
  const promote = sql.findIndex((item) => item.includes("UPDATE zukan_content_objects"));
  assert.ok(stage >= 0 && fixity > stage && promote > fixity);
  assert.match(sql[stage] ?? "", /'missing'/);
  const second = await repository.applySourceImport(request);
  assert.equal(second.status, "replayed");
  assert.equal(connects, 2);
});

test("PostgreSQL adapter does not connect while the write feature is disabled", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  let connects = 0;
  const repository = new ZukanFoundationV2PostgresRepository({
    query: async () => ({ rows: [] }),
    connect: async () => {
      connects += 1;
      throw new Error("should_not_connect");
    },
  });
  const outcome = await repository.applySourceImport({
    batch: plan.batch,
    idempotencyKey: "regional-source:run-0001",
    policy: {
      enabled: false,
      killSwitch: true,
      allowedTenants: [],
      allowedOperations: [],
      maxEntities: 1,
    },
  });
  assert.equal(outcome.status, "disabled");
  assert.equal(connects, 0);
});

test("PostgreSQL adapter rejects malformed canonical scalars before connecting", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const subject = plan.batch.subjects[0];
  assert.ok(subject);
  const withoutDigest = {
    ...plan.batch,
    subjects: [{ ...subject, metadataJson: '{"z":1,"a":2}' }],
  };
  const batch = {
    ...withoutDigest,
    payloadSha256: createHash("sha256")
      .update(canonicalFoundationJson(foundationSourceImportPayloadForDigest(withoutDigest)))
      .digest("hex"),
  };
  let connects = 0;
  const repository = new ZukanFoundationV2PostgresRepository({
    query: async () => ({ rows: [] }),
    connect: async () => {
      connects += 1;
      throw new Error("should_not_connect");
    },
  });
  const outcome = await repository.applySourceImport({
    batch,
    idempotencyKey: "regional-source:run-malformed",
    policy: {
      enabled: true,
      killSwitch: false,
      allowedTenants: ["tenant-a"],
      allowedOperations: ["source_registry_import_v1"],
      maxEntities: 16,
    },
  });
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.auditCode, "batch_reference_invalid");
  assert.equal(connects, 0);
});

test("PostgreSQL adapter scopes edition/identifier reads by tenant and normalizes timestamptz", async () => {
  const source = REGIONAL_SOURCE_ASSETS.find((item) => item.issuedAt === "2026-03-30");
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const edition = plan.batch.sourceEditions[0];
  assert.ok(edition);
  const sql: string[] = [];
  const repository = new ZukanFoundationV2PostgresRepository({
    connect: async () => {
      throw new Error("write_not_expected");
    },
    query: async <T extends Record<string, unknown>>(statement: string) => {
      sql.push(statement);
      if (statement.includes("FROM zukan_source_editions")) {
        return { rows: [{
          source_edition_id: edition.sourceEditionId,
          source_work_id: edition.sourceWorkId,
          edition_label: edition.editionLabel,
          language_tag: edition.languageTag,
          issued_at: "2026-03-30 00:00:00+00",
          valid_from: "2026-03-30 00:00:00+00",
          valid_to: null,
          lifecycle_status: edition.lifecycleStatus,
          metadata: JSON.parse(edition.metadataJson),
        } as unknown as T] };
      }
      return { rows: [] };
    },
  });
  const state = await repository.readSourceImportState({
    tenantId: "tenant-a",
    subjectIds: [],
    sourceWorkIds: [],
    sourceEditionIds: [edition.sourceEditionId],
    contentFixityEventIds: [],
    contentObjectIds: [],
    publicIdentifierIds: [],
  });
  assert.equal(state.sourceEditions[0]?.issuedAt, "2026-03-30T00:00:00.000Z");
  assert.equal(state.sourceEditions[0]?.issuedAt, edition.issuedAt);
  assert.match(sql.join("\n"), /JOIN zukan_source_works AS work/);
  assert.match(sql.join("\n"), /work\.tenant_id = \$1/);
});

test("PostgreSQL read-state exposes retired identifiers and fails closed on masked columns", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  let subjectKind = "source_publisher";
  let workKind = "regional_source";
  let lifecycleStatus: string = plan.batch.sourceEditions[0]?.lifecycleStatus ?? "active";
  let sensitivityStatus = "restricted";
  const retiredIdentifierId = plan.batch.publicIdentifiers[0]?.publicIdentifierId;
  assert.ok(retiredIdentifierId);
  const repository = new ZukanFoundationV2PostgresRepository({
    connect: async () => {
      throw new Error("write_not_expected");
    },
    query: async <T extends Record<string, unknown>>(statement: string) => {
      if (statement.includes("FROM zukan_public_identifiers AS identifier")) {
        return { rows: plan.batch.publicIdentifiers.map((item) => ({
          public_identifier_id: item.publicIdentifierId,
          identifier_uri: item.identifierUri,
          target_kind: item.targetKind,
          target_id: item.targetId,
          sensitivity_status: item.publicIdentifierId === retiredIdentifierId
            ? sensitivityStatus
            : item.sensitivityStatus,
          retired_at: item.publicIdentifierId === retiredIdentifierId
            ? "2026-07-28 00:00:00+00"
            : null,
        })) as unknown as T[] };
      }
      if (statement.includes("FROM zukan_subject_identities")) {
        return { rows: plan.batch.subjects.map((item) => ({
          subject_id: item.subjectId,
          tenant_id: item.tenantId,
          workspace_id: item.workspaceId,
          subject_kind: subjectKind,
          metadata: JSON.parse(item.metadataJson),
        })) as unknown as T[] };
      }
      if (statement.includes("FROM zukan_source_works")) {
        return { rows: plan.batch.sourceWorks.map((item) => ({
          source_work_id: item.sourceWorkId,
          tenant_id: item.tenantId,
          title: item.title,
          work_kind: workKind,
          publisher_subject_id: item.publisherSubjectId,
          metadata: JSON.parse(item.metadataJson),
        })) as unknown as T[] };
      }
      if (statement.includes("FROM zukan_source_editions AS edition")) {
        return { rows: plan.batch.sourceEditions.map((item) => ({
          source_edition_id: item.sourceEditionId,
          source_work_id: item.sourceWorkId,
          edition_label: item.editionLabel,
          language_tag: item.languageTag,
          issued_at: item.issuedAt,
          valid_from: item.validFrom,
          valid_to: item.validTo,
          lifecycle_status: lifecycleStatus,
          metadata: JSON.parse(item.metadataJson),
        })) as unknown as T[] };
      }
      return { rows: [] };
    },
  });
  const lookup = lookupForFoundationSourceImport(plan.batch);
  const retiredState = await repository.readSourceImportState(lookup);
  const stored = retiredState.publicIdentifiers.find(
    (item) => item.publicIdentifierId === retiredIdentifierId,
  );
  assert.equal(stored?.sensitivityStatus, "restricted");
  assert.equal(stored?.retiredAt, "2026-07-28T00:00:00.000Z");
  const replanned = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
    existing: retiredState,
  });
  assert.equal(replanned.counts.conflicts, 1);
  assert.match(replanned.blockers.join("\n"), /existing_row_conflict:public_identifier/);

  subjectKind = "taxon";
  await assert.rejects(
    repository.readSourceImportState(lookup),
    /foundation_subject_kind_invalid/,
  );
  subjectKind = "source_publisher";
  workKind = "other";
  await assert.rejects(
    repository.readSourceImportState(lookup),
    /foundation_source_work_kind_invalid/,
  );
  workKind = "regional_source";
  lifecycleStatus = "corrupt";
  await assert.rejects(
    repository.readSourceImportState(lookup),
    /foundation_source_edition_lifecycle_invalid/,
  );
  lifecycleStatus = "active";
  sensitivityStatus = "corrupt";
  await assert.rejects(
    repository.readSourceImportState(lookup),
    /foundation_public_identifier_sensitivity_invalid/,
  );
});
