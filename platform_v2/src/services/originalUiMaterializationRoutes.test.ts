import assert from "node:assert/strict";
import test from "node:test";
import {
  listPublicSiteMapLocalizableBasePaths,
  listPublicSiteMapMaterializationPaths,
} from "./originalUiMaterializationRoutes.js";

test("public SiteMap projection materializes every Fastify-owned route", () => {
  const basePaths = listPublicSiteMapLocalizableBasePaths();
  const localizedPaths = listPublicSiteMapMaterializationPaths();

  assert.equal(basePaths.length, 66);
  assert.equal(localizedPaths.length, 78);
  assert.equal(new Set(basePaths).size, basePaths.length);
  assert.equal(new Set(localizedPaths).size, localizedPaths.length);

  for (const path of [
    "/about",
    "/learn",
    "/learn/identification-basics",
    "/learn/invasive-species",
    "/learn/terms/biodiversity",
    "/privacy",
    "/terms",
    "/contact",
    "/community",
    "/for-business/pricing",
    "/for-business/monitoring/apply",
    "/for-researcher/apply",
  ]) {
    assert.ok(basePaths.includes(path), `${path} must come from the current SiteMap`);
    assert.ok(localizedPaths.includes(`/ja${path === "/" ? "/" : path}`), `${path} must have a Japanese materialization`);
  }

  assert.equal(basePaths.some((path) => path.includes(":")), false);
  assert.equal(localizedPaths.some((path) => path.includes(":")), false);
  assert.equal(basePaths.includes("/qa/site-map"), false);
  assert.equal(localizedPaths.includes("/ja/qa/site-map"), false);
});
