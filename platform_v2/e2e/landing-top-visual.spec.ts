import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { suppressMapLibreForSmoke } from "./support/staging.js";
import { getStrings } from "../src/i18n/index.js";
import type { LandingObservation, LandingSnapshot } from "../src/services/readModels.js";
import { LANDING_TOP_STYLES, renderLandingTopSections } from "../src/ui/landingTop.js";

const productionVisualBaseUrl = process.env.PRODUCTION_VISUAL_BASE_URL ?? "https://ikimon.life";
const productionVisualBbox = process.env.PRODUCTION_VISUAL_BBOX ?? "137.60,34.60,137.91,34.85";

const viewports = [
  { name: "desktop", width: 1440, height: 1200 },
  { name: "mobile", width: 390, height: 844 },
];

type ProductionMapObservation = {
  occurrenceId: string;
  visitId: string;
  displayName: string;
  isAiCandidate?: boolean;
  isAwaitingId?: boolean;
  localityLabel?: string;
  observedAt: string;
  photoUrl?: string | null;
  cellId?: string | null;
  taxonGroup?: string | null;
};

type ProductionMapCellFeature = {
  properties?: {
    cellId?: string;
    localityLabel?: string;
    label?: string;
    gridM?: number;
    radiusM?: number;
    centroidLat?: number;
    centroidLng?: number;
    scope?: "municipality" | "prefecture" | "blurred";
  };
};

type ProductionPublicDataSnapshot = {
  observations: ProductionMapObservation[];
  cells: ProductionMapCellFeature[];
};

async function expectViewportScreenshotHealth(page: Page, viewport: typeof viewports[number]) {
  const screenshot = await page.screenshot({
    fullPage: false,
    animations: "disabled",
  });
  const image = sharp(screenshot);
  const metadata = await image.metadata();
  const stats = await image.stats();
  const maxChannelDeviation = Math.max(...stats.channels.slice(0, 3).map((channel) => channel.stdev));

  expect(metadata.width, `${viewport.name} viewport screenshot width`).toBe(viewport.width);
  expect(metadata.height, `${viewport.name} viewport screenshot height`).toBe(viewport.height);
  expect(maxChannelDeviation, `${viewport.name} viewport screenshot is not blank`).toBeGreaterThan(8);
}

async function fetchProductionJson<T>(path: string): Promise<T> {
  const url = new URL(path, productionVisualBaseUrl);
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "ikimon-life-production-visual-qa",
    },
    signal: AbortSignal.timeout(20_000),
  });
  expect(response.ok, `fetch ${url.toString()} from production public API`).toBeTruthy();
  return await response.json() as T;
}

async function fetchProductionPublicData(): Promise<ProductionPublicDataSnapshot> {
  const params = `bbox=${encodeURIComponent(productionVisualBbox)}&zoom=12`;
  const [observationsPayload, cellsPayload] = await Promise.all([
    fetchProductionJson<{ items?: ProductionMapObservation[] }>(`/api/v1/map/observations?${params}`),
    fetchProductionJson<{ features?: ProductionMapCellFeature[] }>(`/api/v1/map/cells?${params}`),
  ]);
  return {
    observations: (observationsPayload.items ?? []).filter((item) => Boolean(item.photoUrl)),
    cells: cellsPayload.features ?? [],
  };
}

function productionPhotoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("/uploads/")) {
    return new URL(`/thumb/md/${rawUrl.replace(/^\/uploads\//, "")}`, productionVisualBaseUrl).toString();
  }
  if (rawUrl.startsWith("/data/uploads/")) {
    return new URL(`/thumb/md/${rawUrl.replace(/^\/data\/uploads\//, "")}`, productionVisualBaseUrl).toString();
  }
  return new URL(rawUrl, productionVisualBaseUrl).toString();
}

