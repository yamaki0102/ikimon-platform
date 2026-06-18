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

async function expectMapFirstHomeShell(page: Page): Promise<void> {
  await expect(async () => {
    await page.goto("/?lang=ja", { waitUntil: "networkidle" });
    await expect(page.locator(".me-section")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#me-map")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#me-side-toggle")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#me-side-rail-count")).toHaveCount(1);
    await expect(page.locator("#me-side-rail-count")).toHaveText("");
    const railText = await page.locator(".me-side-rail-icons").innerText({ timeout: 5_000 });
    expect(railText).not.toContain("\u{1F4CB}");
    expect(railText).not.toMatch(/\d/);
  }).toPass({
    intervals: [1_500, 3_000, 5_000],
    timeout: 45_000,
  });
}

for (const profile of HOME_VIEWPORTS) {
  test(`home opens the map-first shell (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();

    try {
      await suppressMapLibreForSmoke(page);
      await expectMapFirstHomeShell(page);
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}

test("logged-in staging home keeps the map-first shell", async ({ browser, playwright }) => {
  const api = await createStagingApiContext(playwright);
  const userId = await resolveQaUserId(api);
  const rawCookie = await issueSessionCookie(api, userId);
  const context = await newStagingContext(browser, { slug: "desktop-1440", viewport: { width: 1440, height: 900 } });
  await addSessionCookie(context, rawCookie);
  const page = await context.newPage();

  try {
    await suppressMapLibreForSmoke(page);
    await expectMapFirstHomeShell(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/home-map-first-logged-in.png", fullPage: true });
  } finally {
    await context.close();
    await api.dispose();
  }
});
