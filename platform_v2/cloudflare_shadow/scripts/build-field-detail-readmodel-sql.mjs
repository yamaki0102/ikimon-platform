import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";

const defaultInput = "E:/Projects/_agent_scratch/ikimon-platform/field-detail-readmodel-source-20260617/field_detail_public_readmodel.ndjson";
const defaultOutput = "E:/Projects/_agent_scratch/ikimon-platform/field-detail-readmodel-source-20260617/field_detail_public_readmodel.d1.sql";

const inputPath = resolve(process.argv[2] ?? defaultInput);
const outputPath = resolve(process.argv[3] ?? defaultOutput);
const batchSize = Number.parseInt(process.env.IKIMON_FIELD_DETAIL_SQL_BATCH_SIZE ?? "500", 10);
const useTransactions = process.env.IKIMON_FIELD_DETAIL_SQL_TRANSACTIONS === "1";

if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 2000) {
  throw new Error("IKIMON_FIELD_DETAIL_SQL_BATCH_SIZE must be an integer from 1 to 2000.");
}

const columns = [
  "field_id",
  "source",
  "admin_level",
  "name",
  "name_kana",
  "summary",
  "prefecture",
  "city",
  "public_cell",
  "public_lat",
  "public_lng",
  "radius_m",
  "area_ha",
  "has_polygon",
  "has_simplified_geometry",
  "certification_id",
  "certification_url",
  "official_url",
  "owner_url",
  "story_url",
  "verification_level",
  "verification_method",
  "verification_label",
  "source_confidence",
  "valid_from",
  "valid_to",
  "entity_key",
  "updated_at"
];

await mkdir(dirname(outputPath), { recursive: true });

const writer = createWriteStream(outputPath, { encoding: "utf8" });
writer.write("PRAGMA foreign_keys=OFF;\n");
writer.write("CREATE TABLE IF NOT EXISTS production_import_field_detail_readmodel (\n");
writer.write("  field_id TEXT PRIMARY KEY,\n");
writer.write("  source TEXT NOT NULL,\n");
writer.write("  admin_level TEXT,\n");
writer.write("  name TEXT NOT NULL,\n");
writer.write("  name_kana TEXT,\n");
writer.write("  summary TEXT,\n");
writer.write("  prefecture TEXT,\n");
writer.write("  city TEXT,\n");
writer.write("  public_cell TEXT NOT NULL,\n");
writer.write("  public_lat REAL NOT NULL,\n");
writer.write("  public_lng REAL NOT NULL,\n");
writer.write("  radius_m INTEGER,\n");
writer.write("  area_ha REAL,\n");
writer.write("  has_polygon INTEGER NOT NULL DEFAULT 0,\n");
writer.write("  has_simplified_geometry INTEGER NOT NULL DEFAULT 0,\n");
writer.write("  certification_id TEXT,\n");
writer.write("  certification_url TEXT,\n");
writer.write("  official_url TEXT,\n");
writer.write("  owner_url TEXT,\n");
writer.write("  story_url TEXT,\n");
writer.write("  verification_level TEXT,\n");
writer.write("  verification_method TEXT,\n");
writer.write("  verification_label TEXT,\n");
writer.write("  source_confidence REAL,\n");
writer.write("  valid_from TEXT,\n");
writer.write("  valid_to TEXT,\n");
writer.write("  entity_key TEXT,\n");
writer.write("  updated_at TEXT\n");
writer.write(");\n");

let rowCount = 0;
let batchCount = 0;
let inTransaction = false;
const sourceCounts = new Map();

function sqlValue(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function begin() {
  if (useTransactions && !inTransaction) {
    writer.write("BEGIN TRANSACTION;\n");
    inTransaction = true;
    batchCount = 0;
  }
}

function commit() {
  if (useTransactions && inTransaction) {
    writer.write("COMMIT;\n");
    inTransaction = false;
  }
}

function requireNoRawGeometryKeys(row, lineNumber) {
  for (const key of ["lat", "lng", "polygon", "geom_simplified"]) {
    if (Object.hasOwn(row, key)) {
      throw new Error(`raw geometry key '${key}' found at line ${lineNumber}`);
    }
  }
}

function toSqlRow(row) {
  const values = [
    row.field_id,
    row.source,
    row.admin_level,
    row.name,
    row.name_kana,
    row.summary,
    row.prefecture,
    row.city,
    row.public_cell,
    row.public_lat,
    row.public_lng,
    row.radius_m,
    row.area_ha,
    row.has_polygon ? 1 : 0,
    row.has_simplified_geometry ? 1 : 0,
    row.certification_id,
    row.certification_url,
    row.official_url,
    row.owner_url,
    row.story_url,
    row.verification_level,
    row.verification_method,
    row.verification_label,
    row.source_confidence,
    row.valid_from,
    row.valid_to,
    row.entity_key,
    row.updated_at
  ].map(sqlValue).join(", ");
  return `INSERT OR REPLACE INTO production_import_field_detail_readmodel (${columns.join(", ")}) VALUES (${values});\n`;
}

const reader = createInterface({
  input: createReadStream(inputPath, { encoding: "utf8" }),
  crlfDelay: Infinity
});

let lineNumber = 0;
for await (const line of reader) {
  lineNumber += 1;
  const cleanLine = lineNumber === 1 ? line.replace(/^\uFEFF/, "") : line;
  if (!cleanLine.trim()) continue;
  const row = JSON.parse(cleanLine);
  requireNoRawGeometryKeys(row, lineNumber);
  if (!row.field_id || !row.name || !row.public_cell || typeof row.public_lat !== "number" || typeof row.public_lng !== "number") {
    throw new Error(`missing required public field-detail values at line ${lineNumber}`);
  }
  begin();
  writer.write(toSqlRow(row));
  rowCount += 1;
  batchCount += 1;
  sourceCounts.set(row.source ?? "", (sourceCounts.get(row.source ?? "") ?? 0) + 1);
  if (batchCount >= batchSize) commit();
}
commit();

writer.write("CREATE INDEX IF NOT EXISTS idx_production_field_detail_public_cell ON production_import_field_detail_readmodel (public_cell);\n");
writer.write("CREATE INDEX IF NOT EXISTS idx_production_field_detail_source ON production_import_field_detail_readmodel (source, verification_level);\n");
writer.end();
await new Promise((resolve, reject) => {
  writer.on("finish", resolve);
  writer.on("error", reject);
});

console.log(JSON.stringify({
  ok: true,
  inputPath,
  outputPath,
  rows: rowCount,
  batchSize,
  useTransactions,
  sourceCounts: Object.fromEntries([...sourceCounts.entries()].sort())
}, null, 2));