function liveProductionSnapshot(data: ProductionPublicDataSnapshot): LandingSnapshot {
  const cells = new Map(
    data.cells
      .map((feature) => feature.properties)
      .filter((properties): properties is NonNullable<ProductionMapCellFeature["properties"]> => Boolean(properties?.cellId))
      .map((properties) => [properties.cellId, properties]),
  );
  const feed = data.observations.slice(0, 30).map((item, index): LandingObservation => {
    const cell = item.cellId ? cells.get(item.cellId) : undefined;
    const label = item.localityLabel ?? cell?.localityLabel ?? cell?.label ?? "公開エリア";
    return {
      occurrenceId: item.occurrenceId,
      visitId: item.visitId,
      detailId: item.visitId,
      displayName: item.displayName || "同定待ち",
      observedAt: item.observedAt,
      observerName: `production-public-${index + 1}`,
      placeName: label,
      municipality: label,
      publicLocation: {
        label,
        scope: cell?.scope ?? "municipality",
        cellId: item.cellId ?? cell?.cellId ?? `production-live-${index}`,
        gridM: cell?.gridM ?? 3000,
        radiusM: cell?.radiusM ?? 2121,
        centroidLat: cell?.centroidLat ?? null,
        centroidLng: cell?.centroidLng ?? null,
        displayMode: "area",
      },
      photoUrl: productionPhotoUrl(item.photoUrl),
      identificationCount: item.isAwaitingId ? 0 : 1,
      latitude: cell?.centroidLat ?? null,
      longitude: cell?.centroidLng ?? null,
      observerUserId: `production-live-user-${index + 1}`,
      observerAvatarUrl: null,
      entryType: "observation",
      isAiCandidate: Boolean(item.isAiCandidate),
      librarySourceKind: "photo",
    };
  });

  return {
    viewerUserId: null,
    stats: {
      observationCount: data.observations.length,
      speciesCount: new Set(data.observations.map((item) => item.displayName).filter(Boolean)).size,
      placeCount: data.cells.length,
    },
    feed,
    myFeed: [],
    myPlaces: [],
    mapPreviewCells: [],
    ambient: [],
    habit: null,
    dailyDashboard: feed[0]
      ? {
          dateKey: "production-live",
          updatedAt: new Date().toISOString(),
          featuredObservation: {
            ...feed[0],
            score: 80,
            reasonKey: "vividPhoto",
            scoreBreakdown: {
              season: 12,
              region: 12,
              photo: 20,
              evidence: 14,
              freshness: 12,
              dailyVariation: 10,
              total: 80,
            },
          },
          dailyCards: [
            { kind: "recordToday", href: "/record", primaryText: null, secondaryText: null, metricValue: null },
            { kind: "nearbyPulse", href: "/map", primaryText: feed[0].publicLocation.label, secondaryText: null, metricValue: data.observations.length },
            { kind: "needsId", href: "/observations?filter=needs_id", primaryText: "名前を待つ記録", secondaryText: feed[0].publicLocation.label, metricValue: feed.filter((item) => item.identificationCount === 0).length, observation: feed[0] },
          ],
          seasonalStrip: feed.slice(0, 3).map((observation) => ({ observation, score: 80, reasonKey: "vividPhoto" })),
        }
      : null,
  };
}

function renderLandingSnapshotHtml(snapshot: LandingSnapshot): string {
  const strings = getStrings("ja");
  const sections = renderLandingTopSections({
    basePath: "",
    lang: "ja",
    copy: strings.landing,
    fieldLoop: strings.fieldLoop,
    snapshot,
    isLoggedIn: false,
  });
  return `<!doctype html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body { margin: 0; font-family: Inter, "Noto Sans JP", system-ui, sans-serif; color: #10201c; background: #f7fbf8; }
          .shell { max-width: 1180px; margin: 0 auto; padding: 24px; }
          ${LANDING_TOP_STYLES}
        </style>
      </head>
      <body>
        <main class="shell shell-bleed prototype-shell">
          ${sections.heroHtml}
          ${sections.dailyDashboardHtml}
        </main>
      </body>
    </html>`;
}

function productionObservation(
  index: number,
  displayName: string,
  photoUrl: string,
  observedAt: string,
  observerName: string,
): LandingObservation {
  return {
    occurrenceId: `production-density-occ-${index}`,
    visitId: `production-density-visit-${index}`,
    detailId: `production-density-detail-${index}`,
    displayName,
    observedAt,
    observerName,
    placeName: "浜松市",
    municipality: "浜松市",
    publicLocation: {
      label: "浜松市",
      scope: "municipality",
      cellId: `3000:production-density:${index}`,
      gridM: 3000,
      radiusM: 2121,
      centroidLat: 34.71,
      centroidLng: 137.72,
      displayMode: "area",
    },
    photoUrl,
    identificationCount: 0,
    latitude: 34.71,
    longitude: 137.72,
    observerUserId: `production-density-user-${index}`,
    observerAvatarUrl: null,
    entryType: "observation",
    isAiCandidate: true,
  };
}

