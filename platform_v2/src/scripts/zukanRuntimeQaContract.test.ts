import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relative: string): Promise<string> {
  return readFile(path.join(root, relative), "utf8");
}

test("ZUKAN runtime runner is exact-SHA, staging-only, materialization-bound, and honest about remaining P0", async () => {
  const runner = await source("scripts/runZukanRuntimeQa.mjs");

  assert.match(runner, /https:\/\/staging\.ikimon\.life/);
  assert.match(runner, /IKIMON_EXPECTED_GIT_SHA/);
  assert.match(runner, /ZUKAN_MATERIALIZATION_NOT_BEFORE/);
  assert.match(runner, /runtime SHA mismatch/);
  assert.match(runner, /runtime identity environment is not staging/);
  assert.match(runner, /runtime identity is not public-safe/);
  assert.match(runner, /materialization report predates this release/);
  assert.match(runner, /map artifact SHA does not match the fresh materialization report/);
  assert.match(runner, /unexpectedly came from a Cloudflare cache hit/);
  assert.match(runner, /JSON\.stringify\(runtimeAfter\.stable\)/);
  assert.match(runner, /\/api\/v1\/runtime\/version/);
  assert.match(runner, /\/healthz/);
  assert.match(runner, /\/readyz/);
  assert.match(runner, /\/api\/regional-sources/);
  assert.match(runner, /\/iwata/);
  assert.match(runner, /source:miyakoda:wakuwaku-map:2025/);
  assert.match(runner, /INDEX_ONLY/);
  assert.match(runner, /place-atlas-runtime\.zukan\.staging\.spec\.ts/);
  assert.match(runner, /record-capture-retry\.zukan\.staging\.spec\.ts/);
  assert.match(runner, /zukan\.runtime-qa\/v1/);
  assert.match(runner, /p0Ready: false/);
  assert.match(runner, /owner_edit_runtime_readback/);
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

test("Place Atlas browser contract explicitly clicks the revisit CTA and rejects unknown mutations", async () => {
  const spec = await source("e2e/place-atlas-runtime.zukan.staging.spec.ts");

  assert.match(spec, /ZUKAN_EXPECTED_MAP_SHA256_BY_PATH/);
  assert.match(spec, /createHash\("sha256"\)/);
  assert.match(spec, /x-ikimon-cloudflare-materialized/);
  assert.match(spec, /zukan_runtime_qa=/);
  assert.match(spec, /zukan_runtime_unknown_mutation_rejected/);
  assert.match(spec, /session\.mutationEvents\.length = 0/);
  assert.match(spec, /await cta\.click\(\)/);
  assert.match(spec, /POST \$\{KPI_PATH\}/);
  assert.match(spec, /\/ja\/map/);
  assert.match(spec, /\/en\/map/);
  assert.match(spec, /\/es\/map/);
  assert.match(spec, /\/pt-br\/map/);
  assert.match(spec, /single_period/);
  assert.match(spec, /state: "empty"/);
  assert.match(spec, /state: "suppressed"/);
  assert.match(spec, /timeline-hidden-/);
  assert.doesNotMatch(spec, /V2_PRIVILEGED_WRITE_API_KEY/);
  assert.doesNotMatch(spec, /CLOUDFLARE_API_TOKEN/);
});

test("capture retry browser contract remains fixture-only and idempotent", async () => {
  const spec = await source("e2e/record-capture-retry.zukan.staging.spec.ts");

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

test("runtime Playwright profile is pinned and does not retain credential-bearing traces", async () => {
  const config = await source("playwright.zukan-runtime.config.ts");

  assert.match(config, /PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is required/);
  assert.match(config, /pinned to https:\/\/staging\.ikimon\.life/);
  assert.match(config, /report must stay under platform_v2\/\.deploy/);
  assert.match(config, /serviceWorkers: "block"/);
  assert.match(config, /--no-sandbox/);
  assert.match(config, /--disable-dev-shm-usage/);
  assert.match(config, /trace: "off"/);
  assert.match(config, /video: "off"/);
  assert.doesNotMatch(config, /retain-on-failure/);
});

test("partial runtime gate stays explicit and does not alter the global staging release", async () => {
  const packageJson = await source("package.json");
  const release = await source("../scripts/run_cloudflare_staging_release.sh");

  assert.match(packageJson, /"e2e:staging:zukan-runtime": "node scripts\/runZukanRuntimeQa\.mjs"/);
  assert.doesNotMatch(release, /e2e:staging:zukan-runtime/);
  assert.doesNotMatch(release, /ZUKAN_RUNTIME_QA/);
  assert.match(release, /SYNC_STAGING_WRITE_SECRET.*false/su);
  assert.match(release, /APPLY_STAGING_MIGRATIONS.*false/su);
});
