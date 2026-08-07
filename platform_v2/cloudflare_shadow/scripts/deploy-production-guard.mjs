import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const defaultPreflightReportPath = ".deploy/production-preflight-latest.json";
const defaultWranglerVersionCachePath = ".deploy/wrangler-version-cache.json";
const defaultMaxPreflightAgeMinutes = 360;
const allowedArgs = new Set([
  "--execute",
  "--approval",
  "--fast",
  "--preflight-report",
  "--test-profile",
  "--wrangler-version-cache",
  "--write-preflight-report",
  "--max-preflight-age-minutes"
]);
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (key.startsWith("--")) {
    if (!allowedArgs.has(key)) {
      throw new Error(`Unknown deploy guard argument: ${key}`);
    }
    args.set(key, value?.startsWith("--") ? "true" : (value ?? "true"));
    if (value && !value.startsWith("--")) index += 1;
  }
}

const execute = args.get("--execute") === "true";
const fast = args.get("--fast") === "true";
const preflightReportPath = args.get("--preflight-report") ?? defaultPreflightReportPath;
const wranglerVersionCachePath = args.get("--wrangler-version-cache") ?? defaultWranglerVersionCachePath;
const writePreflightReportPath = args.get("--write-preflight-report") ?? (!fast ? defaultPreflightReportPath : "");
const maxPreflightAgeMinutes = Number(args.get("--max-preflight-age-minutes") ?? String(defaultMaxPreflightAgeMinutes));
const testProfile = args.get("--test-profile") ?? "full";

if (execute) {
  throw new Error("production_execute_phase_entrypoint_required:scripts/run_cloudflare_production_worker_deploy.sh");
}
if (!Number.isFinite(maxPreflightAgeMinutes) || maxPreflightAgeMinutes < 1) {
  throw new Error("--max-preflight-age-minutes must be a positive number.");
}
if (!["full", "quick", "heavy"].includes(testProfile)) {
  throw new Error("--test-profile must be one of: full, quick, heavy.");
}

