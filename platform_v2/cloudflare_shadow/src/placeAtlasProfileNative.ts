import {
  buildPlaceAtlasProfile,
  type PlaceAtlasBuildInput,
  type PlaceAtlasProfile,
  type PlaceAtlasRef,
  type PlaceAtlasSourceRecord,
} from "../../src/services/placeAtlasContract";
import {
  buildPublicCellGeometry,
  parsePublicCellId,
} from "../../src/services/publicLocation";

type D1Value = string | number | null;

export interface PlaceAtlasD1PreparedStatement {
  bind(...values: D1Value[]): PlaceAtlasD1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export interface PlaceAtlasD1Database {
  prepare(query: string): PlaceAtlasD1PreparedStatement;
}

export type PlaceAtlasGuideSpotInput = {
  id: string;
  title: string;
  subtitle: string;
  preview: string;
  category: "heritage" | "nature" | "community" | "owner";
  lat: number;
  lng: number;
  triggerRadiusM: number;
  sensitiveReviewStatus: "cleared" | "needs_review";
  visibilityStatus?: "published" | "paused" | "hidden";
  safetyStatus?: "active" | "caution" | "closed";
  sourceLinks: Array<{ label: string; url: string }>;
};

export type LoadCloudflarePlaceAtlasInput = {
  db: PlaceAtlasD1Database;
  placeRef: PlaceAtlasRef;
  viewerUserId?: string | null;
  guideSpots?: PlaceAtlasGuideSpotInput[];
  overpassApiUrl?: string | null;
  fetchFn?: typeof fetch;
  generatedAt?: string;
};

type FieldDetailRow = {
  field_id: string;
  source: string;
  admin_level: string | null;
  name: string;
  summary: string | null;
  prefecture: string | null;
  city: string | null;
  public_cell: string;
  public_lat: number;
  public_lng: number;
  radius_m: number | null;
  entity_key: string | null;
};

type FieldPolicyRow = {
  display_suppression_reason: string | null;
  aggregation_gate_json: string;
};

type AreaGeometryRow = {
  field_id: string;
  name: string;
  bbox_min_lat: number;
  bbox_max_lat: number;
  bbox_min_lng: number;
  bbox_max_lng: number;
  geometry_json: string;
};

type PlaceGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown[];
};

type PublicSnapshotRow = {
  occurrence_id: string;
  visit_id: string;
  observed_at: string;
  taxon_group: string;
  display_name: string;
  is_ai_candidate: number;
  is_awaiting_id: number;
  photo_url: string | null;
  cell_1000: string;
  asset_count: number;
};

type VisitLocationRow = {
  visit_id: string;
  place_id: string | null;
  user_id: string | null;
  exact_lat: number | null;
  exact_lng: number | null;
  public_visibility: string | null;
};

type AssetPhotoRow = {
  observation_id: string;
  public_derivative_key: string;
};

type PlaceMemoryRow = {
  entry_id: string;
  visit_id: string;
  occurrence_id: string;
  user_id: string;
  cell_id: string;
  memory_tags_json: string;
  tags_public: number;
  echo_note: string;
  photo_echo_visibility: string;
  moderation_status: string;
  updated_at: string;
};

type OverpassElement = {
  type: "way" | "relation" | "node";
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: string;
    role: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
  center?: { lat?: number; lon?: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
};

type ResolvedOsmPlace = {
  name: string;
  type: string;
  description: string | null;
  geometry: PlaceGeometry;
  bbox: [number, number, number, number];
  center: { lat: number; lng: number };
  tags: Record<string, string>;
};

const SNAPSHOT_KEY = "public-map:v1:global";
const MAX_SNAPSHOT_ROWS = 5_000;
const MAX_SCOPE_CELLS = 256;
const MAX_QUERY_BINDINGS = 80;
const OVERPASS_TIMEOUT_MS = 2_500;
const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OSM_CACHE_TTL_MS = 5 * 60 * 1_000;
const OSM_FAILURE_CACHE_TTL_MS = 60 * 1_000;

const osmPlaceCache = new Map<string, {
  expiresAt: number;
  value: ResolvedOsmPlace | null;
}>();

function isMissingOptionalTable(error: unknown, table: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table|no such column/i.test(message) && message.includes(table);
}

function cleanText(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, maxLength) : null;
}

function safeJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function safeGeometry(value: string | null | undefined): PlaceGeometry | null {
  const parsed = safeJsonRecord(value);
  if ((parsed.type !== "Polygon" && parsed.type !== "MultiPolygon") || !Array.isArray(parsed.coordinates)) {
    return null;
  }
  return {
    type: parsed.type,
    coordinates: parsed.coordinates,
  };
}

