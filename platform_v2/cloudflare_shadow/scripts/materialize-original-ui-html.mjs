import { createHash, createHmac } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const productionApproval = "APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY";
const stagingApproval = "APPROVE_IKIMON_CF_STAGING_WORKER_DEPLOY";
const productionBucket = "ikimon-prod-media";
const stagingBucket = "ikimon-shadow-media";
const materializeManifestSchemaVersion = "original-ui-materialize/v1";
const uploadCacheControl = "no-store";
const allowedArgs = new Set([
  "--execute",
  "--approval",
  "--target-env",
  "--scope",
  "--path",
  "--bucket",
  "--output",
  "--concurrency",
  "--skip-if-unchanged",
  "--manifest-key",
  "--phase-result",
  "--direct-staging-r2",
  "--direct-production-r2"
]);
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
const targetEnv = args.get("--target-env") ?? "production";
const canonicalOrigin = targetEnv === "staging" ? "https://staging.zukan.earth" : "https://zukan.earth";
const canonicalAuditOrigins = targetEnv === "staging"
  ? [canonicalOrigin, "https://zukan.earth"]
  : [canonicalOrigin];
const canonicalHost = new URL(canonicalOrigin).hostname;
const canonicalRenderHeaders = {
  accept: "*/*",
  "cache-control": "no-store",
  host: canonicalHost,
  "x-forwarded-host": canonicalHost,
  "x-forwarded-proto": "https"
};
const scope = args.get("--scope") ?? "core";
const bucket = args.get("--bucket") ?? (targetEnv === "staging" ? stagingBucket : productionBucket);
const outputPath = args.get("--output") ?? "";
const emitPhaseResult = args.get("--phase-result") === "true";
const concurrency = clampInteger(Number(args.get("--concurrency") ?? "4"), 1, 8);
const skipIfUnchanged = args.get("--skip-if-unchanged") === "true";
const directStagingR2 = args.get("--direct-staging-r2") === "true";
const directProductionR2 = args.get("--direct-production-r2") === "true";
const directR2 = directStagingR2 || directProductionR2;
const checkpointInterval = 25;
const materializationJobId = String(process.env.IKIMON_OPS_JOB_ID || "");
const materializationSourceSha = String(process.env.IKIMON_EXPECTED_GIT_SHA || "");
const materializationSecret = targetEnv === "production"
  ? String(process.env.IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET || "")
  : String(process.env.IKIMON_AUTOMATION_PUSH_SECRET || "");
delete process.env.IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET;
delete process.env.IKIMON_AUTOMATION_PUSH_SECRET;
const materializationGatewayUrl = resolveMaterializationGatewayUrl();

if (!["production", "staging"].includes(targetEnv)) {
  throw new Error("--target-env must be one of: production, staging.");
}

if (targetEnv === "production" && bucket !== productionBucket) {
  throw new Error(`Production materialization must target ${productionBucket}.`);
}

if (targetEnv === "staging" && bucket === productionBucket) {
  throw new Error("Staging materialization must not target the production R2 bucket.");
}

const manifestKey = normalizeR2ObjectKey(
  args.get("--manifest-key") ?? `original-ui/materialize-manifest/${targetEnv}/${scope}.json`
);

if (execute && targetEnv === "production" && approval !== productionApproval) {
  throw new Error(`Refusing production R2 materialization. Pass --approval ${productionApproval} or set IKIMON_CF_PRODUCTION_DEPLOY_APPROVAL.`);
}

if (execute && targetEnv === "production" && !/^[a-f0-9]{40}$/u.test(materializationSourceSha)) {
  throw new Error("production_materialization_source_sha_invalid");
}

if (execute && targetEnv === "staging" && approval !== stagingApproval) {
  throw new Error(`Refusing staging R2 materialization. Pass --approval ${stagingApproval}.`);
}
if (directStagingR2 && (targetEnv !== "staging" || bucket !== stagingBucket)) {
  throw new Error("--direct-staging-r2 is restricted to the fixed staging bucket.");
}
if (directProductionR2 && (targetEnv !== "production" || bucket !== productionBucket)) {
  throw new Error("--direct-production-r2 is restricted to the fixed production bucket.");
}
if (directStagingR2 && directProductionR2) {
  throw new Error("Only one direct R2 transport may be selected.");
}

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const workerSourcePath = join(scriptDir, "..", "src", "index.ts");
if (execute && directR2) {
  const currentHead = execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!/^[a-f0-9]{40}$/u.test(materializationSourceSha) || materializationSourceSha !== currentHead) {
    throw new Error(targetEnv === "production"
      ? "direct_production_materialization_exact_sha_mismatch"
      : "direct_staging_materialization_exact_sha_mismatch");
  }
}
const events = [];
const gatewayMaxAttempts = 5;

