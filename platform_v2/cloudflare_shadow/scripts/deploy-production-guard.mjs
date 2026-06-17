import { spawn } from "node:child_process";

const requiredApproval = "APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY";
const productionWorkerUrl = "https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev";
const productionPublicUrl = "https://ikimon.life";
const allowedArgs = new Set(["--execute", "--approval"]);
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
const approval = args.get("--approval") ?? process.env.IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL ?? "";

if (execute && approval !== requiredApproval) {
  throw new Error(`Refusing production deploy. Pass --approval ${requiredApproval} or set IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL.`);
}

const events = [];

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const commandLine = [command, ...commandArgs].join(" ");
    const executable = process.platform === "win32" ? "cmd.exe" : command;
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", [command, ...commandArgs].map(quoteCmdArg).join(" ")]
      : commandArgs;
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("close", (code) => {
      const event = {
        command: commandLine,
        exitCode: code,
        durationMs: Date.now() - startedAt
      };
      events.push(event);
      if (code === 0) {
        resolve({ stdout, stderr, event });
      } else {
        reject(new Error(`${event.command} failed with exit code ${code}`));
      }
    });
  });
}

function quoteCmdArg(value) {
  if (/^[A-Za-z0-9_/:.=+-]+$/.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}

async function smoke(baseUrl) {
  for (const path of ["/healthz", "/readyz"]) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      redirect: "manual",
      headers: { accept: "application/json", "cache-control": "no-store" }
    });
    const contentType = response.headers.get("content-type") ?? "";
    let payload = {};
    if (contentType.includes("application/json")) {
      payload = await response.json();
    }
    const ok = response.ok
      && typeof payload === "object"
      && payload !== null
      && payload.ok === true
      && payload.service === "ikimon-life-cloudflare-worker";
    events.push({
      command: `smoke ${baseUrl}${path}`,
      exitCode: ok ? 0 : 1,
      durationMs: 0,
      status: response.status,
      contentType
    });
    if (!ok) {
      throw new Error(`Smoke failed for ${baseUrl}${path}: ${response.status} ${contentType}`);
    }
  }
}

await run("npm", ["run", "check"]);
await run("npm", ["test"]);
await run("npx", ["wrangler", "--version"]);
await run("npx", ["wrangler", "deploy", "--env", "production", "--dry-run"]);

if (execute) {
  await run("npx", ["wrangler", "deploy", "--env", "production"]);
  await smoke(productionWorkerUrl);
  await smoke(productionPublicUrl);
}

console.log(JSON.stringify({
  ok: true,
  mode: execute ? "execute" : "dry-run",
  productionDeployExecuted: execute,
  approvalRequiredForExecute: requiredApproval,
  smokeTargets: execute ? [productionWorkerUrl, productionPublicUrl] : [],
  events
}, null, 2));
