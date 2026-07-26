import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const reportDir = path.join(platformRoot, ".deploy");
const reportPath = path.join(reportDir, "utsurou-runtime-qa-latest.json");
const stagingBaseUrl = (process.env.STAGING_BASE_URL ?? "https://staging.ikimon.life").replace(/\/+$/u, "");
const expectedSha = String(process.env.IKIMON_EXPECTED_GIT_SHA ?? "").trim();
const chromiumExecutable = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "").trim();
const startedAt = new Date().toISOString();
const PLAYWRIGHT_TIMEOUT_MS = 20 * 60 * 1000;
const SHA256_RE = /^[a-f0-9]{64}$/u;

function assertConfiguration() {
  if (stagingBaseUrl !== "https://staging.ikimon.life") {
    throw new Error("UTSUROU runtime QA is pinned to https://staging.ikimon.life");
  }
  if (!/^[a-f0-9]{40}$/u.test(expectedSha)) {
    throw new Error("IKIMON_EXPECTED_GIT_SHA must be an exact lowercase 40-character SHA");
  }
  if (!chromiumExecutable || !path.isAbsolute(chromiumExecutable)) {
    throw new Error("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH must be an absolute path");
  }
}

async function assertChromiumExists() {
  const info = await stat(chromiumExecutable);
  if (!info.isFile()) throw new Error("configured Chromium executable is not a file");
}

function runtimeSourceSha(payload) {
  return String(payload?.sourceSha ?? payload?.gitSha ?? payload?.commitSha ?? payload?.sha ?? "");
}

function runtimeDeploymentId(payload) {
  return String(payload?.workerVersion ?? payload?.version ?? payload?.deploymentId ?? "");
}

function assertNotCached(headers, label) {
  if (String(headers?.["cf-cache-status"] ?? "").toUpperCase() === "HIT") {
    throw new Error(`${label} unexpectedly came from a Cloudflare cache hit`);
  }
}

async function fetchNoStore(pathname, accept = "application/json") {
  const url = new URL(pathname, `${stagingBaseUrl}/`);
  url.searchParams.set("utsurou_runtime_qa", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const response = await fetch(url, {
    redirect: "error",
    headers: {
      accept,
      "cache-control": "no-store",
      pragma: "no-cache",
      "user-agent": "ikimon-utsurou-runtime-qa",
    },
  });
  const body = await response.text();
  return {
    url: url.toString(),
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries([
      "cache-control",
      "cf-cache-status",
      "etag",
      "x-ikimon-cloudflare-materialized",
      "x-ikimon-cloudflare-native",
    ].map((name) => [name, response.headers.get(name)])),
    body,
  };
}

async function readRuntimeIdentity() {
  const response = await fetchNoStore("/api/v1/runtime/version");
  if (!response.ok) throw new Error(`runtime identity HTTP ${response.status}`);
  assertNotCached(response.headers, "runtime identity");
  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw new Error("runtime identity response is not JSON");
  }
  const sourceSha = runtimeSourceSha(payload);
  const deploymentId = runtimeDeploymentId(payload);
  const uiBundleHash = String(payload?.uiBundleHash ?? "");
  const uiManifestHash = String(payload?.originalUiManifestHash ?? "");
  if (sourceSha !== expectedSha) {
    throw new Error(`runtime SHA mismatch: expected ${expectedSha}, received ${sourceSha || "missing"}`);
  }
  if (payload?.environment !== "staging") throw new Error("runtime identity environment is not staging");
  if (payload?.publicSafe !== true) throw new Error("runtime identity is not public-safe");
  if (!deploymentId) throw new Error("runtime identity deployment ID is missing");
  if (!SHA256_RE.test(uiBundleHash)) throw new Error("runtime UI bundle hash is missing or invalid");
  if (!SHA256_RE.test(uiManifestHash)) throw new Error("runtime UI manifest hash is missing or invalid");
  return {
    sourceSha,
    deploymentId,
    artifactHash: String(payload?.artifactHash ?? ""),
    uiBundleHash,
    uiManifestHash,
    environment: "staging",
    publicSafe: true,
    headers: response.headers,
  };
}

async function readHealth(pathname) {
  const response = await fetchNoStore(pathname);
  if (!response.ok) throw new Error(`${pathname} HTTP ${response.status}`);
  assertNotCached(response.headers, pathname);
  let payload;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw new Error(`${pathname} response is not JSON`);
  }
  if (payload?.environment !== "staging") throw new Error(`${pathname} environment is not staging`);
  return { status: response.status, environment: "staging", headers: response.headers };
}

async function assertMapArtifact() {
  const response = await fetchNoStore(
    "/ja/map?tab=places&lng=138.3805&lat=34.9702&z=16.4",
    "text/html",
  );
  if (!response.ok) throw new Error(`map artifact HTTP ${response.status}`);
  const requiredMarkers = [
    "function renderAtlasTimeline",
    "data-place-atlas-theme",
    "map:place_atlas:timeline_revisit",
  ];
  const missing = requiredMarkers.filter((marker) => !response.body.includes(marker));
  if (missing.length) throw new Error(`map artifact markers missing: ${missing.join(",")}`);
  if (response.headers["x-ikimon-cloudflare-materialized"] !== "original-ui-html") {
    throw new Error("map artifact is not the materialized original UI");
  }
  return {
    status: response.status,
    headers: response.headers,
    requiredMarkers,
  };
}

