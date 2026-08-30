import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { assertStagingExecuteState } from "./staging-deploy-state-gate.mjs";
import { waitForExactStagingRuntimeVersion } from "./staging-runtime-smoke.mjs";

const requiredApproval = "APPROVE_IKIMON_CF_STAGING_WORKER_DEPLOY";
const stagingWorkerUrl = "https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev";
const stagingPublicUrl = "https://staging.ikimon.life";
const defaultPreflightReportPath = ".deploy/staging-preflight-latest.json";
const allowedArgs = new Set(["--execute", "--approval", "--write-preflight-report", "--test-profile"]);
const args = new Map();

for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--")) continue;
  if (!allowedArgs.has(key)) {
    throw new Error(`Unknown staging deploy guard argument: ${key}`);
  }
  args.set(key, value?.startsWith("--") ? "true" : (value ?? "true"));
  if (value && !value.startsWith("--")) index += 1;
}

const execute = args.get("--execute") === "true";
const approval = args.get("--approval") ?? process.env.IKIMON_CF_STAGING_DEPLOY_APPROVAL ?? "";
const writePreflightReportPath = args.get("--write-preflight-report") ?? (!execute ? defaultPreflightReportPath : "");
const testProfile = args.get("--test-profile") ?? "quick";

if (execute && approval !== requiredApproval) {
  throw new Error(`Refusing staging deploy. Pass --approval ${requiredApproval} or set IKIMON_CF_STAGING_DEPLOY_APPROVAL.`);
}
if (!["quick", "full"].includes(testProfile)) {
  throw new Error("--test-profile must be one of: quick, full.");
}

