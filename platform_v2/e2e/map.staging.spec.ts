import { test, expect, type Locator, type Page, type Route } from "@playwright/test";
import {
  DEFAULT_STAGING_MAP_PATH,
  MAP_VIEWPORTS,
  dragMap,
  maybeCaptureQaScreenshot,
  newStagingContext,
} from "./support/staging.js";

test.describe.configure({ retries: 0, timeout: 90_000 });

const MAP_FIXTURE_CELL_ID = "3000:5121:1377";
const MAP_FIXTURE_COLLECTION = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [137.724, 34.808],
          [137.736, 34.808],
          [137.736, 34.818],
          [137.724, 34.818],
          [137.724, 34.808],
        ]],
      },
      properties: {
        cellId: MAP_FIXTURE_CELL_ID,
        label: "浜松市",
        albumName: "浜松市・公開メッシュ",
        localityLabel: "浜松市",
        themeLabel: "公開メッシュ",
        scaleLabel: "近所メッシュ",
        nearbyAreaName: null,
        nameEraLabel: null,
        scope: "municipality",
        gridM: 3000,
        radiusM: 2121,
        count: 3,
        firstObservedAt: "2026-06-01T00:00:00.000Z",
        latestObservedAt: "2026-06-10T00:00:00.000Z",
        taxonMix: { plant: 2, insect: 1 },
        centroidLat: 34.813,
        centroidLng: 137.73,
      },
    },
  ],
  stats: {
    totalReturned: 1,
    totalAll: 1,
    totalRecords: 3,
    gridM: 3000,
    markerProfile: "all_research_artifacts",
    provenance: {
      sampled: false,
      sampleSize: 3,
      visible: { manual: 3, legacy: 0, track: 0, other: 0 },
      excluded: { manual: 0, legacy: 0, track: 0, other: 0 },
    },
  },
};
const MAP_FIXTURE_RECORDS = {
  items: [
    {
      occurrenceId: "qa-map-fixture-001",
      visitId: "qa-map-fixture-visit-001",
      displayName: "公開メッシュの草本",
      isAiCandidate: false,
      isAwaitingId: false,
      localityLabel: "浜松市",
      observedAt: "2026-06-10T09:00:00.000Z",
      photoUrl: null,
      taxonGroup: "plant",
      cellId: MAP_FIXTURE_CELL_ID,
    },
    {
      occurrenceId: "qa-map-fixture-002",
      visitId: "qa-map-fixture-visit-002",
      displayName: "公開メッシュの昆虫",
      isAiCandidate: false,
      isAwaitingId: false,
      localityLabel: "浜松市",
      observedAt: "2026-06-09T09:00:00.000Z",
      photoUrl: null,
      taxonGroup: "insect",
      cellId: MAP_FIXTURE_CELL_ID,
    },
    {
      occurrenceId: "qa-map-fixture-003",
      visitId: "qa-map-fixture-visit-003",
      displayName: "公開メッシュの樹木",
      isAiCandidate: false,
      isAwaitingId: false,
      localityLabel: "浜松市",
      observedAt: "2026-06-08T09:00:00.000Z",
      photoUrl: null,
      taxonGroup: "plant",
      cellId: MAP_FIXTURE_CELL_ID,
    },
  ],
  stats: {
    totalReturned: 3,
    totalAll: 3,
    markerProfile: "all_research_artifacts",
    gridM: 3000,
    selectedCellId: null as string | null,
    provenance: {
      sampled: false,
      sampleSize: 3,
      visible: { manual: 3, legacy: 0, track: 0, other: 0 },
      excluded: { manual: 0, legacy: 0, track: 0, other: 0 },
    },
  },
};
const EMPTY_FEATURE_COLLECTION = {
  type: "FeatureCollection",
  features: [],
  stats: { totalReturned: 0, totalAll: 0 },
};
const EMPTY_EFFORT_SUMMARY = {
  status: "ok",
  totals: { records: 0, visits: 0, contributors: 0, minutes: 0 },
  frontierRemaining: {},
};

