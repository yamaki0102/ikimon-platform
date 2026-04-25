import { test, expect } from "@playwright/test";

const pages = [
  { path: "/", marker: /ikimon/i },
  { path: "/explore", marker: /次に歩く場所を探す|今日の散歩先を探す|Explore/i },
  { path: "/learn", marker: /ikimon|Learn/i },
  { path: "/contact", marker: /送信|Contact/i },
];

test.describe("production candidate smoke", () => {
  for (const pageSpec of pages) {
    test(`${pageSpec.path} renders`, async ({ page }) => {
      const response = await page.goto(pageSpec.path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${pageSpec.path} status`).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).toContainText(pageSpec.marker);
    });
  }

  test("/map renders map shell", async ({ page }) => {
    const response = await page.goto("/map", { waitUntil: "domcontentloaded" });
    expect(response?.status(), "/map status").toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("#map-explorer")).toBeVisible();
  });
});
