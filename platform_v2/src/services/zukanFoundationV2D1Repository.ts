import {
  canonicalFoundationJson,
  foundationSourceImportEntityCount,
  canonicalFoundationTimestamp,
  validateFoundationWriteRequest,
  withFoundationDialect,
  type FoundationContentFixityEvent,
  type FoundationContentObject,
  type FoundationPublicIdentifier,
  type FoundationRepositoryCapabilities,
  type FoundationSourceEdition,
  type FoundationSourceImportLookup,
  type FoundationSourceImportState,
  type FoundationSourceWork,
  type FoundationSubjectIdentity,
  type FoundationWriteOutcome,
  type FoundationWriteRequest,
  type ZukanFoundationV2Repository,
} from "./zukanFoundationV2RepositoryContract.js";

type D1Value = string | number | null;

export interface FoundationD1PreparedStatement {
  bind(...values: D1Value[]): FoundationD1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface FoundationD1Database {
  prepare(query: string): FoundationD1PreparedStatement;
  batch(statements: FoundationD1PreparedStatement[]): Promise<unknown[]>;
}

type ReceiptRow = {
  tenant_id: string;
  operation: string;
  payload_sha256: string;
  attempt_token: string;
  outcome: string;
};

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(",");
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  errorCode: string,
): T[number] {
  const actual = String(value);
  if (!allowed.includes(actual)) throw new Error(`${errorCode}:${actual}`);
  return actual as T[number];
}

function nullableTimestamp(value: unknown, errorCode: string): string | null {
  if (value === null || value === undefined) return null;
  const normalized = canonicalFoundationTimestamp(value);
  if (normalized === null) throw new Error(errorCode);
  return normalized;
}

function requiredTimestamp(value: unknown, errorCode: string): string {
  const normalized = nullableTimestamp(value, errorCode);
  if (normalized === null) throw new Error(errorCode);
  return normalized;
}

async function selectRows<T>(
  database: FoundationD1Database,
  sql: string,
  prefixValues: readonly D1Value[],
  ids: readonly string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  const result = await database.prepare(sql.replace("__IDS__", placeholders(ids)))
    .bind(...prefixValues, ...ids)
    .all<T>();
  return result.results;
}

function subjectRows(rows: readonly Record<string, unknown>[]): FoundationSubjectIdentity[] {
  return rows.map((row) => ({
    subjectId: String(row.subject_id),
    tenantId: String(row.tenant_id),
    workspaceId: row.workspace_id === null || row.workspace_id === undefined
      ? null
      : String(row.workspace_id),
    subjectKind: enumValue(
      row.subject_kind,
      ["source_publisher"] as const,
      `foundation_subject_kind_invalid:${String(row.subject_id)}`,
    ),
    metadataJson: String(row.metadata_json ?? "{}"),
  }));
}

function workRows(rows: readonly Record<string, unknown>[]): FoundationSourceWork[] {
  return rows.map((row) => ({
    sourceWorkId: String(row.source_work_id),
    tenantId: String(row.tenant_id),
    title: String(row.title),
    workKind: enumValue(
      row.work_kind,
      ["regional_source"] as const,
      `foundation_source_work_kind_invalid:${String(row.source_work_id)}`,
    ),
    publisherSubjectId: String(row.publisher_subject_id),
    metadataJson: String(row.metadata_json ?? "{}"),
  }));
}

function editionRows(rows: readonly Record<string, unknown>[]): FoundationSourceEdition[] {
  return rows.map((row) => ({
    sourceEditionId: String(row.source_edition_id),
    sourceWorkId: String(row.source_work_id),
    editionLabel: String(row.edition_label),
    languageTag: row.language_tag === null || row.language_tag === undefined ? null : String(row.language_tag),
    issuedAt: nullableTimestamp(row.issued_at, "foundation_source_edition_issued_at_invalid"),
    validFrom: nullableTimestamp(row.valid_from, "foundation_source_edition_valid_from_invalid"),
    validTo: nullableTimestamp(row.valid_to, "foundation_source_edition_valid_to_invalid"),
    lifecycleStatus: enumValue(
      row.lifecycle_status,
      ["active", "superseded", "retired"] as const,
      `foundation_source_edition_lifecycle_invalid:${String(row.source_edition_id)}`,
    ),
    metadataJson: String(row.metadata_json ?? "{}"),
  }));
}