function pointInRing(lng: number, lat: number, ring: unknown): boolean {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (!Array.isArray(currentPoint) || !Array.isArray(previousPoint)) continue;
    const currentLng = Number(currentPoint[0]);
    const currentLat = Number(currentPoint[1]);
    const previousLng = Number(previousPoint[0]);
    const previousLat = Number(previousPoint[1]);
    if (![currentLng, currentLat, previousLng, previousLat].every(Number.isFinite)) continue;
    const crosses = (currentLat > lat) !== (previousLat > lat) &&
      lng < ((previousLng - currentLng) * (lat - currentLat)) /
        ((previousLat - currentLat) || Number.EPSILON) + currentLng;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, rings: unknown): boolean {
  if (!Array.isArray(rings) || !pointInRing(lng, lat, rings[0])) return false;
  for (let index = 1; index < rings.length; index += 1) {
    if (pointInRing(lng, lat, rings[index])) return false;
  }
  return true;
}

export function pointInPlaceAtlasGeometry(lng: number, lat: number, geometry: PlaceGeometry): boolean {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (geometry.type === "Polygon") return pointInPolygon(lng, lat, geometry.coordinates);
  return geometry.coordinates.some((polygon) => pointInPolygon(lng, lat, polygon));
}

function walkCoordinates(value: unknown, visit: (lng: number, lat: number) => void): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    visit(value[0], value[1]);
    return;
  }
  value.forEach((entry) => walkCoordinates(entry, visit));
}

function geometryBbox(geometry: PlaceGeometry): [number, number, number, number] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  walkCoordinates(geometry.coordinates, (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  });
  return Number.isFinite(minLng) ? [minLng, minLat, maxLng, maxLat] : null;
}

