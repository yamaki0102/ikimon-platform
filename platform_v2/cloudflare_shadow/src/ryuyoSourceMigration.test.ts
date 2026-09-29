import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationsUrl = new URL("../migrations/observations/", import.meta.url);
const projectionUrl = new URL("0070_ryuyo_field_resolution_projection.sql", migrationsUrl);
const rollbackUrl = new URL("../rollback/observations/0070_ryuyo_field_resolution_projection.sql", import.meta.url);
const fieldId = "372eafbd-ea9c-4b2f-ab5f-434b81b928b2";
const entityKey = "osm:way:530835577";

async function readSql(url: URL): Promise<string> {
  return readFile(url, "utf8");
}

async function createDatabase(): Promise<DatabaseSync> {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE observations (observation_id TEXT PRIMARY KEY)");
  db.exec(await readSql(new URL("0014_field_detail_readmodel.sql", migrationsUrl)));
  db.exec(await readSql(new URL("0015_field_detail_readmodel_bbox_indexes.sql", migrationsUrl)));
  return db;
}

test("Ryuyo projection is additive, OSM-attributed and safe to repeat", async () => {
  const sql = await readSql(projectionUrl);
  const db = await createDatabase();

  db.exec(sql);
  db.exec(sql);

  const field = db.prepare(
    `SELECT field_id, source, certification_id, certification_url, verification_label, entity_key
       FROM production_import_field_detail_readmodel WHERE field_id = ?`,
  ).get(fieldId) as Record<string, unknown>;
  assert.equal(field.source, "osm_park");
  assert.equal(field.certification_id, null);
  assert.equal(field.certification_url, null);
  assert.equal(field.entity_key, entityKey);
  assert.match(String(field.verification_label), /OpenStreetMap.*ODbL 1\.0/);

  const polygon = db.prepare(
    `SELECT field_id, source, geometry_json, approximate_boundary, boundary_approximation,
            certification_url, entity_key, verification_label
       FROM production_import_area_polygon_readmodel WHERE field_id = ?`,
  ).get(fieldId) as Record<string, unknown>;
  assert.equal(polygon.source, "osm_park");
  assert.equal(polygon.certification_url, null);
  assert.equal(polygon.entity_key, entityKey);
  assert.equal(polygon.approximate_boundary, 0);
  assert.equal(polygon.boundary_approximation, "osm_way");
  assert.match(String(polygon.verification_label), /OpenStreetMap.*ODbL 1\.0/);
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

  assert.equal(db.prepare("SELECT count(*) AS count FROM production_import_field_detail_readmodel WHERE field_id = ?").get(fieldId)?.count, 1);
  assert.equal(db.prepare("SELECT count(*) AS count FROM production_import_area_polygon_readmodel WHERE field_id = ?").get(fieldId)?.count, 1);
  db.close();
});

test("Ryuyo projection never replaces pre-existing conflicting rows", async () => {
  const db = await createDatabase();
  db.prepare(`INSERT INTO production_import_field_detail_readmodel (
    field_id, source, admin_level, name, public_cell, public_lat, public_lng, entity_key
  ) VALUES (?, 'user_defined', 'user_defined', 'Existing field', '0,0', 0, 0, 'existing:field')`)
    .run(fieldId);
  db.prepare(`INSERT INTO production_import_area_polygon_readmodel (
    field_id, source, admin_level, name, center_lat, center_lng, bbox_min_lat, bbox_max_lat,
    bbox_min_lng, bbox_max_lng, geometry_json, entity_key
  ) VALUES (?, 'user_defined', 'user_defined', 'Existing boundary', 0, 0, 0, 0, 0, 0, '{}', 'existing:boundary')`)
    .run(fieldId);

  db.exec(await readSql(projectionUrl));

  assert.equal(db.prepare("SELECT name FROM production_import_field_detail_readmodel WHERE field_id = ?").get(fieldId)?.name, "Existing field");
  assert.equal(db.prepare("SELECT entity_key FROM production_import_area_polygon_readmodel WHERE field_id = ?").get(fieldId)?.entity_key, "existing:boundary");
  db.close();
});

test("Ryuyo rollback removes only exact OSM projection rows", async () => {
  const db = await createDatabase();
  db.exec(await readSql(projectionUrl));

  db.exec(await readSql(rollbackUrl));

  assert.equal(db.prepare("SELECT count(*) AS count FROM production_import_field_detail_readmodel WHERE field_id = ?").get(fieldId)?.count, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM production_import_area_polygon_readmodel WHERE field_id = ?").get(fieldId)?.count, 0);
  db.prepare(`INSERT INTO production_import_field_detail_readmodel (
    field_id, source, admin_level, name, public_cell, public_lat, public_lng, entity_key
  ) VALUES (?, 'user_defined', 'user_defined', 'Pre-existing', '0,0', 0, 0, 'existing:field')`)
    .run(fieldId);
  db.exec(await readSql(rollbackUrl));
  assert.equal(db.prepare("SELECT name FROM production_import_field_detail_readmodel WHERE field_id = ?").get(fieldId)?.name, "Pre-existing");
  db.close();
});
