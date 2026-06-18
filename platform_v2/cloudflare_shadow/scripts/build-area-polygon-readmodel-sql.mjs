import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";

const defaultInput = "E:/Projects/_agent_scratch/ikimon-platform/field-detail-readmodel-source-20260617/observation_fields_data.sql";
const defaultOutput = "E:/Projects/_agent_scratch/ikimon-platform/field-detail-readmodel-source-20260617/area_polygon_public_readmodel.d1.sql";

const inputPath = resolve(process.argv[2] ?? defaultInput);
const outputPath = resolve(process.argv[3] ?? defaultOutput);
const batchSize = Number.parseInt(process.env.IKIMON_AREA_POLYGON_SQL_BATCH_SIZE ?? "250", 10);
const maxRows = Number.parseInt(process.env.IKIMON_AREA_POLYGON_SQL_MAX_ROWS ?? "0", 10);
const maxGeometryChars = Number.parseInt(process.env.IKIMON_AREA_POLYGON_SQL_MAX_GEOMETRY_CHARS ?? "300000", 10);
const sourceFilter = new Set((process.env.IKIMON_AREA_POLYGON_SQL_SOURCES ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean));

if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
  throw new Error("IKIMON_AREA_POLYGON_SQL_BATCH_SIZE must be an integer from 1 to 1000.");
}
if (!Number.isInteger(maxGeometryChars) || maxGeometryChars < 10000 || maxGeometryChars > 900000) {
  throw new Error("IKIMON_AREA_POLYGON_SQL_MAX_GEOMETRY_CHARS must be an integer from 10000 to 900000.");
}

await mkdir(dirname(outputPath), { recursive: true });

function copyValue(value) {
  if (value === "\\N") return null;
  let out = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      out += char;
      continue;
    }
    if (index + 1 >= value.length) {
      out += char;
      continue;
    }
    index += 1;
    const next = value[index];
    if (next === "b") out += "\b";
    else if (next === "f") out += "\f";
    else if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "v") out += "\v";
    else out += next;
  }
  return out;
}

function numberOrNull(value) {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  return value == null ? "" : String(value);
}

function cleanUrl(value) {
  const raw = text(value).trim();
  return /^https?:\/\//.test(raw) ? raw : "";
}

function sqlValue(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseJsonObject(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function walkCoordinates(value, visit) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    visit(value[0], value[1]);
    return;
  }
  for (const item of value) walkCoordinates(item, visit);
}

function computeBbox(geometry) {
  if (!geometry || typeof geometry !== "object") return null;
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
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) return null;
  return { minLng, minLat, maxLng, maxLat };
}

function simplifyRing(points, maxPoints) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;
  const closed = points.length > 2 && JSON.stringify(points[0]) === JSON.stringify(points.at(-1));
  const source = closed ? points.slice(0, -1) : points;
  if (source.length <= maxPoints) return points;
  const keep = Math.max(4, maxPoints - (closed ? 1 : 0));
  const simplified = [];
  let lastIndex = -1;
  for (let index = 0; index < keep; index += 1) {
    const sourceIndex = Math.min(source.length - 1, Math.round(index * (source.length - 1) / Math.max(1, keep - 1)));
    if (sourceIndex !== lastIndex) {
      simplified.push(source[sourceIndex]);
      lastIndex = sourceIndex;
    }
  }
  if (closed) simplified.push(simplified[0]);
  return simplified;
}

function simplifyGeometryCoordinates(geometry, maxRingPoints) {
  if (!geometry || typeof geometry !== "object") return geometry;
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: Array.isArray(geometry.coordinates)
        ? geometry.coordinates.map((ring) => simplifyRing(ring, maxRingPoints))
        : geometry.coordinates
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: Array.isArray(geometry.coordinates)
        ? geometry.coordinates.map((polygon) => Array.isArray(polygon)
          ? polygon.map((ring) => simplifyRing(ring, maxRingPoints))
          : polygon)
        : geometry.coordinates
    };
  }
  return geometry;
}

