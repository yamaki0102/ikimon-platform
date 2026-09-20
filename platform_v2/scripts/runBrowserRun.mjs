import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const platformRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const diagnostic = process.argv.includes("--diagnostics");
const intentionalFailure = process.argv.includes("--intentional-failure");
const passthrough = process.argv.filter((arg) => arg !== "--diagnostics" && arg !== "--intentional-failure");
const listOnly = passthrough.includes("--list");
const defaultBrowserRunStagingUrl = "https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev";
const ephemeralStagingHosts = new Set([
  "ikimon-life-cloudflare-staging.yamaki0102.workers.dev",
  "staging.zukan.earth",
]);

function readWranglerAuthToken() {
  try {
    const command = process.platform === "win32" ? "cmd.exe" : "npx";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npx wrangler auth token --json"]
      : ["wrangler", "auth", "token", "--json"];
    const raw = execFileSync(command, args, {
      cwd: platformRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
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

function stagingRequestHeaders(baseUrl, options = {}) {
  const headers = {
    accept: "application/json",
    origin: new URL(baseUrl).origin,
  };
  if (options.json) headers["content-type"] = "application/json";

  const basicUser = process.env.STAGING_BASIC_AUTH_USER?.trim();
  const basicPass = process.env.STAGING_BASIC_AUTH_PASS?.trim();
  if (basicUser && basicPass) {
    headers.authorization = "Basic " + Buffer.from(basicUser + ":" + basicPass).toString("base64");
  }

  const accessId = process.env.CF_ACCESS_CLIENT_ID?.trim()
    || process.env.CLOUDFLARE_ACCESS_CLIENT_ID?.trim();
  const accessSecret = process.env.CF_ACCESS_CLIENT_SECRET?.trim()
    || process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET?.trim();
  if (Boolean(accessId) !== Boolean(accessSecret)) {
    throw new Error("Cloudflare Access client id and secret must be provided together.");
  }
  if (accessId && accessSecret) {
    headers["CF-Access-Client-Id"] = accessId;
    headers["CF-Access-Client-Secret"] = accessSecret;
  }
  if (options.cookie) headers.cookie = options.cookie;
  return headers;
}

function sessionCookieFromResponse(response) {
  const raw = response.headers.get("set-cookie") ?? "";
  return raw.match(/(?:^|,\s*)(ikimon_v2_session=[^;,\s]+)/)?.[1] ?? "";
}

async function provisionEphemeralStagingAccount(baseUrl) {
  const target = new URL(baseUrl);
  if (target.protocol !== "https:" || !ephemeralStagingHosts.has(target.hostname)) {
    throw new Error("Ephemeral Browser Run accounts are restricted to registered staging hosts.");
  }

  const fixtureId = "staging-session-smoke-browser-run-"
    + Date.now().toString(36) + "-" + randomBytes(4).toString("hex");
  const email = fixtureId + "@example.invalid";
  const password = "BrRun!" + randomBytes(24).toString("base64url") + "9a";
  const response = await fetch(new URL("/api/v1/auth/register", target.origin), {
    method: "POST",
    headers: stagingRequestHeaders(target.origin, { json: true }),
    body: JSON.stringify({
      displayName: "Browser Run Staging QA",
      email,
      password,
      redirect: "/record",
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true || typeof payload?.session?.userId !== "string" || !payload.session.userId) {
    throw new Error("Ephemeral Browser Run staging account registration failed with HTTP " + response.status);
  }
  const cookie = sessionCookieFromResponse(response);
  if (!cookie) {
    throw new Error("Ephemeral Browser Run staging account registration omitted the session cookie.");
  }
  return { email, password, cookie, userId: payload.session.userId };
}

async function cleanupEphemeralStagingAccount(baseUrl, cookie) {
  const target = new URL(baseUrl);
  const response = await fetch(new URL("/api/v1/ops/staging/browser-run/cleanup-self", target.origin), {
    method: "POST",
    headers: stagingRequestHeaders(target.origin, { json: true, cookie }),
    body: "{}",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    throw new Error("Ephemeral Browser Run staging account cleanup failed with HTTP " + response.status);
  }
}

let token = process.env.CLOUDFLARE_BROWSER_RUN_API_TOKEN?.trim()
  || process.env.CLOUDFLARE_API_TOKEN?.trim()
  || "";
if (!token) token = readWranglerAuthToken();

const accountId = await resolveCloudflareAccountId(token);
const stagingBaseUrl = process.env.STAGING_BASE_URL?.trim() || defaultBrowserRunStagingUrl;
const explicitEmail = process.env.BROWSER_RUN_TEST_EMAIL?.trim() || "";
const explicitPassword = process.env.BROWSER_RUN_TEST_PASSWORD?.trim() || "";
if (Boolean(explicitEmail) !== Boolean(explicitPassword)) {
  console.error("BROWSER_RUN_TEST_EMAIL and BROWSER_RUN_TEST_PASSWORD must be provided together.");
  process.exit(2);
}
const missing = [
  !accountId && "CLOUDFLARE_ACCOUNT_ID",
  !token && "CLOUDFLARE_BROWSER_RUN_API_TOKEN or Wrangler OAuth login",
].filter(Boolean);
if (missing.length > 0) {
  console.error("Cloudflare Browser Run prerequisites are missing: " + missing.join(", "));
  process.exit(2);
}

let sourceSha = process.env.IKIMON_EXPECTED_GIT_SHA?.trim();
if (!sourceSha) {
  sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: platformRoot, encoding: "utf8" }).trim();
}

const playwrightCli = path.join(platformRoot, "node_modules", "@playwright", "test", "cli.js");
if (!existsSync(playwrightCli)) {
  console.error("Playwright CLI is missing; run npm ci in platform_v2 first.");
  process.exit(2);
}

let account = null;
let runEmail = explicitEmail;
let runPassword = explicitPassword;
if (!runEmail && !runPassword) {
  if (listOnly) {
    runEmail = "browser-run-discovery@example.invalid";
    runPassword = "browser-run-discovery-not-used";
  } else {
    account = await provisionEphemeralStagingAccount(stagingBaseUrl);
    runEmail = account.email;
    runPassword = account.password;
    console.log("Ephemeral Browser Run staging account created.");
  }
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
  BROWSER_RUN_TEST_EMAIL: runEmail,
  BROWSER_RUN_TEST_PASSWORD: runPassword,
  BROWSER_RUN_EXPECTED_RUNTIME_SHA: process.env.BROWSER_RUN_EXPECTED_RUNTIME_SHA?.trim() || sourceSha,
  IKIMON_EXPECTED_GIT_SHA: sourceSha,
  BROWSER_RUN_DIAGNOSTICS: diagnostic ? "1" : "0",
  BROWSER_RUN_INTENTIONAL_FAILURE: intentionalFailure ? "1" : "0",
};

let status = 1;
let cleanupFailed = false;
try {
  const result = spawnSync(process.execPath, [playwrightCli, ...args], {
    cwd: platformRoot,
    env,
    stdio: "inherit",
  });
  status = result.status ?? 1;
} finally {
  if (account) {
    try {
      await cleanupEphemeralStagingAccount(stagingBaseUrl, account.cookie);
      console.log("Ephemeral Browser Run staging account cleaned.");
    } catch (error) {
      cleanupFailed = true;
      console.error(error instanceof Error ? error.message : "Ephemeral Browser Run staging account cleanup failed.");
    }
  }
}

if (!intentionalFailure) process.exit(cleanupFailed ? 1 : status);
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
if (cleanupFailed) process.exit(1);
console.log("Diagnostic failure produced recording/session evidence for " + evidencePaths.length + " test result(s).");