const events = [];

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const commandLine = [command, ...commandArgs].join(" ");
    const echo = options.echo !== false;
    const spawnOptions = { ...options };
    delete spawnOptions.echo;
    const executable = process.platform === "win32" ? "cmd.exe" : command;
    const argsForSpawn = process.platform === "win32"
      ? ["/d", "/s", "/c", [command, ...commandArgs].map(quoteCmdArg).join(" ")]
      : commandArgs;
    const child = spawn(executable, argsForSpawn, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      ...spawnOptions
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (echo) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (echo) process.stderr.write(chunk);
    });
    child.on("close", (code) => {
      const event = { command: commandLine, exitCode: code, durationMs: Date.now() - startedAt };
      events.push(event);
      if (code === 0) {
        resolve({ stdout, stderr, event });
      } else {
        const error = new Error(`${commandLine} failed with exit code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.event = event;
        reject(error);
      }
    });
  });
}

function quoteCmdArg(value) {
  if (/^[A-Za-z0-9_/:.=+-]+$/.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}

function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inString) {
      output += char;
      escaped = !escaped && char === "\\";
      if (!escaped && char === "\"") inString = false;
      if (char !== "\\") escaped = false;
      continue;
    }
    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

const retiredOriginFallbackVars = [
  "ORIGIN_FALLBACK_BASE_URL",
  "ORIGIN_FALLBACK_RESOLVE_OVERRIDE",
  "PUBLIC_CUSTOM_DOMAIN_ORIGIN_FALLBACK_MODE",
  "ORIGIN_SESSION_IMPORT_MODE",
  "PUBLIC_WRITE_MODE"
];

function configuredRetiredOriginFallbackVars(config) {
  const scopes = [["default", config.vars ?? {}], ...Object.entries(config.env ?? {}).map(([name, value]) => [name, value?.vars ?? {}])];
  return scopes.flatMap(([scope, vars]) => retiredOriginFallbackVars
    .filter((key) => Object.hasOwn(vars, key))
    .map((key) => `${scope}:${key}`));
}

function isWranglerStagingTriggerWarning(error) {
  const output = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}`;
  return output.includes("Uploaded ikimon-life-cloudflare-staging")
    && output.includes("Some triggers failed to deploy for ikimon-life-cloudflare-staging")
    && output.includes("/workers/routes")
    && output.includes("All Zones");
}

function summarizeWranglerTriggerWarning(error) {
  const output = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}`;
  const failedEndpoints = [...output.matchAll(/A request to the Cloudflare API \(([^)]+)\) failed\./g)]
    .map((match) => match[1]);
  return {
    kind: "wrangler_trigger_warning",
    tolerated: true,
    reason: "Worker upload succeeded, but Cloudflare route or queue trigger updates returned warnings. Existing staging triggers are verified by smoke checks.",
    failedEndpoints
  };
}

async function readStagingConfigSummary() {
  const raw = await readFile("wrangler.jsonc", "utf8");
  const config = JSON.parse(stripJsonComments(raw));
  const staging = config.env?.staging;
  const production = config.env?.production;
  const routes = staging?.routes ?? [];
  const productionRoutes = production?.routes ?? [];
  const vars = staging?.vars ?? {};
  const legacyOriginFallbackVars = configuredRetiredOriginFallbackVars(config);
  const d1Names = (staging?.d1_databases ?? []).map((item) => item.database_name).sort();
  const r2Buckets = (staging?.r2_buckets ?? []).map((item) => item.bucket_name).sort();
  const producerQueues = (staging?.queues?.producers ?? []).map((item) => item.queue).sort();
  const consumerQueues = (staging?.queues?.consumers ?? []).map((item) => item.queue).sort();
  const failures = [];

  if (staging?.name !== "ikimon-life-cloudflare-staging") failures.push("unexpected_staging_worker_name");
  if (!routes.includes("staging.ikimon.life/*")) failures.push("missing_staging_route");
  if (vars.ENVIRONMENT !== "staging") failures.push("staging_environment_var_missing");
  failures.push(...legacyOriginFallbackVars.map((key) => `retired_origin_fallback_var_present:${key}`));
  if (!d1Names.includes("ikimon_shadow_core")) failures.push("missing_nonproduction_core_d1");
  if (!d1Names.includes("ikimon_shadow_observations_2026_06")) failures.push("missing_nonproduction_observations_d1");
  if (!r2Buckets.includes("ikimon-shadow-media")) failures.push("missing_nonproduction_r2_bucket");
  if (!producerQueues.includes("ikimon-staging-media-jobs")) failures.push("missing_staging_media_queue_producer");
  if (!consumerQueues.includes("ikimon-staging-media-jobs")) failures.push("missing_staging_media_queue_consumer");
  if (producerQueues.includes("ikimon-prod-media-jobs") || consumerQueues.includes("ikimon-prod-media-jobs")) failures.push("staging_must_not_use_production_queue");
  if (producerQueues.includes("ikimon-shadow-media-jobs") || consumerQueues.includes("ikimon-shadow-media-jobs")) failures.push("staging_must_not_share_shadow_queue_consumer");
  for (const route of productionRoutes) {
    if (String(route).startsWith("staging.ikimon.life/")) {
      failures.push(`production_must_not_own_staging_route:${route}`);
    }
  }

  if (failures.length) {
    throw new Error(`Staging Cloudflare config safety check failed: ${failures.join(", ")}`);
  }

  return {
    workerName: staging.name,
    routes,
    environment: vars.ENVIRONMENT,
    legacyOriginFallbackVars,
    d1Names,
    r2Buckets,
    producerQueues,
    consumerQueues,
    productionStagingRouteCount: productionRoutes.filter((route) => String(route).startsWith("staging.ikimon.life/")).length
  };
}

async function gitText(commandArgs) {
  const result = await run("git", commandArgs, { echo: false });
  return result.stdout.trim();
}

async function hashFiles(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function hashDeployInputs() {
  const listed = await gitText(["ls-files", "--", "src", "scripts/deploy-staging-guard.mjs", "scripts/staging-deploy-state-gate.mjs", "scripts/staging-runtime-smoke.mjs", "wrangler.jsonc", "package.json", "package-lock.json", "tsconfig.json"]);
  const files = listed.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).sort();
  return hashFiles(files);
}

async function currentDeployState() {
  const gitHead = await gitText(["rev-parse", "HEAD"]);
  const gitStatus = await gitText(["status", "--porcelain", "--", "src", "scripts/deploy-staging-guard.mjs", "scripts/staging-deploy-state-gate.mjs", "scripts/staging-runtime-smoke.mjs", "wrangler.jsonc", "package.json", "package-lock.json", "tsconfig.json"]);
  return {
    gitHead,
    gitStatus,
    clean: gitStatus.length === 0,
    deployInputSha256: await hashDeployInputs(),
    packageLockSha256: await hashFiles(["package.json", "package-lock.json"]),
    stagingConfig: await readStagingConfigSummary()
  };
}

async function smoke(baseUrl, expectedSha) {
  const checks = [
    { path: "/health", service: undefined },
    { path: "/healthz", service: "ikimon-life-cloudflare-worker", environment: "staging" },
    { path: "/readyz", service: "ikimon-life-cloudflare-worker", environment: "staging" }
  ];
  for (const check of checks) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${check.path}`, {
      redirect: "manual",
      headers: { accept: "application/json", "cache-control": "no-store" }
    });
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await response.json() : {};
    const ok = response.ok
      && typeof payload === "object"
      && payload !== null
      && payload.ok === true
      && (!check.service || payload.service === check.service)
      && (!check.environment || payload.environment === check.environment);
    events.push({
      command: `smoke ${baseUrl}${check.path}`,
      exitCode: ok ? 0 : 1,
      status: response.status,
      contentType,
      durationMs: 0
    });
    if (!ok) {
      throw new Error(`Staging smoke failed for ${baseUrl}${check.path}: ${response.status} ${contentType}`);
    }
  }
  await waitForExactStagingRuntimeVersion({
    baseUrl,
    expectedSha,
    onAttempt: (event) => events.push(event)
  });
}

