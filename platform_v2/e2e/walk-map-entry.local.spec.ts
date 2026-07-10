import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  installMapLibreStubForSmoke,
  stagingContextOptions,
  suppressMapLibreForSmoke,
  type ViewportProfile,
} from "./support/staging.js";

test.describe.configure({ retries: 0, timeout: 60_000 });

const VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 920 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const REJECTED_PUBLIC_COPY_PATTERNS = [
  /\u9806\u756a\u3069\u304a\u308a/,
  /\u5916\u308c\u3066\u3082OK/,
  /\u8ca2\u732e/,
  /\u898b\u8fd4\u305b\u308b/,
];

async function newPage(browser: Browser, profile: ViewportProfile): Promise<Page> {
  const context = await browser.newContext(stagingContextOptions({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    locale: "ja-JP",
    serviceWorkers: "block",
  }));
  return context.newPage();
}

for (const profile of VIEWPORTS) {
  test(`map start panel leads to walk-map record entry (${profile.slug})`, async ({ browser }) => {
    const page = await newPage(browser, profile);
    try {
      await installMapLibreStubForSmoke(page);
      await suppressMapLibreForSmoke(page);

      const mapResponse = await page.goto("/ja/map", { waitUntil: "domcontentloaded" });
      expect(mapResponse?.status() ?? 0).toBeLessThan(400);
      await expect(page.locator("#map-explorer canvas[data-maplibre-smoke-stub='1']")).toBeVisible();

      const startPanel = page.getByTestId("map-start-panel");
      await expect(startPanel).toBeVisible();
      await expect(startPanel).toContainText("この地図でできること");
      await expect(startPanel).toContainText("みんなの写真");
      await expect(startPanel).toContainText("現地ガイド");
      await expect(startPanel).toContainText("散策ルート");
      await expect(startPanel).toContainText("記録する");

      await startPanel.getByRole("link", { name: /散策ルート/ }).click();
      await expect(page).toHaveURL(/\/ja\/walk-maps$/);
      await expect(page.getByRole("heading", { name: "公開範囲で歩ける散策ルート" })).toBeVisible();
      await expect(page.locator(".wm-card")).toHaveCount(4);
      await expect(page.locator(".wm-card").filter({ hasText: "麻機の水辺を歩くサンプル" })).toContainText("引用元 2件");
      const indexBody = await page.locator("body").innerText();
      for (const pattern of REJECTED_PUBLIC_COPY_PATTERNS) {
        expect(indexBody).not.toMatch(pattern);
      }

      await page.getByRole("link", { name: /麻機の水辺を歩くサンプル/ }).click();
      await expect(page).toHaveURL(/\/ja\/walk-maps\/jp-shizuoka-asahata-waterfront-sample-v0$/);
      await expect(page.getByRole("heading", { name: "麻機の水辺を歩くサンプル" })).toBeVisible();
      await expect(page.locator("body")).toContainText("引用元");
      await expect(page.locator("body")).toContainText("PDF本文や図版は転載していません");
      const detailBody = await page.locator("body").innerText();
      for (const pattern of REJECTED_PUBLIC_COPY_PATTERNS) {
        expect(detailBody).not.toMatch(pattern);
      }

      const recordEntry = page.getByRole("link", { name: "この場所で記録する" }).first();
      await expect(recordEntry).toHaveAttribute("href", /context=municipal_walk_map/);
      await expect(recordEntry).toHaveAttribute("href", /walkMapId=jp-shizuoka-asahata-waterfront-sample-v0/);
      await expect(recordEntry).toHaveAttribute("href", /stopId=asahata-water-edge/);
      await recordEntry.click();
      await expect(page).toHaveURL(/\/ja\/record\?/);
      await expect(page).toHaveURL(/context=municipal_walk_map/);
      await expect(page).toHaveURL(/walkMapId=jp-shizuoka-asahata-waterfront-sample-v0/);
      await expect(page).toHaveURL(/stopId=asahata-water-edge/);
      await expect(page).toHaveURL(/source=municipal_walk_map/);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    } finally {
      await page.context().close();
    }
  });
}
