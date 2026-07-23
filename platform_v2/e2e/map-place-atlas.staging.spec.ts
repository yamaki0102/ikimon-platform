import { test, expect, type Browser, type Page, type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  installMapLibreStubForSmoke,
  stagingContextOptions,
  suppressMapLibreForSmoke,
  type ViewportProfile,
} from "./support/staging.js";

test.describe.configure({ retries: 0, timeout: 60_000 });

const TOKIWA_FIELD_ID = "d50678d0-ba57-4d3d-a713-2fe441d646ab";
const TOKIWA_MAP_PATH = process.env.PLACE_ATLAS_QA_CANONICAL_ROUTE === "1"
  ? "/ja/map?tab=places&lng=138.3805&lat=34.9702&z=16.4"
  : "/map?tab=places&lng=138.3805&lat=34.9702&z=16.4";
const LOCAL_PLACE_ATLAS_BASE_URL = process.env.PLACE_ATLAS_QA_CANONICAL_ROUTE === "1"
  ? null
  : "http://127.0.0.1:4322";
const VISUAL_EVIDENCE_DIR = path.resolve(
  process.cwd(),
  "../docs/spec/universal-place-atlas/evidence/visual-qa/local",
);
type PageDiagnostics = {
  pageErrors: string[];
  consoleErrors: string[];
  criticalResponses: string[];
};
const PAGE_DIAGNOSTICS = new WeakMap<Page, PageDiagnostics>();

function monitorPageDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = {
    pageErrors: [],
    consoleErrors: [],
    criticalResponses: [],
  };
  PAGE_DIAGNOSTICS.set(page, diagnostics);
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Failed to load resource|ERR_ABORTED|blockedbyclient/i.test(text)) return;
    diagnostics.consoleErrors.push(text);
  });
  page.on("response", (response) => {
    if (response.status() < 500) return;
    if (!/\/api\/v1\/map\/(?:place-profile|place-search|area-polygons)/.test(response.url())) return;
    diagnostics.criticalResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  return diagnostics;
}

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
    verificationStatus: "source_verified",
    officialStatus: "official",
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
  policy: {
    placeVisibility: "public",
    recordingPolicy: "allowed",
    publicLocationMode: "place",
    contributionCtaMode: "record",
    ruleSource: "administrator",
    ruleUrl: null,
    reason: "qa_verified_public_park",
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

async function installPlaceAtlasFixtures(
  page: Page,
  placeProfile: typeof TOKIWA_PLACE_ATLAS_PROFILE | Record<string, unknown> = TOKIWA_PLACE_ATLAS_PROFILE,
): Promise<void> {
  await installMapLibreStubForSmoke(page);
  await suppressMapLibreForSmoke(page);
  await page.route(/\/(?:uploads\/qa-place-atlas|derived-transform\/).*/, async (route) => {
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
      profile: placeProfile,
    });
  });
}

async function openTokiwaPlaceAtlas(
  browser: Browser,
  profile: ViewportProfile,
  placeProfile: typeof TOKIWA_PLACE_ATLAS_PROFILE | Record<string, unknown> = TOKIWA_PLACE_ATLAS_PROFILE,
): Promise<Page> {
  const context = await browser.newContext(stagingContextOptions({
    ...(LOCAL_PLACE_ATLAS_BASE_URL ? { baseURL: LOCAL_PLACE_ATLAS_BASE_URL } : {}),
    viewport: profile.viewport,
    ...(browser.browserType().name() === "firefox"
      ? {}
      : {
          isMobile: profile.isMobile,
          hasTouch: profile.hasTouch,
        }),
    locale: "ja-JP",
    geolocation: { longitude: 138.3805, latitude: 34.9702 },
    serviceWorkers: "block",
  }));
  await context.grantPermissions(["geolocation"]);
  const page = await context.newPage();
  monitorPageDiagnostics(page);
  await installPlaceAtlasFixtures(page, placeProfile);
  const response = await page.goto(TOKIWA_MAP_PATH, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0).toBeLessThan(400);
  if (TOKIWA_MAP_PATH.startsWith("/map?")) {
    const responseHtml = await response?.text() ?? "";
    expect({
      responseUrl: response?.url(),
      hasPolicyRenderer: responseHtml.includes("function renderAtlasPolicy"),
      hasThemeRuntime: responseHtml.includes("data-place-atlas-theme"),
      nativeRuntimeHeader: response?.headers()["x-ikimon-cloudflare-native"] ?? null,
    }).toEqual({
      responseUrl: expect.stringContaining("/map?"),
      hasPolicyRenderer: true,
      hasThemeRuntime: true,
      nativeRuntimeHeader: null,
    });
  }
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
    await expect.poll(async () =>
      atlas.locator("[data-place-atlas-image]").first().evaluate((image) =>
        image instanceof HTMLImageElement ? image.naturalWidth : 0
      )
    ).toBeGreaterThan(0);
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

    await mkdir(VISUAL_EVIDENCE_DIR, { recursive: true });
    const screenshot = await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: path.join(
        VISUAL_EVIDENCE_DIR,
        `${testInfo.project.name}-${profile.slug}.png`,
      ),
    });
    await testInfo.attach(`map-place-atlas-${profile.slug}`, {
      body: screenshot,
      contentType: "image/png",
    });
    expect(PAGE_DIAGNOSTICS.get(page)).toEqual({
      pageErrors: [],
      consoleErrors: [],
      criticalResponses: [],
    });
    await page.context().close();
  });
}

