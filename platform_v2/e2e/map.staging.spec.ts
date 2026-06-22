import { test, expect, type Page, type Route, type TestInfo } from "@playwright/test";
import {
  DEFAULT_STAGING_MAP_PATH,
  installMapLibreStubForSmoke,
  MAP_VIEWPORTS,
  newStagingContext,
} from "./support/staging.js";

test.describe.configure({ retries: 0, timeout: 30_000 });

const MAP_FIXTURE_CELL_ID = "3000:5121:1377";
const MAP_FIXTURE_PHOTO_BASE = "/uploads/qa-map-shell";
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
      photoUrl: `${MAP_FIXTURE_PHOTO_BASE}/kusamoto.jpg`,
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
      photoUrl: `${MAP_FIXTURE_PHOTO_BASE}/konchu.jpg`,
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
      photoUrl: `${MAP_FIXTURE_PHOTO_BASE}/jumoku.jpg`,
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
const MAP_FIXTURE_RAIN_TIMES: RainNowcastTimesPayload = {
  tileUrlTemplate: "/api/v1/weather/jma-nowcast/tile?product={product}&member={member}&basetime={basetime}&validtime={validtime}&z={z}&x={x}&y={y}",
  times: [
    { offsetMinutes: 0, basetime: "20260620030000", validtime: "20260620030000", product: "nowcast", member: "none" },
    { offsetMinutes: 5, basetime: "20260620030000", validtime: "20260620030500", product: "nowcast", member: "none" },
    { offsetMinutes: 15, basetime: "20260620030000", validtime: "20260620031500", product: "nowcast", member: "none" },
    { offsetMinutes: 30, basetime: "20260620030000", validtime: "20260620033000", product: "nowcast", member: "none" },
    { offsetMinutes: 60, basetime: "20260620030000", validtime: "20260620040000", product: "nowcast", member: "none" },
    { offsetMinutes: 120, basetime: "20260620030000", validtime: "20260620050000", product: "short_range", member: "immed" },
    { offsetMinutes: 180, basetime: "20260620030000", validtime: "20260620060000", product: "short_range", member: "immed" },
    { offsetMinutes: 240, basetime: "20260620030000", validtime: "20260620070000", product: "short_range", member: "immed" },
    { offsetMinutes: 300, basetime: "20260620030000", validtime: "20260620080000", product: "short_range", member: "immed" },
    { offsetMinutes: 360, basetime: "20260620030000", validtime: "20260620090000", product: "short_range", member: "immed" },
  ],
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
  await page.route("**/api/v1/weather/jma-nowcast/times", async (route) => {
    await fulfillJson(route, MAP_FIXTURE_RAIN_TIMES);
  });
  await page.route("**/api/v1/weather/jma-nowcast/tile**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from([137, 80, 78, 71]),
    });
  });
}

