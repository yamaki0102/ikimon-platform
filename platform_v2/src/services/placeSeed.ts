import {
  bboxAreaHa,
  bboxForPlaceGeometry,
  classifyOsmPlaceKind,
  collectOsmPlaceNames,
  normalizePlaceSearchText,
  pointInPlaceGeometry,
  type PlaceGeometry,
  type PlaceKind,
  type RecordingPolicy,
} from "./placeDomain.js";

export type PlaceSeedAlias = {
  value: string;
  language: string | null;
  kind: string;
  sourceType: string;
  confidence: number;
};

export type PlaceSeedSource = {
  sourceReferenceId: string;
  sourceType: string;
  sourceId: string;
  sourceUrl: string | null;
  confidence: number;
  verificationStatus: string;
  precedenceRank: number;
};

export type PlaceSeedEntry = {
  placeId: string;
  canonicalName: string;
  canonicalNameNormalized: string;
  aliases: PlaceSeedAlias[];
  placeKind: PlaceKind;
  localityLabel: string;
  verificationStatus: string;
  publicProfileStatus: string;
  officialStatus: string;
  publicSummary: string | null;
  sources: PlaceSeedSource[];
  boundarySourceReferenceId: string;
  policy: {
    recordingPolicy: RecordingPolicy;
    photographyRuleStatus: string;
    publicLocationMode: "place" | "zone" | "public_cell" | "hidden";
    contributionCtaMode: "record" | "check_rules" | "suppressed";
    officialRuleUrl: string | null;
    verificationStatus: string;
  };
};

export type PlaceSeedDocument = {
  schemaVersion: "universal_place_atlas_seed/v1";
  verifiedAt: string;
  places: PlaceSeedEntry[];
};

export type ResolvedPlaceSeedBoundary = {
  geometry: PlaceGeometry;
  actualName: string;
  actualPlaceKind: PlaceKind;
  osmType: "way" | "relation";
  osmId: number;
};

type OsmFullElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: Array<{ type: "node" | "way" | "relation"; ref: number; role?: string }>;
  tags?: Record<string, string>;
};

function samePoint(left: [number, number], right: [number, number]): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function stitchRings(segments: Array<Array<[number, number]>>): Array<Array<[number, number]>> {
  const pending = segments.filter((segment) => segment.length >= 2).map((segment) => [...segment]);
  const rings: Array<Array<[number, number]>> = [];
  while (pending.length > 0) {
    const ring = pending.shift()!;
    let changed = true;
    while (changed && !samePoint(ring[0]!, ring[ring.length - 1]!)) {
      changed = false;
      for (let index = 0; index < pending.length; index += 1) {
        const segment = pending[index]!;
        const first = ring[0]!;
        const last = ring[ring.length - 1]!;
        const segmentFirst = segment[0]!;
        const segmentLast = segment[segment.length - 1]!;
        if (samePoint(last, segmentFirst)) ring.push(...segment.slice(1));
        else if (samePoint(last, segmentLast)) ring.push(...[...segment].reverse().slice(1));
        else if (samePoint(first, segmentLast)) ring.unshift(...segment.slice(0, -1));
        else if (samePoint(first, segmentFirst)) ring.unshift(...[...segment].reverse().slice(0, -1));
        else continue;
        pending.splice(index, 1);
        changed = true;
        break;
      }
    }
    if (ring.length >= 4 && samePoint(ring[0]!, ring[ring.length - 1]!)) rings.push(ring);
  }
  return rings;
}