async function fulfillJson(route: Route, payload: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload),
  });
}

async function installDeterministicMapApiFixtures(page: Page): Promise<void> {
  await page.route("**/api/v1/map/cells**", async (route) => {
    await fulfillJson(route, MAP_FIXTURE_COLLECTION);
  });
  await page.route("**/api/v1/map/observations**", async (route) => {
    const url = new URL(route.request().url());
    await fulfillJson(route, {
      ...MAP_FIXTURE_RECORDS,
      stats: {
        ...MAP_FIXTURE_RECORDS.stats,
        selectedCellId: url.searchParams.get("cell_id"),
      },
    });
  });
  await page.route("**/api/v1/map/frontier**", async (route) => {
    await fulfillJson(route, EMPTY_FEATURE_COLLECTION);
  });
  await page.route("**/api/v1/map/area-polygons**", async (route) => {
    await fulfillJson(route, EMPTY_FEATURE_COLLECTION);
  });
  await page.route("**/api/v1/map/guide-spots**", async (route) => {
    await fulfillJson(route, EMPTY_FEATURE_COLLECTION);
  });
  await page.route("**/api/v1/map/effort-summary**", async (route) => {
    await fulfillJson(route, EMPTY_EFFORT_SUMMARY);
  });
  await page.route("**/api/v1/map/site-brief**", async (route) => {
    await fulfillJson(route, { ok: false, error: "qa_fixture_no_site_brief" });
  });
}

async function waitForMapShellReady(page: Page, mapPath = DEFAULT_STAGING_MAP_PATH): Promise<void> {
  await page.goto(mapPath, { waitUntil: "domcontentloaded" });
  await page.locator("#map-explorer").waitFor({ state: "visible" });
  await expect(page.locator(".me-main")).toBeVisible();
  await expect(page.locator(".me-search-shell")).toBeVisible();
  await expect(page.locator(".me-tabs")).toBeVisible();
  await expect(page.locator(".me-filter-toggle")).toBeVisible();
  await page.locator("#map-explorer canvas").first().waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const root = document.querySelector("#map-explorer");
    if (!root) return false;
    const count = Number(root.getAttribute("data-results-count") || "0");
    const rows = document.querySelectorAll(".me-result-row").length;
    const empty = document.querySelectorAll(".me-results-empty").length;
    const status = [
      document.querySelector("#me-map-status")?.textContent || "",
      document.querySelector("#me-side-status")?.textContent || "",
    ].join(" ");
    return count > 0 || rows > 0 || empty > 0 || /\d+\s*\/\s*\d+/.test(status);
  }, undefined, { timeout: 45_000 });
}

async function openDesktopSidePanel(page: Page): Promise<void> {
  const sideToggle = page.locator("#me-side-toggle");
  if (!(await sideToggle.isVisible().catch(() => false))) return;
  if ((await sideToggle.getAttribute("aria-expanded").catch(() => null)) !== "true") {
    await sideToggle.click();
  }
  await expect(page.locator(".me-side-pane-results")).toBeVisible();
}

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
  expect(sideBox.x).toBeLessThanOrEqual(mapBox.x + 1);
  expect(mapBox.x).toBeGreaterThanOrEqual(sideBox.x + sideBox.width - 1);
  expect(sideBox.x + sideBox.width).toBeLessThan(mapBox.x + mapBox.width);
  expect(mapBox.width).toBeGreaterThan(sideBox.width * 1.45);
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