function distanceMeters(latA: number, lngA: number, latB: number, lngB: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(latB - latA);
  const deltaLng = radians(lngB - lngA);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function publicCellFromCoordinates(lat: number, lng: number): string {
  return `${(Math.round(lat * 100) / 100).toFixed(2)},${(Math.round(lng * 100) / 100).toFixed(2)}`;
}

function publicCellsForBbox(bbox: [number, number, number, number]): string[] | null {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const minLatIndex = Math.floor(minLat * 100) - 1;
  const maxLatIndex = Math.ceil(maxLat * 100) + 1;
  const minLngIndex = Math.floor(minLng * 100) - 1;
  const maxLngIndex = Math.ceil(maxLng * 100) + 1;
  const output: string[] = [];
  for (let latIndex = minLatIndex; latIndex <= maxLatIndex; latIndex += 1) {
    for (let lngIndex = minLngIndex; lngIndex <= maxLngIndex; lngIndex += 1) {
      output.push(`${(latIndex / 100).toFixed(2)},${(lngIndex / 100).toFixed(2)}`);
      if (output.length > MAX_SCOPE_CELLS) return null;
    }
  }
  return output;
}

function parsePublicCell(cell: string): { lat: number; lng: number } | null {
  const match = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(cell);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function resolvePublicCellScope(cellId: string): {
  center: { lat: number; lng: number };
  memoryCell: string;
  snapshotCells: string[];
  completeScope: boolean;
  radiusM: number;
} | null {
  const raw = cellId.startsWith("cell:") ? cellId.slice("cell:".length) : cellId;
  const decimal = parsePublicCell(raw);
  if (decimal) {
    return {
      center: decimal,
      memoryCell: raw,
      snapshotCells: [raw],
      completeScope: true,
      radiusM: 750,
    };
  }
  const grid = parsePublicCellId(raw);
  if (!grid) return null;
  const geometry = buildPublicCellGeometry(grid);
  const memoryCell = publicCellFromCoordinates(geometry.centroidLat, geometry.centroidLng);
  const snapshotCells = publicCellsForBbox(geometry.bounds);
  return {
    center: { lat: geometry.centroidLat, lng: geometry.centroidLng },
    memoryCell,
    snapshotCells: snapshotCells ?? [memoryCell],
    completeScope: snapshotCells !== null,
    radiusM: Math.max(250, Math.min(10_000, Math.ceil(Math.SQRT2 * grid.gridM / 2))),
  };
}

async function loadFieldDetail(db: PlaceAtlasD1Database, fieldId: string): Promise<FieldDetailRow | null> {
  try {
    return await db.prepare(
      `SELECT field_id, source, admin_level, name, summary, prefecture, city,
              public_cell, public_lat, public_lng, radius_m, entity_key
         FROM production_import_field_detail_readmodel
        WHERE field_id = ?`
    ).bind(fieldId).first<FieldDetailRow>();
  } catch (error) {
    if (isMissingOptionalTable(error, "production_import_field_detail_readmodel")) return null;
    throw error;
  }
}

async function loadFieldPolicy(db: PlaceAtlasD1Database, fieldId: string): Promise<FieldPolicyRow | null> {
  try {
    return await db.prepare(
      `SELECT display_suppression_reason, aggregation_gate_json
         FROM field_public_profile_readmodel
        WHERE field_id = ?
          AND profile_status = 'published'`
    ).bind(fieldId).first<FieldPolicyRow>();
  } catch (error) {
    if (isMissingOptionalTable(error, "field_public_profile_readmodel")) return null;
    throw error;
  }
}

async function loadFieldGeometry(db: PlaceAtlasD1Database, fieldId: string): Promise<AreaGeometryRow | null> {
  try {
    return await db.prepare(
      `SELECT field_id, name, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, geometry_json
         FROM production_import_area_polygon_readmodel
        WHERE field_id = ?`
    ).bind(fieldId).first<AreaGeometryRow>();
  } catch (error) {
    if (isMissingOptionalTable(error, "production_import_area_polygon_readmodel")) return null;
    throw error;
  }
}

async function loadSnapshotRows(
  db: PlaceAtlasD1Database,
  cells: string[] | null,
): Promise<{ rows: PublicSnapshotRow[]; complete: boolean }> {
  if (!cells || cells.length === 0) {
    return { rows: [], complete: false };
  }
  const rows: PublicSnapshotRow[] = [];
  let complete = true;
  const perChunkLimit = MAX_SNAPSHOT_ROWS + 1;
  for (let start = 0; start < cells.length; start += MAX_QUERY_BINDINGS) {
    const chunk = cells.slice(start, start + MAX_QUERY_BINDINGS);
    const filters = ` AND cell_1000 IN (${chunk.map(() => "?").join(", ")})`;
    try {
      const result = await db.prepare(
        `SELECT occurrence_id, visit_id, observed_at, taxon_group, display_name,
                is_ai_candidate, is_awaiting_id, photo_url, cell_1000, asset_count
           FROM public_map_snapshot_records_v1
          WHERE snapshot_key = ?${filters}
          ORDER BY observed_at DESC
          LIMIT ?`
      ).bind(SNAPSHOT_KEY, ...chunk, perChunkLimit).all<PublicSnapshotRow>();
      if (result.results.length >= perChunkLimit) complete = false;
      rows.push(...result.results.slice(0, MAX_SNAPSHOT_ROWS));
    } catch (error) {
      if (isMissingOptionalTable(error, "public_map_snapshot_records_v1")) {
        return { rows: [], complete: false };
      }
      throw error;
    }
  }
  rows.sort((left, right) => String(right.observed_at).localeCompare(String(left.observed_at)));
  if (rows.length > MAX_SNAPSHOT_ROWS) complete = false;
  return {
    rows: rows.slice(0, MAX_SNAPSHOT_ROWS),
    complete,
  };
}

async function loadVisitLocations(
  db: PlaceAtlasD1Database,
  visitIds: string[],
): Promise<Map<string, VisitLocationRow>> {
  const output = new Map<string, VisitLocationRow>();
  for (let start = 0; start < visitIds.length; start += MAX_QUERY_BINDINGS) {
    const chunk = visitIds.slice(start, start + MAX_QUERY_BINDINGS);
    if (chunk.length === 0) continue;
    try {
      const rows = await db.prepare(
        `SELECT visit_id, place_id, user_id, exact_lat, exact_lng, public_visibility
           FROM production_import_visits
          WHERE visit_id IN (${chunk.map(() => "?").join(", ")})`
      ).bind(...chunk).all<VisitLocationRow>();
      rows.results.forEach((row) => output.set(row.visit_id, row));
    } catch (error) {
      if (isMissingOptionalTable(error, "production_import_visits")) return new Map();
      throw error;
    }
  }
  return output;
}

async function loadPhotoUrls(
  db: PlaceAtlasD1Database,
  recordIds: string[],
): Promise<Map<string, string>> {
  const output = new Map<string, string>();
  for (let start = 0; start < recordIds.length; start += MAX_QUERY_BINDINGS) {
    const chunk = recordIds.slice(start, start + MAX_QUERY_BINDINGS);
    if (chunk.length === 0) continue;
    try {
      const rows = await db.prepare(
        `SELECT observation_id, public_derivative_key
           FROM asset_ledger
          WHERE observation_id IN (${chunk.map(() => "?").join(", ")})
            AND processing_state = 'uploaded'
            AND public_derivative_key IS NOT NULL
            AND public_derivative_verified_at IS NOT NULL
            AND public_derivative_metadata_json IS NOT NULL
            AND public_derivative_metadata_json NOT LIKE '%"scannedContainer":"svg+xml"%'
            AND public_derivative_metadata_json NOT LIKE '%"contentType":"image/svg%'
            AND exif_scrub_state = 'scrubbed'
            AND public_ready_at IS NOT NULL
            AND mime LIKE 'image/%'
            AND NOT (
              COALESCE(width, 0) = 320
              AND COALESCE(height, 0) = 240
              AND COALESCE(bytes, 0) > 0
              AND bytes <= 12000
            )
            AND NOT (COALESCE(width, 0) = 1 AND COALESCE(height, 0) = 1)
          ORDER BY public_ready_at DESC`
      ).bind(...chunk).all<AssetPhotoRow>();
      for (const row of rows.results) {
        const key = cleanText(row.public_derivative_key, 1_024);
        if (!key || key.includes("..") || key.includes("\\") || output.has(row.observation_id)) continue;
        output.set(row.observation_id, `/${key.replace(/^\/+/, "")}`);
      }
    } catch (error) {
      if (isMissingOptionalTable(error, "asset_ledger")) return output;
      throw error;
    }
  }
  return output;
}

function isPublicVisit(row: VisitLocationRow): boolean {
  return !row.public_visibility || row.public_visibility === "public";
}

function scopeRowsByGeometry(
  rows: PublicSnapshotRow[],
  visits: Map<string, VisitLocationRow>,
  geometry: PlaceGeometry,
  directFieldId?: string,
): PublicSnapshotRow[] {
  return rows.filter((row) => {
    const visit = visits.get(row.visit_id);
    if (!visit || !isPublicVisit(visit)) return false;
    if (directFieldId && visit.place_id === directFieldId) return true;
    return visit.exact_lat !== null && visit.exact_lng !== null &&
      pointInPlaceAtlasGeometry(visit.exact_lng, visit.exact_lat, geometry);
  });
}

function scopeRowsByRadius(
  rows: PublicSnapshotRow[],
  visits: Map<string, VisitLocationRow>,
  center: { lat: number; lng: number },
  radiusM: number,
  directFieldId?: string,
): PublicSnapshotRow[] {
  return rows.filter((row) => {
    const visit = visits.get(row.visit_id);
    if (!visit || !isPublicVisit(visit)) return false;
    if (directFieldId && visit.place_id === directFieldId) return true;
    return visit.exact_lat !== null && visit.exact_lng !== null &&
      distanceMeters(center.lat, center.lng, visit.exact_lat, visit.exact_lng) <= radiusM;
  });
}

function safeSnapshotPhoto(row: PublicSnapshotRow, photos: Map<string, string>): string | null {
  const candidate = cleanText(row.photo_url, 2_048);
  if (candidate && (
    (candidate.startsWith("/") && !candidate.startsWith("//")) ||
    candidate.startsWith("https://")
  )) {
    return candidate;
  }
  return photos.get(row.visit_id) ?? photos.get(row.occurrence_id) ?? null;
}

function sourceRecords(rows: PublicSnapshotRow[], photos: Map<string, string>): PlaceAtlasSourceRecord[] {
  return rows.map((row) => ({
    recordId: row.visit_id,
    observedAt: cleanText(row.observed_at, 64),
    displayName: cleanText(row.display_name, 160),
    href: `/observations/${encodeURIComponent(row.occurrence_id)}`,
    mediaUrl: safeSnapshotPhoto(row, photos),
    mediaKind: safeSnapshotPhoto(row, photos) ? "photo" : "record",
    taxonGroup: cleanText(row.taxon_group, 64),
    identificationStatus: row.is_ai_candidate === 1
      ? "ai_candidate"
      : row.is_awaiting_id === 1
        ? "awaiting_identification"
        : cleanText(row.display_name)
          ? "confirmed"
          : "unknown",
  }));
}

function localityLabel(field: FieldDetailRow): string | null {
  const parts = [cleanText(field.prefecture, 80), cleanText(field.city, 80)].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function fieldType(field: FieldDetailRow): string {
  if (field.source === "school" || field.admin_level === "school") return "school";
  if (field.source === "osm_park") return "park";
  if (field.source.includes("farm")) return "farm";
  return cleanText(field.admin_level, 64) ?? cleanText(field.source, 64) ?? "field";
}

function publicPolicyMinimum(row: FieldPolicyRow | null): number {
  const gate = safeJsonRecord(row?.aggregation_gate_json);
  const thresholds = gate.thresholds && typeof gate.thresholds === "object" && !Array.isArray(gate.thresholds)
    ? gate.thresholds as Record<string, unknown>
    : {};
  const value = Number(thresholds.minObservationCount);
  return Number.isFinite(value) ? Math.max(3, Math.floor(value)) : 3;
}

function isSensitivePolicySuppression(row: FieldPolicyRow | null): boolean {
  return row?.display_suppression_reason === "sensitive_precheck_failed";
}

function safeGuideUrl(value: unknown): string | null {
  const url = cleanText(value, 2_048);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function guideForScope(
  spots: PlaceAtlasGuideSpotInput[],
  geometry: PlaceGeometry | null,
  center: { lat: number; lng: number },
  radiusM: number,
): Record<string, unknown> | null {
  const spot = spots.find((candidate) => {
    if (
      candidate.sensitiveReviewStatus !== "cleared" ||
      candidate.visibilityStatus === "hidden" ||
      candidate.visibilityStatus === "paused" ||
      candidate.safetyStatus === "closed"
    ) {
      return false;
    }
    return geometry
      ? pointInPlaceAtlasGeometry(candidate.lng, candidate.lat, geometry)
      : distanceMeters(center.lat, center.lng, candidate.lat, candidate.lng) <=
        Math.max(radiusM, candidate.triggerRadiusM);
  });
  if (!spot) return null;
  return {
    id: spot.id,
    title: cleanText(spot.title, 120),
    subtitle: cleanText(spot.subtitle, 180),
    preview: cleanText(spot.preview, 360),
    category: spot.category,
    safetyStatus: spot.safetyStatus ?? "active",
    sourceLinks: spot.sourceLinks
      .map((source) => {
        const url = safeGuideUrl(source.url);
        return url ? { label: cleanText(source.label, 100), url } : null;
      })
      .filter((source): source is { label: string | null; url: string } => Boolean(source)),
  };
}

async function loadUnlockedMemories(
  db: PlaceAtlasD1Database,
  viewerUserId: string | null | undefined,
  publicCell: string,
): Promise<unknown[]> {
  if (!viewerUserId || !publicCell) return [];
  try {
    const access = await db.prepare(
      `SELECT EXISTS(
         SELECT 1
           FROM place_memory_entries
          WHERE user_id = ?
            AND cell_id = ?
            AND deleted_at IS NULL
       ) AS has_access`
    ).bind(viewerUserId, publicCell).first<{ has_access: number | boolean }>();
    if (access?.has_access !== 1 && access?.has_access !== true) return [];
    const rows = await db.prepare(
      `SELECT entry_id, visit_id, occurrence_id, user_id, cell_id,
              memory_tags_json, tags_public, echo_note, photo_echo_visibility,
              moderation_status, updated_at
         FROM place_memory_entries pme
        WHERE pme.cell_id = ?
          AND pme.deleted_at IS NULL
          AND pme.moderation_status = 'visible'
          AND EXISTS (
            SELECT 1
              FROM production_import_visits visit
             WHERE visit.visit_id = pme.visit_id
               AND COALESCE(visit.public_visibility, 'public') = 'public'
          )
          AND NOT EXISTS (
            SELECT 1
              FROM place_memory_hidden_entries hidden
             WHERE hidden.entry_id = pme.entry_id
               AND hidden.user_id = ?
          )
        ORDER BY pme.updated_at DESC
        LIMIT 12`
    ).bind(publicCell, viewerUserId).all<PlaceMemoryRow>();
    return rows.results.map((row) => {
      let tags: string[] = [];
      try {
        const parsed = JSON.parse(row.memory_tags_json);
        if (Array.isArray(parsed) && (row.tags_public === 1 || row.user_id === viewerUserId)) {
          tags = parsed.filter((value): value is string => typeof value === "string").slice(0, 6);
        }
      } catch {
        tags = [];
      }
      return {
        entryId: row.entry_id,
        recordId: row.visit_id,
        tags,
        echoNote: cleanText(row.echo_note, 80),
        observedYearMonth: row.updated_at.slice(0, 7),
        photoState: row.photo_echo_visibility,
        ownEntry: row.user_id === viewerUserId,
      };
    });
  } catch (error) {
    if (isMissingOptionalTable(error, "place_memory_entries")) return [];
    throw error;
  }
}

function normalizeOsmRing(points: Array<{ lat: number; lon: number }> | undefined): number[][] | null {
  if (!Array.isArray(points) || points.length < 3) return null;
  const ring = points
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
    .map((point) => [point.lon, point.lat]);
  if (ring.length < 3) return null;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0]!, first[1]!]);
  return ring;
}

function osmGeometry(element: OverpassElement): PlaceGeometry | null {
  if (element.type === "way") {
    const ring = normalizeOsmRing(element.geometry);
    return ring ? { type: "Polygon", coordinates: [ring] } : null;
  }
  if (element.type !== "relation" || !Array.isArray(element.members)) return null;
  const outerRings = element.members
    .filter((member) => member.type === "way" && member.role !== "inner")
    .map((member) => normalizeOsmRing(member.geometry))
    .filter((ring): ring is number[][] => Boolean(ring));
  if (outerRings.length === 0) return null;
  const polygons = outerRings.map((ring) => [ring]);
  const innerRings = element.members
    .filter((member) => member.type === "way" && member.role === "inner")
    .map((member) => normalizeOsmRing(member.geometry))
    .filter((ring): ring is number[][] => Boolean(ring));
  for (const inner of innerRings) {
    const first = inner[0];
    if (!first) continue;
    const owner = polygons.find((polygon) => pointInRing(first[0]!, first[1]!, polygon[0]));
    if (owner) owner.push(inner);
  }
  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0]! }
    : { type: "MultiPolygon", coordinates: polygons };
}

