import { test, expect, type Browser } from "@playwright/test";
import {
  DEFAULT_STAGING_MAP_PATH,
  MAP_VIEWPORTS,
  newStagingContext,
  type ViewportProfile,
} from "./support/staging.js";

test.describe.configure({ retries: 0, timeout: 75_000 });
test.use({ trace: "off" });

const MAP_PERFORMANCE_PROFILES = MAP_VIEWPORTS.filter((profile) =>
  profile.slug === "desktop-1440" || profile.slug === "mobile-390");

const MAP_LOAD_BUDGET_MS = {
  domContentLoaded: 4_500,
  mapCanvasVisible: 8_000,
  firstMapApi: 8_000,
  firstMapTile: 12_000,
};

type MapPerfMarker = {
  ms: number;
  status?: number;
  url: string;
};

type MapPerfSummary = {
  domContentLoadedMs: number;
  firstMapApi: MapPerfMarker | null;
  firstMapTile: MapPerfMarker | null;
  lcpMs: number | null;
  mapCanvasVisibleMs: number;
  path: string;
  profile: string;
};

function isMapApiUrl(url: string): boolean {
  return /\/api\/v1\/map\/(?:cells|observations|area-polygons|frontier|guide-spots|effort-summary)\b/.test(url);
}

function isMapTileUrl(url: string): boolean {
  return (
    /arcgisonline\.com\/ArcGIS\/rest\/services\/.+\/MapServer\/tile\//i.test(url)
    || /tiles\.openfreemap\.org\/(?:planet|fonts)\b/i.test(url)
    || /cyberjapandata\.gsi\.go\.jp\/xyz\//i.test(url)
    || /tile\.openstreetmap\.org\//i.test(url)
  );
}

async function waitForMapPerformanceSummary(
  browser: Browser,
  profile: ViewportProfile,
): Promise<MapPerfSummary> {
  const context = await newStagingContext(browser, profile);
  const page = await context.newPage();
  const webglAvailable = await page.evaluate(() => {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  });
  test.skip(!webglAvailable, "Playwright browser has no WebGL context; runtime interaction is not classified in this environment");

  const startedAt = Date.now();
  let firstMapApi: MapPerfMarker | null = null;
  let firstMapTile: MapPerfMarker | null = null;

  page.on("response", (response) => {
    const url = response.url();
    if (!firstMapApi && isMapApiUrl(url)) {
      firstMapApi = { ms: Date.now() - startedAt, status: response.status(), url };
    }
    if (!firstMapTile && response.ok() && isMapTileUrl(url)) {
      firstMapTile = { ms: Date.now() - startedAt, status: response.status(), url };
    }
  });

  const response = await page.goto(DEFAULT_STAGING_MAP_PATH, { waitUntil: "domcontentloaded" });
  const domContentLoadedMs = Date.now() - startedAt;
  expect(response?.status() ?? 0, `${DEFAULT_STAGING_MAP_PATH} should load for map performance QA`).toBeLessThan(400);

  await page.waitForFunction(
    () => {
      const wrap = document.querySelector<HTMLElement>(".me-map-wrap");
      const canvas = document.querySelector<HTMLCanvasElement>(".maplibregl-canvas");
      const wrapBox = wrap?.getBoundingClientRect();
      const canvasBox = canvas?.getBoundingClientRect();
      return Boolean(
        wrap
        && canvas
        && (wrapBox?.width ?? 0) > 320
        && (wrapBox?.height ?? 0) > 480
        && (canvasBox?.width ?? 0) > 300
        && (canvasBox?.height ?? 0) > 300
      );
    },
    null,
    { timeout: MAP_LOAD_BUDGET_MS.mapCanvasVisible },
  );

  const mapCanvasVisibleMs = Date.now() - startedAt;
  await expect.poll(() => firstMapApi?.ms ?? 0, {
    message: "first /api/v1/map response should arrive before the map feels stalled",
    timeout: MAP_LOAD_BUDGET_MS.firstMapApi,
  }).toBeGreaterThan(0);
  await expect.poll(() => firstMapTile?.ms ?? 0, {
    message: "first real map tile should arrive before the map appears blank",
    timeout: MAP_LOAD_BUDGET_MS.firstMapTile,
  }).toBeGreaterThan(0);

  const summaryWithoutPaint: MapPerfSummary = {
    domContentLoadedMs,
    firstMapApi,
    firstMapTile,
    lcpMs: null,
    mapCanvasVisibleMs,
    path: DEFAULT_STAGING_MAP_PATH,
    profile: profile.slug,
  };
  console.info(`map-performance-core ${JSON.stringify(summaryWithoutPaint)}`);

  const summary: MapPerfSummary = {
    domContentLoadedMs,
    firstMapApi,
    firstMapTile,
    lcpMs: null,
    mapCanvasVisibleMs,
    path: DEFAULT_STAGING_MAP_PATH,
    profile: profile.slug,
  };
  console.info(`map-performance ${JSON.stringify(summary)}`);
  console.info(`map-performance context cleanup deferred to browser teardown (${profile.slug})`);
  return summary;
}