export function osmFullJsonToBoundary(input: {
  payload: unknown;
  osmType: "way" | "relation";
  osmId: number;
}): ResolvedPlaceSeedBoundary | null {
  const elements = input.payload && typeof input.payload === "object"
    && Array.isArray((input.payload as { elements?: unknown[] }).elements)
    ? (input.payload as { elements: OsmFullElement[] }).elements
    : [];
  const target = elements.find((element) =>
    element.type === input.osmType && element.id === input.osmId
  );
  if (!target) return null;
  const tags = target.tags ?? {};
  const actualName = collectOsmPlaceNames(tags).canonicalName;
  const actualPlaceKind = classifyOsmPlaceKind(tags);
  if (!actualName || !actualPlaceKind) return null;
  const nodes = new Map<number, [number, number]>();
  for (const element of elements) {
    if (element.type === "node" && Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
      nodes.set(element.id, [Number(element.lon), Number(element.lat)]);
    }
  }
  const wayCoordinates = new Map<number, Array<[number, number]>>();
  for (const element of elements) {
    if (element.type !== "way") continue;
    wayCoordinates.set(element.id, (element.nodes ?? [])
      .map((nodeId) => nodes.get(nodeId))
      .filter((point): point is [number, number] => Boolean(point)));
  }

  let geometry: PlaceGeometry | null = null;
  if (input.osmType === "way") {
    const ring = wayCoordinates.get(input.osmId) ?? [];
    if (ring.length >= 3) {
      const closed = samePoint(ring[0]!, ring[ring.length - 1]!)
        ? ring
        : [...ring, ring[0]!];
      geometry = closed.length >= 4 ? { type: "Polygon", coordinates: [closed] } : null;
    }
  } else {
    const outerSegments: Array<Array<[number, number]>> = [];
    const innerSegments: Array<Array<[number, number]>> = [];
    for (const member of target.members ?? []) {
      if (member.type !== "way") continue;
      const segment = wayCoordinates.get(member.ref);
      if (!segment) continue;
      if (member.role === "inner") innerSegments.push(segment);
      else outerSegments.push(segment);
    }
    const outers = stitchRings(outerSegments);
    const inners = stitchRings(innerSegments);
    const polygons = outers.map((outer) => [outer] as Array<Array<[number, number]>>);
    for (const inner of inners) {
      const point = inner[0]!;
      const parentIndex = polygons.findIndex((polygon) =>
        pointInPlaceGeometry(
          { lng: point[0], lat: point[1] },
          { type: "Polygon", coordinates: [polygon[0]] },
        )
      );
      if (parentIndex >= 0) polygons[parentIndex]!.push(inner);
    }
    if (polygons.length === 1) geometry = { type: "Polygon", coordinates: polygons[0] };
    else if (polygons.length > 1) geometry = { type: "MultiPolygon", coordinates: polygons };
  }
  return geometry
    ? {
        geometry,
        actualName,
        actualPlaceKind,
        osmType: input.osmType,
        osmId: input.osmId,
      }
    : null;
}

export type MaterializedPlaceSeed = {
  entry: PlaceSeedEntry;
  boundary: ResolvedPlaceSeedBoundary;
  bbox: { west: number; south: number; east: number; north: number };
  areaHa: number | null;
};

export type PlaceSeedReport = {
  version: "universal_place_atlas_seed_report/v1";
  sourceVerifiedAt: string;
  generatedAt: string;
  mode: "dry_run" | "emit_sql";
  totalPlaces: number;
  resolvedBoundaries: number;
  failed: Array<{ placeId: string; reason: string }>;
  places: Array<{
    placeId: string;
    canonicalName: string;
    actualOsmName: string;
    configuredKind: PlaceKind;
    actualOsmKind: PlaceKind;
    osmReference: string;
    areaHa: number | null;
    bbox: [number, number, number, number];
    recordingPolicy: RecordingPolicy;
  }>;
};

function validateSeedEntry(entry: PlaceSeedEntry): void {
  if (!/^plc_[0-9a-f]{16}$/.test(entry.placeId)) throw new Error(`invalid_place_id:${entry.placeId}`);
  if (!entry.canonicalName.trim()) throw new Error(`missing_canonical_name:${entry.placeId}`);
  if (normalizePlaceSearchText(entry.canonicalName) !== entry.canonicalNameNormalized) {
    throw new Error(`canonical_name_normalization_mismatch:${entry.placeId}`);
  }
  const boundarySource = entry.sources.find((source) =>
    source.sourceReferenceId === entry.boundarySourceReferenceId
  );
  if (!boundarySource || boundarySource.sourceType !== "osm") {
    throw new Error(`invalid_boundary_source:${entry.placeId}`);
  }
  if (!/^(way|relation):\d+$/.test(boundarySource.sourceId)) {
    throw new Error(`invalid_osm_boundary_ref:${entry.placeId}`);
  }
}

export function parsePlaceSeedDocument(value: unknown): PlaceSeedDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_seed_document");
  const document = value as PlaceSeedDocument;
  if (document.schemaVersion !== "universal_place_atlas_seed/v1") throw new Error("unsupported_seed_version");
  if (!Array.isArray(document.places) || document.places.length === 0) throw new Error("empty_seed");
  const ids = new Set<string>();
  for (const entry of document.places) {
    validateSeedEntry(entry);
    if (ids.has(entry.placeId)) throw new Error(`duplicate_place_id:${entry.placeId}`);
    ids.add(entry.placeId);
  }
  return document;
}

