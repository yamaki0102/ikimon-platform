import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
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

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe.serial("observation AI grounding visual QA", () => {
  let api: APIRequestContext;
  let fixturePrefix = "";
  let writeKey = "";
  let fixture: SeededRegressionFixtureBundle;
  let cleanedUp = false;

  test.beforeAll(async ({ playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    api = await createStagingApiContext(playwright);
    fixturePrefix = uniqueFixturePrefix("observation-grounding");
    fixture = await seedRegressionFixtures(api, writeKey, fixturePrefix);
  });

  test.afterAll(async () => {
    if (!cleanedUp) {
      await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
    }
    await api.dispose();
  });

  for (const profile of VIEWPORTS) {
    test(`grounding buttons connect to image frames on ${profile.slug}`, async ({ browser }, testInfo) => {
      const context = await newStagingContext(browser, profile);
      const page = await context.newPage();
      try {
        const href = `/observations/${encodeURIComponent(fixture.scene.visitId)}?subject=${encodeURIComponent(fixture.scene.occurrenceId)}&lang=ja`;
        await page.goto(href, { waitUntil: "domcontentloaded" });

        await expect(page.locator("body")).toContainText("ヒメイワダレソウ");
        await expect(page.locator(".obs-ai-grounding").first()).toContainText("AIが主に見たところ");
        await expect(page.locator(".obs-ai-grounding-shot", { hasText: "画像1" }).first()).toBeVisible();
        await expect(page.locator(".obs-annotation-target.is-current").first()).toBeVisible();

        await page.locator("[data-ai-target]", { hasText: "セイヨウミツバチ" }).first().click();
        const activePanel = page.locator("[data-ai-panel]:not([hidden])").first();
        await expect(activePanel).toContainText("セイヨウミツバチ");
        const candidateGrounding = activePanel.locator(".obs-ai-grounding-shot").first();
        await expect(candidateGrounding).toContainText("画像1");
        const candidateId = await candidateGrounding.getAttribute("data-ai-grounding-candidate");
        expect(candidateId, "grounding button should carry a candidate id").toBeTruthy();
        await candidateGrounding.click();

        const connectedCandidate = page.locator(`.obs-annotation-target.is-candidate[data-annotation-candidate-id="${candidateId}"]`).first();
        await expect(connectedCandidate).toBeVisible();
        await expect(page.locator(".obs-hero-thumb.is-active").first()).toHaveAttribute("data-obs-thumb-asset-id", await candidateGrounding.getAttribute("data-ai-grounding-asset") ?? "");
        await expectNoHorizontalOverflow(page);

        await page.screenshot({
          path: testInfo.outputPath(`observation-grounding-${profile.slug}.png`),
          fullPage: true,
          animations: "disabled",
        });
      } finally {
        await context.close();
      }
    });
  }

  test("cleanup route removes seeded grounding fixture", async () => {
    await cleanupFixtures(api, writeKey, fixturePrefix);
    cleanedUp = true;
  });
});
