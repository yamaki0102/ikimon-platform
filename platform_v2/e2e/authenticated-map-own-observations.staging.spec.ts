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

type OwnerObservationItem = {
  visitId?: string;
  displayName?: string;
  lat?: number;
  lng?: number;
  photoUrl?: string | null;
  source?: string;
};

type ExpectedOwnerObservationItem = OwnerObservationItem & {
  visitId: string;
  displayName: string;
  photoUrl: string;
  source: "visit_point";
};

const DISALLOWED_OWNER_PHOTO_URL_PATTERN = /\/assets\/(?:img\/(?:(?:pwa-)?icon-192(?:-[^/.]+)?\.png)|brand\/(?:app-icon-192(?:-maskable)?|ikimon-mark-192)\.png)(?:[?#].*)?$/;

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

function hasNonPlaceholderOwnerPhotoUrl(item: OwnerObservationItem): item is OwnerObservationItem & { photoUrl: string } {
  return Boolean(item.photoUrl && !DISALLOWED_OWNER_PHOTO_URL_PATTERN.test(item.photoUrl));
}

function isExpectedOwnerItem(item: OwnerObservationItem): item is ExpectedOwnerObservationItem {
  return Boolean(
    item.visitId
    && item.displayName
    && item.source === "visit_point"
    && hasNonPlaceholderOwnerPhotoUrl(item),
  );
}

function selectExpectedOwnerItem(
  items: OwnerObservationItem[],
  fixture: SeededRegressionFixtureBundle,
  otherFixture: SeededRegressionFixtureBundle,
): ExpectedOwnerObservationItem | null {
  const excludedVisitIds = new Set([
    fixture.smoke.visitId,
    otherFixture.manual.visitId,
    otherFixture.historical.visitId,
    otherFixture.smoke.visitId,
    otherFixture.scene.visitId,
  ]);
  const expectedItems = items.filter((item) => isExpectedOwnerItem(item) && !excludedVisitIds.has(item.visitId));
  return expectedItems.find((item) => item.visitId === fixture.manual.visitId) ?? expectedItems[0] ?? null;
}

async function fetchExpectedOwnerItem(
  playwright: Parameters<typeof createStagingApiContext>[0],
  sessionCookie: string,
  fixture: SeededRegressionFixtureBundle,
  otherFixture: SeededRegressionFixtureBundle,
): Promise<{ item: ExpectedOwnerObservationItem; items: OwnerObservationItem[] }> {
  const ownerApi = await createStagingApiContext(playwright);
  try {
    const response = await ownerApi.get(`/api/v1/me/map-observations?bbox=${encodeURIComponent(OWNER_BBOX)}&limit=24`, {
      headers: {
        cookie: cookieHeader(sessionCookie),
        accept: "application/json",
      },
    });
    expect(response.ok(), `owner endpoint should respond: ${response.status()}`).toBeTruthy();
    const payload = await response.json() as {
      signedIn?: boolean;
      items?: OwnerObservationItem[];
    };
    expect(payload.signedIn).toBe(true);
    const items = payload.items ?? [];
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((item) => item.visitId === otherFixture.manual.visitId), JSON.stringify(items, null, 2)).toBe(false);
    expect(items.some((item) => item.visitId === fixture.smoke.visitId), JSON.stringify(items, null, 2)).toBe(false);
    const item = selectExpectedOwnerItem(items, fixture, otherFixture);
    expect(item, `owner endpoint did not return a non-placeholder visit_point item: ${JSON.stringify(items, null, 2)}`).toBeTruthy();
    return { item: item!, items };
  } finally {
    await ownerApi.dispose();
  }
}

async function assertMeaningfulOwnerShotVisible(page: Page, expectedItem: ExpectedOwnerObservationItem): Promise<void> {
  const state = await page.waitForFunction((expectedSubject) => {
    const ownerStrip = document.querySelector<HTMLElement>("#me-own-observations");
    if (!ownerStrip || ownerStrip.hidden) return null;
    const stripStyle = window.getComputedStyle(ownerStrip);
    if (stripStyle.display === "none" || stripStyle.visibility === "hidden") return null;
    const stripText = ownerStrip.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!stripText.includes(expectedSubject)) return null;

    const subjectShots = [...ownerStrip.querySelectorAll<HTMLElement>(".me-own-shot")]
      .filter((element) => (element.textContent ?? "").includes(expectedSubject));
    const loadedSubjectShot = subjectShots.find((element) => {
      const image = element.querySelector<HTMLImageElement>("img");
      const rect = element.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      return Boolean(
        image
        && image.getAttribute("src")
        && !/\/assets\/(?:img\/(?:(?:pwa-)?icon-192(?:-[^/.]+)?\.png)|brand\/(?:app-icon-192(?:-maskable)?|ikimon-mark-192)\.png)(?:[?#].*)?$/.test(image.currentSrc || image.src)
        && image.complete
        && image.naturalWidth > 0
        && image.naturalHeight > 0
        && rect.width > 0
        && rect.height > 0
        && imageRect
        && imageRect.width > 0
        && imageRect.height > 0,
      );
    });
    if (!loadedSubjectShot) return null;

    const loadedMarker = [...document.querySelectorAll<HTMLElement>(".me-own-observation-marker.has-photo")]
      .find((element) => {
        const image = element.querySelector<HTMLImageElement>("img");
        const rect = element.getBoundingClientRect();
        const imageRect = image?.getBoundingClientRect();
        return Boolean(
          image
          && image.getAttribute("src")
          && !/\/assets\/(?:img\/(?:(?:pwa-)?icon-192(?:-[^/.]+)?\.png)|brand\/(?:app-icon-192(?:-maskable)?|ikimon-mark-192)\.png)(?:[?#].*)?$/.test(image.currentSrc || image.src)
          && image.complete
          && image.naturalWidth > 0
          && image.naturalHeight > 0
          && rect.width > 0
          && rect.height > 0
          && imageRect
          && imageRect.width > 0
          && imageRect.height > 0,
        );
      });
    if (!loadedMarker) return null;

    const shotRect = loadedSubjectShot.getBoundingClientRect();
    const shotImage = loadedSubjectShot.querySelector<HTMLImageElement>("img")!;
    const markerRect = loadedMarker.getBoundingClientRect();
    const markerImage = loadedMarker.querySelector<HTMLImageElement>("img")!;
    return {
      ownerStripHidden: ownerStrip.hidden,
      ownerStripText: stripText,
      subjectShot: {
        text: loadedSubjectShot.textContent?.replace(/\s+/g, " ").trim() ?? "",
        imageSrc: shotImage.currentSrc || shotImage.src,
        imageNaturalWidth: shotImage.naturalWidth,
        imageNaturalHeight: shotImage.naturalHeight,
        rect: {
          width: Math.round(shotRect.width),
          height: Math.round(shotRect.height),
        },
      },
      marker: {
        ariaLabel: loadedMarker.getAttribute("aria-label"),
        imageSrc: markerImage.currentSrc || markerImage.src,
        imageNaturalWidth: markerImage.naturalWidth,
        imageNaturalHeight: markerImage.naturalHeight,
        rect: {
          width: Math.round(markerRect.width),
          height: Math.round(markerRect.height),
        },
      },
    };
  }, expectedItem.displayName, { timeout: 60_000 });

  const visibleState = await state.jsonValue();
  expect(visibleState.ownerStripHidden).toBe(false);
  expect(visibleState.ownerStripText).toContain(expectedItem.displayName);
  expect(visibleState.subjectShot.text).toContain(expectedItem.displayName);
  expect(visibleState.subjectShot.imageSrc).not.toMatch(DISALLOWED_OWNER_PHOTO_URL_PATTERN);
  expect(visibleState.subjectShot.imageNaturalWidth).toBeGreaterThan(0);
  expect(visibleState.subjectShot.imageNaturalHeight).toBeGreaterThan(0);
  expect(visibleState.subjectShot.rect.width).toBeGreaterThan(0);
  expect(visibleState.subjectShot.rect.height).toBeGreaterThan(0);
  expect(visibleState.marker.imageSrc).not.toMatch(DISALLOWED_OWNER_PHOTO_URL_PATTERN);
  expect(visibleState.marker.imageNaturalWidth).toBeGreaterThan(0);
  expect(visibleState.marker.imageNaturalHeight).toBeGreaterThan(0);
  expect(visibleState.marker.rect.width).toBeGreaterThan(0);
  expect(visibleState.marker.rect.height).toBeGreaterThan(0);
}

async function captureEvidence(page: Page, profile: ViewportProfile, expectedItem: ExpectedOwnerObservationItem): Promise<void> {
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

  const state = await page.evaluate((expectedOwner) => {
    const ownCard = document.querySelector<HTMLElement>("#me-own-observations");
    const shots = [...document.querySelectorAll<HTMLElement>(".me-own-shot")].map((element) => {
      const image = element.querySelector<HTMLImageElement>("img");
      const rect = element.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      return {
        text: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
        hasImage: Boolean(image?.getAttribute("src")),
        imageNaturalWidth: image?.naturalWidth ?? 0,
        imageNaturalHeight: image?.naturalHeight ?? 0,
        imageRect: imageRect ? {
          width: Math.round(imageRect.width),
          height: Math.round(imageRect.height),
        } : null,
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
      const imageRect = image?.getBoundingClientRect();
      return {
        className: element.className,
        ariaLabel: element.getAttribute("aria-label"),
        hasImage: Boolean(image?.getAttribute("src")),
        imageNaturalWidth: image?.naturalWidth ?? 0,
        imageNaturalHeight: image?.naturalHeight ?? 0,
        imageRect: imageRect ? {
          width: Math.round(imageRect.width),
          height: Math.round(imageRect.height),
        } : null,
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
      expectedOwner,
      ownCardHidden: ownCard?.hidden ?? null,
      ownCardText: ownCard?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      publicRows: document.querySelectorAll(".me-result-row").length,
      shots,
      markers,
    };
  }, {
    visitId: expectedItem.visitId,
    displayName: expectedItem.displayName,
    photoUrl: expectedItem.photoUrl,
  });
  await writeFile(statePath, JSON.stringify(state, null, 2));
  await test.info().attach(screenshotName, { path: screenshotPath, contentType: "image/png" });
  await test.info().attach(stateName, { path: statePath, contentType: "application/json" });
}

test.describe("authenticated map own observation staging evidence", () => {
  let setupApi: APIRequestContext;
  let writeKey: string;
  let fixturePrefix: string;
  let fixture: SeededRegressionFixtureBundle;
  let otherFixturePrefix: string;
  let otherFixture: SeededRegressionFixtureBundle;
  let sessionCookie: string;

  test.beforeAll(async ({ playwright }) => {
    setupApi = await createStagingApiContext(playwright);
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    fixturePrefix = uniqueFixturePrefix("map-own-history");
    otherFixturePrefix = uniqueFixturePrefix("map-own-other");
    await cleanupFixtures(setupApi, writeKey, fixturePrefix).catch(() => undefined);
    await cleanupFixtures(setupApi, writeKey, otherFixturePrefix).catch(() => undefined);
    fixture = await seedRegressionFixtures(setupApi, writeKey, fixturePrefix);
    otherFixture = await seedRegressionFixtures(setupApi, writeKey, otherFixturePrefix);
    sessionCookie = await issueSessionCookie(setupApi, writeKey, fixture.user.userId);
  });

  test.afterAll(async () => {
    if (setupApi && writeKey && fixturePrefix) {
      await cleanupFixtures(setupApi, writeKey, fixturePrefix).catch(() => undefined);
    }
    if (setupApi && writeKey && otherFixturePrefix) {
      await cleanupFixtures(setupApi, writeKey, otherFixturePrefix).catch(() => undefined);
    }
    await setupApi.dispose();
  });

  test("my-observations endpoint is owner-session only and photo-backed on staging", async ({ playwright }) => {
    const anonymousApi = await createStagingApiContext(playwright);
    try {
      const anonymous = await anonymousApi.get(`/api/v1/me/map-observations?bbox=${encodeURIComponent(OWNER_BBOX)}&limit=24`);
      expect(anonymous.ok(), `anonymous endpoint should respond safely: ${anonymous.status()}`).toBeTruthy();
      const anonymousPayload = await anonymous.json() as { signedIn?: boolean; items?: unknown[] };
      expect(anonymousPayload.signedIn).toBe(false);
      expect(anonymousPayload.items ?? []).toHaveLength(0);
    } finally {
      await anonymousApi.dispose();
    }

    const { item: expectedOwnerItem } = await fetchExpectedOwnerItem(playwright, sessionCookie, fixture, otherFixture);
    expect(expectedOwnerItem.source).toBe("visit_point");
    expect(expectedOwnerItem.displayName).toBeTruthy();
    expect(expectedOwnerItem.photoUrl).toBeTruthy();
    expect(expectedOwnerItem.photoUrl).not.toMatch(DISALLOWED_OWNER_PHOTO_URL_PATTERN);
    expect(Number(expectedOwnerItem.lat)).toBeCloseTo(35.0104, 2);
    expect(Number(expectedOwnerItem.lng)).toBeCloseTo(138.3929, 2);
  });

  for (const profile of VIEWPORTS) {
    test(`map renders owner-only shot strip and photo marker (${profile.slug})`, async ({ browser, playwright }) => {
      const { item: expectedOwnerItem } = await fetchExpectedOwnerItem(playwright, sessionCookie, fixture, otherFixture);
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

        await assertMeaningfulOwnerShotVisible(page, expectedOwnerItem);
        await expect(page.locator(".me-own-observation-marker:not(.has-photo)")).toHaveCount(0);

        await captureEvidence(page, profile, expectedOwnerItem);
      } finally {
        await context.close();
      }
    });
  }
});
