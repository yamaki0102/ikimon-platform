import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsUrl = new URL("../migrations/observations/", import.meta.url);
const projectionUrl = new URL("0070_ryuyo_field_resolution_projection.sql", migrationsUrl);
const correctionUrl = new URL("0071_ryuyo_osm_source_correction.sql", migrationsUrl);

async function readMigration(url: URL): Promise<string> {
  return readFile(url, "utf8");
}

async function createDatabase(): Promise<DatabaseSync> {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE observations (observation_id TEXT PRIMARY KEY)");
  db.exec(await readMigration(new URL("0014_field_detail_readmodel.sql", migrationsUrl)));
  db.exec(await readMigration(new URL("0015_field_detail_readmodel_bbox_indexes.sql", migrationsUrl)));
  return db;
}

test("fresh production applies the historical Ryuyo 0070 and then 0071", async () => {
  const projection = await readMigration(projectionUrl);
  const correction = await readMigration(correctionUrl);
  const db = await createDatabase();

  db.exec(projection);
  db.exec(correction);

  const columns = db.prepare("PRAGMA table_info(observations)").all() as Array<{
    name: string;
    dflt_value: string | null;
  }>;
  assert.equal(
    columns.find(({ name }) => name === "resolved_field_ids_json")?.dflt_value,
    "'[]'",
  );

  const field = db.prepare(
    "SELECT field_id, source, certification_id, entity_key FROM production_import_field_detail_readmodel",
  ).get();
  assert.deepEqual({ ...field }, {
    field_id: "372eafbd-ea9c-4b2f-ab5f-434b81b928b2",
    source: "osm_park",
    certification_id: "osm:way:530835577",
    entity_key: "osm:way:530835577",
  });

  const polygon = db.prepare(
    `SELECT field_id, source, geometry_json, approximate_boundary,
      boundary_approximation, certification_url, entity_key
    FROM production_import_area_polygon_readmodel`,
  ).get() as Record<string, unknown>;
  assert.equal(polygon.field_id, "372eafbd-ea9c-4b2f-ab5f-434b81b928b2");
  assert.equal(polygon.source, "osm_park");
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

  const seedStatements = projection.slice(
    projection.indexOf("INSERT INTO production_import_field_detail_readmodel"),
  );
  db.exec(seedStatements);
  assert.equal(db.prepare("SELECT count(*) AS count FROM production_import_field_detail_readmodel").get()?.count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM production_import_area_polygon_readmodel").get()?.count, 1);
  db.close();
});

test("staging applies only 0071 after its previously recorded Ryuyo 0070", async () => {
  const projection = await readMigration(projectionUrl);
  const correction = await readMigration(correctionUrl);
  const db = await createDatabase();

  // Reproduce staging's already-applied 0070 contents without applying a D1 migration.
  const historicalStagingProjection = projection.replaceAll(
    "'osm_park', 'osm_park'",
    "'user_defined', 'osm_park'",
  );
  db.exec(historicalStagingProjection);
  db.prepare(`INSERT INTO production_import_field_detail_readmodel (
    field_id, source, admin_level, name, public_cell, public_lat, public_lng, entity_key
  ) VALUES (?, 'user_defined', 'osm_park', 'Other', '0,0', 0, 0, ?)`)
    .run("other-field", "osm:way:other");
  db.prepare(`INSERT INTO production_import_area_polygon_readmodel (
    field_id, source, admin_level, name, center_lat, center_lng,
    bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, geometry_json,
    approximate_boundary, entity_key
  ) VALUES (?, 'user_defined', 'osm_park', 'Other', 0, 0, 0, 0, 0, 0, '{}', 1, ?)`)
    .run("other-field", "osm:way:other");

  db.exec(correction);

  const selectSource = (table: string, fieldId: string): unknown => db
    .prepare(`SELECT source FROM ${table} WHERE field_id = ?`)
    .get(fieldId)?.source;
  for (const table of [
    "production_import_field_detail_readmodel",
    "production_import_area_polygon_readmodel",
  ]) {
    assert.equal(selectSource(table, "372eafbd-ea9c-4b2f-ab5f-434b81b928b2"), "osm_park");
    assert.equal(selectSource(table, "other-field"), "user_defined");
  }
  db.close();
});