test("place atlas API failure leaves the map usable", async ({ browser }) => {
  const profile = PLACE_ATLAS_VIEWPORTS.find((item) => item.slug === "mobile-390")!;
  const context = await browser.newContext(stagingContextOptions({
    ...(LOCAL_PLACE_ATLAS_BASE_URL ? { baseURL: LOCAL_PLACE_ATLAS_BASE_URL } : {}),
    viewport: profile.viewport,
    ...(browser.browserType().name() === "firefox"
      ? {}
      : {
          isMobile: true,
          hasTouch: true,
        }),
    locale: "ja-JP",
    geolocation: { longitude: 138.3805, latitude: 34.9702 },
    serviceWorkers: "block",
  }));
  await context.grantPermissions(["geolocation"]);
  const page = await context.newPage();
  const diagnostics = monitorPageDiagnostics(page);
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
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.criticalResponses).toEqual(["503 /api/v1/map/place-profile"]);
  await mkdir(VISUAL_EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: path.join(VISUAL_EVIDENCE_DIR, `${test.info().project.name}-error-mobile-390.png`),
  });
  await context.close();
});

test("canonical alias search shows place kind, locality, and verified state", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser covers the search/API integration; layout runs in all browsers");
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4322",
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = monitorPageDiagnostics(page);
  await installPlaceAtlasFixtures(page);
  const profileRequests: string[] = [];
  await page.route("**/api/v1/map/place-profile**", async (route) => {
    profileRequests.push(route.request().url());
    await fulfillJson(route, {
      profile: {
        ...TOKIWA_PLACE_ATLAS_PROFILE,
        placeRef: {
          kind: "osm_area",
          entityKey: "osm:way:1281984233",
          osmType: "way",
          osmId: 1281984233,
        },
        place: {
          ...TOKIWA_PLACE_ATLAS_PROFILE.place,
          name: "JUNGLIA OKINAWA",
          type: "theme_park",
          localityLabel: "沖縄県国頭郡今帰仁村",
        },
        policy: {
          placeVisibility: "public",
          recordingPolicy: "permission_required",
          publicLocationMode: "place",
          contributionCtaMode: "suppressed",
          ruleSource: "official",
          ruleUrl: "https://junglia.jp/terms/park-termsofuse",
          reason: "verified_place_policy",
        },
        publication: {
          ...TOKIWA_PLACE_ATLAS_PROFILE.publication,
          status: "partial",
          suppressedSections: ["contribution_cta"],
        },
      },
    });
  });
  await page.route("**/api/v1/map/place-search**", async (route) => {
    await fulfillJson(route, {
      version: "place_search/v1",
      query: new URL(route.request().url()).searchParams.get("q"),
      state: "complete",
      privacy: "boundary_bbox_only",
      results: [{
        canonicalPlaceId: "plc_1dac5b52233720ee",
        canonicalName: "JUNGLIA OKINAWA",
        aliases: ["ジャングリア沖縄", "JUNGLIA"],
        placeKind: "theme_park",
        localityLabel: "沖縄県国頭郡今帰仁村",
        verificationStatus: "source_verified",
        officialStatus: "official",
        matchKind: "alias",
        matchConfidence: 0.98,
        osmSourceId: "way:1281984233",
        boundary: {
          bbox: [127.918, 26.662, 127.927, 26.672],
          precision: "exact",
          confidence: 0.9,
        },
        source: {
          sourceType: "facility_official",
          sourceId: "junglia:official",
          sourceUrl: "https://www.junglia.jp/en",
          confidence: 1,
          verificationStatus: "verified",
          lastCheckedAt: "2026-07-23T00:00:00Z",
        },
      }],
    });
  });
  await page.route("https://nominatim.openstreetmap.org/search**", async (route) => {
    await fulfillJson(route, []);
  });
  await page.goto(TOKIWA_MAP_PATH, { waitUntil: "domcontentloaded" });
  const input = page.locator("#me-search-input");
  await input.fill("ジャングリア");
  const result = page.locator("#me-search-results .me-search-row", { hasText: "JUNGLIA OKINAWA" });
  await expect(result).toBeVisible();
  await expect(result).toContainText("テーマパーク");
  await expect(result).toContainText("沖縄県国頭郡今帰仁村");
  await expect(result).toContainText("確認済み");
  await mkdir(VISUAL_EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: path.join(VISUAL_EVIDENCE_DIR, "chromium-search-junglia-mobile-390.png"),
  });
  await result.click();
  await expect(page.locator("#map-explorer")).toHaveAttribute(
    "data-place-search-profile-ref",
    "osm:way:1281984233",
  );
  await expect.poll(() => profileRequests.length).toBe(1);
  const atlas = page.locator("[data-place-atlas-profile]");
  await expect(atlas).toBeVisible();
  await expect(atlas.getByRole("heading", { name: "JUNGLIA OKINAWA" })).toBeVisible();
  await expect(
    atlas.locator('[data-kpi-action="map:place_atlas:record_here"]'),
  ).toHaveCount(0);
  const profileUrl = new URL(profileRequests[0]);
  expect(profileUrl.searchParams.get("kind")).toBe("osm_area");
  expect(profileUrl.searchParams.get("entityKey")).toBe("osm:way:1281984233");
  expect(profileUrl.searchParams.get("osmType")).toBe("way");
  expect(profileUrl.searchParams.get("osmId")).toBe("1281984233");
  expect(diagnostics).toEqual({
    pageErrors: [],
    consoleErrors: [],
    criticalResponses: [],
  });
  await context.close();
});

