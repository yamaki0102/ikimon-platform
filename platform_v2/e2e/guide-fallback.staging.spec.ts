import { test, expect } from "@playwright/test";
import { newStagingContext } from "./support/staging.js";

test("guide shows photo fallback when camera permission is unavailable", async ({ browser }) => {
  const context = await newStagingContext(browser, {
    slug: "mobile-390",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await page.addInitScript(() => {
      const unavailable = async () => {
        throw new DOMException("camera unavailable", "NotAllowedError");
      };
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          ...(navigator.mediaDevices ?? {}),
          getUserMedia: unavailable,
        },
      });
    });

    await page.goto("/guide?lang=ja", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#guide-photo-fallback")).toBeHidden();

    await page.locator("#guide-start-btn").click();

    await expect(page.locator("#guide-permission-msg")).toBeVisible();
    await expect(page.locator("#guide-photo-fallback")).toBeVisible();
    await expect(page.locator("#guide-photo-btn")).toContainText("投稿用写真を選ぶ");
  } finally {
    await context.close();
  }
});
