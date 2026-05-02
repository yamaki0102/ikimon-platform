import { expect, test } from "@playwright/test";

async function triggerSyntheticInstallPrompt(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string; platform: string }>;
    };
    event.prompt = () => Promise.resolve();
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(event);
  });
}

test.describe("app-first mobile shell", () => {
  test("Android width shows install prompt and app runtime hooks", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/en/", { waitUntil: "domcontentloaded" });
    await triggerSyntheticInstallPrompt(page);

    await expect(page.locator("[data-app-install-prompt]")).toBeVisible();
    await expect(page.locator("[data-app-install-action]")).toBeVisible();
    await expect(page.locator("link[rel='manifest']")).toHaveAttribute("href", "/manifest.webmanifest?lang=en");
    await expect.poll(() => page.evaluate(() => typeof (window as any).ikimonAppOutbox?.enqueue)).toBe("function");
  });

  test("iPhone width keeps the install prompt inside the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ja/", { waitUntil: "domcontentloaded" });
    await triggerSyntheticInstallPrompt(page);

    const prompt = page.locator("[data-app-install-prompt]");
    await expect(prompt).toBeVisible();
    const box = await prompt.boundingBox();
    expect(box).toBeTruthy();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
  });

  test("service worker returns the offline app fallback for uncached field routes", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "service worker offline fallback is verified in Chromium");

    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/en/", { waitUntil: "networkidle" });
    await page.evaluate(async () => navigator.serviceWorker.ready);
    const hasController = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    if (!hasController) {
      await page.reload({ waitUntil: "networkidle" });
      await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    }

    await context.setOffline(true);
    await page.goto("/en/map", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
    await expect(page.locator('a[href="/en/guide"]')).toBeVisible();
    await expect(page.locator('a[href="/en/record"]')).toBeVisible();
    await expect(page.locator('a[href="/en/map"]')).toBeVisible();
    await context.setOffline(false);
  });

  test("app outbox debug page shows queued local items", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/ja/", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await (window as any).ikimonAppOutbox.enqueue({
        id: "guide:e2e-debug",
        source: "guide",
        kind: "scene",
        status: "queued",
        route: "/ja/guide",
        payloadMeta: { sessionId: "e2e-debug" },
      });
    });

    await page.goto("/ja/debug/app-outbox", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-outbox-debug]")).toBeVisible();
    await expect(page.locator("[data-outbox-summary]")).toContainText("Total");
    await expect(page.locator("[data-outbox-list]")).toContainText("guide:e2e-debug");
    await expect(page.locator("[data-outbox-list]")).toContainText("未同期");
  });
});
