import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = readFileSync(fileURLToPath(new URL("./runZukanRuntimeQa.mjs", import.meta.url)), "utf8");
const playwrightConfig = readFileSync(fileURLToPath(new URL("../playwright.zukan-runtime.config.ts", import.meta.url)), "utf8");
const placeAtlasSpec = readFileSync(fileURLToPath(new URL("../e2e/place-atlas-runtime.zukan.staging.spec.ts", import.meta.url)), "utf8");

test("ZUKAN native runtime QA is pinned to the canonical staging host", () => {
  assert.match(source, /https:\/\/staging\.zukan\.earth/u);
  assert.match(playwrightConfig, /https:\/\/staging\.zukan\.earth/u);
  assert.match(placeAtlasSpec, /https:\/\/staging\.zukan\.earth/u);
  assert.doesNotMatch(source, /staging\.ikimon\.life/u);
  assert.doesNotMatch(playwrightConfig, /staging\.ikimon\.life/u);
  assert.doesNotMatch(placeAtlasSpec, /staging\.ikimon\.life/u);
});

test("materialized HTML QA binds the source digest through the Worker response header", () => {
  assert.match(source, /x-ikimon-cloudflare-materialized-sha256/u);
  assert.match(source, /materializedSourceSha256/iu);
  assert.match(source, /ZUKAN_MATERIALIZATION_REPORT_PATH/u);
  assert.match(source, /String\(result\?\.sourceSha\s*\?\?\s*""\)\s*!==\s*expectedSha/u);
  assert.match(source, /manifestUpload\?\.versionPrefix/u);
  assert.match(placeAtlasSpec, /x-ikimon-cloudflare-materialized-sha256/u);
  assert.doesNotMatch(placeAtlasSpec, /createHash\("sha256"\)\.update\(body/u);
});

test("native Worker QA does not require routes outside the registered runtime scope", () => {
  assert.doesNotMatch(source, /assertIwataView|assertRegionalSourceRegistry/u);
  assert.match(source, /runtimeScope:\s*"cloudflare_worker_native"/u);
  assert.match(source, /fastify_route_not_registered_in_current_native_worker/u);
  assert.match(source, /record-preview-draft-recovery\.zukan\.staging\.spec\.ts/u);
  assert.doesNotMatch(source, /record-capture-retry\.zukan\.staging\.spec\.ts/u);
});

test("native Worker QA launches the Windows Playwright shim through a shell", () => {
  assert.match(source, /shell:\s*process\.platform\s*===\s*"win32"/u);
});