process.env.LEGACY_PUBLIC_ROOT ||= join(repoRoot, "upload_package", "public_html");

const stagingOnlyAdminPreviewPaths = [];
const corePaths = await readWorkerStringArray("ORIGINAL_UI_HTML_CORE_PATHS");
const queryVariantPaths = await readWorkerStringArray("ORIGINAL_UI_HTML_QUERY_VARIANT_PATHS");
const stagingQaSmokePaths = await readWorkerStringArray("ORIGINAL_UI_HTML_STAGING_QA_SMOKE_PATHS");
const localizedRenderPaths = new Set(await readWorkerStringArray("ORIGINAL_UI_HTML_LOCALIZABLE_PATHS"));

const staticAssetPaths = [
  "/offline.html",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/app-sw.js",
  "/assets/brand/app-icon-192.png",
  "/assets/brand/app-icon-192-maskable.png",
  "/assets/brand/app-icon-512.png",
  "/assets/brand/app-icon-512-maskable.png",
  "/assets/brand/apple-touch-icon.png",
  "/assets/brand/favicon-32.png",
  "/assets/brand/ikimon-lockup-black.png",
  "/assets/brand/ikimon-ogp-default.png",
  "/assets/brand/ikimon-wordmark-black.png",
  "/assets/brand/zukan-app-icon-192.png",
  "/assets/brand/zukan-app-icon-192-maskable.png",
  "/assets/brand/zukan-app-icon-512.png",
  "/assets/brand/zukan-app-icon-512-maskable.png",
  "/assets/brand/zukan-app-icon.svg",
  "/assets/brand/zukan-app-icon-maskable.svg",
  "/assets/brand/zukan-apple-touch-icon.png",
  "/assets/brand/zukan-favicon-32.png",
  "/assets/brand/zukan-lockup.svg",
  "/assets/brand/zukan-symbol.svg",
  "/assets/brand/zukan-wordmark.svg",
  "/assets/brand/zukan-ogp-default.png",
  "/assets/img/landing/home-community-hero.webp",
  "/assets/img/landing/home-school-learning.webp",
  "/assets/img/landing/home-community-event.webp",
  "/assets/img/landing/home-work-culture.webp",
  "/assets/img/landing/home-daily-place.webp",
  "/assets/img/landing/zukan-empty-illustration.webp",
  "/assets/img/invasive/invasive-aquatic-plant-thumb.webp",
  "/assets/img/invasive/invasive-aquatic-plant.png",
  "/assets/img/invasive/invasive-bird-thumb.webp",
  "/assets/img/invasive/invasive-bird.png",
  "/assets/img/invasive/invasive-category-sprite.png",
  "/assets/img/invasive/invasive-fish-thumb.webp",
  "/assets/img/invasive/invasive-fish.png",
  "/assets/img/invasive/invasive-insect-thumb.webp",
  "/assets/img/invasive/invasive-insect.png",
  "/assets/img/invasive/invasive-mammal-thumb.webp",
  "/assets/img/invasive/invasive-mammal.png",
  "/assets/img/invasive/invasive-plant-thumb.webp",
  "/assets/img/invasive/invasive-plant.png",
  "/assets/img/invasive/invasive-reptile-thumb.webp",
  "/assets/img/invasive/invasive-reptile.png",
  "/assets/img/invasive/invasive-spider-thumb.webp",
  "/assets/img/invasive/invasive-spider.png"
];

function normalizePublicPath(value) {
  const path = String(value || "").trim();
  if (!path || path.includes("\\")) {
    throw new Error(`Unsafe public path: ${value}`);
  }
  const prefixed = path.startsWith("/") ? path : `/${path}`;
  const parsed = new URL(prefixed, "https://ikimon-materialize.local");
  if (parsed.hash || parsed.pathname.includes("..")) {
    throw new Error(`Unsafe public path: ${value}`);
  }
  return `${parsed.pathname}${parsed.search}`;
}