async function installEmptyMapApiFixtures(page: Page): Promise<void> {
  await page.route("**/api/v1/map/cells**", async (route) => {
    await fulfillJson(route, EMPTY_FEATURE_COLLECTION);
  });
  await page.route("**/api/v1/map/observations**", async (route) => {
    await fulfillJson(route, {
      items: [],
      stats: {
        totalReturned: 0,
        totalAll: 0,
        markerProfile: "all_research_artifacts",
        gridM: 3000,
        selectedCellId: null,
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

type RainNowcastTimesPayload = {
  tileUrlTemplate?: string;
  times?: Array<{
    basetime: string;
    offsetMinutes: number;
    validtime: string;
  }>;
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

async function expectRainNowcastGate(page: Page): Promise<void> {
  await expect(page.locator("#me-rain-card")).toBeHidden();
  const rainTab = page.locator('.me-tab[data-tab="rain"]');
  await rainTab.click();
  await expect(rainTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#me-rain-card")).toBeVisible();
  await expect(page.locator("#me-rain-toggle")).toBeVisible();
  await expect(page.locator("#me-rain-toggle")).toHaveAttribute("aria-pressed", "true");

  await expect(page.locator("#me-rain-card")).toHaveAttribute("data-enabled", "1", { timeout: 5_000 });
  await expect(page.locator("#me-rain-timeline .me-rain-time")).toHaveCount(MAP_FIXTURE_RAIN_TIMES.times?.length ?? 0);
  await expect(page.locator("#me-rain-timeline .me-rain-time").filter({ hasText: "6時間後" })).toBeVisible();
  await expect(page.locator("#me-rain-status")).toContainText("ikimon独自予報ではありません");
}

async function readRainFocusState(page: Page): Promise<{
  launcherDisplay: string;
  rainCardEnabled: string | null;
  rainCardSheetOpen: string | null;
  rainCardVisible: boolean;
  sheetAriaHidden: string | null;
  sheetClass: string;
}> {
  return page.evaluate(() => {
    const visible = (element: HTMLElement | null): boolean => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    };
    const launcher = document.querySelector<HTMLElement>(".global-record-launcher");
    const rainCard = document.querySelector<HTMLElement>("#me-rain-card");
    const sheet = document.querySelector<HTMLElement>("#me-bottom-sheet");
    return {
      launcherDisplay: launcher ? window.getComputedStyle(launcher).display : "",
      rainCardEnabled: rainCard?.getAttribute("data-enabled") ?? null,
      rainCardSheetOpen: rainCard?.getAttribute("data-sheet-open") ?? null,
      rainCardVisible: visible(rainCard),
      sheetAriaHidden: sheet?.getAttribute("aria-hidden") ?? null,
      sheetClass: sheet?.className ?? "",
    };
  });
}

async function expectLiveRainNowcastGate(page: Page): Promise<void> {
  const response = await page.request.get("/api/v1/weather/jma-nowcast/times", {
    headers: { accept: "application/json" },
    timeout: 15_000,
  });
  expect(response.ok(), `JMA nowcast times should be reachable on staging: ${response.status()}`).toBeTruthy();
  const payload = await response.json() as RainNowcastTimesPayload;
  expect(payload.times?.length ?? 0).toBeGreaterThanOrEqual(3);
  expect(payload.times?.some((entry) => entry.offsetMinutes === 0)).toBe(true);
  expect(payload.times?.some((entry) => entry.offsetMinutes >= 30)).toBe(true);
  expect(payload.tileUrlTemplate ?? "").toMatch(/^\/api\/v1\/weather\/jma-nowcast\/tile/);

  const sample = payload.times?.[0];
  if (!sample || !payload.tileUrlTemplate) throw new Error("missing nowcast tile sample");
  const tilePath = payload.tileUrlTemplate
    .replace("{basetime}", sample.basetime)
    .replace("{validtime}", sample.validtime)
    .replace("{z}", "5")
    .replace("{x}", "28")
    .replace("{y}", "12");
  const tileResponse = await page.request.get(tilePath, { headers: { accept: "image/png" } });
  expect(tileResponse.ok(), `JMA nowcast tile proxy should return a tile: ${tileResponse.status()} ${tilePath}`).toBeTruthy();
  expect(tileResponse.headers()["content-type"] ?? "").toContain("image/png");
}

async function readMobileSheetMotionState(page: Page): Promise<{
  bannedCopyPresent: boolean;
  launcherVisible: boolean;
  overlapPx: number;
  sheetClass: string;
  sheetHeight: number;
  sheetTop: number;
  snap: string | null;
  viewportHeight: number;
}> {
  return page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("#me-bottom-sheet");
    const launcher = document.querySelector<HTMLElement>(".global-record-launcher");
    const sheetBox = sheet?.getBoundingClientRect();
    const launcherBox = launcher?.getBoundingClientRect();
    const launcherStyle = launcher ? window.getComputedStyle(launcher) : null;
    const launcherVisible = Boolean(
      launcher
      && launcherStyle
      && launcherStyle.display !== "none"
      && launcherStyle.visibility !== "hidden"
      && (launcherBox?.width ?? 0) > 0
      && (launcherBox?.height ?? 0) > 0
    );
    const sheetBottom = sheetBox?.bottom ?? 0;
    const launcherTop = launcherBox?.top ?? window.innerHeight;
    const bodyText = document.body.innerText || "";
    return {
      bannedCopyPresent: bodyText.includes("育つ余白") || bodyText.includes("少ない事実 + 次に探す方向"),
      launcherVisible,
      overlapPx: Math.max(0, sheetBottom - launcherTop),
      sheetClass: sheet?.className || "",
      sheetHeight: Math.round(sheetBox?.height ?? 0),
      sheetTop: Math.round(sheetBox?.top ?? 0),
      snap: sheet?.getAttribute("data-snap") ?? null,
      viewportHeight: window.innerHeight,
    };
  });
}

async function dragBottomSheetGripUp(page: Page, distancePx = 96): Promise<void> {
  const gripBox = await page.locator("#me-bottom-grip").boundingBox();
  expect(gripBox, "bottom sheet grip should be measurable").toBeTruthy();
  const x = Math.round(gripBox!.x + gripBox!.width / 2);
  const y = Math.round(gripBox!.y + gripBox!.height / 2);
  await page.locator("#me-bottom-grip").dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: x,
    clientY: y,
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
  });
  await page.locator("#me-bottom-grip").dispatchEvent("pointermove", {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: x,
    clientY: y - distancePx,
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
  });
}

async function releaseBottomSheetGrip(page: Page, distancePx = 96): Promise<void> {
  const gripBox = await page.locator("#me-bottom-grip").boundingBox();
  expect(gripBox, "bottom sheet grip should be measurable").toBeTruthy();
  const x = Math.round(gripBox!.x + gripBox!.width / 2);
  const y = Math.round(gripBox!.y + gripBox!.height / 2);
  await page.locator("#me-bottom-grip").dispatchEvent("pointerup", {
    bubbles: true,
    button: 0,
    buttons: 0,
    cancelable: true,
    clientX: x,
    clientY: y - distancePx,
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
  });
}

async function attachC112MobileSheetEvidence(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const clip = await page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("#me-bottom-sheet");
    const box = sheet?.getBoundingClientRect();
    const y = Math.max(0, Math.floor((box?.top ?? window.innerHeight * 0.55) - 88));
    const height = Math.max(180, Math.min(Math.floor(window.innerHeight - y), window.innerHeight));
    return {
      x: 0,
      y,
      width: Math.max(320, Math.floor(window.innerWidth)),
      height,
    };
  });
  await testInfo.attach(name, {
    body: await page.screenshot({
      animations: "disabled",
      clip,
      quality: 72,
      timeout: 8_000,
      type: "jpeg",
    }),
    contentType: "image/jpeg",
  });
}

async function waitForMapShellReady(page: Page, mapPath = DEFAULT_STAGING_MAP_PATH, isMobile = false): Promise<void> {
  const response = await page.goto(mapPath, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, `${mapPath} should load before map shell assertions`).toBeLessThan(400);
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
  }, isMobile, { timeout: 10_000 });
}

