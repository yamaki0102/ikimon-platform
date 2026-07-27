import { createHash } from "node:crypto";
import { test, expect, type Browser, type Page, type Route } from "@playwright/test";
import {
  installMapLibreStubForSmoke,
  stagingContextOptions,
  suppressMapLibreForSmoke,
} from "./support/staging.js";

const STAGING_BASE_URL = process.env.STAGING_BASE_URL ?? "https://staging.ikimon.life";
const STAGING_ORIGIN = new URL(STAGING_BASE_URL).origin;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const FIELD_ID = "d50678d0-ba57-4d3d-a713-2fe441d646ab";

const LOCALES = [
  { path: "/ja/map", lang: "ja-JP", timeline: "この場所のうつろい", multiple: "複数の時期の記録", sampled: "公開記録からの標本表示", verified: "確認済み", candidate: "候補", unknown: "未確認", capture: "今を撮る" },
  { path: "/en/map", lang: "en-US", timeline: "This place over time", multiple: "Records from multiple periods", sampled: "Sample of public records", verified: "Verified", candidate: "Candidate", unknown: "Unknown", capture: "Capture now" },
  { path: "/es/map", lang: "es-ES", timeline: "Este lugar a través del tiempo", multiple: "Registros de varios periodos", sampled: "Muestra de registros públicos", verified: "Verificado", candidate: "Candidato", unknown: "Sin confirmar", capture: "Capturar ahora" },
  { path: "/pt-br/map", lang: "pt-BR", timeline: "Este lugar ao longo do tempo", multiple: "Registros de vários períodos", sampled: "Amostra de registros públicos", verified: "Verificado", candidate: "Candidato", unknown: "Não confirmado", capture: "Registrar agora" },
] as const;

const EXPECTED_MAP_HASHES = parseExpectedMapHashes();

const AREA_COLLECTION = {
  type: "FeatureCollection",
  features: [{
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
      field_id: FIELD_ID,
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
  }],
  stats: { totalReturned: 1, totalAll: 1 },
};

const BASE_PROFILE = {
  version: 1,
  placeRef: { kind: "field", fieldId: FIELD_ID },
  place: {
    name: "常磐公園",
    type: "公園",
    localityLabel: "静岡県静岡市",
    description: "公開Recordと地域の案内を、場所を主語にまとめた地域図鑑です。",
    verificationStatus: "source_verified",
    officialStatus: "official",
    representativeMedia: [{
      url: "/uploads/qa-place-atlas/tokiwa-park.jpg",
      recordId: "qa-tokiwa-record-001",
      observedAt: "2026-07-20T08:00:00.000Z",
      kind: "photo",
    }],
  },
  summary: {
    recordCount: 3,
    contributorCount: null,
    firstRecordedAt: "2026-04-01T08:00:00.000Z",
    latestRecordedAt: "2026-07-20T08:00:00.000Z",
  },
  timelineProjection: {
    version: 1,
    state: "timeline",
    summaryKey: "multiple_observation_periods",
    changeAssessment: "not_assessed",
    recordCount: 3,
    totalRecordCount: 6,
    sampled: true,
    distinctPeriodCount: 2,
    oldestObservedAt: "2025-04-01T08:00:00.000Z",
    latestObservedAt: "2026-07-20T08:00:00.000Z",
    recordingSuggestion: "revisit",
    publicationStatus: "published",
    excluded: {},
    periods: [
      {
        periodKey: "2025-04-01",
        observedDate: "2025-04-01",
        items: [{
          recordId: "timeline-hidden-old",
          observedAt: "2025-04-01T08:00:00.000Z",
          observedDate: "2025-04-01",
          displayLabel: "春の若葉",
          publicMediaUrl: "/uploads/qa-place-atlas/tokiwa-spring.jpg",
          sourceKind: "public_record",
          verificationState: "unverified",
          identificationStatus: "awaiting_identification",
          href: "/ja/observations/tokiwa-spring",
          mediaKind: "photo",
          owner: "timeline-hidden-owner",
          poster: "timeline-hidden-poster",
          exactLat: "timeline-hidden-lat",
          exactLng: "timeline-hidden-lng",
          cell: "timeline-hidden-cell",
        }],
      },
      {
        periodKey: "2026-07-20",
        observedDate: "2026-07-20",
        items: [
          {
            recordId: "timeline-hidden-candidate",
            observedAt: "2026-07-18T08:00:00.000Z",
            observedDate: "2026-07-18",
            displayLabel: "夏の昆虫候補",
            publicMediaUrl: "javascript:alert(1)",
            sourceKind: "public_record",
            verificationState: "candidate",
            identificationStatus: "ai_candidate",
            href: "https://unsafe.example/timeline-hidden-href",
            mediaKind: "photo",
            contributor: "timeline-hidden-contributor",
          },
          {
            recordId: "timeline-hidden-verified",
            observedAt: "2026-07-20T08:00:00.000Z",
            observedDate: "2026-07-20",
            displayLabel: "夏の樹木",
            publicMediaUrl: "/uploads/qa-place-atlas/tokiwa-park.jpg",
            sourceKind: "public_record",
            verificationState: "verified",
            identificationStatus: "confirmed",
            href: "/ja/observations/tokiwa-summer",
            mediaKind: "photo",
          },
        ],
      },
    ],
  },
  facets: [{ key: "nature", label: "自然・生きもの", count: 2 }],
  highlights: [{
    kind: "recent_activity",
    text: "最近90日以内に記録が追加されています",
    evidenceCount: 2,
    sourceLabel: "公開Recordの記録日",
    confidence: "confirmed",
  }],
  recentRecords: [],
  guide: null,
  memories: [],
  facilities: [],
  dataGaps: [],
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
    sources: ["observation_fields", "public_map_snapshot"],
  },
};

