import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const requiredApproval = "APPROVE_IKIMON_CF_RECORD_DETAIL_PREVIEW_WORKER_DEPLOY";
const workerPrefix = "ikimon-rec-preview";
const defaultPreflightReportPath = ".deploy/record-detail-preview-preflight-latest.json";
const defaultPreviewConfigPath = ".deploy/record-detail-preview-wrangler.jsonc";
const allowedArgs = new Set([
  "--execute",
  "--approval",
  "--branch",
  "--write-preflight-report",
  "--test-profile",
  "--config-only",
  "--preview-config"
]);
const args = new Map();

for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--")) continue;
  if (!allowedArgs.has(key)) {
    throw new Error(`Unknown record detail preview deploy guard argument: ${key}`);
  }
  args.set(key, value?.startsWith("--") ? "true" : (value ?? "true"));
  if (value && !value.startsWith("--")) index += 1;
}

const execute = args.get("--execute") === "true";
const configOnly = args.get("--config-only") === "true";
const approval = args.get("--approval") ?? process.env.IKIMON_CF_RECORD_DETAIL_PREVIEW_DEPLOY_APPROVAL ?? "";
const writePreflightReportPath = args.get("--write-preflight-report") ?? defaultPreflightReportPath;
const testProfile = args.get("--test-profile") ?? "quick";
const previewConfigPath = args.get("--preview-config") ?? defaultPreviewConfigPath;

if (execute && approval !== requiredApproval) {
  throw new Error(`Refusing record detail preview deploy. Pass --approval ${requiredApproval} or set IKIMON_CF_RECORD_DETAIL_PREVIEW_DEPLOY_APPROVAL.`);
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
  const listed = await gitText(["ls-files", "--", "src", "scripts/deploy-record-detail-preview-guard.mjs", "wrangler.jsonc", "package.json", "package-lock.json", "tsconfig.json"]);
  const files = listed.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).sort();
  return hashFiles(files);
}

async function currentBranchName() {
  const explicit = args.get("--branch") ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? "";
  if (explicit.trim()) return explicit.trim();
  const branch = await gitText(["branch", "--show-current"]);
  if (branch.trim()) return branch.trim();
  return gitText(["rev-parse", "--short", "HEAD"]);
}

function workerNameForBranch(branch) {
  const maxWorkerNameLength = 54;
  const hashLength = 8;
  const separatorLength = 2;
  const maxSlugLength = maxWorkerNameLength - workerPrefix.length - separatorLength - hashLength;
  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxSlugLength)
    .replace(/-$/g, "") || "branch";
  const hash = createHash("sha256").update(branch).digest("hex").slice(0, 8);
  return `${workerPrefix}-${slug}-${hash}`.slice(0, maxWorkerNameLength).replace(/-$/g, "");
}

async function readStagingPreviewConfigSource() {
  const raw = await readFile("wrangler.jsonc", "utf8");
  const config = JSON.parse(stripJsonComments(raw));
  const staging = config.env?.staging;
  const production = config.env?.production;
  const failures = [];
  const stagingVars = staging?.vars ?? {};
  const d1Names = (staging?.d1_databases ?? []).map((item) => item.database_name).sort();
  const r2Buckets = (staging?.r2_buckets ?? []).map((item) => item.bucket_name).sort();

  if (staging?.name !== "ikimon-life-cloudflare-staging") failures.push("unexpected_staging_worker_name");
  if (stagingVars.ENVIRONMENT !== "staging") failures.push("staging_environment_var_missing");
  if (stagingVars.PUBLIC_WRITE_MODE !== "cloudflare_native") failures.push("staging_public_write_mode_not_cloudflare_native");
  if (!d1Names.includes("ikimon_shadow_core")) failures.push("missing_nonproduction_core_d1");
  if (!d1Names.includes("ikimon_shadow_observations_2026_06")) failures.push("missing_nonproduction_observations_d1");
  if (!r2Buckets.includes("ikimon-shadow-media")) failures.push("missing_nonproduction_r2_bucket");
  for (const route of production?.routes ?? []) {
    if (String(route).startsWith("staging.ikimon.life/")) {
      failures.push(`production_must_not_own_staging_route:${route}`);
    }
  }
  if (failures.length) {
    throw new Error(`Record detail preview source config safety check failed: ${failures.join(", ")}`);
  }

  return {
    compatibility_date: config.compatibility_date,
    observability: config.observability,
    vars: stagingVars,
    d1_databases: staging.d1_databases,
    r2_buckets: staging.r2_buckets
  };
}

