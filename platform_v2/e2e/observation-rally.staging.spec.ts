import { test, expect } from "@playwright/test";
import {
  addSessionCookie,
  cleanupFixtures,
  createStagingApiContext,
  newStagingContext,
  requireEnv,
  seedRallyFixtures,
  type SeededRallyFixtureBundle,
  uniqueFixturePrefix,
} from "./support/staging.js";

type SessionPayload = {
  ok: boolean;
  error?: string;
};

type RallySnapshotPayload = {
  rally?: {
    missions?: Array<{ missionId: string; title: string; status: string; weatherSensitivity: string }>;
    progress?: Array<{ missionId: string; actualCount: number; goalCount: number; percent: number; status: string }>;
  };
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

test.describe.serial("observation rally staging smoke", () => {
  let writeKey = "";
  let fixturePrefix = "";
  let fixture: SeededRallyFixtureBundle;
  let api: Awaited<ReturnType<typeof createStagingApiContext>>;

  test.beforeAll(async ({ playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    api = await createStagingApiContext(playwright);
    fixturePrefix = uniqueFixturePrefix("rally-smoke");
    fixture = await seedRallyFixtures(api, writeKey, fixturePrefix);
  });

  test.afterAll(async () => {
    if (api && fixturePrefix) {
      await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
      await api.dispose();
    }
  });

  test("organizer rain mode and participant rally view stay coherent", async ({ browser }) => {
    const context = await newStagingContext(browser, {
      slug: "desktop-1280",
      viewport: { width: 1280, height: 800 },
    });
    await addSessionCookie(context, await issueSessionCookie(api, writeKey, fixture.user.userId));
    const page = await context.newPage();
    const pageErrors: string[] = [];
    const featureFailures: string[] = [];
    page.on("response", (response) => {
      const url = response.url();
      if (response.status() >= 400 && url.includes("/api/v1/observation-events/") && url.includes("/rally")) {
        featureFailures.push(`${response.status()} ${url}`);
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.goto(`/events/${fixture.session.sessionId}/console`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText("観察ラリー");
    await expect(page.locator("body")).toContainText("開催時間内に街路樹シーンを20件");
    await expect(page.locator("body")).toContainText("A地点で樹皮が見える街路樹シーンを3件");
    await expect(page.locator("body")).toContainText("210%");
    await expect(page.getByRole("button", { name: "雨天モードに切替" })).toBeVisible();

    await page.getByRole("button", { name: "雨天モードに切替" }).click();
    await expect(page.locator("body")).toContainText("雨天モードへ切替: 1件差し替え / 1件公開");
    await expect(page.locator("body")).toContainText("差し替え済");
    await expect(page.locator("body")).toContainText("雨天: 登録スポットで落ち葉シーンを3件");

    const response = await api.get(`/api/v1/observation-events/${fixture.session.sessionId}/rally`, {
      headers: { accept: "application/json" },
    });
    expect(response.ok(), "rally snapshot should be readable after rain switch").toBeTruthy();
    const snapshot = (await response.json()) as RallySnapshotPayload;
    const openProgress = snapshot.rally?.progress?.find((item) => item.missionId === fixture.missions.open.missionId);
    expect(openProgress?.actualCount).toBe(42);
    expect(openProgress?.goalCount).toBe(20);
    expect(openProgress?.percent).toBe(210);
    expect(openProgress?.status).toBe("exceeded");
    const sunny = snapshot.rally?.missions?.find((item) => item.missionId === fixture.missions.sunnyStation.missionId);
    const rain = snapshot.rally?.missions?.find((item) => item.missionId === fixture.missions.rainFallback.missionId);
    expect(sunny?.status).toBe("replaced");
    expect(rain?.status).toBe("published");

    await page.goto(`/events/${fixture.session.sessionId}/rally`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText("いまおすすめ");
    await expect(page.locator("body")).toContainText("42/20件 210%");
    await expect(page.locator("body")).toContainText("A地点");
    await expect(page.locator("body")).toContainText("雨天: 登録スポットで落ち葉シーンを3件");
    await expect(page.locator("body")).not.toContainText("1枚の写真に20本");

    expect(pageErrors).toEqual([]);
    expect(featureFailures).toEqual([]);
    await context.close();
  });

  test("cleanup removes the seeded rally session", async () => {
    await cleanupFixtures(api, writeKey, fixturePrefix);
    const response = await api.get(`/api/v1/observation-events/${fixture.session.sessionId}/rally`, {
      headers: { accept: "application/json" },
    });
    expect(response.status()).toBe(404);
  });
});