const startedAt = new Date().toISOString();
let state;
let triggerWarning = null;
try {
  state = await currentDeployState();
  assertStagingExecuteState({ execute, before: state, after: state, phase: "start" });
  const releaseVars = {
    IKIMON_GIT_SHA: state.gitHead,
    IKIMON_WORKER_VERSION: `cloudflare-executor-${state.gitHead.slice(0, 12)}`,
    IKIMON_DEPLOYED_AT: startedAt
  };
  const wranglerArgs = (dryRun = false) => {
    const values = ["wrangler", "deploy", "--env", "staging"];
    if (dryRun) values.push("--dry-run");
    for (const [key, value] of Object.entries(releaseVars)) values.push("--var", `${key}:${value}`);
    return values;
  };
  await run("npm", ["run", "check"]);
  await run("npm", ["run", testProfile === "full" ? "test:full" : "test:quick"]);
  await run("npm", ["run", "wrangler:check:staging"]);
  await run("npx", wranglerArgs(true));

  if (execute) {
    const preDeployState = await currentDeployState();
    assertStagingExecuteState({ execute, before: state, after: preDeployState, phase: "pre-deploy" });
    try {
      await run("npx", wranglerArgs(false));
    } catch (error) {
      if (!isWranglerStagingTriggerWarning(error)) {
        throw error;
      }
      triggerWarning = summarizeWranglerTriggerWarning(error);
      events.push({
        command: "npx wrangler deploy --env staging trigger warning",
        exitCode: 0,
        durationMs: 0,
        ...triggerWarning
      });
      console.warn(JSON.stringify(triggerWarning, null, 2));
    }
    await smoke(stagingWorkerUrl, state.gitHead);
    await smoke(stagingPublicUrl, state.gitHead);
  }

  const report = {
    status: execute
      ? (triggerWarning ? "staging_deployed_with_trigger_warning_and_smoked" : "staging_deployed_and_smoked")
      : "staging_preflight_pass",
    checkedAt: startedAt,
    executedAt: execute ? new Date().toISOString() : null,
    testProfile,
    stagingWorkerUrl,
    stagingPublicUrl,
    triggerWarning,
    noProductionDataMutation: true,
    noVpsSsh: true,
    releaseVars,
    ...state,
    events
  };
  if (writePreflightReportPath) {
    await mkdir(dirname(writePreflightReportPath), { recursive: true });
    await writeFile(writePreflightReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const report = {
    status: "staging_preflight_failed",
    checkedAt: startedAt,
    testProfile,
    stagingWorkerUrl,
    stagingPublicUrl,
    noProductionDataMutation: true,
    noVpsSsh: true,
    error: error instanceof Error ? error.message : String(error),
    state,
    events
  };
  if (writePreflightReportPath) {
    await mkdir(dirname(writePreflightReportPath), { recursive: true });
    await writeFile(writePreflightReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
}
