export const ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION = "source_registry_import_v1" as const;
export const ZUKAN_FOUNDATION_SOURCE_IMPORT_SCHEMA = "zukan.foundation-source-import/v1" as const;
export const ZUKAN_FOUNDATION_ID_NAMESPACE = "zukan.foundation-source-registry/v1" as const;

export type FoundationDialect = "postgres" | "d1";
export type FoundationSourceImportOperation = typeof ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION;

export type FoundationSubjectIdentity = {
  subjectId: string;
  tenantId: string;
  workspaceId: string | null;
  subjectKind: string;
  metadataJson: string;
};

export type FoundationSourceWork = {
  sourceWorkId: string;
  tenantId: string;
  title: string;
  workKind: string;
  publisherSubjectId: string;
  metadataJson: string;
};

export type FoundationSourceEdition = {
  sourceEditionId: string;
  sourceWorkId: string;
  editionLabel: string;
  languageTag: string | null;
  issuedAt: string | null;
  validFrom: string | null;
  validTo: string | null;
  lifecycleStatus: "active" | "superseded" | "retired";
  metadataJson: string;
};

export type FoundationPublicIdentifier = {
  publicIdentifierId: string;
  identifierUri: string;
  targetKind: "subject_identity" | "source_work" | "source_edition";
  targetId: string;
  sensitivityStatus: "normal" | "restricted" | "existence_sensitive";
  retiredAt: string | null;
};

export type FoundationContentFixityEvent = {
  fixityEventId: string;
  contentObjectId: string;
  contentSha256: string;
  verificationStatus: "verified";
  verifier: string;
  verifiedAt: string;
};

export type FoundationContentObject = {
  contentObjectId: string;
  sourceEditionId: string;
  parentContentObjectId: null;
  objectKind: "source_object";
  derivationKind: null;
  mimeType: string | null;
  byteLength: number | null;
  contentSha256: string;
  storageLocator: string | null;
  availabilityStatus: "available";
};

export type FoundationSourceImportBatch = {
  schema: typeof ZUKAN_FOUNDATION_SOURCE_IMPORT_SCHEMA;
  operation: FoundationSourceImportOperation;
  tenantId: string;
  subjects: FoundationSubjectIdentity[];
  sourceWorks: FoundationSourceWork[];
  sourceEditions: FoundationSourceEdition[];
  contentFixityEvents: FoundationContentFixityEvent[];
  contentObjects: FoundationContentObject[];
  publicIdentifiers: FoundationPublicIdentifier[];
  payloadSha256: string;
};

export type FoundationSourceImportLookup = {
  tenantId: string;
  subjectIds: string[];
  sourceWorkIds: string[];
  sourceEditionIds: string[];
  contentFixityEventIds: string[];
  contentObjectIds: string[];
  publicIdentifierIds: string[];
};

export type FoundationSourceImportState = {
  subjects: FoundationSubjectIdentity[];
  sourceWorks: FoundationSourceWork[];
  sourceEditions: FoundationSourceEdition[];
  contentFixityEvents: FoundationContentFixityEvent[];
  contentObjects: FoundationContentObject[];
  publicIdentifiers: FoundationPublicIdentifier[];
};

export type FoundationRepositoryCapabilities = {
  available: boolean;
  dialect: FoundationDialect;
  schemaVersion: "foundation_v2_integrity_0014" | "foundation_v2_integrity_0139" | null;
  readOnly: false;
  blockers: string[];
};

export type FoundationWritePolicy = {
  enabled: boolean;
  killSwitch: boolean;
  allowedTenants: readonly string[];
  allowedOperations: readonly FoundationSourceImportOperation[];
  maxEntities: number;
};

export type FoundationWriteRequest = {
  batch: FoundationSourceImportBatch;
  idempotencyKey: string;
  policy: FoundationWritePolicy;
};

export type FoundationWriteOutcome = {
  status: "disabled" | "blocked" | "succeeded" | "replayed";
  dialect: FoundationDialect;
  tenantId: string;
  operation: FoundationSourceImportOperation;
  idempotencyKey: string;
  payloadSha256: string;
  entityCount: number;
  auditCode:
    | "write_disabled"
    | "kill_switch_active"
    | "tenant_not_allowlisted"
    | "operation_not_allowlisted"
    | "batch_too_large"
    | "invalid_idempotency_key"
    | "payload_digest_mismatch"
    | "batch_reference_invalid"
    | "write_succeeded"
    | "idempotent_replay";
};

export interface ZukanFoundationV2Repository {
  readonly dialect: FoundationDialect;
  capabilities(): Promise<FoundationRepositoryCapabilities>;
  readSourceImportState(input: FoundationSourceImportLookup): Promise<FoundationSourceImportState>;
  applySourceImport(input: FoundationWriteRequest): Promise<FoundationWriteOutcome>;
}

