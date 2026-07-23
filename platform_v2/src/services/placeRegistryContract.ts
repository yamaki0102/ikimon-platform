import { computeBbox } from "./geoJsonBbox.js";
import {
  normalizePlaceSearchText,
  type PlaceKind,
} from "./placeDomain.js";

export const PLACE_SEARCH_CONTRACT_VERSION = "place_search/v1" as const;

export type PublicPlaceSource = {
  sourceType: string;
  sourceId: string;
  sourceUrl: string | null;
  confidence: number;
  verificationStatus: string;
  lastCheckedAt: string | null;
};

export type PublicPlaceSearchResult = {
  canonicalPlaceId: string;
  canonicalName: string;
  aliases: string[];
  placeKind: PlaceKind;
  localityLabel: string | null;
  verificationStatus: string;
  officialStatus: "official" | "unofficial" | "unknown";
  matchKind: "canonical_name" | "alias" | "place_id";
  matchConfidence: number;
  osmSourceId: string | null;
  boundary: {
    bbox: [number, number, number, number] | null;
    precision: "exact" | "approximate" | "unknown";
    confidence: number | null;
  };
  source: PublicPlaceSource | null;
};

export type PlaceRegistryRow = {
  place_id: string;
  canonical_name: string;
  canonical_name_normalized: string | null;
  place_kind: string;
  locality_label: string | null;
  verification_status: string;
  official_status: string;
  aliases_json?: unknown;
  matched_alias_normalized?: string | null;
  boundary_geojson?: unknown;
  boundary_precision?: string | null;
  boundary_confidence?: number | string | null;
  bbox_west?: number | string | null;
  bbox_south?: number | string | null;
  bbox_east?: number | string | null;
  bbox_north?: number | string | null;
  source_type?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  source_confidence?: number | string | null;
  source_verification_status?: string | null;
  source_last_checked_at?: string | null;
  osm_source_id?: string | null;
};

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function aliases(value: unknown): string[] {
  let parsed = value;
  if (typeof parsed === "string") {
    const raw = parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw.split("\u001f");
    }
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const label = item.trim();
    const key = normalizePlaceSearchText(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

function placeBbox(row: PlaceRegistryRow): [number, number, number, number] | null {
  const west = finiteNumber(row.bbox_west);
  const south = finiteNumber(row.bbox_south);
  const east = finiteNumber(row.bbox_east);
  const north = finiteNumber(row.bbox_north);
  if (west !== null && south !== null && east !== null && north !== null) {
    return [west, south, east, north];
  }
  let geometry = row.boundary_geojson;
  if (typeof geometry === "string") {
    try {
      geometry = JSON.parse(geometry);
    } catch {
      return null;
    }
  }
  const bbox = computeBbox(geometry);
  return bbox
    ? [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat]
    : null;
}

function officialStatus(value: unknown): PublicPlaceSearchResult["officialStatus"] {
  return value === "official" || value === "unofficial" ? value : "unknown";
}

export function toPublicPlaceSearchResult(
  row: PlaceRegistryRow,
  query: string,
): PublicPlaceSearchResult {
  const normalizedQuery = normalizePlaceSearchText(query);
  const canonicalNormalized = row.canonical_name_normalized
    || normalizePlaceSearchText(row.canonical_name);
  const aliasMatch = row.matched_alias_normalized === normalizedQuery;
  const idMatch = row.place_id === query;
  const exactCanonical = canonicalNormalized === normalizedQuery;
  const confidence = exactCanonical || idMatch
    ? 1
    : aliasMatch
      ? 0.98
      : canonicalNormalized.startsWith(normalizedQuery)
        ? 0.9
        : 0.75;
  const boundaryConfidence = finiteNumber(row.boundary_confidence);
  const sourceConfidence = finiteNumber(row.source_confidence);
  return {
    canonicalPlaceId: row.place_id,
    canonicalName: row.canonical_name,
    aliases: aliases(row.aliases_json),
    placeKind: row.place_kind as PlaceKind,
    localityLabel: row.locality_label,
    verificationStatus: row.verification_status,
    officialStatus: officialStatus(row.official_status),
    matchKind: idMatch ? "place_id" : aliasMatch ? "alias" : "canonical_name",
    matchConfidence: confidence,
    osmSourceId: row.osm_source_id ?? (row.source_type === "osm" ? row.source_id ?? null : null),
    boundary: {
      bbox: placeBbox(row),
      precision: row.boundary_precision === "exact" || row.boundary_precision === "approximate"
        ? row.boundary_precision
        : "unknown",
      confidence: boundaryConfidence,
    },
    source: row.source_type
      ? {
          sourceType: row.source_type,
          sourceId: row.source_id ?? "",
          sourceUrl: row.source_url ?? null,
          confidence: sourceConfidence ?? 0.5,
          verificationStatus: row.source_verification_status ?? "unverified",
          lastCheckedAt: row.source_last_checked_at ?? null,
        }
      : null,
  };
}

export function rankPublicPlaceResults(
  rows: PlaceRegistryRow[],
  query: string,
  limit = 8,
): PublicPlaceSearchResult[] {
  const byPlace = new Map<string, PublicPlaceSearchResult>();
  for (const row of rows) {
    const result = toPublicPlaceSearchResult(row, query);
    const current = byPlace.get(result.canonicalPlaceId);
    if (!current || result.matchConfidence > current.matchConfidence) {
      byPlace.set(result.canonicalPlaceId, result);
    }
  }
  return [...byPlace.values()]
    .sort((left, right) =>
      right.matchConfidence - left.matchConfidence
      || Number(right.verificationStatus === "verified") - Number(left.verificationStatus === "verified")
      || left.canonicalName.localeCompare(right.canonicalName, "ja"))
    .slice(0, Math.max(1, Math.min(20, limit)));
}
