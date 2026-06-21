import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect, type APIRequestContext, type Page, type Route } from "@playwright/test";
import {
  addSessionCookie,
  cleanupFixtures,
  createStagingApiContext,
  installMapLibreStubForSmoke,
  issueSessionCookie,
  newStagingContext,
  requireEnv,
  seedRegressionFixtures,
  uniqueFixturePrefix,
  type SeededRegressionFixtureBundle,
  type ViewportProfile,
} from "./support/staging.js";

const VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 900 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const OWNER_MAP_PATH = "/ja/map?tab=places&bm=esri&lng=138.3929&lat=35.0104&z=16.2";
const OWNER_BBOX = "138.38,35.00,138.41,35.02";

async function fulfillJson(route: Route, payload: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload),
  });
}

async function installQuietPublicMapRoutes(page: Page): Promise<void> {
  const emptyFeatureCollection = { type: "FeatureCollection", features: [], stats: { totalReturned: 0, totalAll: 0 } };
  await page.route("**/api/v1/map/cells**", async (route) => fulfillJson(route, emptyFeatureCollection));
  await page.route("**/api/v1/map/observations**", async (route) => fulfillJson(route, {
    items: [],
    stats: { totalReturned: 0, totalAll: 0, markerProfile: "manual_only", gridM: 3000, selectedCellId: null },
  }));
  await page.route("**/api/v1/map/frontier**", async (route) => fulfillJson(route, emptyFeatureCollection));
  await page.route("**/api/v1/map/area-polygons**", async (route) => fulfillJson(route, emptyFeatureCollection));
  await page.route("**/api/v1/map/guide-spots**", async (route) => fulfillJson(route, emptyFeatureCollection));
  await page.route("**/api/v1/map/effort-summary**", async (route) => fulfillJson(route, {
    status: "ok",
    totals: { records: 0, visits: 0, contributors: 0, minutes: 0 },
    frontierRemaining: {},
  }));
  await page.route("**/api/v1/map/site-brief**", async (route) => fulfillJson(route, { ok: false, error: "owner_history_smoke_no_site_brief" }));
  await page.route("**/api/v1/weather/jma-nowcast/times", async (route) => fulfillJson(route, {
    tileUrlTemplate: "/api/v1/weather/jma-nowcast/tile?basetime={basetime}&validtime={validtime}&z={z}&x={x}&y={y}",
    times: [],
  }));
}

function cookieHeader(rawCookie: string): string {
  return rawCookie.split(";")[0] ?? rawCookie;
}