function publicPathUrl(publicPath) {
  return new URL(publicPath, "https://ikimon-materialize.local");
}

function renderUrlForPath(publicPath) {
  const parsed = publicPathUrl(publicPath);
  const pathname = parsed.pathname;
  if (pathname === "/home") {
    return `/${parsed.search}`;
  }
  const localizedMatch = pathname.match(/^\/(ja|en|es|pt-br)(\/.*)?$/);
  if (localizedMatch) {
    const segment = localizedMatch[1];
    const rest = localizedMatch[2] || "/";
    const lang = segment === "pt-br" ? "pt-BR" : segment;
    if (rest === "/home") {
      const params = new URLSearchParams(parsed.searchParams);
      params.set("lang", lang);
      return `/?${params.toString()}`;
    }
    if (localizedRenderPaths.has(rest)) {
      const params = new URLSearchParams(parsed.searchParams);
      params.set("lang", lang);
      return `${rest}?${params.toString()}`;
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
      return `${pathname}${parsed.search}`;
  }
}

function originalUiHtmlKey(pathname) {
  const cleanPath = pathname === "/" ? "root" : pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  return `original-ui/html/${cleanPath}.html`;
}

function originalUiHtmlVariantKey(pathname, variant) {
  const cleanPath = pathname === "/" ? "root" : pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  return `original-ui/html/${cleanPath}.${variant}.html`;
}

function originalUiHtmlQueryVariant(publicPath) {
  const parsed = publicPathUrl(publicPath);
  if (!/^(?:\/(?:ja|en|es|pt-br))?\/records$/.test(parsed.pathname)) return null;
  const view = parsed.searchParams.get("view");
  if (view === "identification_summary") return "view-identification-summary";
  if (view === "needs_id") return "view-needs-id";
  return null;
}

function originalUiHtmlKeyForPublicPath(publicPath) {
  const parsed = publicPathUrl(publicPath);
  const variant = originalUiHtmlQueryVariant(publicPath);
  return variant ? originalUiHtmlVariantKey(parsed.pathname, variant) : originalUiHtmlKey(parsed.pathname);
}

function originalUiStaticKey(pathname) {
  return `original-ui/static/${pathname.replace(/^\/+/, "")}`;
}

function normalizeR2ObjectKey(value) {
  const key = String(value || "").trim().replace(/^\/+/, "");
  if (!key || key.includes("\\") || key.split("/").includes("..")) {
    throw new Error(`Unsafe R2 object key: ${value}`);
  }
  return key;
}

function staticContentType(pathname) {
  if (pathname.endsWith(".html")) return "text/html";
  if (pathname.endsWith(".txt")) return "text/plain";
  if (pathname.endsWith(".js")) return "application/javascript";
  if (pathname.endsWith(".xml")) return "application/xml";
  if (pathname.endsWith(".webmanifest")) return "application/manifest+json";
  if (pathname.endsWith(".ico")) return "image/x-icon";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function materializationGatewayContentType(contentType) {
  // The shared materialization gateway accepts generic XML but not the SVG-specific
  // media type. R2 responses restore image/svg+xml from the trusted .svg pathname.
  return contentType === "image/svg+xml" ? "application/xml" : contentType;
}

async function renderLlmsFull(app) {
  const sections = [
    ["LLM index", "/llms.txt"],
    ["Guide", "/llms/guide.md"],
    ["FAQ", "/llms/faq.md"],
    ["Researcher", "/llms/researcher.md"],
    ["Terms", "/llms/terms.md"]
  ];
  const renderedSections = [];
  for (const [title, pathname] of sections) {
    const response = await app.inject({ method: "GET", url: pathname, headers: canonicalRenderHeaders });
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Failed to render ${pathname} for /llms-full.txt: ${response.statusCode}`);
    }
    renderedSections.push(`# ${title}\n\n${response.body.trim()}`);
  }
  const body = `${renderedSections.join("\n\n---\n\n")}\n`;
  return {
    statusCode: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
    body,
    rawPayload: Buffer.from(body, "utf8")
  };
}

async function renderStaticAsset(app, pathname) {
  if (pathname === "/llms-full.txt") return renderLlmsFull(app);
  return app.inject({
    method: "GET",
    url: pathname,
    headers: canonicalRenderHeaders
  });
}

function auditCanonicalStaticOrigin(pathname, payload) {
  if (!["/sitemap.xml", "/robots.txt", "/llms.txt", "/llms-full.txt"].includes(pathname)) return;
  const text = Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload);
  if (!canonicalAuditOrigins.some((origin) => text.includes(origin))
      || /https?:\/\/(?:localhost|127\.0\.0\.1|ikimon-materialize\.local)(?::\d+)?/i.test(text)) {
    throw new Error(`canonical_static_origin_mismatch:${pathname}`);
  }
}

async function readWorkerStringArray(constName) {
  const source = await readFile(workerSourcePath, "utf8");
  const escapedName = constName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`const\\s+${escapedName}\\s*=\\s*\\[\\s*([\\s\\S]*?)\\s*\\]\\s*as const;`));
  if (!match) {
    throw new Error(`Could not find ${constName} in Worker source.`);
  }
  const paths = [];
  for (const pathMatch of match[1].matchAll(/"([^"]+)"/g)) {
    paths.push(normalizePublicPath(pathMatch[1]));
  }
  return [...new Set(paths)];
}

