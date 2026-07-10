import { expect, test } from "@playwright/test";
import { installMapLibreStubForSmoke, suppressMapLibreForSmoke } from "./support/staging.js";

test.describe.configure({ retries: 0, timeout: 45_000 });

const REJECTED_PUBLIC_COPY_PATTERNS = [
  /\u9806\u756a\u901a\u308a/,
  /\u5916\u308c\u3066\u3082OK/,
  /\u8ca2\u732e/,
  /\u898b\u8fd4\u305b\u308b/,
];

test("map start panel opens walk-map source links and record entry", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: process.env.STAGING_BASE_URL ?? "http://127.0.0.1:4322",
    serviceWorkers: "block",
  });
  const mapPage = await context.newPage();
  await installMapLibreStubForSmoke(mapPage);
  await suppressMapLibreForSmoke(mapPage);

  const mapResponse = await mapPage.goto("/ja/map", { waitUntil: "domcontentloaded" });
  expect(mapResponse?.status() ?? 0).toBeLessThan(400);
  const startPanel = mapPage.getByTestId("map-start-panel");
  await expect(startPanel).toBeVisible();
  await expect(startPanel).toContainText("散策");
  const walkMapsLink = startPanel.locator('a[href="/ja/walk-maps"]');
  await expect(walkMapsLink).toHaveAttribute("href", "/ja/walk-maps");
  await mapPage.close();

  const page = await context.newPage();
  await page.goto("/ja/walk-maps", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/ja\/walk-maps$/);
  await expect(page.getByRole("heading", { name: "公開範囲で使う散策サンプル" })).toBeVisible();
  await expect(page.locator(".wm-card")).toHaveCount(3);
  await expect(page.locator(".wm-card").filter({ hasText: "麻機の水辺を歩くサンプル" })).toContainText("引用元 3件");

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

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await context.close();
});
