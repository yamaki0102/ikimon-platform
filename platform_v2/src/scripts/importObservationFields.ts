import { readFileSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertCertifiedField, type FieldSource } from "../services/observationFieldRegistry.js";

interface SeedSite {
  certification_id: string;
  name: string;
  name_kana?: string;
  prefecture?: string;
  city?: string;
  lat: number;
  lng: number;
  radius_m?: number;
  area_ha?: number;
  summary?: string;
  official_url?: string;
  polygon?: Record<string, unknown>;
}

interface SeedFile {
  _note?: string;
  _source_url?: string;
  sites: SeedSite[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseCsvRow(line: string): string[] {
  // Lightweight CSV parser supporting double-quoted fields with embedded commas
  // and escaped double quotes ("").
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charCodeAt(i);
    if (inQuotes) {
      if (ch === 34 /* " */) {
        if (line.charCodeAt(i + 1) === 34) { cur += '"'; i++; continue; }
        inQuotes = false;
        continue;
      }
      cur += line[i];
      continue;
    }
    if (ch === 34 /* " */) { inQuotes = true; continue; }
    if (ch === 44 /* , */) { out.push(cur); cur = ""; continue; }
    cur += line[i];
  }
  out.push(cur);
  return out.map((cell) => cell.trim());
}

function importCsv(filePath: string, source: FieldSource): SeedSite[] {
  const raw = readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvRow(lines[0]!).map((h) => h.toLowerCase());
  const idx = (name: string): number => header.indexOf(name);
  const out: SeedSite[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]!);
    const get = (key: string): string => {
      const j = idx(key);
      return j >= 0 ? (cells[j] ?? "") : "";
    };
    const lat = Number(get("lat") || get("latitude"));
    const lng = Number(get("lng") || get("longitude") || get("lon"));
    const certificationId = get("certification_id") || get("id") || `${source}-csv-${i}`;
    const name = get("name");
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      certification_id: certificationId,
      name,
      name_kana: get("name_kana") || get("kana"),
      prefecture: get("prefecture") || get("pref"),
      city: get("city") || get("municipality"),
      lat,
      lng,
      radius_m: Number(get("radius_m")) || undefined,
      area_ha: Number(get("area_ha")) || undefined,
      summary: get("summary") || get("description"),
      official_url: get("official_url") || get("url"),
    });
  }
  return out;
}

interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}
interface GeoJsonFeature {
  type: "Feature";
  geometry: GeoJsonGeometry | null;
  properties?: Record<string, unknown> | null;
}
interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

function centroidOfPolygonRing(ring: number[][]): { lat: number; lng: number } | null {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let lat = 0, lng = 0, count = 0;
  for (const point of ring) {
    if (Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])) {
      lng += point[0] as number;
      lat += point[1] as number;
      count++;
    }
  }
  return count > 0 ? { lat: lat / count, lng: lng / count } : null;
}

function geometryToCenter(geom: GeoJsonGeometry | null): { lat: number; lng: number } | null {
  if (!geom) return null;
  if (geom.type === "Point" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const [lng, lat] = geom.coordinates as [number, number];
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  if (geom.type === "Polygon" && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
    return centroidOfPolygonRing((geom.coordinates as number[][][])[0]!);
  }
  if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
    const first = (geom.coordinates as number[][][][])[0];
    if (first && first.length > 0) return centroidOfPolygonRing(first[0]!);
  }
  return null;
}

function geometryRoughRadiusMeters(geom: GeoJsonGeometry | null, fallback = 1000): number {
  if (!geom) return fallback;
  if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return fallback;
  // 概算: bbox 対角を半径として使う
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  const visit = (point: number[]) => {
    if (Array.isArray(point) && point.length >= 2) {
      const [lng, lat] = point as [number, number];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  };
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates as number[][][]) for (const p of ring) visit(p);
  } else {
    for (const poly of geom.coordinates as number[][][][]) for (const ring of poly) for (const p of ring) visit(p);
  }
  if (!Number.isFinite(minLat)) return fallback;
  const dLat = (maxLat - minLat) * 111_000;
  const meanLat = ((maxLat + minLat) / 2) * Math.PI / 180;
  const dLng = (maxLng - minLng) * 111_000 * Math.cos(meanLat);
  return Math.max(200, Math.min(50_000, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) / 2)));
}