async function readAllOriginalUiStaticPaths() {
  const source = await readFile(workerSourcePath, "utf8");
  const match = source.match(/const ORIGINAL_UI_HTML_STATIC_PATHS = new Set\(\[\s*([\s\S]*?)\s*\]\);/);
  if (!match) {
    throw new Error("Could not find ORIGINAL_UI_HTML_STATIC_PATHS in Worker source.");
  }
  const paths = [];
  if (match[1].includes("...ORIGINAL_UI_HTML_CORE_PATHS")) {
    paths.push(...await readWorkerStringArray("ORIGINAL_UI_HTML_CORE_PATHS"));
  }
  paths.push(...await readWorkerStringArray("ORIGINAL_UI_HTML_QUERY_VARIANT_PATHS"));
  if (match[1].includes("...ORIGINAL_UI_HTML_STAGING_QA_SMOKE_PATHS")) {
    paths.push(...await readWorkerStringArray("ORIGINAL_UI_HTML_STAGING_QA_SMOKE_PATHS"));
  }
  for (const pathMatch of match[1].matchAll(/"([^"]+)"/g)) {
    paths.push(normalizePublicPath(pathMatch[1]));
  }
  return [...new Set(paths)].sort();
}

async function resolveTargetPaths() {
  if (explicitPaths.length > 0) return [...new Set(explicitPaths)];
  if (scope === "core") {
    return targetEnv === "staging" ? [...corePaths, ...queryVariantPaths, ...stagingOnlyAdminPreviewPaths] : [...corePaths, ...queryVariantPaths];
  }
  if (scope === "staging-qa") {
    if (targetEnv !== "staging") {
      throw new Error("--scope staging-qa is only supported with --target-env staging.");
    }
    return [...new Set([...corePaths, ...queryVariantPaths, ...stagingOnlyAdminPreviewPaths, ...stagingQaSmokePaths])];
  }
  if (scope === "all") return await readAllOriginalUiStaticPaths();
  throw new Error(`Unsupported materialize scope: ${scope}`);
}

