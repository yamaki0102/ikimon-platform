import assert from "node:assert/strict";
import test from "node:test";
import { listInvasiveSpeciesMaterializationPaths } from "./invasiveSpeciesMaterialization.js";
import {
  INVASIVE_SPECIES_LIST_PATH,
  invasiveSpeciesDetailPath,
  listInvasiveSpecies,
} from "./invasiveSpeciesCatalog.js";

test("existing invasive-species pages have a separate Japanese materialization projection", () => {
  const paths = listInvasiveSpeciesMaterializationPaths();
  const expected = [
    `/ja${INVASIVE_SPECIES_LIST_PATH}`,
    ...listInvasiveSpecies().map((item) => `/ja${invasiveSpeciesDetailPath(item)}`),
  ];

  assert.deepEqual(paths, expected);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.includes("/ja/learn/invasive-species/procyon-lotor"));
  assert.equal(paths.some((path) => path.endsWith("/not-a-catalogue-item")), false);
});
