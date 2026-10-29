import assert from "node:assert/strict";
import test from "node:test";
import { listLearnMaterializationPaths } from "../../src/learn/materialization.ts";
import { listPublicSiteMapMaterializationPaths } from "../../src/services/originalUiMaterializationRoutes.ts";
import { selectCoreMaterializationPaths } from "./materialization-target-selection.mjs";

function targets(overrides = {}) {
  return selectCoreMaterializationPaths({
    corePaths: ["/"],
    queryVariantPaths: ["/explore?view=grid"],
    learnPaths: listLearnMaterializationPaths(),
    invasiveSpeciesPaths: ["/ja/learn/invasive-species/example"],
    siteMapPaths: listPublicSiteMapMaterializationPaths(),
    ...overrides,
  });
}

test("core materialization includes the unprefixed Learn entry and SiteMap-supported Contact locale", () => {
  const selected = targets();
  assert.ok(selected.includes("/learn"));
  assert.ok(selected.includes("/ja/contact"));
  assert.ok(selected.includes("/ja/learn"));
  assert.ok(selected.includes("/en/learn"));
});

test("core materialization does not invent Contact locales outside the existing SiteMap contract", () => {
  const siteMapPaths = listPublicSiteMapMaterializationPaths();
  const selected = targets({ siteMapPaths });
  const contractedContactPaths = siteMapPaths.filter((path) => path.endsWith("/contact"));
  assert.deepEqual(contractedContactPaths, ["/ja/contact"]);
  assert.deepEqual(selected.filter((path) => path.endsWith("/contact")), contractedContactPaths);
  assert.equal(selected.includes("/contact"), false);
  assert.equal(selected.includes("/en/contact"), false);
});

test("core selection remains bounded and deduplicated", () => {
  const selected = targets({ corePaths: ["/", "/learn", "/ja/contact"] });
  assert.equal(selected.filter((path) => path === "/learn").length, 1);
  assert.equal(selected.filter((path) => path === "/ja/contact").length, 1);
  assert.equal(selected.includes("/unrelated-site-map-page"), false);
});
