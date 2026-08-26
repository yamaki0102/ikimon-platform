import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const reportDir = path.join(platformRoot, ".deploy");
const reportPath = path.join(reportDir, "zukan-runtime-qa-latest.json");
const materializationReportPath = path.resolve(
  process.env.ZUKAN_MATERIALIZATION_REPORT_PATH?.trim()
    || path.join(platformRoot, "cloudflare_shadow", "materialize-staging-original-ui.json"),
);
const stagingBaseUrl = (process.env.STAGING_BASE_URL ?? "https://staging.zukan.earth").replace(/\/+$/u, "");
const expectedSha = String(process.env.IKIMON_EXPECTED_GIT_SHA ?? "").trim();
const chromiumExecutable = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "").trim();
const materializationNotBefore = String(process.env.ZUKAN_MATERIALIZATION_NOT_BEFORE ?? "").trim();
const startedAt = new Date().toISOString();
const PLAYWRIGHT_TIMEOUT_MS = 20 * 60 * 1000;
const SHA256_RE = /^[a-f0-9]{64}$/u;
const MAX_REPORT_BYTES = 2 * 1024 * 1024;
const MATERIALIZATION_MANIFEST_KEY = "original-ui/materialize-manifest/staging/staging-qa.json";
const MAP_KEYS = Object.freeze({
  "/ja/map": "original-ui/html/ja/map.html",
  "/en/map": "original-ui/html/en/map.html",
  "/es/map": "original-ui/html/es/map.html",
  "/pt-br/map": "original-ui/html/pt-br/map.html",
});

