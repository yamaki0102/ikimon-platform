import { test, expect, type Page, type Route } from "@playwright/test";
import {
  DEFAULT_STAGING_MAP_PATH,
  MAP_VIEWPORTS,
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

type MapShellState = {
  filterToggleVisible: boolean;
  launcherVisible: boolean;
  mapHeight: number;
  mapVisible: boolean;
  mapWidth: number;
  resultsCount: number;
  rowCount: number;
};

async function readMapShellState(page: Page): Promise<MapShellState> {
  return page.evaluate(() => {
    const isVisible = (selector: string): boolean => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    const mapWrap = document.querySelector<HTMLElement>(".me-map-wrap");
    const mapBox = mapWrap?.getBoundingClientRect();
    const root = document.querySelector<HTMLElement>("#map-explorer");
    return {
      filterToggleVisible: isVisible(".me-filter-toggle"),
      launcherVisible: isVisible(".global-record-launcher"),
      mapHeight: mapBox?.height ?? 0,
      mapVisible: isVisible("#map-explorer") && isVisible(".me-map-wrap"),
      mapWidth: mapBox?.width ?? 0,
      resultsCount: Number(root?.getAttribute("data-results-count") || "0"),
      rowCount: document.querySelectorAll(".me-result-row").length,
    };
  });
}

async function waitForMapShellReady(page: Page, mapPath = DEFAULT_STAGING_MAP_PATH, isMobile = false): Promise<void> {
  await page.goto(mapPath, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((expectedMobile) => {
    const isVisible = (selector: string): boolean => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    const root = document.querySelector<HTMLElement>("#map-explorer");
    const mapWrap = document.querySelector<HTMLElement>(".me-map-wrap");
    const mapBox = mapWrap?.getBoundingClientRect();
    const count = Number(root?.getAttribute("data-results-count") || "0");
    const rows = document.querySelectorAll(".me-result-row").length;
    return Boolean(
      root
      && isVisible(".me-main")
      && isVisible(".me-search-shell")
      && isVisible(".me-filter-toggle")
      && isVisible("#map-explorer")
      && isVisible(".me-map-wrap")
      && (mapBox?.width ?? 0) > (expectedMobile ? 340 : 600)
      && (mapBox?.height ?? 0) > (expectedMobile ? 500 : 620)
      && (count > 0 || rows > 0)
    );
  }, isMobile, { timeout: 20_000 });
}

for (const profile of MAP_VIEWPORTS) {
  test(`map shell QA flow (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();
    await installDeterministicMapApiFixtures(page);
    await waitForMapShellReady(page, DEFAULT_STAGING_MAP_PATH, !!profile.isMobile);
    const initialState = await readMapShellState(page);

    if (profile.isMobile) {
      expect(initialState.rowCount).toBeGreaterThan(0);
      expect(initialState.mapVisible).toBe(true);
      expect(initialState.mapWidth).toBeGreaterThan(340);
      expect(initialState.mapHeight).toBeGreaterThan(500);
      expect(initialState.launcherVisible).toBe(true);
    } else {
      expect(initialState.rowCount).toBeGreaterThan(0);
      expect(initialState.mapVisible).toBe(true);
      expect(initialState.mapWidth).toBeGreaterThan(600);
      expect(initialState.mapHeight).toBeGreaterThan(620);
    }
    expect(initialState.filterToggleVisible).toBe(true);
    expect(initialState.resultsCount).toBeGreaterThan(0);

    await context.close();
  });
}
