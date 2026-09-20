import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";
import { chromium, test as baseTest, expect } from "@playwright/test";

const CLOUDFLARE_API_ROOT = "https://api.cloudflare.com/client/v4/accounts";
const DIAGNOSTIC_DELAYS_MS = [250, 500, 1000, 2000, 4000, 8000];

export function isCloudflareBrowserRun(): boolean {
  return process.env.BROWSER_RUNTIME?.trim().toLowerCase() === "cloudflare";
}

export function browserRunDiagnosticsEnabled(): boolean {
  return process.env.BROWSER_RUN_DIAGNOSTICS === "1";
}

type CloudflareBrowserAuth = {
  accountId: string;
  token: string;
  source: "environment" | "wrangler";
};

function wranglerJson(args: string[]): Record<string, unknown> {
  const executable = "npx";
  let stdout = "";
  try {
    stdout = execFileSync(executable, ["wrangler", ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      shell: process.platform === "win32",
    });
  } catch {
    throw new Error("Wrangler authentication is unavailable for Cloudflare Browser Run");
  }
  try {
    const parsed = JSON.parse(stdout) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid_wrangler_json");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Wrangler returned invalid JSON for Cloudflare Browser Run");
  }
}

function collectAccountIds(value: unknown, key = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((entry) => collectAccountIds(entry, key));
  if (!value || typeof value !== "object") {
    const text = String(value ?? "").trim();
    return /^(?:[a-f0-9]{32})$/i.test(text) && /^(?:id|account[_-]?id)$/i.test(key) ? [text] : [];
  }
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([childKey, childValue]) => collectAccountIds(childValue, childKey));
}

function resolveCloudflareBrowserAuth(): CloudflareBrowserAuth {
  const explicitAccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const explicitToken = process.env.CLOUDFLARE_BROWSER_RUN_API_TOKEN?.trim()
    || process.env.CLOUDFLARE_API_TOKEN?.trim();

  let token = explicitToken;
  let source: CloudflareBrowserAuth["source"] = "environment";
  if (!token) {
    const auth = wranglerJson(["auth", "token", "--json"]);
    token = typeof auth.token === "string" ? auth.token.trim() : "";
    source = "wrangler";
  }
  if (!token) {
    throw new Error("Cloudflare Browser Run authentication token is unavailable");
  }

  let accountId = explicitAccountId;
  if (!accountId) {
    const whoami = wranglerJson(["whoami", "--json"]);
    const accountIds = [...new Set(collectAccountIds(whoami))];
    const resolvedAccountId = accountIds[0];
    if (accountIds.length !== 1 || !resolvedAccountId) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID is required when Wrangler does not resolve exactly one account");
    }
    accountId = resolvedAccountId;
    source = "wrangler";
  }
  if (!accountId) {
    throw new Error("Cloudflare account ID is unavailable for Browser Run");
  }

  return { accountId, token, source };
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.origin + url.pathname;
  } catch {
    return "[invalid-url]";
  }
}

function redactText(value: string): string {
  return value
    .replace(/(authorization|cookie|set-cookie|x-api-key|password|token|secret|jwt)=?[^\s,;]*/gi, "$1=[REDACTED]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[REDACTED]");
}

function safeTargetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const item = entry as Record<string, unknown>;
      return String(item.targetId ?? item.id ?? item.target_id ?? "");
    })
    .filter((value) => value.length > 0 && value.length < 200);
}

export type BrowserRunEvidence = {
  sourceSha: string | null;
  environment: string;
  browserRuntime: "cloudflare";
  sessionId: string | null;
  recordingEnabled: boolean;
  screenshots: string[];
  traceFiles: string[];
  consoleErrors: Array<{ text: string; url?: string }>;
  pageErrors: string[];
  failedRequests: Array<{ method: string; url: string; error: string }>;
  httpFailures: Array<{ method: string; url: string; status: number }>;
  recordingReadback?: {
    status: number;
    available: boolean;
    contentType: string;
    bytes: number;
    attempts: number;
  };
  networkReadback?: string[];
  finalizationError?: string;
};