function identifierRows(rows: readonly Record<string, unknown>[]): FoundationPublicIdentifier[] {
  return rows.map((row) => ({
    publicIdentifierId: String(row.public_identifier_id),
    identifierUri: String(row.identifier_uri),
    targetKind: enumValue(
      row.target_kind,
      ["subject_identity", "source_work", "source_edition"] as const,
      `foundation_public_identifier_target_kind_invalid:${String(row.public_identifier_id)}`,
    ),
    targetId: String(row.target_id),
    sensitivityStatus: enumValue(
      row.sensitivity_status,
      ["normal", "restricted", "existence_sensitive"] as const,
      `foundation_public_identifier_sensitivity_invalid:${String(row.public_identifier_id)}`,
    ),
    retiredAt: nullableTimestamp(
      row.retired_at,
      `foundation_public_identifier_retired_at_invalid:${String(row.public_identifier_id)}`,
    ),
  }));
}

function fixityRows(rows: readonly Record<string, unknown>[]): FoundationContentFixityEvent[] {
  return rows.map((row) => ({
    fixityEventId: String(row.fixity_event_id),
    contentObjectId: String(row.content_object_id),
    contentSha256: String(row.content_sha256),
    verificationStatus: enumValue(
      row.verification_status,
      ["verified"] as const,
      `foundation_content_fixity_status_invalid:${String(row.fixity_event_id)}`,
    ),
    verifier: String(row.verifier),
    verifiedAt: requiredTimestamp(
      row.verified_at,
      `foundation_content_fixity_verified_at_invalid:${String(row.fixity_event_id)}`,
    ),
  }));
}

function contentObjectRows(rows: readonly Record<string, unknown>[]): FoundationContentObject[] {
  return rows.map((row) => {
    if (row.parent_content_object_id !== null && row.parent_content_object_id !== undefined) {
      throw new Error(`foundation_content_object_parent_invalid:${String(row.content_object_id)}`);
    }
    if (row.derivation_kind !== null && row.derivation_kind !== undefined) {
      throw new Error(`foundation_content_object_derivation_invalid:${String(row.content_object_id)}`);
    }
    return {
      contentObjectId: String(row.content_object_id),
      sourceEditionId: String(row.source_edition_id),
      parentContentObjectId: null,
      objectKind: enumValue(
        row.object_kind,
        ["source_object"] as const,
        `foundation_content_object_kind_invalid:${String(row.content_object_id)}`,
      ),
      derivationKind: null,
      mimeType: row.mime_type === null || row.mime_type === undefined ? null : String(row.mime_type),
      byteLength: row.byte_length === null || row.byte_length === undefined
        ? null
        : Number(row.byte_length),
      contentSha256: String(row.content_sha256),
      storageLocator: row.storage_locator === null || row.storage_locator === undefined
        ? null
        : String(row.storage_locator),
      availabilityStatus: enumValue(
        row.availability_status,
        ["available"] as const,
        `foundation_content_object_availability_invalid:${String(row.content_object_id)}`,
      ),
    };
  });
}

function assertImportedState(input: FoundationWriteRequest, state: FoundationSourceImportState): void {
  for (const [label, desired, stored, id] of [
    ["subject", input.batch.subjects, state.subjects, (item: FoundationSubjectIdentity) => item.subjectId],
    ["source_work", input.batch.sourceWorks, state.sourceWorks, (item: FoundationSourceWork) => item.sourceWorkId],
    ["source_edition", input.batch.sourceEditions, state.sourceEditions, (item: FoundationSourceEdition) => item.sourceEditionId],
    ["content_fixity_event", input.batch.contentFixityEvents, state.contentFixityEvents, (item: FoundationContentFixityEvent) => item.fixityEventId],
    ["content_object", input.batch.contentObjects, state.contentObjects, (item: FoundationContentObject) => item.contentObjectId],
    ["public_identifier", input.batch.publicIdentifiers, state.publicIdentifiers, (item: FoundationPublicIdentifier) => item.publicIdentifierId],
  ] as const) {
    const current = new Map(stored.map((item) => [id(item as never), canonicalFoundationJson(item)]));
    for (const item of desired) {
      const itemId = id(item as never);
      if (current.get(itemId) !== canonicalFoundationJson(item)) {
        throw new Error(`foundation_import_conflict:${label}:${itemId}`);
      }
    }
  }
}

