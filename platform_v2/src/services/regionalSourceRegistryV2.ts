import {
  REGIONAL_PUBLISHERS,
  REGIONAL_SOURCE_ASSETS,
  type RegionalPublisher,
  type RegionalPublisherKind,
  type RegionalSourceAsset,
  type RegionalSourceFormat,
  type RegionalSourceRightsClass,
  type RegionalSourceState,
} from "./regionalSourceRegistry.js";

export type RegionalAcquisitionState =
  | "NOT_ACQUIRED"
  | "METADATA_ONLY"
  | "FETCHED"
  | "CHECKSUMMED"
  | "PRESERVED"
  | "EXTRACTION_FAILED"
  | "ACCESS_BLOCKED"
  | "RIGHTS_BLOCKED";

export type RegionalEditionLifecycle = "ACTIVE" | "SUPERSEDED" | "RETIRED";

export type RegionalSourceEdition = {
  sourceEditionId: string;
  sourceAssetId: string;
  editionLabel: string;
  canonicalUrl: string;
  issuedAt: string | null;
  updatedAt: string | null;
  retrievedAt: string | null;
  language: string;
  checksumSha256: string | null;
  acquisitionState: RegionalAcquisitionState;
  lifecycle: RegionalEditionLifecycle;
  previousEditionId: string | null;
  nextEditionId: string | null;
};

export type RegionalSourceRegistryEntryV2 = {
  source: RegionalSourceAsset;
  editions: readonly RegionalSourceEdition[];
  currentEdition: RegionalSourceEdition | null;
  publishers: readonly RegionalPublisher[];
};

export type RegionalSourceRegistryFilter = {
  publisherKind?: RegionalPublisherKind;
  format?: RegionalSourceFormat;
  geographicScope?: string;
  rightsClass?: RegionalSourceRightsClass;
  sourceState?: RegionalSourceState;
  acquisitionState?: RegionalAcquisitionState;
  lifecycle?: RegionalEditionLifecycle;
  updatedAfter?: string;
};

export type RegionalSourceRegistrySummaryV2 = {
  publisherCount: number;
  sourceCount: number;
  editionCount: number;
  municipalSourceCount: number;
  nonMunicipalSourceCount: number;
  byFormat: Record<string, number>;
  byRightsClass: Record<string, number>;
  bySourceState: Record<string, number>;
  byAcquisitionState: Record<string, number>;
  byLifecycle: Record<string, number>;
};

export const REGIONAL_ACQUISITION_STATES: readonly RegionalAcquisitionState[] = [
  "NOT_ACQUIRED",
  "METADATA_ONLY",
  "FETCHED",
  "CHECKSUMMED",
  "PRESERVED",
  "EXTRACTION_FAILED",
  "ACCESS_BLOCKED",
  "RIGHTS_BLOCKED",
] as const;

export const REGIONAL_EDITION_LIFECYCLES: readonly RegionalEditionLifecycle[] = [
  "ACTIVE",
  "SUPERSEDED",
  "RETIRED",
] as const;

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function editionDate(source: RegionalSourceAsset): string {
  return source.issuedAt ?? source.updatedAt ?? source.retrievedAt ?? "undated";
}

function editionId(source: RegionalSourceAsset): string {
  const sourceSuffix = source.sourceAssetId.startsWith("source:")
    ? source.sourceAssetId.slice("source:".length)
    : source.sourceAssetId;
  const date = editionDate(source);
  return sourceSuffix.endsWith(`:${date}`)
    ? `edition:${sourceSuffix}`
    : `edition:${sourceSuffix}:${date}`;
}

function acquisitionState(source: RegionalSourceAsset): RegionalAcquisitionState {
  if (source.rightsClass === "RESTRICTED" || source.rightsClass === "UNKNOWN") {
    return "RIGHTS_BLOCKED";
  }
  if (source.state === "PRESERVED") return "PRESERVED";
  if (source.retrievedAt === null) return "NOT_ACQUIRED";
  return "METADATA_ONLY";
}

function lifecycle(source: RegionalSourceAsset): RegionalEditionLifecycle {
  if (source.state === "SUPERSEDED") return "SUPERSEDED";
  if (source.state === "RETIRED") return "RETIRED";
  return "ACTIVE";
}

export function buildRegionalSourceEditions(
  sources: readonly RegionalSourceAsset[] = REGIONAL_SOURCE_ASSETS,
): readonly RegionalSourceEdition[] {
  return sources.map((source) => ({
    sourceEditionId: editionId(source),
    sourceAssetId: source.sourceAssetId,
    editionLabel: editionDate(source),
    canonicalUrl: source.canonicalUrl,
    issuedAt: source.issuedAt,
    updatedAt: source.updatedAt,
    retrievedAt: source.retrievedAt,
    language: source.language,
    checksumSha256: null,
    acquisitionState: acquisitionState(source),
    lifecycle: lifecycle(source),
    previousEditionId: null,
    nextEditionId: null,
  }));
}