type RuntimeSession = {
  page: Page;
  mutationEvents: string[];
};

function parseExpectedMapHashes(): Record<string, string> {
  const raw = process.env.UTSUROU_EXPECTED_MAP_SHA256_BY_PATH;
  if (!raw) throw new Error("UTSUROU_EXPECTED_MAP_SHA256_BY_PATH is required");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("UTSUROU_EXPECTED_MAP_SHA256_BY_PATH must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("UTSUROU_EXPECTED_MAP_SHA256_BY_PATH must be an object");
  }
  const result: Record<string, string> = {};
  for (const locale of LOCALES) {
    const value = String((parsed as Record<string, unknown>)[locale.path] ?? "");
    if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error(`missing expected map SHA for ${locale.path}`);
    result[locale.path] = value;
  }
  return result;
}

async function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload),
  });
}

async function installRuntimeFixtures(page: Page, profile: Record<string, unknown>, mutations: string[]): Promise<void> {
  await installMapLibreStubForSmoke(page);
  await suppressMapLibreForSmoke(page);
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (!SAFE_METHODS.has(method)) {
      if (url.origin === STAGING_ORIGIN && /^\/api\/v1\/ui-kpi\/events\/?$/u.test(url.pathname)) {
        mutations.push(`${method} ${url.pathname}`);
        await fulfillJson(route, 202, { ok: true });
        return;
      }
      mutations.push(`${method} ${url.origin}${url.pathname}`);
      await fulfillJson(route, 409, { ok: false, error: "utsurou_runtime_unknown_mutation_rejected" });
      return;
    }

    if (/\/(?:uploads\/qa-place-atlas|derived-transform)\//u.test(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml; charset=utf-8",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" fill="#4f765f"/></svg>',
      });
      return;
    }

    if (url.origin === STAGING_ORIGIN && url.pathname === "/api/v1/map/area-polygons") {
      await fulfillJson(route, 200, AREA_COLLECTION);
      return;
    }
    if (url.origin === STAGING_ORIGIN && url.pathname === "/api/v1/map/place-profile") {
      expect(url.searchParams.get("kind")).toBe("field");
      expect(url.searchParams.get("fieldId")).toBe(FIELD_ID);
      expect(url.searchParams.has("lat")).toBe(false);
      expect(url.searchParams.has("lng")).toBe(false);
      await fulfillJson(route, 200, { ok: true, profile });
      return;
    }
    if (url.origin === STAGING_ORIGIN && url.pathname === "/api/v1/map/effort-summary") {
      await fulfillJson(route, 200, { status: "ok", totals: { records: 0, visits: 0, contributors: 0, minutes: 0 }, frontierRemaining: {} });
      return;
    }
    if (url.origin === STAGING_ORIGIN && url.pathname === "/api/v1/map/site-brief") {
      await fulfillJson(route, 404, { ok: false, error: "qa_fixture_no_site_brief" });
      return;
    }
    if (url.origin === STAGING_ORIGIN && /\/api\/v1\/fields\/[^/]+\/area-snapshot$/u.test(url.pathname)) {
      await fulfillJson(route, 404, { ok: false, error: "qa_fixture_no_snapshot" });
      return;
    }
    if (url.origin === STAGING_ORIGIN && new Set([
      "/api/v1/map/cells",
      "/api/v1/map/frontier",
      "/api/v1/map/guide-spots",
    ]).has(url.pathname)) {
      await fulfillJson(route, 200, { type: "FeatureCollection", features: [], stats: { totalReturned: 0, totalAll: 0 } });
      return;
    }
    if (url.origin === STAGING_ORIGIN && url.pathname === "/api/v1/map/observations") {
      await fulfillJson(route, 200, { items: [], stats: { totalReturned: 0, totalAll: 0, markerProfile: "all_research_artifacts" } });
      return;
    }
    if (url.origin === STAGING_ORIGIN && new Set([
      "/api/v1/map/my-observations",
      "/api/v1/me/map-observations",
    ]).has(url.pathname)) {
      await fulfillJson(route, 200, { signedIn: false, items: [] });
      return;
    }
    if (url.hostname === "nominatim.openstreetmap.org") {
      await fulfillJson(route, 200, []);
      return;
    }

    await route.fallback();
  });
}

