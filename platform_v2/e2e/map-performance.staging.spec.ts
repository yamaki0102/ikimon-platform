import { test, expect, type Browser, type Page } from "@playwright/test";
import {
  DEFAULT_STAGING_MAP_PATH,
  MAP_VIEWPORTS,
  newStagingContext,
  type ViewportProfile,
} from "./support/staging.js";

test.describe.configure({ retries: 0, timeout: 75_000 });

const MAP_PERFORMANCE_PROFILES = MAP_VIEWPORTS.filter((profile) =>
  profile.slug === "desktop-1440" || profile.slug === "mobile-390");

const MAP_LOAD_BUDGET_MS = {
  domContentLoaded: 4_500,
  mapCanvasVisible: 8_000,
  firstMapApi: 8_000,
  firstMapTile: 12_000,
  lcpWhenAvailable: 7_000,
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

async function installPaintTimingProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as typeof window & {
      __ikimonMapPerf?: { firstContentfulPaintMs: number | null; largestContentfulPaintMs: number | null };
    };
    target.__ikimonMapPerf = {
      firstContentfulPaintMs: null,
      largestContentfulPaintMs: null,
    };
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            target.__ikimonMapPerf!.firstContentfulPaintMs = entry.startTime;
          }
        }
      });
      paintObserver.observe({ type: "paint", buffered: true });
    } catch (_) {
      // Paint timing support varies by browser/runtime.
    }
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) target.__ikimonMapPerf!.largestContentfulPaintMs = lastEntry.startTime;
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch (_) {
      // LCP is a browser metric, not required for the functional gate.
    }
  });
}

async function waitForMapPerformanceSummary(
  browser: Browser,
  profile: ViewportProfile,
): Promise<MapPerfSummary> {
  const context = await newStagingContext(browser, profile);
  const page = await context.newPage();
  await installPaintTimingProbe(page);

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
      const status = document.querySelector<HTMLElement>("#me-map-status");
      const wrapBox = wrap?.getBoundingClientRect();
      const canvasBox = canvas?.getBoundingClientRect();
      return Boolean(
        wrap
        && canvas
        && (wrapBox?.width ?? 0) > 320
        && (wrapBox?.height ?? 0) > 480
        && (canvasBox?.width ?? 0) > 300
        && (canvasBox?.height ?? 0) > 300
        && (!status || status.textContent !== "読み込み中…")
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

  const paintMetrics = await page.evaluate(() => {
    const target = window as typeof window & {
      __ikimonMapPerf?: { firstContentfulPaintMs: number | null; largestContentfulPaintMs: number | null };
    };
    return target.__ikimonMapPerf ?? { firstContentfulPaintMs: null, largestContentfulPaintMs: null };
  });

  const summary: MapPerfSummary = {
    domContentLoadedMs,
    firstMapApi,
    firstMapTile,
    lcpMs: paintMetrics.largestContentfulPaintMs,
    mapCanvasVisibleMs,
    path: DEFAULT_STAGING_MAP_PATH,
    profile: profile.slug,
  };
  console.info(`map-performance ${JSON.stringify(summary)}`);
  await context.close();
  return summary;
}

for (const profile of MAP_PERFORMANCE_PROFILES) {
  test(`map initial load stays within the UX guardrail (${profile.slug})`, async ({ browser }) => {
    const summary = await waitForMapPerformanceSummary(browser, profile);
    expect(summary.domContentLoadedMs).toBeLessThan(MAP_LOAD_BUDGET_MS.domContentLoaded);
    expect(summary.mapCanvasVisibleMs).toBeLessThan(MAP_LOAD_BUDGET_MS.mapCanvasVisible);
    expect(summary.firstMapApi?.ms ?? Number.POSITIVE_INFINITY).toBeLessThan(MAP_LOAD_BUDGET_MS.firstMapApi);
    expect(summary.firstMapTile?.ms ?? Number.POSITIVE_INFINITY).toBeLessThan(MAP_LOAD_BUDGET_MS.firstMapTile);
    if (summary.lcpMs !== null) {
      expect(summary.lcpMs).toBeLessThan(MAP_LOAD_BUDGET_MS.lcpWhenAvailable);
    }
  });
}
