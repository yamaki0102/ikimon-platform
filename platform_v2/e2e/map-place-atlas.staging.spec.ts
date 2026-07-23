import { test, expect, type Browser, type Page, type Route } from "@playwright/test";
import {
  installMapLibreStubForSmoke,
  stagingContextOptions,
  suppressMapLibreForSmoke,
  type ViewportProfile,
} from "./support/staging.js";

test.describe.configure({ retries: 0, timeout: 60_000 });

const TOKIWA_FIELD_ID = "d50678d0-ba57-4d3d-a713-2fe441d646ab";
const TOKIWA_MAP_PATH = "/ja/map?tab=places&lng=138.3805&lat=34.9702&z=16.4";

const PLACE_ATLAS_VIEWPORTS: ViewportProfile[] = [
  { slug: "iphone-se-375", viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { slug: "tablet-768", viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
  { slug: "notebook-1024", viewport: { width: 1024, height: 768 } },
  { slug: "desktop-1280", viewport: { width: 1280, height: 800 } },
  { slug: "wide-1536", viewport: { width: 1536, height: 960 } },
];

const TOKIWA_AREA_COLLECTION = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [138.3768, 34.9669],
          [138.3841, 34.9669],
          [138.3841, 34.9736],
          [138.3768, 34.9736],
          [138.3768, 34.9669],
        ]],
      },
      properties: {
        field_id: TOKIWA_FIELD_ID,
        entity_key: "osm:way:125727939",
        osm_type: "way",
        osm_id: 125727939,
        source: "osm_park",
        source_label: "公園 (OSM)",
        name: "常磐公園",
        prefecture: "静岡県",
        city: "静岡市",
        localityLabel: "静岡県静岡市",
        access: "public",
        source_confidence: 0.95,
        verification_level: "registry_matched",
        area_ha: 6.2,
        center: [138.3805, 34.9702],
        transient: false,
      },
    },
  ],
  stats: { totalReturned: 1, totalAll: 1 },
};

const TOKIWA_PLACE_ATLAS_PROFILE = {
  version: 1,
  placeRef: { kind: "field", fieldId: TOKIWA_FIELD_ID },
  place: {
    name: "常磐公園",
    type: "公園",
    localityLabel: "静岡県静岡市",
    description: "公開Recordと地域の案内を、場所を主語にまとめた地域図鑑です。",
    representativeMedia: [
      {
        url: "/uploads/qa-place-atlas/tokiwa-park.jpg",
        recordId: "qa-tokiwa-record-001",
        observedAt: "2026-07-20T08:00:00.000Z",
        kind: "photo",
      },
    ],
  },
  summary: {
    recordCount: 3,
    contributorCount: null,
    firstRecordedAt: "2026-04-01T08:00:00.000Z",
    latestRecordedAt: "2026-07-20T08:00:00.000Z",
  },
  facets: [
    {
      key: "nature",
      label: "自然・生きもの",
      count: 2,
      representativeMediaUrl: "/uploads/qa-place-atlas/tokiwa-park.jpg",
    },
    { key: "scenery", label: "風景・季節", count: 1 },
    { key: "daily_life", label: "過ごし方", count: 1 },
    { key: "facility", label: "場所・施設", count: 1 },
  ],
  highlights: [
    {
      kind: "recent_activity",
      text: "最近90日以内に記録が追加されています",
      evidenceCount: 2,
      sourceLabel: "公開Recordの記録日",
      confidence: "confirmed",
    },
    {
      kind: "dominant_theme",
      text: "自然・生きものの記録が多い場所です",
      evidenceCount: 2,
      sourceLabel: "公開Recordの閲覧用テーマ",
      confidence: "derived",
    },
  ],
  recentRecords: [
    {
      recordId: "qa-tokiwa-record-001",
      observedAt: "2026-07-20T08:00:00.000Z",
      displayName: "夏の樹木",
      href: "/records/qa-tokiwa-record-001",
      mediaUrl: "/uploads/qa-place-atlas/tokiwa-park.jpg",
      mediaKind: "photo",
      taxonGroup: "plant",
      themes: ["nature", "scenery"],
      identificationStatus: "confirmed",
    },
    {
      recordId: "qa-tokiwa-record-002",
      observedAt: "2026-06-11T08:00:00.000Z",
      displayName: "園路の風景",
      href: "/records/qa-tokiwa-record-002",
      mediaUrl: "/uploads/qa-place-atlas/tokiwa-walk.jpg",
      mediaKind: "photo",
      taxonGroup: null,
      themes: ["scenery", "daily_life", "facility"],
      identificationStatus: "unknown",
    },
    {
      recordId: "qa-tokiwa-record-003",
      observedAt: "2026-04-01T08:00:00.000Z",
      displayName: "名前を調べている生きもの",
      href: "/records/qa-tokiwa-record-003",
      mediaUrl: null,
      mediaKind: "record",
      taxonGroup: "insect",
      themes: ["nature"],
      identificationStatus: "ai_candidate",
    },
  ],
  guide: {
    title: "常磐公園を歩く",
    preview: "園内の公開範囲を歩きながら、季節の変化を見つけます。",
    sourceLinks: [{ label: "公開案内", url: "https://example.com/tokiwa-guide" }],
  },
  memories: [{ echoNote: "散歩の途中で季節の変化を見つけた場所" }],
  facilities: [{ kind: "path", label: "園路" }],
  dataGaps: [
    {
      key: "audio_visual",
      label: "音・映像",
      reason: "音風景や短い動画は、これから残せます。",
    },
  ],
  publication: {
    status: "published",
    suppressedSections: ["contributors"],
    locationMode: "field",
  },
  provenance: {
    generatedAt: "2026-07-23T00:00:00.000Z",
    profileVersion: "place_atlas_profile/v1",
    sources: [
      "observation_fields",
      "public_map_snapshot",
      "field_public_profile_policy",
      "map_guide_spots",
      "place_memory",
    ],
  },
};

