import { expect, test, type Page } from "@playwright/test";
import { newStagingContext, suppressMapLibreForSmoke, type ViewportProfile } from "./support/staging.js";

const VIEWPORTS: ViewportProfile[] = [
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { slug: "desktop-1440", viewport: { width: 1440, height: 1000 } },
];

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

for (const profile of VIEWPORTS) {
  test(`Iwata open-data ZUKAN renders official snapshot (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();
    try {
      await suppressMapLibreForSmoke(page);
      const response = await page.goto("/iwata", { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveText("いわた地域図鑑");
      await expect(page.locator(".iwata-stats")).toContainText("59");
      await expect(page.locator(".iwata-card")).toHaveCount(59);
      await expect(page.locator("body")).toContainText("旧見付学校");
      await expect(page.locator("body")).toContainText("磐田市オープンデータの利用条件");

      await page.locator('button[data-filter="cultural"]').click();
      await expect(page.locator(".iwata-card")).toHaveCount(12);
      await expect(page.locator("#iwata-results-title")).toHaveText("公開データ 12件");

      await page.locator('button[data-filter="all"]').click();
      await page.locator("#iwata-search").fill("見付");
      await expect(page.locator(".iwata-card").first()).toBeVisible();
      await expect(page.locator("#iwata-results-title")).not.toHaveText("公開データ 59件");
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/iwata-open-data-${profile.slug}.png`, fullPage: true });
    } finally {
      await context.close();
    }
  });
}

test("Iwata open-data API preserves provenance and filtering", async ({ request }) => {
  const response = await request.get("/api/iwata/open-data?dataset=park&limit=3");
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.schema).toBe("zukan.iwata-open-data/v1");
  expect(payload.resultCount).toBe(3);
  expect(payload.items.every((item: { dataset: string }) => item.dataset === "park")).toBeTruthy();
  expect(payload.items.every((item: { sourceUrl: string }) => item.sourceUrl.startsWith("https://"))).toBeTruthy();
});
