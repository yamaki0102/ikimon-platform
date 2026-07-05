/**
 * Enrich P29 school point fields with campus polygons from OSM relation exports
 * or municipal open-data GeoJSON.
 *
 * Example:
 *   npm --prefix platform_v2 run enhance:school-boundaries -- \
 *     --file=./data/hamamatsu-school-boundaries.geojson --boundary-source=osm --prefecture=静岡県 --dry-run
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { computeBbox, type Bbox } from "../services/geoJsonBbox.js";
import { haversineMeters, normalizeFieldName } from "../services/observationEventAreaGeometry.js";

type Geometry = {
  type: string;
  coordinates: unknown;
};

type Feature = {
  type: "Feature";
  geometry: Geometry | null;
  properties?: Record<string, unknown> | null;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

type CandidateSchool = {
  field_id: string;
  name: string;
  lat: string | number;
  lng: string | number;
  prefecture: string | null;
  city: string | null;
  radius_m: string | number | null;
  area_ha: string | number | null;
  bbox_min_lat: string | number | null;
  bbox_max_lat: string | number | null;
  bbox_min_lng: string | number | null;
  bbox_max_lng: string | number | null;
  polygon_json: string | null;
  payload_json: string | null;
  updated_at: string | null;
  payload: Record<string, unknown> | null;
};

type BoundaryCandidate = {
  feature: Feature;
  name: string;
  geometry: Geometry;
  bbox: Bbox;
  center: { lat: number; lng: number };
  areaHa: number | null;
  radiusM: number;
};

type Options = {
  file: string;
  boundarySource: "osm" | "municipal" | "other";
  prefecture?: string;
  city?: string;
  fieldIds: string[];
  maxDistanceM: number;
  limit?: number;
  dryRun: boolean;
  allowDistanceFallback: boolean;
  reportFile?: string;
};

type SchoolMatch = {
  school: CandidateSchool;
  score: number;
  contains: boolean;
  distanceM: number;
  nameScore: number;
  method: "containment" | "distance_fallback";
};

type MatchReportEntry = {
  boundaryName: string;
  boundary: {
    areaHa: number | null;
    bbox: Bbox;
    radiusM: number;
    sourceProperties: Record<string, unknown> | null | undefined;
  };
  chosen: null | {
    fieldId: string;
    name: string;
    method: SchoolMatch["method"];
    contains: boolean;
    distanceM: number;
    nameScore: number;
    score: number;
    before: Record<string, unknown>;
    proposedBoundary: Record<string, unknown>;
  };
  candidates: Array<{
    fieldId: string;
    name: string;
    contains: boolean;
    distanceM: number;
    nameScore: number;
    score: number;
    method: SchoolMatch["method"] | "manual_review";
  }>;
};

type PlannedBoundaryUpdate = {
  boundary: BoundaryCandidate;
  match: SchoolMatch;
  schoolBoundaryPayload: Record<string, unknown>;
};

const EARTH_RADIUS_M = 6_371_000;

type DbPool = {
  query<T = unknown>(text: string, params?: readonly unknown[]): Promise<{ rows: T[] }>;
};

let dbPoolPromise: Promise<DbPool> | null = null;

async function getBoundaryDbPool(): Promise<DbPool> {
  dbPoolPromise ??= import("../db.js").then(({ getPool }) => getPool() as DbPool);
  return dbPoolPromise;
}

async function queryDb<T = unknown>(text: string, params?: readonly unknown[]): Promise<{ rows: T[] }> {
  return (await getBoundaryDbPool()).query<T>(text, params);
}

function argValue(args: string[], name: string): string | undefined {
  return args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

function argValues(args: string[], name: string): string[] {
  return args
    .filter((a) => a.startsWith(`--${name}=`))
    .map((a) => a.split("=").slice(1).join("="))
    .filter(Boolean);
}

function parseFieldIds(args: string[]): string[] {
  return argValues(args, "field-id")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const file = argValue(args, "file");
  if (!file) throw new Error("--file is required");
  const boundarySourceRaw = argValue(args, "boundary-source") ?? "other";
  const boundarySource = boundarySourceRaw === "osm" || boundarySourceRaw === "municipal" ? boundarySourceRaw : "other";
  const maxDistanceM = Number(argValue(args, "max-distance-m") ?? 150);
  const limitRaw = argValue(args, "limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const reportFile = argValue(args, "report-file");
  const dryRun = args.includes("--dry-run");
  if (!dryRun && !reportFile) {
    throw new Error("--report-file is required for non-dry-run writes so rollback evidence is captured");
  }
  return {
    file,
    boundarySource,
    prefecture: argValue(args, "prefecture"),
    city: argValue(args, "city"),
    fieldIds: parseFieldIds(args),
    maxDistanceM: Number.isFinite(maxDistanceM) ? Math.max(50, Math.min(500, maxDistanceM)) : 150,
    limit: limit && Number.isFinite(limit) ? Math.max(1, limit) : undefined,
    dryRun,
    allowDistanceFallback: args.includes("--allow-distance-fallback"),
    reportFile,
  };
}

function toRad(v: number): number {
  return (v * Math.PI) / 180;
}

function pointInRing(point: [number, number], ring: unknown): boolean {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i];
    const pj = ring[j];
    if (!Array.isArray(pi) || !Array.isArray(pj)) continue;
    const xi = Number(pi[0]);
    const yi = Number(pi[1]);
    const xj = Number(pj[0]);
    const yj = Number(pj[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(lat: number, lng: number, geometry: Geometry): boolean {
  const point: [number, number] = [lng, lat];
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    const rings = geometry.coordinates as unknown[];
    return pointInRing(point, rings[0]);
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return (geometry.coordinates as unknown[]).some((poly) => Array.isArray(poly) && pointInRing(point, poly[0]));
  }
  return false;
}

function ringAreaHa(ring: unknown): number {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  const latValues = ring
    .filter((p) => Array.isArray(p) && Number.isFinite(Number(p[1])))
    .map((p) => Number((p as unknown[])[1]));
  if (!latValues.length) return 0;
  const meanLat = latValues.reduce((a, b) => a + b, 0) / latValues.length;
  const cos = Math.cos(toRad(meanLat));
  let twiceArea = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    const ax = toRad(Number(a[0])) * EARTH_RADIUS_M * cos;
    const ay = toRad(Number(a[1])) * EARTH_RADIUS_M;
    const bx = toRad(Number(b[0])) * EARTH_RADIUS_M * cos;
    const by = toRad(Number(b[1])) * EARTH_RADIUS_M;
    if (![ax, ay, bx, by].every(Number.isFinite)) continue;
    twiceArea += ax * by - bx * ay;
  }
  return Math.abs(twiceArea / 2) / 10_000;
}

function geometryAreaHa(geometry: Geometry): number | null {
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    const outer = ringAreaHa((geometry.coordinates as unknown[])[0]);
    return outer > 0 ? outer : null;
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    const total = (geometry.coordinates as unknown[])
      .filter(Array.isArray)
      .reduce((sum, poly) => sum + ringAreaHa((poly as unknown[])[0]), 0);
    return total > 0 ? total : null;
  }
  return null;
}

function bboxCenter(bbox: Bbox): { lat: number; lng: number } {
  return {
    lat: (bbox.minLat + bbox.maxLat) / 2,
    lng: (bbox.minLng + bbox.maxLng) / 2,
  };
}

function radiusFromBbox(bbox: Bbox): number {
  return Math.max(80, Math.min(3_000, Math.round(haversineMeters(bbox.minLat, bbox.minLng, bbox.maxLat, bbox.maxLng) / 2)));
}

function getProp(props: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = String(props[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function boundaryName(feature: Feature): string {
  const props = feature.properties ?? {};
  return getProp(props, ["name", "Name", "名称", "school_name", "校名", "P29_004", "official_name"]);
}

function boundaryOsmProvenance(feature: Feature): { type: string | null; id: string | null; url: string | null } {
  const props = feature.properties ?? {};
  const osmType = getProp(props, ["osm_type", "osmType", "@type"]) || null;
  const osmId = getProp(props, ["osm_id", "osmId", "@id"]).replace(/^(way|relation)\//, "") || null;
  const url = osmType && osmId && /^(way|relation)$/.test(osmType)
    ? `https://www.openstreetmap.org/${osmType}/${osmId}`
    : null;
  return { type: osmType, id: osmId, url };
}

function boundaryCandidates(filePath: string): BoundaryCandidate[] {
  const raw = readFileSync(filePath, "utf-8");
  const collection = JSON.parse(raw) as FeatureCollection;
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error("GeoJSON FeatureCollection is required");
  }
  const out: BoundaryCandidate[] = [];
  for (const feature of collection.features) {
    if (!feature.geometry || (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon")) continue;
    const bbox = computeBbox(feature.geometry);
    if (!bbox) continue;
    out.push({
      feature,
      name: boundaryName(feature),
      geometry: feature.geometry,
      bbox,
      center: bboxCenter(bbox),
      areaHa: geometryAreaHa(feature.geometry),
      radiusM: radiusFromBbox(bbox),
    });
  }
  return out;
}

export function nameDistance(a: string, b: string): number {
  const na = normalizeFieldName(a);
  const nb = normalizeFieldName(b);
  if (!na || !nb) return 80;
  if (na === nb) return 0;
  if (na.includes(nb) || nb.includes(na)) return 18;
  return 80;
}

async function candidateSchools(boundary: BoundaryCandidate, options: Options): Promise<CandidateSchool[]> {
  const params: unknown[] = [
    boundary.bbox.minLat - 0.01,
    boundary.bbox.maxLat + 0.01,
    boundary.bbox.minLng - 0.01,
    boundary.bbox.maxLng + 0.01,
  ];
  let where = `source = 'school'
       AND valid_to IS NULL
       AND lat BETWEEN $1::float8 AND $2::float8
       AND lng BETWEEN $3::float8 AND $4::float8`;
  if (options.prefecture) {
    params.push(options.prefecture);
    where += ` AND prefecture = $${params.length}`;
  }
  if (options.city) {
    params.push(options.city);
    where += ` AND city = $${params.length}`;
  }
  if (options.fieldIds.length > 0) {
    const placeholders = options.fieldIds.map((fieldId) => {
      params.push(fieldId);
      return `$${params.length}`;
    });
    where += ` AND field_id IN (${placeholders.join(", ")})`;
  }
  const result = await queryDb<CandidateSchool>(
    `SELECT field_id, name, lat::text AS lat, lng::text AS lng, prefecture, city,
            radius_m::text AS radius_m, area_ha::text AS area_ha,
            bbox_min_lat::text AS bbox_min_lat, bbox_max_lat::text AS bbox_max_lat,
            bbox_min_lng::text AS bbox_min_lng, bbox_max_lng::text AS bbox_max_lng,
            polygon::text AS polygon_json, payload::text AS payload_json, payload, updated_at::text AS updated_at
       FROM observation_fields
      WHERE ${where}
      LIMIT 50`,
    params,
  );
  return result.rows;
}

export function scoreSchoolCandidates(boundary: BoundaryCandidate, schools: CandidateSchool[], options: Pick<Options, "allowDistanceFallback" | "maxDistanceM">): SchoolMatch[] {
  return schools.map((school) => {
    const lat = Number(school.lat);
    const lng = Number(school.lng);
    const contains = pointInGeometry(lat, lng, boundary.geometry);
    const distanceM = contains ? 0 : haversineMeters(lat, lng, boundary.center.lat, boundary.center.lng);
    const nameScore = nameDistance(boundary.name, school.name);
    const method: SchoolMatch["method"] = contains ? "containment" : "distance_fallback";
    const score = nameScore + Math.min(distanceM / 20, 80) + (contains ? -35 : 0);
    return { school, score, contains, distanceM, nameScore, method };
  }).filter((item) => {
    if (item.contains) return true;
    return options.allowDistanceFallback && item.distanceM <= options.maxDistanceM && item.nameScore <= 18;
  }).sort((a, b) => a.score - b.score);
}

export function chooseSchool(boundary: BoundaryCandidate, schools: CandidateSchool[], options: Pick<Options, "allowDistanceFallback" | "maxDistanceM">): SchoolMatch | null {
  const scored = scoreSchoolCandidates(boundary, schools, options);
  return scored[0] ?? null;
}

function proposedSchoolBoundaryPayload(boundary: BoundaryCandidate, match: SchoolMatch, options: Options): Record<string, unknown> {
  return {
    source: options.boundarySource,
    matched_at: new Date().toISOString(),
    matched_name: boundary.name || null,
    match_score: Number(match.score.toFixed(2)),
    match_method: match.method,
    contains_point: match.contains,
    distance_m: Number(match.distanceM.toFixed(2)),
    name_score: Number(match.nameScore.toFixed(2)),
    boundary_area_ha: boundary.areaHa,
    boundary_bbox: boundary.bbox,
    osm: boundaryOsmProvenance(boundary.feature),
    odbl: options.boundarySource === "osm"
      ? {
          attribution: "© OpenStreetMap contributors",
          license: "ODbL-1.0",
          persisted_geometry: true,
          policy_note: "Persisted OSM school boundary; attribution and share-alike implications must remain documented before rollout."
        }
      : null,
    properties: boundary.feature.properties ?? {},
  };
}

function beforeSnapshot(school: CandidateSchool): Record<string, unknown> {
  return {
    field_id: school.field_id,
    name: school.name,
    lat: school.lat,
    lng: school.lng,
    prefecture: school.prefecture,
    city: school.city,
    radius_m: school.radius_m,
    area_ha: school.area_ha,
    bbox_min_lat: school.bbox_min_lat,
    bbox_max_lat: school.bbox_max_lat,
    bbox_min_lng: school.bbox_min_lng,
    bbox_max_lng: school.bbox_max_lng,
    polygon_json: school.polygon_json,
    payload_json: school.payload_json,
    updated_at: school.updated_at,
  };
}

async function updateBoundary(boundary: BoundaryCandidate, match: SchoolMatch, schoolBoundaryPayload: Record<string, unknown>): Promise<void> {
  const payload = {
    school_boundary: schoolBoundaryPayload,
  };
  await queryDb(
    `UPDATE observation_fields
        SET polygon = $2::jsonb,
            area_ha = COALESCE($3::numeric, area_ha),
            radius_m = $4,
            bbox_min_lat = $5,
            bbox_max_lat = $6,
            bbox_min_lng = $7,
            bbox_max_lng = $8,
            payload = payload || $9::jsonb,
            updated_at = NOW()
      WHERE field_id = $1`,
    [
      match.school.field_id,
      JSON.stringify(boundary.geometry),
      boundary.areaHa,
      boundary.radiusM,
      boundary.bbox.minLat,
      boundary.bbox.maxLat,
      boundary.bbox.minLng,
      boundary.bbox.maxLng,
      JSON.stringify(payload),
    ],
  );
}

function candidateReportRows(boundary: BoundaryCandidate, schools: CandidateSchool[], options: Options): MatchReportEntry["candidates"] {
  return schools.map((school) => {
    const lat = Number(school.lat);
    const lng = Number(school.lng);
    const contains = pointInGeometry(lat, lng, boundary.geometry);
    const distanceM = contains ? 0 : haversineMeters(lat, lng, boundary.center.lat, boundary.center.lng);
    const nameScore = nameDistance(boundary.name, school.name);
    const method: MatchReportEntry["candidates"][number]["method"] = contains
      ? "containment"
      : (options.allowDistanceFallback && distanceM <= options.maxDistanceM && nameScore <= 18 ? "distance_fallback" : "manual_review");
    const score = nameScore + Math.min(distanceM / 20, 80) + (contains ? -35 : 0);
    return {
      fieldId: school.field_id,
      name: school.name,
      contains,
      distanceM: Number(distanceM.toFixed(2)),
      nameScore,
      score: Number(score.toFixed(2)),
      method,
    };
  }).sort((a, b) => a.score - b.score);
}

function matchReportEntry(boundary: BoundaryCandidate, schools: CandidateSchool[], chosen: SchoolMatch | null, options: Options): MatchReportEntry {
  return {
    boundaryName: boundary.name || "",
    boundary: {
      areaHa: boundary.areaHa,
      bbox: boundary.bbox,
      radiusM: boundary.radiusM,
      sourceProperties: boundary.feature.properties,
    },
    chosen: chosen ? {
      fieldId: chosen.school.field_id,
      name: chosen.school.name,
      method: chosen.method,
      contains: chosen.contains,
      distanceM: Number(chosen.distanceM.toFixed(2)),
      nameScore: chosen.nameScore,
      score: Number(chosen.score.toFixed(2)),
      before: beforeSnapshot(chosen.school),
      proposedBoundary: proposedSchoolBoundaryPayload(boundary, chosen, options),
    } : null,
    candidates: candidateReportRows(boundary, schools, options),
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const candidates = boundaryCandidates(resolve(process.cwd(), options.file));
  let matched = 0;
  let skipped = 0;
  const report: MatchReportEntry[] = [];
  const plannedUpdates: PlannedBoundaryUpdate[] = [];
  for (const boundary of candidates.slice(0, options.limit ?? candidates.length)) {
    const schools = await candidateSchools(boundary, options);
    const chosen = chooseSchool(boundary, schools, options);
    const entry = matchReportEntry(boundary, schools, chosen, options);
    report.push(entry);
    if (!chosen) {
      skipped++;
      continue;
    }
    if (entry.chosen) {
      plannedUpdates.push({
        boundary,
        match: chosen,
        schoolBoundaryPayload: entry.chosen.proposedBoundary,
      });
    }
    matched++;
    // eslint-disable-next-line no-console
    console.log(`${options.dryRun ? "[dry-run] " : ""}${boundary.name || "(unnamed boundary)"} -> ${chosen.school.name} method=${chosen.method} score=${chosen.score.toFixed(1)} contains=${chosen.contains} distance_m=${chosen.distanceM.toFixed(1)} name_score=${chosen.nameScore}`);
  }
  if (options.reportFile) {
    writeFileSync(resolve(process.cwd(), options.reportFile), JSON.stringify({
      schemaVersion: "ikimon_school_boundary_match_report/v1",
      generatedAt: new Date().toISOString(),
      dryRun: options.dryRun,
      boundarySource: options.boundarySource,
      prefecture: options.prefecture ?? null,
      city: options.city ?? null,
      fieldIds: options.fieldIds,
      allowDistanceFallback: options.allowDistanceFallback,
      maxDistanceM: options.maxDistanceM,
      matched,
      skipped,
      entries: report,
    }, null, 2), "utf8");
  }
  if (!options.dryRun) {
    for (const planned of plannedUpdates) {
      await updateBoundary(planned.boundary, planned.match, planned.schoolBoundaryPayload);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[school-boundaries] matched=${matched} skipped=${skipped} dry_run=${options.dryRun}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
    .then(() => process.exit(0))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[school-boundaries] fatal", error);
      process.exit(1);
    });
}
