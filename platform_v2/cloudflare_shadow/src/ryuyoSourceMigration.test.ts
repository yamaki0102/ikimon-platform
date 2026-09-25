import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import test from "node:test";

const migrationUrl = new URL(
  "../migrations/observations/0070_ryuyo_field_resolution_projection.sql",
  import.meta.url,
);

test("Ryuyo source migration binds the existing polygon readmodel to the canonical OSM way", async () => {
  const migration = await readFile(fileURLToPath(migrationUrl), "utf8");
  assert.match(migration, /production_import_area_polygon_readmodel/);
  assert.match(migration, /372eafbd-ea9c-4b2f-ab5f-434b81b928b2/);
  assert.match(migration, /osm:way:530835577/);
  assert.match(migration, /"type":"Polygon"/);
  assert.match(migration, /ON CONFLICT\(field_id\) DO UPDATE/);

  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE observations (observation_id TEXT PRIMARY KEY)");
  db.exec(await readFile(fileURLToPath(new URL("../migrations/observations/0014_field_detail_readmodel.sql", import.meta.url)), "utf8"));
  db.exec(await readFile(fileURLToPath(new URL("../migrations/observations/0015_field_detail_readmodel_bbox_indexes.sql", import.meta.url)), "utf8"));
  db.exec(migration);

  const columns = db.prepare("PRAGMA table_info(observations)").all() as Array<{ name: string; dflt_value: string | null }>;
  const resolvedFieldIds = columns.find(({ name }) => name === "resolved_field_ids_json");
  assert.equal(resolvedFieldIds?.dflt_value, "'[]'");

  const field = db.prepare("SELECT field_id, certification_id, entity_key FROM production_import_field_detail_readmodel").get() as Record<string, unknown>;
  assert.deepEqual({ ...field }, {
    field_id: "372eafbd-ea9c-4b2f-ab5f-434b81b928b2",
    certification_id: "osm:way:530835577",
    entity_key: "osm:way:530835577",
  });

  const polygon = db.prepare("SELECT field_id, geometry_json, approximate_boundary, boundary_approximation, certification_url, entity_key FROM production_import_area_polygon_readmodel").get() as Record<string, unknown>;
  assert.equal(polygon.field_id, "372eafbd-ea9c-4b2f-ab5f-434b81b928b2");
  assert.equal(polygon.certification_url, "https://www.openstreetmap.org/way/530835577");
  assert.equal(polygon.entity_key, "osm:way:530835577");
  assert.equal(polygon.approximate_boundary, 0);
  assert.equal(polygon.boundary_approximation, "osm_way");
  assert.deepEqual(JSON.parse(String(polygon.geometry_json)), {
    type: "Polygon",
    coordinates: [[
      [137.8393578, 34.6684471],
      [137.8391405, 34.6708363],
      [137.8391517, 34.6712001],
      [137.8394498, 34.6708521],
      [137.8405761, 34.6693071],
      [137.8407421, 34.6690781],
      [137.8393578, 34.6684471],
    ]],
  });

  // D1 applies a migration filename once. Its seed projection also converges if
  // replayed by extracting the two data statements after schema application.
  const seedStatements = migration.slice(migration.indexOf("INSERT INTO production_import_field_detail_readmodel"));
  db.exec(seedStatements);
  assert.equal(db.prepare("SELECT count(*) AS count FROM production_import_field_detail_readmodel").get()?.count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM production_import_area_polygon_readmodel").get()?.count, 1);
  db.close();
});