async function openProfile(browser: Browser, localePath: string, locale: string, profile: Record<string, unknown>): Promise<RuntimeSession> {
  const context = await browser.newContext(stagingContextOptions({
    baseURL: STAGING_BASE_URL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale,
    geolocation: { longitude: 138.3805, latitude: 34.9702 },
    serviceWorkers: "block",
  }));
  await context.grantPermissions(["geolocation"]);
  const page = await context.newPage();
  const mutations: string[] = [];
  await installRuntimeFixtures(page, profile, mutations);
  const url = `${localePath}?tab=places&lng=138.3805&lat=34.9702&z=16.4&utsurou_runtime_qa=${encodeURIComponent(process.env.IKIMON_EXPECTED_GIT_SHA ?? "unknown")}`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0).toBeLessThan(400);
  expect(response?.headers()["x-ikimon-cloudflare-materialized"]).toBe("original-ui-html");
  expect(String(response?.headers()["cf-cache-status"] ?? "").toUpperCase()).not.toBe("HIT");
  const body = await response?.body();
  expect(createHash("sha256").update(body ?? Buffer.alloc(0)).digest("hex")).toBe(EXPECTED_MAP_HASHES[localePath]);
  await expect(page.locator("[data-maplibre-smoke-stub='1']")).toBeVisible();
  await page.locator("#me-locate-fab").click();
  const marker = page.locator(".me-nearby-area-marker", { hasText: "常磐公園" });
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(page.locator("[data-place-atlas-profile]")).toBeVisible();
  await page.locator("#me-bottom-grip").click();
  await expect(page.locator("#me-bottom-sheet")).toHaveAttribute("data-snap", "full");
  return { page, mutationEvents: mutations };
}