function geometryForSql(geometry) {
  let geometryJson = JSON.stringify(geometry);
  if (geometryJson.length <= maxGeometryChars) return { geometry, geometryJson, simplified: false };
  let maxRingPoints = 4096;
  let simplified = geometry;
  while (geometryJson.length > maxGeometryChars && maxRingPoints >= 32) {
    simplified = simplifyGeometryCoordinates(geometry, maxRingPoints);
    geometryJson = JSON.stringify(simplified);
    maxRingPoints = Math.floor(maxRingPoints / 2);
  }
  return { geometry: simplified, geometryJson, simplified: true };
}

function normalizeLayerSource(source, adminLevel) {
  const admin = text(adminLevel);
  if (["osm_park", "admin_municipality", "admin_prefecture", "admin_country"].includes(admin)) return admin;
  return text(source) || "user_defined";
}

function isApproximateBoundary(source, payload) {
  if (normalizeLayerSource(source, payload?.admin_level) !== "school" && text(source) !== "school") return false;
  return payload?.boundary_approximation === "point_buffer";
}

function rowToInsert(row) {
  const payload = parseJsonObject(row.payload);
  const polygon = parseJsonObject(row.geom_simplified) ?? parseJsonObject(row.polygon);
  if (!polygon) return null;
  const bbox = {
    minLat: numberOrNull(row.bbox_min_lat),
    maxLat: numberOrNull(row.bbox_max_lat),
    minLng: numberOrNull(row.bbox_min_lng),
    maxLng: numberOrNull(row.bbox_max_lng)
  };
  const sqlGeometry = geometryForSql(polygon);
  const computed = computeBbox(sqlGeometry.geometry) ?? computeBbox(polygon);
  const minLat = bbox.minLat ?? computed?.minLat;
  const maxLat = bbox.maxLat ?? computed?.maxLat;
  const minLng = bbox.minLng ?? computed?.minLng;
  const maxLng = bbox.maxLng ?? computed?.maxLng;
  const centerLat = numberOrNull(row.lat);
  const centerLng = numberOrNull(row.lng);
  if ([minLat, maxLat, minLng, maxLng, centerLat, centerLng].some((value) => value == null)) return null;
  if (row.valid_to) return null;

  const layerSource = normalizeLayerSource(row.source, row.admin_level);
  if (sourceFilter.size > 0 && !sourceFilter.has(layerSource)) return null;
  const approximate = isApproximateBoundary(layerSource, { ...payload, admin_level: row.admin_level });
  const verificationLabel = text(row.verification_label);
  const approximateLabel = "境界未確認・代表点からの仮範囲";
  const simplifiedLabel = "表示用に境界点を軽量化";
  const labelParts = [];
  if (approximate && !verificationLabel.includes(approximateLabel)) labelParts.push(approximateLabel);
  if (sqlGeometry.simplified && !verificationLabel.includes(simplifiedLabel)) labelParts.push(simplifiedLabel);
  if (verificationLabel) labelParts.push(verificationLabel);
  const label = labelParts.join(" / ");

  const columns = [
    "field_id",
    "source",
    "admin_level",
    "name",
    "prefecture",
    "city",
    "center_lat",
    "center_lng",
    "bbox_min_lat",
    "bbox_max_lat",
    "bbox_min_lng",
    "bbox_max_lng",
    "area_ha",
    "geometry_json",
    "approximate_boundary",
    "boundary_approximation",
    "source_confidence",
    "verification_level",
    "verification_label",
    "official_url",
    "owner_url",
    "story_url",
    "certification_url",
    "entity_key",
    "updated_at"
  ];
  const values = [
    row.field_id,
    layerSource,
    row.admin_level,
    row.name,
    row.prefecture,
    row.city,
    centerLat,
    centerLng,
    minLat,
    maxLat,
    minLng,
    maxLng,
    numberOrNull(row.area_ha),
    sqlGeometry.geometryJson,
    approximate ? 1 : 0,
    approximate ? "point_buffer" : (sqlGeometry.simplified ? "display_simplified" : ""),
    numberOrNull(row.source_confidence),
    row.verification_level,
    label,
    cleanUrl(row.official_url),
    cleanUrl(row.owner_url),
    cleanUrl(row.story_url),
    cleanUrl(row.certification_url),
    row.entity_key,
    row.updated_at
  ];
  return `INSERT OR REPLACE INTO production_import_area_polygon_readmodel (${columns.join(", ")}) VALUES (${values.map(sqlValue).join(", ")});\n`;
}