function productionDensitySnapshot(): LandingSnapshot {
  const feed = [
    productionObservation(
      1,
      "イボタノキ属",
      "https://ikimon.life/thumb/md/v2-observations/record-1778031798988/ikimon-photo-1778031776740-7b0d361271c1.jpg",
      "2026-05-06T08:00:00.000Z",
      "公開フィールド",
    ),
    productionObservation(
      2,
      "ベニスジヒトリ",
      "https://ikimon.life/thumb/md/v2-observations/record-1777966749587/ikimon-photo-1777966735278-224970cfd358.jpg",
      "2026-05-05T21:00:00.000Z",
      "夜の観察者",
    ),
    productionObservation(
      3,
      "バラ属",
      "https://ikimon.life/thumb/md/photos/a98a7fee-ad56-4c6a-be13-9db729a3091c/photo_0.webp",
      "2026-04-12T11:00:00.000Z",
      "公園の投稿",
    ),
    productionObservation(
      4,
      "タンポポ属",
      "https://ikimon.life/thumb/md/photos/76457d8c-479f-4313-9c3e-82fe4cec864a/photo_0.webp",
      "2026-04-12T10:00:00.000Z",
      "散歩の記録",
    ),
    productionObservation(
      5,
      "タケ亜科（タケノコ）",
      "https://ikimon.life/thumb/md/photos/3554857c-d9ba-49db-9fe0-76aa598943a6/photo_0.webp",
      "2026-04-12T09:00:00.000Z",
      "春の観察",
    ),
    productionObservation(
      6,
      "キク科",
      "https://ikimon.life/thumb/md/photos/08dbff8d-279b-401c-acdc-6e576ddbac5c/photo_0.webp",
      "2026-04-12T08:00:00.000Z",
      "足元の発見",
    ),
    productionObservation(
      7,
      "ツツジ属",
      "https://ikimon.life/thumb/md/v2-observations/record-1778031209103/ikimon-photo-1778031190776-304420146f5a.jpg",
      "2026-05-06T07:00:00.000Z",
      "花壇の投稿",
    ),
    productionObservation(
      8,
      "ドウダンツツジ",
      "https://ikimon.life/thumb/md/photos/9bdc05ea-37df-4fd3-83ac-a8d4c3c6d4db/photo_0.webp",
      "2026-04-13T13:00:00.000Z",
      "近所の観察",
    ),
  ];

  return {
    viewerUserId: null,
    stats: { observationCount: 150, speciesCount: 28, placeCount: 289 },
    feed,
    myFeed: [],
    myPlaces: [],
    mapPreviewCells: [],
    ambient: [],
    habit: null,
    dailyDashboard: {
      dateKey: "2026-05-06",
      updatedAt: "2026-05-06T09:00:00.000Z",
      featuredObservation: {
        ...feed[0],
        score: 84,
        reasonKey: "vividPhoto",
        scoreBreakdown: {
          season: 8,
          region: 9,
          photo: 20,
          evidence: 17,
          freshness: 18,
          dailyVariation: 12,
          total: 84,
        },
      },
      dailyCards: [
        { kind: "recordToday", href: "/record", primaryText: null, secondaryText: null, metricValue: null },
        { kind: "revisitPlace", href: "/map", primaryText: "浜松市", secondaryText: "イボタノキ属", metricValue: 8 },
        { kind: "nearbyPulse", href: "/map", primaryText: "浜松市", secondaryText: null, metricValue: 8 },
        { kind: "needsId", href: "/observations?filter=needs_id", primaryText: "名前を待つ記録", secondaryText: "浜松市", metricValue: 8, observation: feed[1] },
      ],
      seasonalStrip: [
        { observation: feed[0], score: 84, reasonKey: "vividPhoto" },
        { observation: feed[1], score: 80, reasonKey: "fresh" },
      ],
    },
  };
}

function renderProductionDensityHtml(): string {
  return renderLandingSnapshotHtml(productionDensitySnapshot());
}

