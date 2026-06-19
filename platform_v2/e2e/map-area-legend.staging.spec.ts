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
    await fulfillJson(route, { type: "FeatureCollection", features: [] });
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

async function newMapPage(browser: Browser, profile: ViewportProfile): Promise<Page> {
  const context = await browser.newContext(stagingContextOptions({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    locale: "ja-JP",
    serviceWorkers: "block",
  }));
  return context.newPage();
}

for (const profile of VIEWPORTS) {
  test(`area legend explains map meanings without overflow (${profile.slug})`, async ({ browser }) => {
    const page = await newMapPage(browser, profile);
    await installMapFixtures(page);

    const response = await page.goto("/ja/map?tab=places&lng=137.7032&lat=34.6983&z=14.9", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.locator("#map-explorer canvas[data-maplibre-smoke-stub='1']")).toBeVisible();

    const legend = page.locator("#me-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toHaveAttribute("data-legend-mode", "areas");
    await expect(page.locator("#me-legend-detail")).toBeVisible();
    await expect(page.locator(".me-legend-chip.is-park")).toContainText("公園・緑地");
    await expect(page.locator(".me-legend-chip.is-school")).toContainText("学校・教育施設");
    await expect(page.locator(".me-legend-chip.is-water")).toContainText("水辺・水路");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.getByRole("tab", { name: "季節の気配" }).click();
    await expect(legend).toHaveAttribute("data-legend-mode", "scale");
    await expect(page.locator("#me-legend-detail")).toBeHidden();
    await page.context().close();
  });
}
