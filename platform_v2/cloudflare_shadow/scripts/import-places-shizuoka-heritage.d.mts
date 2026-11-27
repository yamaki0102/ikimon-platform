export type NonParkItem = {
  sourceKind: "moe_30by30" | "hamamatsu_cultural_property" | "shizuoka_cultural_property";
  sourceId: string;
  name: string;
  municipality: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  category: "nature" | "heritage";
  placeKind: string;
  factSummary: string;
  isRegionalHeritage: boolean;
  metadata: Record<string, unknown>;
};

export type BuiltNonParkPlace = {
  placeId: string;
  sourceType: string;
  sourceId: string;
  sourceUrl: string | null;
  name: string;
  normalizedName: string;
  localityLabel: string;
  placeKind: string;
  verificationStatus: "source_verified" | "unverified";
  officialStatus: string;
  publicSummary: string;
  lat: number;
  lng: number;
  polygons: number[][][][];
  bbox: { west: number; south: number; east: number; north: number };
  areaHa: number;
  needsCoordinateReview: boolean;
  coordinateSource: string;
  osmMatch: { osmType: string; osmId: number } | null;
  isRegionalHeritage: boolean;
  metadata: Record<string, unknown>;
};

export function parseCsvRows(csvText: string): string[][];
export function normalizeMoeEntries(rawEntries: readonly Record<string, unknown>[]): NonParkItem[];
export function parseMoeSymbiosisPdfText(input: {
  r806ZoshinText?: string;
  r806RenkeiText?: string;
  r5r6Text?: string;
}): NonParkItem[];
export function parseCulturalPropertiesCsv(csvText: string, sourceKind: "hamamatsu_cp" | "shizuoka_cp"): NonParkItem[];
export function buildNonParkPlaceCandidates(input: {
  moeItems?: readonly NonParkItem[];
  culturalItems?: readonly NonParkItem[];
  osmMatches?: Record<string, { osmType?: string; osmId?: number; lat: number; lng: number }>;
  municipalityCenters?: Record<string, readonly [number, number]>;
  existingNames?: readonly string[];
}): {
  places: BuiltNonParkPlace[];
  stats: Record<string, unknown>;
};
export function renderNonParkImportSql(
  places: readonly BuiltNonParkPlace[],
  ctx: { batch: string; retrievedAt: string }
): string;
export function renderNonParkRollbackSql(batch: string): string;
