#!/usr/bin/env node
/** Read-only feature verification after the existing registered release runner. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const [environment, exactSha] = process.argv.slice(2);
const origins = {
  staging: "https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev",
  production: "https://zukan.earth",
};
assert(environment in origins && /^[0-9a-f]{40}$/u.test(exactSha ?? ""), "Usage: node scripts/verify-learn-catalog.mjs <staging|production> <exact-40-character-git-sha>");
const platformRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function identity() {
  const response = await fetch(new URL("/api/v1/runtime/version", origins[environment]), { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  assert.equal(response.status, 200, "runtime identity GET must succeed");
  const value = await response.json();
  assert.equal(value.schemaVersion, "cloudflare_worker_runtime/v1");
  assert.equal(value.ok, true);
  assert.equal(value.publicSafe, true);
  assert.equal(value.runtime, "cloudflare-worker");
  assert.equal(value.environment, environment);
  assert.equal(value.gitSha, exactSha, "runtime must match the exact source under test");
  for (const field of ["workerVersionId", "originalUiManifestHash"]) assert.equal(typeof value[field] === "string" && value[field].length > 0, true, `${field} must identify the deployed artifact`);
  return { environment: value.environment, gitSha: value.gitSha, workerVersion: value.workerVersion, workerVersionId: value.workerVersionId, originalUiManifestHash: value.originalUiManifestHash };
}

const before = await identity();
console.log(JSON.stringify({ evidence: "learn-catalog-runtime-before", origin: origins[environment], ...before }));
// Reuse the native Build host's already provisioned Chromium dependencies.
// This does not install libraries, change credentials, or introduce a release path.
const privateLibraries = [
  "/tmp/ikimon-zukan-chromium-libs.v1/usr/lib/x86_64-linux-gnu",
  "/tmp/ikimon-zukan-chromium-libs.v1/lib/x86_64-linux-gnu",
].filter(existsSync);
const childEnvironment = {
  ...process.env,
  STAGING_BASE_URL: origins[environment],
  STAGING_BASIC_AUTH_USER: "",
  STAGING_BASIC_AUTH_PASS: "",
  IKIMON_EXPECTED_GIT_SHA: exactSha,
  PLAYWRIGHT_JSON_OUTPUT_NAME: join(platformRoot, "test-results", `learn-catalog-${environment}.json`),
  ...(privateLibraries.length ? { LD_LIBRARY_PATH: [...privateLibraries, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":") } : {}),
};
const run = spawnSync(process.execPath, [
  join(platformRoot, "node_modules", "@playwright", "test", "cli.js"),
  "test", "-c", "playwright.staging.config.ts", "e2e/learn-catalog.staging.spec.ts",
  "--workers=1", "--retries=0", "--reporter=list,json", "--grep-invert=\\[local-fixture\\]",
], { cwd: platformRoot, env: childEnvironment, stdio: "inherit", timeout: 900_000 });
// Read back even after a failed test so an overlapping deployment is explicit.
const after = await identity();
assert.deepEqual(after, before, "runtime changed during the feature journey; rerun against a stable exact release");
const report = existsSync(childEnvironment.PLAYWRIGHT_JSON_OUTPUT_NAME)
  ? JSON.parse(readFileSync(childEnvironment.PLAYWRIGHT_JSON_OUTPUT_NAME, "utf8"))
  : null;
console.log(JSON.stringify({ evidence: "learn-catalog-runtime-after", origin: origins[environment], ...after, browserTestsExitCode: run.status, browserTestsError: run.error?.message ?? null, testCounts: report?.stats ? { passed: report.stats.expected, failed: report.stats.unexpected, flaky: report.stats.flaky, skipped: report.stats.skipped } : null }));
if (run.error || run.status !== 0) process.exitCode = 1;
