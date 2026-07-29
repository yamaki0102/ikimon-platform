import type { FastifyInstance } from "fastify";
import {
  REGIONAL_PUBLISHERS,
  REGIONAL_SOURCE_ASSETS,
  type RegionalPublisherKind,
  type RegionalSourceFormat,
  type RegionalSourceRightsClass,
  type RegionalSourceState,
} from "../services/regionalSourceRegistry.js";
import {
  REGIONAL_ACQUISITION_STATES,
  REGIONAL_EDITION_LIFECYCLES,
  buildRegionalSourceRegistrySummaryV2,
  filterRegionalSourceRegistryEntries,
  findRegionalSourceRegistryEntry,
  type RegionalAcquisitionState,
  type RegionalEditionLifecycle,
  type RegionalSourceRegistryFilter,
} from "../services/regionalSourceRegistryV2.js";

type RegistryQuery = {
  publisherKind?: string;
  format?: string;
  geographicScope?: string;
  rightsClass?: string;
  sourceState?: string;
  acquisitionState?: string;
  lifecycle?: string;
  updatedAfter?: string;
};

const FOUNDATION_BINDING = {
  schema: "zukan.foundation-source-binding/v1",
  planner: "plan:zukan-foundation-source-import",
  applier: "apply:zukan-foundation-source-import",
  canonicalModule: "zukanFoundationV2SourceRegistryImport",
  projectionEmbedded: false,
} as const;

const PUBLISHER_KINDS = new Set(REGIONAL_PUBLISHERS.map((publisher) => publisher.kind));
const SOURCE_FORMATS = new Set(REGIONAL_SOURCE_ASSETS.map((source) => source.format));
const RIGHTS_CLASSES = new Set(REGIONAL_SOURCE_ASSETS.map((source) => source.rightsClass));
const SOURCE_STATES = new Set(REGIONAL_SOURCE_ASSETS.map((source) => source.state));
const ACQUISITION_STATES = new Set(REGIONAL_ACQUISITION_STATES);
const LIFECYCLES = new Set(REGIONAL_EDITION_LIFECYCLES);

function optionalEnum<T extends string>(
  value: string | undefined,
  allowed: ReadonlySet<string>,
  label: string,
): T | undefined {
  if (value === undefined || value === "") return undefined;
  if (!allowed.has(value)) throw new Error(`invalid_${label}`);
  return value as T;
}

function parseFilter(query: RegistryQuery): RegionalSourceRegistryFilter {
  if (query.updatedAfter && !Number.isFinite(Date.parse(query.updatedAfter))) {
    throw new Error("invalid_updated_after");
  }
  return {
    publisherKind: optionalEnum<RegionalPublisherKind>(query.publisherKind, PUBLISHER_KINDS, "publisher_kind"),
    format: optionalEnum<RegionalSourceFormat>(query.format, SOURCE_FORMATS, "format"),
    geographicScope: query.geographicScope?.trim() || undefined,
    rightsClass: optionalEnum<RegionalSourceRightsClass>(query.rightsClass, RIGHTS_CLASSES, "rights_class"),
    sourceState: optionalEnum<RegionalSourceState>(query.sourceState, SOURCE_STATES, "source_state"),
    acquisitionState: optionalEnum<RegionalAcquisitionState>(
      query.acquisitionState,
      ACQUISITION_STATES,
      "acquisition_state",
    ),
    lifecycle: optionalEnum<RegionalEditionLifecycle>(query.lifecycle, LIFECYCLES, "lifecycle"),
    updatedAfter: query.updatedAfter,
  };
}

export async function registerRegionalSourceRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: RegistryQuery }>("/api/regional-sources", async (request, reply) => {
    let filter: RegionalSourceRegistryFilter;
    try {
      filter = parseFilter(request.query);
    } catch (error) {
      reply.code(400);
      return {
        schema: "zukan.regional-source-registry-error/v1",
        error: error instanceof Error ? error.message : "invalid_filter",
      };
    }

    const entries = filterRegionalSourceRegistryEntries(filter);
    const publisherIds = new Set(entries.flatMap((entry) => entry.publishers.map((publisher) => publisher.publisherId)));
    const publishers = REGIONAL_PUBLISHERS.filter((publisher) => publisherIds.has(publisher.publisherId));
    const sources = entries.map((entry) => entry.source);
    const editions = entries.flatMap((entry) => entry.editions);

    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

    return {
      schema: "zukan.regional-source-registry/v1",
      extendedSchema: "zukan.regional-source-registry/v2",
      generatedAt: "2026-07-30",
      foundationBinding: FOUNDATION_BINDING,
      appliedFilter: filter,
      summary: buildRegionalSourceRegistrySummaryV2(entries),
      publishers,
      sources,
      editions,
      entries,
    };
  });

  app.get<{ Params: { sourceAssetId: string } }>("/api/regional-sources/:sourceAssetId", async (request, reply) => {
    const entry = findRegionalSourceRegistryEntry(request.params.sourceAssetId);
    if (!entry) {
      reply.code(404);
      return {
        schema: "zukan.regional-source-registry-error/v1",
        error: "source_not_found",
      };
    }

    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

    return {
      schema: "zukan.regional-source-registry-item/v1",
      extendedSchema: "zukan.regional-source-registry-item/v2",
      foundationBinding: FOUNDATION_BINDING,
      source: entry.source,
      currentEdition: entry.currentEdition,
      editions: entry.editions,
      publishers: entry.publishers,
    };
  });
}