export type BrowserRunSession = {
  accountId: string;
  apiToken: string;
  sessionId: string;
  webSocketDebuggerUrl: string;
  targetIds: string[];
  recording: boolean;
};

async function cloudflareRequest(
  account: string,
  token: string,
  pathname: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(CLOUDFLARE_API_ROOT + "/" + account + pathname, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: "Bearer " + token,
      ...(init.headers ?? {}),
    },
  });
}

export async function createBrowserRunSession(): Promise<BrowserRunSession> {
  const auth = resolveCloudflareBrowserAuth();
  const account = auth.accountId;
  const token = auth.token;
  const keepAlive = Math.min(Math.max(Number(process.env.BROWSER_RUN_KEEP_ALIVE_MS ?? "600000"), 60000), 600000);
  const params = new URLSearchParams({
    keep_alive: String(keepAlive),
    targets: "true",
  });
  const recording = browserRunDiagnosticsEnabled();
  if (recording) params.set("recording", "true");

  const response = await cloudflareRequest(
    account,
    token,
    "/browser-rendering/devtools/browser?" + params.toString(),
    { method: "POST" },
  );
  if (!response.ok) {
    throw new Error("Cloudflare Browser Run session acquisition failed with HTTP " + response.status);
  }
  const body = await response.json() as Record<string, unknown>;
  const data = (body.result && typeof body.result === "object" ? body.result : body) as Record<string, unknown>;
  const sessionId = String(data.sessionId ?? data.session_id ?? "");
  const webSocketDebuggerUrl = String(data.webSocketDebuggerUrl ?? data.web_socket_debugger_url ?? "");
  if (!sessionId || !webSocketDebuggerUrl) {
    throw new Error("Cloudflare Browser Run session response omitted session identity");
  }
  return {
    accountId: account,
    apiToken: token,
    sessionId,
    webSocketDebuggerUrl,
    targetIds: safeTargetIds(data.targets),
    recording,
  };
}

async function closeBrowserRunSession(session: BrowserRunSession): Promise<void> {
  const response = await cloudflareRequest(
    session.accountId,
    session.apiToken,
    "/browser-rendering/devtools/browser/" + encodeURIComponent(session.sessionId),
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error("Cloudflare Browser Run session close failed with HTTP " + response.status);
  }
}

async function readRecording(session: BrowserRunSession): Promise<NonNullable<BrowserRunEvidence["recordingReadback"]>> {
  let attempts = 0;
  let response: Response | null = null;
  for (const delay of [0, ...DIAGNOSTIC_DELAYS_MS]) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    attempts += 1;
    response = await cloudflareRequest(
      session.accountId,
      session.apiToken,
      "/browser-rendering/recording/" + encodeURIComponent(session.sessionId),
    );
    if (response.status !== 404) break;
  }
  if (!response) throw new Error("recording readback did not return a response");
  const contentType = response.headers.get("content-type") ?? "";
  const body = response.ok ? await response.arrayBuffer() : new ArrayBuffer(0);
  return {
    status: response.status,
    available: response.ok,
    contentType,
    bytes: body.byteLength,
    attempts,
  };
}

function redactHar(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((entry) => redactHar(entry, key));
  if (!value || typeof value !== "object") {
    if (key.toLowerCase() === "url") return redactUrl(String(value ?? ""));
    if (/authorization|cookie|secret|token|password|api[-_]?key|jwt/i.test(key)) return "[REDACTED]";
    return typeof value === "string" ? redactText(value) : value;
  }
  const result: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
    result[childKey] = redactHar(childValue, childKey);
  }
  return result;
}

