import { spawn } from "node:child_process";

const requiredApproval = "APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY";
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (key.startsWith("--")) {
    args.set(key, value?.startsWith("--") ? "true" : (value ?? "true"));
    if (value && !value.startsWith("--")) index += 1;
  }
}

const execute = args.get("--execute") === "true";
const approval = args.get("--approval") ?? process.env.IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL ?? "";
const workerUrl = args.get("--worker-url") ?? "https://ikimon-life-cloudflare-prod.yamaki0102.workers.dev";
const publicUrl = args.get("--public-url") ?? "https://ikimon.life";

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
      headers: { accept: "application/json", "cache-control": "no-store" }
    });
    events.push({
      command: `smoke ${baseUrl}${path}`,
      exitCode: response.ok ? 0 : 1,
      durationMs: 0,
      status: response.status
    });
    if (!response.ok) {
      throw new Error(`Smoke failed for ${baseUrl}${path}: ${response.status}`);
    }
  }
}

await run("npm", ["run", "check"]);
await run("npm", ["test"]);
await run("npx", ["wrangler", "--version"]);
await run("npx", ["wrangler", "deploy", "--env", "production", "--dry-run"]);

if (execute) {
  await run("npx", ["wrangler", "deploy", "--env", "production"]);
  await smoke(workerUrl);
  await smoke(publicUrl);
}

console.log(JSON.stringify({
  ok: true,
  mode: execute ? "execute" : "dry-run",
  productionDeployExecuted: execute,
  approvalRequiredForExecute: requiredApproval,
  smokeTargets: execute ? [workerUrl, publicUrl] : [],
  events
}, null, 2));