export async function materializePlaceSeed(input: {
  document: PlaceSeedDocument;
  resolveBoundary: (osmType: "way" | "relation", osmId: number) => Promise<ResolvedPlaceSeedBoundary | null>;
}): Promise<{ places: MaterializedPlaceSeed[]; failed: Array<{ placeId: string; reason: string }> }> {
  const places: MaterializedPlaceSeed[] = [];
  const failed: Array<{ placeId: string; reason: string }> = [];
  for (const entry of input.document.places) {
    const source = entry.sources.find((item) => item.sourceReferenceId === entry.boundarySourceReferenceId)!;
    const match = /^(way|relation):(\d+)$/.exec(source.sourceId)!;
    const osmType = match[1] as "way" | "relation";
    const osmId = Number(match[2]);
    const resolved = await input.resolveBoundary(osmType, osmId);
    if (!resolved) {
      failed.push({ placeId: entry.placeId, reason: `boundary_unavailable:${source.sourceId}` });
      continue;
    }
    const bbox = bboxForPlaceGeometry(resolved.geometry);
    if (!bbox) {
      failed.push({ placeId: entry.placeId, reason: `boundary_invalid:${source.sourceId}` });
      continue;
    }
    places.push({
      entry,
      boundary: resolved,
      bbox,
      areaHa: bboxAreaHa(bbox),
    });
  }
  return { places, failed };
}

function sqlText(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : "NULL";
}

function stableAliasId(placeId: string, alias: PlaceSeedAlias): string {
  const normalized = normalizePlaceSearchText(alias.value)
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]/gi, "")
    .slice(0, 40);
  return `${placeId}_alias_${normalized || "name"}`;
}

