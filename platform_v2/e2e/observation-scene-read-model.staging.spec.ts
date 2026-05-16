import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  cleanupFixtures,
  createStagingApiContext,
  maybeCaptureQaScreenshot,
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

async function stabilizeVisualDiff(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      video { visibility: hidden !important; }
    `,
  });
}

async function visibleRecordTextInFirstViewport(page: Page): Promise<string> {
  return page.evaluate(() => {
    const nodes = [...document.body.querySelectorAll("h1,.obs-record-insight,.obs-ai-readout,.obs-visible-record-card,.obs-media-ledger")];
    return nodes
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      })
      .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim())
      .join(" | ");
  });
}

async function expectWithinFirstViewport(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} should have a layout box`).not.toBeNull();
  if (!box) return;
  const height = await page.evaluate(() => window.innerHeight);
  expect(box.y, `${selector} should start in the first viewport`).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height, `${selector} should fit in the first viewport`).toBeLessThanOrEqual(height + 8);
}

test.describe.serial("observation scene read model visual QA", () => {
  let api: APIRequestContext;
  let fixturePrefix = "";
  let writeKey = "";
  let fixture: SeededRegressionFixtureBundle;
  let cleanedUp = false;

  test.beforeAll(async ({ playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    api = await createStagingApiContext(playwright);
    fixturePrefix = uniqueFixturePrefix("observation-scene");
    fixture = await seedRegressionFixtures(api, writeKey, fixturePrefix);
  });

  test.afterAll(async () => {
    if (!cleanedUp) {
      await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
    }
    await api.dispose();
  });

  for (const profile of VIEWPORTS) {
    test(`scene first viewport exposes multiple visible records on ${profile.slug}`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile);
      const page = await context.newPage();
      try {
        const href = `/observations/${encodeURIComponent(fixture.scene.visitId)}?subject=${encodeURIComponent(fixture.scene.occurrenceId)}&lang=ja`;
        await page.goto(href, { waitUntil: "domcontentloaded" });

        await expect(page.locator("h1")).toContainText("白い花の群落");
        await expect(page.locator("body")).toContainText("この写真に写っているもの");
        await expect(page.locator(".obs-record-insight").first()).toContainText(/植物|草地|名前だけでなく/);
        await expect(page.locator("body")).toContainText("ヒメイワダレソウ");
        await expect(page.locator("body")).toContainText("セイヨウミツバチ");
        await expect(page.locator("body")).toContainText("イネ科の一種");
        await expect(page.locator("body")).toContainText("参考候補");
        await expect(page.locator("body")).not.toContainText("AI 主役");
        await expect(page.locator("body")).not.toContainText("AI 主対象");
        await expect(page.locator("body")).not.toContainText("ヒメイワダレソウ画像全体に広がる群落");

        const names = await page.locator(".obs-visible-record-card .obs-focus-card-name").allInnerTexts();
        expect(names.slice(0, 3)).toEqual(["ヒメイワダレソウ", "セイヨウミツバチ", "イネ科の一種"]);
        const firstViewportText = await visibleRecordTextInFirstViewport(page);
        expect(firstViewportText).toContain("白い花の群落");
        expect(firstViewportText).toMatch(/草地|植物|名前だけでなく|写真/);
        if (profile.isMobile) {
          await expectWithinFirstViewport(page, ".obs-reading-media");
          await expectWithinFirstViewport(page, ".obs-record-brief");
        }
        expect(firstViewportText).toContain("訪花中のハチ");
        await expect(page.locator(".obs-visible-record-card").filter({ hasText: "セイヨウミツバチ" })).toContainText("花に来た虫");
        await expect(page.locator(".obs-visible-record-card").filter({ hasText: "イネ科の一種" })).toContainText("草地と裸地");
        await expect(page.locator(".obs-visible-record-card").filter({ hasText: "小さな黒い点" })).toContainText("仮説");
        await expect(page.locator(".obs-visible-record-card").filter({ hasText: "セイヨウミツバチ" })).not.toContainText("AIが写真から分けた観測レコード");
        await expectNoHorizontalOverflow(page);

        await maybeCaptureQaScreenshot(page, `observation-scene-${profile.slug}.jpg`);
        if (process.env.OBSERVATION_SCENE_ASSERT_SCREENSHOTS === "1") {
          await stabilizeVisualDiff(page);
          await expect(page.locator(".obs-reading-hero")).toHaveScreenshot(`observation-scene-hero-${profile.slug}.png`, {
            animations: "disabled",
            maxDiffPixelRatio: 0.03,
          });
        }
      } finally {
        await context.close();
      }
    });
  }

  test("cleanup route removes seeded scene fixture", async () => {
    await cleanupFixtures(api, writeKey, fixturePrefix);
    cleanedUp = true;
  });
});