async function captureEvidence(page: Page, profile: ViewportProfile, fixture: SeededRegressionFixtureBundle): Promise<void> {
  const outputDir = process.env.MAP_OWN_OBSERVATIONS_CAPTURE_DIR?.trim();
  const screenshotName = `authenticated-map-own-observations-${profile.slug}.png`;
  const stateName = `authenticated-map-own-observations-${profile.slug}.json`;
  const screenshotPath = outputDir
    ? path.join(outputDir, screenshotName)
    : test.info().outputPath(screenshotName);
  const statePath = outputDir
    ? path.join(outputDir, stateName)
    : test.info().outputPath(stateName);

  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({
    path: screenshotPath,
    type: "png",
    animations: "disabled",
    fullPage: false,
  });

  const state = await page.evaluate((expectedVisitId) => {
    const ownCard = document.querySelector<HTMLElement>("#me-own-observations");
    const shots = [...document.querySelectorAll<HTMLElement>(".me-own-shot")].map((element) => {
      const image = element.querySelector<HTMLImageElement>("img");
      const rect = element.getBoundingClientRect();
      return {
        text: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
        hasImage: Boolean(image?.getAttribute("src")),
        rect: {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    });
    const markers = [...document.querySelectorAll<HTMLElement>(".me-own-observation-marker")].map((element) => {
      const image = element.querySelector<HTMLImageElement>("img");
      const rect = element.getBoundingClientRect();
      return {
        className: element.className,
        ariaLabel: element.getAttribute("aria-label"),
        hasImage: Boolean(image?.getAttribute("src")),
        rect: {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    });
    return {
      url: window.location.href,
      title: document.title,
      expectedVisitId,
      ownCardHidden: ownCard?.hidden ?? null,
      ownCardText: ownCard?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      publicRows: document.querySelectorAll(".me-result-row").length,
      shots,
      markers,
    };
  }, fixture.manual.visitId);
  await writeFile(statePath, JSON.stringify(state, null, 2));
  await test.info().attach(screenshotName, { path: screenshotPath, contentType: "image/png" });
  await test.info().attach(stateName, { path: statePath, contentType: "application/json" });
}

test.describe("authenticated map own observation staging evidence", () => {
  let api: APIRequestContext;
  let writeKey: string;
  let fixturePrefix: string;
  let fixture: SeededRegressionFixtureBundle;
  let otherFixturePrefix: string;
  let otherFixture: SeededRegressionFixtureBundle;
  let sessionCookie: string;

  test.beforeAll(async ({ playwright }) => {
    api = await createStagingApiContext(playwright);
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    fixturePrefix = uniqueFixturePrefix("map-own-history");
    otherFixturePrefix = uniqueFixturePrefix("map-own-other");
    await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
    await cleanupFixtures(api, writeKey, otherFixturePrefix).catch(() => undefined);
    fixture = await seedRegressionFixtures(api, writeKey, fixturePrefix);
    otherFixture = await seedRegressionFixtures(api, writeKey, otherFixturePrefix);
    sessionCookie = await issueSessionCookie(api, writeKey, fixture.user.userId);
  });

  test.afterAll(async () => {
    if (api && writeKey && fixturePrefix) {
      await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
    }
    if (api && writeKey && otherFixturePrefix) {
      await cleanupFixtures(api, writeKey, otherFixturePrefix).catch(() => undefined);
    }
    await api.dispose();
  });

  test("my-observations endpoint is owner-session only and photo-backed on staging", async () => {
    const anonymous = await api.get(`/api/v1/map/my-observations?bbox=${encodeURIComponent(OWNER_BBOX)}&limit=24`);
    expect(anonymous.ok(), `anonymous endpoint should respond safely: ${anonymous.status()}`).toBeTruthy();
    const anonymousPayload = await anonymous.json() as { signedIn?: boolean; items?: unknown[] };
    expect(anonymousPayload.signedIn).toBe(false);
    expect(anonymousPayload.items ?? []).toHaveLength(0);

    const response = await api.get(`/api/v1/map/my-observations?bbox=${encodeURIComponent(OWNER_BBOX)}&limit=24`, {
      headers: {
        cookie: cookieHeader(sessionCookie),
        accept: "application/json",
      },
    });
    expect(response.ok(), `owner endpoint should respond: ${response.status()}`).toBeTruthy();
    const payload = await response.json() as {
      signedIn?: boolean;
      items?: Array<{ visitId?: string; displayName?: string; lat?: number; lng?: number; photoUrl?: string | null; source?: string }>;
    };
    expect(payload.signedIn).toBe(true);
    const items = payload.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    const manual = items.find((item) => item.visitId === fixture.manual.visitId);
    expect(manual, JSON.stringify(items, null, 2)).toBeTruthy();
    expect(items.some((item) => item.visitId === otherFixture.manual.visitId), JSON.stringify(items, null, 2)).toBe(false);
    expect(manual?.source).toBe("visit_point");
    expect(manual?.photoUrl).toBeTruthy();
    expect(Number(manual?.lat)).toBeCloseTo(35.0104, 4);
    expect(Number(manual?.lng)).toBeCloseTo(138.3929, 4);
    expect(items.every((item) => item.source === "visit_point" && Boolean(item.photoUrl))).toBe(true);
  });

  for (const profile of VIEWPORTS) {
    test(`map renders owner-only shot strip and photo marker (${profile.slug})`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile, { serviceWorkers: "block" });
      await addSessionCookie(context, sessionCookie);
      const page = await context.newPage();

      try {
        await installMapLibreStubForSmoke(page);
        await installQuietPublicMapRoutes(page);
        const response = await page.goto(OWNER_MAP_PATH, { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 0, `${OWNER_MAP_PATH} should load`).toBeLessThan(400);
        await page.locator("#map-explorer").waitFor({ state: "visible" });
        await page.locator("#map-explorer canvas").first().waitFor({ state: "visible" });

        await expect(page.locator("#me-own-observations")).toBeVisible({ timeout: 60_000 });
        await expect(page.locator(".me-own-shot").first()).toBeVisible();
        await expect(page.locator(".me-own-shot").first().locator("img")).toHaveAttribute("src", /./);
        await expect(page.locator(".me-own-shot").filter({ hasText: fixture.manual.subjectLabel }).first()).toBeVisible();
        await expect(page.locator(".me-own-observation-marker.has-photo").first()).toBeVisible();
        await expect(page.locator(".me-own-observation-marker:not(.has-photo)")).toHaveCount(0);
        await expect(page.locator(".me-own-observation-marker.has-photo img").first()).toHaveAttribute("src", /./);

        await captureEvidence(page, profile, fixture);
      } finally {
        await context.close();
      }
    });
  }
});