export function foundationSourceImportEntityCount(batch: FoundationSourceImportBatch): number {
  return batch.subjects.length
    + batch.sourceWorks.length
    + batch.sourceEditions.length
    + batch.contentFixityEvents.length
    + batch.contentObjects.length
    + batch.publicIdentifiers.length;
}

function sortedFoundationValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedFoundationValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortedFoundationValue(item)]),
  );
}

export function canonicalFoundationJson(value: unknown): string {
  return JSON.stringify(sortedFoundationValue(value));
}

export function foundationSourceImportPayloadForDigest(
  batch: FoundationSourceImportBatch,
): Omit<FoundationSourceImportBatch, "payloadSha256"> {
  const { payloadSha256: _payloadSha256, ...payload } = batch;
  return payload;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isCanonicalFoundationUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
}

function isCanonicalFoundationJsonText(value: string): boolean {
  try {
    return canonicalFoundationJson(JSON.parse(value)) === value;
  } catch {
    return false;
  }
}

function batchCanonicalScalarsAreValid(batch: FoundationSourceImportBatch): boolean {
  const entityAndReferenceIds = [
    ...batch.subjects.map((item) => item.subjectId),
    ...batch.sourceWorks.flatMap((item) => [item.sourceWorkId, item.publisherSubjectId]),
    ...batch.sourceEditions.flatMap((item) => [item.sourceEditionId, item.sourceWorkId]),
    ...batch.contentFixityEvents.flatMap((item) => [item.fixityEventId, item.contentObjectId]),
    ...batch.contentObjects.flatMap((item) => [
      item.contentObjectId,
      item.sourceEditionId,
      ...(item.parentContentObjectId === null ? [] : [item.parentContentObjectId]),
    ]),
    ...batch.publicIdentifiers.flatMap((item) => [
      item.publicIdentifierId,
      item.targetId,
    ]),
  ];
  if (entityAndReferenceIds.some((value) => !isCanonicalFoundationUuid(value))) return false;
  if (batch.subjects.some((item) => !isCanonicalFoundationJsonText(item.metadataJson))) return false;
  if (batch.sourceWorks.some((item) => !isCanonicalFoundationJsonText(item.metadataJson))) return false;
  if (batch.sourceEditions.some((item) => {
    if (!isCanonicalFoundationJsonText(item.metadataJson)) return true;
    for (const timestamp of [item.issuedAt, item.validFrom, item.validTo]) {
      if (timestamp !== null && canonicalFoundationTimestamp(timestamp) !== timestamp) return true;
    }
    return item.validFrom !== null
      && item.validTo !== null
      && Date.parse(item.validTo) <= Date.parse(item.validFrom);
  })) return false;
  if (batch.publicIdentifiers.some((item) =>
    item.retiredAt !== null && canonicalFoundationTimestamp(item.retiredAt) !== item.retiredAt)) {
    return false;
  }
  if (!/^[0-9a-f]{64}$/u.test(batch.payloadSha256)) return false;
  return batch.contentObjects.every((item) => /^[0-9a-f]{64}$/u.test(item.contentSha256))
    && batch.contentFixityEvents.every((item) => /^[0-9a-f]{64}$/u.test(item.contentSha256));
}

