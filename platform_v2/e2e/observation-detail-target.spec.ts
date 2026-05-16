import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

const defaultTargetPath =
  "/ja/observations/record-1778829649026?subject=occ%3Arecord-1778829649026%3A0";

function targetPath(): string {
  return process.env.OBSERVATION_DETAIL_TARGET_PATH?.trim() || defaultTargetPath;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectVideoMetaUsable(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const meta = document.querySelector<HTMLElement>(".obs-hero-video-meta");
    const label = document.querySelector<HTMLElement>(".obs-hero-video-meta-main strong");
    const metaRect = meta?.getBoundingClientRect();
    const labelRect = label?.getBoundingClientRect();
    return {
      hasVideoMeta: Boolean(meta),
      metaText: meta?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      metaHeight: metaRect?.height ?? 0,
      labelWidth: labelRect?.width ?? 0,
      labelHeight: labelRect?.height ?? 0,
    };
  });

  expect(metrics.hasVideoMeta, "target observation should expose video metadata").toBeTruthy();
  expect(metrics.metaText).toContain("動画");
  expect(metrics.labelWidth, "video label should not collapse into vertical text").toBeGreaterThan(20);
  expect(metrics.labelHeight, "video label should remain one compact line").toBeLessThan(28);
  expect(metrics.metaHeight, "video metadata row should stay compact on mobile").toBeLessThan(48);
}

test.describe("target observation detail local repro", () => {
  test("mobile video observation keeps evidence controls usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(targetPath(), { waitUntil: "domcontentloaded" });
    expect(response?.status(), "target observation status").toBeLessThan(500);

    await expect(page.locator("body")).toContainText("AIが見た動画フレーム");
    await expect(page.locator(".obs-hero-video-frame")).toBeVisible();
    expect(await page.locator(".obs-video-evidence-frame").count()).toBeGreaterThan(0);
    await expectVideoMetaUsable(page);
    await expectNoHorizontalOverflow(page);

    await page.screenshot({
      path: path.resolve("test-results", "observation-detail-target-mobile.png"),
      fullPage: false,
    });
  });
});
