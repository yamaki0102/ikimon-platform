import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cloudflareRoot = path.join(platformRoot, "cloudflare_shadow");
const diagnostic = process.argv.includes("--diagnostics");
const intentionalFailure = process.argv.includes("--intentional-failure");
const passthrough = process.argv.filter((arg) => arg !== "--diagnostics" && arg !== "--intentional-failure");
const defaultBrowserRunStagingUrl = "https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev";

function wranglerCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function readWranglerAuthToken() {
  try {
    const raw = execFileSync(
      wranglerCommand(),
      ["wrangler", "auth", "token", "--json"],
      {
        cwd: cloudflareRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const parsed = JSON.parse(raw);
    return typeof parsed?.token === "string" ? parsed.token.trim() : "";
  } catch {
    return "";
  }
}

async function resolveCloudflareAccountId(token) {
  const configured = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (configured) return configured;
  if (!token) return "";

  const response = await fetch("https://api.cloudflare.com/client/v4/accounts?per_page=50", {
    headers: {
      accept: "application/json",
      authorization: "Bearer " + token,
    },
  });
  if (!response.ok) {
    throw new Error("Cloudflare account discovery failed with HTTP " + response.status);
  }
  const payload = await response.json();
  const accounts = Array.isArray(payload?.result) ? payload.result : [];
  if (accounts.length !== 1 || typeof accounts[0]?.id !== "string") {
    throw new Error(
      accounts.length === 0
        ? "Cloudflare account discovery returned no accounts; set CLOUDFLARE_ACCOUNT_ID."
        : "Cloudflare account discovery returned multiple accounts; set CLOUDFLARE_ACCOUNT_ID explicitly.",
    );
  }
  return accounts[0].id.trim();
}

let token = process.env.CLOUDFLARE_BROWSER_RUN_API_TOKEN?.trim()
  || process.env.CLOUDFLARE_API_TOKEN?.trim()
  || "";
if (!token) token = readWranglerAuthToken();

const accountId = await resolveCloudflareAccountId(token);
const stagingBaseUrl = process.env.STAGING_BASE_URL?.trim() || defaultBrowserRunStagingUrl;
const missing = [
  !accountId && "CLOUDFLARE_ACCOUNT_ID",
  !token && "CLOUDFLARE_BROWSER_RUN_API_TOKEN or Wrangler OAuth login",
  !process.env.BROWSER_RUN_TEST_EMAIL?.trim() && "BROWSER_RUN_TEST_EMAIL",
  !process.env.BROWSER_RUN_TEST_PASSWORD?.trim() && "BROWSER_RUN_TEST_PASSWORD",
].filter(Boolean);

if (missing.length > 0) {
  console.error("Cloudflare Browser Run prerequisites are missing: " + missing.join(", "));
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
  BROWSER_RUNTIME: "cloudflare",
  CLOUDFLARE_ACCOUNT_ID: accountId,
  CLOUDFLARE_BROWSER_RUN_API_TOKEN: token,
  STAGING_BASE_URL: stagingBaseUrl,
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
