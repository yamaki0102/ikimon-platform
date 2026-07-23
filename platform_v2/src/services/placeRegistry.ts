import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { computeBbox } from "./geoJsonBbox.js";
import {
  PLACE_SEARCH_CONTRACT_VERSION,
  rankPublicPlaceResults,
  type PlaceRegistryRow,
  type PublicPlaceSearchResult,
} from "./placeRegistryContract.js";
import { normalizePlaceSearchText } from "./placeDomain.js";
import type {
  PlaceKind,
  PlacePolicyProjection,
} from "./placeDomain.js";

export type PlaceRegistryQueryable = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
};

export type PublicPlaceSearchResponse = {
  version: typeof PLACE_SEARCH_CONTRACT_VERSION;
  query: string;
  results: PublicPlaceSearchResult[];
  state: "complete" | "empty";
  privacy: "boundary_bbox_only";
};

export type RegisteredPlaceProfileProjection = {
  placeId: string;
  canonicalName: string;
  aliases: string[];
  localityLabel: string | null;
  placeKind: PlaceKind;
  verificationStatus: "unverified" | "source_verified" | "administrator_verified";
  officialStatus: "official" | "unofficial" | "unknown";
  description: string | null;
  boundary: {
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: unknown;
    };
    bbox: [number, number, number, number];
    center: { lat: number; lng: number };
    confidence: number;
    precision: "exact" | "approximate" | "unknown";
  } | null;
  policy: PlacePolicyProjection;
  facilities: unknown[];
  activities: unknown[];
  stories: unknown[];
  sourceReferences: Array<{
    sourceType: string;
    sourceId: string;
    sourceUrl: string | null;
    confidence: number;
    verificationStatus: string;
    lastCheckedAt: string | null;
  }>;
};

