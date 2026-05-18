import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  addSessionCookie,
  createStagingApiContext,
  newStagingContext,
  suppressMapLibreForSmoke,
  type ViewportProfile,
} from "./support/staging.js";

const VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 1000 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const CAMERA_DEVICE_VIEWPORTS: ViewportProfile[] = [
  {
    slug: "iphone-safari-390x844",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
  },
  {
    slug: "android-chrome-412x915",
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  },
];

const MOCK_VISIT_ID = "record-funnel-visit";
const MOCK_OCCURRENCE_ID = "record-funnel-occurrence";
const MOCK_PLACE_ID = "geo:34.710800:137.726100";

type KpiPayload = {
  eventName?: string;
  routeKey?: string;
  actionKey?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

type SessionPayload = {
  ok: boolean;
  error?: string;
};

function firstMatch(source: string, pattern: RegExp): string | null {
  const match = source.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function resolveQaUserId(api: APIRequestContext): Promise<string> {
  const response = await api.get("/qa/site-map?lang=ja");
  expect(response.ok(), "/qa/site-map should expose a materialized user").toBeTruthy();
  const html = await response.text();
  const userId = firstMatch(html, /\/home\?userId=([^"&]+)/) ?? firstMatch(html, /\/profile\/([^"?&#]+)/);
  expect(userId, "QA sitemap should expose a user route").toBeTruthy();
  return userId!;
}

async function issueSessionCookie(api: APIRequestContext, userId: string): Promise<string> {
  const writeKey = process.env.V2_PRIVILEGED_WRITE_API_KEY?.trim();
  expect(writeKey, "V2_PRIVILEGED_WRITE_API_KEY is required for record funnel staging QA").toBeTruthy();
  const response = await api.post("/api/v1/auth/session/issue", {
    headers: {
      "x-ikimon-write-key": writeKey!,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: { userId, ttlHours: 4 },
  });
  const payload = (await response.json().catch(() => null)) as SessionPayload | null;
  expect(response.ok(), payload?.error ?? "session_issue_failed").toBeTruthy();
  const rawCookie = response.headers()["set-cookie"] ?? "";
  expect(rawCookie, "session issue response should set a cookie").toBeTruthy();
  return rawCookie;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function installRecordMocks(page: Page, userId: string, kpiPayloads: KpiPayload[]): Promise<void> {
  await page.route("**/api/v1/ui-kpi/events", async (route) => {
    const payload = route.request().postDataJSON() as KpiPayload;
    kpiPayloads.push(payload);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, eventId: `mock-kpi-${kpiPayloads.length}` }),
    });
  });

  await page.route("**/api/v1/observations/upsert", async (route) => {
    const payload = route.request().postDataJSON() as { userId?: string; sourcePayload?: Record<string, unknown> };
    expect(payload.userId).toBe(userId);
    expect(payload.sourcePayload?.location_provenance).toBeTruthy();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        visitId: MOCK_VISIT_ID,
        occurrenceId: MOCK_OCCURRENCE_ID,
        occurrenceIds: [MOCK_OCCURRENCE_ID],
        placeId: MOCK_PLACE_ID,
        impact: {
          placeName: "浜松市の観察地点",
          visitCount: 2,
          previousObservedAt: "2026-04-20T09:00:00.000Z",
          focusLabel: "次に探すもの",
          captureState: "present",
        },
      }),
    });
  });

  await page.route("**/api/v1/observations/*/photos/upload", async (route) => {
    const payload = route.request().postDataJSON() as { filename?: string; mediaRole?: string; base64Data?: string };
    expect(payload.filename).toBeTruthy();
    expect(payload.mediaRole).toBeTruthy();
    expect(payload.base64Data?.length ?? 0).toBeGreaterThan(20);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, photo: { publicUrl: "/uploads/qa/record-funnel.jpg" } }),
    });
  });
}

function tinyPngFile(): { name: string; mimeType: string; buffer: Buffer } {
  return {
    name: "record-funnel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAgCXa7QJAAAAAElFTkSuQmCC",
      "base64",
    ),
  };
}

function actions(payloads: KpiPayload[]): string[] {
  return payloads.map((payload) => String(payload.actionKey ?? ""));
}

