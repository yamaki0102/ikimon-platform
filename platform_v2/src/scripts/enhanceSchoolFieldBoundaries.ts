/**
 * Enrich P29 school point fields with campus polygons from OSM relation exports
 * or municipal open-data GeoJSON.
 *
 * Example:
 *   npm --prefix platform_v2 run enhance:school-boundaries -- \
 *     --file=./data/hamamatsu-school-boundaries.geojson --boundary-source=osm --prefecture=静岡県 --dry-run
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPool } from "../db.js";
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
  maxDistanceM: number;
  limit?: number;
  dryRun: boolean;
};

const EARTH_RADIUS_M = 6_371_000;

function argValue(args: string[], name: string): string | undefined {
  return args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const file = argValue(args, "file");
  if (!file) throw new Error("--file is required");
  const boundarySourceRaw = argValue(args, "boundary-source") ?? "other";
  const boundarySource = boundarySourceRaw === "osm" || boundarySourceRaw === "municipal" ? boundarySourceRaw : "other";
  const maxDistanceM = Number(argValue(args, "max-distance-m") ?? 500);
  const limitRaw = argValue(args, "limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  return {
    file,
    boundarySource,
    prefecture: argValue(args, "prefecture"),
    maxDistanceM: Number.isFinite(maxDistanceM) ? Math.max(50, Math.min(2_000, maxDistanceM)) : 500,
    limit: limit && Number.isFinite(limit) ? Math.max(1, limit) : undefined,
    dryRun: args.includes("--dry-run"),
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

function pointInGeometry(lat: number, lng: number, geometry: Geometry): boolean {
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

function nameDistance(a: string, b: string): number {
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
  const result = await getPool().query<CandidateSchool>(
    `SELECT field_id, name, lat::text AS lat, lng::text AS lng, payload
       FROM observation_fields
      WHERE ${where}
      LIMIT 50`,
    params,
  );
  return result.rows;
}

function chooseSchool(boundary: BoundaryCandidate, schools: CandidateSchool[], maxDistanceM: number): { school: CandidateSchool; score: number; contains: boolean; distanceM: number } | null {
  const scored = schools.map((school) => {
    const lat = Number(school.lat);
    const lng = Number(school.lng);
    const contains = pointInGeometry(lat, lng, boundary.geometry);
    const distanceM = contains ? 0 : haversineMeters(lat, lng, boundary.center.lat, boundary.center.lng);
    const score = nameDistance(boundary.name, school.name) + Math.min(distanceM / 20, 80) + (contains ? -35 : 0);
    return { school, score, contains, distanceM };
  }).filter((item) => item.contains || item.distanceM <= maxDistanceM)
    .sort((a, b) => a.score - b.score);
  return scored[0] ?? null;
}

async function updateBoundary(boundary: BoundaryCandidate, match: { school: CandidateSchool; score: number }, options: Options): Promise<void> {
  const payload = {
    school_boundary: {
      source: options.boundarySource,
      matched_at: new Date().toISOString(),
      matched_name: boundary.name || null,
      match_score: Number(match.score.toFixed(2)),
      properties: boundary.feature.properties ?? {},
    },
  };
  await getPool().query(
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

async function main(): Promise<void> {
  const options = parseOptions();
  const candidates = boundaryCandidates(resolve(process.cwd(), options.file));
  let matched = 0;
  let skipped = 0;
  for (const boundary of candidates.slice(0, options.limit ?? candidates.length)) {
    const schools = await candidateSchools(boundary, options);
    const chosen = chooseSchool(boundary, schools, options.maxDistanceM);
    if (!chosen) {
      skipped++;
      continue;
    }
    matched++;
    // eslint-disable-next-line no-console
    console.log(`${options.dryRun ? "[dry-run] " : ""}${boundary.name || "(unnamed boundary)"} -> ${chosen.school.name} score=${chosen.score.toFixed(1)} contains=${chosen.contains}`);
    if (!options.dryRun) {
      await updateBoundary(boundary, chosen, options);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[school-boundaries] matched=${matched} skipped=${skipped} dry_run=${options.dryRun}`);
}

void main()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[school-boundaries] fatal", error);
    process.exit(1);
  });
