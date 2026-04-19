import { test, expect } from "@playwright/test";
import {
  DEFAULT_STAGING_MAP_PATH,
  MAP_VIEWPORTS,
  expectMaskedScreenshot,
  maybeCaptureQaScreenshot,
  newStagingContext,
  triggerPendingViewportSearch,
  waitForMapReady,
} from "./support/staging.js";

for (const profile of MAP_VIEWPORTS) {
  test(`map shell QA flow (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();
    const mapSection = page.locator(".me-section");
    const dynamicMasks = [
      page.locator("#map-explorer canvas"),
      page.locator("#me-results-list"),
      page.locator(".maplibregl-ctrl-attrib"),
      page.locator(".maplibregl-ctrl-logo"),
    ];

    await waitForMapReady(page, DEFAULT_STAGING_MAP_PATH);
    await maybeCaptureQaScreenshot(page, `${profile.slug}-initial.jpg`);
    await expectMaskedScreenshot(mapSection, `${profile.slug}-initial.png`, dynamicMasks);

    if (profile.isMobile) {
      await page.evaluate(() => {
        const firstRow = document.querySelector<HTMLButtonElement>(".me-result-row");
        firstRow?.click();
      });
      await expect(page.locator("#me-bottom-sheet.is-open")).toBeVisible();
      await maybeCaptureQaScreenshot(page, `${profile.slug}-selected.jpg`);
      await expectMaskedScreenshot(
        page.locator("#me-bottom-sheet"),
        `${profile.slug}-selected.png`,
        [
          page.locator(".me-bottom-photo"),
          page.locator("#me-site-brief-slot"),
        ],
      );
    } else {
      const firstRow = page.locator(".me-result-row").first();
      await firstRow.click();
      await expect(page.locator("#me-map-selection-card.is-visible")).toBeVisible();
      await maybeCaptureQaScreenshot(page, `${profile.slug}-selected.jpg`);
      await expectMaskedScreenshot(
        page.locator("#me-map-selection-card"),
        `${profile.slug}-selected.png`,
        [
          page.locator(".me-selected-photo"),
          page.locator("#me-selected-brief-slot"),
        ],
      );
    }

    await triggerPendingViewportSearch(page);
    await maybeCaptureQaScreenshot(page, `${profile.slug}-pending-search.jpg`);
    await expect(page.locator("#me-search-area-btn")).toContainText("この範囲で再検索");

    await page.locator(".me-filter-toggle").click();
    await expect(page.locator(".me-filter-drawer")).toHaveAttribute("open", "");
    await maybeCaptureQaScreenshot(page, `${profile.slug}-filters.jpg`);
    await expectMaskedScreenshot(
      mapSection,
      `${profile.slug}-filters.png`,
      dynamicMasks,
    );

    await context.close();
  });
}

test("map share state survives reload", async ({ browser }) => {
  const context = await newStagingContext(browser, MAP_VIEWPORTS[1]);
  const page = await context.newPage();
  await waitForMapReady(page);

  await page.getByRole("button", { name: "鳥類" }).click();
  await page.getByRole("tab", { name: "調査前進" }).click();
  await page.locator(".me-filter-toggle").click();
  await page.locator('input[name="me-basemap"][value="gsi"]').check({ force: true });
  await page.locator("#me-share-state").click();

  await expect.poll(() => new URL(page.url()).searchParams.get("taxon")).toBe("bird");
  await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("frontier");
  await expect.poll(() => new URL(page.url()).searchParams.get("bm")).toBe("gsi");

  const sharedUrl = page.url();
  const restoredPage = await context.newPage();
  await waitForMapReady(restoredPage, sharedUrl);
  await expect(restoredPage.locator('.me-taxon-chip.is-active[data-taxon-group="bird"]')).toBeVisible();
  await expect(restoredPage.locator('.me-tab.is-active[data-tab="frontier"]')).toBeVisible();
  await expect(restoredPage.locator('.me-basemap-opt.is-active input[value="gsi"]')).toBeChecked();

  await context.close();
});
