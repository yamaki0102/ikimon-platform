import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  here,
  "..",
  "migrations",
  "observations",
  "0062_aikan_lenri_verified_boundary.sql",
);

test("Aikan Lenri D1 migration publishes the verified irregular boundary", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS production_import_area_polygon_readmodel/);
  assert.match(sql, /production_import_area_polygon_readmodel/);
  assert.match(sql, /7cb246a5-388b-4acb-b701-2bfd698fac13/);
  assert.match(sql, /ikimon:aikan:renri-no-ki/);
  assert.match(sql, /applicant_workbook_image_digitization/);
  assert.match(sql, /\n\s*0,\n\s*'applicant_workbook_image_digitization'/);

  const geometryMatch = sql.match(/'(\{"type":"Polygon","coordinates":\[\[\[.*?\]\]\]\})'/s);
  assert.ok(geometryMatch?.[1], "migration must contain a GeoJSON Polygon");
  const geometry = JSON.parse(geometryMatch[1]) as {
    type: string;
    coordinates: number[][][];
  };
  const ring = geometry.coordinates[0] ?? [];
  assert.equal(geometry.type, "Polygon");
  assert.equal(ring.length, 19);
  assert.deepEqual(ring[0], ring.at(-1));
  assert.ok(new Set(ring.map(([lng]) => lng)).size >= 12, "boundary must not regress to a rectangle");
  assert.ok(new Set(ring.map(([, lat]) => lat)).size >= 12, "boundary must preserve the supplied shape");
});