function supportedOsmType(tags: Record<string, string>): string | null {
  if (["park", "garden", "nature_reserve"].includes(tags.leisure ?? "")) return "park";
  if (["school", "college", "university", "kindergarten"].includes(tags.amenity ?? "")) return "school";
  if (["farmland", "farmyard", "orchard", "vineyard"].includes(tags.landuse ?? "")) return "farm";
  if (tags.amenity === "community_centre") return "community";
  if (["forest", "meadow", "recreation_ground"].includes(tags.landuse ?? "")) return "nature_area";
  return null;
}

function osmName(tags: Record<string, string>): string | null {
  return cleanText(tags["name:ja"] ?? tags.name ?? tags.alt_name, 160);
}

function osmDescription(tags: Record<string, string>): string | null {
  return cleanText(tags.description ?? tags["description:ja"], 360);
}

function osmCenter(element: OverpassElement, geometry: PlaceGeometry): { lat: number; lng: number } | null {
  if (Number.isFinite(element.center?.lat) && Number.isFinite(element.center?.lon)) {
    return { lat: Number(element.center!.lat), lng: Number(element.center!.lon) };
  }
  if (element.bounds) {
    return {
      lat: (element.bounds.minlat + element.bounds.maxlat) / 2,
      lng: (element.bounds.minlon + element.bounds.maxlon) / 2,
    };
  }
  const bbox = geometryBbox(geometry);
  return bbox
    ? { lat: (bbox[1] + bbox[3]) / 2, lng: (bbox[0] + bbox[2]) / 2 }
    : null;
}

