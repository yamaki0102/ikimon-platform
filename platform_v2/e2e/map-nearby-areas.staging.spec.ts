import { test, expect, type Browser, type Page, type Route } from "@playwright/test";
import {
  installMapLibreStubForSmoke,
  stagingContextOptions,
  suppressMapLibreForSmoke,
  type ViewportProfile,
} from "./support/staging.js";

test.describe.configure({ retries: 0, timeout: 45_000 });

const VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 1000 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const AREA_COLLECTION = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [137.7018, 34.6976],
          [137.7046, 34.6976],
          [137.7046, 34.6994],
          [137.7018, 34.6994],
          [137.7018, 34.6976],
        ]],
      },
      properties: {
        field_id: "osm_park:nearby-public",
        source: "osm_park",
        name: "西伊場一条公園",
        access: "public",
        source_confidence: 0.9,
        area_ha: 2.1,
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [137.706, 34.699],
          [137.708, 34.699],
          [137.708, 34.701],
          [137.706, 34.701],
          [137.706, 34.699],
        ]],
      },
      properties: {
        field_id: "school:nearby-school",
        source: "school",
        name: "近くの学校",
        access: "restricted",
        source_confidence: 0.8,
        area_ha: 3.5,
      },
    },
  ],
};

async function fulfillJson(route: Route, payload: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload),
  });
}

async function installMapFixtures(page: Page): Promise<void> {
  await installMapLibreStubForSmoke(page);
  await suppressMapLibreForSmoke(page);
  await page.route("**/api/v1/map/area-polygons**", async (route) => {
    await fulfillJson(route, AREA_COLLECTION);
  });
  await page.route("**/api/v1/map/cells**", async (route) => {
    await fulfillJson(route, { type: "FeatureCollection", features: [], stats: { totalReturned: 0, totalAll: 0 } });
  });
  await page.route("**/api/v1/map/observations**", async (route) => {
    await fulfillJson(route, { items: [], stats: { totalReturned: 0, totalAll: 0 } });
  });
  await page.route("**/api/v1/map/frontier**", async (route) => {
    await fulfillJson(route, { type: "FeatureCollection", features: [], stats: { totalReturned: 0, totalAll: 0 } });
  });
  await page.route("**/api/v1/map/guide-spots**", async (route) => {
    await fulfillJson(route, { type: "FeatureCollection", features: [] });
  });
  await page.route("**/api/v1/map/effort-summary**", async (route) => {
    await fulfillJson(route, { status: "ok", totals: { records: 0, visits: 0, contributors: 0, minutes: 0 } });
  });
  await page.route("**/api/v1/map/site-brief**", async (route) => {
    await fulfillJson(route, { ok: false, error: "qa_fixture_no_site_brief" });
  });
}

async function newGeolocatedPage(browser: Browser, profile: ViewportProfile): Promise<Page> {
  const context = await browser.newContext(stagingContextOptions({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    geolocation: { longitude: 137.7032, latitude: 34.6983 },
    locale: "ja-JP",
    serviceWorkers: "block",
  }));
  await context.grantPermissions(["geolocation"]);
  return context.newPage();
}

for (const profile of VIEWPORTS) {
  test(`locate highlights nearby discoverable area entries (${profile.slug})`, async ({ browser }) => {
    const page = await newGeolocatedPage(browser, profile);
    await installMapFixtures(page);
    const response = await page.goto("/ja/map?tab=places&lng=137.7032&lat=34.6983&z=14.9", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.locator("#map-explorer canvas[data-maplibre-smoke-stub='1']")).toBeVisible();

    await page.locator("#me-locate-fab").click();
    await expect(page.locator(".me-nearby-area-marker")).toHaveCount(2);
    await expect(page.locator(".me-nearby-area-marker.is-public")).toContainText("西伊場一条公園");
    await expect(page.locator(".me-nearby-area-marker.is-school")).toContainText("近くの学校");
    await expect(page.locator("#me-map-status")).toContainText("現在地の近くで 2 件のエリア");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.context().close();
  });
}