test.describe("landing top visual regression", () => {
  for (const viewport of viewports) {
    test(`${viewport.name} landing top matches approved visual`, async ({ browser }) => {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });

      await suppressMapLibreForSmoke(page);
      await page.goto("/?lang=ja", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load");
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
          }
          .prototype-live-pill time { visibility: hidden !important; }
        `,
      });

      await expect(page.locator(".prototype-topa")).toBeVisible();
      await expect(page.locator("#landing-hero-heading")).toContainText("いま見えている自然");
      await expect(page.locator(".prototype-topa-actions")).toBeVisible();
      await expect(page.locator(".prototype-topa-shelves")).toBeVisible();
      await expect(page.locator("#sound-intelligence")).toBeVisible();
      await expect(page.locator(".prototype-sound-flow article")).toHaveCount(4);
      await expect(page.locator("#topa-local-map")).toBeVisible();
      await expect(page.locator(".prototype-topa-map-board")).toBeVisible();

      const metrics = await page.evaluate(() => {
        const countTracks = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
        const mapBoard = document.querySelector(".prototype-topa-map-board");
        const soundSection = document.querySelector("#sound-intelligence");
        const soundFlow = document.querySelector(".prototype-sound-flow");
        const soundSectionStyle = soundSection ? getComputedStyle(soundSection) : null;
        const soundFlowStyle = soundFlow ? getComputedStyle(soundFlow) : null;
        const mapBoardRect = mapBoard?.getBoundingClientRect();
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          hasSampleText: document.documentElement.outerHTML.includes("sample_"),
          hasOldQuestion: document.documentElement.outerHTML.includes("今日は、どこを見に行く？"),
          firstShelfTop: Math.round(document.querySelector("#topa-today")?.getBoundingClientRect().top ?? 9999),
          soundSectionTrackCount: countTracks(soundSectionStyle?.gridTemplateColumns ?? ""),
          soundFlowTrackCount: countTracks(soundFlowStyle?.gridTemplateColumns ?? ""),
          soundActionCount: document.querySelectorAll(".prototype-sound-actions a").length,
          mapBoardHeight: Math.round(mapBoardRect?.height ?? 0),
        };
      });

      expect(metrics.scrollWidth, "no horizontal scroll").toBe(metrics.clientWidth);
      expect(metrics.hasSampleText, "no sample image fallback").toBe(false);
      expect(metrics.hasOldQuestion, "top page no longer asks a weak navigation question").toBe(false);
      expect(metrics.soundActionCount, "sound section keeps the three route choices").toBe(3);

      if (viewport.name === "mobile") {
        expect(metrics.firstShelfTop, "mobile content shelves start in the first viewport").toBeLessThan(620);
        expect(metrics.soundSectionTrackCount, "mobile sound section stacks").toBe(1);
        expect(metrics.soundFlowTrackCount, "mobile sound cards stack").toBe(1);
        expect(metrics.mapBoardHeight, "mobile map board matches prototype compact height").toBeLessThanOrEqual(460);
      } else {
        expect(metrics.soundSectionTrackCount, "desktop sound section keeps copy and cards side by side").toBeGreaterThanOrEqual(2);
        expect(metrics.soundFlowTrackCount, "desktop sound cards stay two-column").toBeGreaterThanOrEqual(2);
        expect(metrics.mapBoardHeight, "desktop map board keeps local preview height").toBeGreaterThanOrEqual(360);
      }

      if (process.env.VISUAL_QA_ASSERT_SCREENSHOTS === "1") {
        await expectViewportScreenshotHealth(page, viewport);
      }

      await page.close();
    });
  }

  for (const viewport of viewports) {
    test(`${viewport.name} production-density content stays scannable`, async ({ browser }) => {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });

      await page.setContent(renderProductionDensityHtml(), { waitUntil: "load" });
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
          }
        `,
      });

      await expect(page.locator("#landing-hero-heading")).toContainText("いま見えている自然");
      await expect(page.locator("#topa-today")).toContainText("みんなの発見");
      await expect(page.locator("#topa-photo")).toContainText("写真と動画");
      expect(await page.locator(".prototype-topa-card").count(), "fixture keeps production-like card volume").toBeGreaterThanOrEqual(20);

      const metrics = await page.evaluate(() => {
        const viewportHeight = window.innerHeight;
        const firstShelf = document.querySelector("#topa-today")?.getBoundingClientRect();
        const mediaShelf = document.querySelector("#topa-photo")?.getBoundingClientRect();
        const visibleCards = Array.from(document.querySelectorAll(".prototype-topa-card"))
          .filter((card) => {
            const rect = card.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < viewportHeight;
          }).length;
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          firstShelfTop: Math.round(firstShelf?.top ?? 9999),
          mediaShelfTop: Math.round(mediaShelf?.top ?? 9999),
          visibleCards,
        };
      });

      expect(metrics.scrollWidth, "production-density fixture has no horizontal scroll").toBe(metrics.clientWidth);
      if (viewport.name === "mobile") {
        expect(metrics.firstShelfTop, "mobile shows real content before the fold").toBeLessThan(500);
        expect(metrics.mediaShelfTop, "mobile exposes the second shelf as a next-scroll cue").toBeLessThan(900);
        expect(metrics.visibleCards, "mobile first viewport includes multiple real cards").toBeGreaterThanOrEqual(2);
      } else {
        expect(metrics.firstShelfTop, "desktop moves real content above the lower half").toBeLessThan(430);
        expect(metrics.visibleCards, "desktop first viewport gives a video-feed-like grid").toBeGreaterThanOrEqual(8);
      }

      if (process.env.VISUAL_QA_ASSERT_SCREENSHOTS === "1") {
        await expectViewportScreenshotHealth(page, viewport);
      }

      await page.close();
    });
  }

  for (const viewport of viewports) {
    test(`${viewport.name} live production public data remains content-first`, async ({ browser }, testInfo) => {
      test.skip(
        process.env.LIVE_PRODUCTION_VISUAL_QA !== "1",
        "set LIVE_PRODUCTION_VISUAL_QA=1 to verify against current ikimon.life public data",
      );
      const productionData = await fetchProductionPublicData();
      expect(productionData.observations.length, "production public API provides enough real photo observations").toBeGreaterThanOrEqual(8);
      const snapshot = liveProductionSnapshot(productionData);
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });

      await page.goto(productionVisualBaseUrl, { waitUntil: "domcontentloaded" });
      await page.setContent(renderLandingSnapshotHtml(snapshot), { waitUntil: "load" });
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
          }
        `,
      });

      await expect(page.locator("#landing-hero-heading")).toContainText("いま見えている自然");
      await expect(page.locator("#topa-today")).toContainText("みんなの発見");
      expect(await page.locator(".prototype-topa-card").count(), "live production card volume").toBeGreaterThan(12);
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll<HTMLImageElement>(".prototype-topa-card img"))
          .filter((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0).length >= 6;
      }, null, { timeout: 20_000 });

      const metrics = await page.evaluate(() => {
        const viewportHeight = window.innerHeight;
        const firstShelf = document.querySelector("#topa-today")?.getBoundingClientRect();
        const mediaShelf = document.querySelector("#topa-photo")?.getBoundingClientRect();
        const visibleCards = Array.from(document.querySelectorAll(".prototype-topa-card"))
          .filter((card) => {
            const rect = card.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < viewportHeight;
          }).length;
        const loadedImages = Array.from(document.querySelectorAll<HTMLImageElement>(".prototype-topa-card img"))
          .filter((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0).length;
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          firstShelfTop: Math.round(firstShelf?.top ?? 9999),
          mediaShelfTop: Math.round(mediaShelf?.top ?? 9999),
          visibleCards,
          loadedImages,
        };
      });

      expect(metrics.scrollWidth, "live production data has no horizontal scroll").toBe(metrics.clientWidth);
      expect(metrics.loadedImages, "production thumbnails load inside cards").toBeGreaterThanOrEqual(6);
      if (viewport.name === "mobile") {
        expect(metrics.firstShelfTop, "mobile shows real production content before the fold").toBeLessThan(500);
        expect(metrics.mediaShelfTop, "mobile exposes a second content shelf as a next-scroll cue").toBeLessThan(900);
        expect(metrics.visibleCards, "mobile first viewport includes several production cards").toBeGreaterThanOrEqual(2);
      } else {
        expect(metrics.firstShelfTop, "desktop moves live content above the lower half").toBeLessThan(430);
        expect(metrics.visibleCards, "desktop first viewport gives a dense content grid").toBeGreaterThanOrEqual(8);
      }

      await testInfo.attach(`${viewport.name}-production-public-data-summary`, {
        body: JSON.stringify({
          baseUrl: productionVisualBaseUrl,
          bbox: productionVisualBbox,
          observations: productionData.observations.length,
          cells: productionData.cells.length,
          renderedCards: await page.locator(".prototype-topa-card").count(),
          metrics,
        }, null, 2),
        contentType: "application/json",
      });

      if (process.env.VISUAL_QA_ASSERT_SCREENSHOTS === "1") {
        await expectViewportScreenshotHealth(page, viewport);
      }

      await page.close();
    });
  }
});
