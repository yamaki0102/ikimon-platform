import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const requiredApproval = "APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY";
const productionBucket = "ikimon-prod-media";
const allowedArgs = new Set(["--execute", "--approval", "--scope", "--path", "--bucket", "--output"]);
const args = new Map();
const explicitPaths = [];

for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key.startsWith("--")) {
    throw new Error(`Unexpected argument: ${key}`);
  }
  if (!allowedArgs.has(key)) {
    throw new Error(`Unknown materialize argument: ${key}`);
  }
  const resolvedValue = value && !value.startsWith("--") ? value : "true";
  if (key === "--path") {
    explicitPaths.push(normalizePublicPath(resolvedValue));
  } else {
    args.set(key, resolvedValue);
  }
  if (value && !value.startsWith("--")) index += 1;
}

const execute = args.get("--execute") === "true";
const approval = args.get("--approval") ?? process.env.IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL ?? "";
const scope = args.get("--scope") ?? "core";
const bucket = args.get("--bucket") ?? productionBucket;
const outputPath = args.get("--output") ?? "";

if (execute && approval !== requiredApproval) {
  throw new Error(`Refusing R2 materialization. Pass --approval ${requiredApproval} or set IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL.`);
}

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const workerSourcePath = join(scriptDir, "..", "src", "index.ts");
const events = [];

const corePaths = [
  "/",
  "/map",
  "/ja/",
  "/ja/map",
  "/en/",
  "/en/map",
  "/es/",
  "/es/map",
  "/pt-br/",
  "/pt-br/map"
];

function normalizePublicPath(value) {
  const path = String(value || "").trim();
  if (!path || path.includes("..") || path.includes("\\")) {
    throw new Error(`Unsafe public path: ${value}`);
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function originalUiHtmlKey(pathname) {
  const cleanPath = pathname === "/" ? "root" : pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  return `original-ui/html/${cleanPath}.html`;
}

async function readAllOriginalUiStaticPaths() {
  const source = await readFile(workerSourcePath, "utf8");
  const match = source.match(/const ORIGINAL_UI_HTML_STATIC_PATHS = new Set\(\[\s*([\s\S]*?)\s*\]\);/);
  if (!match) {
    throw new Error("Could not find ORIGINAL_UI_HTML_STATIC_PATHS in Worker source.");
  }
  const paths = [];
  for (const pathMatch of match[1].matchAll(/"([^"]+)"/g)) {
    paths.push(normalizePublicPath(pathMatch[1]));
  }
  return [...new Set(paths)].sort();
}

async function resolveTargetPaths() {
  if (explicitPaths.length > 0) return [...new Set(explicitPaths)];
  if (scope === "core") return corePaths;
  if (scope === "all") return await readAllOriginalUiStaticPaths();
  throw new Error(`Unsupported materialize scope: ${scope}`);
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const commandLine = [command, ...commandArgs].join(" ");
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      shell: process.platform === "win32",
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

const { buildApp } = await import(new URL("../../src/app.ts", import.meta.url));
const app = buildApp();
await app.ready();

const tempDir = await mkdtemp(join(tmpdir(), "ikimon-original-ui-"));
const targets = await resolveTargetPaths();
const rendered = [];

try {
  for (const pathname of targets) {
    const response = await app.inject({
      method: "GET",
      url: pathname,
      headers: {
        accept: "text/html",
        "cache-control": "no-store"
      }
    });
    const contentType = String(response.headers["content-type"] ?? "");
    const ok = response.statusCode >= 200 && response.statusCode < 300 && contentType.includes("text/html");
    events.push({
      command: `render ${pathname}`,
      exitCode: ok ? 0 : 1,
      durationMs: 0,
      status: response.statusCode,
      contentType
    });
    if (!ok) {
      throw new Error(`Failed to render ${pathname}: ${response.statusCode} ${contentType}`);
    }
    const key = originalUiHtmlKey(pathname);
    const filePath = join(tempDir, key.replaceAll("/", "__"));
    await writeFile(filePath, response.body, "utf8");
    rendered.push({ pathname, key, bytes: Buffer.byteLength(response.body), filePath });
  }

  if (execute) {
    for (const item of rendered) {
      await run("npx", [
        "wrangler",
        "r2",
        "object",
        "put",
        `${bucket}/${item.key}`,
        "--remote",
        "--file",
        item.filePath,
        "--content-type",
        "text/html",
        "--cache-control",
        "no-store",
        "--force"
      ]);
    }
  }
} finally {
  await app.close();
  await rm(tempDir, { recursive: true, force: true });
}

const result = {
  ok: true,
  mode: execute ? "execute" : "dry-run",
  r2WritesExecuted: execute,
  bucket,
  scope,
  rendered: rendered.map(({ pathname, key, bytes }) => ({ pathname, key, bytes })),
  events
};

const resultText = `${JSON.stringify(result, null, 2)}\n`;
if (outputPath) {
  await writeFile(outputPath, resultText, "utf8");
}
console.log(resultText);
