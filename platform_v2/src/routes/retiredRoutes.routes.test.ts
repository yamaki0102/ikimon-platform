import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

test("municipal walk map Fastify routes are retired in favor of Worker-native routes", async () => {
  const appSource = await readFile(path.join(process.cwd(), "src", "app.ts"), "utf8");
  const workerSource = await readFile(path.join(process.cwd(), "cloudflare_shadow", "src", "index.ts"), "utf8");

  assert.doesNotMatch(appSource, /registerMunicipalWalkMapRoutes/);
  assert.match(workerSource, /nativePathname === "\/api\/v1\/municipal-walk-maps"/);
  assert.match(workerSource, /municipalWalkMapDetailApiMatch/);
  assert.match(workerSource, /getMunicipalWalkMapPublicDetailApi/);
  assert.match(workerSource, /nativePathname === "\/walk-maps"/);
  assert.match(workerSource, /getMunicipalWalkMapListPage/);
  assert.match(workerSource, /municipalWalkMapSourceDraftMatch/);
  assert.match(workerSource, /getMunicipalWalkMapSourceDraftPage/);
  assert.match(workerSource, /nativePathname === "\/admin\/municipal-walk-maps"/);
  assert.match(workerSource, /nativePathname === "\/admin\/municipal-walk-map-creators"/);
  assert.match(workerSource, /nativePathname === "\/admin\/municipal-walk-map-reviews"/);
  assert.match(workerSource, /nativePathname === "\/api\/v1\/admin\/municipal-walk-map-creators"/);
  assert.match(workerSource, /nativePathname === "\/api\/v1\/admin\/municipal-walk-map-reviews"/);
  assert.match(workerSource, /nativePathname === "\/api\/v1\/admin\/municipal-walk-map-templates"/);
  assert.match(workerSource, /nativePathname === "\/api\/v1\/admin\/municipal-walk-map-source-catalog"/);
  assert.match(workerSource, /nativePathname === "\/api\/v1\/admin\/municipal-walk-maps"/);
  assert.match(workerSource, /nativePathname === "\/api\/v1\/admin\/municipal-walk-maps\/preview"/);
});

test("municipal walk map HTML is not rendered through original-ui materialization", async () => {
  const materializerSource = await readFile(
    path.join(process.cwd(), "cloudflare_shadow", "scripts", "materialize-original-ui-html.mjs"),
    "utf8",
  );
  const workerSource = await readFile(path.join(process.cwd(), "cloudflare_shadow", "src", "index.ts"), "utf8");

  assert.doesNotMatch(materializerSource, /\/walk-maps/);
  assert.doesNotMatch(materializerSource, /\/walk-map-source-drafts/);
  assert.doesNotMatch(materializerSource, /municipal-walk-map-reviews/);
  assert.doesNotMatch(workerSource, /"\/walk-maps",/);
  assert.doesNotMatch(workerSource, /"\/admin\/municipal-walk-map-reviews",/);
  assert.match(workerSource, /"x-ikimon-cloudflare-native": "municipal-walk-map-list"/);
  assert.match(workerSource, /"x-ikimon-cloudflare-native": "municipal-walk-map-source-draft"/);
  assert.match(workerSource, /"x-ikimon-cloudflare-native": "municipal-walk-map-admin-html"/);
});

test("legacy PostgreSQL municipal implementation is removed from platform source", async () => {
  await assert.rejects(
    () => readFile(path.join(process.cwd(), "src", "routes", "municipalWalkMaps.ts"), "utf8"),
    /ENOENT/,
  );
  const serviceSource = await readFile(path.join(process.cwd(), "src", "services", "municipalWalkMap.ts"), "utf8");

  assert.doesNotMatch(serviceSource, /from "\.\.\/db\.js"/);
  assert.doesNotMatch(serviceSource, /INSERT INTO municipal_walk_maps/);
  assert.doesNotMatch(serviceSource, /INSERT INTO municipal_walk_map_creators/);
  assert.doesNotMatch(serviceSource, /INSERT INTO municipal_walk_map_audit/);
});

test("retired municipal PostgreSQL entrypoints have no product references", async () => {
  const platformRoot = process.cwd();
  const repoRoot = path.resolve(platformRoot, "..");
  const scanRoots = [
    platformRoot,
    path.join(repoRoot, ".github"),
  ];
  const files = (await Promise.all(scanRoots.map(async (root) => {
    try {
      return await listFiles(root);
    } catch {
      return [];
    }
  }))).flat();
  const self = path.join(platformRoot, "src", "routes", "retiredRoutes.routes.test.ts");
  const retiredTokens = [
    "db:preflight:municipal-walk-map-apply",
    "db:verify:municipal-walk-map",
    "preflightMunicipalWalkMapDbApply",
    "verifyMunicipalWalkMapDbReadiness",
    "src/routes/municipalWalkMaps.ts",
    "registerMunicipalWalkMapRoutes",
    "upsertMunicipalWalkMapConfigV0",
    "getMunicipalWalkMapConfigV0FromDb",
    "listMunicipalWalkMapReviewQueueV0",
    "reviewMunicipalWalkMapPublicationV0",
  ];
  const hits: string[] = [];
  for (const file of files) {
    if (path.normalize(file) === path.normalize(self)) continue;
    if (!/\.(ts|tsx|js|mjs|json|yml|yaml|md)$/.test(file)) continue;
    const body = await readFile(file, "utf8");
    for (const token of retiredTokens) {
      if (body.includes(token)) hits.push(`${path.relative(repoRoot, file)}:${token}`);
    }
  }

  assert.deepEqual(hits, []);
});