async function waitForMapEmptyState(page: Page, mapPath = DEFAULT_STAGING_MAP_PATH): Promise<void> {
  const response = await page.goto(mapPath, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, `${mapPath} should load before empty-state assertions`).toBeLessThan(400);
  await expect(page.locator("#map-explorer[data-results-state='empty']")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#me-empty-invite")).toBeVisible();
  await expect(page.locator(".me-results-empty")).toBeAttached();
}

test("mobile bottom sheet opens as a map-detail peek and follows drag before snapping", async ({ browser }) => {
  test.setTimeout(90_000);
  const mobile = MAP_VIEWPORTS.find((profile) => profile.slug === "mobile-390");
  expect(mobile, "mobile viewport profile should exist").toBeTruthy();
  const context = await newStagingContext(browser, mobile!, { serviceWorkers: "block" });
  const page = await context.newPage();
  await installMapLibreStubForSmoke(page);
  await installDeterministicMapApiFixtures(page);
  await waitForMapShellReady(page, DEFAULT_STAGING_MAP_PATH, true);

  const canvasBox = await page.locator("[data-maplibre-smoke-stub='1']").boundingBox();
  expect(canvasBox, "stubbed map canvas should be measurable").toBeTruthy();
  await page.mouse.click(
    Math.round(canvasBox!.x + canvasBox!.width / 2),
    Math.round(canvasBox!.y + canvasBox!.height / 2),
  );
  const sheet = page.locator("#me-bottom-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("aria-hidden", "false");
  await expect(sheet).toHaveAttribute("data-snap", "peek");
  await expect(sheet).toHaveClass(/me-bottom-sheet--detail/);

  const peek = await readMobileSheetMotionState(page);
  expect(peek.bannedCopyPresent).toBe(false);
  expect(peek.launcherVisible).toBe(true);
  expect(peek.overlapPx, "peek sheet should stay above the record launcher").toBeLessThanOrEqual(2);
  expect(peek.sheetHeight, "first sheet should open as a compact peek, not a full takeover").toBeGreaterThan(200);
  expect(peek.sheetHeight, "first sheet should leave map context visible").toBeLessThanOrEqual(330);
  expect(peek.sheetTop, "map should remain visible above the first sheet").toBeGreaterThan(260);

  await dragBottomSheetGripUp(page);
  await page.waitForTimeout(80);

  const dragging = await page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("#me-bottom-sheet");
    const box = sheet?.getBoundingClientRect();
    return {
      className: sheet?.className || "",
      dragHeight: sheet?.style.getPropertyValue("--me-sheet-drag-height") || "",
      height: Math.round(box?.height ?? 0),
      snap: sheet?.getAttribute("data-snap"),
      transition: sheet ? window.getComputedStyle(sheet).transition : "",
    };
  });
  expect(dragging.className).toContain("is-dragging");
  expect(dragging.dragHeight).toMatch(/px$/);
  expect(dragging.height, "sheet height should follow the finger during pointermove").toBeGreaterThan(peek.sheetHeight + 45);
  expect(dragging.transition, "dragging should not animate behind the finger").toBe("none");

  await releaseBottomSheetGrip(page);
  await expect(sheet).toHaveAttribute("data-snap", "full");
  const fullClass = await sheet.evaluate((element) => element.className);
  expect(fullClass).not.toContain("is-dragging");
  const full = await readMobileSheetMotionState(page);
  expect(full.overlapPx, "full sheet should still avoid covering the record launcher").toBeLessThanOrEqual(2);

  await context.close();
});