export class ZukanFoundationV2D1Repository implements ZukanFoundationV2Repository {
  readonly dialect = "d1" as const;

  constructor(private readonly database: FoundationD1Database) {}

  async capabilities(): Promise<FoundationRepositoryCapabilities> {
    const receipt = await this.database.prepare(
      `SELECT name FROM sqlite_master
        WHERE type = 'table' AND name = 'zukan_foundation_v2_write_receipts'`,
    ).first<{ name: string }>();
    const metadataColumn = await this.database.prepare(
      `SELECT name FROM pragma_table_info('zukan_subject_identities')
        WHERE name = 'metadata_json'`,
    ).first<{ name: string }>();
    const available = Boolean(receipt?.name && metadataColumn?.name);
    return {
      available,
      dialect: this.dialect,
      schemaVersion: available ? "foundation_v2_integrity_0014" : null,
      readOnly: false,
      blockers: available ? [] : ["foundation_v2_integrity_0014_not_applied"],
    };
  }

  async readSourceImportState(input: FoundationSourceImportLookup): Promise<FoundationSourceImportState> {
    const [subjects, works, editions, fixityEvents, contentObjects, identifiers] = await Promise.all([
      selectRows<Record<string, unknown>>(
        this.database,
        `SELECT subject_id, tenant_id, workspace_id, subject_kind, metadata_json
           FROM zukan_subject_identities
          WHERE tenant_id = ? AND subject_id IN (__IDS__)`,
        [input.tenantId],
        input.subjectIds,
      ),
      selectRows<Record<string, unknown>>(
        this.database,
        `SELECT source_work_id, tenant_id, title, work_kind, publisher_subject_id, metadata_json
           FROM zukan_source_works
          WHERE tenant_id = ? AND source_work_id IN (__IDS__)`,
        [input.tenantId],
        input.sourceWorkIds,
      ),
      selectRows<Record<string, unknown>>(
        this.database,
        `SELECT edition.source_edition_id, edition.source_work_id, edition.edition_label,
                edition.language_tag, edition.issued_at, edition.valid_from, edition.valid_to,
                edition.lifecycle_status, edition.metadata_json
           FROM zukan_source_editions AS edition
           JOIN zukan_source_works AS work
             ON work.source_work_id = edition.source_work_id
          WHERE work.tenant_id = ?
            AND edition.source_edition_id IN (__IDS__)`,
        [input.tenantId],
        input.sourceEditionIds,
      ),
      selectRows<Record<string, unknown>>(
        this.database,
        `SELECT fixity.fixity_event_id, fixity.content_object_id, fixity.content_sha256,
                fixity.verification_status, fixity.verifier, fixity.verified_at
           FROM zukan_content_fixity_events AS fixity
           JOIN zukan_content_objects AS object
             ON object.content_object_id = fixity.content_object_id
           JOIN zukan_source_editions AS edition
             ON edition.source_edition_id = object.source_edition_id
           JOIN zukan_source_works AS work
             ON work.source_work_id = edition.source_work_id
          WHERE work.tenant_id = ?
            AND fixity.verification_status = 'verified'
            AND fixity.fixity_event_id IN (__IDS__)`,
        [input.tenantId],
        input.contentFixityEventIds,
      ),
      selectRows<Record<string, unknown>>(
        this.database,
        `SELECT object.content_object_id, object.source_edition_id,
                object.parent_content_object_id, object.object_kind, object.derivation_kind,
                object.mime_type, object.byte_length, object.content_sha256,
                object.storage_locator, object.availability_status
           FROM zukan_content_objects AS object
           JOIN zukan_source_editions AS edition
             ON edition.source_edition_id = object.source_edition_id
           JOIN zukan_source_works AS work
             ON work.source_work_id = edition.source_work_id
          WHERE work.tenant_id = ?
            AND object.parent_content_object_id IS NULL
            AND object.object_kind = 'source_object'
            AND object.derivation_kind IS NULL
            AND object.availability_status = 'available'
            AND object.content_object_id IN (__IDS__)`,
        [input.tenantId],
        input.contentObjectIds,
      ),
      selectRows<Record<string, unknown>>(
        this.database,
        `SELECT identifier.public_identifier_id, identifier.identifier_uri,
                identifier.target_kind, identifier.target_id, identifier.sensitivity_status,
                identifier.retired_at
           FROM zukan_public_identifiers AS identifier
           CROSS JOIN (SELECT ? AS tenant_id) AS scope
          WHERE identifier.public_identifier_id IN (__IDS__)
            AND (
              (
                identifier.target_kind = 'subject_identity'
                AND EXISTS (
                  SELECT 1 FROM zukan_subject_identities AS subject
                   WHERE subject.subject_id = identifier.target_id AND subject.tenant_id = scope.tenant_id
                )
              )
              OR (
                identifier.target_kind = 'source_work'
                AND EXISTS (
                  SELECT 1 FROM zukan_source_works AS work
                   WHERE work.source_work_id = identifier.target_id AND work.tenant_id = scope.tenant_id
                )
              )
              OR (
                identifier.target_kind = 'source_edition'
                AND EXISTS (
                  SELECT 1
                    FROM zukan_source_editions AS edition
                    JOIN zukan_source_works AS work
                      ON work.source_work_id = edition.source_work_id
                   WHERE edition.source_edition_id = identifier.target_id
                     AND work.tenant_id = scope.tenant_id
                )
              )
            )`,
        [input.tenantId],
        input.publicIdentifierIds,
      ),
    ]);
    return {
      subjects: subjectRows(subjects),
      sourceWorks: workRows(works),
      sourceEditions: editionRows(editions),
      contentFixityEvents: fixityRows(fixityEvents),
      contentObjects: contentObjectRows(contentObjects),
      publicIdentifiers: identifierRows(identifiers),
    };
  }

