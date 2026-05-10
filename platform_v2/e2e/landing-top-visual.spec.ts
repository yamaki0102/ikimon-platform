import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { suppressMapLibreForSmoke } from "./support/staging.js";

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

      await suppressMapLibreForSmoke(page);
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

      await expect(page.locator(".prototype-topa")).toBeVisible();
      await expect(page.locator("#landing-hero-heading")).toContainText("見つける、確かめる、地図で見る。");
      await expect(page.locator(".prototype-topa-actions")).toBeVisible();
      await expect(page.locator(".prototype-topa-shelves")).toBeVisible();
      await expect(page.locator("#sound-intelligence")).toBeVisible();
      await expect(page.locator(".prototype-sound-flow article")).toHaveCount(4);
      await expect(page.locator("#topa-local-map")).toBeVisible();
      await expect(page.locator(".prototype-topa-map-board")).toBeVisible();

      const metrics = await page.evaluate(() => {
        const countTracks = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
        const mapBoard = document.querySelector(".prototype-topa-map-board");
        const soundSection = document.querySelector("#sound-intelligence");
        const soundFlow = document.querySelector(".prototype-sound-flow");
        const soundSectionStyle = soundSection ? getComputedStyle(soundSection) : null;
        const soundFlowStyle = soundFlow ? getComputedStyle(soundFlow) : null;
        const mapBoardRect = mapBoard?.getBoundingClientRect();
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          hasSampleText: document.documentElement.outerHTML.includes("sample_"),
          soundSectionTrackCount: countTracks(soundSectionStyle?.gridTemplateColumns ?? ""),
          soundFlowTrackCount: countTracks(soundFlowStyle?.gridTemplateColumns ?? ""),
          soundActionCount: document.querySelectorAll(".prototype-sound-actions a").length,
          mapBoardHeight: Math.round(mapBoardRect?.height ?? 0),
        };
      });

      expect(metrics.scrollWidth, "no horizontal scroll").toBe(metrics.clientWidth);
      expect(metrics.hasSampleText, "no sample image fallback").toBe(false);
      expect(metrics.soundActionCount, "sound section keeps the three route choices").toBe(3);

      if (viewport.name === "mobile") {
        expect(metrics.soundSectionTrackCount, "mobile sound section stacks").toBe(1);
        expect(metrics.soundFlowTrackCount, "mobile sound cards stack").toBe(1);
        expect(metrics.mapBoardHeight, "mobile map board matches prototype compact height").toBeLessThanOrEqual(460);
      } else {
        expect(metrics.soundSectionTrackCount, "desktop sound section keeps copy and cards side by side").toBeGreaterThanOrEqual(2);
        expect(metrics.soundFlowTrackCount, "desktop sound cards stay two-column").toBeGreaterThanOrEqual(2);
        expect(metrics.mapBoardHeight, "desktop map board keeps local preview height").toBeGreaterThanOrEqual(360);
      }

      if (process.env.VISUAL_QA_ASSERT_SCREENSHOTS === "1") {
        await expectViewportScreenshotHealth(page, viewport);
      }

      await page.close();
    });
  }
});