async function resolveOsmPlace(
  ref: Extract<PlaceAtlasRef, { kind: "osm_area" }>,
  options: Pick<LoadCloudflarePlaceAtlasInput, "fetchFn" | "overpassApiUrl">,
): Promise<ResolvedOsmPlace | null> {
  const cache = osmPlaceCache.get(ref.entityKey);
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  const endpoint = cleanText(options.overpassApiUrl, 2_048) ?? DEFAULT_OVERPASS_URL;
  const query = `[out:json][timeout:8];${ref.osmType}(${ref.osmId});out tags geom;`;
  let value: ResolvedOsmPlace | null = null;
  try {
    const response = await (options.fetchFn ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "accept": "application/json",
        "user-agent": "ikimon.life place atlas contact: https://ikimon.life",
        "x-ikimon-client": "ikimon.life-place-atlas",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`overpass_${response.status}`);
    const payload = await response.json() as { elements?: OverpassElement[] };
    const element = (payload.elements ?? []).find((candidate) =>
      candidate.type === ref.osmType && candidate.id === ref.osmId
    );
    const tags = element?.tags ?? {};
    const type = supportedOsmType(tags);
    const geometry = element ? osmGeometry(element) : null;
    const name = osmName(tags);
    const center = element && geometry ? osmCenter(element, geometry) : null;
    const bbox = geometry ? geometryBbox(geometry) : null;
    if (element && type && geometry && name && center && bbox) {
      value = {
        name,
        type,
        description: osmDescription(tags),
        geometry,
        bbox,
        center,
        tags,
      };
    }
  } catch {
    value = null;
  } finally {
    clearTimeout(timeout);
  }
  osmPlaceCache.set(ref.entityKey, {
    value,
    expiresAt: Date.now() + (value ? OSM_CACHE_TTL_MS : OSM_FAILURE_CACHE_TTL_MS),
  });
  if (osmPlaceCache.size > 100) {
    const oldestKey = osmPlaceCache.keys().next().value;
    if (oldestKey !== undefined) osmPlaceCache.delete(oldestKey);
  }
  return value;
}

