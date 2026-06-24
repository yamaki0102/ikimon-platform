import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const requiredApproval = "APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY";
const productionBucket = "ikimon-prod-media";
const allowedArgs = new Set(["--execute", "--approval", "--scope", "--path", "--bucket", "--output", "--concurrency"]);
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
const concurrency = clampInteger(Number(args.get("--concurrency") ?? "4"), 1, 8);

if (execute && approval !== requiredApproval) {
  throw new Error(`Refusing R2 materialization. Pass --approval ${requiredApproval} or set IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL.`);
}

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const workerSourcePath = join(scriptDir, "..", "src", "index.ts");
const events = [];

const corePaths = [
  "/",
  "/demo/place-feeling-tags",
  "/guide",
  "/login",
  "/record",
  "/records",
  "/register",
  "/map",
  "/profile",
  "/profile/settings",
  "/app-refresh",
  "/ja/",
  "/ja/demo/place-feeling-tags",
  "/ja/guide",
  "/ja/login",
  "/ja/record",
  "/ja/records",
  "/ja/register",
  "/ja/map",
  "/ja/profile",
  "/ja/profile/settings",
  "/en/",
  "/en/demo/place-feeling-tags",
  "/en/guide",
  "/en/login",
  "/en/map",
  "/en/profile",
  "/en/profile/settings",
  "/en/register",
  "/en/record",
  "/en/records",
  "/es/",
  "/es/demo/place-feeling-tags",
  "/es/guide",
  "/es/login",
  "/es/map",
  "/es/profile",
  "/es/profile/settings",
  "/es/register",
  "/es/record",
  "/es/records",
  "/pt-br/",
  "/pt-br/demo/place-feeling-tags",
  "/pt-br/guide",
  "/pt-br/login",
  "/pt-br/map",
  "/pt-br/profile",
  "/pt-br/profile/settings",
  "/pt-br/register",
  "/pt-br/record",
  "/pt-br/records"
];
const staticAssetPaths = ["/app-sw.js"];

function normalizePublicPath(value) {
  const path = String(value || "").trim();
  if (!path || path.includes("..") || path.includes("\\")) {
    throw new Error(`Unsafe public path: ${value}`);
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function renderUrlForPath(pathname) {
  const localizedMatch = pathname.match(/^\/(ja|en|es|pt-br)(\/.*)?$/);
  if (localizedMatch) {
    const segment = localizedMatch[1];
    const rest = localizedMatch[2] || "/";
    const lang = segment === "pt-br" ? "pt-BR" : segment;
    if (["/", "/demo/place-feeling-tags", "/guide", "/login", "/map", "/profile", "/profile/settings", "/record", "/records", "/register"].includes(rest)) {
      return `${rest}?lang=${encodeURIComponent(lang)}`;
    }
  }
  switch (pathname) {
    case "/ja":
    case "/ja/":
      return "/?lang=ja";
    case "/en":
    case "/en/":
      return "/?lang=en";
    case "/es":
    case "/es/":
      return "/?lang=es";
    case "/pt-br":
    case "/pt-br/":
      return "/?lang=pt-BR";
    default:
      return pathname;
  }
}

function originalUiHtmlKey(pathname) {
  const cleanPath = pathname === "/" ? "root" : pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  return `original-ui/html/${cleanPath}.html`;
}

function originalUiStaticKey(pathname) {
  return `original-ui/static/${pathname.replace(/^\/+/, "")}`;
}

function staticContentType(pathname) {
  if (pathname.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
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
  if (/^[A-Za-z0-9_/:.=+\\-]+$/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function clampInteger(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

async function runPool(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await worker(item);
    }
  });
  await Promise.all(workers);
}

const { buildApp } = await import(new URL("../../src/app.ts", import.meta.url));
const app = buildApp();
await app.ready();

const tempDir = await mkdtemp(join(tmpdir(), "ikimon-original-ui-"));
const targets = await resolveTargetPaths();
const rendered = [];
const renderedStatic = [];

try {
  for (const pathname of targets) {
    const renderUrl = renderUrlForPath(pathname);
    const response = await app.inject({
      method: "GET",
      url: renderUrl,
      headers: {
        accept: "text/html",
        "cache-control": "no-store"
      }
    });
    const contentType = String(response.headers["content-type"] ?? "");
    const ok = response.statusCode >= 200 && response.statusCode < 300 && contentType.includes("text/html");
    events.push({
      command: renderUrl === pathname ? `render ${pathname}` : `render ${pathname} via ${renderUrl}`,
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

  for (const pathname of staticAssetPaths) {
    const response = await app.inject({
      method: "GET",
      url: pathname,
      headers: {
        accept: "*/*",
        "cache-control": "no-store"
      }
    });
    const contentType = String(response.headers["content-type"] ?? "");
    const ok = response.statusCode >= 200 && response.statusCode < 300 && contentType.includes("javascript");
    events.push({
      command: `render-static ${pathname}`,
      exitCode: ok ? 0 : 1,
      durationMs: 0,
      status: response.statusCode,
      contentType
    });
    if (!ok) {
      throw new Error(`Failed to render static ${pathname}: ${response.statusCode} ${contentType}`);
    }
    const key = originalUiStaticKey(pathname);
    const filePath = join(tempDir, key.replaceAll("/", "__"));
    await writeFile(filePath, response.body, "utf8");
    renderedStatic.push({ pathname, key, bytes: Buffer.byteLength(response.body), filePath, contentType: staticContentType(pathname) });
  }

  if (execute) {
    const uploadStartedAt = Date.now();
    await runPool(rendered, concurrency, async (item) => {
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
    });
    events.push({
      command: `parallel r2 put ${rendered.length} objects concurrency=${concurrency}`,
      exitCode: 0,
      durationMs: Date.now() - uploadStartedAt
    });
    for (const item of renderedStatic) {
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
        item.contentType,
        "--cache-control",
        "no-cache, no-store, must-revalidate",
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
  concurrency,
  rendered: rendered.map(({ pathname, key, bytes }) => ({ pathname, key, bytes })),
  renderedStatic: renderedStatic.map(({ pathname, key, bytes }) => ({ pathname, key, bytes })),
  events
};

const resultText = `${JSON.stringify(result, null, 2)}\n`;
if (outputPath) {
  await writeFile(outputPath, resultText, "utf8");
}
console.log(resultText);
