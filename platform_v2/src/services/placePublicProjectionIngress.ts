/**
 * Pure, public-safe ingress for one Place projection.
 *
 * This is a source-only boundary: it validates the existing Area/Place public
 * contract semantics without reading, writing, publishing, or contacting a
 * runtime. The projection intentionally contains no location or policy data.
 */

export const PLACE_PUBLIC_PROJECTION_INGRESS_SCHEMA = "zukan.place-public-projection-ingress.v1" as const;

export type PlacePublicProjectionIngressReasonCode =
  | "PLACE_PUBLIC_PROJECTION_ACCEPTED"
  | "INVALID_INPUT"
  | "PUBLIC_AUTHORITY_DENIED"
  | "SOURCE_NOT_CURRENT"
  | "SOURCE_NOT_PUBLIC";

export type PlacePublicProjectionSource = {
  readonly sourceId: string;
  readonly revision: string;
  readonly observedAt: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string;
  readonly freshness: "CURRENT" | "STALE" | "UNCERTAIN";
  readonly authority: "OFFICIAL_VERIFIED" | "SOURCE_VERIFIED" | "COMMUNITY_OBSERVED";
  readonly rights: "PUBLIC" | "RESTRICTED" | "PRIVATE";
};

export type PlacePublicProjectionIngressInput = {
  readonly asOf: string;
  readonly place: {
    readonly id: string;
    readonly areaId: string;
    readonly name: string;
    readonly source: PlacePublicProjectionSource;
    readonly publicProjection: "AUTHORIZED" | "DENIED";
  };
};

export type PlacePublicProjection = {
  readonly id: string;
  readonly areaId: string;
  readonly name: string;
  readonly source: PlacePublicProjectionSource;
};

export type PlacePublicProjectionIngressResult = {
  readonly schema_version: typeof PLACE_PUBLIC_PROJECTION_INGRESS_SCHEMA;
  readonly decision: "ALLOW" | "DENY";
  readonly reasonCode: PlacePublicProjectionIngressReasonCode;
  readonly projection: PlacePublicProjection | null;
  readonly serialized: string | null;
  readonly effects: {
    readonly databaseReads: 0;
    readonly databaseWrites: 0;
    readonly networkCalls: 0;
    readonly publicationEffects: 0;
    readonly runtimeMutations: 0;
  };
};

const noEffects = Object.freeze({
  databaseReads: 0 as const,
  databaseWrites: 0 as const,
  networkCalls: 0 as const,
  publicationEffects: 0 as const,
  runtimeMutations: 0 as const,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 240;
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function validSource(value: unknown): value is PlacePublicProjectionSource {
  if (!isRecord(value) || !onlyKeys(value, [
    "sourceId",
    "revision",
    "observedAt",
    "effectiveFrom",
    "effectiveUntil",
    "freshness",
    "authority",
    "rights",
  ])) return false;
  return nonEmpty(value.sourceId)
    && nonEmpty(value.revision)
    && nonEmpty(value.observedAt)
    && nonEmpty(value.effectiveFrom)
    && nonEmpty(value.effectiveUntil)
    && Number.isFinite(Date.parse(value.observedAt))
    && Number.isFinite(Date.parse(value.effectiveFrom))
    && Number.isFinite(Date.parse(value.effectiveUntil))
    && Date.parse(value.effectiveFrom) <= Date.parse(value.effectiveUntil)
    && ["CURRENT", "STALE", "UNCERTAIN"].includes(value.freshness as string)
    && ["OFFICIAL_VERIFIED", "SOURCE_VERIFIED", "COMMUNITY_OBSERVED"].includes(value.authority as string)
    && ["PUBLIC", "RESTRICTED", "PRIVATE"].includes(value.rights as string);
}

function validInput(value: unknown): value is PlacePublicProjectionIngressInput {
  if (!isRecord(value) || !onlyKeys(value, ["asOf", "place"])) return false;
  if (!nonEmpty(value.asOf) || !Number.isFinite(Date.parse(value.asOf)) || !isRecord(value.place)) return false;
  return onlyKeys(value.place, ["id", "areaId", "name", "source", "publicProjection"])
    && nonEmpty(value.place.id)
    && nonEmpty(value.place.areaId)
    && nonEmpty(value.place.name)
    && validSource(value.place.source)
    && ["AUTHORIZED", "DENIED"].includes(value.place.publicProjection as string);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function serializePlacePublicProjection(value: PlacePublicProjection): string {
  return JSON.stringify(stable(value));
}

function result(
  decision: "ALLOW" | "DENY",
  reasonCode: PlacePublicProjectionIngressReasonCode,
  projection: PlacePublicProjection | null = null,
  serialized: string | null = null,
): PlacePublicProjectionIngressResult {
  return {
    schema_version: PLACE_PUBLIC_PROJECTION_INGRESS_SCHEMA,
    decision,
    reasonCode,
    projection,
    serialized,
    effects: noEffects,
  };
}

function sourceEffectiveAt(source: PlacePublicProjectionSource, asOf: string): boolean {
  const instant = Date.parse(asOf);
  return Date.parse(source.observedAt) <= instant
    && Date.parse(source.effectiveFrom) <= instant
    && instant <= Date.parse(source.effectiveUntil);
}

export function ingestPlacePublicProjection(value: unknown): PlacePublicProjectionIngressResult {
  if (!validInput(value)) return result("DENY", "INVALID_INPUT");
  if (value.place.publicProjection !== "AUTHORIZED") return result("DENY", "PUBLIC_AUTHORITY_DENIED");
  if (value.place.source.freshness !== "CURRENT" || !sourceEffectiveAt(value.place.source, value.asOf)) {
    return result("DENY", "SOURCE_NOT_CURRENT");
  }
  if (value.place.source.rights !== "PUBLIC") return result("DENY", "SOURCE_NOT_PUBLIC");

  const projection: PlacePublicProjection = {
    id: value.place.id,
    areaId: value.place.areaId,
    name: value.place.name,
    source: value.place.source,
  };
  return result(
    "ALLOW",
    "PLACE_PUBLIC_PROJECTION_ACCEPTED",
    projection,
    serializePlacePublicProjection(projection),
  );
}