function osmFacilities(place: ResolvedOsmPlace): unknown[] {
  const facilities: unknown[] = [];
  if (place.tags.toilets === "yes") {
    facilities.push({ kind: "toilet", label: "トイレ", source: "OpenStreetMap", confidence: "derived" });
  }
  if (place.tags.wheelchair === "yes") {
    facilities.push({ kind: "accessible", label: "車いすで利用可能", source: "OpenStreetMap", confidence: "derived" });
  }
  if (place.tags.bench === "yes") {
    facilities.push({ kind: "bench", label: "ベンチ", source: "OpenStreetMap", confidence: "derived" });
  }
  return facilities;
}

function osmSuppressedSections(place: ResolvedOsmPlace): string[] {
  const access = (place.tags.access ?? "").toLowerCase();
  return place.type === "school" || ["private", "no", "customers", "permit"].includes(access)
    ? ["contribution_cta"]
    : [];
}

async function buildRecordsForGeometry(
  input: LoadCloudflarePlaceAtlasInput,
  geometry: PlaceGeometry,
  bbox: [number, number, number, number],
  directFieldId?: string,
): Promise<{ records: PlaceAtlasSourceRecord[]; complete: boolean }> {
  const snapshot = await loadSnapshotRows(input.db, publicCellsForBbox(bbox));
  const visitIds = [...new Set(snapshot.rows.map((row) => row.visit_id))];
  const visits = await loadVisitLocations(input.db, visitIds);
  const scoped = visits.size > 0
    ? scopeRowsByGeometry(snapshot.rows, visits, geometry, directFieldId)
    : [];
  const photoIds = [...new Set(scoped.flatMap((row) => [row.visit_id, row.occurrence_id]))];
  const photos = await loadPhotoUrls(input.db, photoIds);
  return { records: sourceRecords(scoped, photos), complete: snapshot.complete };
}

