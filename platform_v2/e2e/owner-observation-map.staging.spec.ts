import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  addSessionCookie,
  cleanupFixtures,
  createStagingApiContext,
  installMapLibreStubForSmoke,
  issueSessionCookie,
  newStagingContext,
  requireEnv,
  seedRegressionFixtures,
  type SeededRegressionFixtureBundle,
  type ViewportProfile,
  uniqueFixturePrefix,
} from "./support/staging.js";

const VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 900 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

type OwnerObservationPayload = {
  signedIn?: boolean;
  items?: Array<{
    occurrenceId?: string;
    visitId?: string;
    displayName?: string;
    latitude?: number;
    longitude?: number;
    photoUrl?: string | null;
  }>;
};

type ExpectedBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
  centerLat: number;
  centerLng: number;
};

function cookieHeader(rawCookie: string): string {
  return rawCookie.split(";")[0] ?? rawCookie;
}

async function fetchOwnerObservations(api: APIRequestContext, rawCookie: string): Promise<OwnerObservationPayload> {
  const response = await api.get("/api/v1/me/map-observations?limit=48", {
    headers: {
      accept: "application/json",
      cookie: cookieHeader(rawCookie),
    },
  });
  expect(response.ok(), `me/map-observations should be reachable: ${response.status()}`).toBeTruthy();
  return (await response.json()) as OwnerObservationPayload;
}

