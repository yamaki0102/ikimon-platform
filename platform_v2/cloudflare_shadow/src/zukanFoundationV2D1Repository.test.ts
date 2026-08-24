import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import test from "node:test";
import { REGIONAL_SOURCE_ASSETS } from "../../src/services/regionalSourceRegistry";
import {
  canonicalFoundationJson,
  foundationSourceImportPayloadForDigest,
} from "../../src/services/zukanFoundationV2RepositoryContract";
import {
  deterministicFoundationUuid,
  planRegionalSourceFoundationImport,
} from "../../src/services/zukanFoundationV2SourceRegistryImport";
import {
  type FoundationD1Database,
  type FoundationD1PreparedStatement,
  ZukanFoundationV2D1Repository,
} from "./zukanFoundationV2D1Repository";

type SqliteValue = string | number | null;

class PreparedStatement implements FoundationD1PreparedStatement {
  private values: SqliteValue[] = [];

  constructor(private readonly statement: StatementSync) {}

  bind(...values: SqliteValue[]): PreparedStatement {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.statement.get(...this.values) as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.statement.all(...this.values) as T[] };
  }

  async run(): Promise<unknown> {
    return this.execute();
  }

  execute(): unknown {
    return this.statement.columns().length > 0
      ? this.statement.all(...this.values)
      : this.statement.run(...this.values);
  }
}

class SqliteD1Database implements FoundationD1Database {
  constructor(readonly sqlite: DatabaseSync) {}

  prepare(query: string): PreparedStatement {
    return new PreparedStatement(this.sqlite.prepare(query));
  }

  async batch(statements: PreparedStatement[]): Promise<unknown[]> {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.execute());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

class ReceiptReadBarrierStatement implements FoundationD1PreparedStatement {
  constructor(
    private readonly statement: FoundationD1PreparedStatement,
    private readonly waitForReaders: () => Promise<void>,
  ) {}

  bind(...values: SqliteValue[]): ReceiptReadBarrierStatement {
    this.statement.bind(...values);
    return this;
  }

  async first<T>(): Promise<T | null> {
    await this.waitForReaders();
    return this.statement.first<T>();
  }

  all<T>(): Promise<{ results: T[] }> {
    return this.statement.all<T>();
  }

  run(): Promise<unknown> {
    return this.statement.run();
  }
}

class ConcurrentReceiptReadDatabase implements FoundationD1Database {
  private readers = 0;
  private releaseReaders!: () => void;
  private readonly readersReleased = new Promise<void>((resolve) => {
    this.releaseReaders = resolve;
  });

  constructor(private readonly database: FoundationD1Database) {}

  prepare(query: string): FoundationD1PreparedStatement {
    const statement = this.database.prepare(query);
    if (
      query.includes("SELECT tenant_id, operation, payload_sha256")
      && query.includes("FROM zukan_foundation_v2_write_receipts")
    ) {
      return new ReceiptReadBarrierStatement(statement, async () => {
        this.readers += 1;
        if (this.readers === 2) this.releaseReaders();
        await this.readersReleased;
      });
    }
    return statement;
  }

  batch(statements: FoundationD1PreparedStatement[]): Promise<unknown[]> {
    return this.database.batch(statements);
  }
}

function createDatabase(): SqliteD1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const filename of [
    "0009_zukan_foundation_v2_source_identity.sql",
    "0010_zukan_foundation_v2_predicate_claims.sql",
    "0011_zukan_foundation_v2_authority_resolution.sql",
    "0012_zukan_foundation_v2_governance_rights.sql",
    "0013_zukan_foundation_v2_disputes_coverage.sql",
    "0014_zukan_foundation_v2_integrity_hardening.sql",
  ]) {
    sqlite.exec(readFileSync(
      new URL(`../migrations/core/${filename}`, import.meta.url),
      "utf8",
    ));
  }
  return new SqliteD1Database(sqlite);
}

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