const events = [];

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const actualCommandLine = [command, ...commandArgs].join(" ");
    const eventCommandLine = options.eventCommandLine ?? actualCommandLine;
    const echo = options.echo !== false;
    const spawnOptions = { ...options };
    delete spawnOptions.echo;
    delete spawnOptions.eventCommandLine;
    const executable = process.platform === "win32" ? "cmd.exe" : command;
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", [command, ...commandArgs].map(quoteCmdArg).join(" ")]
      : commandArgs;
    const child = spawn(executable, args, {
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
      const event = {
        command: eventCommandLine,
        exitCode: code,
        durationMs: Date.now() - startedAt
      };
      events.push(event);
      if (code === 0) {
        resolve({ stdout, stderr, event });
      } else {
        const error = new Error(`${event.command} failed with exit code ${code}`);
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

async function readProductionConfigSummary() {
  const raw = await readFile("wrangler.jsonc", "utf8");
  const config = JSON.parse(stripJsonComments(raw));
  const production = config.env?.production;
  const routes = production?.routes ?? [];
  const vars = production?.vars ?? {};
  const d1Names = (production?.d1_databases ?? []).map((item) => item.database_name).sort();
  const r2Buckets = (production?.r2_buckets ?? []).map((item) => item.bucket_name).sort();
  const requiredRoutes = [
    "ikimon.life/*",
    "www.ikimon.life/*"
  ];
  const missingRoutes = requiredRoutes.filter((route) => !routes.includes(route));
  const stagingRoutes = routes.filter((route) => String(route).startsWith("staging.ikimon.life/"));
  const failures = [];
  if (production?.name !== "ikimon-life-cloudflare-prod") failures.push("unexpected_production_worker_name");
  if (vars.ENVIRONMENT !== "production") failures.push("production_environment_var_missing");
  if (vars.PUBLIC_WRITE_MODE !== "cloudflare_native") failures.push("public_write_mode_not_cloudflare_native");
  if (!d1Names.includes("ikimon_prod_core")) failures.push("missing_prod_core_d1");
  if (!d1Names.includes("ikimon_prod_observations_2026_06")) failures.push("missing_prod_observations_d1");
  if (!r2Buckets.includes("ikimon-prod-media")) failures.push("missing_prod_r2_bucket");
  failures.push(...missingRoutes.map((route) => `missing_route:${route}`));
  failures.push(...stagingRoutes.map((route) => `production_must_not_own_staging_route:${route}`));
  if (failures.length) {
    throw new Error(`Production Cloudflare config safety check failed: ${failures.join(", ")}`);
  }
  return {
    workerName: production.name,
    routes,
    publicWriteMode: vars.PUBLIC_WRITE_MODE,
    d1Names,
    r2Buckets
  };
}

async function gitText(args) {
  const result = await run("git", args, { echo: false });
  return result.stdout.trim();
}

async function currentDeployState() {
  const gitHead = await gitText(["rev-parse", "HEAD"]);
  const gitStatus = await gitText(["status", "--porcelain", "--", "src", "migrations", "scripts/deploy-production-guard.mjs", "wrangler.jsonc", "package.json", "package-lock.json", "tsconfig.json"]);
  const worktreeGitStatus = await gitText(["status", "--porcelain"]);
  const deployInputSha256 = await hashDeployInputs();
  const packageLockSha256 = await hashFiles(["package.json", "package-lock.json"]);
  const productionConfig = await readProductionConfigSummary();
  return {
    gitHead,
    gitStatus,
    clean: gitStatus.length === 0,
    worktreeGitStatus,
    worktreeClean: worktreeGitStatus.length === 0,
    deployInputSha256,
    packageLockSha256,
    productionConfig
  };
}

async function hashDeployInputs() {
  const listed = await gitText(["ls-files", "--", "src", "migrations", "scripts/deploy-production-guard.mjs", "wrangler.jsonc", "package.json", "package-lock.json", "tsconfig.json"]);
  const files = listed.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).sort();
  return hashFiles(files);
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

async function readJsonFile(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    return null;
  }
}

async function assertNoHardcodedSecrets() {
  const listed = await gitText(["ls-files", "--", "src", "wrangler.jsonc", "package.json", "package-lock.json"]);
  const files = listed
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item && !/\.test\.ts$/.test(item));
  const secretPattern = /(?:api[_-]?key|secret|password|token|private[_-]?key)\s*[:=]\s*["'][^"']{12,}["']/i;
  const findings = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (secretPattern.test(source)) findings.push(file);
  }
  if (findings.length) {
    throw new Error(`Refusing deploy: possible hardcoded secret in ${findings.join(", ")}`);
  }
}

async function readPreflightReport(path) {
  const report = JSON.parse(await readFile(path, "utf8"));
  if (!report || report.ok !== true) throw new Error("Preflight report is not ok.");
  return report;
}

function assertFreshPreflightReport(report, state) {
  if (report.gitHead !== state.gitHead) {
    throw new Error(`Fast deploy refused: preflight gitHead ${report.gitHead} does not match current ${state.gitHead}.`);
  }
  if (report.deployInputSha256 !== state.deployInputSha256) {
    throw new Error("Fast deploy refused: deploy input hash changed after preflight.");
  }
  const ageMinutes = (Date.now() - Date.parse(report.checkedAt)) / 60000;
  if (!Number.isFinite(ageMinutes) || ageMinutes > maxPreflightAgeMinutes) {
    throw new Error(`Fast deploy refused: preflight report is stale (${Math.round(ageMinutes)} minutes).`);
  }
  const profile = typeof report.testProfile === "string" ? report.testProfile : "full";
  const requiredCommands = ["npm run check", testCommandForProfile(profile).commandLine, "npx wrangler deploy --env production --dry-run"];
  const commandSet = new Set((report.events ?? []).map((event) => event.command));
  const missingCommands = requiredCommands.filter((command) => !commandSet.has(command));
  if (missingCommands.length) {
    throw new Error(`Fast deploy refused: preflight report missing ${missingCommands.join(", ")}.`);
  }
}

