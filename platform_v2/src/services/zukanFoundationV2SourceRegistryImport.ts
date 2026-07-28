import { createHash } from "node:crypto";
import {
  REGIONAL_PUBLISHERS,
  REGIONAL_SOURCE_ASSETS,
  type RegionalPublisher,
  type RegionalSourceAsset,
} from "./regionalSourceRegistry.js";
import {
  ZUKAN_FOUNDATION_ID_NAMESPACE,
  ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION,
  ZUKAN_FOUNDATION_SOURCE_IMPORT_SCHEMA,
  canonicalFoundationJson,
  canonicalFoundationTimestamp,
  emptyFoundationSourceImportState,
  foundationSourceImportEntityCount,
  type FoundationPublicIdentifier,
  type FoundationSourceEdition,
  type FoundationSourceImportBatch,
  type FoundationSourceImportState,
  type FoundationSourceWork,
  type FoundationSubjectIdentity,
} from "./zukanFoundationV2RepositoryContract.js";

const MAX_SOURCE_ASSETS = 32;
const MAX_IMPORT_ENTITIES = 64;

type FoundationImportEntity =
  | { kind: "subject_identity"; id: string }
  | { kind: "source_work"; id: string }
  | { kind: "source_edition"; id: string }
  | { kind: "content_fixity_event"; id: string }
  | { kind: "content_object"; id: string }
  | { kind: "public_identifier"; id: string };

export type FoundationSourceImportPlan = {
  schema: "zukan.foundation-source-import-plan/v1";
  mode: "dry_run";
  tenantId: string;
  payloadSha256: string;
  batch: FoundationSourceImportBatch;
  diff: {
    wouldInsert: FoundationImportEntity[];
    unchanged: FoundationImportEntity[];
    conflicts: FoundationImportEntity[];
  };
  blockers: string[];
  unmapped: string[];
  counts: {
    sourceAssets: number;
    entities: number;
    wouldInsert: number;
    unchanged: number;
    conflicts: number;
  };
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function deterministicFoundationUuid(input: {
  tenantId: string;
  entityKind: string;
  externalId: string;
}): string {
  const digest = sha256([
    ZUKAN_FOUNDATION_ID_NAMESPACE,
    input.tenantId,
    input.entityKind,
    input.externalId,
  ].join("\u0000"));
  const bytes = Buffer.from(digest.slice(0, 32), "hex");
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function tenantIdentifierScope(tenantId: string): string {
  return sha256([
    ZUKAN_FOUNDATION_ID_NAMESPACE,
    "tenant",
    tenantId,
  ].join("\u0000")).slice(0, 20);
}

function publicIdentifierUri(
  tenantId: string,
  kind: "publisher" | "source" | "edition",
  externalId: string,
): string {
  return `https://zukan.earth/id/source-registry/tenant/${tenantIdentifierScope(tenantId)}/${kind}/${encodeURIComponent(externalId)}`;
}

function stableEditionKey(source: RegionalSourceAsset): string {
  return canonicalFoundationJson({
    sourceAssetId: source.sourceAssetId,
    canonicalUrl: source.canonicalUrl,
    issuedAt: source.issuedAt,
    updatedAt: source.updatedAt,
    retrievedAt: source.retrievedAt,
  });
}

function lifecycleStatus(source: RegionalSourceAsset): FoundationSourceEdition["lifecycleStatus"] {
  if (source.state === "SUPERSEDED") return "superseded";
  if (source.state === "RETIRED") return "retired";
  return "active";
}

function timestampDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/u.test(value)
    ? canonicalFoundationTimestamp(value)
    : null;
}

function identifier(
  tenantId: string,
  kind: "publisher" | "source" | "edition",
  externalId: string,
  targetKind: FoundationPublicIdentifier["targetKind"],
  targetId: string,
): FoundationPublicIdentifier {
  return {
    publicIdentifierId: deterministicFoundationUuid({
      tenantId,
      entityKind: `public_identifier:${kind}`,
      externalId,
    }),
    identifierUri: publicIdentifierUri(tenantId, kind, externalId),
    targetKind,
    targetId,
    sensitivityStatus: "normal",
    retiredAt: null,
  };
}

function byId<T>(items: readonly T[], id: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [id(item), item]));
}

function entityDiff<T>(
  kind: FoundationImportEntity["kind"],
  desired: readonly T[],
  existing: readonly T[],
  id: (item: T) => string,
): FoundationSourceImportPlan["diff"] {
  const current = byId(existing, id);
  const result: FoundationSourceImportPlan["diff"] = {
    wouldInsert: [],
    unchanged: [],
    conflicts: [],
  };
  for (const item of desired) {
    const entity = { kind, id: id(item) } as FoundationImportEntity;
    const stored = current.get(entity.id);
    if (!stored) {
      result.wouldInsert.push(entity);
    } else if (canonicalFoundationJson(stored) === canonicalFoundationJson(item)) {
      result.unchanged.push(entity);
    } else {
      result.conflicts.push(entity);
    }
  }
  return result;
}