type UrlViewportState = { lng: number; lat: number; z: number };

async function readUrlViewport(page: import("@playwright/test").Page): Promise<UrlViewportState> {
  return page.evaluate(() => {
    const url = new URL(window.location.href);
    return {
      lng: Number(url.searchParams.get("lng")),
      lat: Number(url.searchParams.get("lat")),
      z: Number(url.searchParams.get("z")),
    };
  });
}

function centerChanged(before: UrlViewportState, after: UrlViewportState): boolean {
  return Math.abs(after.lng - before.lng) > 0.00001 || Math.abs(after.lat - before.lat) > 0.00001;
}

for (const profileName of ["desktop-1440", "mobile-390"] as const) {
  test(`map interaction changes real viewport state (${profileName})`, async ({ browser }) => {
    const profile = MAP_VIEWPORTS.find((item) => item.slug === profileName)!;
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();
    const webglAvailable = await page.evaluate(() => {
      const probe = document.createElement("canvas");
      return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
    });
    test.skip(!webglAvailable, "Playwright browser has no WebGL context; runtime interaction is not classified in this environment");
    const initErrors: string[] = [];
    const externalOverpass: string[] = [];
    const liveOsmViewportRequests: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/\[map\] init failed|Failed to initialize WebGL|Could not create a WebGL context/i.test(text)) initErrors.push(text);
    });
    page.on("request", (request) => {
      const url = request.url();
      if (/overpass-api\.de\/api\/interpreter/i.test(url)) externalOverpass.push(url);
      if (/\/api\/v1\/map\/area-polygons\b/.test(url) && new URL(url).searchParams.get("live_osm") === "1") liveOsmViewportRequests.push(url);
    });
    const response = await page.goto("/map?tab=places&bm=esri&lng=137.8589&lat=34.7219&z=13.6", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 0).toBeLessThan(400);
    const canvas = page.locator(".maplibregl-canvas");
    await expect(canvas).toHaveCount(1, { timeout: 8_000 });
    await expect(canvas).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(".maplibregl-canvas-container")).toHaveCount(1);
    await expect(page.locator(".maplibregl-control-container")).toHaveCount(1);
    const beforeDrag = await readUrlViewport(page);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.68, box!.y + box!.height * 0.52);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.40, box!.y + box!.height * 0.52, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => centerChanged(beforeDrag, await readUrlViewport(page)), { timeout: 5_000 }).toBe(true);
    const beforeZoom = await readUrlViewport(page);
    await page.locator(".maplibregl-ctrl-zoom-in").click();
    await expect.poll(async () => (await readUrlViewport(page)).z, { timeout: 5_000 }).not.toBe(beforeZoom.z);
    expect(initErrors, `MapLibre init errors: ${initErrors.join(" | ")}`).toEqual([]);
    expect(externalOverpass).toEqual([]);
    expect(liveOsmViewportRequests).toEqual([]);
    await context.close();
  });
}

for (const profile of MAP_PERFORMANCE_PROFILES) {
  test(`map initial load stays within the UX guardrail (${profile.slug})`, async ({ browser }) => {
    const summary = await waitForMapPerformanceSummary(browser, profile);
    expect(summary.domContentLoadedMs).toBeLessThan(MAP_LOAD_BUDGET_MS.domContentLoaded);
    expect(summary.mapCanvasVisibleMs).toBeLessThan(MAP_LOAD_BUDGET_MS.mapCanvasVisible);
    expect(summary.firstMapApi?.ms ?? Number.POSITIVE_INFINITY).toBeLessThan(MAP_LOAD_BUDGET_MS.firstMapApi);
    expect(summary.firstMapTile?.ms ?? Number.POSITIVE_INFINITY).toBeLessThan(MAP_LOAD_BUDGET_MS.firstMapTile);
  });
}
