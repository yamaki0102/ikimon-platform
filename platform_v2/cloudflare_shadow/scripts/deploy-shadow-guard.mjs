import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const shadowWorkerUrl = "https://ikimon-life-cloudflare-shadow-lab.yamaki0102.workers.dev";
const defaultPreflightReportPath = ".deploy/shadow-preflight-latest.json";
const allowedArgs = new Set(["--execute", "--write-preflight-report", "--test-profile"]);
const args = new Map();

for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--")) continue;
  if (!allowedArgs.has(key)) {
    throw new Error(`Unknown shadow deploy guard argument: ${key}`);
  }
  args.set(key, value?.startsWith("--") ? "true" : (value ?? "true"));
  if (value && !value.startsWith("--")) index += 1;
}

const execute = args.get("--execute") === "true";
const writePreflightReportPath = args.get("--write-preflight-report") ?? (!execute ? defaultPreflightReportPath : "");
const testProfile = args.get("--test-profile") ?? "quick";
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

async function readShadowConfigSummary() {
  const raw = await readFile("wrangler.jsonc", "utf8");
  const config = JSON.parse(stripJsonComments(raw));
  const shadow = config.env?.shadow;
  const routes = shadow?.routes ?? [];
  const vars = shadow?.vars ?? {};
  const legacyOriginFallbackVars = configuredRetiredOriginFallbackVars(config);
  const failures = [];

  if (shadow?.name !== "ikimon-life-cloudflare-shadow-lab") failures.push("unexpected_shadow_worker_name");
  if (vars.ENVIRONMENT !== "shadow") failures.push("shadow_environment_var_missing");
  failures.push(...legacyOriginFallbackVars.map((key) => `retired_origin_fallback_var_present:${key}`));
  if (routes.length > 0) failures.push("shadow_env_must_not_define_routes");
  if (config.env?.production?.name !== "ikimon-life-cloudflare-prod") failures.push("production_env_missing_but_not_targeted");

  if (failures.length) {
    throw new Error(`Shadow Cloudflare config safety check failed: ${failures.join(", ")}`);
  }

  return {
    workerName: shadow.name,
    environment: vars.ENVIRONMENT,
    legacyOriginFallbackVars,
    routeCount: routes.length
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
  const listed = await gitText(["ls-files", "--", "src", "scripts/deploy-shadow-guard.mjs", "wrangler.jsonc", "package.json", "package-lock.json", "tsconfig.json"]);
  const files = listed.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).sort();
  return hashFiles(files);
}

async function currentDeployState() {
  const gitHead = await gitText(["rev-parse", "HEAD"]);
  const gitStatus = await gitText(["status", "--porcelain", "--", "src", "scripts/deploy-shadow-guard.mjs", "wrangler.jsonc", "package.json", "package-lock.json", "tsconfig.json"]);
  return {
    gitHead,
    gitStatus,
    clean: gitStatus.length === 0,
    deployInputSha256: await hashDeployInputs(),
    packageLockSha256: await hashFiles(["package.json", "package-lock.json"]),
    shadowConfig: await readShadowConfigSummary()
  };
}

async function smoke(baseUrl) {
  const checks = [
    { path: "/health", service: undefined },
    { path: "/healthz", service: "ikimon-life-cloudflare-worker" },
    { path: "/readyz", service: "ikimon-life-cloudflare-worker" },
    { path: "/api/v1/runtime/version", service: "ikimon.life", runtime: "cloudflare-worker" }
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
      && (!check.runtime || payload.runtime === check.runtime);
    events.push({
      command: `smoke ${baseUrl}${check.path}`,
      exitCode: ok ? 0 : 1,
      status: response.status,
      contentType,
      durationMs: 0
    });
    if (!ok) {
      throw new Error(`Shadow smoke failed for ${baseUrl}${check.path}: ${response.status} ${contentType}`);
    }
  }
}

const startedAt = new Date().toISOString();
let state;
try {
  state = await currentDeployState();
  await run("npm", ["run", "check"]);
  await run("npm", ["run", testProfile === "full" ? "test:full" : "test:quick"]);
  await run("npm", ["run", "wrangler:check"]);
  await run("npx", ["wrangler", "deploy", "--dry-run", "--env", "shadow"]);

  if (execute) {
    await run("npx", ["wrangler", "deploy", "--env", "shadow"]);
    await smoke(shadowWorkerUrl);
  }

  const report = {
    status: execute ? "shadow_deployed_and_smoked" : "shadow_preflight_pass",
    checkedAt: startedAt,
    executedAt: execute ? new Date().toISOString() : null,
    testProfile,
    shadowWorkerUrl,
    noProductionMutation: true,
    noDnsChange: true,
    noVpsSsh: true,
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
    status: "shadow_preflight_failed",
    checkedAt: startedAt,
    testProfile,
    shadowWorkerUrl,
    noProductionMutation: true,
    noDnsChange: true,
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
