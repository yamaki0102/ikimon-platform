import { test, expect } from "@playwright/test";
import {
  addSessionCookie,
  cleanupFixtures,
  createStagingApiContext,
  newStagingContext,
  requireEnv,
  seedRegressionFixtures,
  uniqueFixturePrefix,
} from "./support/staging.js";

type SessionPayload = {
  ok: boolean;
  error?: string;
};

async function issueSessionCookie(
  api: Awaited<ReturnType<typeof createStagingApiContext>>,
  writeKey: string,
  userId: string,
): Promise<string> {
  const response = await api.post("/api/v1/auth/session/issue", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      userId,
      ttlHours: 2,
    },
  });
  const payload = (await response.json()) as SessionPayload;
  expect(response.ok(), payload.error ?? "session_issue_failed").toBeTruthy();
  const rawCookie = response.headers()["set-cookie"];
  expect(rawCookie).toBeTruthy();
  return rawCookie;
}

test("mypage keeps profile content inside the mobile viewport", async ({ browser, playwright }) => {
  const writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
  const api = await createStagingApiContext(playwright);
  const fixturePrefix = uniqueFixturePrefix("profile-mobile");
  const fixture = await seedRegressionFixtures(api, writeKey, fixturePrefix);

  try {
    const context = await newStagingContext(browser, {
      slug: "mobile-390",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await addSessionCookie(context, await issueSessionCookie(api, writeKey, fixture.user.userId));
    const page = await context.newPage();
    await page.goto("/profile?lang=ja", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("profile-summary")).toBeVisible();
    await expect(page.getByTestId("profile-next-actions")).toBeVisible();

    const overflow = await page.evaluate(() => {
      const clientWidth = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const offenders = Array.from(document.querySelectorAll("body *"))
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            className: typeof el.className === "string" ? el.className : "",
            text: (el.textContent ?? "").trim().slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          };
        })
        .filter((item) => item.left < -1 || item.right > clientWidth + 1)
        .slice(0, 8);
      return { clientWidth, scrollWidth, offenders };
    });

    expect(overflow.scrollWidth, JSON.stringify(overflow.offenders)).toBeLessThanOrEqual(overflow.clientWidth + 1);
    expect(overflow.offenders).toEqual([]);
    await context.close();
  } finally {
    await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
    await api.dispose();
  }
});
