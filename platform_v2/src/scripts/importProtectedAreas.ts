/**
 * 国土数値情報（国交省）の保護地域 GeoJSON を observation_fields に bulk upsert する。
 *
 * 対応データセット:
 *   A10  自然公園地域     → source='protected_area'
 *   A11  自然保全地域     → source='protected_area'
 *   A12  鳥獣保護区       → source='protected_area'
 *   A14  世界遺産地域     → source='protected_area'
 *   A15  緑地保全・緑化推進 → source='protected_area'
 *   自然共生サイト / OECM → source='oecm'
 *
 * ダウンロード手順:
 *   1. https://nlftp.mlit.go.jp/ksj/ を開く
 *   2. 「自然公園地域 (A10)」など目的のデータセットを選択
 *   3. 全国版または都道府県版の GeoJSON (.geojson または ZIP 内 .geojson) をダウンロード
 *   4. ZIP の場合は展開して .geojson ファイルを取り出す
 *   5. このスクリプトを実行
 *
 * 使い方:
 *   npx tsx src/scripts/importProtectedAreas.ts --file=<path.geojson> [options]
 *   npx tsx src/scripts/importProtectedAreas.ts --dir=<dir>            [options]
 *
 * Options:
 *   --file=<path>      単一 GeoJSON / NDJSON / JSON ファイル
 *   --dir=<dir>        ディレクトリ内の全 .geojson ファイルを処理
 *   --format=A10|A11|A12|A14|A15|auto   KSJ プロパティマップを指定 (auto=自動検出)
 *   --source=protected_area|oecm        DB の source 値 (デフォルト: protected_area)
 *   --dry-run          DB 書き込みをスキップ
 *   --limit=<n>        デバッグ用 n 件だけ処理
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, extname, basename } from "node:path";
import { upsertCertifiedField, type FieldSource } from "../services/observationFieldRegistry.js";

// --------------------------------------------------------------------------
// KSJ Property Maps
// --------------------------------------------------------------------------

interface KsjMap {
  name?: string;
  nameAlt?: string[];
  prefCode?: string;
  prefName?: string;
  typeCode?: string;
  typeName?: string;
  areaHa?: string;
  areaM2?: string;
  officialUrl?: string;
  notes?: string;
}

const KSJ_MAPS: Record<string, KsjMap> = {
  // 自然公園地域 (National/Quasi-national/Prefectural Nature Parks)
  A10: {
    typeCode: "A10_001",
    name: "A10_002",
    prefCode: "A10_003",
    areaHa: "A10_004",
  },
  // 自然保全地域
  A11: {
    typeCode: "A11_001",
    name: "A11_002",
    prefCode: "A11_003",
    areaHa: "A11_004",
  },
  // 鳥獣保護区
  A12: {
    typeCode: "A12_001",
    name: "A12_002",
    prefCode: "A12_003",
    areaHa: "A12_004",
    notes: "A12_005",
  },
  // 世界遺産地域
  A14: {
    typeCode: "A14_001",
    name: "A14_002",
    prefCode: "A14_003",
    areaHa: "A14_004",
  },
  // 緑地保全・緑化推進地域
  A15: {
    typeCode: "A15_001",
    name: "A15_002",
    prefCode: "A15_003",
    areaHa: "A15_004",
  },
  // Generic (fallback — try Japanese property names directly)
  generic: {
    nameAlt: ["名称", "name", "Name", "区域名", "地区名", "公園名", "保護区名"],
    prefName: "都道府県",
    areaHa: "面積_ha",
    areaM2: "面積_m2",
  },
};

// 都道府県コード → 名称 (JIS X 0401)
const PREF_CODE_MAP: Record<string, string> = {
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

// A10 種別コード → ラベル
const A10_TYPE: Record<string, string> = {
  "1": "国立公園", "2": "国定公園", "3": "都道府県立自然公園",
};
const A11_TYPE: Record<string, string> = {
  "1": "原生自然環境保全地域", "2": "自然環境保全地域", "3": "都道府県自然環境保全地域",
};
const A12_TYPE: Record<string, string> = {
  "1": "国指定鳥獣保護区", "2": "都道府県指定鳥獣保護区",
};
const A14_TYPE: Record<string, string> = {
  "1": "世界自然遺産", "2": "世界文化遺産", "3": "世界複合遺産",
};

const TYPE_LABELS: Record<string, Record<string, string>> = {
  A10: A10_TYPE, A11: A11_TYPE, A12: A12_TYPE, A14: A14_TYPE,
};

// --------------------------------------------------------------------------
// GeoJSON Types
// --------------------------------------------------------------------------

interface GeoGeom {
  type: string;
  coordinates: unknown;
}

interface GeoFeature {
  type: "Feature";
  geometry: GeoGeom | null;
  properties: Record<string, unknown> | null;
}

interface GeoFC {
  type: "FeatureCollection";
  features: GeoFeature[];
}

// --------------------------------------------------------------------------
// Geometry Utilities
// --------------------------------------------------------------------------

function centroid(geom: GeoGeom | null): { lat: number; lng: number } | null {
  if (!geom) return null;
  const { type, coordinates } = geom;
  if (type === "Point") {
    const [lng, lat] = coordinates as [number, number];
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
  const ring: [number, number][] =
    type === "Polygon"
      ? ((coordinates as [number, number][][])[0] ?? [])
      : type === "MultiPolygon"
      ? (((coordinates as [number, number][][][])[0] ?? [])[0] ?? [])
      : [];
  if (ring.length === 0) return null;
  let slat = 0, slng = 0, n = 0;
  for (const [lng, lat] of ring) {
    if (Number.isFinite(lat) && Number.isFinite(lng)) { slat += lat; slng += lng; n++; }
  }
  return n > 0 ? { lat: slat / n, lng: slng / n } : null;
}

function roughRadiusM(geom: GeoGeom | null, fallback = 1000): number {
  if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) return fallback;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  const visit = ([lng, lat]: [number, number]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  };
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates as [number, number][][]) for (const p of ring) visit(p);
  } else {
    for (const poly of geom.coordinates as [number, number][][][]) for (const ring of poly) for (const p of ring) visit(p);
  }
  if (!Number.isFinite(minLat)) return fallback;
  const dLat = (maxLat - minLat) * 111_000;
  const meanLat = ((maxLat + minLat) / 2) * (Math.PI / 180);
  const dLng = (maxLng - minLng) * 111_000 * Math.cos(meanLat);
  return Math.max(200, Math.min(100_000, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) / 2)));
}

function hasPolygon(geom: GeoGeom | null): boolean {
  return geom?.type === "Polygon" || geom?.type === "MultiPolygon";
}

// --------------------------------------------------------------------------
// Format Detection
// --------------------------------------------------------------------------

function detectFormat(features: GeoFeature[]): string {
  if (features.length === 0) return "generic";
  const props = features[0]?.properties ?? {};
  const keys = Object.keys(props);
  for (const fmt of ["A10", "A11", "A12", "A14", "A15"]) {
    if (keys.some((k) => k.startsWith(fmt + "_"))) return fmt;
  }
  return "generic";
}

// --------------------------------------------------------------------------
// Extract site info from a feature
// --------------------------------------------------------------------------

interface ParsedSite {
  certificationId: string;
  name: string;
  summary: string;
  prefecture: string;
  city: string;
  areaHa: number | null;
  lat: number;
  lng: number;
  radiusM: number;
  polygon: Record<string, unknown> | null;
}

function extractSite(
  feature: GeoFeature,
  fmt: string,
  idx: number,
  fileStem: string,
): ParsedSite | null {
  const props = feature.properties ?? {};
  const center = centroid(feature.geometry);
  if (!center) return null;

  const ksjMap = KSJ_MAPS[fmt] ?? KSJ_MAPS["generic"]!;

  // Name
  let name = "";
  if (ksjMap.name) name = String(props[ksjMap.name] ?? "").trim();
  if (!name && ksjMap.nameAlt) {
    for (const alt of ksjMap.nameAlt) {
      const v = String(props[alt] ?? "").trim();
      if (v) { name = v; break; }
    }
  }
  if (!name) {
    // last resort: look for any key containing "name" or "名"
    for (const [k, v] of Object.entries(props)) {
      if ((k.toLowerCase().includes("name") || k.includes("名")) && typeof v === "string" && v.trim()) {
        name = v.trim(); break;
      }
    }
  }
  if (!name) return null;

  // Prefecture
  let prefecture = "";
  if (ksjMap.prefCode) {
    const code = String(props[ksjMap.prefCode] ?? "").padStart(2, "0").slice(0, 2);
    prefecture = PREF_CODE_MAP[code] ?? "";
  }
  if (!prefecture && ksjMap.prefName) {
    prefecture = String(props[ksjMap.prefName] ?? "").trim();
  }

  // Type label → summary
  const typeLabels = TYPE_LABELS[fmt];
  let summary = "";
  if (typeLabels && ksjMap.typeCode) {
    const code = String(props[ksjMap.typeCode] ?? "");
    summary = typeLabels[code] ?? fmt;
  }
  // notes
  if (ksjMap.notes) {
    const n = String(props[ksjMap.notes] ?? "").trim();
    if (n) summary = summary ? `${summary} — ${n}` : n;
  }

  // Area
  let areaHa: number | null = null;
  if (ksjMap.areaHa) {
    const v = Number(props[ksjMap.areaHa] ?? 0);
    if (Number.isFinite(v) && v > 0) areaHa = v;
  }
  if (!areaHa && ksjMap.areaM2) {
    const v = Number(props[ksjMap.areaM2] ?? 0);
    if (Number.isFinite(v) && v > 0) areaHa = v / 10000;
  }
  // fallback: estimate from polygon
  if (!areaHa && hasPolygon(feature.geometry)) {
    const r = roughRadiusM(feature.geometry, 0);
    if (r > 0) areaHa = Math.round((Math.PI * r * r) / 10000);
  }

  const certId = `${fmt.toLowerCase()}-${fileStem}-${idx + 1}`;

  return {
    certificationId: certId,
    name,
    summary,
    prefecture,
    city: "",
    areaHa,
    lat: center.lat,
    lng: center.lng,
    radiusM: roughRadiusM(feature.geometry, areaHa ? Math.max(300, Math.round(Math.sqrt(areaHa * 10000 / Math.PI))) : 1000),
    polygon: hasPolygon(feature.geometry) ? (feature.geometry as unknown as Record<string, unknown>) : null,
  };
}

// --------------------------------------------------------------------------
// Import a single GeoJSON file
// --------------------------------------------------------------------------

async function importFile(
  filePath: string,
  source: FieldSource,
  fmt: string,
  dryRun: boolean,
  limit: number,
): Promise<{ inserted: number; skipped: number; missed: number }> {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  } catch (err) {
    console.error(`[io] cannot read ${filePath}: ${(err as Error).message}`);
    return { inserted: 0, skipped: 0, missed: 1 };
  }

  let fc: GeoFC;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type === "FeatureCollection") {
      fc = parsed as GeoFC;
    } else if (Array.isArray(parsed)) {
      fc = { type: "FeatureCollection", features: parsed as GeoFeature[] };
    } else {
      console.error(`[parse] ${filePath}: not a FeatureCollection`);
      return { inserted: 0, skipped: 0, missed: 1 };
    }
  } catch (err) {
    console.error(`[parse] ${filePath}: JSON parse error: ${(err as Error).message}`);
    return { inserted: 0, skipped: 0, missed: 1 };
  }

  const features = fc.features;
  const detectedFmt = fmt === "auto" ? detectFormat(features) : fmt;
  const fileStem = basename(filePath).replace(/\.geojson(\.json)?$/i, "").replace(/[^a-zA-Z0-9\-_]/g, "-");

  console.log(`[import] ${basename(filePath)}: ${features.length} features, format=${detectedFmt}`);

  let inserted = 0, skipped = 0, missed = 0;
  const count = Math.min(features.length, limit);

  for (let i = 0; i < count; i++) {
    const feature = features[i]!;
    const site = extractSite(feature, detectedFmt, i, fileStem);
    if (!site) { missed++; continue; }

    if (dryRun) {
      if (i < 5) console.log(`  [dry] ${site.certificationId}: ${site.name} (${site.prefecture}) ${site.lat.toFixed(4)},${site.lng.toFixed(4)}`);
      inserted++;
      continue;
    }

    try {
      await upsertCertifiedField({
        source,
        name: site.name,
        nameKana: "",
        summary: site.summary,
        prefecture: site.prefecture,
        city: site.city,
        lat: site.lat,
        lng: site.lng,
        radiusM: site.radiusM,
        polygon: site.polygon,
        areaHa: site.areaHa,
        certificationId: site.certificationId,
        officialUrl: "https://nlftp.mlit.go.jp/ksj/",
        ownerUserId: null,
        payload: {
          ksj_format: detectedFmt,
          source_file: basename(filePath),
          imported_at: new Date().toISOString(),
          raw_properties: feature.properties,
        },
      });
      inserted++;
    } catch (err) {
      console.error(`[db] ${site.certificationId}: ${(err as Error).message}`);
      skipped++;
    }

    if ((inserted + skipped) % 100 === 0 && (inserted + skipped) > 0) {
      console.log(`  progress: ${inserted + skipped}/${count} (inserted=${inserted} skipped=${skipped})`);
    }
  }

  return { inserted, skipped, missed };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

function parseArgs(): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--")) {
      const [k, ...rest] = a.slice(2).split("=");
      result[k!] = rest.length > 0 ? rest.join("=") : true;
    }
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const filePath = typeof args["file"] === "string" ? resolve(process.cwd(), args["file"]) : null;
  const dirPath = typeof args["dir"] === "string" ? resolve(process.cwd(), args["dir"]) : null;
  const fmtArg = typeof args["format"] === "string" ? args["format"] : "auto";
  const sourceArg = typeof args["source"] === "string" ? args["source"] : "protected_area";
  const dryRun = Boolean(args["dry-run"]);
  const limit = typeof args["limit"] === "string" ? parseInt(args["limit"], 10) : Infinity;

  if (!filePath && !dirPath) {
    console.log(`
importProtectedAreas — 国土数値情報 GeoJSON 保護地域インポーター

使い方:
  npx tsx src/scripts/importProtectedAreas.ts --file=<path.geojson>
  npx tsx src/scripts/importProtectedAreas.ts --dir=<dir_with_geojson_files>

ダウンロード手順:
  1. https://nlftp.mlit.go.jp/ksj/ を開く
  2. 「自然公園地域 (A10)」「自然保全地域 (A11)」「鳥獣保護区 (A12)」などを選択
  3. 全国版 GeoJSON をダウンロード（ZIP の場合は展開）
  4. このスクリプトを実行:
       npm run import:protected-areas -- --file=A10-16_GML.geojson
       npm run import:protected-areas -- --dir=./ksj_data/

対応 KSJ フォーマット: A10, A11, A12, A14, A15, auto（自動検出）
source オプション: protected_area（デフォルト）, oecm
`);
    process.exit(0);
  }

  const source = (["protected_area", "oecm"] as FieldSource[]).includes(sourceArg as FieldSource)
    ? (sourceArg as FieldSource)
    : "protected_area";

  const files: string[] = [];
  if (filePath) {
    files.push(filePath);
  } else if (dirPath) {
    const entries = readdirSync(dirPath);
    for (const e of entries) {
      if (/\.geojson(\.json)?$/i.test(e)) files.push(resolve(dirPath, e));
    }
    if (files.length === 0) {
      console.error(`[dir] no .geojson files found in ${dirPath}`);
      process.exit(1);
    }
    console.log(`[dir] found ${files.length} .geojson files`);
  }

  let totalInserted = 0, totalSkipped = 0, totalMissed = 0;
  for (const f of files) {
    const r = await importFile(f, source, fmtArg, dryRun, limit);
    totalInserted += r.inserted;
    totalSkipped += r.skipped;
    totalMissed += r.missed;
  }

  console.log(`\n[done] inserted=${totalInserted} skipped=${totalSkipped} missed=${totalMissed}`);
  if (dryRun) console.log("[dry-run] nothing written to DB");
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[fatal]", err);
    process.exit(1);
  });
