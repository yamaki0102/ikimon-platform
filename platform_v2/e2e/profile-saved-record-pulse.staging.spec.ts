import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  addSessionCookie,
  createStagingApiContext,
  issueSessionCookie,
  newStagingContext,
  requireEnv,
  type ViewportProfile,
} from "./support/staging.js";

const PROFILE_VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1280", viewport: { width: 1280, height: 800 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

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

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectSavedRecordPulseVisible(page: Page): Promise<void> {
  await page.goto("/profile?lang=ja", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("profile-saved-record-pulse")).toBeVisible();
  await expect(page.getByTestId("profile-saved-record-pulse")).toContainText("最後に保存した記録");

  const latestAction = page.locator('[data-kpi-action="profile:saved_record:latest"]');
  const recordsAction = page.locator('[data-kpi-action="profile:saved_record:records"]');
  const firstRecordAction = page.locator('[data-kpi-action="profile:saved_record:first_record"]');

  const latestCount = await latestAction.count();
  const firstRecordCount = await firstRecordAction.count();
  expect(latestCount + firstRecordCount, "profile should offer a saved-record or first-record action").toBeGreaterThan(0);

  if (latestCount > 0) {
    await expect(latestAction.first()).toBeVisible();
    await expect(recordsAction.first()).toBeVisible();
  } else {
    await expect(firstRecordAction.first()).toBeVisible();
  }

  await expect(page.getByText("ログインすると、あなたの記録")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
}

test.describe("logged-in profile saved record pulse staging evidence", () => {
  let api: APIRequestContext;
  let sessionCookie: string;

  test.beforeAll(async ({ playwright }) => {
    api = await createStagingApiContext(playwright);
    const userId = await resolveQaUserId(api);
    sessionCookie = await issueSessionCookie(api, requireEnv("V2_PRIVILEGED_WRITE_API_KEY"), userId);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  for (const profile of PROFILE_VIEWPORTS) {
    test(`shows the saved-record pulse on /profile (${profile.slug})`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile);
      await addSessionCookie(context, sessionCookie);
      const page = await context.newPage();

      try {
        await expectSavedRecordPulseVisible(page);
      } finally {
        await context.close();
      }
    });
  }
});