async function buildRecordsForRadius(
  input: LoadCloudflarePlaceAtlasInput,
  center: { lat: number; lng: number },
  radiusM: number,
  directFieldId?: string,
): Promise<{ records: PlaceAtlasSourceRecord[]; complete: boolean }> {
  const latDelta = radiusM / 111_320;
  const lngDelta = radiusM / Math.max(1, 111_320 * Math.cos(center.lat * Math.PI / 180));
  const bbox: [number, number, number, number] = [
    center.lng - lngDelta,
    center.lat - latDelta,
    center.lng + lngDelta,
    center.lat + latDelta,
  ];
  const snapshot = await loadSnapshotRows(input.db, publicCellsForBbox(bbox));
  const visitIds = [...new Set(snapshot.rows.map((row) => row.visit_id))];
  const visits = await loadVisitLocations(input.db, visitIds);
  const scoped = visits.size > 0
    ? scopeRowsByRadius(snapshot.rows, visits, center, radiusM, directFieldId)
    : [];
  const photos = await loadPhotoUrls(
    input.db,
    [...new Set(scoped.flatMap((row) => [row.visit_id, row.occurrence_id]))],
  );
  return { records: sourceRecords(scoped, photos), complete: snapshot.complete };
}

async function buildRecordsForCell(
  input: LoadCloudflarePlaceAtlasInput,
  publicCell: string,
): Promise<{ records: PlaceAtlasSourceRecord[]; complete: boolean }> {
  return buildRecordsForCells(input, [publicCell]);
}

async function buildRecordsForCells(
  input: LoadCloudflarePlaceAtlasInput,
  publicCells: string[],
): Promise<{ records: PlaceAtlasSourceRecord[]; complete: boolean }> {
  const snapshot = await loadSnapshotRows(input.db, publicCells);
  const photos = await loadPhotoUrls(
    input.db,
    [...new Set(snapshot.rows.flatMap((row) => [row.visit_id, row.occurrence_id]))],
  );
  return {
    records: sourceRecords(snapshot.rows, photos),
    complete: snapshot.complete,
  };
}

function profileSources(...values: Array<string | false | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value !== ""))];
}

async function loadFieldPlaceAtlasProfile(
  input: LoadCloudflarePlaceAtlasInput,
  ref: Extract<PlaceAtlasRef, { kind: "field" }>,
): Promise<PlaceAtlasProfile | null> {
  const field = await loadFieldDetail(input.db, ref.fieldId);
  if (!field) return null;
  const [policy, area] = await Promise.all([
    loadFieldPolicy(input.db, ref.fieldId),
    loadFieldGeometry(input.db, ref.fieldId),
  ]);
  const geometry = safeGeometry(area?.geometry_json);
  const center = { lat: field.public_lat, lng: field.public_lng };
  const radiusM = Math.max(50, Math.min(field.radius_m ?? 500, 10_000));
  let locationMode: PlaceAtlasBuildInput["locationMode"] = "public_cell_derived";
  let recordResult: { records: PlaceAtlasSourceRecord[]; complete: boolean };
  if (geometry && area) {
    recordResult = await buildRecordsForGeometry(input, geometry, [
      area.bbox_min_lng,
      area.bbox_min_lat,
      area.bbox_max_lng,
      area.bbox_max_lat,
    ], field.field_id);
    locationMode = "field";
  } else if (Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
    recordResult = await buildRecordsForRadius(input, center, radiusM, field.field_id);
    locationMode = "field";
  } else {
    recordResult = await buildRecordsForCell(input, field.public_cell);
  }
  const sensitiveSuppression = isSensitivePolicySuppression(policy);
  const guide = guideForScope(input.guideSpots ?? [], geometry, center, radiusM);
  const memories = await loadUnlockedMemories(input.db, input.viewerUserId, field.public_cell);
  const contributionRestricted = fieldType(field) === "school" || sensitiveSuppression;
  const suppressedSections = [
    ...(policy?.display_suppression_reason ? ["field_profile_narrative"] : []),
    ...(sensitiveSuppression
      ? ["record_summary", "representative_media", "recent_records", "themes", "highlights"]
      : []),
    ...(contributionRestricted ? ["contribution_cta"] : []),
  ];
  return buildPlaceAtlasProfile({
    placeRef: ref,
    place: {
      name: field.name,
      type: fieldType(field),
      localityLabel: localityLabel(field),
      description: field.summary,
    },
    records: sensitiveSuppression ? null : recordResult.records,
    recordSetComplete: recordResult.complete,
    locationMode,
    minimumPublicRecords: publicPolicyMinimum(policy),
    contributorCountAllowed: false,
    guide,
    memories,
    facilities: [],
    suppressedSections,
    dataGaps: [
      ...(policy?.display_suppression_reason
        ? [{
            key: "field_public_profile",
            label: "場所の詳しい分析",
            reason: "既存の場所プロフィール公開基準を満たすまで、分析文は表示していません。",
          }]
        : []),
    ],
    sources: profileSources(
      "production_import_field_detail_readmodel",
      geometry && "production_import_area_polygon_readmodel",
      "public_map_snapshot_records_v1",
      policy && "field_public_profile_readmodel",
      guide && "map_guide_spots",
      memories.length > 0 && "place_memory",
    ),
    generatedAt: input.generatedAt,
  });
}