async function installFakeCamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const globalWindow = window as unknown as { __ikimonCameraConstraints?: unknown[] };
    const cameraConstraints: unknown[] = [];
    globalWindow.__ikimonCameraConstraints = cameraConstraints;

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 1280;
          canvas.height = 720;
          const context = canvas.getContext("2d");
          if (context) {
            context.fillStyle = "#052e16";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = "#34d399";
            context.fillRect(220, 120, 840, 420);
          }
          const stream = canvas.captureStream(30);
          const [track] = stream.getVideoTracks();
          let zoom = 1;
          Object.defineProperty(track, "getCapabilities", {
            configurable: true,
            value: () => ({
              focusMode: ["single-shot", "continuous"],
              zoom: { min: 1, max: 5, step: 0.1 },
            }),
          });
          Object.defineProperty(track, "getSettings", {
            configurable: true,
            value: () => ({ zoom }),
          });
          Object.defineProperty(track, "applyConstraints", {
            configurable: true,
            value: async (constraints: { advanced?: Array<Record<string, unknown>> }) => {
              cameraConstraints.push(constraints);
              const nextZoom = Number(constraints?.advanced?.[0]?.zoom);
              if (Number.isFinite(nextZoom)) zoom = nextZoom;
            },
          });
          return stream;
        },
      },
    });
  });
}

async function expectCameraControlsClearOfViewportChrome(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const rectFor = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    };
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      sheet: rectFor("[data-global-record-camera-sheet]"),
      close: rectFor(".global-record-camera-close"),
      preview: rectFor("[data-global-record-camera-preview]"),
      zoom: rectFor("[data-global-record-camera-zoom]"),
      actions: rectFor(".global-record-camera-actions"),
      helpText: document.querySelector("[data-global-record-camera-help]")?.textContent ?? "",
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(layout.overflow).toBeLessThanOrEqual(1);
  expect(layout.helpText).toBe("");
  expect(layout.sheet).toBeTruthy();
  expect(layout.close).toBeTruthy();
  expect(layout.preview).toBeTruthy();
  expect(layout.zoom).toBeTruthy();
  expect(layout.actions).toBeTruthy();

  const { viewport, sheet, close, preview, zoom, actions } = layout;
  expect(sheet!.top).toBeGreaterThanOrEqual(0);
  expect(sheet!.bottom).toBeLessThanOrEqual(viewport.height);
  expect(close!.top).toBeGreaterThanOrEqual(0);
  expect(close!.right).toBeLessThanOrEqual(viewport.width);
  expect(preview!.top).toBeGreaterThanOrEqual(sheet!.top);
  expect(zoom!.bottom).toBeLessThanOrEqual(actions!.top - 4);
  expect(actions!.bottom).toBeLessThanOrEqual(viewport.height);
  expect(actions!.top).toBeGreaterThan(zoom!.bottom);
}

async function expectCameraConstraint(page: Page, marker: "zoom" | "pointsOfInterest"): Promise<void> {
  await expect
    .poll(async () => {
      return page.evaluate((markerName) => {
        const constraints = ((window as unknown as { __ikimonCameraConstraints?: unknown[] }).__ikimonCameraConstraints ?? []) as Array<{
          advanced?: Array<Record<string, unknown>>;
        }>;
        return constraints.some((entry) => {
          const first = entry.advanced?.[0] ?? {};
          return markerName === "zoom" ? first.zoom === 5 : Array.isArray(first.pointsOfInterest);
        });
      }, marker);
    })
    .toBe(true);
}