test("canonical search without a safe OSM area ref does not open a profile", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser covers the fail-closed search handoff");
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4322",
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = monitorPageDiagnostics(page);
  const profileRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/v1\/map\/place-profile\b/.test(request.url())) {
      profileRequests.push(request.url());
    }
  });
  await installPlaceAtlasFixtures(page);
  await page.route("**/api/v1/map/place-search**", async (route) => {
    await fulfillJson(route, {
      version: "place_search/v1",
      query: new URL(route.request().url()).searchParams.get("q"),
      state: "complete",
      privacy: "boundary_bbox_only",
      results: [{
        canonicalPlaceId: "plc_node_only",
        canonicalName: "ノード施設",
        aliases: [],
        placeKind: "other_named_area",
        localityLabel: "静岡県静岡市",
        verificationStatus: "source_verified",
        officialStatus: "unofficial",
        matchKind: "canonical_name",
        matchConfidence: 1,
        osmSourceId: "node:123456",
        boundary: {
          bbox: [138.37, 34.96, 138.38, 34.97],
          precision: "approximate",
          confidence: 0.5,
        },
        source: {
          sourceType: "osm",
          sourceId: "node:123456",
          sourceUrl: "https://www.openstreetmap.org/node/123456",
          confidence: 0.5,
          verificationStatus: "source_verified",
          lastCheckedAt: "2026-07-24T00:00:00Z",
        },
      }],
    });
  });
  await page.route("https://nominatim.openstreetmap.org/search**", async (route) => {
    await fulfillJson(route, []);
  });

  await page.goto(TOKIWA_MAP_PATH, { waitUntil: "domcontentloaded" });
  const input = page.locator("#me-search-input");
  await input.fill("ノード施設");
  const result = page.locator("#me-search-results .me-search-row", {
    hasText: "ノード施設",
  });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.locator("#map-explorer")).toHaveAttribute(
    "data-place-search-profile-ref",
    "unresolved",
  );
  await page.waitForTimeout(2_500);
  expect(profileRequests).toEqual([]);
  await expect(page.locator("[data-place-atlas-profile]")).toHaveCount(0);
  expect(diagnostics).toEqual({
    pageErrors: [],
    consoleErrors: [],
    criticalResponses: [],
  });
  await context.close();
});

