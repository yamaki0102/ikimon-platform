import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const viewports = [
  { name: "desktop", width: 1440, height: 1200 },
  { name: "mobile", width: 390, height: 844 },
];

async function expectViewportScreenshotHealth(page: Page, viewport: typeof viewports[number]) {
  const screenshot = await page.screenshot({
    fullPage: false,
    animations: "disabled",
  });
  const image = sharp(screenshot);
  const metadata = await image.metadata();
  const stats = await image.stats();
  const maxChannelDeviation = Math.max(...stats.channels.slice(0, 3).map((channel) => channel.stdev));

  expect(metadata.width, `${viewport.name} viewport screenshot width`).toBe(viewport.width);
  expect(metadata.height, `${viewport.name} viewport screenshot height`).toBe(viewport.height);
  expect(maxChannelDeviation, `${viewport.name} viewport screenshot is not blank`).toBeGreaterThan(8);
}

test.describe("landing top visual regression", () => {
  for (const viewport of viewports) {
    test(`${viewport.name} landing top matches approved visual`, async ({ browser }) => {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
          }
          .prototype-live-pill time { visibility: hidden !important; }
        `,
      });

      await expect(page.locator(".prototype-hero")).toBeVisible();
      await expect(page.locator(".prototype-flow-grid")).toBeVisible();
      await expect(page.locator(".prototype-map-section")).toBeVisible();
      await expect(page.locator(".site-footer")).toBeVisible();

      const metrics = await page.evaluate(() => {
        const flowCard = document.querySelector(".prototype-flow-card");
        const mapBoard = document.querySelector(".prototype-map-board");
        const flowCardStyle = flowCard ? getComputedStyle(flowCard) : null;
        const mapBoardRect = mapBoard?.getBoundingClientRect();
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          hasSampleText: document.documentElement.outerHTML.includes("sample_"),
          flowCardColumns: flowCardStyle?.gridTemplateColumns ?? "",
          mapBoardHeight: Math.round(mapBoardRect?.height ?? 0),
          footerHeroCount: document.querySelectorAll(".footer-hero").length,
          footerDirectoryCount: document.querySelectorAll(".footer-directory").length,
        };
      });

      expect(metrics.scrollWidth, "no horizontal scroll").toBe(metrics.clientWidth);
      expect(metrics.hasSampleText, "no sample image fallback").toBe(false);
      expect(metrics.footerHeroCount, "footer brand panel shell exists").toBe(1);
      expect(metrics.footerDirectoryCount, "footer directory exists").toBe(1);

      if (viewport.name === "mobile") {
        expect(metrics.flowCardColumns, "mobile flow timeline columns").toContain("56px");
        expect(metrics.mapBoardHeight, "mobile map board matches prototype compact height").toBeLessThanOrEqual(460);
      } else {
        expect(metrics.flowCardColumns, "desktop flow cards stay card-based").not.toContain("56px");
        expect(metrics.mapBoardHeight, "desktop map board keeps immersive height").toBeGreaterThanOrEqual(500);
      }

      if (process.env.VISUAL_QA_ASSERT_SCREENSHOTS === "1") {
        await expectViewportScreenshotHealth(page, viewport);
      }

      await page.close();
    });
  }
});
