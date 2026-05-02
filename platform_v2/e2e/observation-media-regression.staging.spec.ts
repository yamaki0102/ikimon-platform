import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  cleanupFixtures,
  createStagingApiContext,
  newStagingContext,
  requireEnv,
  seedRegressionFixtures,
  type SeededRegressionFixtureBundle,
  uniqueFixturePrefix,
  type ViewportProfile,
} from "./support/staging.js";

const VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 900 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

function expectNear(actual: number, expected: number, tolerance = 1.25): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

test.describe.serial("observation media region alignment", () => {
  let api: APIRequestContext;
  let fixturePrefix = "";
  let writeKey = "";
  let fixture: SeededRegressionFixtureBundle;
  let cleanedUp = false;

  test.beforeAll(async ({ playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    api = await createStagingApiContext(playwright);
    fixturePrefix = uniqueFixturePrefix("observation-media");
    fixture = await seedRegressionFixtures(api, writeKey, fixturePrefix);
  });

  test.afterAll(async () => {
    if (!cleanedUp) {
      await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
    }
    await api.dispose();
  });

  for (const profile of VIEWPORTS) {
    test(`region layer matches displayed vertical image on ${profile.slug}`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile);
      const page = await context.newPage();
      await page.goto(
        `/observations/${encodeURIComponent(fixture.manual.visitId)}?subject=${encodeURIComponent(fixture.manual.occurrenceId)}&lang=ja`,
        { waitUntil: "domcontentloaded" },
      );

      const frame = page.locator("[data-obs-image-frame]").first();
      const image = page.locator("[data-obs-preview-img]").first();
      const layer = page.locator("[data-obs-preview-regions]").first();
      const boxes = page.locator(".obs-region-box");

      await expect(frame).toBeVisible();
      await expect(image).toBeVisible();
      await expect(layer).toBeVisible();
      await expect.poll(async () => image.evaluate((el) => (el as HTMLImageElement).complete)).toBeTruthy();
      await expect(boxes).toHaveCount(1);
      await expect(page.locator("body")).toContainText("visible-region-fixture");
      await expect(page.locator("body")).not.toContainText("low-confidence-hidden-fixture");

      const [frameBox, imageBox, layerBox, regionBox] = await Promise.all([
        frame.boundingBox(),
        image.boundingBox(),
        layer.boundingBox(),
        boxes.first().boundingBox(),
      ]);

      expect(frameBox).toBeTruthy();
      expect(imageBox).toBeTruthy();
      expect(layerBox).toBeTruthy();
      expect(regionBox).toBeTruthy();
      if (!frameBox || !imageBox || !layerBox || !regionBox) throw new Error("media geometry unavailable");

      expect(imageBox.height / imageBox.width).toBeGreaterThan(1.8);
      expectNear(frameBox.x, imageBox.x);
      expectNear(frameBox.y, imageBox.y);
      expectNear(frameBox.width, imageBox.width);
      expectNear(frameBox.height, imageBox.height);
      expectNear(layerBox.x, imageBox.x);
      expectNear(layerBox.y, imageBox.y);
      expectNear(layerBox.width, imageBox.width);
      expectNear(layerBox.height, imageBox.height);

      expect(regionBox.x).toBeGreaterThanOrEqual(layerBox.x - 1);
      expect(regionBox.y).toBeGreaterThanOrEqual(layerBox.y - 1);
      expect(regionBox.x + regionBox.width).toBeLessThanOrEqual(layerBox.x + layerBox.width + 1);
      expect(regionBox.y + regionBox.height).toBeLessThanOrEqual(layerBox.y + layerBox.height + 1);

      await context.close();
    });
  }

  test("cleanup route removes seeded media fixture", async () => {
    await cleanupFixtures(api, writeKey, fixturePrefix);
    cleanedUp = true;
  });
});
