import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relative: string): Promise<string> {
  return readFile(path.join(root, relative), "utf8");
}

test("UTSUROU runtime runner is exact-SHA, staging-only, and protected-mutation free", async () => {
  const runner = await source("scripts/runUtsurouRuntimeQa.mjs");

  assert.match(runner, /https:\/\/staging\.ikimon\.life/);
  assert.match(runner, /IKIMON_EXPECTED_GIT_SHA/);
  assert.match(runner, /\^\[a-f0-9\]\{40\}\$/);
  assert.match(runner, /runtime SHA mismatch/);
  assert.match(runner, /\/api\/v1\/runtime\/version/);
  assert.match(runner, /\/healthz/);
  assert.match(runner, /\/readyz/);
  assert.match(runner, /function renderAtlasTimeline/);
  assert.match(runner, /PLACE_ATLAS_QA_CANONICAL_ROUTE: "1"/);
  assert.match(runner, /record-capture-retry\.staging\.spec\.ts/);
  assert.match(runner, /productionUnverified: true/);
  assert.match(runner, /productionChanges: 0/);
  assert.match(runner, /databaseOrMigrationChanges: 0/);
  assert.match(runner, /secretChanges: 0/);
  assert.match(runner, /dnsChanges: 0/);
  assert.match(runner, /externalSends: 0/);
  assert.doesNotMatch(runner, /wrangler\s+(?:deploy|secret|d1)/iu);
});

test("capture retry browser contract never writes through to staging APIs", async () => {
  const spec = await source("e2e/record-capture-retry.staging.spec.ts");

  assert.match(spec, /page\.route\("\*\*\/\*"/);
  assert.match(spec, /fixture_unknown_mutation_rejected/);
  assert.match(spec, /observationUpsert/);
  assert.match(spec, /photoUpload/);
  assert.match(spec, /counters\.observationUpsert[^]*?toBe\(1\)/u);
  assert.match(spec, /counters\.photoUpload[^]*?toBe\(2\)/u);
  assert.match(spec, /retryable: true/);
  assert.match(spec, /record-media-retry-mode/);
  assert.match(spec, /data-record-success-cta/);
  assert.match(spec, /input\[name="visibility"\]\[value="private"\]/);
  assert.doesNotMatch(spec, /V2_PRIVILEGED_WRITE_API_KEY/);
  assert.doesNotMatch(spec, /CLOUDFLARE_API_TOKEN/);
});

test("runtime Playwright profile requires a fixed local Chromium executable", async () => {
  const config = await source("playwright.utsurou-runtime.config.ts");

  assert.match(config, /PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is required/);
  assert.match(config, /serviceWorkers: "block"/);
  assert.match(config, /--no-sandbox/);
  assert.match(config, /--disable-dev-shm-usage/);
  assert.match(config, /name: "chromium"/);
});