function assertConfiguration() {
  if (stagingBaseUrl !== "https://staging.zukan.earth") {
    throw new Error("ZUKAN runtime QA is pinned to https://staging.zukan.earth");
  }
  if (!/^[a-f0-9]{40}$/u.test(expectedSha)) {
    throw new Error("IKIMON_EXPECTED_GIT_SHA must be an exact lowercase 40-character SHA");
  }
  if (!chromiumExecutable || !path.isAbsolute(chromiumExecutable)) {
    throw new Error("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH must be an absolute path");
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(materializationNotBefore)
      || !Number.isFinite(Date.parse(materializationNotBefore))) {
    throw new Error("ZUKAN_MATERIALIZATION_NOT_BEFORE must be a UTC release timestamp");
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

function optionalHash(value, label) {
  const normalized = String(value ?? "");
  if (!normalized) return null;
  if (!SHA256_RE.test(normalized)) throw new Error(`${label} is invalid`);
  return normalized;
}

function assertNotCached(headers, label) {
  if (String(headers?.["cf-cache-status"] ?? "").toUpperCase() === "HIT") {
    throw new Error(`${label} unexpectedly came from a Cloudflare cache hit`);
  }
}

async function fetchNoStore(pathname, accept = "application/json") {
  const url = new URL(pathname, `${stagingBaseUrl}/`);
  url.searchParams.set("zukan_runtime_qa", expectedSha);
  const response = await fetch(url, {
    redirect: "error",
    headers: {
      accept,
      "cache-control": "no-store",
      pragma: "no-cache",
      "user-agent": "zukan-runtime-qa",
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
      "x-ikimon-cloudflare-materialized-sha256",
      "x-ikimon-cloudflare-native",
    ].map((name) => [name, response.headers.get(name)])),
    body,
  };
}

function parseJsonResponse(response, label) {
  try {
    return JSON.parse(response.body);
  } catch {
    throw new Error(`${label} response is not JSON`);
  }
}

async function readRuntimeIdentity() {
  const response = await fetchNoStore("/api/v1/runtime/version");
  if (!response.ok) throw new Error(`runtime identity HTTP ${response.status}`);
  assertNotCached(response.headers, "runtime identity");
  const payload = parseJsonResponse(response, "runtime identity");
  const sourceSha = runtimeSourceSha(payload);
  const deploymentId = runtimeDeploymentId(payload);
  if (sourceSha !== expectedSha) {
    throw new Error(`runtime SHA mismatch: expected ${expectedSha}, received ${sourceSha || "missing"}`);
  }
  if (payload?.environment !== "staging") throw new Error("runtime identity environment is not staging");
  if (payload?.publicSafe !== true) throw new Error("runtime identity is not public-safe");
  if (!deploymentId) throw new Error("runtime identity deployment ID is missing");
  return {
    stable: {
      sourceSha,
      deploymentId,
      artifactHash: optionalHash(payload?.artifactHash, "runtime artifact hash"),
      uiBundleHash: optionalHash(payload?.uiBundleHash, "runtime UI bundle hash"),
      uiManifestHash: optionalHash(payload?.originalUiManifestHash, "runtime UI manifest hash"),
      environment: "staging",
      publicSafe: true,
    },
    headers: response.headers,
  };
}

async function readHealth(pathname) {
  const response = await fetchNoStore(pathname);
  if (!response.ok) throw new Error(`${pathname} HTTP ${response.status}`);
  assertNotCached(response.headers, pathname);
  const payload = parseJsonResponse(response, pathname);
  if (payload?.environment !== "staging") throw new Error(`${pathname} environment is not staging`);
  return { status: response.status, environment: "staging", headers: response.headers };
}

async function readMaterializationIdentity() {
  const file = await stat(materializationReportPath);
  const notBeforeMs = Date.parse(materializationNotBefore);
  if (!file.isFile() || file.size < 2 || file.size > MAX_REPORT_BYTES) {
    throw new Error("materialization report is missing or outside the allowed size");
  }
  if (file.mtimeMs + 1_000 < notBeforeMs) {
    throw new Error("materialization report predates this release");
  }
  const text = await readFile(materializationReportPath, "utf8");
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("materialization report is not JSON");
  }
  if (result?.ok !== true
      || result?.mode !== "execute"
      || result?.r2WritesRequested !== true
      || result?.targetEnv !== "staging"
      || result?.scope !== "staging-qa"
      || result?.manifestKey !== MATERIALIZATION_MANIFEST_KEY
      || !SHA256_RE.test(String(result?.bundleHash ?? ""))
      || String(result?.sourceSha ?? "") !== expectedSha
      || result?.manifestUpload?.ok !== true
      || String(result.manifestUpload?.versionPrefix ?? "") !== `original-ui/versions/${result.bundleHash}`
      || result?.manifestUpload?.reason === "explicit_paths_not_finalized") {
    throw new Error("materialization report contract is invalid");
  }
  const manifestHash = String(result.manifestUpload?.sha256 ?? result.bundleHash);
  if (!SHA256_RE.test(manifestHash)) throw new Error("materialization manifest hash is invalid");
  if (!Array.isArray(result.rendered)) throw new Error("materialization rendered list is missing");
  const byKey = new Map();
  for (const entry of result.rendered) {
    const key = String(entry?.key ?? "");
    const sha256 = String(entry?.sha256 ?? "");
    if (!key || !SHA256_RE.test(sha256) || byKey.has(key)) {
      throw new Error("materialization rendered identity is invalid");
    }
    byKey.set(key, sha256);
  }
  const mapSha256ByPath = {};
  for (const [publicPath, key] of Object.entries(MAP_KEYS)) {
    const sha256 = byKey.get(key);
    if (!sha256) throw new Error(`materialization map entry is missing: ${key}`);
    mapSha256ByPath[publicPath] = sha256;
  }
  return {
    bundleHash: result.bundleHash,
    manifestHash,
    manifestKey: result.manifestKey,
    reportSha256: createHash("sha256").update(text).digest("hex"),
    reportMtime: new Date(file.mtimeMs).toISOString(),
    materializeSkipped: result.materializeSkipped === true,
    r2WritesExecuted: result.r2WritesExecuted === true,
    mapSha256ByPath,
  };
}

async function assertMapArtifact(materializationIdentity) {
  const response = await fetchNoStore(
    "/ja/map?tab=places&lng=138.3805&lat=34.9702&z=16.4",
    "text/html",
  );
  if (!response.ok) throw new Error(`map artifact HTTP ${response.status}`);
  assertNotCached(response.headers, "map artifact");
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
  const materializedSourceSha256 = String(response.headers["x-ikimon-cloudflare-materialized-sha256"] ?? "");
  if (!SHA256_RE.test(materializedSourceSha256)) {
    throw new Error("map artifact is missing the exact materialized source SHA");
  }
  if (materializedSourceSha256 !== materializationIdentity.mapSha256ByPath["/ja/map"]) {
    throw new Error("map artifact materialized source SHA does not match the fresh materialization report");
  }
  const transformedBodySha256 = createHash("sha256").update(response.body).digest("hex");
  return {
    status: response.status,
    headers: response.headers,
    materializedSourceSha256,
    transformedBodySha256,
    materializationKey: MAP_KEYS["/ja/map"],
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
      shell: process.platform === "win32",
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
    schema: "zukan.runtime-qa/v1",
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    expectedSourceSha: expectedSha,
    stagingUrl: stagingBaseUrl,
    productionUnverified: true,
    p0Ready: false,
    remainingP0Evidence: [
      "owner_edit_runtime_readback",
      "another_user_edit_denial",
      "ai_provider_failure_retry_success_runtime_readback",
      "public_precision_runtime_readback",
      "place_public_projection_runtime_readback",
      "android_and_iphone_physical_device_qa",
      "learn_and_contact_route_resolution",
    ],
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

  const materializationIdentity = await readMaterializationIdentity();
  const runtimeBefore = await readRuntimeIdentity();
  const health = await readHealth("/healthz");
  const ready = await readHealth("/readyz");
  const mapArtifact = await assertMapArtifact(materializationIdentity);

  const mapQa = await runPlaywright(
    "place_atlas_runtime",
    [
      "test",
      "-c",
      "playwright.zukan-runtime.config.ts",
      "e2e/place-atlas-runtime.zukan.staging.spec.ts",
    ],
    {
      ZUKAN_EXPECTED_MAP_SHA256_BY_PATH: JSON.stringify(materializationIdentity.mapSha256ByPath),
      ZUKAN_RUNTIME_QA_PLAYWRIGHT_REPORT: path.join(reportDir, "zukan-place-atlas-playwright.json"),
    },
  );

  const previewRecoveryQa = await runPlaywright(
    "preview_draft_recovery_fixture",
    [
      "test",
      "-c",
      "playwright.zukan-runtime.config.ts",
      "e2e/record-preview-draft-recovery.zukan.staging.spec.ts",
    ],
    {
      ZUKAN_RUNTIME_QA_PLAYWRIGHT_REPORT: path.join(reportDir, "zukan-preview-recovery-playwright.json"),
    },
  );

  const runtimeAfter = await readRuntimeIdentity();
  if (JSON.stringify(runtimeAfter.stable) !== JSON.stringify(runtimeBefore.stable)) {
    throw new Error("staging stable runtime identity changed during ZUKAN runtime QA");
  }

  await writeReport("succeeded_with_known_limits", {
    runtimeIdentityBefore: runtimeBefore,
    runtimeIdentityAfter: runtimeAfter,
    materializationIdentity,
    health,
    ready,
    mapArtifact,
    runtimeScope: "cloudflare_worker_native",
    scopeExclusions: [
      { path: "/iwata", reason: "fastify_route_not_registered_in_current_native_worker" },
      { path: "/api/regional-sources", reason: "fastify_route_not_registered_in_current_native_worker" },
    ],
    authenticatedCaptureQa: "unverified_requires_owner_session",
    checks: [
      "exact_sha_runtime_before_and_after",
      "stable_identity_fields_only",
      "staging_environment",
      "public_safe_runtime_identity",
      "deployment_id_present",
      "fresh_materialization_report",
      "materialized_source_sha_match",
      "place_atlas_timeline_runtime_fixture",
      "explicit_timeline_cta_click_and_kpi_fixture",
      "preview_draft_reload_recovery_fixture",
      "fixture_only_mutations",
    ],
    playwright: [mapQa, previewRecoveryQa],
  });
}

main().catch(async (error) => {
  await writeReport("failed", {}, error).catch(() => undefined);
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
