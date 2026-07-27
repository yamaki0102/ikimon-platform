import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relative: string): Promise<string> {
  return readFile(path.join(root, relative), "utf8");
}

test("UTSUROU runtime runner is exact-SHA, staging-only, and materialization-bound", async () => {
  const runner = await source("scripts/runUtsurouRuntimeQa.mjs");

  assert.match(runner, /https:\/\/staging\.ikimon\.life/);
  assert.match(runner, /IKIMON_EXPECTED_GIT_SHA/);
  assert.match(runner, /UTSUROU_MATERIALIZATION_NOT_BEFORE/);
  assert.match(runner, /\^\[a-f0-9\]\{40\}\$/);
  assert.match(runner, /runtime SHA mismatch/);
  assert.match(runner, /runtime identity environment is not staging/);
  assert.match(runner, /runtime identity is not public-safe/);
  assert.match(runner, /runtime identity deployment ID is missing/);
  assert.match(runner, /materialization report predates this release/);
  assert.match(runner, /materialization map entry is missing/);
  assert.match(runner, /materialization preflight/i);
  assert.match(runner, /map artifact SHA does not match the fresh materialization report/);
  assert.match(runner, /unexpectedly came from a Cloudflare cache hit/);
  assert.match(runner, /\/api\/v1\/runtime\/version/);
  assert.match(runner, /\/healthz/);
  assert.match(runner, /\/readyz/);
  assert.match(runner, /function renderAtlasTimeline/);
  assert.match(runner, /place-atlas-runtime\.staging\.spec\.ts/);
  assert.match(runner, /record-capture-retry\.staging\.spec\.ts/);
  assert.match(runner, /UTSUROU_EXPECTED_MAP_SHA256_BY_PATH/);
  assert.match(runner, /ikimon\.utsurou-runtime-qa\/v2/);
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
  assert.doesNotMatch(runner, /runtime UI bundle hash is missing or invalid/);
  assert.doesNotMatch(runner, /PLACE_ATLAS_QA_CANONICAL_ROUTE/);
  assert.doesNotMatch(runner, /stdoutTail|stderrTail/);
  assert.doesNotMatch(runner, /wrangler\s+(?:deploy|secret|d1)/iu);
});

test("Place Atlas runtime browser contract is localized, SHA-bound, and mutation-safe", async () => {
  const spec = await source("e2e/place-atlas-runtime.staging.spec.ts");

  assert.match(spec, /UTSUROU_EXPECTED_MAP_SHA256_BY_PATH/);
  assert.match(spec, /createHash\("sha256"\)/);
  assert.match(spec, /x-ikimon-cloudflare-materialized/);
  assert.match(spec, /cf-cache-status/);
  assert.match(spec, /utsurou_runtime_qa=/);
  assert.match(spec, /SAFE_METHODS = new Set\(\["GET", "HEAD", "OPTIONS"\]\)/);
  assert.match(spec, /utsurou_runtime_unknown_mutation_rejected/);
  assert.match(spec, /POST \/api\/v1\/ui-kpi\/events/);
  assert.match(spec, /\/ja\/map/);
  assert.match(spec, /\/en\/map/);
  assert.match(spec, /\/es\/map/);
  assert.match(spec, /\/pt-br\/map/);
  assert.match(spec, /single_period/);
  assert.match(spec, /state: "empty"/);
  assert.match(spec, /state: "suppressed"/);
  assert.match(spec, /contributionCtaMode: "suppressed"/);
  assert.match(spec, /timeline-hidden-/);
  assert.doesNotMatch(spec, /V2_PRIVILEGED_WRITE_API_KEY/);
  assert.doesNotMatch(spec, /CLOUDFLARE_API_TOKEN/);
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

test("staging deploy preflights and compares materialization before runtime QA", async () => {
  const release = await source("../scripts/run_cloudflare_staging_release.sh");

  assert.match(release, /DEPLOY_STAGING.*true.*UTSUROU_RUNTIME_QA.*true/su);
  assert.match(release, /UTSUROU_RUNTIME_QA cannot be disabled for a staging deployment/);
  assert.match(release, /materialize:original-ui:dry-run/);
  assert.match(release, /materialization_preflight_write_requested/);
  assert.match(release, /materialization_map_entry_missing/);
  assert.match(release, /materialization_preflight_execute_identity_mismatch/);
  assert.match(release, /rm -f.*MATERIALIZATION_PREFLIGHT_REPORT.*MATERIALIZATION_REPORT.*UTSUROU_QA_REPORT/su);
  assert.match(release, /UTSUROU_MATERIALIZATION_NOT_BEFORE/);
  assert.match(release, /e2e:staging:utsurou-runtime/);
  assert.match(release, /SYNC_STAGING_WRITE_SECRET.*false/);
  assert.match(release, /APPLY_STAGING_MIGRATIONS.*false/);
});

test("runtime Playwright profile is pinned and does not retain credential-bearing traces", async () => {
  const config = await source("playwright.utsurou-runtime.config.ts");

  assert.match(config, /PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is required/);
  assert.match(config, /pinned to https:\/\/staging\.ikimon\.life/);
  assert.match(config, /report must stay under platform_v2\/\.deploy/);
  assert.match(config, /serviceWorkers: "block"/);
  assert.match(config, /--no-sandbox/);
  assert.match(config, /--disable-dev-shm-usage/);
  assert.match(config, /trace: "off"/);
  assert.match(config, /video: "off"/);
  assert.doesNotMatch(config, /retain-on-failure/);
  assert.match(config, /name: "chromium"/);
});
