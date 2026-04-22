import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  DEFAULT_STAGING_MAP_PATH,
  MAP_VIEWPORTS,
  maybeCaptureQaScreenshot,
  newStagingContext,
  triggerPendingViewportSearch,
  waitForMapReady,
} from "./support/staging.js";

async function requiredBox(name: string, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, `${name} should have a bounding box`).not.toBeNull();
  return box!;
}

async function expectDesktopMapDominance(page: Page): Promise<void> {
  const side = page.locator(".me-side");
  const mapWrap = page.locator(".me-map-wrap");
  await expect(side).toBeVisible();
  await expect(mapWrap).toBeVisible();

  const sideBox = await requiredBox("desktop result pane", side);
  const mapBox = await requiredBox("desktop map wrap", mapWrap);
  expect(mapBox.x).toBeGreaterThan(sideBox.x + sideBox.width - 4);
  expect(mapBox.width).toBeGreaterThan(sideBox.width * 1.55);
  expect(mapBox.height).toBeGreaterThan(620);
}

async function expectMobileMapDominance(page: Page): Promise<void> {
  await expect(page.locator(".me-side")).toBeHidden();
  const mapWrap = page.locator(".me-map-wrap");
  await expect(mapWrap).toBeVisible();
  const mapBox = await requiredBox("mobile map wrap", mapWrap);
  expect(mapBox.width).toBeGreaterThan(340);
  expect(mapBox.height).toBeGreaterThan(500);
}

async function expectMobileEmptyState(page: Page): Promise<void> {
  await expect(page.locator(".me-results-empty")).toHaveCount(1);
  await expect(page.locator("#me-map-status")).toContainText("この条件に合う観察はまだない");
}

async function expectDesktopSelectionOverlay(page: Page): Promise<void> {
  const selectionCard = page.locator("#me-map-selection-card");
  const insightCard = page.locator("#me-map-insight-card");
  const mapWrap = page.locator(".me-map-wrap");

  await expect(selectionCard).toHaveClass(/is-visible/);
  await expect(insightCard).not.toHaveClass(/is-visible/);

  const mapBox = await requiredBox("desktop map wrap", mapWrap);
  const selectionBox = await requiredBox("desktop place card", selectionCard);

  expect(selectionBox.x).toBeGreaterThanOrEqual(mapBox.x + 8);
  expect(selectionBox.y).toBeGreaterThanOrEqual(mapBox.y + 40);
  expect(selectionBox.x + selectionBox.width).toBeLessThanOrEqual(mapBox.x + mapBox.width * 0.56);
  expect(selectionBox.y + selectionBox.height).toBeLessThanOrEqual(mapBox.y + mapBox.height - 12);
  await expect(selectionCard.locator(".me-map-card")).toContainText(/\S+/);
}

async function expectMobileBottomSheet(page: Page): Promise<void> {
  const sheet = page.locator("#me-bottom-sheet");
  await expect(sheet).toHaveClass(/is-open/);
  await expect(sheet).toHaveAttribute("aria-hidden", "false");
  const sheetBox = await requiredBox("mobile bottom sheet", sheet);
  expect(sheetBox.height).toBeGreaterThan(220);
  expect(sheetBox.y).toBeGreaterThan(220);
  await expect(page.locator("#me-bottom-inner")).toContainText(/\S+/);
}

async function expectDesktopNeutralState(page: Page): Promise<void> {
  await expect(page.locator("#me-map-selection-card")).not.toHaveClass(/is-visible/);
  await expect(page.locator("#me-map-insight-card")).toHaveClass(/is-visible/);
  await expect(page.locator(".me-result-row.is-active")).toHaveCount(0);
}

async function hasBlankPlaceSelection(page: Page, isMobile: boolean): Promise<boolean> {
  if (isMobile) {
    const sheet = page.locator("#me-bottom-sheet");
    if (!(await sheet.evaluate((node) => node.classList.contains("is-open")).catch(() => false))) {
      return false;
    }
    if ((await page.locator("#me-bottom-inner .me-bottom-meta").count()) > 0) {
      return false;
    }
    return (await page.locator("#me-bottom-inner .me-site-brief").count()) > 0;
  }

  const selectionCard = page.locator("#me-map-selection-card");
  if (!(await selectionCard.evaluate((node) => node.classList.contains("is-visible")).catch(() => false))) {
    return false;
  }
  const copy = ((await selectionCard.locator(".me-map-card-copy").textContent()) ?? "").trim();
  return /^\d+\.\d{4},\s*\d+\.\d{4}$/.test(copy);
}

async function tryOpenBlankPlaceTarget(page: Page, isMobile: boolean): Promise<boolean> {
  const canvas = page.locator("#map-explorer canvas").first();
  const box = await requiredBox("map canvas", canvas);
  const attempts = [
    { x: box.x + box.width * 0.18, y: box.y + box.height * 0.22 },
    { x: box.x + box.width * 0.2, y: box.y + box.height * 0.76 },
    { x: box.x + box.width * 0.82, y: box.y + box.height * 0.24 },
    { x: box.x + box.width * 0.08, y: box.y + box.height * 0.12 },
    { x: box.x + box.width * 0.92, y: box.y + box.height * 0.12 },
    { x: box.x + box.width * 0.5, y: box.y + box.height * 0.1 },
  ];

  for (const point of attempts) {
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(250);
    if (await hasBlankPlaceSelection(page, isMobile)) return true;
  }
  return false;
}