const writer = createWriteStream(outputPath, { encoding: "utf8" });
writer.write("PRAGMA foreign_keys=OFF;\n");
writer.write("CREATE TABLE IF NOT EXISTS production_import_area_polygon_readmodel (\n");
writer.write("  field_id TEXT PRIMARY KEY,\n");
writer.write("  source TEXT NOT NULL,\n");
writer.write("  admin_level TEXT,\n");
writer.write("  name TEXT NOT NULL,\n");
writer.write("  prefecture TEXT,\n");
writer.write("  city TEXT,\n");
writer.write("  center_lat REAL NOT NULL,\n");
writer.write("  center_lng REAL NOT NULL,\n");
writer.write("  bbox_min_lat REAL NOT NULL,\n");
writer.write("  bbox_max_lat REAL NOT NULL,\n");
writer.write("  bbox_min_lng REAL NOT NULL,\n");
writer.write("  bbox_max_lng REAL NOT NULL,\n");
writer.write("  area_ha REAL,\n");
writer.write("  geometry_json TEXT NOT NULL,\n");
writer.write("  approximate_boundary INTEGER NOT NULL DEFAULT 0,\n");
writer.write("  boundary_approximation TEXT,\n");
writer.write("  source_confidence REAL,\n");
writer.write("  verification_level TEXT,\n");
writer.write("  verification_label TEXT,\n");
writer.write("  official_url TEXT,\n");
writer.write("  owner_url TEXT,\n");
writer.write("  story_url TEXT,\n");
writer.write("  certification_url TEXT,\n");
writer.write("  entity_key TEXT,\n");
writer.write("  updated_at TEXT\n");
writer.write(");\n");

const reader = createInterface({
  input: createReadStream(inputPath, { encoding: "utf8" }),
  crlfDelay: Infinity
});

let inCopy = false;
let columns = [];
let lineNumber = 0;
let emitted = 0;
let scanned = 0;
let batch = 0;
const sourceCounts = new Map();

function begin() {
  if (batch === 0) writer.write("BEGIN TRANSACTION;\n");
}

function commit(force = false) {
  if (batch > 0 && (force || batch >= batchSize)) {
    writer.write("COMMIT;\n");
    batch = 0;
  }
}

for await (const line of reader) {
  lineNumber += 1;
  if (!inCopy) {
    const match = line.match(/^COPY public\.observation_fields \((?<cols>.+)\) FROM stdin;$/);
    if (match?.groups?.cols) {
      columns = match.groups.cols.split(/,\s*/);
      inCopy = true;
    }
    continue;
  }
  if (line === "\\.") break;
  if (!line.trim()) continue;

  const values = line.split("\t");
  if (values.length !== columns.length) {
    throw new Error(`COPY row column mismatch at line ${lineNumber}: values=${values.length}, columns=${columns.length}`);
  }
  const row = {};
  for (let index = 0; index < columns.length; index += 1) row[columns[index]] = copyValue(values[index]);
  scanned += 1;
  const insert = rowToInsert(row);
  if (!insert) continue;
  begin();
  writer.write(insert);
  batch += 1;
  emitted += 1;
  const source = normalizeLayerSource(row.source, row.admin_level);
  sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  commit();
  if (maxRows > 0 && emitted >= maxRows) break;
}
commit(true);
writer.write("CREATE INDEX IF NOT EXISTS idx_production_area_polygon_bbox ON production_import_area_polygon_readmodel (bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng);\n");
writer.write("CREATE INDEX IF NOT EXISTS idx_production_area_polygon_layer_bbox ON production_import_area_polygon_readmodel (source, admin_level, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng);\n");
writer.end();
await new Promise((resolve, reject) => {
  writer.on("finish", resolve);
  writer.on("error", reject);
});

console.log(JSON.stringify({
  ok: true,
  inputPath,
  outputPath,
  scanned,
  rows: emitted,
  sourceFilter: [...sourceFilter].sort(),
  maxGeometryChars,
  sourceCounts: Object.fromEntries([...sourceCounts.entries()].sort())
}, null, 2));
