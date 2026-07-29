export type ZukanRegionalCorePredicate = {
  predicateUri: string;
  predicateVersion: 1;
  status: "active";
  valueType: "string" | "datetime";
  cardinality: "one";
  polarityMode: "positive_only";
  temporalProfile: "atemporal" | "valid_time";
  valueSchema: Record<string, unknown>;
  authorityProfile: Record<string, unknown>;
  externalMappings: readonly string[];
};

export const ZUKAN_REGIONAL_CORE_PREDICATES: readonly ZukanRegionalCorePredicate[] = [
  {
    predicateUri: "https://zukan.earth/predicate/name",
    predicateVersion: 1,
    status: "active",
    valueType: "string",
    cardinality: "one",
    polarityMode: "positive_only",
    temporalProfile: "valid_time",
    valueSchema: { minLength: 1 },
    authorityProfile: { reviewRequiredForPublic: true },
    externalMappings: ["schema:name"],
  },
  {
    predicateUri: "https://zukan.earth/predicate/address",
    predicateVersion: 1,
    status: "active",
    valueType: "string",
    cardinality: "one",
    polarityMode: "positive_only",
    temporalProfile: "valid_time",
    valueSchema: { minLength: 1 },
    authorityProfile: { reviewRequiredForPublic: true },
    externalMappings: ["schema:address"],
  },
  {
    predicateUri: "https://zukan.earth/predicate/summary",
    predicateVersion: 1,
    status: "active",
    valueType: "string",
    cardinality: "one",
    polarityMode: "positive_only",
    temporalProfile: "valid_time",
    valueSchema: { minLength: 1 },
    authorityProfile: { reviewRequiredForPublic: true },
    externalMappings: ["schema:description"],
  },
  {
    predicateUri: "https://zukan.earth/predicate/source-updated-at",
    predicateVersion: 1,
    status: "active",
    valueType: "datetime",
    cardinality: "one",
    polarityMode: "positive_only",
    temporalProfile: "atemporal",
    valueSchema: { format: "date-time" },
    authorityProfile: { sourceEditionEvidenceRequired: true },
    externalMappings: ["dcterms:modified"],
  },
] as const;

export function regionalCorePredicateByUri(
  predicateUri: string,
  predicateVersion: number,
): ZukanRegionalCorePredicate | null {
  return ZUKAN_REGIONAL_CORE_PREDICATES.find((predicate) =>
    predicate.predicateUri === predicateUri && predicate.predicateVersion === predicateVersion) ?? null;
}
