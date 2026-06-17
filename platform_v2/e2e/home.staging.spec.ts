import { test, expect, type Page } from "@playwright/test";
import {
  newStagingContext,
  type ViewportProfile,
} from "./support/staging.js";

const HOME_VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1536", viewport: { width: 1536, height: 900 } },
  { slug: "desktop-1280", viewport: { width: 1280, height: 800 } },
  { slug: "tablet-768", viewport: { width: 768, height: 900 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function waitForMapHomeReady(page: Page): Promise<void> {
  await page.goto("/?lang=ja&bm=esri&lng=137.8589&lat=34.7219&z=11", { waitUntil: "domcontentloaded" });
  await page.locator("#map-explorer").waitFor({ state: "visible" });
  await page.locator("#map-explorer canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => {
    return document.querySelectorAll(".me-result-row").length > 0 || document.querySelectorAll(".me-results-empty").length > 0;
  }, undefined, { timeout: 30_000 });
}

async function visibleBodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

for (const profile of HOME_VIEWPORTS) {
  test(`root map home stays readable and quiet (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();

    try {
      await waitForMapHomeReady(page);
      await expect(page.locator(".me-section")).toBeVisible();
      await expect(page.locator(".me-map-wrap")).toBeVisible();
      await expect(page.locator("#map-explorer")).toHaveAttribute("data-results-pending", "0", { timeout: 30_000 });
      await expect(page.locator(".me-enjoy-strip")).toBeHidden();
      await expect(page.locator("#me-visited-panel")).toHaveCount(0);
      await expect(page.locator("[data-api-my-places]")).toHaveCount(0);
      await expect(page.locator(".me-filter-toggle")).toBeVisible();
      const visibleText = await visibleBodyText(page);
      expect(visibleText).not.toContain("ikimon - 皆で作る地域図鑑");
      expect(visibleText).not.toContain("Cloudflare移行中");
      expect(visibleText).not.toContain("unidentified");
      expect(visibleText).not.toContain("行った場所へ");
      expect(visibleText).not.toContain("よく行く");
      expect(visibleText).not.toContain("季節で再訪");
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}
