import { test, expect, type Locator, type Page, type Route } from "@playwright/test";
import {
  DEFAULT_STAGING_MAP_PATH,
  MAP_VIEWPORTS,
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

async function requiredBox(name: string, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, `${name} should have a bounding box`).not.toBeNull();
  return box!;
}

async function expectDesktopMapDominance(page: Page): Promise<void> {
  const mapWrap = page.locator(".me-map-wrap");
  await expect(mapWrap).toBeVisible();

  const mapBox = await requiredBox("desktop map wrap", mapWrap);
  expect(mapBox.width).toBeGreaterThan(600);
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

for (const profile of MAP_VIEWPORTS) {
  test(`map shell QA flow (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();
    await installDeterministicMapApiFixtures(page);
    const resultRows = page.locator(".me-result-row");

    await waitForMapShellReady(page, DEFAULT_STAGING_MAP_PATH);
    await maybeCaptureQaScreenshot(page, `${profile.slug}-initial.jpg`);
    const initialRowCount = await resultRows.count();

    if (profile.isMobile) {
      expect(initialRowCount).toBeGreaterThan(0);
      await expectMobileMapDominance(page);
    } else {
      expect(initialRowCount).toBeGreaterThan(0);
      await expectDesktopMapDominance(page);
    }

    if (profile.isMobile) {
      await expect(page.locator(".global-record-launcher")).toBeVisible();
      await maybeCaptureQaScreenshot(page, `${profile.slug}-selected.jpg`);
    } else {
      await maybeCaptureQaScreenshot(page, `${profile.slug}-selected.jpg`);
    }

    await page.locator(".me-filter-toggle").click();
    await expect(page.locator(".me-filter-drawer")).toHaveAttribute("open", "");
    await expect(page.locator(".me-filter-panel")).toBeVisible();
    await expect(page.locator('input[name="me-basemap"][value="gsi"]')).toBeVisible();
    await maybeCaptureQaScreenshot(page, `${profile.slug}-filters.jpg`);

    await context.close();
  });
}
