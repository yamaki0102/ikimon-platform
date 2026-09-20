import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const diagnostic = process.argv.includes("--diagnostics");
const intentionalFailure = process.argv.includes("--intentional-failure");
const passthrough = process.argv.filter((arg) => arg !== "--diagnostics" && arg !== "--intentional-failure");
const testEmail = process.env.BROWSER_RUN_TEST_EMAIL?.trim();
const testPassword = process.env.BROWSER_RUN_TEST_PASSWORD?.trim();
if (Boolean(testEmail) !== Boolean(testPassword)) {
  console.error("BROWSER_RUN_TEST_EMAIL and BROWSER_RUN_TEST_PASSWORD must be provided together.");
  process.exit(2);
}
if (!testEmail && !process.env.V2_PRIVILEGED_WRITE_API_KEY?.trim()) {
  console.error("Browser Run needs either explicit test-account credentials or V2_PRIVILEGED_WRITE_API_KEY for self-provisioning.");
  process.exit(2);
}

let sourceSha = process.env.IKIMON_EXPECTED_GIT_SHA?.trim();
if (!sourceSha) {
  sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: platformRoot, encoding: "utf8" }).trim();
}

const executable = process.platform === "win32"
  ? path.join(platformRoot, "node_modules", ".bin", "playwright.cmd")
  : path.join(platformRoot, "node_modules", ".bin", "playwright");
if (!existsSync(executable)) {
  console.error("Playwright executable is missing; run npm ci in platform_v2 first.");
  process.exit(2);
}

const args = [
  "test",
  "-c",
  "playwright.browser-run.config.ts",
  "e2e/record-funnel.staging.spec.ts",
  "--grep",
  intentionalFailure
    ? "photo record funnel emits KPI and revisit CTA \\(desktop-1440\\)"
    : "photo record funnel emits KPI and revisit CTA",
  ...passthrough,
];
const env = {
  ...process.env,
  STAGING_BASE_URL: process.env.STAGING_BASE_URL?.trim()
    || "https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev",
  BROWSER_RUNTIME: "cloudflare",
  IKIMON_EXPECTED_GIT_SHA: sourceSha,
  BROWSER_RUN_DIAGNOSTICS: diagnostic ? "1" : "0",
  BROWSER_RUN_INTENTIONAL_FAILURE: intentionalFailure ? "1" : "0",
};
const result = spawnSync(executable, args, {
  cwd: platformRoot,
  env,
  stdio: "inherit",
});
const status = result.status ?? 1;

if (!intentionalFailure) process.exit(status);
if (status === 0) {
  console.error("Diagnostic command unexpectedly passed; intentional failure was not exercised.");
  process.exit(1);
}

async function findEvidence(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const results = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...await findEvidence(entryPath));
    else if (entry.name === "browser-run-evidence.json") results.push(entryPath);
  }
  return results;
}

const evidencePaths = await findEvidence(path.join(platformRoot, "test-results"));
if (evidencePaths.length === 0) {
  console.error("Diagnostic failure had no browser-run-evidence.json.");
  process.exit(1);
}
for (const evidencePath of evidencePaths) {
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  if (!evidence.recordingEnabled || !evidence.sessionId || !evidence.recordingReadback?.available) {
    console.error("Diagnostic evidence is incomplete: recording/session read-back was not confirmed.");
    process.exit(1);
  }
}
console.log("Diagnostic failure produced recording/session evidence for " + evidencePaths.length + " test result(s).");
