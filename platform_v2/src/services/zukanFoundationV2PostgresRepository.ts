import { randomUUID } from "node:crypto";
import {
  foundationSourceImportEntityCount,
  canonicalFoundationJson,
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

export interface FoundationPostgresQueryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface FoundationPostgresClient extends FoundationPostgresQueryable {
  release(): void;
}

export interface FoundationPostgresPool extends FoundationPostgresQueryable {
  connect(): Promise<FoundationPostgresClient>;
}

type ReceiptRow = {
  tenant_id: string;
  operation: string;
  payload_sha256: string;
  outcome: string;
};

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
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
    metadataJson: canonicalFoundationJson(parseJson(row.metadata)),
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
    metadataJson: canonicalFoundationJson(parseJson(row.metadata)),
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
    metadataJson: canonicalFoundationJson(parseJson(row.metadata)),
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

async function readState(
  queryable: FoundationPostgresQueryable,
  input: FoundationSourceImportLookup,
): Promise<FoundationSourceImportState> {
  const [subjects, works, editions, fixityEvents, contentObjects, identifiers] = await Promise.all([
    input.subjectIds.length === 0
      ? Promise.resolve({ rows: [] as Record<string, unknown>[] })
      : queryable.query(
          `SELECT subject_id, tenant_id, workspace_id, subject_kind, metadata
             FROM zukan_subject_identities
            WHERE tenant_id = $1 AND subject_id = ANY($2::uuid[])`,
          [input.tenantId, input.subjectIds],
        ),
    input.sourceWorkIds.length === 0
      ? Promise.resolve({ rows: [] as Record<string, unknown>[] })
      : queryable.query(
          `SELECT source_work_id, tenant_id, title, work_kind, publisher_subject_id, metadata
             FROM zukan_source_works
            WHERE tenant_id = $1 AND source_work_id = ANY($2::uuid[])`,
          [input.tenantId, input.sourceWorkIds],
        ),
    input.sourceEditionIds.length === 0
      ? Promise.resolve({ rows: [] as Record<string, unknown>[] })
      : queryable.query(
          `SELECT edition.source_edition_id, edition.source_work_id, edition.edition_label,
                  edition.language_tag, edition.issued_at::text, edition.valid_from::text,
                  edition.valid_to::text, edition.lifecycle_status, edition.metadata
             FROM zukan_source_editions AS edition
             JOIN zukan_source_works AS work
               ON work.source_work_id = edition.source_work_id
            WHERE work.tenant_id = $1
              AND edition.source_edition_id = ANY($2::uuid[])`,
          [input.tenantId, input.sourceEditionIds],
        ),
    input.contentFixityEventIds.length === 0
      ? Promise.resolve({ rows: [] as Record<string, unknown>[] })
      : queryable.query(
          `SELECT fixity.fixity_event_id, fixity.content_object_id, fixity.content_sha256,
                  fixity.verification_status, fixity.verifier, fixity.verified_at::text
             FROM zukan_content_fixity_events AS fixity
             JOIN zukan_content_objects AS object
               ON object.content_object_id = fixity.content_object_id
             JOIN zukan_source_editions AS edition
               ON edition.source_edition_id = object.source_edition_id
             JOIN zukan_source_works AS work
               ON work.source_work_id = edition.source_work_id
            WHERE work.tenant_id = $1
              AND fixity.verification_status = 'verified'
              AND fixity.fixity_event_id = ANY($2::uuid[])`,
          [input.tenantId, input.contentFixityEventIds],
        ),
    input.contentObjectIds.length === 0
      ? Promise.resolve({ rows: [] as Record<string, unknown>[] })
      : queryable.query(
          `SELECT object.content_object_id, object.source_edition_id,
                  object.parent_content_object_id, object.object_kind, object.derivation_kind,
                  object.mime_type, object.byte_length, object.content_sha256,
                  object.storage_locator, object.availability_status
             FROM zukan_content_objects AS object
             JOIN zukan_source_editions AS edition
               ON edition.source_edition_id = object.source_edition_id
             JOIN zukan_source_works AS work
               ON work.source_work_id = edition.source_work_id
            WHERE work.tenant_id = $1
              AND object.parent_content_object_id IS NULL
              AND object.object_kind = 'source_object'
              AND object.derivation_kind IS NULL
              AND object.availability_status = 'available'
              AND object.content_object_id = ANY($2::uuid[])`,
          [input.tenantId, input.contentObjectIds],
        ),
    input.publicIdentifierIds.length === 0
      ? Promise.resolve({ rows: [] as Record<string, unknown>[] })
      : queryable.query(
          `SELECT identifier.public_identifier_id, identifier.identifier_uri,
                  identifier.target_kind, identifier.target_id, identifier.sensitivity_status,
                  identifier.retired_at::text
             FROM zukan_public_identifiers AS identifier
            WHERE identifier.public_identifier_id = ANY($2::uuid[])
              AND (
                (
                  identifier.target_kind = 'subject_identity'
                  AND EXISTS (
                    SELECT 1 FROM zukan_subject_identities AS subject
                     WHERE subject.subject_id = identifier.target_id AND subject.tenant_id = $1
                  )
                )
                OR (
                  identifier.target_kind = 'source_work'
                  AND EXISTS (
                    SELECT 1 FROM zukan_source_works AS work
                     WHERE work.source_work_id = identifier.target_id AND work.tenant_id = $1
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
                       AND work.tenant_id = $1
                  )
                )
              )`,
          [input.tenantId, input.publicIdentifierIds],
        ),
  ]);
  return {
    subjects: subjectRows(subjects.rows),
    sourceWorks: workRows(works.rows),
    sourceEditions: editionRows(editions.rows),
    contentFixityEvents: fixityRows(fixityEvents.rows),
    contentObjects: contentObjectRows(contentObjects.rows),
    publicIdentifiers: identifierRows(identifiers.rows),
  };
}

function lookup(input: FoundationWriteRequest): FoundationSourceImportLookup {
  return {
    tenantId: input.batch.tenantId,
    subjectIds: input.batch.subjects.map((item) => item.subjectId),
    sourceWorkIds: input.batch.sourceWorks.map((item) => item.sourceWorkId),
    sourceEditionIds: input.batch.sourceEditions.map((item) => item.sourceEditionId),
    contentFixityEventIds: input.batch.contentFixityEvents.map((item) => item.fixityEventId),
    contentObjectIds: input.batch.contentObjects.map((item) => item.contentObjectId),
    publicIdentifierIds: input.batch.publicIdentifiers.map((item) => item.publicIdentifierId),
  };
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

export class ZukanFoundationV2PostgresRepository implements ZukanFoundationV2Repository {
  readonly dialect = "postgres" as const;

  constructor(private readonly pool: FoundationPostgresPool) {}

  async capabilities(): Promise<FoundationRepositoryCapabilities> {
    const result = await this.pool.query<{
      receipts: string | null;
      hardening_trigger: string | null;
    }>(
      `SELECT
         to_regclass('public.zukan_foundation_v2_write_receipts')::text AS receipts,
         (
           SELECT tgname
             FROM pg_trigger
            WHERE tgname = 'trg_zukan_resolution_run_claims_watermark'
              AND NOT tgisinternal
            LIMIT 1
         ) AS hardening_trigger`,
    );
    const row = result.rows[0];
    const available = Boolean(row?.receipts && row.hardening_trigger);
    return {
      available,
      dialect: this.dialect,
      schemaVersion: available ? "foundation_v2_integrity_0139" : null,
      readOnly: false,
      blockers: available ? [] : ["foundation_v2_integrity_0139_not_applied"],
    };
  }

  readSourceImportState(input: FoundationSourceImportLookup): Promise<FoundationSourceImportState> {
    return readState(this.pool, input);
  }

  async applySourceImport(input: FoundationWriteRequest): Promise<FoundationWriteOutcome> {
    const rejected = await validateFoundationWriteRequest(input);
    if (rejected) return withFoundationDialect(rejected, this.dialect);
    const client = await this.pool.connect();
    const attemptToken = randomUUID();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 1478))",
        [input.idempotencyKey],
      );
      const receipts = await client.query<ReceiptRow>(
        `SELECT tenant_id, operation, payload_sha256, outcome
           FROM zukan_foundation_v2_write_receipts
          WHERE idempotency_key = $1
          FOR UPDATE`,
        [input.idempotencyKey],
      );
      const existing = receipts.rows[0];
      if (existing) {
        if (
          existing.tenant_id !== input.batch.tenantId
          || existing.operation !== input.batch.operation
          || existing.payload_sha256 !== input.batch.payloadSha256
        ) {
          throw new Error("foundation_idempotency_key_payload_mismatch");
        }
        if (existing.outcome === "succeeded") {
          await client.query("COMMIT");
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

      await client.query(
        `INSERT INTO zukan_foundation_v2_write_receipts(
           idempotency_key, tenant_id, operation, payload_sha256, attempt_token
         ) VALUES ($1, $2, $3, $4, $5::uuid)`,
        [
          input.idempotencyKey,
          input.batch.tenantId,
          input.batch.operation,
          input.batch.payloadSha256,
          attemptToken,
        ],
      );
      for (const item of input.batch.subjects) {
        await client.query(
          `INSERT INTO zukan_subject_identities(
             subject_id, tenant_id, workspace_id, subject_kind, metadata
           ) VALUES ($1::uuid, $2, $3, $4, $5::jsonb)
           ON CONFLICT (subject_id) DO NOTHING`,
          [item.subjectId, item.tenantId, item.workspaceId, item.subjectKind, item.metadataJson],
        );
      }
      for (const item of input.batch.sourceWorks) {
        await client.query(
          `INSERT INTO zukan_source_works(
             source_work_id, tenant_id, title, work_kind, publisher_subject_id, metadata
           ) VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6::jsonb)
           ON CONFLICT (source_work_id) DO NOTHING`,
          [
            item.sourceWorkId,
            item.tenantId,
            item.title,
            item.workKind,
            item.publisherSubjectId,
            item.metadataJson,
          ],
        );
      }
      for (const item of input.batch.sourceEditions) {
        await client.query(
          `INSERT INTO zukan_source_editions(
             source_edition_id, source_work_id, edition_label, language_tag,
             issued_at, valid_from, valid_to, lifecycle_status, metadata
           ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::timestamptz, $6::timestamptz,
                     $7::timestamptz, $8, $9::jsonb)
           ON CONFLICT (source_edition_id) DO NOTHING`,
          [
            item.sourceEditionId,
            item.sourceWorkId,
            item.editionLabel,
            item.languageTag,
            item.issuedAt,
            item.validFrom,
            item.validTo,
            item.lifecycleStatus,
            item.metadataJson,
          ],
        );
      }
      for (const item of input.batch.contentObjects) {
        await client.query(
          `INSERT INTO zukan_content_objects(
             content_object_id, source_edition_id, parent_content_object_id,
             object_kind, derivation_kind, mime_type, byte_length,
             content_sha256, storage_locator, availability_status
           ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, 'missing')
           ON CONFLICT (content_object_id) DO NOTHING`,
          [
            item.contentObjectId,
            item.sourceEditionId,
            item.parentContentObjectId,
            item.objectKind,
            item.derivationKind,
            item.mimeType,
            item.byteLength,
            item.contentSha256,
            item.storageLocator,
          ],
        );
      }
      for (const item of input.batch.contentFixityEvents) {
        await client.query(
          `INSERT INTO zukan_content_fixity_events(
             fixity_event_id, content_object_id, content_sha256,
             verification_status, verifier, verified_at
           ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz)
           ON CONFLICT (fixity_event_id) DO NOTHING`,
          [
            item.fixityEventId,
            item.contentObjectId,
            item.contentSha256,
            item.verificationStatus,
            item.verifier,
            item.verifiedAt,
          ],
        );
      }
      for (const item of input.batch.contentObjects) {
        await client.query(
          `UPDATE zukan_content_objects
              SET availability_status = 'available'
            WHERE content_object_id = $1::uuid
              AND availability_status = 'missing'`,
          [item.contentObjectId],
        );
      }
      for (const item of input.batch.publicIdentifiers) {
        await client.query(
          `INSERT INTO zukan_public_identifiers(
             public_identifier_id, identifier_uri, target_kind, target_id,
             sensitivity_status, retired_at
           ) VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6::timestamptz)
           ON CONFLICT DO NOTHING`,
          [
            item.publicIdentifierId,
            item.identifierUri,
            item.targetKind,
            item.targetId,
            item.sensitivityStatus,
            item.retiredAt,
          ],
        );
      }

      const state = await readState(client, lookup(input));
      assertImportedState(input, state);
      await client.query(
        `UPDATE zukan_foundation_v2_write_receipts
            SET outcome = 'succeeded',
                summary = $2::jsonb,
                completed_at = NOW()
          WHERE idempotency_key = $1
            AND attempt_token = $3::uuid
            AND outcome = 'pending'`,
        [
          input.idempotencyKey,
          canonicalFoundationJson({
            entityCount: foundationSourceImportEntityCount(input.batch),
            payloadSha256: input.batch.payloadSha256,
          }),
          attemptToken,
        ],
      );
      await client.query("COMMIT");
      return {
        status: "succeeded",
        dialect: this.dialect,
        tenantId: input.batch.tenantId,
        operation: input.batch.operation,
        idempotencyKey: input.idempotencyKey,
        payloadSha256: input.batch.payloadSha256,
        entityCount: foundationSourceImportEntityCount(input.batch),
        auditCode: "write_succeeded",
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original transaction error.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
