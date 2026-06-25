import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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

test("legacy PostgreSQL municipal implementation remains unregistered until removal", async () => {
  const routeSource = await readFile(path.join(process.cwd(), "src", "routes", "municipalWalkMaps.ts"), "utf8");
  const serviceSource = await readFile(path.join(process.cwd(), "src", "services", "municipalWalkMap.ts"), "utf8");

  assert.match(routeSource, /registerMunicipalWalkMapRoutes/);
  assert.match(serviceSource, /INSERT INTO municipal_walk_maps/);
  assert.match(serviceSource, /INSERT INTO municipal_walk_map_creators/);
  assert.match(serviceSource, /INSERT INTO municipal_walk_map_audit/);
});