export async function loadRegisteredPlaceProfileByOsmRef(
  osmType: "way" | "relation",
  osmId: number,
  queryable: PlaceRegistryQueryable = getPool(),
): Promise<RegisteredPlaceProfileProjection | null> {
  type Row = {
    place_id: string;
    canonical_name: string;
    locality_label: string | null;
    place_kind: PlaceKind;
    verification_status: string;
    official_status: string;
    public_summary: string | null;
    recording_policy: PlacePolicyProjection["recordingPolicy"] | null;
    public_location_mode: PlacePolicyProjection["publicLocationMode"] | null;
    contribution_cta_mode: PlacePolicyProjection["contributionCtaMode"] | null;
    official_rule_url: string | null;
    policy_verification_status: string | null;
  };
  const result = await queryable.query<Row & Record<string, unknown>>(
    `SELECT p.place_id, p.canonical_name, p.locality_label, p.place_kind,
            p.verification_status, p.official_status, p.public_summary,
            pp.recording_policy, pp.public_location_mode, pp.contribution_cta_mode,
            pp.official_rule_url, pp.verification_status AS policy_verification_status
       FROM place_source_references ps
       JOIN places p ON p.place_id = ps.place_id
       LEFT JOIN LATERAL (
         SELECT recording_policy, public_location_mode, contribution_cta_mode,
                official_rule_url, verification_status
           FROM place_policies
          WHERE place_id = p.place_id
            AND valid_to IS NULL
          ORDER BY last_checked_at DESC NULLS LAST, updated_at DESC
          LIMIT 1
       ) pp ON TRUE
      WHERE ps.source_type = 'osm'
        AND ps.source_id = $1
        AND ps.valid_to IS NULL
        AND ps.superseded_by_source_reference_id IS NULL
        AND p.public_profile_status = 'published'
        AND p.superseded_by_place_id IS NULL
      LIMIT 1`,
    [`${osmType}:${osmId}`],
  );
  const row = result.rows[0];
  if (!row) return null;
  const [aliasRows, boundaryRows, sourceRows, facilityRows, contentRows] = await Promise.all([
    queryable.query<{ alias: string }>(
      `SELECT alias FROM place_aliases
        WHERE place_id = $1 AND valid_to IS NULL
        ORDER BY confidence DESC, alias`,
      [row.place_id],
    ),
    queryable.query<{
      boundary_geojson: unknown;
      confidence: number | string;
      precision_kind: string;
    }>(
      `SELECT boundary_geojson, confidence, precision_kind
         FROM place_boundaries
        WHERE place_id = $1
          AND is_primary = TRUE
          AND valid_to IS NULL
          AND superseded_by_boundary_id IS NULL
          AND validation_state IN ('valid', 'verified')
        ORDER BY boundary_version DESC
        LIMIT 1`,
      [row.place_id],
    ),
    queryable.query<{
      source_type: string;
      source_id: string;
      source_url: string | null;
      source_confidence: number | string;
      verification_status: string;
      last_checked_at: string | null;
    }>(
      `SELECT source_type, source_id, source_url, source_confidence,
              verification_status, last_checked_at::text
         FROM place_source_references
        WHERE place_id = $1
          AND valid_to IS NULL
          AND superseded_by_source_reference_id IS NULL
        ORDER BY precedence_rank, source_confidence DESC`,
      [row.place_id],
    ),
    queryable.query<{
      facility_kind: string;
      label: string | null;
      availability_status: string;
      confidence: number | string;
      last_checked_at: string | null;
      source_type: string;
      source_url: string | null;
    }>(
      `SELECT pf.facility_kind, pf.label, pf.availability_status, pf.confidence,
              pf.last_checked_at::text, ps.source_type, ps.source_url
         FROM place_facilities pf
         JOIN place_source_references ps ON ps.source_reference_id = pf.source_reference_id
        WHERE pf.place_id = $1 AND pf.valid_to IS NULL
        ORDER BY pf.confidence DESC, pf.facility_kind`,
      [row.place_id],
    ),
    queryable.query<{
      content_kind: string;
      title: string;
      body: string | null;
      starts_at: string | null;
      ends_at: string | null;
      last_checked_at: string | null;
      source_type: string | null;
      source_url: string | null;
      source_verification_status: string | null;
    }>(
      `SELECT pci.content_kind, pci.title, pci.body, pci.starts_at::text, pci.ends_at::text,
              pci.last_checked_at::text, ps.source_type, ps.source_url,
              ps.verification_status AS source_verification_status
         FROM place_content_items pci
         LEFT JOIN place_source_references ps ON ps.source_reference_id = pci.source_reference_id
        WHERE pci.place_id = $1 AND pci.content_status = 'published'
        ORDER BY COALESCE(pci.starts_at, pci.created_at) DESC
        LIMIT 24`,
      [row.place_id],
    ),
  ]);
  const now = Date.now();
  const content = contentRows.rows.map((item) => {
    const starts = item.starts_at ? Date.parse(item.starts_at) : NaN;
    const ends = item.ends_at ? Date.parse(item.ends_at) : NaN;
    return {
      kind: item.content_kind,
      title: item.title,
      body: item.body,
      startsAt: item.starts_at,
      endsAt: item.ends_at,
      temporalState: Number.isFinite(ends) && ends < now
        ? "ended"
        : Number.isFinite(starts) && starts > now
          ? "upcoming"
          : Number.isFinite(starts) || Number.isFinite(ends)
            ? "active"
            : "undated",
      source: item.source_type
        ? {
            type: item.source_type,
            url: item.source_url,
            verificationStatus: item.source_verification_status ?? "unverified",
            lastCheckedAt: item.last_checked_at,
          }
        : null,
    };
  });
  const recordingPolicy = row.recording_policy ?? "check_rules";
  const boundaryRow = boundaryRows.rows[0];
  const boundaryValue = boundaryRow?.boundary_geojson;
  const boundaryGeometry = boundaryValue && typeof boundaryValue === "object" && !Array.isArray(boundaryValue)
    && ((boundaryValue as { type?: unknown }).type === "Polygon"
      || (boundaryValue as { type?: unknown }).type === "MultiPolygon")
    && "coordinates" in boundaryValue
    ? boundaryValue as {
        type: "Polygon" | "MultiPolygon";
        coordinates: unknown;
      }
    : null;
  const boundaryBbox = boundaryGeometry ? computeBbox(boundaryGeometry) : null;
  return {
    placeId: row.place_id,
    canonicalName: row.canonical_name,
    aliases: aliasRows.rows.map((item) => item.alias),
    localityLabel: row.locality_label,
    placeKind: row.place_kind,
    verificationStatus: row.verification_status === "administrator_verified"
      ? "administrator_verified"
      : row.verification_status === "verified" || row.verification_status === "source_verified"
        ? "source_verified"
        : "unverified",
    officialStatus: row.official_status === "official" || row.official_status === "unofficial"
      ? row.official_status
      : "unknown",
    description: row.public_summary,
    boundary: boundaryGeometry && boundaryBbox
      ? {
          geometry: boundaryGeometry,
          bbox: [boundaryBbox.minLng, boundaryBbox.minLat, boundaryBbox.maxLng, boundaryBbox.maxLat],
          center: {
            lat: (boundaryBbox.minLat + boundaryBbox.maxLat) / 2,
            lng: (boundaryBbox.minLng + boundaryBbox.maxLng) / 2,
          },
          confidence: Number(boundaryRow?.confidence ?? 0.5),
          precision: boundaryRow?.precision_kind === "exact" || boundaryRow?.precision_kind === "approximate"
            ? boundaryRow.precision_kind
            : "unknown",
        }
      : null,
    policy: {
      placeVisibility: "public",
      recordingPolicy,
      publicLocationMode: row.public_location_mode ?? "place",
      contributionCtaMode: row.contribution_cta_mode
        ?? (recordingPolicy === "permission_required" || recordingPolicy === "prohibited"
          ? "suppressed"
          : recordingPolicy === "allowed"
            ? "record"
            : "check_rules"),
      ruleSource: row.official_rule_url ? "official" : "default",
      ruleUrl: row.official_rule_url,
      reason: row.policy_verification_status === "verified"
        ? "verified_place_policy"
        : "recording_rules_unverified",
    },
    facilities: facilityRows.rows.map((item) => ({
      kind: item.facility_kind,
      label: item.label ?? item.facility_kind,
      availabilityStatus: item.availability_status,
      confidence: Number(item.confidence),
      lastCheckedAt: item.last_checked_at,
      caution: "availability_not_guaranteed",
      source: { type: item.source_type, url: item.source_url },
    })),
    activities: content.filter((item) => ["activity", "event", "rally"].includes(item.kind)),
    stories: content.filter((item) => ["history", "story"].includes(item.kind)),
    sourceReferences: sourceRows.rows.map((source) => ({
      sourceType: source.source_type,
      sourceId: source.source_id,
      sourceUrl: source.source_url,
      confidence: Number(source.source_confidence),
      verificationStatus: source.verification_status,
      lastCheckedAt: source.last_checked_at,
    })),
  };
}

