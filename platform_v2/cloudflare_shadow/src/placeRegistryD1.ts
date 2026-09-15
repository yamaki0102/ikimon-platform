import {
  PLACE_SEARCH_CONTRACT_VERSION,
  rankPublicPlaceResults,
  type PlaceRegistryRow,
  type PublicPlaceSearchResult,
} from "../../src/services/placeRegistryContract";
import { normalizePlaceSearchText } from "../../src/services/placeDomain";

type D1Value = string | number | null;

export interface PlaceRegistryD1PreparedStatement {
  bind(...values: D1Value[]): PlaceRegistryD1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export interface PlaceRegistryD1Database {
  prepare(query: string): PlaceRegistryD1PreparedStatement;
}

export type D1PlaceSearchResponse = {
  version: typeof PLACE_SEARCH_CONTRACT_VERSION;
  query: string;
  results: PublicPlaceSearchResult[];
  state: "complete" | "empty";
  privacy: "boundary_bbox_only";
};

const D1_PUBLIC_PLACE_SEARCH_SQL = `
  SELECT
    p.place_id,
    p.canonical_name,
    p.canonical_name_normalized,
    p.place_kind,
    p.locality_label,
    p.verification_status,
    p.official_status,
    COALESCE((
      SELECT GROUP_CONCAT(pa.alias, CHAR(31))
      FROM place_aliases pa
      WHERE pa.place_id = p.place_id
        AND pa.valid_to IS NULL
    ), '') AS aliases_json,
    (
      SELECT pa.alias_normalized
      FROM place_aliases pa
      WHERE pa.place_id = p.place_id
        AND pa.valid_to IS NULL
        AND pa.alias_normalized = ?
      ORDER BY pa.confidence DESC
      LIMIT 1
    ) AS matched_alias_normalized,
    pb.boundary_geojson,
    pb.precision_kind AS boundary_precision,
    pb.confidence AS boundary_confidence,
    pb.bbox_west,
    pb.bbox_south,
    pb.bbox_east,
    pb.bbox_north,
    ps.source_type,
    ps.source_id,
    ps.source_url,
    ps.source_confidence,
    ps.verification_status AS source_verification_status,
    ps.last_checked_at AS source_last_checked_at,
    (
      SELECT source_id
      FROM place_source_references
      WHERE place_id = p.place_id
        AND source_type = 'osm'
        AND verification_status IN ('verified', 'source_verified')
        AND valid_to IS NULL
        AND superseded_by_source_reference_id IS NULL
      ORDER BY source_confidence DESC
      LIMIT 1
    ) AS osm_source_id
  FROM places p
  LEFT JOIN place_boundaries pb
    ON pb.boundary_id = (
      SELECT b.boundary_id
      FROM place_boundaries b
      JOIN place_source_references bs
        ON bs.source_reference_id = b.source_reference_id
        AND bs.place_id = b.place_id
      WHERE b.place_id = p.place_id
        AND b.is_primary = 1
        AND b.valid_to IS NULL
        AND b.superseded_by_boundary_id IS NULL
        AND b.validation_state IN ('valid', 'verified')
        AND bs.verification_status IN ('verified', 'source_verified')
        AND bs.valid_to IS NULL
        AND bs.superseded_by_source_reference_id IS NULL
      ORDER BY b.boundary_version DESC
      LIMIT 1
    )
  LEFT JOIN place_source_references ps
    ON ps.source_reference_id = (
      SELECT source_reference_id
      FROM place_source_references
      WHERE place_id = p.place_id
        AND verification_status IN ('verified', 'source_verified')
        AND valid_to IS NULL
        AND superseded_by_source_reference_id IS NULL
      ORDER BY precedence_rank ASC, source_confidence DESC
      LIMIT 1
    )
  WHERE p.public_profile_status = 'published'
    AND p.valid_to IS NULL
    AND p.superseded_by_place_id IS NULL
    AND pb.boundary_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM place_policies pp
      WHERE pp.place_id = p.place_id
        AND pp.place_visibility = 'public'
        AND pp.valid_to IS NULL
    )
    AND (
      p.place_id = ?
      OR p.canonical_name_normalized LIKE ?
      OR EXISTS (
        SELECT 1
        FROM place_aliases pa
        WHERE pa.place_id = p.place_id
          AND pa.valid_to IS NULL
          AND pa.alias_normalized LIKE ?
      )
    )
  LIMIT ?
`;

export async function searchD1PublicPlaces(input: {
  db: PlaceRegistryD1Database;
  query: unknown;
  limit?: number;
}): Promise<D1PlaceSearchResponse> {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  const normalized = normalizePlaceSearchText(query);
  if (normalized.length < 2 && !query.startsWith("place_")) {
    return {
      version: PLACE_SEARCH_CONTRACT_VERSION,
      query,
      results: [],
      state: "empty",
      privacy: "boundary_bbox_only",
    };
  }
  const limit = Math.max(1, Math.min(20, Math.trunc(input.limit ?? 8)));
  const rows = await input.db
    .prepare(D1_PUBLIC_PLACE_SEARCH_SQL)
    .bind(normalized, query, `%${normalized}%`, `%${normalized}%`, limit * 3)
    .all<PlaceRegistryRow>();
  const results = rankPublicPlaceResults(rows.results, query, limit);
  return {
    version: PLACE_SEARCH_CONTRACT_VERSION,
    query,
    results,
    state: results.length > 0 ? "complete" : "empty",
    privacy: "boundary_bbox_only",
  };
}

export async function listD1PublicPlaceChildren(input: {
  db: PlaceRegistryD1Database;
  parentPlaceId: string;
  limit?: number;
}): Promise<PublicPlaceSearchResult[]> {
  const limit = Math.max(1, Math.min(50, Math.trunc(input.limit ?? 20)));
  const childSql = D1_PUBLIC_PLACE_SEARCH_SQL.replace(
    `p.place_id = ?
      OR p.canonical_name_normalized LIKE ?
      OR EXISTS (
        SELECT 1
        FROM place_aliases pa
        WHERE pa.place_id = p.place_id
          AND pa.valid_to IS NULL
          AND pa.alias_normalized LIKE ?
      )`,
    `EXISTS (
        SELECT 1
        FROM place_relationships pr
        WHERE pr.subject_place_id = p.place_id
          AND pr.object_place_id = ?
          AND pr.relationship_type IN ('parent', 'part_of')
          AND pr.valid_to IS NULL
      )`,
  );
  const rows = await input.db
    .prepare(childSql)
    .bind("", input.parentPlaceId, limit)
    .all<PlaceRegistryRow>();
  return rankPublicPlaceResults(rows.results, "", limit);
}
