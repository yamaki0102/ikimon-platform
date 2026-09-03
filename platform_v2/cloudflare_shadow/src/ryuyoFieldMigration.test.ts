import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("Ryuyo source migration binds the existing polygon readmodel to the canonical OSM way", async () => {
  const migration = await readFile(fileURLToPath(new URL("../migrations/observations/0070_ryuyo_field_resolution_projection.sql", import.meta.url)), "utf8");
  assert.match(migration, /production_import_area_polygon_readmodel/);
  assert.match(migration, /372eafbd-ea9c-4b2f-ab5f-434b81b928b2/);
  assert.match(migration, /osm:way:530835577/);
  assert.match(migration, /"type":"Polygon"/);
  assert.match(migration, /ON CONFLICT\(field_id\) DO UPDATE/);
});
