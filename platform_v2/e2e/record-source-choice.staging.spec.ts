import { test, expect, type Page, type Route } from "@playwright/test";

const STAGING_BASE_URL = process.env.STAGING_BASE_URL ?? "https://staging.ikimon.life";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const fixtureImage = {
  name: "zukan-source-choice.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAgCXa7QJAAAAAElFTkSuQmCC",
    "base64",
  ),
};

async function installCameraCounter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { calls: 0 };
    Object.defineProperty(window, "__zukanSourceChoiceCamera", {
      configurable: true,
      value: state,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          state.calls += 1;
          const canvas = document.createElement("canvas");
          canvas.width = 1280;
          canvas.height = 720;
          const stream = canvas.captureStream(30);
          return stream;
        },
      },
    });
  });
}

async function cameraCalls(page: Page): Promise<number> {
  return page.evaluate(() => {
    const state = (window as unknown as { __zukanSourceChoiceCamera?: { calls: number } }).__zukanSourceChoiceCamera;
    return Number(state?.calls ?? 0);
  });
}

async function blockWrites(route: Route): Promise<void> {
  if (SAFE_METHODS.has(route.request().method().toUpperCase())) {
    await route.continue();
    return;
  }
  await route.abort("blockedbyclient");
}

async function openPhotoSourceChoice(page: Page): Promise<void> {
  await page.goto(new URL("/?lang=ja", STAGING_BASE_URL).toString(), { waitUntil: "domcontentloaded" });
  const trigger = page.locator('[data-global-record-trigger="photo"]');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator("[data-global-record-camera-sheet]")).toBeVisible();
}

test.describe("ZUKAN photo source choice staging contract", () => {
  test("chooses a source before requesting Web-camera permission", async ({ page }) => {
    await installCameraCounter(page);
    await page.route("**/*", blockWrites);
    await openPhotoSourceChoice(page);

    await expect.poll(() => cameraCalls(page)).toBe(0);
    await expect(page.locator("[data-global-record-os-camera]")).toContainText("標準カメラ");
    await expect(page.locator("[data-global-record-camera-start]")).toContainText("接写カメラ");
    await expect(page.locator("[data-global-record-gallery-select]").first()).toBeVisible();
    await expect(page.locator('[data-global-record-input="photo"]')).toHaveAttribute("capture", "environment");

    await page.locator("[data-global-record-camera-start]").click();
    await expect.poll(() => cameraCalls(page)).toBe(1);
  });

  for (const source of ["photo", "gallery"] as const) {
    test(`${source} enters the existing local preview path without a staging write`, async ({ page }) => {
      await installCameraCounter(page);
      await page.route("**/*", blockWrites);
      await openPhotoSourceChoice(page);

      const input = page.locator(`[data-global-record-input="${source}"]`);
      await input.setInputFiles(fixtureImage);

      const sheet = page.locator("[data-global-record-camera-sheet]");
      await expect(sheet).toHaveAttribute("data-active-kind", "photo");
      await expect(sheet).toHaveAttribute("data-photo-draft", "true");
      await expect(page.locator("[data-global-record-photo-tray]")).toBeVisible();
      await expect.poll(() => cameraCalls(page)).toBe(0);
    });
  }
});