function mergeDiffs(
  diffs: ReadonlyArray<FoundationSourceImportPlan["diff"]>,
): FoundationSourceImportPlan["diff"] {
  return {
    wouldInsert: diffs.flatMap((diff) => diff.wouldInsert),
    unchanged: diffs.flatMap((diff) => diff.unchanged),
    conflicts: diffs.flatMap((diff) => diff.conflicts),
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function planRegionalSourceFoundationImport(input: {
  tenantId: string;
  publishers?: readonly RegionalPublisher[];
  sourceAssets?: readonly RegionalSourceAsset[];
  existing?: FoundationSourceImportState;
}): FoundationSourceImportPlan {
  const tenantId = input.tenantId.trim();
  if (!tenantId) throw new Error("foundation_tenant_required");
  const publishers = input.publishers ?? REGIONAL_PUBLISHERS;
  const sourceAssets = input.sourceAssets ?? REGIONAL_SOURCE_ASSETS;
  const existing = input.existing ?? emptyFoundationSourceImportState();
  const blockers: string[] = [];
  const unmapped: string[] = [];

  if (sourceAssets.length > MAX_SOURCE_ASSETS) {
    blockers.push(`source_asset_limit_exceeded:${sourceAssets.length}:${MAX_SOURCE_ASSETS}`);
  }

  const publisherByExternalId = new Map<string, RegionalPublisher>();
  for (const publisher of publishers) {
    if (publisherByExternalId.has(publisher.publisherId)) {
      blockers.push(`duplicate_publisher_id:${publisher.publisherId}`);
    }
    publisherByExternalId.set(publisher.publisherId, publisher);
  }

  const seenSources = new Set<string>();
  const subjects = new Map<string, FoundationSubjectIdentity>();
  const sourceWorks: FoundationSourceWork[] = [];
  const sourceEditions: FoundationSourceEdition[] = [];
  const publicIdentifiers: FoundationPublicIdentifier[] = [];

  for (const source of sourceAssets) {
    if (seenSources.has(source.sourceAssetId)) {
      blockers.push(`duplicate_source_asset_id:${source.sourceAssetId}`);
      continue;
    }
    seenSources.add(source.sourceAssetId);
    if (source.publisherIds.length !== 1) {
      blockers.push(`lossy_multi_publisher_mapping:${source.sourceAssetId}:${source.publisherIds.length}`);
      continue;
    }
    const publisherExternalId = source.publisherIds[0] ?? "";
    const publisher = publisherByExternalId.get(publisherExternalId);
    if (!publisher) {
      blockers.push(`publisher_not_found:${source.sourceAssetId}:${publisherExternalId}`);
      continue;
    }

    const subjectId = deterministicFoundationUuid({
      tenantId,
      entityKind: "subject_identity",
      externalId: publisher.publisherId,
    });
    if (!subjects.has(subjectId)) {
      subjects.set(subjectId, {
        subjectId,
        tenantId,
        workspaceId: null,
        subjectKind: "source_publisher",
        metadataJson: canonicalFoundationJson({
          sourceRegistry: {
            externalPublisherId: publisher.publisherId,
            name: publisher.name,
            kind: publisher.kind,
            officialUrl: publisher.officialUrl,
          },
        }),
      });
      publicIdentifiers.push(identifier(
        tenantId,
        "publisher",
        publisher.publisherId,
        "subject_identity",
        subjectId,
      ));
    }

    const sourceWorkId = deterministicFoundationUuid({
      tenantId,
      entityKind: "source_work",
      externalId: source.sourceAssetId,
    });
    sourceWorks.push({
      sourceWorkId,
      tenantId,
      title: source.title,
      workKind: "regional_source",
      publisherSubjectId: subjectId,
      metadataJson: canonicalFoundationJson({
        sourceRegistry: {
          externalSourceAssetId: source.sourceAssetId,
          canonicalUrl: source.canonicalUrl,
          format: source.format,
          geographicScopes: [...source.geographicScopes].sort(),
          rightsClass: source.rightsClass,
          state: source.state,
          licenseLabel: source.licenseLabel,
          notes: source.notes,
        },
      }),
    });
    publicIdentifiers.push(identifier(
      tenantId,
      "source",
      source.sourceAssetId,
      "source_work",
      sourceWorkId,
    ));

    const editionExternalId = stableEditionKey(source);
    const sourceEditionId = deterministicFoundationUuid({
      tenantId,
      entityKind: "source_edition",
      externalId: editionExternalId,
    });
    sourceEditions.push({
      sourceEditionId,
      sourceWorkId,
      editionLabel: source.issuedAt ?? source.updatedAt ?? source.retrievedAt ?? "undated",
      languageTag: source.language || null,
      issuedAt: timestampDate(source.issuedAt),
      validFrom: timestampDate(source.issuedAt ?? source.updatedAt),
      validTo: null,
      lifecycleStatus: lifecycleStatus(source),
      metadataJson: canonicalFoundationJson({
        sourceRegistry: {
          externalSourceAssetId: source.sourceAssetId,
          canonicalUrl: source.canonicalUrl,
          issuedAt: source.issuedAt,
          updatedAt: source.updatedAt,
          retrievedAt: source.retrievedAt,
          rightsClass: source.rightsClass,
          state: source.state,
          bytesAcquired: false,
          checksumSha256: null,
        },
      }),
    });
    publicIdentifiers.push(identifier(
      tenantId,
      "edition",
      `${source.sourceAssetId}:${sha256(editionExternalId)}`,
      "source_edition",
      sourceEditionId,
    ));

    unmapped.push(`rights_evaluation_not_materialized:${source.sourceAssetId}`);
    unmapped.push(`content_object_requires_bytes_and_checksum:${source.sourceAssetId}`);
  }

  const batchWithoutDigest: Omit<FoundationSourceImportBatch, "payloadSha256"> = {
    schema: ZUKAN_FOUNDATION_SOURCE_IMPORT_SCHEMA,
    operation: ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION,
    tenantId,
    subjects: [...subjects.values()].sort((left, right) => left.subjectId.localeCompare(right.subjectId)),
    sourceWorks: sourceWorks.sort((left, right) => left.sourceWorkId.localeCompare(right.sourceWorkId)),
    sourceEditions: sourceEditions.sort((left, right) => left.sourceEditionId.localeCompare(right.sourceEditionId)),
    contentFixityEvents: [],
    contentObjects: [],
    publicIdentifiers: publicIdentifiers.sort(
      (left, right) => left.publicIdentifierId.localeCompare(right.publicIdentifierId),
    ),
  };
  const payloadSha256 = sha256(canonicalFoundationJson(batchWithoutDigest));
  const batch: FoundationSourceImportBatch = { ...batchWithoutDigest, payloadSha256 };
  const entityCount = foundationSourceImportEntityCount(batch);
  if (entityCount > MAX_IMPORT_ENTITIES) {
    blockers.push(`import_entity_limit_exceeded:${entityCount}:${MAX_IMPORT_ENTITIES}`);
  }

  const diff = mergeDiffs([
    entityDiff("subject_identity", batch.subjects, existing.subjects, (item) => item.subjectId),
    entityDiff("source_work", batch.sourceWorks, existing.sourceWorks, (item) => item.sourceWorkId),
    entityDiff("source_edition", batch.sourceEditions, existing.sourceEditions, (item) => item.sourceEditionId),
    entityDiff(
      "content_fixity_event",
      batch.contentFixityEvents,
      existing.contentFixityEvents,
      (item) => item.fixityEventId,
    ),
    entityDiff(
      "content_object",
      batch.contentObjects,
      existing.contentObjects,
      (item) => item.contentObjectId,
    ),
    entityDiff(
      "public_identifier",
      batch.publicIdentifiers,
      existing.publicIdentifiers,
      (item) => item.publicIdentifierId,
    ),
  ]);
  blockers.push(...diff.conflicts.map((entity) => `existing_row_conflict:${entity.kind}:${entity.id}`));

  return {
    schema: "zukan.foundation-source-import-plan/v1",
    mode: "dry_run",
    tenantId,
    payloadSha256,
    batch,
    diff,
    blockers: uniqueStrings(blockers),
    unmapped: uniqueStrings(unmapped),
    counts: {
      sourceAssets: sourceAssets.length,
      entities: entityCount,
      wouldInsert: diff.wouldInsert.length,
      unchanged: diff.unchanged.length,
      conflicts: diff.conflicts.length,
    },
  };
}

export function lookupForFoundationSourceImport(batch: FoundationSourceImportBatch) {
  return {
    tenantId: batch.tenantId,
    subjectIds: batch.subjects.map((item) => item.subjectId),
    sourceWorkIds: batch.sourceWorks.map((item) => item.sourceWorkId),
    sourceEditionIds: batch.sourceEditions.map((item) => item.sourceEditionId),
    contentFixityEventIds: batch.contentFixityEvents.map((item) => item.fixityEventId),
    contentObjectIds: batch.contentObjects.map((item) => item.contentObjectId),
    publicIdentifierIds: batch.publicIdentifiers.map((item) => item.publicIdentifierId),
  };
}