function clampInteger(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sha256(payload) {
  return createHash("sha256").update(payload).digest("hex");
}

function resolveMaterializationGatewayUrl() {
  const explicit = String(process.env.IKIMON_R2_MATERIALIZATION_API_URL || "").trim();
  if (explicit) return explicit;
  const callback = String(process.env.IKIMON_AUTOMATION_CALLBACK_URL || "").trim();
  if (!callback) return "";
  const url = new URL(callback);
  url.pathname = "/ops-materialization";
  url.search = "";
  return url.toString();
}

async function gatewayRequest(payload) {
  if (!/^ops-[a-f0-9-]{16,80}$/u.test(materializationJobId)) throw new Error("IKIMON_OPS_JOB_ID is required for materialization.");
  if (!materializationSecret || !materializationGatewayUrl) throw new Error("Signed R2 materialization gateway is required.");
  const body = JSON.stringify({
    schema: "ikimon.r2-materialization/v1",
    job_id: materializationJobId,
    target_env: targetEnv,
    ...(targetEnv === "production" ? { source_sha: materializationSourceSha } : {}),
    manifest_hash: bundleHash,
    ...payload
  });
  const signature = createHmac("sha256", materializationSecret).update(body).digest("hex");
  let lastError;
  for (let attempt = 1; attempt <= gatewayMaxAttempts; attempt += 1) {
    try {
      const response = await fetch(materializationGatewayUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-ikimon-signature": signature },
        body
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) return result;
      if (response.status !== 429 && response.status < 500) {
        const error = new Error(`materialization_gateway_${response.status}_${result.error || "rejected"}`);
        error.retryable = false;
        throw error;
      }
      lastError = new Error(`materialization_gateway_${response.status}_${result.error || "retryable"}`);
    } catch (error) {
      lastError = error;
      if (error?.retryable === false) throw error;
      if (attempt >= gatewayMaxAttempts) break;
    }
    await sleep(Math.min(8_000, 500 * (2 ** (attempt - 1))));
  }
  throw lastError;
}

function wranglerR2Put(bucketName, key, filePath, contentType) {
  const wranglerCliPath = join(scriptDir, "..", "node_modules", "wrangler", "bin", "wrangler.js");
  const objectPath = `${bucketName}/${normalizeR2ObjectKey(key)}`;
  const commandArgs = [
    wranglerCliPath,
    "r2",
    "object",
    "put",
    objectPath,
    "--file",
    filePath,
    "--content-type",
    contentType,
    "--cache-control",
    uploadCacheControl,
    "--remote",
    "--force"
  ];
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, commandArgs, {
      cwd: join(scriptDir, ".."),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve({ key, exitCode, durationMs: Date.now() - startedAt });
        return;
      }
      reject(new Error(`wrangler r2 object put failed for ${key}: exit=${exitCode} ${stderr || stdout}`));
    });
  });
}