for (const profile of MAP_VIEWPORTS) {
  test(`map shell QA flow (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();
    const resultRows = page.locator(".me-result-row");
    const sideStatus = page.locator("#me-side-status");

    await waitForMapReady(page, DEFAULT_STAGING_MAP_PATH);
    await maybeCaptureQaScreenshot(page, `${profile.slug}-initial.jpg`);
    await expect(page.locator(".me-topbar-primary")).toBeVisible();
    await expect(page.locator(".me-topbar-secondary")).toBeVisible();
    await expect(page.locator("#map-explorer")).toBeVisible();
    const initialRowCount = await resultRows.count();

    if (profile.isMobile) {
      await expectMobileMapDominance(page);
    } else {
      expect(initialRowCount).toBeGreaterThan(0);
      await expectDesktopMapDominance(page);
      await expectDesktopNeutralState(page);
    }

    if (profile.isMobile) {
      if (initialRowCount > 0) {
        await page.evaluate(() => {
          const firstRow = document.querySelector<HTMLButtonElement>(".me-result-row");
          firstRow?.click();
        });
        await expectMobileBottomSheet(page);
        await expect(page.locator("#me-bottom-inner .me-site-brief")).toHaveCount(0);
        await expect(page.locator("#me-bottom-inner")).not.toContainText("その場で調べる");
      } else {
        await expectMobileEmptyState(page);
      }
      await maybeCaptureQaScreenshot(page, `${profile.slug}-selected.jpg`);
    } else {
      const firstRow = page.locator(".me-result-row").first();
      await firstRow.click();
      await expectDesktopSelectionOverlay(page);
      await expect(page.locator("#me-map-selection-card .me-site-brief")).toHaveCount(0);
      await expect(page.locator("#me-map-selection-card")).not.toContainText("その場で調べる");
      await maybeCaptureQaScreenshot(page, `${profile.slug}-selected.jpg`);
    }

    const blankPlaceOpened = await tryOpenBlankPlaceTarget(page, !!profile.isMobile);
    if (blankPlaceOpened) {
      if (profile.isMobile) {
        await expect(page.locator("#me-bottom-inner .me-site-brief")).toHaveCount(1);
        await expect(page.locator("#me-bottom-inner")).toContainText("その場で調べる");
        await expect(page.locator("#me-bottom-inner")).toContainText("次の場所を探す");
      } else {
        await expect(page.locator("#me-map-selection-card .me-site-brief")).toHaveCount(1);
        await expect(page.locator("#me-map-selection-card")).toContainText("その場で調べる");
        await expect(page.locator("#me-map-selection-card")).toContainText("次の場所を探す");
      }
    }

    const statusBeforePan = (await sideStatus.textContent())?.trim() ?? "";
    await triggerPendingViewportSearch(page);
    await maybeCaptureQaScreenshot(page, `${profile.slug}-pending-search.jpg`);
    await expect(page.locator("#me-search-area-btn")).toContainText("この範囲で再検索");
    expect((await sideStatus.textContent())?.trim() ?? "").toBe(statusBeforePan);
    await page.locator("#me-search-area-btn").click({ force: true });
    await expect(page.locator("#me-search-area-btn")).toHaveClass(/is-hidden/, { timeout: 30_000 });
    if (profile.isMobile) {
      if (initialRowCount > 0) {
        await expect(page.locator("#me-bottom-sheet")).toHaveClass(/is-open/);
      }
    } else {
      await expect(resultRows.first()).toBeVisible();
    }

    await page.locator(".me-filter-toggle").click();
    await expect(page.locator(".me-filter-drawer")).toHaveAttribute("open", "");
    await expect(page.locator(".me-filter-panel")).toBeVisible();
    await expect(page.locator('input[name="me-basemap"][value="gsi"]')).toBeVisible();
    await maybeCaptureQaScreenshot(page, `${profile.slug}-filters.jpg`);

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
  await expect(page.locator("#map-explorer")).toHaveAttribute("data-results-pending", "0");
  await page.getByTestId("map-result-list").locator(".me-result-row").first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get("cell")).not.toBeNull();
  const selectedCell = await page.evaluate(() => new URL(window.location.href).searchParams.get("cell"));
  expect(selectedCell).not.toBeNull();
  await expect(page.locator("#map-explorer")).toHaveAttribute("data-results-pending", "0");
  await page.waitForTimeout(900);
  await expect.poll(() => new URL(page.url()).searchParams.get("cell")).toBe(selectedCell);
  await page.locator("#me-share-state").click();

  await expect.poll(() => new URL(page.url()).searchParams.get("taxon")).toBe("bird");
  await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("frontier");
  await expect.poll(() => new URL(page.url()).searchParams.get("bm")).toBe("gsi");
  await expect.poll(() => new URL(page.url()).searchParams.get("cell")).toBe(selectedCell);

  const sharedUrl = page.url();
  const restoredPage = await context.newPage();
  await waitForMapReady(restoredPage, sharedUrl);
  await expect(restoredPage.locator('.me-taxon-chip.is-active[data-taxon-group="bird"]')).toBeVisible();
  await expect(restoredPage.locator('.me-tab.is-active[data-tab="frontier"]')).toBeVisible();
  await expect(restoredPage.locator('.me-basemap-opt.is-active input[value="gsi"]')).toBeChecked();
  await expect.poll(() => new URL(restoredPage.url()).searchParams.get("cell")).toBe(selectedCell);
  await expect(restoredPage.locator("#me-map-selection-card")).toHaveClass(/is-visible/);
  await expect(restoredPage.locator(".me-result-row.is-active")).toHaveCount(0);
  await expect.poll(() => restoredPage.locator(".me-result-row").count()).toBeGreaterThan(0);

  await context.close();
});