async function readNetworkRecording(
  session: BrowserRunSession,
  targetId: string,
  artifactDir: string,
): Promise<string | null> {
  const response = await cloudflareRequest(
    session.accountId,
    session.apiToken,
    "/browser-rendering/recording/" + encodeURIComponent(session.sessionId)
      + "/network?target=" + encodeURIComponent(targetId) + "&format=har",
  );
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  if (!payload) return null;
  const outputPath = path.join(artifactDir, "network-" + targetId.replace(/[^A-Za-z0-9_-]/g, "_") + ".json");
  await writeFile(outputPath, JSON.stringify(redactHar(payload), null, 2) + "\n", "utf8");
  return path.basename(outputPath);
}

export function createBrowserRunEvidence(): BrowserRunEvidence {
  return {
    sourceSha: process.env.IKIMON_EXPECTED_GIT_SHA?.trim() || null,
    environment: "unknown",
    browserRuntime: "cloudflare",
    sessionId: null,
    recordingEnabled: browserRunDiagnosticsEnabled(),
    screenshots: [],
    traceFiles: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    httpFailures: [],
  };
}

function attachPageDiagnostics(page: Page, evidence: BrowserRunEvidence): void {
  page.on("console", (message) => {
    if (message.type() === "error") {
      evidence.consoleErrors.push({
        text: redactText(message.text()),
        url: message.location().url ? redactUrl(message.location().url) : undefined,
      });
    }
  });
  page.on("pageerror", (error) => {
    evidence.pageErrors.push(redactText(error.message));
  });
  page.on("requestfailed", (request) => {
    evidence.failedRequests.push({
      method: request.method(),
      url: redactUrl(request.url()),
      error: redactText(request.failure()?.errorText ?? "request_failed"),
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      evidence.httpFailures.push({
        method: response.request().method(),
        url: redactUrl(response.url()),
        status: response.status(),
      });
    }
  });
}

const browserRunEvidenceByBrowser = new WeakMap<Browser, BrowserRunEvidence>();

export function registerBrowserRunEvidence(browser: Browser, evidence: BrowserRunEvidence): void {
  browserRunEvidenceByBrowser.set(browser, evidence);
}

export function attachBrowserRunContextDiagnostics(context: BrowserContext): void {
  const browser = context.browser();
  const evidence = browser ? browserRunEvidenceByBrowser.get(browser) : undefined;
  if (!evidence) return;
  for (const page of context.pages()) attachPageDiagnostics(page, evidence);
  context.on("page", (page) => attachPageDiagnostics(page, evidence));
}

export async function captureBrowserRunCheckpoint(page: Page, name: string): Promise<string | null> {
  if (!isCloudflareBrowserRun()) return null;
  const artifactDir = process.env.BROWSER_RUN_ARTIFACT_DIR?.trim()
    || path.resolve(process.cwd(), "test-results", "browser-run");
  await mkdir(artifactDir, { recursive: true });
  const safeName = name.replace(/[^A-Za-z0-9._-]/g, "_");
  const screenshotPath = path.join(artifactDir, safeName + ".png");
  await page.screenshot({ path: screenshotPath, animations: "disabled" });
  if (browserRunDiagnosticsEnabled()) {
    const snapshot = await page.locator("body").ariaSnapshot({ timeout: 5000 }).catch(() => null);
    if (snapshot) await writeFile(path.join(artifactDir, safeName + ".aria.yml"), snapshot + "\n", "utf8");
  }
  return screenshotPath;
}

export async function captureBrowserRunRuntimeIdentity(page: Page): Promise<Record<string, unknown>> {
  const response = await page.request.get("/api/v1/runtime/version", { failOnStatusCode: false });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  const identity = {
    status: response.status(),
    environment: String(payload.environment ?? "unknown"),
    sourceSha: String(payload.sourceSha ?? payload.gitSha ?? payload.commitSha ?? ""),
    deploymentId: String(payload.deploymentId ?? payload.workerVersion ?? payload.version ?? ""),
    publicSafe: payload.publicSafe === true,
  };
  const artifactDir = process.env.BROWSER_RUN_ARTIFACT_DIR?.trim()
    || path.resolve(process.cwd(), "test-results", "browser-run");
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, "runtime-identity.json"), JSON.stringify(identity, null, 2) + "\n", "utf8");
  return identity;
}