export function buildD1PlaceSeedSql(places: MaterializedPlaceSeed[]): string {
  const statements: string[] = [];
  for (const place of places) {
    const entry = place.entry;
    statements.push(
      `INSERT INTO places (
        place_id, canonical_name, canonical_name_normalized, locality_label, place_kind,
        verification_status, public_profile_status, official_status, public_summary,
        metadata_json, updated_at
      ) VALUES (
        ${sqlText(entry.placeId)}, ${sqlText(entry.canonicalName)}, ${sqlText(entry.canonicalNameNormalized)},
        ${sqlText(entry.localityLabel)}, ${sqlText(entry.placeKind)}, ${sqlText(entry.verificationStatus)},
        ${sqlText(entry.publicProfileStatus)}, ${sqlText(entry.officialStatus)}, ${sqlText(entry.publicSummary)},
        ${sqlText(JSON.stringify({ seedVersion: "v1" }))}, CURRENT_TIMESTAMP
      )
      ON CONFLICT(place_id) DO UPDATE SET
        canonical_name = excluded.canonical_name,
        canonical_name_normalized = excluded.canonical_name_normalized,
        locality_label = excluded.locality_label,
        place_kind = excluded.place_kind,
        verification_status = excluded.verification_status,
        public_profile_status = excluded.public_profile_status,
        official_status = excluded.official_status,
        public_summary = excluded.public_summary,
        updated_at = CURRENT_TIMESTAMP;`,
    );
    for (const source of entry.sources) {
      statements.push(
        `INSERT INTO place_source_references (
          source_reference_id, place_id, source_type, source_id, source_url,
          source_confidence, verification_status, precedence_rank, last_checked_at, updated_at
        ) VALUES (
          ${sqlText(source.sourceReferenceId)}, ${sqlText(entry.placeId)}, ${sqlText(source.sourceType)},
          ${sqlText(source.sourceId)}, ${sqlText(source.sourceUrl)}, ${sqlNumber(source.confidence)},
          ${sqlText(source.verificationStatus)}, ${sqlNumber(source.precedenceRank)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          place_id = excluded.place_id,
          source_url = excluded.source_url,
          source_confidence = excluded.source_confidence,
          verification_status = excluded.verification_status,
          precedence_rank = excluded.precedence_rank,
          last_checked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;`,
      );
    }
    for (const alias of entry.aliases) {
      statements.push(
        `INSERT INTO place_aliases (
          alias_id, place_id, alias, alias_normalized, language_code, alias_kind,
          source_type, confidence, updated_at
        ) VALUES (
          ${sqlText(stableAliasId(entry.placeId, alias))}, ${sqlText(entry.placeId)}, ${sqlText(alias.value)},
          ${sqlText(normalizePlaceSearchText(alias.value))}, ${sqlText(alias.language)}, ${sqlText(alias.kind)},
          ${sqlText(alias.sourceType)}, ${sqlNumber(alias.confidence)}, CURRENT_TIMESTAMP
        )
        ON CONFLICT(place_id, alias_normalized, alias_kind) DO UPDATE SET
          alias = excluded.alias,
          language_code = excluded.language_code,
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          updated_at = CURRENT_TIMESTAMP;`,
      );
    }
    statements.push(
      `INSERT INTO place_boundaries (
        boundary_id, place_id, boundary_kind, geometry_kind, boundary_geojson,
        source_reference_id, source_type, confidence, precision_kind, boundary_version,
        validation_state, validation_details_json, is_primary,
        bbox_west, bbox_south, bbox_east, bbox_north, area_ha, updated_at
      ) VALUES (
        ${sqlText(`bnd_${entry.placeId}_v1`)}, ${sqlText(entry.placeId)}, 'primary',
        ${sqlText(place.boundary.geometry.type)}, ${sqlText(JSON.stringify(place.boundary.geometry))},
        ${sqlText(entry.boundarySourceReferenceId)}, 'osm', 0.9, 'exact', 1,
        'valid', ${sqlText(JSON.stringify({ resolvedAtImport: true }))}, 1,
        ${sqlNumber(place.bbox.west)}, ${sqlNumber(place.bbox.south)},
        ${sqlNumber(place.bbox.east)}, ${sqlNumber(place.bbox.north)},
        ${sqlNumber(place.areaHa)}, CURRENT_TIMESTAMP
      )
      ON CONFLICT(boundary_id) DO UPDATE SET
        boundary_geojson = excluded.boundary_geojson,
        validation_state = excluded.validation_state,
        validation_details_json = excluded.validation_details_json,
        bbox_west = excluded.bbox_west,
        bbox_south = excluded.bbox_south,
        bbox_east = excluded.bbox_east,
        bbox_north = excluded.bbox_north,
        area_ha = excluded.area_ha,
        updated_at = CURRENT_TIMESTAMP;`,
      `INSERT INTO place_policies (
        place_policy_id, place_id, recording_policy, photography_rule_status,
        public_location_mode, contribution_cta_mode, official_rule_url,
        verification_source_reference_id, verification_status, last_checked_at, updated_at
      ) VALUES (
        ${sqlText(`pol_${entry.placeId}_v1`)}, ${sqlText(entry.placeId)}, ${sqlText(entry.policy.recordingPolicy)},
        ${sqlText(entry.policy.photographyRuleStatus)}, ${sqlText(entry.policy.publicLocationMode)},
        ${sqlText(entry.policy.contributionCtaMode)}, ${sqlText(entry.policy.officialRuleUrl)},
        ${sqlText(entry.policy.officialRuleUrl ? entry.sources[0]?.sourceReferenceId : null)},
        ${sqlText(entry.policy.verificationStatus)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT(place_policy_id) DO UPDATE SET
        recording_policy = excluded.recording_policy,
        photography_rule_status = excluded.photography_rule_status,
        public_location_mode = excluded.public_location_mode,
        contribution_cta_mode = excluded.contribution_cta_mode,
        official_rule_url = excluded.official_rule_url,
        verification_source_reference_id = excluded.verification_source_reference_id,
        verification_status = excluded.verification_status,
        last_checked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;`,
    );
  }
  return statements.join("\n");
}

export function buildPlaceSeedReport(input: {
  document: PlaceSeedDocument;
  places: MaterializedPlaceSeed[];
  failed: Array<{ placeId: string; reason: string }>;
  mode: PlaceSeedReport["mode"];
  generatedAt?: string;
}): PlaceSeedReport {
  return {
    version: "universal_place_atlas_seed_report/v1",
    sourceVerifiedAt: input.document.verifiedAt,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    mode: input.mode,
    totalPlaces: input.document.places.length,
    resolvedBoundaries: input.places.length,
    failed: input.failed,
    places: input.places.map((place) => ({
      placeId: place.entry.placeId,
      canonicalName: place.entry.canonicalName,
      actualOsmName: place.boundary.actualName,
      configuredKind: place.entry.placeKind,
      actualOsmKind: place.boundary.actualPlaceKind,
      osmReference: `${place.boundary.osmType}:${place.boundary.osmId}`,
      areaHa: place.areaHa,
      bbox: [place.bbox.west, place.bbox.south, place.bbox.east, place.bbox.north],
      recordingPolicy: place.entry.policy.recordingPolicy,
    })),
  };
}
