import { readFileSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { entityKeyFromGeoProperties } from "../services/observationFieldIdentity.js";
import { upsertCertifiedField, type FieldSource } from "../services/observationFieldRegistry.js";
import {
  ensureFieldVerificationIssuer,
  importedFieldVerificationSummary,
  recordFieldVerificationClaim,
} from "../services/fieldVerification.js";

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
  owner_url?: string;
  story_url?: string;
  certification_url?: string;
  source_confidence?: number;
  polygon?: Record<string, unknown>;
  entity_key?: string;
  payload?: Record<string, unknown>;
}

interface SeedFile {
  _note?: string;
  _source_url?: string;
  sites: SeedSite[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));

type ImportOptions = {
  prefecture?: string;
  prefectureCode?: string;
  certificationId?: string;
  limit?: number;
  dryRun?: boolean;
};

const JIS_PREFECTURE_NAMES: Record<string, string> = {
  "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県", "05": "秋田県",
  "06": "山形県", "07": "福島県", "08": "茨城県", "09": "栃木県", "10": "群馬県",
  "11": "埼玉県", "12": "千葉県", "13": "東京都", "14": "神奈川県", "15": "新潟県",
  "16": "富山県", "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県",
  "21": "岐阜県", "22": "静岡県", "23": "愛知県", "24": "三重県", "25": "滋賀県",
  "26": "京都府", "27": "大阪府", "28": "兵庫県", "29": "奈良県", "30": "和歌山県",
  "31": "鳥取県", "32": "島根県", "33": "岡山県", "34": "広島県", "35": "山口県",
  "36": "徳島県", "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県",
  "41": "佐賀県", "42": "長崎県", "43": "熊本県", "44": "大分県", "45": "宮崎県",
  "46": "鹿児島県", "47": "沖縄県",
};

const P29_DATASET_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P29-2023.html";
const P29_POINT_SCHOOL_RADIUS_M = 160;

function prefectureNameFromCode(code: string): string {
  return JIS_PREFECTURE_NAMES[code.slice(0, 2)] ?? "";
}

function schoolSeedMatchesOptions(site: SeedSite, options: ImportOptions): boolean {
  const adminAreaCode = String(site.payload?.admin_area_code ?? "").trim();
  const prefCode = String(options.prefectureCode ?? "").trim();
  if (prefCode && !adminAreaCode.startsWith(prefCode)) return false;
  const prefecture = String(options.prefecture ?? "").trim();
  if (prefecture && site.prefecture !== prefecture) return false;
  return true;
}

function parseOptions(args: string[]): ImportOptions {
  const get = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  const limitRaw = get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  return {
    prefecture: get("prefecture"),
    prefectureCode: get("prefecture-code"),
    certificationId: get("certification-id"),
    limit: limit && Number.isFinite(limit) ? Math.max(1, limit) : undefined,
    dryRun: args.includes("--dry-run"),
  };
}

function parseOptionalNumber(value: string | undefined | null): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

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
      owner_url: get("owner_url"),
      story_url: get("story_url"),
      certification_url: get("certification_url"),
      source_confidence: parseOptionalNumber(get("source_confidence")),
      entity_key: get("entity_key") || (source === "school" && certificationId ? `mext_school:${certificationId.replace(/^mext-school:/, "")}` : undefined),
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

function circlePolygonAroundCenter(center: { lat: number; lng: number }, radiusMeters: number, steps = 28): Record<string, unknown> {
  const latRad = center.lat * Math.PI / 180;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = Math.max(1, 111_320 * Math.cos(latRad));
  const ring: number[][] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (2 * Math.PI * i) / steps;
    const lng = center.lng + (Math.cos(angle) * radiusMeters) / metersPerDegreeLng;
    const lat = center.lat + (Math.sin(angle) * radiusMeters) / metersPerDegreeLat;
    ring.push([Number(lng.toFixed(7)), Number(lat.toFixed(7))]);
  }
  ring.push(ring[0]!.slice());
  return { type: "Polygon", coordinates: [ring] };
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
    const getProp = (...keys: string[]): string => {
      for (const key of keys) {
        const value = String((props as Record<string, unknown>)[key] ?? "").trim();
        if (value) return value;
      }
      return "";
    };
    const schoolCode = getProp("school_code", "SchoolCode", "SchoolCode ", "学校コード", "P29_002");
    const schoolTypeCode = getProp("school_type_code", "SchooltypeCode", "SchooltypeCode ", "学校分類コード", "P29_003");
    const adminAreaCode = getProp("admin_area_code", "AdministrativeAreaCode", "行政区域コード", "P29_001");
    const address = getProp("address", "所在地", "P29_005");
    const entityKey = getProp("entity_key") || entityKeyFromGeoProperties(props) || (schoolCode ? `mext_school:${schoolCode}` : "");
    const certId = String(
      getProp("certification_id", "id") ||
        (schoolCode ? `mext-school:${schoolCode}` : `${source}-geojson-${i + 1}`),
    );
    const name = getProp("name", "title", "名称", "P29_004");
    if (!name) return;
    const isSchoolPoint = source === "school" && feature.geometry?.type === "Point" && Boolean(schoolCode);
    const polygon = feature.geometry && (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")
      ? (feature.geometry as unknown as Record<string, unknown>)
      : isSchoolPoint
        ? circlePolygonAroundCenter(center, P29_POINT_SCHOOL_RADIUS_M)
        : undefined;
    out.push({
      certification_id: certId,
      name,
      name_kana: String((props as Record<string, unknown>).name_kana ?? ""),
      prefecture: getProp("prefecture", "pref", "都道府県") || prefectureNameFromCode(adminAreaCode),
      city: getProp("city", "municipality", "市区町村"),
      lat: center.lat,
      lng: center.lng,
      radius_m: geometryRoughRadiusMeters(feature.geometry, isSchoolPoint ? P29_POINT_SCHOOL_RADIUS_M : 1000),
      area_ha: Number((props as Record<string, unknown>).area_ha ?? 0) || undefined,
      summary: String((props as Record<string, unknown>).summary ?? (props as Record<string, unknown>).description ?? (schoolTypeCode ? `学校分類コード: ${schoolTypeCode}` : "")),
      official_url: String((props as Record<string, unknown>).official_url ?? (props as Record<string, unknown>).url ?? ""),
      owner_url: String((props as Record<string, unknown>).owner_url ?? ""),
      story_url: String((props as Record<string, unknown>).story_url ?? ""),
      certification_url: String((props as Record<string, unknown>).certification_url ?? (source === "school" && schoolCode ? P29_DATASET_URL : "")),
      source_confidence: parseOptionalNumber(String((props as Record<string, unknown>).source_confidence ?? "")),
      entity_key: entityKey || undefined,
      payload: {
        raw_properties: props,
        ...(adminAreaCode ? { admin_area_code: adminAreaCode } : {}),
        ...(schoolCode ? { school_code: schoolCode } : {}),
        ...(schoolTypeCode ? { school_type_code: schoolTypeCode } : {}),
        ...(address ? { address } : {}),
        ...(source === "school" && schoolCode ? { registry_source: "mlit_ksj_p29", registry_source_url: P29_DATASET_URL } : {}),
        ...(isSchoolPoint ? {
          boundary_approximation: "point_buffer",
          boundary_radius_m: P29_POINT_SCHOOL_RADIUS_M,
          boundary_note: "P29 point data fallback; replace with official or OSM campus polygon when available",
        } : {}),
      },
      polygon,
    });
  });
  return out;
}

