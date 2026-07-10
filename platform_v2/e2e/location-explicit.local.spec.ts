import { expect, test } from "@playwright/test";
import {
  installMapLibreStubForSmoke,
  suppressMapLibreForSmoke,
} from "./support/staging.js";

test("map startup may use geolocation while record keeps explicit location action", async ({ browser }) => {
  const baseURL = process.env.STAGING_BASE_URL || "http://127.0.0.1:4322";
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    window.__geoCalls = [];
    const fakePosition = {
      coords: {
        latitude: 34.7108,
        longitude: 137.7261,
        accuracy: 15,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success, _error, options) {
          window.__geoCalls.push({ type: "getCurrentPosition", options: options || null, at: Date.now() });
          setTimeout(() => success(fakePosition), 0);
        },
        watchPosition(success, _error, options) {
          window.__geoCalls.push({ type: "watchPosition", options: options || null, at: Date.now() });
          setTimeout(() => success(fakePosition), 0);
          return 42;
        },
        clearWatch() {},
      },
    });
  });

  const page = await context.newPage();
  await installMapLibreStubForSmoke(page);
  await suppressMapLibreForSmoke(page);
  await page.goto(`${baseURL}/map?lang=ja`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#map-explorer canvas[data-maplibre-smoke-stub='1']")).toBeVisible();
  await page.waitForFunction(() => Array.isArray(window.__geoCalls) && window.__geoCalls.some((call) => call.type === "getCurrentPosition"));
  const mapLocationState = await page.evaluate(() => ({
    calls: window.__geoCalls,
    center: window.__ikimonMapSmokeLastMap?.getCenter?.(),
    zoom: window.__ikimonMapSmokeLastMap?.getZoom?.(),
  }));
  expect(mapLocationState.calls.map((call) => call.type)).toContain("getCurrentPosition");
  expect(mapLocationState.center?.lng).toBeCloseTo(137.7261, 4);
  expect(mapLocationState.center?.lat).toBeCloseTo(34.7108, 4);
  expect(mapLocationState.zoom).toBeGreaterThanOrEqual(14);

  const recordPage = await context.newPage();
  await recordPage.goto(`${baseURL}/record?userId=staging-user&lang=ja`, { waitUntil: "domcontentloaded" });
  await recordPage.waitForTimeout(1200);
  expect(await recordPage.evaluate(() => window.__geoCalls)).toEqual([]);

  await context.close();
});
