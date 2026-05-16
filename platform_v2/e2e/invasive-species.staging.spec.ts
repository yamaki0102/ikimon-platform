import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  addSessionCookie,
  createStagingApiContext,
  newStagingContext,
  type ViewportProfile,
} from "./support/staging.js";

const INVASIVE_VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 900 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const REPRESENTATIVE_PATHS = [
  "/learn/invasive-species/coreopsis-lanceolata?lang=ja",
  "/learn/invasive-species/alternanthera-philoxeroides?lang=ja",
  "/learn/invasive-species/solenopsis-invicta?lang=ja",
  "/learn/invasive-species/myocastor-coypus?lang=ja",
];

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
  expect(writeKey, "V2_PRIVILEGED_WRITE_API_KEY is required for logged-in invasive staging QA").toBeTruthy();
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

async function gotoUntilText(page: Page, path: string, expectedText: string | RegExp): Promise<void> {
  let lastBody = "";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    lastBody = await page.locator("body").innerText().catch(() => "");
    if (typeof expectedText === "string" ? lastBody.includes(expectedText) : expectedText.test(lastBody)) {
      return;
    }
    await page.waitForTimeout(1000 * attempt);
  }
  await expect(page.locator("body")).toContainText(expectedText);
}

for (const profile of INVASIVE_VIEWPORTS) {
  test(`logged-in staging invasive species pages render (${profile.slug})`, async ({ browser, playwright }) => {
    const api = await createStagingApiContext(playwright);
    const userId = await resolveQaUserId(api);
    const rawCookie = await issueSessionCookie(api, userId);
    const context = await newStagingContext(browser, profile);
    await addSessionCookie(context, rawCookie);
    const page = await context.newPage();

    try {
      await gotoUntilText(page, "/learn/invasive-species?lang=ja", "外来種を見つけたときの安全メモ");
      await expect(page.locator("body")).toContainText("全26件");
      for (const name of ["オオキンケイギク", "ナガエツルノゲイトウ", "ヒアリ", "ヌートリア"]) {
        await expect(page.locator("a").filter({ hasText: name }).first()).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/staging-invasive-list-${profile.slug}.png`, fullPage: true });

      for (const path of REPRESENTATIVE_PATHS) {
        await gotoUntilText(page, path, /触らない|運ばない|捕獲しない|自治体や管理者/);
        await expect(page.locator("body")).toContainText("外来生物法");
        await expect(page.locator("a").filter({ hasText: "出典を開く" }).first()).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
      await page.screenshot({ path: `test-results/staging-invasive-detail-${profile.slug}.png`, fullPage: true });
    } finally {
      await context.close();
      await api.dispose();
    }
  });
}