test("D1 adapter applies one atomic bounded import and replays without duplicate rows", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const batch = withVerifiedContent(plan);
  const database = createDatabase();
  const repository = new ZukanFoundationV2D1Repository(database);
  const capabilities = await repository.capabilities();
  assert.equal(capabilities.available, true);
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
  const second = await repository.applySourceImport(request);
  assert.equal(second.status, "replayed");
  const retiredIdentifier = batch.publicIdentifiers[0];
  assert.ok(retiredIdentifier);
  database.sqlite.prepare(`
    UPDATE zukan_public_identifiers
       SET sensitivity_status = 'restricted', retired_at = ?
     WHERE public_identifier_id = ?
  `).run("2026-07-28T00:00:00.000Z", retiredIdentifier.publicIdentifierId);
  const retiredState = await repository.readSourceImportState({
    tenantId: "tenant-a",
    subjectIds: batch.subjects.map((item) => item.subjectId),
    sourceWorkIds: batch.sourceWorks.map((item) => item.sourceWorkId),
    sourceEditionIds: batch.sourceEditions.map((item) => item.sourceEditionId),
    contentFixityEventIds: batch.contentFixityEvents.map((item) => item.fixityEventId),
    contentObjectIds: batch.contentObjects.map((item) => item.contentObjectId),
    publicIdentifierIds: batch.publicIdentifiers.map((item) => item.publicIdentifierId),
  });
  const storedRetiredIdentifier = retiredState.publicIdentifiers.find(
    (item) => item.publicIdentifierId === retiredIdentifier.publicIdentifierId,
  );
  assert.equal(storedRetiredIdentifier?.sensitivityStatus, "restricted");
  assert.equal(storedRetiredIdentifier?.retiredAt, "2026-07-28T00:00:00.000Z");
  const replanned = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
    existing: retiredState,
  });
  assert.equal(replanned.counts.conflicts, 1);
  assert.match(replanned.blockers.join("\n"), /existing_row_conflict:public_identifier/);
  const crossTenant = await repository.readSourceImportState({
    tenantId: "tenant-b",
    subjectIds: plan.batch.subjects.map((item) => item.subjectId),
    sourceWorkIds: plan.batch.sourceWorks.map((item) => item.sourceWorkId),
    sourceEditionIds: plan.batch.sourceEditions.map((item) => item.sourceEditionId),
    contentFixityEventIds: batch.contentFixityEvents.map((item) => item.fixityEventId),
    contentObjectIds: batch.contentObjects.map((item) => item.contentObjectId),
    publicIdentifierIds: plan.batch.publicIdentifiers.map((item) => item.publicIdentifierId),
  });
  assert.deepEqual(crossTenant, {
    subjects: [],
    sourceWorks: [],
    sourceEditions: [],
    contentFixityEvents: [],
    contentObjects: [],
    publicIdentifiers: [],
  });
  const count = database.sqlite.prepare(
    "SELECT count(*) AS count FROM zukan_foundation_v2_write_receipts",
  ).get() as { count: number };
  assert.equal(count.count, 1);
  assert.equal(
    (database.sqlite.prepare("SELECT count(*) AS count FROM zukan_content_objects").get() as { count: number }).count,
    1,
  );
  assert.equal(
    (database.sqlite.prepare("SELECT count(*) AS count FROM zukan_content_fixity_events").get() as { count: number }).count,
    1,
  );
  assert.equal(
    (database.sqlite.prepare(
      "SELECT availability_status FROM zukan_content_objects",
    ).get() as { availability_status: string }).availability_status,
    "available",
  );
  database.sqlite.close();
});