function importGeoJson(filePath: string, source: FieldSource): SeedSite[] {
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as GeoJsonFeatureCollection;
  if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) return [];
  const out: SeedSite[] = [];
  data.features.forEach((feature, i) => {
    const props = feature.properties ?? {};
    const center = geometryToCenter(feature.geometry);
    if (!center) return;
    const certId = String(
      (props as Record<string, unknown>).certification_id ??
        (props as Record<string, unknown>).id ??
        `${source}-geojson-${i + 1}`,
    );
    const name = String((props as Record<string, unknown>).name ?? (props as Record<string, unknown>).title ?? "");
    if (!name) return;
    out.push({
      certification_id: certId,
      name,
      name_kana: String((props as Record<string, unknown>).name_kana ?? ""),
      prefecture: String((props as Record<string, unknown>).prefecture ?? (props as Record<string, unknown>).pref ?? ""),
      city: String((props as Record<string, unknown>).city ?? (props as Record<string, unknown>).municipality ?? ""),
      lat: center.lat,
      lng: center.lng,
      radius_m: geometryRoughRadiusMeters(feature.geometry),
      area_ha: Number((props as Record<string, unknown>).area_ha ?? 0) || undefined,
      summary: String((props as Record<string, unknown>).summary ?? (props as Record<string, unknown>).description ?? ""),
      official_url: String((props as Record<string, unknown>).official_url ?? (props as Record<string, unknown>).url ?? ""),
      polygon: feature.geometry && (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")
        ? (feature.geometry as unknown as Record<string, unknown>)
        : undefined,
    });
  });
  return out;
}

async function importSeed(filePath: string, source: FieldSource): Promise<{ inserted: number; skipped: number }> {
  const ext = extname(filePath).toLowerCase();
  let sites: SeedSite[];
  if (ext === ".csv") {
    sites = importCsv(filePath, source);
  } else if (ext === ".geojson" || filePath.endsWith(".geojson.json")) {
    sites = importGeoJson(filePath, source);
  } else {
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as SeedFile;
    if (Array.isArray(data.sites)) {
      sites = data.sites;
    } else if ((data as unknown as GeoJsonFeatureCollection).type === "FeatureCollection") {
      sites = importGeoJson(filePath, source);
    } else {
      throw new Error(`bad seed: ${filePath}`);
    }
  }
  let inserted = 0;
  let skipped = 0;
  for (const site of sites) {
    if (!site.name || !Number.isFinite(site.lat) || !Number.isFinite(site.lng)) {
      skipped++;
      continue;
    }
    try {
      await upsertCertifiedField({
        source,
        name: site.name,
        nameKana: site.name_kana ?? "",
        summary: site.summary ?? "",
        prefecture: site.prefecture ?? "",
        city: site.city ?? "",
        lat: site.lat,
        lng: site.lng,
        radiusM: site.radius_m ?? 1000,
        polygon: site.polygon ?? null,
        areaHa: site.area_ha ?? null,
        certificationId: site.certification_id,
        officialUrl: site.official_url ?? "",
        ownerUserId: null,
        payload: { import_source: filePath, imported_at: new Date().toISOString() },
      });
      inserted++;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[import-fields] failed: ${site.certification_id}`, err);
      skipped++;
    }
  }
  return { inserted, skipped };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const overrideFile = args.find((a) => a.startsWith("--file="))?.split("=")[1];
  const overrideSourceRaw = args.find((a) => a.startsWith("--source="))?.split("=")[1];
  const overrideSource = (["nature_symbiosis_site", "tsunag", "protected_area", "oecm"] as FieldSource[])
    .find((s) => s === overrideSourceRaw);

  if (overrideFile && overrideSource) {
    const result = await importSeed(resolve(process.cwd(), overrideFile), overrideSource);
    // eslint-disable-next-line no-console
    console.log(`[${overrideSource}] inserted=${result.inserted} skipped=${result.skipped}`);
    return;
  }

  const targets: Array<{ file: string; source: FieldSource }> = [
    { file: resolve(__dirname, "data", "nature_symbiosis_sites.seed.json"), source: "nature_symbiosis_site" },
    { file: resolve(__dirname, "data", "tsunag_sites.seed.json"), source: "tsunag" },
  ];

  for (const target of targets) {
    const result = await importSeed(target.file, target.source);
    // eslint-disable-next-line no-console
    console.log(`[${target.source}] inserted=${result.inserted} skipped=${result.skipped}`);
  }
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[import-fields] fatal", err);
    process.exit(1);
  });
