import { test, expect, type Page, type Route } from "@playwright/test";

const STAGING_BASE_URL = process.env.STAGING_BASE_URL ?? "https://staging.zukan.earth";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const fixtureImage = {
  name: "zukan-source-choice.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAgCXa7QJAAAAAElFTkSuQmCC",
    "base64",
  ),
};

async function installPermissionCounters(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = { cameraCalls: 0, locationCalls: 0 };
    Object.defineProperty(window, "__zukanSourceChoicePermissions", {
      configurable: true,
      value: state,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          state.cameraCalls += 1;
          const canvas = document.createElement("canvas");
          canvas.width = 1280;
          canvas.height = 720;
          return canvas.captureStream(30);
        },
      },
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          state.locationCalls += 1;
          success({
            coords: {
              latitude: 34.7108,
              longitude: 137.7261,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
        },
        watchPosition: () => 1,
        clearWatch: () => undefined,
      },
    });
  });
}

async function permissionCalls(page: Page): Promise<{ cameraCalls: number; locationCalls: number }> {
  return page.evaluate(() => {
    const state = (window as unknown as {
      __zukanSourceChoicePermissions?: { cameraCalls: number; locationCalls: number };
    }).__zukanSourceChoicePermissions;
    return {
      cameraCalls: Number(state?.cameraCalls ?? 0),
      locationCalls: Number(state?.locationCalls ?? 0),
    };
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
  const trigger = page.locator('[data-global-record-trigger="photo"]:visible').first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator("[data-global-record-camera-sheet]")).toBeVisible();
}

test.describe("ZUKAN photo source choice staging contract", () => {
  test("chooses a source before requesting camera or location permission", async ({ page }) => {
    await installPermissionCounters(page);
    await page.route("**/*", blockWrites);
    await openPhotoSourceChoice(page);

    await expect.poll(() => permissionCalls(page)).toEqual({ cameraCalls: 0, locationCalls: 0 });
    await expect(page.locator("[data-global-record-os-camera]")).toContainText("標準カメラ");
    await expect(page.locator("[data-global-record-camera-start]")).toContainText("接写カメラ");
    await expect(page.locator("[data-global-record-camera-sheet] [data-global-record-gallery-select]").first()).toBeVisible();
    await expect(page.locator('[data-global-record-input="photo"]')).toHaveAttribute("capture", "environment");

    await page.locator("[data-global-record-camera-start]").click();
    await expect.poll(() => permissionCalls(page)).toEqual({ cameraCalls: 1, locationCalls: 0 });
  });

  for (const source of ["photo", "gallery"] as const) {
    test(`${source} enters the existing local preview path without a staging write`, async ({ page }) => {
      await installPermissionCounters(page);
      await page.route("**/*", blockWrites);
      await openPhotoSourceChoice(page);

      const input = page.locator(`[data-global-record-input="${source}"]`);
      await input.setInputFiles(fixtureImage);

      const sheet = page.locator("[data-global-record-camera-sheet]");
      await expect(sheet).toHaveAttribute("data-active-kind", "photo");
      await expect(sheet).toHaveAttribute("data-photo-draft", "true");
      await expect(page.locator("[data-global-record-photo-tray]")).toBeVisible();
      await expect.poll(() => permissionCalls(page)).toEqual({ cameraCalls: 0, locationCalls: 0 });
    });
  }
});
