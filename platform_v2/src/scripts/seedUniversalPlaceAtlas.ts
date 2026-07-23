import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { resolveOsmAreaByRef } from "../services/areaPolygons.js";
import {
  buildD1PlaceSeedSql,
  buildPlaceSeedReport,
  materializePlaceSeed,
  osmFullJsonToBoundary,
  parsePlaceSeedDocument,
} from "../services/placeSeed.js";

function flag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const seedPath = resolve(flag("--seed") ?? "../ops/data/universal_place_atlas_canary.json");
const outputPath = flag("--output") ? resolve(flag("--output")!) : null;
const reportPath = flag("--report") ? resolve(flag("--report")!) : null;
const emitSql = process.argv.includes("--emit-d1-sql");

const document = parsePlaceSeedDocument(JSON.parse(await readFile(seedPath, "utf8")));
const materialized = await materializePlaceSeed({
  document,
  resolveBoundary: async (osmType, osmId) => {
    const area = await resolveOsmAreaByRef(osmType, osmId);
    if (area) {
      return {
        geometry: area.geometry as { type: "Polygon" | "MultiPolygon"; coordinates: unknown },
        actualName: area.name,
        actualPlaceKind: area.placeKind ?? "other_named_area",
        osmType,
        osmId,
      };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`https://api.openstreetmap.org/api/0.6/${osmType}/${osmId}/full.json`, {
        headers: {
          accept: "application/json",
          "user-agent": "ikimon-place-atlas-seed/1.0",
        },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return osmFullJsonToBoundary({
        payload: await response.json(),
        osmType,
        osmId,
      });
    } finally {
      clearTimeout(timeout);
    }
  },
});
const report = buildPlaceSeedReport({
  document,
  ...materialized,
  mode: emitSql ? "emit_sql" : "dry_run",
});

if (reportPath) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
if (emitSql) {
  if (materialized.failed.length > 0) throw new Error("seed_boundary_resolution_incomplete");
  const sql = `${buildD1PlaceSeedSql(materialized.places)}\n`;
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, sql, "utf8");
  }
  else process.stdout.write(sql);
} else {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
if (materialized.failed.length > 0) process.exitCode = 2;