const SEARCH_SQL = `
  SELECT
    p.place_id,
    p.canonical_name,
    p.canonical_name_normalized,
    p.place_kind,
    p.locality_label,
    p.verification_status,
    p.official_status,
    COALESCE((
      SELECT jsonb_agg(pa.alias ORDER BY pa.confidence DESC, pa.alias)
      FROM place_aliases pa
      WHERE pa.place_id = p.place_id
        AND pa.valid_to IS NULL
    ), '[]'::jsonb) AS aliases_json,
    (
      SELECT pa.alias_normalized
      FROM place_aliases pa
      WHERE pa.place_id = p.place_id
        AND pa.valid_to IS NULL
        AND pa.alias_normalized = $1
      ORDER BY pa.confidence DESC
      LIMIT 1
    ) AS matched_alias_normalized,
    pb.boundary_geojson,
    pb.precision_kind AS boundary_precision,
    pb.confidence AS boundary_confidence,
    ps.source_type,
    ps.source_id,
    ps.source_url,
    ps.source_confidence,
    ps.verification_status AS source_verification_status,
    ps.last_checked_at::text AS source_last_checked_at,
    (
      SELECT source_id
      FROM place_source_references
      WHERE place_id = p.place_id
        AND source_type = 'osm'
        AND valid_to IS NULL
        AND superseded_by_source_reference_id IS NULL
      ORDER BY source_confidence DESC
      LIMIT 1
    ) AS osm_source_id
  FROM places p
  LEFT JOIN LATERAL (
    SELECT boundary_geojson, precision_kind, confidence
    FROM place_boundaries
    WHERE place_id = p.place_id
      AND is_primary = TRUE
      AND valid_to IS NULL
      AND superseded_by_boundary_id IS NULL
    ORDER BY boundary_version DESC
    LIMIT 1
  ) pb ON TRUE
  LEFT JOIN LATERAL (
    SELECT source_type, source_id, source_url, source_confidence, verification_status, last_checked_at
    FROM place_source_references
    WHERE place_id = p.place_id
      AND valid_to IS NULL
      AND superseded_by_source_reference_id IS NULL
    ORDER BY precedence_rank ASC, source_confidence DESC
    LIMIT 1
  ) ps ON TRUE
  WHERE p.public_profile_status = 'published'
    AND p.superseded_by_place_id IS NULL
    AND (
      p.place_id = $2
      OR p.canonical_name_normalized LIKE $3
      OR EXISTS (
        SELECT 1
        FROM place_aliases pa
        WHERE pa.place_id = p.place_id
          AND pa.valid_to IS NULL
          AND pa.alias_normalized LIKE $3
      )
    )
  LIMIT $4
`;