test.describe("record funnel staging QA", () => {
  let api: APIRequestContext;
  let sessionCookie: string;
  let userId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await createStagingApiContext(playwright);
    userId = await resolveQaUserId(api);
    sessionCookie = await issueSessionCookie(api, userId);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  for (const profile of VIEWPORTS) {
    test(`photo record funnel emits KPI and revisit CTA (${profile.slug})`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile);
      await addSessionCookie(context, sessionCookie);
      const page = await context.newPage();
      const kpiPayloads: KpiPayload[] = [];

      try {
        await suppressMapLibreForSmoke(page);
        await installRecordMocks(page, userId, kpiPayloads);

        await page.goto("/record?lang=ja", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#record-form")).toBeHidden();
        await expectNoHorizontalOverflow(page);

        await page.locator("#record-media-photo").setInputFiles(tinyPngFile());
        await expect(page.locator("#record-form")).toBeVisible();
        await expect(page.locator("#record-submit-panel")).toBeVisible();

        await page.locator("summary", { hasText: "座標を直接編集" }).click();
        await page.locator("input[name='latitude']").fill("34.710800");
        await page.locator("input[name='longitude']").fill("137.726100");

        await page.locator("#record-submit-panel button[type='submit']").click();
        await expect(page.locator("#record-status")).toContainText(/記録を保存しました|シーンを保存しました/);
        await expect(page.locator("#record-status a", { hasText: /見つけたものを確認する|対象ごとの記録を確認する|観察レコードを見る|観察を見る/ })).toBeVisible();
        await expect(page.locator("#record-status a", { hasText: /記録を見る|シーンを見る|ノートを見る/ })).toBeVisible();
        const revisitLink = page.locator("#record-status a", { hasText: /同じ場所でもう1件記録する|同じ場所でもう1シーン|同じ場所でもう1件/ });
        await expect(revisitLink).toHaveAttribute(
          "href",
          new RegExp(`/record\\?start=gallery&revisitObservationId=${MOCK_VISIT_ID}$`),
        );
        await expectNoHorizontalOverflow(page);

        await revisitLink.click({ noWaitAfter: true });
        await page.waitForTimeout(250);

        const actionList = actions(kpiPayloads);
        expect(actionList).toContain("record_open");
        expect(actionList).toContain("media_selected");
        expect(actionList).toContain("location_set");
        expect(actionList).toContain("submit_attempt");
        expect(actionList).toContain("observation_upsert_success");
        expect(actionList).toContain("photo_upload_success");
        expect(actionList).toContain("record_success_rendered");
        expect(actionList).toContain("record_saved");
        expect(actionList).toContain("record_success_revisit_same_place");

        const saved = kpiPayloads.find((payload) => payload.actionKey === "record_saved");
        expect(saved?.eventName).toBe("task_completion");
        expect(saved?.routeKey).toBe("/record");
        expect(saved?.metadata?.recordSessionId).toBeTruthy();
        expect(saved?.metadata?.captureKind).toBe("photo");
        expect(saved?.metadata?.hasLocation).toBe(true);
        expect(Number(saved?.metadata?.mediaCount ?? 0)).toBeGreaterThanOrEqual(1);
        expect(saved?.metadata?.visitId).toBe(MOCK_VISIT_ID);
        expect(saved?.metadata?.occurrenceId).toBe(MOCK_OCCURRENCE_ID);
        expect(saved?.metadata?.placeId).toBe(MOCK_PLACE_ID);
        expect(Number(saved?.metadata?.elapsedMs ?? -1)).toBeGreaterThanOrEqual(0);
      } finally {
        await context.close();
      }
    });
  }
});

const cameraDeviceQaDescribe = process.env.IKIMON_CAMERA_DEVICE_QA === "1" ? test.describe : test.describe.skip;

cameraDeviceQaDescribe("global record camera mobile controls QA", () => {
  for (const profile of CAMERA_DEVICE_VIEWPORTS) {
    for (const kind of ["photo", "video"] as const) {
      test(`keeps ${kind} camera controls clear on ${profile.slug}`, async ({ browser }) => {
        const context = await newStagingContext(browser, profile);
        const page = await context.newPage();

        try {
          await installFakeCamera(page);
          await suppressMapLibreForSmoke(page);
          await page.goto("/?lang=ja", { waitUntil: "domcontentloaded" });
          await expectNoHorizontalOverflow(page);

          await page.locator(`[data-global-record-trigger="${kind}"]`).click();
          const sheet = page.locator("[data-global-record-camera-sheet]");
          await expect(sheet).toBeVisible();
          await expect(sheet).toHaveAttribute("data-camera-active", "true");
          await expect(page.locator("[data-global-record-camera-zoom]")).toBeVisible();
          await expect(page.locator("[data-global-record-camera-capture]")).toBeVisible();

          await expectCameraControlsClearOfViewportChrome(page);

          await page.locator("[data-global-record-camera-zoom-max]").click();
          await expectCameraConstraint(page, "zoom");

          const preview = page.locator("[data-global-record-camera-preview]");
          const previewBox = await preview.boundingBox();
          expect(previewBox).toBeTruthy();
          await preview.click({
            position: {
              x: Math.round(previewBox!.width * 0.48),
              y: Math.round(previewBox!.height * 0.38),
            },
          });
          await expectCameraConstraint(page, "pointsOfInterest");

          await page.locator(".global-record-camera-close").click();
          await expect(sheet).toBeHidden();
        } finally {
          await context.close();
        }
      });
    }
  }
});
