import { mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  APIRequestContext,
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Locator,
  Page,
  Playwright,
} from "@playwright/test";
import { expect } from "@playwright/test";

export const DEFAULT_STAGING_MAP_PATH = "/map?bm=esri&lng=137.8589&lat=34.7219&z=10.6";
export const STAGING_BASE_URL = process.env.STAGING_BASE_URL ?? "https://staging.ikimon.life";

export type SeededRegressionFixture = {
  visitId: string;
  occurrenceId: string;
  placeId: string;
  subjectLabel: string;
  observedAt: string;
  sourceKind: string;
  expectedVisibility: "manual_only" | "all_research_artifacts_only" | "excluded";
};

export type SeededRegressionFixtureBundle = {
  fixturePrefix: string;
  user: {
    userId: string;
    displayName: string;
  };
  manual: SeededRegressionFixture;
  historical: SeededRegressionFixture;
  smoke: SeededRegressionFixture;
};

export type ViewportProfile = {
  slug: string;
  viewport: { width: number; height: number };
  isMobile?: boolean;
  hasTouch?: boolean;
};

export const MAP_VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 900 } },
  { slug: "desktop-1280", viewport: { width: 1280, height: 800 } },
  { slug: "desktop-1024", viewport: { width: 1024, height: 768 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function encodeBasicAuth(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString("base64");
}

export function stagingBasicAuthHeader(): string | null {
  const user = process.env.STAGING_BASIC_AUTH_USER?.trim();
  const pass = process.env.STAGING_BASIC_AUTH_PASS?.trim();
  if (!user || !pass) {
    return null;
  }
  return `Basic ${encodeBasicAuth(user, pass)}`;
}

export function stagingContextOptions(overrides: Partial<BrowserContextOptions> = {}): BrowserContextOptions {
  const user = process.env.STAGING_BASIC_AUTH_USER?.trim();
  const pass = process.env.STAGING_BASIC_AUTH_PASS?.trim();
  return {
    ignoreHTTPSErrors: true,
    httpCredentials: user && pass ? { username: user, password: pass } : undefined,
    ...overrides,
  };
}

export async function newStagingContext(
  browser: Browser,
  profile: ViewportProfile,
): Promise<BrowserContext> {
  return browser.newContext(
    stagingContextOptions({
      viewport: profile.viewport,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
    }),
  );
}

export async function createStagingApiContext(playwright: Playwright): Promise<APIRequestContext> {
  const authHeader = stagingBasicAuthHeader();
  return playwright.request.newContext({
    baseURL: STAGING_BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: authHeader ? { Authorization: authHeader } : undefined,
  });
}

type SeedRegressionResponse = {
  ok: boolean;
  error?: string;
  fixture?: SeededRegressionFixtureBundle;
};

type CleanupResponse = {
  ok: boolean;
  error?: string;
};

export async function seedRegressionFixtures(
  api: APIRequestContext,
  writeKey: string,
  fixturePrefix: string,
): Promise<SeededRegressionFixtureBundle> {
  const response = await api.post("/api/v1/ops/staging/fixtures/seed-regression", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: { fixturePrefix },
  });
  const payload = (await response.json()) as SeedRegressionResponse;
  expect(response.ok(), payload.error ?? "seed_regression_failed").toBeTruthy();
  expect(payload.ok, payload.error ?? "seed_regression_failed").toBeTruthy();
  expect(payload.fixture).toBeTruthy();
  return payload.fixture!;
}

export async function cleanupFixtures(
  api: APIRequestContext,
  writeKey: string,
  fixturePrefix: string,
): Promise<void> {
  const response = await api.post("/api/v1/ops/staging/fixtures/cleanup", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: { fixturePrefix },
  });
  const payload = (await response.json()) as CleanupResponse;
  expect(response.ok(), payload.error ?? "cleanup_fixtures_failed").toBeTruthy();
  expect(payload.ok, payload.error ?? "cleanup_fixtures_failed").toBeTruthy();
}

function parseSetCookie(rawCookie: string): { name: string; value: string } {
  const firstSegment = rawCookie.split(";")[0] ?? "";
  const separatorIndex = firstSegment.indexOf("=");
  if (separatorIndex < 1) {
    throw new Error(`invalid_set_cookie:${rawCookie}`);
  }
  return {
    name: firstSegment.slice(0, separatorIndex),
    value: decodeURIComponent(firstSegment.slice(separatorIndex + 1)),
  };
}

export async function addSessionCookie(context: BrowserContext, rawCookie: string): Promise<void> {
  const url = new URL(STAGING_BASE_URL);
  const parsed = parseSetCookie(rawCookie);
  await context.addCookies([
    {
      name: parsed.name,
      value: parsed.value,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}

export async function waitForMapReady(page: Page, mapPath = DEFAULT_STAGING_MAP_PATH): Promise<void> {
  await page.goto(mapPath, { waitUntil: "domcontentloaded" });
  await page.locator("#map-explorer").waitFor({ state: "visible" });
  await page.locator("#map-explorer canvas").first().waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    return document.querySelectorAll(".me-result-row").length > 0 || document.querySelectorAll(".me-results-empty").length > 0;
  });
  await expect(page.locator(".me-main")).toBeVisible();
}

export async function waitForSearchAreaButton(page: Page): Promise<void> {
  await expect(page.locator("#me-search-area-btn")).toBeVisible();
}

export async function dragMap(page: Page, deltaX: number, deltaY: number): Promise<void> {
  const canvas = page.locator("#map-explorer canvas").first();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("map_canvas_not_ready");
  }
  const startX = box.x + box.width * 0.78;
  const startY = box.y + box.height * 0.34;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 12 });
  await page.mouse.up();
}

export async function triggerPendingViewportSearch(page: Page): Promise<void> {
  await page.waitForTimeout(700);
  const attempts = [
    { x: 220, y: 80 },
    { x: -240, y: 110 },
    { x: 0, y: -180 },
  ];
  for (const attempt of attempts) {
    await dragMap(page, attempt.x, attempt.y);
    try {
      await expect(page.locator("#me-search-area-btn")).toBeVisible({ timeout: 4_000 });
      return;
    } catch {
      // Try a different drag vector until moveend toggles the pending-search CTA.
    }
  }
  await expect(page.locator("#me-search-area-btn")).toBeVisible();
}

export async function maybeCaptureQaScreenshot(page: Page, fileName: string): Promise<string | null> {
  const targetDir = process.env.MAP_QA_CAPTURE_DIR?.trim();
  if (!targetDir) {
    return null;
  }
  await mkdir(targetDir, { recursive: true });
  const outputPath = path.join(targetDir, fileName);
  await page.screenshot({
    path: outputPath,
    type: "jpeg",
    quality: 72,
    animations: "disabled",
  });
  return outputPath;
}

export async function expectMaskedScreenshot(
  locator: Locator,
  fileName: string,
  masks: Locator[] = [],
): Promise<void> {
  await expect(locator).toHaveScreenshot(fileName, {
    animations: "disabled",
    caret: "hide",
    mask: masks,
    maxDiffPixelRatio: 0.03,
  });
}

export function uniqueFixturePrefix(prefix: string): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;
  return `${prefix}-${stamp}`;
}