test("mobile bottom sheet evidence captures peek drag and full states", async ({ browser }, testInfo) => {
  test.skip(
    process.env.C112_CAPTURE_MOTION_EVIDENCE !== "1",
    "C112 screenshot evidence is opt-in; release gates use the lightweight motion contract.",
  );
  testInfo.setTimeout(180_000);
  const mobile = MAP_VIEWPORTS.find((profile) => profile.slug === "mobile-390");
  expect(mobile, "mobile viewport profile should exist").toBeTruthy();
  const context = await newStagingContext(browser, mobile!, { serviceWorkers: "block" });
  const page = await context.newPage();
  await installMapLibreStubForSmoke(page);
  await installDeterministicMapApiFixtures(page);
  await waitForMapShellReady(page, DEFAULT_STAGING_MAP_PATH, true);

  const canvasBox = await page.locator("[data-maplibre-smoke-stub='1']").boundingBox();
  expect(canvasBox, "stubbed map canvas should be measurable").toBeTruthy();
  await page.mouse.click(
    Math.round(canvasBox!.x + canvasBox!.width / 2),
    Math.round(canvasBox!.y + canvasBox!.height / 2),
  );
  const sheet = page.locator("#me-bottom-sheet");
  await expect(sheet).toHaveAttribute("data-snap", "peek");
  await attachC112MobileSheetEvidence(page, testInfo, "c112-mobile-map-sheet-peek");

  const peek = await readMobileSheetMotionState(page);
  await dragBottomSheetGripUp(page);
  const dragging = await page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("#me-bottom-sheet");
    const box = sheet?.getBoundingClientRect();
    return {
      className: sheet?.className || "",
      height: Math.round(box?.height ?? 0),
    };
  });
  expect(dragging.className).toContain("is-dragging");
  expect(dragging.height, "evidence capture should show the sheet following the drag").toBeGreaterThan(peek.sheetHeight + 45);
  await attachC112MobileSheetEvidence(page, testInfo, "c112-mobile-map-sheet-dragging");

  await releaseBottomSheetGrip(page);
  await expect(sheet).toHaveAttribute("data-snap", "full");
  await attachC112MobileSheetEvidence(page, testInfo, "c112-mobile-map-sheet-full");

  await context.close();
});