function expectedOwnerObservationBounds(payload: OwnerObservationPayload): ExpectedBounds {
  const points = (payload.items ?? [])
    .map((item) => ({ lat: Number(item.latitude), lng: Number(item.longitude), photoUrl: item.photoUrl }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && Boolean(point.photoUrl));
  expect(points.length, JSON.stringify(payload.items?.slice(0, 8), null, 2)).toBeGreaterThan(0);

  let west = Math.min(...points.map((point) => point.lng));
  let east = Math.max(...points.map((point) => point.lng));
  let south = Math.min(...points.map((point) => point.lat));
  let north = Math.max(...points.map((point) => point.lat));
  if (Math.abs(east - west) < 0.0008) {
    west -= 0.0008;
    east += 0.0008;
  }
  if (Math.abs(north - south) < 0.0008) {
    south -= 0.0008;
    north += 0.0008;
  }
  return {
    west,
    south,
    east,
    north,
    centerLat: (south + north) / 2,
    centerLng: (west + east) / 2,
  };
}

async function waitForOwnerMarkers(page: Page): Promise<void> {
  await page.locator("#map-explorer").waitFor({ state: "visible" });
  await expect.poll(
    async () => page.locator(".me-own-observation-marker").count(),
    { timeout: 20_000 },
  ).toBeGreaterThan(0);
}

function ownerObservationMarker(page: Page, occurrenceId: string): ReturnType<Page["locator"]> {
  return page.locator(`.me-own-observation-marker[data-own-observation-ids*="${occurrenceId}"]`).first();
}

async function captureEvidence(page: Page, profile: ViewportProfile, fixture: SeededRegressionFixtureBundle): Promise<void> {
  const outputDir = process.env.OWNER_MAP_CAPTURE_DIR?.trim();
  const screenshotName = `owner-observation-map-${profile.slug}.png`;
  const stateName = `owner-observation-map-${profile.slug}.json`;
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

  const state = await page.evaluate((manualOccurrenceId) => {
    const markers = Array.from(document.querySelectorAll<HTMLElement>(".me-own-observation-marker")).map((marker) => {
      const rect = marker.getBoundingClientRect();
      return {
        href: marker.getAttribute("href"),
        label: marker.getAttribute("aria-label"),
        count: marker.getAttribute("data-own-observation-count"),
        ids: marker.getAttribute("data-own-observation-ids"),
        hasImage: Boolean(marker.querySelector("img")),
        text: marker.textContent?.replace(/\s+/g, " ").trim() ?? "",
        rect: {
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    });
    return {
      url: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      markerCount: markers.length,
      stackCount: markers.filter((marker) => Number(marker.count ?? "1") > 1).length,
      manualOccurrenceLinked: markers.some((marker) =>
        marker.href?.includes(encodeURIComponent(manualOccurrenceId)) ||
        marker.ids?.split(",").includes(manualOccurrenceId)
      ),
      markers,
    };
  }, fixture.manual.occurrenceId);

  await writeFile(statePath, JSON.stringify(state, null, 2));
  await test.info().attach(screenshotName, { path: screenshotPath, contentType: "image/png" });
  await test.info().attach(stateName, { path: statePath, contentType: "application/json" });
}

test.describe.serial("authenticated owner observation map staging evidence", () => {
  let api: APIRequestContext;
  let fixturePrefix = "";
  let writeKey = "";
  let fixture: SeededRegressionFixtureBundle;
  let sessionCookie = "";
  let cleanedUp = false;

  test.beforeAll(async ({ playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    api = await createStagingApiContext(playwright);
    fixturePrefix = uniqueFixturePrefix("owner-map");
    fixture = await seedRegressionFixtures(api, writeKey, fixturePrefix);
    sessionCookie = await issueSessionCookie(api, writeKey, fixture.user.userId);
  });

  test.afterAll(async () => {
    if (!cleanedUp) {
      await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
    }
    await api.dispose();
  });

  test("private owner API returns exact meaningful own photo points only", async () => {
    const payload = await fetchOwnerObservations(api, sessionCookie);
    expect(payload.signedIn).toBe(true);
    expect(payload.items?.length ?? 0).toBeGreaterThan(0);

    const manual = payload.items?.find((item) => item.visitId === fixture.manual.visitId);
    expect(manual, JSON.stringify(payload.items?.slice(0, 8), null, 2)).toBeTruthy();
    expect(manual?.occurrenceId).toBe(fixture.manual.occurrenceId);
    expect(manual?.displayName).toBe(fixture.manual.subjectLabel);
    expect(manual?.photoUrl).toBeTruthy();
    expect(manual?.latitude).toBeCloseTo(35.0104, 4);
    expect(manual?.longitude).toBeCloseTo(138.3929, 4);
    expect(payload.items?.some((item) => item.visitId === fixture.smoke.visitId)).toBe(false);
  });

  test("map opens around owner records when no viewport is specified", async ({ browser }) => {
    const payload = await fetchOwnerObservations(api, sessionCookie);
    const expectedBounds = expectedOwnerObservationBounds(payload);
    const manual = payload.items?.find((item) => item.visitId === fixture.manual.visitId);
    expect(manual, JSON.stringify(payload.items?.slice(0, 8), null, 2)).toBeTruthy();

    const context = await newStagingContext(browser, VIEWPORTS[0], { serviceWorkers: "block" });
    await addSessionCookie(context, sessionCookie);
    const page = await context.newPage();
    await installMapLibreStubForSmoke(page);

    try {
      await page.goto("/ja/map?tab=places", { waitUntil: "domcontentloaded" });
      await waitForOwnerMarkers(page);

      const fit = await page.evaluate(() => (window as any).__ikimonMapSmokeLastFitBounds ?? null);
      expect(fit, "owner observations should drive first map viewport when no lng/lat/z is provided").toBeTruthy();
      expect(fit.options?.maxZoom).toBeCloseTo(15.2, 1);
      expect(fit.center?.latitude ?? fit.center?.lat).toBeCloseTo(expectedBounds.centerLat, 4);
      expect(fit.center?.longitude ?? fit.center?.lng).toBeCloseTo(expectedBounds.centerLng, 4);
      expect(fit.bounds?.[0]?.[0]).toBeLessThanOrEqual(Number(manual?.longitude));
      expect(fit.bounds?.[1]?.[0]).toBeGreaterThanOrEqual(Number(manual?.longitude));
      expect(fit.bounds?.[0]?.[1]).toBeLessThanOrEqual(Number(manual?.latitude));
      expect(fit.bounds?.[1]?.[1]).toBeGreaterThanOrEqual(Number(manual?.latitude));
    } finally {
      await context.close();
    }
  });

  for (const profile of VIEWPORTS) {
    test(`own observation markers are visible with thumbnails and hidden in rain mode (${profile.slug})`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile, { serviceWorkers: "block" });
      await addSessionCookie(context, sessionCookie);
      const page = await context.newPage();
      await installMapLibreStubForSmoke(page);

      try {
        await page.goto("/ja/map?tab=places&lng=138.3929&lat=35.0104&z=16", { waitUntil: "domcontentloaded" });
        await waitForOwnerMarkers(page);

        const marker = ownerObservationMarker(page, fixture.manual.occurrenceId);
        await expect(marker).toBeVisible();
        await expect(marker).toContainText(fixture.manual.subjectLabel);
        await expect(marker.locator("img")).toBeVisible();
        await expect(marker).toHaveAttribute("data-own-observation-count", /\d+/);
        const markerCount = Number(await marker.getAttribute("data-own-observation-count"));
        if (markerCount > 1) {
          await expect(marker).toHaveAttribute("data-own-observation-ids", new RegExp(fixture.manual.occurrenceId));
          await marker.click();
          await expect(page.locator('[data-own-observation-stack-sheet="1"]')).toBeVisible();
          await expect(page.locator(`[data-own-observation-choice="${fixture.manual.occurrenceId}"]`)).toBeVisible();
          await page.locator("#me-bottom-close").click();
        } else {
          await expect(marker).toHaveAttribute("href", new RegExp(`/observations/${encodeURIComponent(fixture.manual.occurrenceId)}`));
        }
        await captureEvidence(page, profile, fixture);

        await page.locator('.me-tab[data-tab="rain"]').click();
        await expect(page.locator('.me-tab[data-tab="rain"]')).toHaveAttribute("aria-selected", "true");
        await expect.poll(
          async () => page.locator(".me-own-observation-marker").count(),
          { timeout: 10_000 },
        ).toBe(0);
      } finally {
        await context.close();
      }
    });
  }

  test("cleanup removes owner fixtures from the private owner API", async () => {
    await cleanupFixtures(api, writeKey, fixturePrefix);
    cleanedUp = true;

    const payload = await fetchOwnerObservations(api, sessionCookie);
    expect(payload.items?.some((item) => item.visitId === fixture.manual.visitId)).toBe(false);
  });
});