export const REGIONAL_SOURCE_EDITIONS: readonly RegionalSourceEdition[] = buildRegionalSourceEditions();

export function buildRegionalSourceRegistryEntries(
  sources: readonly RegionalSourceAsset[] = REGIONAL_SOURCE_ASSETS,
  publishers: readonly RegionalPublisher[] = REGIONAL_PUBLISHERS,
  editions?: readonly RegionalSourceEdition[],
): readonly RegionalSourceRegistryEntryV2[] {
  const resolvedEditions = editions ?? buildRegionalSourceEditions(sources);
  const publisherById = new Map(publishers.map((publisher) => [publisher.publisherId, publisher]));
  const editionsBySource = new Map<string, RegionalSourceEdition[]>();

  for (const edition of resolvedEditions) {
    const current = editionsBySource.get(edition.sourceAssetId) ?? [];
    current.push(edition);
    editionsBySource.set(edition.sourceAssetId, current);
  }

  return sources.map((source) => {
    const sourceEditions = [...(editionsBySource.get(source.sourceAssetId) ?? [])]
      .sort((left, right) => left.sourceEditionId.localeCompare(right.sourceEditionId));
    const active = sourceEditions.filter((edition) => edition.lifecycle === "ACTIVE");
    if (active.length > 1) {
      throw new Error(`multiple_active_regional_source_editions:${source.sourceAssetId}`);
    }
    const sourcePublishers = source.publisherIds.map((publisherId) => {
      const publisher = publisherById.get(publisherId);
      if (!publisher) throw new Error(`regional_source_publisher_not_found:${source.sourceAssetId}:${publisherId}`);
      return publisher;
    });
    return {
      source,
      editions: sourceEditions,
      currentEdition: active[0] ?? null,
      publishers: sourcePublishers,
    };
  });
}

function entryUpdatedAt(entry: RegionalSourceRegistryEntryV2): number | null {
  const value = entry.currentEdition?.updatedAt
    ?? entry.currentEdition?.issuedAt
    ?? entry.currentEdition?.retrievedAt
    ?? null;
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function filterRegionalSourceRegistryEntries(
  filter: RegionalSourceRegistryFilter,
  entries: readonly RegionalSourceRegistryEntryV2[] = buildRegionalSourceRegistryEntries(),
): readonly RegionalSourceRegistryEntryV2[] {
  const updatedAfter = filter.updatedAfter ? Date.parse(filter.updatedAfter) : null;
  if (filter.updatedAfter && !Number.isFinite(updatedAfter)) {
    throw new Error("invalid_updated_after");
  }

  return entries.filter((entry) => {
    if (filter.publisherKind && !entry.publishers.some((publisher) => publisher.kind === filter.publisherKind)) return false;
    if (filter.format && entry.source.format !== filter.format) return false;
    if (filter.geographicScope && !entry.source.geographicScopes.includes(filter.geographicScope)) return false;
    if (filter.rightsClass && entry.source.rightsClass !== filter.rightsClass) return false;
    if (filter.sourceState && entry.source.state !== filter.sourceState) return false;
    if (filter.acquisitionState && entry.currentEdition?.acquisitionState !== filter.acquisitionState) return false;
    if (filter.lifecycle && entry.currentEdition?.lifecycle !== filter.lifecycle) return false;
    if (updatedAfter !== null) {
      const updatedAt = entryUpdatedAt(entry);
      if (updatedAt === null || updatedAt <= updatedAfter) return false;
    }
    return true;
  });
}

export function buildRegionalSourceRegistrySummaryV2(
  entries: readonly RegionalSourceRegistryEntryV2[] = buildRegionalSourceRegistryEntries(),
): RegionalSourceRegistrySummaryV2 {
  const publisherIds = new Set(entries.flatMap((entry) => entry.publishers.map((publisher) => publisher.publisherId)));
  const municipalSourceCount = entries.filter((entry) =>
    entry.publishers.some((publisher) => publisher.kind === "municipality"),
  ).length;
  const editions = entries.flatMap((entry) => entry.editions);
  return {
    publisherCount: publisherIds.size,
    sourceCount: entries.length,
    editionCount: editions.length,
    municipalSourceCount,
    nonMunicipalSourceCount: entries.length - municipalSourceCount,
    byFormat: countBy(entries.map((entry) => entry.source.format)),
    byRightsClass: countBy(entries.map((entry) => entry.source.rightsClass)),
    bySourceState: countBy(entries.map((entry) => entry.source.state)),
    byAcquisitionState: countBy(editions.map((edition) => edition.acquisitionState)),
    byLifecycle: countBy(editions.map((edition) => edition.lifecycle)),
  };
}

export function findRegionalSourceRegistryEntry(
  sourceAssetId: string,
): RegionalSourceRegistryEntryV2 | null {
  return buildRegionalSourceRegistryEntries().find((entry) => entry.source.sourceAssetId === sourceAssetId) ?? null;
}
