import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("OSM park importer reuses closed entity rows instead of reinserting duplicate certifications", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "scripts", "importOsmLeisureParks.ts"), "utf8");

  assert.match(source, /WHERE entity_key = \$1\s+ORDER BY \(valid_to IS NULL\) DESC/s);
  assert.match(source, /valid_to = NULL/);
});

test("OSM park importer includes playgrounds and named green-space polygons", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "scripts", "importOsmLeisureParks.ts"), "utf8");

  assert.match(source, /playground/);
  assert.match(source, /garden/);
  assert.match(source, /recreation_ground/);
  assert.match(source, /landuse"\="grass"\]\["name"\]/);
});
