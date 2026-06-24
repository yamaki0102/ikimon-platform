import { expect, test } from "@playwright/test";
import { installMapLibreStubForSmoke, suppressMapLibreForSmoke } from "./support/staging.js";

test("map first view uses top tabs instead of a floating start panel", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: process.env.STAGING_BASE_URL ?? "http://127.0.0.1:4322",
    serviceWorkers: "block",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await installMapLibreStubForSmoke(page);
  await suppressMapLibreForSmoke(page);

  await page.goto("/ja/map", { waitUntil: "domcontentloaded" });
  const startPanel = page.getByTestId("map-start-panel");
  await expect(startPanel).toBeHidden();
  await expect(page.getByRole("tab", { name: "写真" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "季節" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "ガイド" })).toBeVisible();
  await expect(page.getByRole("link", { name: "散策" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "未確認" })).toBeVisible();

  const legend = page.locator("#me-legend");
  await expect(legend).toBeVisible();
  await expect(legend).toHaveClass(/is-collapsed/);
  const legendBox = await legend.boundingBox();
  expect(legendBox?.width).toBeLessThanOrEqual(50);
  expect(legendBox?.height).toBeLessThanOrEqual(48);

  const emptyInvite = page.locator("#me-empty-invite");
  await expect(emptyInvite).toBeVisible();
  await expect(emptyInvite).not.toContainText("近くを探索中");
  await expect(emptyInvite).not.toContainText("少し広げると");
  const emptyBox = await emptyInvite.boundingBox();
  expect(emptyBox?.width).toBeLessThanOrEqual(180);
  expect(emptyBox?.height).toBeLessThanOrEqual(58);
  await expect(page.locator("#me-map-status")).toBeHidden();

  await page.screenshot({
    path: "E:/Projects/_agent_scratch/yamaki0102-ikimon-platform/map-walkmaps-integration-prab-20260624-compact-ui/map-compact-start.png",
    fullPage: false,
  });
  await expect(page.getByTestId("map-purpose-hint")).toBeHidden();
  await context.close();
});
