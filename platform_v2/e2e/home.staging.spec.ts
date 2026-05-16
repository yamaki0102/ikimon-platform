import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  addSessionCookie,
  createStagingApiContext,
  newStagingContext,
  suppressMapLibreForSmoke,
  type ViewportProfile,
} from "./support/staging.js";

const HOME_VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1536", viewport: { width: 1536, height: 900 } },
  { slug: "desktop-1280", viewport: { width: 1280, height: 800 } },
  { slug: "tablet-768", viewport: { width: 768, height: 900 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

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
  expect(writeKey, "V2_PRIVILEGED_WRITE_API_KEY is required for logged-in home staging QA").toBeTruthy();
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

function cookieHeader(rawCookie: string): string {
  return rawCookie.split(";")[0] ?? rawCookie;
}

for (const profile of HOME_VIEWPORTS) {
  test(`home hero stays focused and stable (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();

    try {
      await suppressMapLibreForSmoke(page);
      await page.goto("/?lang=ja", { waitUntil: "networkidle" });
      await expect(page.locator(".prototype-topa-shelves")).toBeVisible();
      await expect(page.locator(".prototype-content-wall")).toBeVisible();
      await expect(page.locator(".prototype-content-lane").first()).toBeVisible();
      await expect(page.locator(".prototype-content-lane").filter({ hasText: "みんなの記録" })).toBeVisible();
      await expect(page.locator("#topa-local-map")).toBeVisible();
      await expect(page.locator(".prototype-local-panel.is-invasive")).toBeVisible();
      await expect(page.locator(".prototype-local-panel.is-events")).toBeVisible();
      await expect(page.locator("#landing-hero-heading")).toHaveCount(0);
      await expect(page.locator(".prototype-topa-actions")).toHaveCount(0);
      await expect(page.locator(".landing-hero-timeline")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}

test("logged-in staging home shows personal guide outcomes shelf", async ({ browser, playwright }) => {
  const api = await createStagingApiContext(playwright);
  const userId = await resolveQaUserId(api);
  const rawCookie = await issueSessionCookie(api, userId);
  const fixtureSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fixtureLabel = `staging guide shelf ${fixtureSuffix}`;
  const saveResponse = await api.post("/api/v1/guide/record", {
    headers: {
      Cookie: cookieHeader(rawCookie),
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      sessionId: `home-guide-shelf-${fixtureSuffix}`,
      lang: "ja",
      guideMode: "walk",
      lat: 34.7219,
      lng: 137.8589,
      capturedAt: new Date().toISOString(),
      returnedAt: new Date().toISOString(),
      sceneHash: `home-guide-shelf-${fixtureSuffix}`,
      sceneSummary: `${fixtureLabel} の植生と足元の変化`,
      detectedSpecies: [`${fixtureLabel} plant`],
      detectedFeatures: [
        { type: "vegetation", name: `${fixtureLabel} vegetation`, confidence: 0.92, note: "staging visual QA" },
      ],
      environmentContext: `${fixtureLabel} environment`,
      seasonalNote: "staging visual QA",
    },
  });
  const savePayload = await saveResponse.json().catch(() => null) as { guideRecordId?: string; error?: string } | null;
  expect(saveResponse.ok(), savePayload?.error ?? "guide_record_save_failed").toBeTruthy();
  expect(savePayload?.guideRecordId, "guide record id should be returned").toBeTruthy();

  const context = await newStagingContext(browser, { slug: "desktop-1440", viewport: { width: 1440, height: 900 } });
  await addSessionCookie(context, rawCookie);
  const page = await context.newPage();

  try {
    await suppressMapLibreForSmoke(page);
    await page.goto("/?lang=ja", { waitUntil: "networkidle" });
    await expect(page.locator(".prototype-content-lane").filter({ hasText: "自分の記録" })).toBeVisible();
    await expect(page.locator(".prototype-content-lane").filter({ hasText: "みんなの記録" })).toBeVisible();
    const guideShelf = page.locator("#topa-guide");
    await expect(guideShelf).toBeVisible();
    await expect(guideShelf).toContainText("ガイドの記録");
    await expect(guideShelf.locator(`a[href*="${encodeURIComponent(`home-guide-shelf-${fixtureSuffix}`)}"]`).first()).toBeVisible();
    await expect(guideShelf.locator("a[href*='/guide/outcomes']").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `test-results/home-personal-guide-shelf-${fixtureSuffix}.png`, fullPage: true });
  } finally {
    await context.close();
    await api.dispose();
  }
});