async function writePreviewConfig(workerName) {
  const source = await readStagingPreviewConfigSource();
  const previewConfig = {
    "$schema": "../node_modules/wrangler/config-schema.json",
    name: workerName,
    main: "../src/index.ts",
    compatibility_date: source.compatibility_date,
    workers_dev: true,
    observability: source.observability,
    vars: {
      ...source.vars,
      ENVIRONMENT: "staging",
      PREVIEW_WORKER_KIND: "record-detail",
      PREVIEW_ROUTE_ISOLATION: "workers_dev_only"
    },
    d1_databases: source.d1_databases,
    r2_buckets: source.r2_buckets
  };
  await mkdir(dirname(previewConfigPath), { recursive: true });
  await writeFile(previewConfigPath, `${JSON.stringify(previewConfig, null, 2)}\n`, "utf8");
  return previewConfig;
}

async function currentDeployState(workerName, branch) {
  const gitHead = await gitText(["rev-parse", "HEAD"]);
  const gitStatus = await gitText(["status", "--porcelain", "--", "src", "scripts/deploy-record-detail-preview-guard.mjs", "wrangler.jsonc", "package.json", "package-lock.json", "tsconfig.json"]);
  return {
    gitHead,
    branch,
    workerName,
    workerUrl: `https://${workerName}.yamaki0102.workers.dev`,
    gitStatus,
    clean: gitStatus.length === 0,
    deployInputSha256: await hashDeployInputs(),
    packageLockSha256: await hashFiles(["package.json", "package-lock.json"])
  };
}

async function smoke(baseUrl) {
  const smokeRetryAttempts = 12;
  const smokeRetryDelayMs = 5000;
  for (const path of ["/healthz", "/readyz"]) {
    let lastStatus = 0;
    let lastContentType = "";
    for (let attempt = 1; attempt <= smokeRetryAttempts; attempt += 1) {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
        redirect: "manual",
        headers: { accept: "application/json", "cache-control": "no-store" }
      });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json") ? await response.json() : {};
      const ok = response.ok
        && typeof payload === "object"
        && payload !== null
        && payload.ok === true
        && payload.service === "ikimon-life-cloudflare-worker"
        && payload.environment === "staging";
      lastStatus = response.status;
      lastContentType = contentType;
      events.push({
        command: `smoke ${baseUrl}${path}`,
        exitCode: ok ? 0 : 1,
        status: response.status,
        contentType,
        attempt,
        durationMs: 0
      });
      if (ok) break;
      if (attempt === smokeRetryAttempts) {
        throw new Error(`Record detail preview smoke failed for ${baseUrl}${path}: ${lastStatus} ${lastContentType}`);
      }
      await new Promise((resolve) => setTimeout(resolve, smokeRetryDelayMs));
    }
  }
}

const startedAt = new Date().toISOString();
let state;
try {
  const branch = await currentBranchName();
  const workerName = workerNameForBranch(branch);
  const previewConfig = await writePreviewConfig(workerName);
  state = await currentDeployState(workerName, branch);

  if (!configOnly) {
    await run("npm", ["run", "check"]);
    await run("npm", ["run", testProfile === "full" ? "test:full" : "test:quick"]);
    await run("npx", ["wrangler", "deploy", "--config", previewConfigPath, "--dry-run"]);
    if (execute) {
      await run("npx", ["wrangler", "deploy", "--config", previewConfigPath]);
      await smoke(state.workerUrl);
    }
  }

  const report = {
    status: configOnly ? "record_detail_preview_config_ready" : execute ? "record_detail_preview_deployed_and_smoked" : "record_detail_preview_preflight_pass",
    checkedAt: startedAt,
    executedAt: execute ? new Date().toISOString() : null,
    testProfile,
    previewConfigPath,
    noProductionDataMutation: true,
    noSharedStagingRoute: true,
    noVpsSsh: true,
    noCronTriggers: true,
    noQueueConsumers: true,
    previewConfigSummary: {
      name: previewConfig.name,
      workersDev: previewConfig.workers_dev,
      routes: previewConfig.routes ?? [],
      triggers: previewConfig.triggers ?? null,
      queues: previewConfig.queues ?? null,
      d1Names: previewConfig.d1_databases.map((item) => item.database_name).sort(),
      r2Buckets: previewConfig.r2_buckets.map((item) => item.bucket_name).sort()
    },
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
    status: "record_detail_preview_preflight_failed",
    checkedAt: startedAt,
    testProfile,
    noProductionDataMutation: true,
    noSharedStagingRoute: true,
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
