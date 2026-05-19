import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const viewports = [
  { name: "desktop", width: 1440, height: 1100, path: "/dev/place-snapshot-lab?case=renri-production-export&variant=story&source=fixture" },
  { name: "mobile", width: 390, height: 844, path: "/dev/place-snapshot-lab?case=renri-production-export&variant=story&source=fixture" },
];

async function expectScreenshotHealth(page: Page, viewport: typeof viewports[number]) {
  const screenshot = await page.screenshot({ fullPage: false, animations: "disabled" });
  const image = sharp(screenshot);
  const metadata = await image.metadata();
  const stats = await image.stats();
  const maxChannelDeviation = Math.max(...stats.channels.slice(0, 3).map((channel) => channel.stdev));

  expect(metadata.width, `${viewport.name} screenshot width`).toBe(viewport.width);
  expect(metadata.height, `${viewport.name} screenshot height`).toBe(viewport.height);
  expect(maxChannelDeviation, `${viewport.name} screenshot is not blank`).toBeGreaterThan(8);
}

for (const viewport of viewports) {
  test(`place snapshot lab renders ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(viewport.path);

    await expect(page.getByRole("heading", { name: "Place Snapshot Lab" })).toBeVisible();
    await expect(page.getByRole("link", { name: "story" })).toHaveClass(/is-active/);
    await expect(page.getByRole("link", { name: "current" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /愛管株式会社|連理の木の下で/ }).first()).toBeVisible();
    await expect(page.getByText("コメツブツメクサ").first()).toBeVisible();

    await expectScreenshotHealth(page, viewport);
  });
}
