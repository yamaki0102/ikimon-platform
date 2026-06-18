import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createInterface } from "node:readline";

const defaultInput = "E:/Projects/_agent_scratch/ikimon-platform/field-detail-readmodel-source-20260617/area_polygon_public_readmodel.full.d1.sql";
const inputPath = resolve(process.argv[2] ?? defaultInput);
const outputDir = resolve(process.argv[3] ?? join(dirname(inputPath), "area_polygon_chunks"));
const rowsPerPart = Number.parseInt(process.env.IKIMON_AREA_POLYGON_SQL_SPLIT_ROWS ?? "5000", 10);

if (!Number.isInteger(rowsPerPart) || rowsPerPart < 1 || rowsPerPart > 20000) {
  throw new Error("IKIMON_AREA_POLYGON_SQL_SPLIT_ROWS must be an integer from 1 to 20000.");
}

await mkdir(outputDir, { recursive: true });

const inputBase = basename(inputPath, extname(inputPath)).replace(/[^a-zA-Z0-9._-]/g, "_");
const insertPrefix = "INSERT OR REPLACE INTO production_import_area_polygon_readmodel";
const reader = createInterface({
  input: createReadStream(inputPath, { encoding: "utf8" }),
  crlfDelay: Infinity
});

let partIndex = 0;
let rowsInPart = 0;
let totalRows = 0;
let writer = null;
const parts = [];

function openPart() {
  partIndex += 1;
  rowsInPart = 0;
  const partPath = join(outputDir, `${inputBase}.part${String(partIndex).padStart(3, "0")}.sql`);
  writer = createWriteStream(partPath, { encoding: "utf8" });
  writer.write("PRAGMA foreign_keys=OFF;\n");
  parts.push({ path: partPath, rows: 0 });
}

async function closePart() {
  if (!writer) return;
  const closing = writer;
  writer = null;
  await new Promise((resolve, reject) => {
    closing.end(resolve);
    closing.on("error", reject);
  });
}

for await (const line of reader) {
  if (!line.startsWith(insertPrefix)) continue;
  if (!writer || rowsInPart >= rowsPerPart) {
    await closePart();
    openPart();
  }
  writer.write(`${line}\n`);
  rowsInPart += 1;
  totalRows += 1;
  parts.at(-1).rows += 1;
}

await closePart();

console.log(JSON.stringify({
  ok: true,
  inputPath,
  outputDir,
  rowsPerPart,
  totalRows,
  partCount: parts.length,
  parts
}, null, 2));