test.describe.serial("Place Atlas exact staging runtime", () => {
  for (const locale of LOCALES) {
    test(`timeline is materialization-bound and localized (${locale.path})`, async ({ browser }) => {
      const session = await openProfile(browser, locale.path, locale.lang, BASE_PROFILE);
      const atlas = session.page.locator("[data-place-atlas-profile]");
      const timeline = atlas.locator(".me-place-atlas-timeline");
      await expect(timeline).toBeVisible();
      await expect(timeline).toContainText(locale.timeline);
      await expect(timeline).toContainText(locale.multiple);
      await expect(timeline).toContainText(locale.sampled);
      await expect(timeline).toContainText(locale.unknown);
      await expect(timeline).toContainText(locale.candidate);
      await expect(timeline).toContainText(locale.verified);
      await expect(timeline).toContainText(locale.capture);
      await expect(timeline).not.toContainText(/変化した|changed|cambió|mudou/iu);
      await expect(timeline.locator("time").nth(0)).toHaveText("2025-04-01");
      await expect(timeline.locator("time").nth(1)).toHaveText("2026-07-20");
      await expect(timeline.locator('a[href="https://unsafe.example/timeline-hidden-href"]')).toHaveCount(0);
      await expect(timeline.locator('img[src*="javascript"]')).toHaveCount(0);
      await expect(atlas).not.toContainText(/timeline-hidden-(?:old|candidate|verified|owner|poster|lat|lng|cell|contributor|href)/u);
      const cta = timeline.locator('[data-kpi-action="map:place_atlas:timeline_revisit"]');
      await expect(cta).toHaveAttribute("data-kpi-event", "selected_place_cta_click");
      await expect(cta).toHaveAttribute("data-kpi-funnel", "map_selected_place");
      const order = await atlas.evaluate((root) => ({
        summary: Array.from(root.children).findIndex((node) => node.classList.contains("me-place-atlas-summary")),
        timeline: Array.from(root.children).findIndex((node) => node.classList.contains("me-place-atlas-timeline")),
        highlights: Array.from(root.children).findIndex((node) => node.classList.contains("me-place-atlas-highlights")),
      }));
      expect(order.timeline).toBeGreaterThan(order.summary);
      expect(order.highlights).toBeGreaterThan(order.timeline);
      expect(session.mutationEvents.length).toBeGreaterThan(0);
      expect(session.mutationEvents.every((event) => event === "POST /api/v1/ui-kpi/events")).toBe(true);
      await session.page.context().close();
    });
  }

  test("single, empty, suppressed, and CTA conditions stay fail-closed", async ({ browser }) => {
    const profiles = [
      {
        name: "single",
        profile: {
          ...BASE_PROFILE,
          timelineProjection: {
            ...BASE_PROFILE.timelineProjection,
            state: "single_period",
            recordCount: 1,
            totalRecordCount: 1,
            sampled: false,
            distinctPeriodCount: 1,
            periods: BASE_PROFILE.timelineProjection.periods.slice(0, 1),
          },
        },
        visible: true,
        cta: true,
      },
      {
        name: "empty",
        profile: {
          ...BASE_PROFILE,
          timelineProjection: {
            ...BASE_PROFILE.timelineProjection,
            state: "empty",
            recordCount: 987654,
            totalRecordCount: 987655,
          },
        },
        visible: false,
        cta: false,
      },
      {
        name: "suppressed",
        profile: {
          ...BASE_PROFILE,
          timelineProjection: {
            ...BASE_PROFILE.timelineProjection,
            state: "suppressed",
            recordCount: 987654,
            totalRecordCount: 987655,
          },
        },
        visible: false,
        cta: false,
      },
      {
        name: "cta-policy-suppressed",
        profile: {
          ...BASE_PROFILE,
          policy: { ...BASE_PROFILE.policy, contributionCtaMode: "suppressed" },
        },
        visible: true,
        cta: false,
      },
    ];

    for (const item of profiles) {
      const session = await openProfile(browser, "/ja/map", "ja-JP", item.profile);
      const atlas = session.page.locator("[data-place-atlas-profile]");
      const timeline = atlas.locator(".me-place-atlas-timeline");
      if (item.visible) {
        await expect(timeline).toBeVisible();
        if (item.name === "single") {
          await expect(timeline).toContainText("一時期の記録");
          await expect(timeline).not.toContainText("変化した");
        }
        await expect(timeline.locator('[data-kpi-action="map:place_atlas:timeline_revisit"]')).toHaveCount(item.cta ? 1 : 0);
      } else {
        await expect(timeline).toHaveCount(0);
        await expect(atlas).not.toContainText(/987654|987655/u);
        await expect(atlas).not.toContainText(/timeline-hidden-/u);
      }
      expect(session.mutationEvents.length).toBeGreaterThan(0);
      expect(session.mutationEvents.every((event) => event === "POST /api/v1/ui-kpi/events")).toBe(true);
      await session.page.context().close();
    }
  });
});