async function expectDesktopSelectionOverlay(page: Page): Promise<void> {
  const selectionCard = page.locator("#me-map-selection-card");
  const insightCard = page.locator("#me-map-insight-card");
  const side = page.locator(".me-side");

  await expect(selectionCard).toHaveClass(/is-visible/);
  if (await insightCard.count()) {
    await expect(insightCard).not.toHaveClass(/is-visible/);
  }

  const sideBox = await requiredBox("desktop result pane", side);
  const selectionBox = await requiredBox("desktop place card", selectionCard);

  expect(selectionBox.x).toBeGreaterThanOrEqual(sideBox.x);
  expect(selectionBox.x + selectionBox.width).toBeLessThanOrEqual(sideBox.x + sideBox.width + 1);
  expect(selectionBox.y).toBeGreaterThanOrEqual(sideBox.y);
  expect(selectionBox.height).toBeGreaterThan(120);
  await expect(selectionCard).toContainText(/\S+/);
}

async function expectDesktopNeutralState(page: Page): Promise<void> {
  await expect(page.locator("#me-map-selection-card")).not.toHaveClass(/is-visible/);
  const insightCard = page.locator("#me-map-insight-card");
  if (await insightCard.count()) {
    await expect(insightCard).toHaveClass(/is-visible/);
  } else {
    await expect(page.locator(".me-side-tab[data-side-tab='results']")).toHaveClass(/is-active/);
    await expect(page.locator(".me-side-pane-results")).toBeVisible();
  }
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

async function triggerPendingViewportSearchOrAutoRefresh(page: Page, previousStatus: string): Promise<"pending" | "refreshed"> {
  await page.waitForTimeout(700);
  const attempts = [
    { x: 220, y: 80 },
    { x: -240, y: 110 },
    { x: 0, y: -180 },
  ];
  const searchButton = page.locator("#me-search-area-btn");
  const sideStatus = page.locator("#me-side-status");
  for (const attempt of attempts) {
    await dragMap(page, attempt.x, attempt.y);
    await page.waitForTimeout(350);
    if (await searchButton.isVisible().catch(() => false)) return "pending";
    const nextStatus = ((await sideStatus.textContent().catch(() => "")) ?? "").trim();
    if (nextStatus && nextStatus !== previousStatus) return "refreshed";
  }
  if (await searchButton.isVisible().catch(() => false)) return "pending";
  return "refreshed";
}

for (const profile of MAP_VIEWPORTS) {
  test(`map shell QA flow (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();
    await installDeterministicMapApiFixtures(page);
    const resultRows = page.locator(".me-result-row");
    const sideStatus = page.locator("#me-side-status");

    await waitForMapShellReady(page, DEFAULT_STAGING_MAP_PATH);
    await maybeCaptureQaScreenshot(page, `${profile.slug}-initial.jpg`);
    const initialRowCount = await resultRows.count();

    if (profile.isMobile) {
      expect(initialRowCount).toBeGreaterThan(0);
      await expectMobileMapDominance(page);
    } else {
      expect(initialRowCount).toBeGreaterThan(0);
      await expectDesktopMapDominance(page);
      await openDesktopSidePanel(page);
      await expectDesktopNeutralState(page);
    }

    if (profile.isMobile) {
      await expect(page.locator(".global-record-launcher")).toBeVisible();
      await maybeCaptureQaScreenshot(page, `${profile.slug}-selected.jpg`);
    } else {
      const firstRow = page.locator(".me-result-row").first();
      await expect(firstRow).toBeVisible();
      await firstRow.click();
      await expectDesktopSelectionOverlay(page);
      await expect(page.locator("#me-map-selection-card .me-site-brief")).toHaveCount(0);
      await expect(page.locator("#me-map-selection-card")).not.toContainText("フィールドガイド");
      await expect(page.locator("#me-map-selection-card")).not.toContainText("フィールドスキャン");
      await maybeCaptureQaScreenshot(page, `${profile.slug}-selected.jpg`);
    }

    const blankPlaceOpened = process.env.MAP_QA_PROBE_BLANK_PLACE === "1"
      ? await tryOpenBlankPlaceTarget(page, !!profile.isMobile)
      : false;
    if (blankPlaceOpened) {
      if (profile.isMobile) {
        await expect(page.locator("#me-bottom-inner .me-site-brief")).toHaveCount(1);
        await expect(page.locator("#me-bottom-inner")).toContainText("その場で調べる");
        await expect(page.locator("#me-bottom-inner")).toContainText("記録する");
      } else {
        await expect(page.locator("#me-map-selection-card .me-site-brief")).toHaveCount(1);
        await expect(page.locator("#me-map-selection-card")).toContainText("その場で調べる");
      }
    }

    const statusBeforePan = (await sideStatus.textContent())?.trim() ?? "";
    const viewportSearchState = await triggerPendingViewportSearchOrAutoRefresh(page, statusBeforePan);
    await maybeCaptureQaScreenshot(page, `${profile.slug}-pending-search.jpg`);
    if (viewportSearchState === "pending") {
      await expect(page.locator("#me-search-area-btn")).toContainText("この範囲で再検索");
      const statusAfterPan = ((await sideStatus.textContent()) ?? "").trim();
      if (statusAfterPan !== statusBeforePan) {
        expect(statusAfterPan).toMatch(/^(\d+ 件を表示中 · \d+|この条件に合う観察はまだない)/);
      }
      const searchAreaButton = page.locator("#me-search-area-btn");
      if (await searchAreaButton.isVisible().catch(() => false)) {
        await searchAreaButton.click({ force: true });
      }
    }
    await expect(page.locator("#map-explorer")).toHaveAttribute("data-results-pending", "0", { timeout: 30_000 });
    if (profile.isMobile) {
      if (initialRowCount > 0) {
        await expect(page.locator("#me-bottom-sheet")).toHaveClass(/is-open/);
      }
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
  await installDeterministicMapApiFixtures(page);
  await waitForMapShellReady(page);

  await page.getByRole("tab", { name: "記録の余白" }).click({ force: true });
  await page.locator(".me-filter-toggle").click();
  await page.locator('input[name="me-basemap"][value="gsi"]').check({ force: true });
  await expect(page.locator("#map-explorer")).toHaveAttribute("data-results-pending", "0");
  await openDesktopSidePanel(page);
  await expect(page.getByTestId("map-result-list").locator(".me-result-row").first()).toBeVisible();
  await page.getByTestId("map-result-list").locator(".me-result-row").first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get("cell")).not.toBeNull();
  const selectedCell = await page.evaluate(() => new URL(window.location.href).searchParams.get("cell"));
  expect(selectedCell).not.toBeNull();
  await expect(page.locator("#map-explorer")).toHaveAttribute("data-results-pending", "0");
  await page.waitForTimeout(900);
  await expect.poll(() => new URL(page.url()).searchParams.get("cell")).toBe(selectedCell);
  await page.locator("#me-share-state").click();

  await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("frontier");
  await expect.poll(() => new URL(page.url()).searchParams.get("bm")).toBe("gsi");
  await expect.poll(() => new URL(page.url()).searchParams.get("cell")).toBe(selectedCell);

  const sharedUrl = page.url();
  const restoredPage = await context.newPage();
  await installDeterministicMapApiFixtures(restoredPage);
  await waitForMapShellReady(restoredPage, sharedUrl);
  await expect(restoredPage.locator('.me-tab.is-active[data-tab="frontier"]')).toBeVisible();
  await expect(restoredPage.locator('.me-basemap-opt.is-active input[value="gsi"]')).toBeChecked();
  await expect.poll(() => new URL(restoredPage.url()).searchParams.get("cell")).toBe(selectedCell);
  await openDesktopSidePanel(restoredPage);
  await expect(restoredPage.locator("#me-map-selection-card")).toHaveClass(/is-visible/);
  await expect(restoredPage.locator(".me-result-row.is-active")).toHaveCount(0);
  await expect.poll(() => restoredPage.locator(".me-result-row").count()).toBeGreaterThan(0);

  await context.close();
});
