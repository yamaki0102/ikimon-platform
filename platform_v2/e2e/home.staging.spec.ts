import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  addSessionCookie,
  createStagingApiContext,
  newStagingContext,
  suppressMapLibreForSmoke,
  type ViewportProfile,
} from "./support/staging.js";

const HOME_VIEWPORTS: ViewportProfile[] = [
  { slug: "mobile-320", viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true },
  { slug: "iphone-se2-375", viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { slug: "android-412", viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true },
  { slug: "tablet-768", viewport: { width: 768, height: 900 } },
  { slug: "notebook-1024", viewport: { width: 1024, height: 768 } },
  { slug: "desktop-1280", viewport: { width: 1280, height: 800 } },
  { slug: "desktop-1440", viewport: { width: 1440, height: 900 } },
  { slug: "wide-1536", viewport: { width: 1536, height: 960 } },
];

type SessionPayload = {
  ok: boolean;
  error?: string;
};

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function visibleBodyText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

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

async function expectGuestHome(page: Page): Promise<void> {
  await expect(async () => {
    await page.goto("/?lang=ja", { waitUntil: "networkidle" });
    await expect(page.locator('[data-home-contract="state-split-v1"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-home-view="guest"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-home-view="member"]')).toBeHidden();
    await expect(page.locator('[data-home-auth-state="guest"]')).toHaveCount(2);
    await expect(page.locator('[data-home-view="guest"] .home-primary-button')).toHaveCount(1);
    await expect(page.locator('[data-home-view="guest"] .home-bottom-nav')).toHaveCount(0);
    await expect(page.locator(".home-category-section")).toBeVisible();
    await expect(page.locator(".home-place-section")).toBeVisible();
    await expect(page.locator("#map-explorer")).toHaveCount(0);
    await expect(page.locator("body")).toContainText("地域の記録を、");
    await expect(page.locator("body")).toContainText("みんなで育てる。");
  }).toPass({
    intervals: [1_500, 3_000, 5_000],
    timeout: 45_000,
  });
}

async function expectNoLegacyHome(page: Page): Promise<void> {
  await expect(page.locator("[data-record-feed]")).toHaveCount(0);
  await expect(page.locator(".global-record-launcher")).toHaveCount(1);
  await expect(page.locator(".home-bottom-nav")).toHaveCount(0);
  await expect(page.locator(".me-enjoy-strip")).toHaveCount(0);
  await expect(page.locator("#me-visited-panel")).toHaveCount(0);
  await expect(page.locator("[data-api-my-places]")).toHaveCount(0);
  await expect(page.locator(".me-filter-toggle")).toHaveCount(0);
  const visibleText = await visibleBodyText(page);
  expect(visibleText).not.toContain("ikimon - 皆で作る地域図鑑");
  expect(visibleText).not.toContain("Cloudflare移行中");
  expect(visibleText).not.toContain("unidentified");
  expect(visibleText).not.toContain("行った場所へ");
  expect(visibleText).not.toContain("よく行く");
  expect(visibleText).not.toContain("季節で再訪");
}

for (const profile of HOME_VIEWPORTS) {
  test(`guest home exposes the value-first state layout (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();

    try {
      await suppressMapLibreForSmoke(page);
      await expectGuestHome(page);
      await expectNoLegacyHome(page);
      if (profile.viewport.width <= 960) {
        await expect(page.locator(".global-record-launcher")).toBeVisible();
        const capture = page.locator(".global-record-launcher [data-global-record-trigger='photo']");
        await expect(capture).toBeVisible();
        await expect(capture).not.toHaveAttribute("aria-current", "page");
      } else {
        await expect(page.locator(".global-record-launcher")).toBeHidden();
        await expect(page.locator(".site-core-nav")).toBeVisible();
        await expect(page.locator(".site-core-nav [data-global-record-trigger='photo']")).not.toHaveAttribute("aria-current", "page");
      }
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/home-state-split-guest-${profile.slug}.png`, fullPage: true });
    } finally {
      await context.close();
    }
  });
}

test("logged-in staging Home centers the viewer's continuation, records, places, and next action", async ({ browser, playwright }) => {
  const api = await createStagingApiContext(playwright);
  const userId = await resolveQaUserId(api);
  const rawCookie = await issueSessionCookie(api, userId);
  const context = await newStagingContext(browser, { slug: "desktop-1440", viewport: { width: 1440, height: 900 } });
  await addSessionCookie(context, rawCookie);
  const page = await context.newPage();

  try {
    await suppressMapLibreForSmoke(page);
    await page.goto("/?lang=ja", { waitUntil: "networkidle" });
    await expect(page.locator('[data-home-contract="state-split-v1"]')).toBeVisible();
    await expect(page.locator('[data-home-view="member"]')).toBeVisible();
    await expect(page.locator('[data-home-view="guest"]')).toBeHidden();
    await expect(page.locator('[data-home-auth-state="member"]')).toHaveCount(2);
    await expect(page.locator('[data-home-view="member"] [data-home-primary-active="true"]:visible')).toHaveCount(1);
    await expect(page.locator(".global-record-launcher")).toHaveCount(1);
    await expect(page.locator(".global-record-launcher")).toBeHidden();
    await expect(page.locator(".site-core-nav")).toBeVisible();
    await expect(page.locator('[data-home-view="member"] .home-recent-section,[data-home-view="member"] .home-empty-state')).toHaveCount(1);
    await expect(page.locator('[data-home-section="monitoring"]')).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("写真からわかったこと");
    await expect(page.locator("body")).not.toContainText("近くで残された記録");
    const nextActionCount = await page.locator('[data-home-view="member"] [data-home-next-action]').count();
    expect(nextActionCount).toBeLessThanOrEqual(1);
    await expectNoLegacyHome(page);
    await expectNoHorizontalOverflow(page);
    const visibleIds = await page.locator('[data-home-view="member"] [data-home-record-id]:visible').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-home-record-id")).filter(Boolean));
    expect(new Set(visibleIds).size).toBe(visibleIds.length);
    await page.screenshot({ path: "test-results/home-state-split-member-1440.png", fullPage: true });
  } finally {
    await context.close();
    await api.dispose();
  }
});
