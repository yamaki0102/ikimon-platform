import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const migration = readFileSync(
  fileURLToPath(new URL("../migrations/observations/0070_ryuyo_field_resolution_projection.sql", import.meta.url)),
  "utf8",
);

test("Ryuyo migration normalizes the existing field and preserves its entity identity", () => {
  assert.match(migration, /ALTER TABLE observations ADD COLUMN resolved_field_ids_json/);
  assert.match(migration, /WHERE field_id = '372eafbd-ea9c-4b2f-ab5f-434b81b928b2'/);
  assert.match(migration, /name = '竜洋昆虫自然観察公園'/);
  assert.match(migration, /prefecture = '静岡県'/);
  assert.match(migration, /city = '磐田市'/);
  assert.match(migration, /official_url = 'https:\/\/ryu-yo\.jp\/'/);
  assert.match(migration, /entity_key = 'osm:way:530835577'/);
  assert.match(migration, /INSERT OR REPLACE INTO production_import_area_polygon_readmodel/);
  assert.match(migration, /approximate_boundary, boundary_approximation/);
});