const EMPTY_COLLECTION = {
  type: "FeatureCollection",
  features: [],
  stats: { totalReturned: 0, totalAll: 0 },
};

async function fulfillJson(route: Route, payload: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload),
  });
}

async function installPlaceAtlasFixtures(page: Page): Promise<void> {
  await installMapLibreStubForSmoke(page);
  await suppressMapLibreForSmoke(page);
  await page.route("**/uploads/qa-place-atlas/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml; charset=utf-8",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#376d4c"/><stop offset="1" stop-color="#d7ab58"/></linearGradient></defs><rect width="960" height="600" fill="url(#g)"/><circle cx="220" cy="150" r="130" fill="#8fbc79" opacity=".75"/><path d="M0 500 C240 390 430 560 680 430 C800 370 900 380 960 410 V600 H0Z" fill="#244b38" opacity=".72"/></svg>`,
    });
  });
  await page.route("**/api/v1/map/area-polygons**", async (route) => {
    await fulfillJson(route, TOKIWA_AREA_COLLECTION);
  });
  await page.route("**/api/v1/map/cells**", async (route) => {
    await fulfillJson(route, EMPTY_COLLECTION);
  });
  await page.route("**/api/v1/map/observations**", async (route) => {
    await fulfillJson(route, {
      items: [],
      stats: { totalReturned: 0, totalAll: 0, markerProfile: "all_research_artifacts" },
    });
  });
  await page.route("**/api/v1/map/my-observations**", async (route) => {
    await fulfillJson(route, { signedIn: false, items: [] });
  });
  await page.route("**/api/v1/me/map-observations**", async (route) => {
    await fulfillJson(route, { signedIn: false, items: [] });
  });
  await page.route("**/api/v1/map/frontier**", async (route) => {
    await fulfillJson(route, EMPTY_COLLECTION);
  });
  await page.route("**/api/v1/map/guide-spots**", async (route) => {
    await fulfillJson(route, EMPTY_COLLECTION);
  });
  await page.route("**/api/v1/map/effort-summary**", async (route) => {
    await fulfillJson(route, {
      status: "ok",
      totals: { records: 0, visits: 0, contributors: 0, minutes: 0 },
      frontierRemaining: {},
    });
  });
  await page.route("**/api/v1/map/site-brief**", async (route) => {
    await fulfillJson(route, { ok: false, error: "qa_fixture_no_site_brief" });
  });
  await page.route("**/api/v1/fields/**/area-snapshot**", async (route) => {
    await fulfillJson(route, { ok: false, error: "qa_fixture_legacy_snapshot_unlinked" }, 404);
  });
  await page.route("**/api/v1/map/place-profile**", async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("kind")).toBe("field");
    expect(url.searchParams.get("fieldId")).toBe(TOKIWA_FIELD_ID);
    expect(url.searchParams.has("lat")).toBe(false);
    expect(url.searchParams.has("lng")).toBe(false);
    await fulfillJson(route, {
      ok: true,
      profile: TOKIWA_PLACE_ATLAS_PROFILE,
    });
  });
}

