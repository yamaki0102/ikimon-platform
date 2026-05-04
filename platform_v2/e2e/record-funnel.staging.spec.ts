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
        await expect(page.locator("#record-status")).toContainText("記録を保存しました");
        await expect(page.locator("#record-status a", { hasText: "観察を見る" })).toBeVisible();
        await expect(page.locator("#record-status a", { hasText: "ノートを見る" })).toBeVisible();
        await expect(page.locator("#record-status a", { hasText: "同じ場所でもう1件" })).toHaveAttribute(
          "href",
          new RegExp(`/record\\?start=gallery&revisitObservationId=${MOCK_VISIT_ID}$`),
        );
        await expectNoHorizontalOverflow(page);

        await page.locator("#record-status a", { hasText: "同じ場所でもう1件" }).click({ noWaitAfter: true });
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
