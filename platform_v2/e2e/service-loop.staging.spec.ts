import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  addSessionCookie,
  createStagingApiContext,
  newStagingContext,
  type ViewportProfile,
} from "./support/staging.js";

const VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 1000 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const JA_FORBIDDEN_FALLBACKS = [
  "Unknown place",
  "Municipality unknown",
  "Unknown observer",
  "Awaiting ID",
  "No photo",
  "Unresolved",
  " ids",
];

type MaterializedContext = {
  userId: string | null;
  visitId: string | null;
  occurrenceId: string | null;
};

type SessionPayload = {
  ok: boolean;
  error?: string;
};

function firstMatch(source: string, pattern: RegExp): string | null {
  const match = source.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function resolveMaterializedContext(api: APIRequestContext): Promise<MaterializedContext> {
  const response = await api.get("/qa/site-map?lang=ja");
  expect(response.ok(), "/qa/site-map should be reachable with staging auth").toBeTruthy();
  const html = await response.text().catch(() => "");
  const detailLink = html.match(/\/observations\/([^"?&#]+)\?subject=([^"&#]+)/);
  const context = {
    userId: firstMatch(html, /\/home\?userId=([^"&]+)/) ?? firstMatch(html, /\/profile\/([^"?&#]+)/),
    visitId: detailLink?.[1] ? decodeURIComponent(detailLink[1]) : null,
    occurrenceId: detailLink?.[2] ? decodeURIComponent(detailLink[2]) : firstMatch(html, /\/observations\/([^"?&#]+)/),
  };
  expect(context.userId, "QA sitemap should expose a real user route").toBeTruthy();
  expect(context.visitId, "QA sitemap should expose a real observation visit").toBeTruthy();
  expect(context.occurrenceId, "QA sitemap should expose a real observation occurrence").toBeTruthy();
  return context;
}

async function issueSessionCookie(api: APIRequestContext, userId: string): Promise<string> {
  const writeKey = process.env.V2_PRIVILEGED_WRITE_API_KEY?.trim();
  expect(writeKey, "V2_PRIVILEGED_WRITE_API_KEY is required for logged-in service loop smoke").toBeTruthy();
  const response = await api.post("/api/v1/auth/session/issue", {
    headers: {
      "x-ikimon-write-key": writeKey,
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

async function expectNoJapaneseFallbackLeak(page: Page): Promise<void> {
  const visibleText = await page.locator("body").innerText();
  for (const token of JA_FORBIDDEN_FALLBACKS) {
    expect(visibleText, `Japanese UI should not leak "${token}"`).not.toContain(token);
  }
}

function appendLang(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}lang=ja`;
}

test.describe("Japanese service loop staging smoke", () => {
  let api: APIRequestContext;
  let materialized: MaterializedContext;
  let sessionCookie: string | null = null;

  test.beforeAll(async ({ playwright }) => {
    api = await createStagingApiContext(playwright);
    materialized = await resolveMaterializedContext(api);
    if (materialized.userId) {
      sessionCookie = await issueSessionCookie(api, materialized.userId);
    }
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  for (const profile of VIEWPORTS) {
    test(`major Japanese routes avoid fallback leaks (${profile.slug})`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile);
      if (sessionCookie) {
        await addSessionCookie(context, sessionCookie);
      }
      const page = await context.newPage();
      const routes = [
        "/",
        "/explore",
        "/notes",
        "/record",
        "/guide",
        "/guide/outcomes",
        "/map",
        materialized.userId ? `/profile/${encodeURIComponent(materialized.userId)}` : null,
        materialized.visitId && materialized.occurrenceId
          ? `/observations/${encodeURIComponent(materialized.visitId)}?subject=${encodeURIComponent(materialized.occurrenceId)}`
          : null,
      ].filter((route): route is string => Boolean(route));

      try {
        for (const route of routes) {
          const response = await page.goto(appendLang(route), { waitUntil: "domcontentloaded" });
          expect(response?.status() ?? 0, `${route} status`).toBeLessThan(500);
          await expect(page.locator("body")).toBeVisible();
          await expectNoHorizontalOverflow(page);
          await expectNoJapaneseFallbackLeak(page);
        }
      } finally {
        await context.close();
      }
    });
  }
});
