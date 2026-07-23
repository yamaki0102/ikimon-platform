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

async function expectSelfControlHubVisible(page: Page): Promise<void> {
  await page.goto("/profile?lang=ja", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("self-control-hub")).toBeVisible();
  await expect(page.getByRole("heading", { name: "プロフィールと公開ページ" })).toBeVisible();
  await expect(page.getByRole("link", { name: /件の記録/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /か所/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "公開範囲と位置情報" })).toBeVisible();
  await expect(page.getByRole("link", { name: "参加とフォロー" })).toBeVisible();
  await expect(page.getByTestId("profile-saved-record-pulse")).toHaveCount(0);
  await expect(page.getByText("ログインすると、あなたの記録")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
}

test.describe("logged-in self control hub staging evidence", () => {
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
    test(`shows identity, privacy, and participation controls on /profile (${profile.slug})`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile);
      await addSessionCookie(context, sessionCookie);
      const page = await context.newPage();

      try {
        await expectSelfControlHubVisible(page);
      } finally {
        await context.close();
      }
    });
  }
});