async function directR2Sync(allItems, tempDirPath, bucketName) {
  const versionPrefix = `original-ui/versions/${bundleHash}`;
  await runPool(allItems, concurrency, async (item) => {
    const relativeKey = item.key.replace(/^original-ui\//, "");
    await wranglerR2Put(bucketName, `${versionPrefix}/${relativeKey}`, item.filePath, item.contentType);
    uploadSummary.updated += 1;
  });

  const manifest = {
    schemaVersion: materializeManifestSchemaVersion,
    sourceSha: materializationSourceSha,
    targetEnv,
    scope,
    bundleHash,
    versionPrefix,
    items: allItems.map((item) => ({
      key: item.key.replace(/^original-ui\//, ""),
      bytes: item.bytes,
      sha256: item.sha256,
      contentType: item.contentType
    }))
  };
  const manifestPayload = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestPath = join(tempDirPath, "materialize-manifest.json");
  await writeFile(manifestPath, manifestPayload, "utf8");
  await wranglerR2Put(bucketName, `${versionPrefix}/manifest.json`, manifestPath, "application/json");
  await wranglerR2Put(bucketName, manifestKey, manifestPath, "application/json");

  const pointerKey = targetEnv === "production"
    ? "original-ui/current/production.json"
    : "original-ui/current/staging.json";
  const pointerPath = join(tempDirPath, `current-${targetEnv}.json`);
  await writeFile(pointerPath, `${JSON.stringify({
    manifest_hash: bundleHash,
    version_prefix: versionPrefix,
    source_sha: materializationSourceSha
  }, null, 2)}\n`, "utf8");
  await wranglerR2Put(bucketName, pointerKey, pointerPath, "application/json");

  return {
    ok: true,
    key: manifestKey,
    sha256: sha256(manifestPayload),
    versionPrefix,
    pointerKey,
    transport: "wrangler-r2"
  };
}

function buildBundleEntry(item) {
  return {
    pathname: item.pathname,
    key: item.key,
    bytes: item.bytes,
    sha256: item.sha256,
    contentType: item.contentType,
    cacheControl: uploadCacheControl
  };
}

function computeBundleHash(entries) {
  const canonical = {
    schemaVersion: materializeManifestSchemaVersion,
    targetEnv,
    scope,
    entries: [...entries].sort((a, b) => a.key.localeCompare(b.key))
  };
  return sha256(JSON.stringify(canonical));
}

function auditAnonymousHtmlShell(pathname, body) {
  if (!/^(?:\/(?:ja|en|es|pt-br))?\/community\/events\/new$/.test(pathname)) return;
  const lowerBody = body.toLowerCase();
  const forbiddenPatterns = [
    "csrf",
    "ikimon_v2_session",
    "set-cookie",
    "data-user-id",
    "current_user",
    "vieweruserid"
  ];
  const matched = forbiddenPatterns.find((pattern) => lowerBody.includes(pattern));
  if (matched) {
    throw new Error(`Refusing to materialize ${pathname}: anonymous event shell contains ${matched}.`);
  }
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
if (targetEnv === "staging") {
  process.env.ENABLE_DEV_DUMMY_ADMIN ||= "1";
  process.env.DEV_DUMMY_ADMIN_TOKEN ||= "materialize-admin-preview";
}
const app = buildApp();
await app.ready();

const tempDir = await mkdtemp(join(tmpdir(), "ikimon-original-ui-"));
const targets = await resolveTargetPaths();
const rendered = [];
const renderedStatic = [];
let bundleHash = "";
let materializeSkipped = false;
let skipReason = execute ? "not_requested" : "dry_run";
let previousManifestSummary = null;
let manifestUpload = { ok: false, key: manifestKey, skipped: true, reason: "not_executed" };
const uploadSummary = { updated: 0, skipped: 0, failed: 0, resumed: 0, checkpoints: 0, durationMs: 0 };

try {
  for (const pathname of targets) {
    const renderUrl = renderUrlForPath(pathname);
    const response = await app.inject({
      method: "GET",
      url: renderUrl,
      headers: {
        accept: "text/html",
        "cache-control": "no-store",
      }
    });
    const contentType = String(response.headers["content-type"] ?? "");
    const ok = response.statusCode >= 200 && response.statusCode < 300 && contentType.includes("text/html");
    auditAnonymousHtmlShell(pathname, response.body);
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
    const key = originalUiHtmlKeyForPublicPath(pathname);
    const filePath = join(tempDir, key.replaceAll("/", "__"));
    await writeFile(filePath, response.body, "utf8");
    rendered.push({
      pathname,
      key,
      bytes: Buffer.byteLength(response.body),
      sha256: sha256(response.body),
      filePath,
      contentType: "text/html"
    });
  }

  for (const pathname of staticAssetPaths) {
    const expectedContentType = staticContentType(pathname);
    const response = await renderStaticAsset(app, pathname);
    const contentType = String(response.headers["content-type"] ?? "");
    const ok = response.statusCode >= 200 && response.statusCode < 300 && contentType.includes(expectedContentType.split(";")[0]);
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
    const payload = response.rawPayload ?? Buffer.from(response.body);
    auditCanonicalStaticOrigin(pathname, payload);
    await writeFile(filePath, payload);
    renderedStatic.push({
      pathname,
      key,
      bytes: payload.byteLength,
      sha256: sha256(payload),
      filePath,
      contentType: expectedContentType
    });
  }

  const bundleEntries = [
    ...rendered.map(buildBundleEntry),
    ...renderedStatic.map(buildBundleEntry)
  ];
  bundleHash = computeBundleHash(bundleEntries);

  if (execute) {
    const uploadStartedAt = Date.now();
    const allItems = [...rendered, ...renderedStatic];
    if (directR2) {
      manifestUpload = await directR2Sync(allItems, tempDir, bucket);
      skipReason = `direct_${targetEnv}_r2`;
    } else {
      const state = await gatewayRequest({ op: "state" });
      previousManifestSummary = {
        bundleHash: state.current_manifest_hash || null,
        checkpointCount: Array.isArray(state.completed) ? state.completed.length : 0
      };
      if (state.same_manifest) {
        materializeSkipped = true;
        skipReason = "bundle_hash_match";
        uploadSummary.skipped = bundleEntries.length;
        manifestUpload = { ok: true, skipped: true, reason: "unchanged_bundle", versionPrefix: `original-ui/versions/${bundleHash}` };
      } else {
        const completed = new Map((Array.isArray(state.completed) ? state.completed : []).map((item) => [item.key, item.sha256]));
        const pending = allItems.filter((item) => {
          const key = item.key.replace(/^original-ui\//, "");
          if (completed.get(key) === item.sha256) { uploadSummary.skipped += 1; uploadSummary.resumed += 1; return false; }
          return true;
        });
        let checkpointSerial = Promise.resolve();
        const persistCheckpoint = () => {
          const snapshot = [...completed.entries()].map(([key, sha256]) => ({ key, sha256 }));
          checkpointSerial = checkpointSerial.then(async () => {
            await gatewayRequest({ op: "checkpoint", completed: snapshot });
            uploadSummary.checkpoints += 1;
          });
          return checkpointSerial;
        };
        try {
          await runPool(pending, concurrency, async (item) => {
            const key = item.key.replace(/^original-ui\//, "");
            const payload = await readFile(item.filePath);
            const result = await gatewayRequest({
              op: "put",
              key,
              sha256: item.sha256,
              content_type: materializationGatewayContentType(item.contentType),
              body_base64: payload.toString("base64")
            });
            completed.set(key, item.sha256);
            if (result.status === "skipped") uploadSummary.skipped += 1;
            else uploadSummary.updated += 1;
            if (completed.size % checkpointInterval === 0) await persistCheckpoint();
          });
          await persistCheckpoint();
          if (explicitPaths.length === 0) {
            uploadSummary.durationMs = Date.now() - uploadStartedAt;
            manifestUpload = await gatewayRequest({
              op: "finalize",
              items: allItems.map((item) => ({ key: item.key.replace(/^original-ui\//, ""), sha256: item.sha256 })),
              summary: {
                updated: uploadSummary.updated,
                skipped: uploadSummary.skipped,
                failed: uploadSummary.failed,
                resumed: uploadSummary.resumed,
                checkpoints: uploadSummary.checkpoints,
                duration_ms: uploadSummary.durationMs
              }
            });
          } else {
            manifestUpload = { ok: true, skipped: true, reason: "explicit_paths_not_finalized" };
          }
          skipReason = state.current_manifest_hash ? "bundle_hash_changed" : "no_current_pointer";
        } catch (error) {
          uploadSummary.failed += 1;
          await persistCheckpoint().catch(() => {});
          throw error;
        }
      }
    }
    uploadSummary.durationMs = Date.now() - uploadStartedAt;
    events.push({
      command: `${directR2 ? `direct ${targetEnv} wrangler r2` : "signed r2 gateway"} sync objects=${bundleEntries.length} concurrency=${concurrency}`,
      exitCode: 0,
      durationMs: uploadSummary.durationMs,
      ...uploadSummary
    });
  }
} finally {
  await app.close();
  await rm(tempDir, { recursive: true, force: true });
}

const result = {
  ok: true,
  sourceSha: materializationSourceSha,
  mode: execute ? "execute" : "dry-run",
  r2WritesRequested: execute,
  r2WritesExecuted: execute && !materializeSkipped,
  bucket,
  targetEnv,
  scope,
  transport: directR2 ? "wrangler-r2" : "signed-gateway",
  concurrency,
  skipIfUnchanged,
  manifestKey,
  bundleHash,
  materializeSkipped,
  skipReason,
  previousManifest: previousManifestSummary,
  manifestUpload,
  uploadSummary,
  rendered: rendered.map(({ pathname, key, bytes, sha256 }) => ({ pathname, key, bytes, sha256 })),
  renderedStatic: renderedStatic.map(({ pathname, key, bytes, sha256 }) => ({ pathname, key, bytes, sha256 })),
  events
};

const resultText = `${JSON.stringify(result, null, 2)}\n`;
if (outputPath) {
  await writeFile(outputPath, resultText, "utf8");
}
console.log(resultText);
if (emitPhaseResult) {
  if (!execute || targetEnv !== "production") {
    throw new Error("production_materialization_phase_result_requires_execute");
  }
  const manifestHash = String(manifestUpload?.sha256 || bundleHash);
  if (!/^[a-f0-9]{64}$/u.test(bundleHash) || !/^[a-f0-9]{64}$/u.test(manifestHash)) {
    throw new Error("production_materialization_release_identity_invalid");
  }
  const phaseResult = {
    schema: "ikimon.production-phase-result/v1",
    phase: "materialize",
    status: "succeeded",
    source_sha: materializationSourceSha,
    job_id: materializationJobId,
    bundle_hash: bundleHash,
    manifest_hash: manifestHash,
    object_key: String(manifestUpload?.key || manifestKey),
  };
  await mkdir(".deploy", { recursive: true });
  await writeFile(".deploy/production-phase-materialize.json", `${JSON.stringify(phaseResult, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(phaseResult));
}