  async applySourceImport(input: FoundationWriteRequest): Promise<FoundationWriteOutcome> {
    const rejected = await validateFoundationWriteRequest(input);
    if (rejected) return withFoundationDialect(rejected, this.dialect);
    const receipt = await this.database.prepare(
      `SELECT tenant_id, operation, payload_sha256, attempt_token, outcome
         FROM zukan_foundation_v2_write_receipts
        WHERE idempotency_key = ?`,
    ).bind(input.idempotencyKey).first<ReceiptRow>();
    if (receipt) {
      if (
        receipt.tenant_id !== input.batch.tenantId
        || receipt.operation !== input.batch.operation
        || receipt.payload_sha256 !== input.batch.payloadSha256
      ) {
        throw new Error("foundation_idempotency_key_payload_mismatch");
      }
      if (receipt.outcome === "succeeded") {
        return {
          status: "replayed",
          dialect: this.dialect,
          tenantId: input.batch.tenantId,
          operation: input.batch.operation,
          idempotencyKey: input.idempotencyKey,
          payloadSha256: input.batch.payloadSha256,
          entityCount: foundationSourceImportEntityCount(input.batch),
          auditCode: "idempotent_replay",
        };
      }
      throw new Error("foundation_idempotency_key_pending");
    }

    const attemptToken = crypto.randomUUID();
    const ownsReceipt = `EXISTS (
      SELECT 1 FROM zukan_foundation_v2_write_receipts
       WHERE idempotency_key = ? AND attempt_token = ? AND outcome = 'pending'
    )`;
    const statements: FoundationD1PreparedStatement[] = [
      this.database.prepare(`
        INSERT OR IGNORE INTO zukan_foundation_v2_write_receipts(
          idempotency_key, tenant_id, operation, payload_sha256, attempt_token
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        input.idempotencyKey,
        input.batch.tenantId,
        input.batch.operation,
        input.batch.payloadSha256,
        attemptToken,
      ),
      this.database.prepare(`
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM zukan_foundation_v2_write_receipts
           WHERE idempotency_key = ?
             AND (tenant_id <> ? OR operation <> ? OR payload_sha256 <> ?)
        ) THEN json('foundation_idempotency_conflict') ELSE 1 END
      `).bind(
        input.idempotencyKey,
        input.batch.tenantId,
        input.batch.operation,
        input.batch.payloadSha256,
      ),
    ];

    for (const item of input.batch.subjects) {
      statements.push(
        this.database.prepare(`
          SELECT CASE WHEN ${ownsReceipt} AND EXISTS (
            SELECT 1 FROM zukan_subject_identities
             WHERE subject_id = ?
               AND (tenant_id IS NOT ? OR workspace_id IS NOT ? OR subject_kind IS NOT ? OR metadata_json IS NOT ?)
          ) THEN json('foundation_subject_conflict') ELSE 1 END
        `).bind(
          input.idempotencyKey,
          attemptToken,
          item.subjectId,
          item.tenantId,
          item.workspaceId,
          item.subjectKind,
          item.metadataJson,
        ),
        this.database.prepare(`
          INSERT OR IGNORE INTO zukan_subject_identities(
            subject_id, tenant_id, workspace_id, subject_kind, metadata_json
          )
          SELECT ?, ?, ?, ?, ? WHERE ${ownsReceipt}
        `).bind(
          item.subjectId,
          item.tenantId,
          item.workspaceId,
          item.subjectKind,
          item.metadataJson,
          input.idempotencyKey,
          attemptToken,
        ),
      );
    }
    for (const item of input.batch.sourceWorks) {
      statements.push(
        this.database.prepare(`
          SELECT CASE WHEN ${ownsReceipt} AND EXISTS (
            SELECT 1 FROM zukan_source_works
             WHERE source_work_id = ?
               AND (tenant_id IS NOT ? OR title IS NOT ? OR work_kind IS NOT ?
                    OR publisher_subject_id IS NOT ? OR metadata_json IS NOT ?)
          ) THEN json('foundation_source_work_conflict') ELSE 1 END
        `).bind(
          input.idempotencyKey,
          attemptToken,
          item.sourceWorkId,
          item.tenantId,
          item.title,
          item.workKind,
          item.publisherSubjectId,
          item.metadataJson,
        ),
        this.database.prepare(`
          INSERT OR IGNORE INTO zukan_source_works(
            source_work_id, tenant_id, title, work_kind, publisher_subject_id, metadata_json
          )
          SELECT ?, ?, ?, ?, ?, ? WHERE ${ownsReceipt}
        `).bind(
          item.sourceWorkId,
          item.tenantId,
          item.title,
          item.workKind,
          item.publisherSubjectId,
          item.metadataJson,
          input.idempotencyKey,
          attemptToken,
        ),
      );
    }
    for (const item of input.batch.sourceEditions) {
      statements.push(
        this.database.prepare(`
          SELECT CASE WHEN ${ownsReceipt} AND EXISTS (
            SELECT 1 FROM zukan_source_editions
             WHERE source_edition_id = ?
               AND (source_work_id IS NOT ? OR edition_label IS NOT ? OR language_tag IS NOT ?
                    OR issued_at IS NOT ? OR valid_from IS NOT ? OR valid_to IS NOT ?
                    OR lifecycle_status IS NOT ? OR metadata_json IS NOT ?)
          ) THEN json('foundation_source_edition_conflict') ELSE 1 END
        `).bind(
          input.idempotencyKey,
          attemptToken,
          item.sourceEditionId,
          item.sourceWorkId,
          item.editionLabel,
          item.languageTag,
          item.issuedAt,
          item.validFrom,
          item.validTo,
          item.lifecycleStatus,
          item.metadataJson,
        ),
        this.database.prepare(`
          INSERT OR IGNORE INTO zukan_source_editions(
            source_edition_id, source_work_id, edition_label, language_tag,
            issued_at, valid_from, valid_to, lifecycle_status, metadata_json
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${ownsReceipt}
        `).bind(
          item.sourceEditionId,
          item.sourceWorkId,
          item.editionLabel,
          item.languageTag,
          item.issuedAt,
          item.validFrom,
          item.validTo,
          item.lifecycleStatus,
          item.metadataJson,
          input.idempotencyKey,
          attemptToken,
        ),
      );
    }
    for (const item of input.batch.contentObjects) {
      statements.push(
        this.database.prepare(`
          SELECT CASE WHEN ${ownsReceipt} AND EXISTS (
            SELECT 1 FROM zukan_content_objects
             WHERE (content_object_id = ? OR content_sha256 = ?)
               AND (content_object_id IS NOT ? OR source_edition_id IS NOT ?
                    OR parent_content_object_id IS NOT ? OR object_kind IS NOT ?
                    OR derivation_kind IS NOT ? OR mime_type IS NOT ? OR byte_length IS NOT ?
                    OR content_sha256 IS NOT ? OR storage_locator IS NOT ?
                    OR availability_status IS NOT ?)
          ) THEN json('foundation_content_object_conflict') ELSE 1 END
        `).bind(
          input.idempotencyKey,
          attemptToken,
          item.contentObjectId,
          item.contentSha256,
          item.contentObjectId,
          item.sourceEditionId,
          item.parentContentObjectId,
          item.objectKind,
          item.derivationKind,
          item.mimeType,
          item.byteLength,
          item.contentSha256,
          item.storageLocator,
          item.availabilityStatus,
        ),
        this.database.prepare(`
          INSERT OR IGNORE INTO zukan_content_objects(
            content_object_id, source_edition_id, parent_content_object_id,
            object_kind, derivation_kind, mime_type, byte_length,
            content_sha256, storage_locator, availability_status
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'missing' WHERE ${ownsReceipt}
        `).bind(
          item.contentObjectId,
          item.sourceEditionId,
          item.parentContentObjectId,
          item.objectKind,
          item.derivationKind,
          item.mimeType,
          item.byteLength,
          item.contentSha256,
          item.storageLocator,
          input.idempotencyKey,
          attemptToken,
        ),
      );
    }
    for (const item of input.batch.contentFixityEvents) {
      statements.push(
        this.database.prepare(`
          SELECT CASE WHEN ${ownsReceipt} AND EXISTS (
            SELECT 1 FROM zukan_content_fixity_events
             WHERE fixity_event_id = ?
               AND (content_object_id IS NOT ? OR content_sha256 IS NOT ?
                    OR verification_status IS NOT ? OR verifier IS NOT ? OR verified_at IS NOT ?)
          ) THEN json('foundation_content_fixity_conflict') ELSE 1 END
        `).bind(
          input.idempotencyKey,
          attemptToken,
          item.fixityEventId,
          item.contentObjectId,
          item.contentSha256,
          item.verificationStatus,
          item.verifier,
          item.verifiedAt,
        ),
        this.database.prepare(`
          INSERT OR IGNORE INTO zukan_content_fixity_events(
            fixity_event_id, content_object_id, content_sha256,
            verification_status, verifier, verified_at
          )
          SELECT ?, ?, ?, ?, ?, ? WHERE ${ownsReceipt}
        `).bind(
          item.fixityEventId,
          item.contentObjectId,
          item.contentSha256,
          item.verificationStatus,
          item.verifier,
          item.verifiedAt,
          input.idempotencyKey,
          attemptToken,
        ),
      );
    }
    for (const item of input.batch.contentObjects) {
      statements.push(
        this.database.prepare(`
          UPDATE zukan_content_objects
             SET availability_status = 'available'
           WHERE content_object_id = ?
             AND availability_status = 'missing'
             AND ${ownsReceipt}
        `).bind(
          item.contentObjectId,
          input.idempotencyKey,
          attemptToken,
        ),
      );
    }
    for (const item of input.batch.publicIdentifiers) {
      statements.push(
        this.database.prepare(`
          SELECT CASE WHEN ${ownsReceipt} AND EXISTS (
            SELECT 1 FROM zukan_public_identifiers
             WHERE (public_identifier_id = ? OR identifier_uri = ?)
               AND (public_identifier_id IS NOT ? OR identifier_uri IS NOT ?
                    OR target_kind IS NOT ? OR target_id IS NOT ?
                    OR sensitivity_status IS NOT ? OR retired_at IS NOT ?)
          ) THEN json('foundation_public_identifier_conflict') ELSE 1 END
        `).bind(
          input.idempotencyKey,
          attemptToken,
          item.publicIdentifierId,
          item.identifierUri,
          item.publicIdentifierId,
          item.identifierUri,
          item.targetKind,
          item.targetId,
          item.sensitivityStatus,
          item.retiredAt,
        ),
        this.database.prepare(`
          INSERT OR IGNORE INTO zukan_public_identifiers(
            public_identifier_id, identifier_uri, target_kind, target_id,
            sensitivity_status, retired_at
          )
          SELECT ?, ?, ?, ?, ?, ? WHERE ${ownsReceipt}
        `).bind(
          item.publicIdentifierId,
          item.identifierUri,
          item.targetKind,
          item.targetId,
          item.sensitivityStatus,
          item.retiredAt,
          input.idempotencyKey,
          attemptToken,
        ),
      );
    }
    statements.push(
      this.database.prepare(`
        UPDATE zukan_foundation_v2_write_receipts
           SET outcome = 'succeeded', summary_json = ?, completed_at = CURRENT_TIMESTAMP
         WHERE idempotency_key = ? AND attempt_token = ? AND outcome = 'pending'
      `).bind(
        JSON.stringify({
          entityCount: foundationSourceImportEntityCount(input.batch),
          payloadSha256: input.batch.payloadSha256,
        }),
        input.idempotencyKey,
        attemptToken,
      ),
    );
    await this.database.batch(statements);

    const completed = await this.database.prepare(
      `SELECT tenant_id, operation, payload_sha256, attempt_token, outcome
         FROM zukan_foundation_v2_write_receipts
        WHERE idempotency_key = ?`,
    ).bind(input.idempotencyKey).first<ReceiptRow>();
    if (
      completed?.tenant_id !== input.batch.tenantId
      || completed.operation !== input.batch.operation
      || completed.payload_sha256 !== input.batch.payloadSha256
      || completed.outcome !== "succeeded"
    ) {
      throw new Error("foundation_write_receipt_not_completed");
    }
    const state = await this.readSourceImportState({
      tenantId: input.batch.tenantId,
      subjectIds: input.batch.subjects.map((item) => item.subjectId),
      sourceWorkIds: input.batch.sourceWorks.map((item) => item.sourceWorkId),
      sourceEditionIds: input.batch.sourceEditions.map((item) => item.sourceEditionId),
      contentFixityEventIds: input.batch.contentFixityEvents.map((item) => item.fixityEventId),
      contentObjectIds: input.batch.contentObjects.map((item) => item.contentObjectId),
      publicIdentifierIds: input.batch.publicIdentifiers.map((item) => item.publicIdentifierId),
    });
    assertImportedState(input, state);
    const replayed = completed.attempt_token !== attemptToken;
    return {
      status: replayed ? "replayed" : "succeeded",
      dialect: this.dialect,
      tenantId: input.batch.tenantId,
      operation: input.batch.operation,
      idempotencyKey: input.idempotencyKey,
      payloadSha256: input.batch.payloadSha256,
      entityCount: foundationSourceImportEntityCount(input.batch),
      auditCode: replayed ? "idempotent_replay" : "write_succeeded",
    };
  }
}