function batchReferencesAreValid(batch: FoundationSourceImportBatch): boolean {
  if (!batchCanonicalScalarsAreValid(batch)) return false;
  const subjectIds = new Set(batch.subjects.map((item) => item.subjectId));
  const workIds = new Set(batch.sourceWorks.map((item) => item.sourceWorkId));
  const editionIds = new Set(batch.sourceEditions.map((item) => item.sourceEditionId));
  const fixityEventIds = new Set(batch.contentFixityEvents.map((item) => item.fixityEventId));
  const contentObjectIds = new Set(batch.contentObjects.map((item) => item.contentObjectId));
  const contentHashes = new Set(batch.contentObjects.map((item) => item.contentSha256));
  const identifierIds = new Set(batch.publicIdentifiers.map((item) => item.publicIdentifierId));
  const identifierUris = new Set(batch.publicIdentifiers.map((item) => item.identifierUri));
  if (
    subjectIds.size !== batch.subjects.length
    || workIds.size !== batch.sourceWorks.length
    || editionIds.size !== batch.sourceEditions.length
    || fixityEventIds.size !== batch.contentFixityEvents.length
    || contentObjectIds.size !== batch.contentObjects.length
    || contentHashes.size !== batch.contentObjects.length
    || identifierIds.size !== batch.publicIdentifiers.length
    || identifierUris.size !== batch.publicIdentifiers.length
  ) {
    return false;
  }
  if (batch.subjects.some((item) => item.tenantId !== batch.tenantId)) return false;
  if (batch.sourceWorks.some((item) =>
    item.tenantId !== batch.tenantId || !subjectIds.has(item.publisherSubjectId))) return false;
  if (batch.sourceEditions.some((item) => !workIds.has(item.sourceWorkId))) return false;
  const objectsById = new Map(batch.contentObjects.map((item) => [item.contentObjectId, item]));
  const verifiedFixity = new Set(
    batch.contentFixityEvents.map((item) => `${item.contentObjectId}\u0000${item.contentSha256}`),
  );
  if (batch.contentObjects.some((item) =>
    !editionIds.has(item.sourceEditionId)
    || item.parentContentObjectId !== null
    || item.objectKind !== "source_object"
    || item.derivationKind !== null
    || item.availabilityStatus !== "available"
    || !/^[0-9a-f]{64}$/u.test(item.contentSha256)
    || (item.byteLength !== null
      && (!Number.isSafeInteger(item.byteLength) || item.byteLength < 0))
    || !verifiedFixity.has(`${item.contentObjectId}\u0000${item.contentSha256}`)
  )) return false;
  if (batch.contentFixityEvents.some((item) => {
    const object = objectsById.get(item.contentObjectId);
    return !object
      || object.contentSha256 !== item.contentSha256
      || !/^[0-9a-f]{64}$/u.test(item.contentSha256)
      || item.verificationStatus !== "verified"
      || item.verifier.trim().length === 0
      || canonicalFoundationTimestamp(item.verifiedAt) !== item.verifiedAt;
  })) return false;
  if (batch.subjects.some((item) => item.subjectKind !== "source_publisher")) return false;
  if (batch.sourceWorks.some((item) => item.workKind !== "regional_source")) return false;
  if (batch.publicIdentifiers.some((item) =>
    item.sensitivityStatus !== "normal" || item.retiredAt !== null)) return false;
  return batch.publicIdentifiers.every((item) => {
    if (item.targetKind === "subject_identity") return subjectIds.has(item.targetId);
    if (item.targetKind === "source_work") return workIds.has(item.targetId);
    return editionIds.has(item.targetId);
  });
}

export function canonicalFoundationTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/u.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

export async function validateFoundationWriteRequest(
  input: FoundationWriteRequest,
): Promise<FoundationWriteOutcome | null> {
  const { batch, idempotencyKey, policy } = input;
  const base = {
    tenantId: batch.tenantId,
    operation: batch.operation,
    idempotencyKey,
    payloadSha256: batch.payloadSha256,
    entityCount: foundationSourceImportEntityCount(batch),
  } as const;
  if (!policy.enabled) {
    return { ...base, dialect: "postgres", status: "disabled", auditCode: "write_disabled" };
  }
  if (policy.killSwitch) {
    return { ...base, dialect: "postgres", status: "blocked", auditCode: "kill_switch_active" };
  }
  if (!policy.allowedTenants.includes(batch.tenantId)) {
    return { ...base, dialect: "postgres", status: "blocked", auditCode: "tenant_not_allowlisted" };
  }
  if (!policy.allowedOperations.includes(batch.operation)) {
    return { ...base, dialect: "postgres", status: "blocked", auditCode: "operation_not_allowlisted" };
  }
  const maxEntities = Number.isInteger(policy.maxEntities)
    && policy.maxEntities >= 1
    && policy.maxEntities <= 64
    ? policy.maxEntities
    : 0;
  if (base.entityCount < 1 || base.entityCount > maxEntities) {
    return { ...base, dialect: "postgres", status: "blocked", auditCode: "batch_too_large" };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(idempotencyKey)) {
    return { ...base, dialect: "postgres", status: "blocked", auditCode: "invalid_idempotency_key" };
  }
  const computedDigest = await sha256Hex(canonicalFoundationJson(
    foundationSourceImportPayloadForDigest(batch),
  ));
  if (computedDigest !== batch.payloadSha256) {
    return { ...base, dialect: "postgres", status: "blocked", auditCode: "payload_digest_mismatch" };
  }
  const tenantScope = (await sha256Hex([
    ZUKAN_FOUNDATION_ID_NAMESPACE,
    "tenant",
    batch.tenantId,
  ].join("\u0000"))).slice(0, 20);
  const tenantIdentifierPrefix = `https://zukan.earth/id/source-registry/tenant/${tenantScope}/`;
  if (batch.publicIdentifiers.some((item) => !item.identifierUri.startsWith(tenantIdentifierPrefix))) {
    return { ...base, dialect: "postgres", status: "blocked", auditCode: "batch_reference_invalid" };
  }
  if (!batchReferencesAreValid(batch)) {
    return { ...base, dialect: "postgres", status: "blocked", auditCode: "batch_reference_invalid" };
  }
  return null;
}

export function withFoundationDialect(
  outcome: FoundationWriteOutcome,
  dialect: FoundationDialect,
): FoundationWriteOutcome {
  return { ...outcome, dialect };
}

export function emptyFoundationSourceImportState(): FoundationSourceImportState {
  return {
    subjects: [],
    sourceWorks: [],
    sourceEditions: [],
    contentFixityEvents: [],
    contentObjects: [],
    publicIdentifiers: [],
  };
}