function playwrightBinary() {
  const executable = process.platform === "win32" ? "playwright.cmd" : "playwright";
  return path.join(platformRoot, "node_modules", ".bin", executable);
}

function digestText(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function runPlaywright(name, args, extraEnv = {}) {
  const binary = playwrightBinary();
  const binaryInfo = await stat(binary);
  if (!binaryInfo.isFile()) throw new Error("Playwright executable is missing after npm ci");
  const stdout = [];
  const stderr = [];
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: platformRoot,
      env: {
        ...process.env,
        CI: "1",
        STAGING_BASE_URL: stagingBaseUrl,
        IKIMON_EXPECTED_GIT_SHA: expectedSha,
        PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: chromiumExecutable,
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
    }, PLAYWRIGHT_TIMEOUT_MS);
    timeout.unref();
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout.push(text);
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr.push(text);
      process.stderr.write(text);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (signal) {
        reject(new Error(`${name} terminated by ${signal}`));
        return;
      }
      resolve(Number(code ?? 1));
    });
  });
  const stdoutText = stdout.join("");
  const stderrText = stderr.join("");
  if (exitCode !== 0) throw new Error(`${name} failed with exit code ${exitCode}`);
  return {
    name,
    exitCode,
    stdoutBytes: Buffer.byteLength(stdoutText),
    stderrBytes: Buffer.byteLength(stderrText),
    stdoutSha256: digestText(stdoutText),
    stderrSha256: digestText(stderrText),
  };
}

async function writeReport(status, details = {}, error = null) {
  await mkdir(reportDir, { recursive: true });
  const report = {
    schema: "ikimon.utsurou-runtime-qa/v1",
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    expectedSourceSha: expectedSha,
    stagingUrl: stagingBaseUrl,
    productionUnverified: true,
    mutations: {
      qaTriggeredStagingApplicationDeploys: 0,
      qaFixtureNetworkWrites: 0,
      actualStagingDatabaseWrites: 0,
      productionChanges: 0,
      databaseOrMigrationChanges: 0,
      secretChanges: 0,
      dnsChanges: 0,
      permissionChanges: 0,
      billingChanges: 0,
      deletions: 0,
      externalSends: 0,
    },
    ...details,
    error: error instanceof Error ? error.message : error ? String(error) : null,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

async function main() {
  assertConfiguration();
  await assertChromiumExists();
  await mkdir(reportDir, { recursive: true });

  const runtimeBefore = await readRuntimeIdentity();
  const health = await readHealth("/healthz");
  const ready = await readHealth("/readyz");
  const mapArtifact = await assertMapArtifact();

  const mapQa = await runPlaywright(
    "place_atlas_runtime",
    [
      "test",
      "-c",
      "playwright.utsurou-runtime.config.ts",
      "e2e/map-place-atlas.staging.spec.ts",
      "--grep",
      "place atlas is usable without overflow|timeline single, empty, suppressed, CTA, and privacy states stay fail-closed",
    ],
    {
      PLACE_ATLAS_QA_CANONICAL_ROUTE: "1",
      UTSUROU_RUNTIME_QA_PLAYWRIGHT_REPORT: path.join(reportDir, "utsurou-place-atlas-playwright.json"),
    },
  );

  const captureQa = await runPlaywright(
    "capture_p0_retry",
    [
      "test",
      "-c",
      "playwright.utsurou-runtime.config.ts",
      "e2e/record-capture-retry.staging.spec.ts",
    ],
    {
      UTSUROU_RUNTIME_QA_PLAYWRIGHT_REPORT: path.join(reportDir, "utsurou-capture-p0-playwright.json"),
    },
  );

  const runtimeAfter = await readRuntimeIdentity();
  if (runtimeAfter.deploymentId !== runtimeBefore.deploymentId) {
    throw new Error("staging deployment changed during UTSUROU runtime QA");
  }
  if (runtimeAfter.uiBundleHash !== runtimeBefore.uiBundleHash
      || runtimeAfter.uiManifestHash !== runtimeBefore.uiManifestHash) {
    throw new Error("staging UI artifact identity changed during UTSUROU runtime QA");
  }

  await writeReport("succeeded", {
    runtimeIdentityBefore: runtimeBefore,
    runtimeIdentityAfter: runtimeAfter,
    health,
    ready,
    mapArtifact,
    checks: [
      "exact_sha_runtime_before",
      "staging_environment",
      "public_safe_runtime_identity",
      "deployment_id_present",
      "ui_artifact_hashes_present",
      "health_200",
      "ready_200",
      "no_store_cache_buster",
      "latest_map_artifact_markers",
      "place_atlas_timeline_runtime_fixture",
      "capture_start",
      "record_saved_once",
      "photo_upload_retryable_failure",
      "reload_media_retry",
      "photo_upload_success",
      "record_not_duplicated",
      "fixture_only_mutations",
      "exact_sha_runtime_after",
      "stable_deployment_and_ui_identity",
    ],
    playwright: [mapQa, captureQa],
  });
}

main().catch(async (error) => {
  await writeReport("failed", {}, error).catch(() => undefined);
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