async function loadOsmPlaceAtlasProfile(
  input: LoadCloudflarePlaceAtlasInput,
  ref: Extract<PlaceAtlasRef, { kind: "osm_area" }>,
): Promise<PlaceAtlasProfile | null> {
  const place = await resolveOsmPlace(ref, input);
  if (!place) return null;
  const records = await buildRecordsForGeometry(input, place.geometry, place.bbox);
  const publicCell = publicCellFromCoordinates(place.center.lat, place.center.lng);
  const guide = guideForScope(input.guideSpots ?? [], place.geometry, place.center, 500);
  const memories = await loadUnlockedMemories(input.db, input.viewerUserId, publicCell);
  const suppressedSections = osmSuppressedSections(place);
  return buildPlaceAtlasProfile({
    placeRef: ref,
    place: {
      name: place.name,
      type: place.type,
      localityLabel: null,
      description: place.description,
    },
    records: records.records,
    recordSetComplete: records.complete,
    locationMode: "osm_area",
    minimumPublicRecords: 3,
    contributorCountAllowed: false,
    guide,
    memories,
    facilities: osmFacilities(place),
    suppressedSections,
    dataGaps: [
      ...(suppressedSections.includes("contribution_cta")
        ? [{
            key: "access",
            label: "立入・記録",
            reason: "立入条件がある場所のため、現地ルールと許可を優先してください。",
          }]
        : []),
    ],
    sources: profileSources(
      "OpenStreetMap",
      "public_map_snapshot_records_v1",
      guide && "map_guide_spots",
      memories.length > 0 && "place_memory",
    ),
    generatedAt: input.generatedAt,
  });
}

async function loadPublicCellPlaceAtlasProfile(
  input: LoadCloudflarePlaceAtlasInput,
  ref: Extract<PlaceAtlasRef, { kind: "public_cell" }>,
): Promise<PlaceAtlasProfile | null> {
  const scope = resolvePublicCellScope(ref.cellId);
  if (!scope) return null;
  const records = await buildRecordsForCells(input, scope.snapshotCells);
  const memories = await loadUnlockedMemories(input.db, input.viewerUserId, scope.memoryCell);
  return buildPlaceAtlasProfile({
    placeRef: ref,
    place: {
      name: "このあたりの地域図鑑",
      type: "public_cell",
      localityLabel: "位置をぼかした公開範囲",
      description: null,
    },
    records: records.records,
    recordSetComplete: records.complete && scope.completeScope,
    locationMode: "public_cell",
    minimumPublicRecords: 3,
    contributorCountAllowed: false,
    guide: guideForScope(input.guideSpots ?? [], null, scope.center, scope.radiusM),
    memories,
    facilities: [],
    sources: profileSources(
      "public_map_snapshot_records_v1",
      memories.length > 0 && "place_memory",
    ),
    generatedAt: input.generatedAt,
  });
}

export async function loadCloudflarePlaceAtlasProfile(
  input: LoadCloudflarePlaceAtlasInput,
): Promise<PlaceAtlasProfile | null> {
  if (input.placeRef.kind === "field") {
    return loadFieldPlaceAtlasProfile(input, input.placeRef);
  }
  if (input.placeRef.kind === "osm_area") {
    return loadOsmPlaceAtlasProfile(input, input.placeRef);
  }
  return loadPublicCellPlaceAtlasProfile(input, input.placeRef);
}