async function importSeed(filePath: string, source: FieldSource, options: ImportOptions = {}): Promise<{ inserted: number; skipped: number }> {
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
      sites = data.sites.map((site) => ({
        ...site,
        certification_url: site.certification_url ?? (source === "nature_symbiosis_site" ? data._source_url : undefined),
      }));
    } else if ((data as unknown as GeoJsonFeatureCollection).type === "FeatureCollection") {
      sites = importGeoJson(filePath, source);
    } else {
      throw new Error(`bad seed: ${filePath}`);
    }
  }
  if (source === "school" && (options.prefecture || options.prefectureCode)) {
    sites = sites.filter((site) => schoolSeedMatchesOptions(site, options));
  }
  if (options.certificationId) {
    sites = sites.filter((site) => site.certification_id === options.certificationId);
  }
  if (options.limit) {
    sites = sites.slice(0, options.limit);
  }
  if (options.dryRun) {
    // eslint-disable-next-line no-console
    console.log(`[${source}] dry_run=true candidates=${sites.length} file=${filePath}`);
    for (const site of sites.slice(0, 12)) {
      // eslint-disable-next-line no-console
      console.log(`- ${site.certification_id} ${site.name} ${site.prefecture || ""} ${site.city || ""} ${site.lat},${site.lng}`);
    }
    return { inserted: 0, skipped: 0 };
  }
  let inserted = 0;
  let skipped = 0;
  const registryIssuerId = source === "school"
    ? await ensureFieldVerificationIssuer({
      issuerKey: "mlit_ksj_p29_2023",
      issuerKind: "government_agency",
      name: "国土交通省 国土数値情報 学校データ",
      websiteUrl: P29_DATASET_URL,
      verifiedDomain: "mlit.go.jp",
      payload: {
        dataset: "P29",
        dataset_year: 2023,
        mext_school_code_source: "文部科学省 学校コード一覧",
        source_url: P29_DATASET_URL,
      },
    })
    : null;
  for (const site of sites) {
    if (!site.name || !Number.isFinite(site.lat) || !Number.isFinite(site.lng)) {
      skipped++;
      continue;
    }
    try {
      const field = await upsertCertifiedField({
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
        ownerUrl: site.owner_url ?? "",
        storyUrl: site.story_url ?? "",
        certificationUrl: site.certification_url ?? "",
        sourceConfidence: site.source_confidence ?? null,
        ownerUserId: null,
        entityKey: site.entity_key,
        payload: { ...(site.payload ?? {}), import_source: filePath, imported_at: new Date().toISOString() },
      });
      const verification = importedFieldVerificationSummary({
        source,
        adminLevel: source === "school" ? "school" : null,
        entityKey: site.entity_key,
        certificationId: site.certification_id,
        certificationUrl: site.certification_url,
      });
      if (verification && verification.level !== "unverified") {
        await recordFieldVerificationClaim({
          fieldId: field.fieldId,
          issuerId: registryIssuerId,
          verificationLevel: verification.level,
          verificationMethod: verification.method || "public_registry",
          status: "verified",
          evidenceUrl: site.certification_url ?? site.official_url ?? (source === "school" ? P29_DATASET_URL : ""),
          evidenceDomain: "",
          label: verification.label,
          payload: { import_source: filePath, source, issuer_key: registryIssuerId ? "mlit_ksj_p29_2023" : undefined },
        });
      }
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
  const options = parseOptions(args);
  const overrideSource = (["nature_symbiosis_site", "tsunag", "protected_area", "oecm", "school"] as FieldSource[])
    .find((s) => s === overrideSourceRaw);

  if (overrideFile && overrideSource) {
    const result = await importSeed(resolve(process.cwd(), overrideFile), overrideSource, options);
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