test("JMA nowcast staging API exposes times and a sample tile", async ({ browser }) => {
  const context = await newStagingContext(browser, MAP_VIEWPORTS[0], { serviceWorkers: "block" });
  const page = await context.newPage();
  await expectLiveRainNowcastGate(page);
  await context.close();
});

test("mobile rain map taps keep focus on the rain layer instead of opening a place sheet", async ({ browser }) => {
  test.setTimeout(90_000);
  const mobile = MAP_VIEWPORTS.find((profile) => profile.slug === "mobile-390");
  expect(mobile, "mobile viewport profile should exist").toBeTruthy();
  const context = await newStagingContext(browser, mobile!, { serviceWorkers: "block" });
  const page = await context.newPage();
  await installMapLibreStubForSmoke(page);
  await installDeterministicMapApiFixtures(page);
  await waitForMapShellReady(page, DEFAULT_STAGING_MAP_PATH, true);
  await expectRainNowcastGate(page);

  const before = await readRainFocusState(page);
  expect(before.rainCardVisible).toBe(true);
  expect(before.rainCardEnabled).toBe("1");
  expect(before.rainCardSheetOpen).toBe("0");
  expect(before.sheetAriaHidden).toBe("true");
  expect(before.launcherDisplay).toBe("none");

  const canvasBox = await page.locator("[data-maplibre-smoke-stub='1']").boundingBox();
  expect(canvasBox, "stubbed map canvas should be measurable").toBeTruthy();
  await page.mouse.click(
    Math.round(canvasBox!.x + canvasBox!.width / 2),
    Math.round(canvasBox!.y + canvasBox!.height / 2),
  );

  await expect(page.locator("#me-rain-card")).toHaveAttribute("data-sheet-open", "0");
  await expect(page.locator("#me-bottom-sheet")).toHaveAttribute("aria-hidden", "true");
  const after = await readRainFocusState(page);
  expect(after.rainCardVisible).toBe(true);
  expect(after.rainCardEnabled).toBe("1");
  expect(after.rainCardSheetOpen).toBe("0");
  expect(after.sheetAriaHidden).toBe("true");
  expect(after.sheetClass).not.toContain("is-open");
  expect(after.sheetClass).not.toContain("me-bottom-sheet--detail");
  expect(after.sheetClass).not.toContain("me-bottom-sheet--area");
  expect(after.launcherDisplay).toBe("none");

  await context.close();
});

for (const profile of MAP_VIEWPORTS) {
  test(`map shell QA flow (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile, { serviceWorkers: "block" });
    const page = await context.newPage();
    await installMapLibreStubForSmoke(page);
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
    if (profile.slug === "desktop-1440") {
      await expectRainNowcastGate(page);
    }

    await context.close();
  });

  test(`map empty state invites candidate discovery (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile, { serviceWorkers: "block" });
    const page = await context.newPage();
    await installMapLibreStubForSmoke(page);
    await installEmptyMapApiFixtures(page);
    await waitForMapEmptyState(page, DEFAULT_STAGING_MAP_PATH);

    await expect(page.locator(".me-results-empty")).toContainText("近くの記録を探せます");
    await expect(page.locator("#me-empty-invite [data-results-empty-areas]")).toBeVisible();
    await expect(page.locator("#me-empty-invite [data-results-empty-widen]")).toBeVisible();
    await expect(page.locator("#me-empty-invite [data-kpi-action='map:results_empty_record']")).toHaveAttribute("href", /\/record/);

    await page.close();
  });
}
