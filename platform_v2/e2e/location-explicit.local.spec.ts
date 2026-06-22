import { expect, test } from "@playwright/test";

test("map and record do not request geolocation on initial render", async ({ browser }) => {
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
  await page.goto(`${baseURL}/map?lang=ja`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__geoCalls)).toEqual([]);

  const recordPage = await context.newPage();
  await recordPage.goto(`${baseURL}/record?userId=staging-user&lang=ja`, { waitUntil: "domcontentloaded" });
  await recordPage.waitForTimeout(1200);
  expect(await recordPage.evaluate(() => window.__geoCalls)).toEqual([]);

  await context.close();
});
