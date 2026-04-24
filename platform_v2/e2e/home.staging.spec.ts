import { test, expect, type Page } from "@playwright/test";
import { newStagingContext, type ViewportProfile } from "./support/staging.js";

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

for (const profile of HOME_VIEWPORTS) {
  test(`home hero stays focused and stable (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();

    try {
      await page.goto("/?lang=ja", { waitUntil: "networkidle" });
      await expect(page.locator("#landing-hero-heading")).toContainText("いつもの散歩");
      await expect(page.locator(".landing-hero-action.is-primary")).toBeVisible();
      await expect(page.locator(".landing-hero-action.is-secondary")).toBeVisible();
      await expect(page.locator(".landing-hero-live")).toBeVisible();
      await expect(page.locator(".landing-hero-timeline")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}
