/**
 * Pure, synthetic public Area/Place contract compiler.
 *
 * This source phase validates stable identities, explicit relationships and
 * public projection authority. It never reads the database, geocodes,
 * publishes, generates a QR code, or exposes a sensitive location.
 */

export const AREA_PLACE_PUBLIC_CONTRACT_SCHEMA = "zukan.area-place-public-contracts.v1" as const;

export type PublicContractDecision = "ALLOW" | "DENY";
export type PublicContractReasonCode =
  | "PUBLIC_CONTRACTS_COMPILED"
  | "INVALID_INPUT"
  | "PUBLIC_AUTHORITY_DENIED"
  | "SOURCE_NOT_CURRENT"
  | "SOURCE_NOT_PUBLIC"
  | "RELATIONSHIP_INVALID"
  | "SENSITIVE_LOCATION_EXCLUDED"
  | "SEASONAL_STATE_UNCERTAIN"
  | "IDENTITY_INVALID";

type SourceBinding = {
  readonly sourceId: string;
  readonly version: string;
  readonly observedAt: string;
  readonly freshness: "CURRENT" | "STALE" | "UNCERTAIN";
  readonly authority: "OFFICIAL_VERIFIED" | "SOURCE_VERIFIED" | "COMMUNITY_OBSERVED";
  readonly rights: "PUBLIC" | "RESTRICTED" | "PRIVATE";
};

type AreaInput = {
  readonly id: string;
  readonly name: string;
  readonly source: SourceBinding;
  readonly publicProjection: "AUTHORIZED" | "DENIED";
};

type PlaceInput = {
  readonly id: string;
  readonly areaId: string;
  readonly name: string;
  readonly source: SourceBinding;
  readonly sensitiveLocation: boolean;
};

type NaturalFeatureInput = {
  readonly id: string;
  readonly placeId: string;
  readonly name: string;
  readonly source: SourceBinding;
};

type SeasonalStateInput = {
  readonly placeId: string;
  readonly season: "spring" | "summer" | "autumn" | "winter";
  readonly state: "present" | "absent" | "unknown";
  readonly source: SourceBinding;
};

type ScanPointInput = {
  readonly id: string;
  readonly placeId: string;
  readonly routeKey: string;
  readonly source: SourceBinding;
  readonly status: "ACTIVE" | "RETIRED";
};

export type AreaPlacePublicContractsInput = {
  readonly fixtureClass: "synthetic";
  readonly area: AreaInput;
  readonly places: readonly PlaceInput[];
  readonly naturalFeatures: readonly NaturalFeatureInput[];
  readonly seasonalStates: readonly SeasonalStateInput[];
  readonly scanPoints: readonly ScanPointInput[];
};

export type PublicAreaPlaceContracts = {
  readonly area: Pick<AreaInput, "id" | "name" | "source">;
  readonly places: readonly Pick<PlaceInput, "id" | "areaId" | "name" | "source">[];
  readonly naturalFeatures: readonly NaturalFeatureInput[];
  readonly seasonalStates: readonly SeasonalStateInput[];
  readonly scanPoints: readonly ScanPointInput[];
};