function testCommandForProfile(profile) {
  if (profile === "quick") return { command: "npm", args: ["run", "test:quick"], commandLine: "npm run test:quick" };
  if (profile === "heavy") return { command: "npm", args: ["run", "test:heavy"], commandLine: "npm run test:heavy" };
  return { command: "npm", args: ["test"], commandLine: "npm test" };
}

async function writePreflightReport(path, state) {
  const report = {
    ok: true,
    checkedAt: new Date().toISOString(),
    gitHead: state.gitHead,
    clean: state.clean,
    deployInputSha256: state.deployInputSha256,
    packageLockSha256: state.packageLockSha256,
    testProfile,
    productionConfig: state.productionConfig,
    requiredSafetyGates: [
      "typescript_check",
      testProfile === "quick" ? "worker_quick_test_suite" : testProfile === "heavy" ? "worker_heavy_test_suite" : "worker_full_test_suite",
      "wrangler_dry_run",
      "production_config_guard",
      "hardcoded_secret_scan"
    ],
    deferredSafetyGates: ["post_deploy_health_ready_smoke"],
    events
  };
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  events.push({
    command: `write preflight report ${path}`,
    exitCode: 0,
    durationMs: 0
  });
}

async function runWranglerVersionGate(state) {
  const cache = await readJsonFile(wranglerVersionCachePath);
  if (cache
    && cache.ok === true
    && cache.deployInputSha256 === state.deployInputSha256
    && cache.packageLockSha256 === state.packageLockSha256
    && typeof cache.version === "string"
    && cache.version.trim()) {
    process.stdout.write(`${cache.version.trim()}\n`);
    events.push({
      command: `npx wrangler --version (cached ${wranglerVersionCachePath})`,
      exitCode: 0,
      durationMs: 0,
      version: cache.version.trim(),
      checkedAt: cache.checkedAt
    });
    return cache.version.trim();
  }

  const result = await run("npx", ["--no-install", "wrangler", "--version"]);
  const version = result.stdout.trim().split(/\r?\n/).at(-1)?.trim() || "";
  const payload = {
    ok: true,
    checkedAt: new Date().toISOString(),
    version,
    deployInputSha256: state.deployInputSha256,
    packageLockSha256: state.packageLockSha256
  };
  await mkdir(dirname(resolve(wranglerVersionCachePath)), { recursive: true });
  await writeFile(wranglerVersionCachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  events.push({
    command: `write wrangler version cache ${wranglerVersionCachePath}`,
    exitCode: 0,
    durationMs: 0,
    version
  });
  return version;
}

const initialState = await currentDeployState();
await assertNoHardcodedSecrets();
if (fast) {
  const report = await readPreflightReport(preflightReportPath);
  assertFreshPreflightReport(report, initialState);
  events.push({
    command: `validate fast preflight ${preflightReportPath}`,
    exitCode: 0,
    durationMs: 0,
    checkedAt: report.checkedAt,
    gitHead: report.gitHead
  });
} else {
  await run("npm", ["run", "check"]);
  const testCommand = testCommandForProfile(testProfile);
  await run(testCommand.command, testCommand.args);
}
await runWranglerVersionGate(initialState);
await run("npx", ["--no-install", "wrangler", "deploy", "--env", "production", "--dry-run"], {
  eventCommandLine: "npx wrangler deploy --env production --dry-run"
});

if (!fast && writePreflightReportPath) {
  const finalState = await currentDeployState();
  await writePreflightReport(writePreflightReportPath, finalState);
}

console.log(JSON.stringify({
  ok: true,
  mode: "dry-run",
  lane: fast ? "fast" : `${testProfile}-preflight`,
  testProfile: fast ? undefined : testProfile,
  productionDeployExecuted: false,
  approvalRequiredForExecute: "APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY",
  preflightReport: fast ? preflightReportPath : (writePreflightReportPath || null),
  wranglerVersionCache: wranglerVersionCachePath,
  smokeTargets: [],
  events
}, null, 2));
