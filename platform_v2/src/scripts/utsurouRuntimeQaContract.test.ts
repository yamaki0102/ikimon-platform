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
  assert.match(runner, /runtime identity environment is not staging/);
  assert.match(runner, /runtime identity is not public-safe/);
  assert.match(runner, /runtime identity deployment ID is missing/);
  assert.match(runner, /runtime UI bundle hash is missing or invalid/);
  assert.match(runner, /runtime UI manifest hash is missing or invalid/);
  assert.match(runner, /unexpectedly came from a Cloudflare cache hit/);
  assert.match(runner, /\/api\/v1\/runtime\/version/);
  assert.match(runner, /\/healthz/);
  assert.match(runner, /\/readyz/);
  assert.match(runner, /function renderAtlasTimeline/);
  assert.match(runner, /PLACE_ATLAS_QA_CANONICAL_ROUTE: "1"/);
  assert.match(runner, /record-capture-retry\.staging\.spec\.ts/);
  assert.match(runner, /productionUnverified: true/);
  assert.match(runner, /qaFixtureNetworkWrites: 0/);
  assert.match(runner, /actualStagingDatabaseWrites: 0/);
  assert.match(runner, /productionChanges: 0/);
  assert.match(runner, /databaseOrMigrationChanges: 0/);
  assert.match(runner, /secretChanges: 0/);
  assert.match(runner, /dnsChanges: 0/);
  assert.match(runner, /externalSends: 0/);
  assert.match(runner, /stdoutSha256/);
  assert.match(runner, /stderrSha256/);
  assert.doesNotMatch(runner, /stdoutTail|stderrTail/);
  assert.doesNotMatch(runner, /wrangler\s+(?:deploy|secret|d1)/iu);
});

test("capture retry browser contract never writes through to staging APIs", async () => {
  const spec = await source("e2e/record-capture-retry.staging.spec.ts");

  assert.match(spec, /page\.route\("\*\*\/\*"/);
  assert.match(spec, /SAFE_METHODS = new Set\(\["GET", "HEAD", "OPTIONS"\]\)/);
  assert.match(spec, /fixture_unknown_mutation_rejected/);
  assert.match(spec, /observationUpsert/);
  assert.match(spec, /photoUpload/);
  assert.match(spec, /allowSuccessfulUpload = false/);
  assert.match(spec, /failedUploadAttempts/);
  assert.match(spec, /counters\.observationUpsert[^]*?toBe\(1\)/u);
  assert.match(spec, /failedUploadAttempts \+ 1/);
  assert.match(spec, /retryable: true/);
  assert.match(spec, /record-media-retry-mode/);
  assert.match(spec, /data-record-success-cta/);
  assert.match(spec, /input\[name="visibility"\]\[value="private"\]/);
  assert.match(spec, /no non-idempotent request may reach staging/);
  assert.doesNotMatch(spec, /V2_PRIVILEGED_WRITE_API_KEY/);
  assert.doesNotMatch(spec, /CLOUDFLARE_API_TOKEN/);
});

test("staging deploy cannot skip the UTSUROU runtime gate", async () => {
  const release = await source("../scripts/run_cloudflare_staging_release.sh");

  assert.match(release, /DEPLOY_STAGING.*true.*UTSUROU_RUNTIME_QA.*true/su);
  assert.match(release, /UTSUROU_RUNTIME_QA cannot be disabled for a staging deployment/);
  assert.match(release, /e2e:staging:utsurou-runtime/);
  assert.match(release, /SYNC_STAGING_WRITE_SECRET.*false/);
  assert.match(release, /APPLY_STAGING_MIGRATIONS.*false/);
});

test("runtime Playwright profile requires a fixed local Chromium executable", async () => {
  const config = await source("playwright.utsurou-runtime.config.ts");

  assert.match(config, /PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is required/);
  assert.match(config, /serviceWorkers: "block"/);
  assert.match(config, /--no-sandbox/);
  assert.match(config, /--disable-dev-shm-usage/);
  assert.match(config, /name: "chromium"/);
});