test("D1 adapter closes the ZUK-019 concurrent replay race and rejects key reuse", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const batch = withVerifiedContent(plan);
  const database = createDatabase();
  const repository = new ZukanFoundationV2D1Repository(
    new ConcurrentReceiptReadDatabase(database),
  );
  const idempotencyKey = "regional-source:run-zuk-019-race";
  const policy = {
    enabled: true,
    killSwitch: false,
    allowedTenants: ["tenant-a", "tenant-b"],
    allowedOperations: ["source_registry_import_v1"] as const,
    maxEntities: 16,
  };
  const request = { batch, idempotencyKey, policy };

  const outcomes = await Promise.all([
    repository.applySourceImport(request),
    repository.applySourceImport(request),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [
    "replayed",
    "succeeded",
  ]);
  assert.equal(
    (database.sqlite.prepare(
      "SELECT count(*) AS count FROM zukan_foundation_v2_write_receipts",
    ).get() as { count: number }).count,
    1,
  );

  const writeTables = [
    "zukan_foundation_v2_write_receipts",
    "zukan_subject_identities",
    "zukan_source_works",
    "zukan_source_editions",
    "zukan_content_fixity_events",
    "zukan_content_objects",
    "zukan_public_identifiers",
  ];
  const countsBeforeKeyReuse = new Map(
    writeTables.map((table) => [
      table,
      (database.sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count,
    ]),
  );

  const otherTenantBatch = withVerifiedContent(planRegionalSourceFoundationImport({
    tenantId: "tenant-b",
    sourceAssets: [source],
  }));
  await assert.rejects(
    repository.applySourceImport({
      batch: otherTenantBatch,
      idempotencyKey,
      policy: { ...policy, allowedTenants: ["tenant-b"] },
    }),
    /foundation_idempotency_key_payload_mismatch/,
  );

  const anotherPayloadWithoutDigest = {
    ...batch,
    subjects: batch.subjects.map((subject, index) => index === 0
      ? { ...subject, metadataJson: '{"changed":true}' }
      : subject),
  };
  const anotherPayload = {
    ...anotherPayloadWithoutDigest,
    payloadSha256: createHash("sha256")
      .update(canonicalFoundationJson(foundationSourceImportPayloadForDigest(anotherPayloadWithoutDigest)))
      .digest("hex"),
  };
  await assert.rejects(
    repository.applySourceImport({ batch: anotherPayload, idempotencyKey, policy }),
    /foundation_idempotency_key_payload_mismatch/,
  );
  for (const table of writeTables) {
    assert.equal(
      (database.sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count,
      countsBeforeKeyReuse.get(table),
      `unexpected write in ${table}`,
    );
  }
  database.sqlite.close();
});

test("D1 adapter rejects malformed canonical scalars before prepare or batch", async () => {
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
  let prepares = 0;
  let batches = 0;
  const repository = new ZukanFoundationV2D1Repository({
    prepare: () => {
      prepares += 1;
      throw new Error("should_not_prepare");
    },
    batch: async () => {
      batches += 1;
      throw new Error("should_not_batch");
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
  assert.equal(prepares, 0);
  assert.equal(batches, 0);
});

test("D1 adapter rolls back the whole batch on an existing-row conflict", async () => {
  const source = REGIONAL_SOURCE_ASSETS[0];
  assert.ok(source);
  const plan = planRegionalSourceFoundationImport({
    tenantId: "tenant-a",
    sourceAssets: [source],
  });
  const database = createDatabase();
  const work = plan.batch.sourceWorks[0];
  const subject = plan.batch.subjects[0];
  assert.ok(work && subject);
  database.sqlite.prepare(`
    INSERT INTO zukan_subject_identities(
      subject_id, tenant_id, subject_kind, metadata_json
    ) VALUES (?, ?, ?, ?)
  `).run(subject.subjectId, subject.tenantId, subject.subjectKind, subject.metadataJson);
  database.sqlite.prepare(`
    INSERT INTO zukan_source_works(
      source_work_id, tenant_id, title, work_kind, publisher_subject_id, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    work.sourceWorkId,
    work.tenantId,
    `${work.title} conflict`,
    work.workKind,
    work.publisherSubjectId,
    work.metadataJson,
  );
  const repository = new ZukanFoundationV2D1Repository(database);
  await assert.rejects(
    repository.applySourceImport({
      batch: plan.batch,
      idempotencyKey: "regional-source:run-conflict",
      policy: {
        enabled: true,
        killSwitch: false,
        allowedTenants: ["tenant-a"],
        allowedOperations: ["source_registry_import_v1"],
        maxEntities: 16,
      },
    }),
    /malformed JSON/,
  );
  const receiptCount = database.sqlite.prepare(
    "SELECT count(*) AS count FROM zukan_foundation_v2_write_receipts",
  ).get() as { count: number };
  assert.equal(receiptCount.count, 0);
  database.sqlite.close();
});

test("D1 read-state fails closed instead of normalizing foreign subject/work kinds", async () => {
  const database = createDatabase();
  database.sqlite.exec(`
    INSERT INTO zukan_subject_identities(
      subject_id, tenant_id, subject_kind, metadata_json
    ) VALUES
      ('foreign-subject', 'tenant-a', 'taxon', '{}'),
      ('publisher', 'tenant-a', 'source_publisher', '{}');
    INSERT INTO zukan_source_works(
      source_work_id, tenant_id, title, work_kind, publisher_subject_id, metadata_json
    ) VALUES ('foreign-work', 'tenant-a', 'Foreign', 'other', 'publisher', '{}');
  `);
  const repository = new ZukanFoundationV2D1Repository(database);
  await assert.rejects(
    repository.readSourceImportState({
      tenantId: "tenant-a",
      subjectIds: ["foreign-subject"],
      sourceWorkIds: [],
      sourceEditionIds: [],
      contentFixityEventIds: [],
      contentObjectIds: [],
      publicIdentifierIds: [],
    }),
    /foundation_subject_kind_invalid/,
  );
  await assert.rejects(
    repository.readSourceImportState({
      tenantId: "tenant-a",
      subjectIds: [],
      sourceWorkIds: ["foreign-work"],
      sourceEditionIds: [],
      contentFixityEventIds: [],
      contentObjectIds: [],
      publicIdentifierIds: [],
    }),
    /foundation_source_work_kind_invalid/,
  );
  database.sqlite.close();
});
