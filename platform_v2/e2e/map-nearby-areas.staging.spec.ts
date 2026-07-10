import { test, expect, type Browser, type Page, type Route } from "@playwright/test";
import {
  installMapLibreStubForSmoke,
  stagingContextOptions,
  suppressMapLibreForSmoke,
  type ViewportProfile,
} from "./support/staging.js";

test.describe.configure({ retries: 0, timeout: 45_000 });

const VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 1000 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const AREA_COLLECTION = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [137.7018, 34.6976],
          [137.7046, 34.6976],
          [137.7046, 34.6994],
          [137.7018, 34.6994],
          [137.7018, 34.6976],
        ]],
      },
      properties: {
        field_id: "osm_park:nearby-public",
        source: "osm_park",
        name: "西伊場一条公園",
        access: "public",
        source_confidence: 0.9,
        area_ha: 2.1,
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [137.706, 34.699],
          [137.708, 34.699],
          [137.708, 34.701],
          [137.706, 34.701],
          [137.706, 34.699],
        ]],
      },
      properties: {
        field_id: "school:nearby-school",
        source: "school",
        name: "近くの学校",
        access: "restricted",
        source_confidence: 0.8,
        area_ha: 3.5,
      },
    },
  ],
};

const PUBLIC_AREA_SNAPSHOT = {
  field: {
    fieldId: "osm_park:nearby-public",
    name: "西伊場一条公園",
    sourceLabel: "公園・緑地",
    locationLabel: "静岡周辺",
    access: "public",
    sourceConfidence: 0.92,
    verificationLevel: "registry_matched",
    verificationLabel: "公式情報で確認",
    areaHa: 2.1,
    accessGuidance: {
      status: "public_access",
      label: "公開範囲を確認",
      body: "公開されている範囲でも、現地の案内板と管理者のルールを優先してください。",
    },
  },
  observationSummary: {
    totalObservations: 0,
    totalVisits: 0,
    uniqueTaxa: 0,
    seasonsCovered: 0,
    topTaxa: [],
  },
  yearlyTimeline: [],
  effortIndicators: null,
  sensitiveMasking: null,
  representativePhoto: null,
  observationGallery: [],
  seasonalCoverage: [
    { season: "spring", label: "春", observations: 0 },
    { season: "summer", label: "夏", observations: 0 },
    { season: "autumn", label: "秋", observations: 0 },
    { season: "winter", label: "冬", observations: 0 },
  ],
  viewerContribution: null,
  communityPerspective: null,
  overlapInsight: null,
  civicReportReadiness: {
    status: "story_seed",
    surfaceLine: "写真とメモが増えると、場所の状態を説明しやすくなります。",
    publicStoryReady: { ready: false },
    municipalReportReady: { ready: false },
    nextActions: ["公開範囲で写真を1枚追加", "季節が分かるメモを追加"],
    exportFormats: ["CSV", "PDF"],
  },
};

async function fulfillJson(route: Route, payload: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload),
  });
}

async function installMapFixtures(page: Page): Promise<void> {
  await installMapLibreStubForSmoke(page);
  await suppressMapLibreForSmoke(page);
  await page.route("**/api/v1/map/area-polygons**", async (route) => {
    await fulfillJson(route, AREA_COLLECTION);
  });
  await page.route("**/api/v1/fields/**/area-snapshot", async (route) => {
    await fulfillJson(route, { snapshot: PUBLIC_AREA_SNAPSHOT });
  });
  await page.route("**/api/v1/map/cells**", async (route) => {
    await fulfillJson(route, { type: "FeatureCollection", features: [], stats: { totalReturned: 0, totalAll: 0 } });
  });
  await page.route("**/api/v1/map/observations**", async (route) => {
    await fulfillJson(route, { items: [], stats: { totalReturned: 0, totalAll: 0 } });
  });
  await page.route("**/api/v1/map/frontier**", async (route) => {
    await fulfillJson(route, { type: "FeatureCollection", features: [], stats: { totalReturned: 0, totalAll: 0 } });
  });
  await page.route("**/api/v1/map/guide-spots**", async (route) => {
    await fulfillJson(route, { type: "FeatureCollection", features: [] });
  });
  await page.route("**/api/v1/map/effort-summary**", async (route) => {
    await fulfillJson(route, { status: "ok", totals: { records: 0, visits: 0, contributors: 0, minutes: 0 } });
  });
  await page.route("**/api/v1/map/site-brief**", async (route) => {
    await fulfillJson(route, { ok: false, error: "qa_fixture_no_site_brief" });
  });
}

async function newGeolocatedPage(browser: Browser, profile: ViewportProfile): Promise<Page> {
  const context = await browser.newContext(stagingContextOptions({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    geolocation: { longitude: 137.7032, latitude: 34.6983 },
    locale: "ja-JP",
    serviceWorkers: "block",
  }));
  await context.grantPermissions(["geolocation"]);
  return context.newPage();
}

for (const profile of VIEWPORTS) {
  test(`locate highlights nearby discoverable area entries (${profile.slug})`, async ({ browser }) => {
    const page = await newGeolocatedPage(browser, profile);
    await installMapFixtures(page);
    const response = await page.goto("/ja/map?tab=places&lng=137.7032&lat=34.6983&z=14.9", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.locator("#map-explorer canvas[data-maplibre-smoke-stub='1']")).toBeVisible();

    await page.locator("#me-locate-fab").click();
    await expect(page.locator(".me-nearby-area-marker")).toHaveCount(2);
    await expect(page.locator(".me-nearby-area-marker.is-public")).toContainText("西伊場一条公園");
    await expect(page.locator(".me-nearby-area-marker.is-school")).toContainText("近くの学校");
    await expect(page.locator("#me-map-status")).toContainText("現在地の近くで 2 件のエリア");

    await page.locator(".me-nearby-area-marker.is-public").evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    });
    const areaSurface = profile.isMobile
      ? page.locator("#me-bottom-sheet.me-bottom-sheet--area")
      : page.locator("#me-map-selection-card .me-detail-panel-area");
    await expect(areaSurface).toBeVisible();
    await expect(areaSurface).toContainText("散策シート");
    await expect(areaSurface).toContainText("歩く・見る・残す");
    const recordCta = areaSurface.locator(".me-area-next-step-cta").first();
    await expect(recordCta).toHaveAttribute("href", /\/ja\/record\?context=area_route&source=map_area$/);
    await recordCta.scrollIntoViewIfNeeded();
    await recordCta.click();
    await expect(page).toHaveURL(/\/ja\/record\?context=area_route&source=map_area$/);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.context().close();
  });
}