export async function finalizeBrowserRun(
  session: BrowserRunSession,
  evidence: BrowserRunEvidence,
  artifactDir: string,
): Promise<void> {
  evidence.sessionId = session.sessionId;
  let closeError: unknown = null;
  try {
    await closeBrowserRunSession(session);
  } catch (error) {
    closeError = error;
  }
  if (session.recording) {
    try {
      const recordingReadback = await readRecording(session);
      evidence.recordingReadback = recordingReadback;
      if (recordingReadback.available) {
        await mkdir(artifactDir, { recursive: true });
        const names = await Promise.all(session.targetIds.map((targetId) => readNetworkRecording(session, targetId, artifactDir)));
        evidence.networkReadback = names.filter((name): name is string => Boolean(name));
      }
    } catch (error) {
      evidence.finalizationError = redactText(error instanceof Error ? error.message : String(error));
    }
  }
  if (closeError && !evidence.finalizationError) {
    evidence.finalizationError = redactText(closeError instanceof Error ? closeError.message : String(closeError));
  }
}

async function writeEvidence(evidence: BrowserRunEvidence, artifactDir: string, testInfo: TestInfo): Promise<void> {
  await mkdir(artifactDir, { recursive: true });
  const files = await readdir(artifactDir).catch(() => []);
  evidence.screenshots = files.filter((file) => file.endsWith(".png")).sort();
  evidence.traceFiles = files.filter((file) => file.endsWith(".zip")).sort();
  try {
    const runtimeIdentity = JSON.parse(
      await readFile(path.join(artifactDir, "runtime-identity.json"), "utf8"),
    ) as { environment?: unknown };
    evidence.environment = String(runtimeIdentity.environment ?? evidence.environment);
  } catch {
    // Login/runtime failures can happen before the identity checkpoint; keep unknown truthful.
  }
  const outputPath = path.join(artifactDir, "browser-run-evidence.json");
  await writeFile(outputPath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  await testInfo.attach("browser-run-evidence", { path: outputPath, contentType: "application/json" });
}

type BrowserRunFixtures = {
  browserRunBrowser: Browser;
};

const runtimeTest = baseTest.extend<BrowserRunFixtures>({
  browserRunBrowser: async ({ browser }, use, testInfo) => {
    if (!isCloudflareBrowserRun()) {
      await use(browser);
      return;
    }
    const artifactDir = testInfo.outputDir;
    const previousArtifactDir = process.env.BROWSER_RUN_ARTIFACT_DIR;
    process.env.BROWSER_RUN_ARTIFACT_DIR = artifactDir;
    const evidence = createBrowserRunEvidence();
    const session = await createBrowserRunSession();
    evidence.sessionId = session.sessionId;
    const remoteBrowser = await chromium.connectOverCDP(session.webSocketDebuggerUrl, {
      headers: { Authorization: "Bearer " + session.apiToken },
    });
    registerBrowserRunEvidence(remoteBrowser, evidence);
    try {
      await use(remoteBrowser);
    } finally {
      await remoteBrowser.close().catch((error: unknown) => {
        evidence.finalizationError = redactText(error instanceof Error ? error.message : String(error));
      });
      await finalizeBrowserRun(session, evidence, artifactDir);
      await writeEvidence(evidence, artifactDir, testInfo);
      if (previousArtifactDir === undefined) delete process.env.BROWSER_RUN_ARTIFACT_DIR;
      else process.env.BROWSER_RUN_ARTIFACT_DIR = previousArtifactDir;
    }
  },
});

export const test = runtimeTest;
export { expect };