async function openTokiwaPlaceAtlas(browser: Browser, profile: ViewportProfile): Promise<Page> {
  const context = await browser.newContext(stagingContextOptions({
    viewport: profile.viewport,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    locale: "ja-JP",
    geolocation: { longitude: 138.3805, latitude: 34.9702 },
    serviceWorkers: "block",
  }));
  await context.grantPermissions(["geolocation"]);
  const page = await context.newPage();
  await installPlaceAtlasFixtures(page);
  const response = await page.goto(TOKIWA_MAP_PATH, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0).toBeLessThan(400);
  await expect(page.locator("[data-maplibre-smoke-stub='1']")).toBeVisible();
  await expect.poll(async () => {
    return page.evaluate(() => {
      const source = (window as any).__ikimonMapSmokeLastMap?.getSource?.("area-polygons");
      return Array.isArray(source?.data?.features) ? source.data.features.length : 0;
    });
  }).toBe(1);
  await page.locator("#me-locate-fab").click();
  const marker = page.locator(".me-nearby-area-marker", { hasText: "常磐公園" });
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page.locator("[data-place-atlas-profile]")).toBeVisible();
  return page;
}

for (const profile of PLACE_ATLAS_VIEWPORTS) {
  test(`place atlas is usable without overflow (${profile.slug})`, async ({ browser }, testInfo) => {
    const page = await openTokiwaPlaceAtlas(browser, profile);
    const atlas = page.locator("[data-place-atlas-profile]");
    await expect(atlas.getByRole("heading", { name: "常磐公園" })).toBeVisible();
    await expect(atlas).toContainText("公開Record");
    await expect(atlas).toContainText("3");
    await expect(atlas).not.toContainText("まだ記録はありません");
    await expect(atlas.locator("[data-place-atlas-image]").first()).toBeVisible();
    await expect(atlas.locator('[data-kpi-action="map:place_atlas:record_here"]')).toHaveAttribute("href", /\/record/);
    await expect(atlas.locator('[data-kpi-action="map:place_atlas:browse_records"]')).toHaveAttribute("href", /\/records/);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const sheet = page.locator("#me-bottom-sheet");
    if (profile.viewport.width <= 900) {
      await expect(sheet).toHaveAttribute("data-snap", "peek");
      await expect(sheet).toHaveAttribute("aria-hidden", "false");
      await expect(atlas.getByText("地域図鑑のテーマ")).toBeHidden();
      const touchTargets = await page.evaluate(() => {
        const size = (selector: string) => {
          const box = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
          return { width: box?.width ?? 0, height: box?.height ?? 0 };
        };
        return {
          close: size("#me-bottom-close"),
          grip: size("#me-bottom-grip"),
        };
      });
      expect(touchTargets.close.width).toBeGreaterThanOrEqual(44);
      expect(touchTargets.close.height).toBeGreaterThanOrEqual(44);
      expect(touchTargets.grip.width).toBeGreaterThanOrEqual(44);
      expect(touchTargets.grip.height).toBeGreaterThanOrEqual(44);
      await page.locator("#me-bottom-grip").click();
      await expect(sheet).toHaveAttribute("data-snap", "full");
      await expect(atlas.getByText("地域図鑑のテーマ")).toBeVisible();
      await expect(page.locator("#me-bottom-close")).toHaveAttribute("aria-label");
    } else {
      await expect(sheet).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator(".me-side-pane-selection [data-place-atlas-profile]")).toBeVisible();
      await expect(atlas.getByText("地域図鑑のテーマ")).toBeVisible();
    }

    await testInfo.attach(`map-place-atlas-${profile.slug}`, {
      body: await page.screenshot({ animations: "disabled", fullPage: true }),
      contentType: "image/png",
    });
    await page.context().close();
  });
}

test("place atlas API failure leaves the map usable", async ({ browser }) => {
  const profile = PLACE_ATLAS_VIEWPORTS.find((item) => item.slug === "mobile-390")!;
  const context = await browser.newContext(stagingContextOptions({
    viewport: profile.viewport,
    isMobile: true,
    hasTouch: true,
    locale: "ja-JP",
    geolocation: { longitude: 138.3805, latitude: 34.9702 },
    serviceWorkers: "block",
  }));
  await context.grantPermissions(["geolocation"]);
  const page = await context.newPage();
  await installPlaceAtlasFixtures(page);
  await page.route("**/api/v1/map/place-profile**", async (route) => {
    await fulfillJson(route, { ok: false, error: "place_profile_unavailable" }, 503);
  });
  await page.goto(TOKIWA_MAP_PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-maplibre-smoke-stub='1']")).toBeVisible();
  await page.locator("#me-locate-fab").click();
  await page.locator(".me-nearby-area-marker", { hasText: "常磐公園" }).click();
  await expect(page.locator('[data-place-atlas-state="error"]')).toBeVisible();
  await expect(page.locator("[data-maplibre-smoke-stub='1']")).toBeVisible();
  await expect(page.locator("#me-bottom-close")).toBeVisible();
  await context.close();
});