export async function searchPublicPlaces(
  query: unknown,
  limit = 8,
  queryable: PlaceRegistryQueryable = getPool(),
): Promise<PublicPlaceSearchResponse> {
  const rawQuery = typeof query === "string" ? query.trim() : "";
  const normalized = normalizePlaceSearchText(rawQuery);
  if (normalized.length < 2 && !rawQuery.startsWith("place_")) {
    return {
      version: PLACE_SEARCH_CONTRACT_VERSION,
      query: rawQuery,
      results: [],
      state: "empty",
      privacy: "boundary_bbox_only",
    };
  }
  const cappedLimit = Math.max(1, Math.min(20, Math.trunc(limit)));
  const rows = await queryable.query<PlaceRegistryRow & Record<string, unknown>>(
    SEARCH_SQL,
    [normalized, rawQuery, `%${normalized}%`, cappedLimit * 3],
  );
  const results = rankPublicPlaceResults(rows.rows, rawQuery, cappedLimit);
  return {
    version: PLACE_SEARCH_CONTRACT_VERSION,
    query: rawQuery,
    results,
    state: results.length > 0 ? "complete" : "empty",
    privacy: "boundary_bbox_only",
  };
}

export async function listPublicPlaceChildren(
  placeId: string,
  queryable: PlaceRegistryQueryable = getPool(),
): Promise<PublicPlaceSearchResult[]> {
  const result = await queryable.query<PlaceRegistryRow & Record<string, unknown>>(
    `${SEARCH_SQL.replace(
      "p.place_id = $2\n      OR p.canonical_name_normalized LIKE $3\n      OR EXISTS (\n        SELECT 1\n        FROM place_aliases pa\n        WHERE pa.place_id = p.place_id\n          AND pa.valid_to IS NULL\n          AND pa.alias_normalized LIKE $3\n      )",
      `EXISTS (
        SELECT 1
        FROM place_relationships pr
        WHERE pr.subject_place_id = p.place_id
          AND pr.object_place_id = $2
          AND pr.relationship_type IN ('parent', 'part_of')
          AND pr.valid_to IS NULL
      )`,
    )}`,
    ["", placeId, "", 60],
  );
  return rankPublicPlaceResults(result.rows, "", 20);
}

const CORRECTION_TYPES = new Set([
  "name",
  "alias",
  "boundary",
  "place_kind",
  "relationship",
  "membership",
  "policy",
]);

export async function createPlaceCorrectionProposal(input: {
  placeId?: string | null;
  proposerUserId: string;
  proposalType: string;
  proposedPayload: unknown;
}, queryable: PlaceRegistryQueryable = getPool()): Promise<{ proposalId: string; status: "pending" }> {
  if (!CORRECTION_TYPES.has(input.proposalType)) throw new Error("invalid_proposal_type");
  const payload = JSON.stringify(input.proposedPayload);
  if (payload.length < 2 || payload.length > 20_000) throw new Error("invalid_proposal_payload");
  const proposalId = randomUUID();
  await queryable.query(
    `INSERT INTO place_correction_proposals (
       proposal_id, place_id, proposer_user_id, proposal_type, proposed_payload, proposal_status
     ) VALUES ($1, $2, $3, $4, $5::jsonb, 'pending')`,
    [proposalId, input.placeId ?? null, input.proposerUserId, input.proposalType, payload],
  );
  return { proposalId, status: "pending" };
}