test("verified restricted Place suppresses recording CTA and keeps browse access", async ({ browser }, testInfo) => {
  const restrictedProfile = {
    ...TOKIWA_PLACE_ATLAS_PROFILE,
    place: {
      ...TOKIWA_PLACE_ATLAS_PROFILE.place,
      name: "JUNGLIA OKINAWA",
      type: "theme_park",
      localityLabel: "沖縄県国頭郡今帰仁村",
      verificationStatus: "source_verified",
      officialStatus: "official",
    },
    policy: {
      placeVisibility: "public",
      recordingPolicy: "permission_required",
      publicLocationMode: "place",
      contributionCtaMode: "suppressed",
      ruleSource: "official",
      ruleUrl: "https://junglia.jp/terms/park-termsofuse",
      reason: "verified_place_policy",
    },
    publication: {
      ...TOKIWA_PLACE_ATLAS_PROFILE.publication,
      suppressedSections: ["contributors", "contribution_cta"],
    },
  };
  const viewport = PLACE_ATLAS_VIEWPORTS.find((item) => item.slug === "mobile-390")!;
  const page = await openTokiwaPlaceAtlas(browser, viewport, restrictedProfile);
  const atlas = page.locator("[data-place-atlas-profile]");
  await expect(atlas.getByRole("heading", { name: "JUNGLIA OKINAWA" })).toBeVisible();
  await expect(atlas.locator('[data-kpi-action="map:place_atlas:record_here"]')).toHaveCount(0);
  await page.locator("#me-bottom-grip").click();
  await expect(page.locator("#me-bottom-sheet")).toHaveAttribute("data-snap", "full");
  await expect(atlas.locator('[data-kpi-action="map:place_atlas:browse_records"]')).toBeVisible();
  await expect(atlas).toContainText("許可");
  await expect(atlas.getByRole("link", { name: /公式/ })).toHaveAttribute(
    "href",
    "https://junglia.jp/terms/park-termsofuse",
  );
  const policySection = atlas.locator(".me-place-atlas-policy");
  await policySection.scrollIntoViewIfNeeded();
  await expect(policySection).toBeVisible();
  const overlap = await page.evaluate(() => {
    const policy = document.querySelector<HTMLElement>(".me-place-atlas-policy")?.getBoundingClientRect();
    const launcher = document.querySelector<HTMLElement>(".global-record-launcher")?.getBoundingClientRect();
    if (!policy || !launcher) return 0;
    const width = Math.max(0, Math.min(policy.right, launcher.right) - Math.max(policy.left, launcher.left));
    const height = Math.max(0, Math.min(policy.bottom, launcher.bottom) - Math.max(policy.top, launcher.top));
    return Math.round(width * height);
  });
  expect(overlap).toBe(0);
  await mkdir(VISUAL_EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: path.join(VISUAL_EVIDENCE_DIR, `${testInfo.project.name}-restricted-mobile-390.png`),
  });
  await page.context().close();
});

test("theme cards are keyboard operable and image failures expose a fallback", async ({ browser }) => {
  const viewport = PLACE_ATLAS_VIEWPORTS.find((item) => item.slug === "desktop-1280")!;
  const page = await openTokiwaPlaceAtlas(browser, viewport);
  const runtimeEvidence = await page.evaluate(() => ({
    pathname: window.location.pathname,
    hasPolicyRenderer: Array.from(document.scripts).some((script) =>
      (script.textContent || "").includes("function renderAtlasPolicy")
    ),
    hasThemeRuntime: Array.from(document.scripts).some((script) =>
      (script.textContent || "").includes("data-place-atlas-theme")
    ),
  }));
  expect(runtimeEvidence).toEqual({
    pathname: "/map",
    hasPolicyRenderer: true,
    hasThemeRuntime: true,
  });
  const theme = page.locator(".me-place-atlas-facet").first();
  await expect(theme).toHaveAttribute("data-place-atlas-theme");
  await expect(theme).toHaveAttribute("role", "button");
  await theme.focus();
  await expect(theme).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  const focusStyle = await theme.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(focusStyle).not.toBe("none");

  const media = page.locator(".me-place-atlas-hero-media").first();
  const image = media.locator("[data-place-atlas-image]");
  await image.evaluate((element) => {
    if (!(element instanceof HTMLImageElement)) return;
    element.srcset = "";
    element.src = "/qa-place-atlas-intentional-missing.webp";
  });
  await expect(media).toHaveClass(/is-image-error/);
  await expect(media.locator(".me-place-atlas-image-fallback")).toBeVisible();
  await page.context().close();
});