export type AreaPlacePublicContractsResult = {
  readonly schema_version: typeof AREA_PLACE_PUBLIC_CONTRACT_SCHEMA;
  readonly decision: PublicContractDecision;
  readonly reasonCode: PublicContractReasonCode;
  readonly contracts: PublicAreaPlaceContracts | null;
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

function validSource(value: unknown): value is SourceBinding {
  if (!isRecord(value) || !onlyKeys(value, ["sourceId", "version", "observedAt", "freshness", "authority", "rights"])) return false;
  return nonEmpty(value.sourceId)
    && nonEmpty(value.version)
    && nonEmpty(value.observedAt)
    && Number.isFinite(Date.parse(value.observedAt))
    && ["CURRENT", "STALE", "UNCERTAIN"].includes(value.freshness as string)
    && ["OFFICIAL_VERIFIED", "SOURCE_VERIFIED", "COMMUNITY_OBSERVED"].includes(value.authority as string)
    && ["PUBLIC", "RESTRICTED", "PRIVATE"].includes(value.rights as string);
}

function validInput(value: unknown): value is AreaPlacePublicContractsInput {
  if (!isRecord(value) || !onlyKeys(value, ["fixtureClass", "area", "places", "naturalFeatures", "seasonalStates", "scanPoints"])) return false;
  if (value.fixtureClass !== "synthetic" || !isRecord(value.area)) return false;
  if (!onlyKeys(value.area, ["id", "name", "source", "publicProjection"]) || !nonEmpty(value.area.id) || !nonEmpty(value.area.name) || !validSource(value.area.source)) return false;
  if (!["AUTHORIZED", "DENIED"].includes(value.area.publicProjection as string)) return false;
  if (!Array.isArray(value.places) || !Array.isArray(value.naturalFeatures) || !Array.isArray(value.seasonalStates) || !Array.isArray(value.scanPoints)) return false;
  return value.places.every((place) => isRecord(place)
    && onlyKeys(place, ["id", "areaId", "name", "source", "sensitiveLocation"])
    && nonEmpty(place.id) && nonEmpty(place.areaId) && nonEmpty(place.name) && validSource(place.source)
    && typeof place.sensitiveLocation === "boolean")
    && value.naturalFeatures.every((feature) => isRecord(feature)
      && onlyKeys(feature, ["id", "placeId", "name", "source"])
      && nonEmpty(feature.id) && nonEmpty(feature.placeId) && nonEmpty(feature.name) && validSource(feature.source))
    && value.seasonalStates.every((seasonal) => isRecord(seasonal)
      && onlyKeys(seasonal, ["placeId", "season", "state", "source"])
      && nonEmpty(seasonal.placeId) && ["spring", "summer", "autumn", "winter"].includes(seasonal.season as string)
      && ["present", "absent", "unknown"].includes(seasonal.state as string) && validSource(seasonal.source))
    && value.scanPoints.every((scanPoint) => isRecord(scanPoint)
      && onlyKeys(scanPoint, ["id", "placeId", "routeKey", "source", "status"])
      && nonEmpty(scanPoint.id) && nonEmpty(scanPoint.placeId) && nonEmpty(scanPoint.routeKey) && validSource(scanPoint.source)
      && ["ACTIVE", "RETIRED"].includes(scanPoint.status as string));
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function serializeAreaPlacePublicContracts(value: PublicAreaPlaceContracts): string {
  return JSON.stringify(stable({
    area: value.area,
    naturalFeatures: [...value.naturalFeatures].sort((left, right) => left.id.localeCompare(right.id)),
    places: [...value.places].sort((left, right) => left.id.localeCompare(right.id)),
    scanPoints: [...value.scanPoints].sort((left, right) => left.id.localeCompare(right.id)),
    seasonalStates: [...value.seasonalStates].sort((left, right) => `${left.placeId}:${left.season}`.localeCompare(`${right.placeId}:${right.season}`)),
  }));
}

function result(
  decision: PublicContractDecision,
  reasonCode: PublicContractReasonCode,
  contracts: PublicAreaPlaceContracts | null = null,
  serialized: string | null = null,
): AreaPlacePublicContractsResult {
  return { schema_version: AREA_PLACE_PUBLIC_CONTRACT_SCHEMA, decision, reasonCode, contracts, serialized, effects: noEffects };
}

export function compileAreaPlacePublicContracts(value: unknown): AreaPlacePublicContractsResult {
  if (!validInput(value)) return result("DENY", "INVALID_INPUT");
  if (value.area.publicProjection !== "AUTHORIZED") return result("DENY", "PUBLIC_AUTHORITY_DENIED");
  const allSources = [value.area.source, ...value.places.map((place) => place.source), ...value.naturalFeatures.map((feature) => feature.source), ...value.seasonalStates.map((state) => state.source), ...value.scanPoints.map((scanPoint) => scanPoint.source)];
  if (allSources.some((source) => source.freshness !== "CURRENT")) return result("DENY", "SOURCE_NOT_CURRENT");
  if (allSources.some((source) => source.rights !== "PUBLIC")) return result("DENY", "SOURCE_NOT_PUBLIC");
  if (value.places.some((place) => place.sensitiveLocation)) return result("DENY", "SENSITIVE_LOCATION_EXCLUDED");
  if (value.seasonalStates.some((state) => state.state === "unknown" || state.source.authority === "COMMUNITY_OBSERVED")) return result("DENY", "SEASONAL_STATE_UNCERTAIN");

  const areaIds = new Set([value.area.id]);
  const placeIds = new Set<string>();
  for (const place of value.places) {
    if (placeIds.has(place.id) || !areaIds.has(place.areaId)) return result("DENY", "RELATIONSHIP_INVALID");
    placeIds.add(place.id);
  }
  const featureIds = new Set<string>();
  for (const feature of value.naturalFeatures) {
    if (featureIds.has(feature.id) || !placeIds.has(feature.placeId)) return result("DENY", "RELATIONSHIP_INVALID");
    featureIds.add(feature.id);
  }
  const scanPointIds = new Set<string>();
  for (const scanPoint of value.scanPoints) {
    if (scanPointIds.has(scanPoint.id) || !placeIds.has(scanPoint.placeId) || scanPoint.id !== `${scanPoint.placeId}:${scanPoint.routeKey}`) return result("DENY", "IDENTITY_INVALID");
    scanPointIds.add(scanPoint.id);
  }
  if (value.seasonalStates.some((state) => !placeIds.has(state.placeId))) return result("DENY", "RELATIONSHIP_INVALID");

  const contracts: PublicAreaPlaceContracts = {
    area: { id: value.area.id, name: value.area.name, source: value.area.source },
    places: value.places.map(({ id, areaId, name, source }) => ({ id, areaId, name, source })),
    naturalFeatures: value.naturalFeatures,
    seasonalStates: value.seasonalStates,
    scanPoints: value.scanPoints,
  };
  return result("ALLOW", "PUBLIC_CONTRACTS_COMPILED", contracts, serializeAreaPlacePublicContracts(contracts));
}

export const buildAreaPlacePublicContracts = compileAreaPlacePublicContracts;
