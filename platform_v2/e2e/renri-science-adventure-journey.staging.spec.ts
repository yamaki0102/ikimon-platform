import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  cleanupFixtures,
  createStagingApiContext,
  issueSessionCookie,
  newStagingContext,
  requireEnv,
  seedRallyFixtures,
  type SeededRallyFixtureBundle,
  uniqueFixturePrefix,
} from "./support/staging.js";

type JsonObject = Record<string, unknown>;
type RecapPayload = {
  highlights?: { observationCount?: number; uniqueSpeciesCount?: number; participantsCount?: number };
  myContribution?: { displayName?: string | null; observationsCount?: number } | null;
};
type SessionPayload = { ok?: boolean; session?: { userId?: string; displayName?: string } | null };
type ObservationPayload = { userId?: string; eventCode?: string; eventSessionId?: string; participantRole?: string };

function cookieHeader(rawCookie: string): string {
  return rawCookie.split(";")[0] ?? rawCookie;
}

function tinyPngFile(): { name: string; mimeType: string; buffer: Buffer } {
  return {
    name: "renri-science-adventure.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAgCXa7QJAAAAAElFTkSuQmCC", "base64"),
  };
}

async function expectOk(response: Awaited<ReturnType<APIRequestContext["post"]>>, label: string): Promise<JsonObject> {
  const payload = (await response.json().catch(() => null)) as JsonObject | null;
  expect(response.ok(), `${label}: ${JSON.stringify(payload)}`).toBeTruthy();
  return payload ?? {};
}

async function checkInRegistered(
  api: APIRequestContext,
  sessionId: string,
  cookie: string,
  displayName: string,
  shareLocation: boolean,
): Promise<void> {
  await expectOk(await api.post(`/api/v1/observation-events/${sessionId}/checkin`, {
    headers: { cookie, "content-type": "application/json", accept: "application/json" },
    data: {
      display_name: displayName,
      team_id: null,
      share_location: shareLocation,
      is_minor: false,
      guardian_location_consent: false,
      location_share_consent_type: shareLocation ? "self" : null,
    },
  }), `checkin:${displayName}`);
}

async function postObservation(
  api: APIRequestContext,
  fixture: SeededRallyFixtureBundle,
  fixturePrefix: string,
  cookie: string,
  userId: string,
): Promise<void> {
  await expectOk(await api.post("/api/v1/observations/upsert", {
    headers: { cookie, "content-type": "application/json", accept: "application/json" },
    data: {
      observationId: `${fixturePrefix}-observer-visit`,
      clientSubmissionId: `${fixturePrefix}-observer-client`,
      userId,
      observedAt: new Date().toISOString(),
      latitude: 34.8127,
      longitude: 137.7287,
      visibility: "private",
      note: "連理サイエンスアドベンチャー通しテスト observer",
      eventCode: fixture.session.eventCode,
      eventSessionId: fixture.session.sessionId,
      participantRole: "participant",
      taxon: { vernacularName: "シロツメクサ", rank: "species" },
      sourcePayload: { source: "rally_smoke_renri_family_journey", fixturePrefix },
    },
  }), "post_observation:observer");
}

test.describe.serial("renri science adventure family journey on staging", () => {
  let writeKey = "";
  let fixturePrefix = "";
  let fixture: SeededRallyFixtureBundle;
  let api: APIRequestContext;
  let observerUserId = "";
  let noLocationUserId = "";
  let observerCookie = "";
  let noLocationCookie = "";

  test.beforeAll(async ({ playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    api = await createStagingApiContext(playwright);
    fixturePrefix = uniqueFixturePrefix("rally-smoke-renri");
    fixture = await seedRallyFixtures(api, writeKey, fixturePrefix);
    observerUserId = `${fixturePrefix}-observer`;
    noLocationUserId = `${fixturePrefix}-no-location`;
    observerCookie = cookieHeader(await issueSessionCookie(api, writeKey, observerUserId));
    noLocationCookie = cookieHeader(await issueSessionCookie(api, writeKey, noLocationUserId));
  });

  test.afterAll(async () => {
    if (api && fixturePrefix) {
      await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
      await api.dispose();
    }
  });

  test("guest family, public registration, mobile post and recap complete as one journey", async ({ browser }) => {
    const joinPath = `/community/events/${encodeURIComponent(fixture.session.eventCode)}/join`;

    const guestContext = await newStagingContext(browser, {
      slug: "mobile-390",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const guestPage = await guestContext.newPage();
    let failFirstCheckin = true;
    await guestPage.route(`**/api/v1/observation-events/${fixture.session.sessionId}/checkin`, async (route) => {
      if (failFirstCheckin) {
        failFirstCheckin = false;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary" }) });
      } else {
        await route.continue();
      }
    });

    await guestPage.goto(joinPath, { waitUntil: "domcontentloaded" });
    await expect(guestPage.locator("body")).toContainText("家族・グループは、スマホ1台で参加できます");
    await expect(guestPage.locator("[data-evt-register-link]")).toBeVisible();
    await guestPage.locator('input[name="display_name"]').fill("れんり家テスト");
    await guestPage.locator('input[name="is_minor"]').check();
    await expect(guestPage.locator("[data-guardian-consent-row]")).toBeVisible();
    await guestPage.locator("[data-evt-checkin-submit]").click();
    await expect(guestPage.locator("[data-evt-checkin-status]")).toContainText("保護者または引率者の同意");
    await guestPage.locator('input[name="guardian_location_consent"]').check();
    await guestPage.locator("[data-evt-checkin-submit]").click();
    await expect(guestPage.locator("[data-evt-checkin-status]")).toContainText("入力内容は残っています");
    await expect(guestPage.locator('input[name="display_name"]')).toHaveValue("れんり家テスト");
    await guestPage.locator("[data-evt-checkin-submit]").click();
    await expect(guestPage).toHaveURL(new RegExp(`/events/${fixture.session.sessionId}/rally\\?token=`));
    const guestToken = new URL(guestPage.url()).searchParams.get("token") ?? "";
    expect(guestToken).toMatch(/^g_/);
    expect(await guestPage.evaluate((id) => localStorage.getItem(`evt-guest-token:${id}`), fixture.session.sessionId)).toBe(guestToken);
    await expect(guestPage.locator("[data-rally-account-note]")).toContainText("写真の観察記録は無料アカウントに保存します");
    await guestPage.locator('[data-rally-action="record"]').first().click();
    await expect(guestPage).toHaveURL(/\/register\?redirect=/);
    const guestReturn = new URL(guestPage.url()).searchParams.get("redirect") ?? "";
    const guestRecordUrl = new URL(guestReturn, "https://staging.ikimon.life");
    expect(guestRecordUrl.pathname).toBe("/record");
    expect(guestRecordUrl.searchParams.get("event")).toBe(fixture.session.eventCode);
    expect(guestRecordUrl.searchParams.get("eventSessionId")).toBe(fixture.session.sessionId);
    await guestContext.close();

    const parentContext = await newStagingContext(browser, {
      slug: "mobile-390",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const parentPage = await parentContext.newPage();
    await parentPage.goto(joinPath, { waitUntil: "domcontentloaded" });
    await parentPage.locator('input[name="display_name"]').fill("登録済み保護者テスト");
    await parentPage.locator('input[name="share_location"]').uncheck();
    await parentPage.locator('input[name="is_minor"]').check();
    await expect(parentPage.locator("[data-guardian-consent-row]")).toBeHidden();
    await parentPage.locator("[data-evt-register-link]").click();
    await expect(parentPage).toHaveURL(/\/register\?redirect=/);

    const registrationEmail = `${fixturePrefix}@example.invalid`;
    await parentPage.locator('input[name="displayName"]').fill("登録テスト保護者");
    await parentPage.locator('input[name="email"]').fill(registrationEmail);
    await parentPage.locator('input[name="password"]').fill("RenriTest-2026!");
    await parentPage.locator("[data-auth-form] button[type='submit']").click();
    await expect(parentPage).toHaveURL(new RegExp(`${joinPath}$`), { timeout: 30_000 });
    await expect(parentPage.locator("body")).toContainText("ログイン済みアカウントで参加します");
    await expect(parentPage.locator('input[name="display_name"]')).toHaveValue("登録済み保護者テスト");
    await expect(parentPage.locator('input[name="share_location"]')).not.toBeChecked();
    await expect(parentPage.locator('input[name="is_minor"]')).toBeChecked();

    const sessionResponse = await parentContext.request.get("/api/v1/auth/session", { headers: { accept: "application/json" } });
    expect(sessionResponse.ok()).toBeTruthy();
    const session = (await sessionResponse.json()) as SessionPayload;
    const parentUserId = session.session?.userId ?? "";
    expect(parentUserId).toMatch(/^user_/);
    expect(session.session?.displayName).toBe("登録テスト保護者");

    await parentPage.locator("[data-evt-checkin-submit]").click();
    await expect(parentPage).toHaveURL(new RegExp(`/events/${fixture.session.sessionId}/rally$`));
    expect(new URL(parentPage.url()).searchParams.has("token")).toBe(false);

    await parentPage.route("**/api/v1/observations/*/photos/upload", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, photo: { publicUrl: "/uploads/qa/renri-science-adventure.png" } }) });
    });
    await parentPage.locator('[data-rally-action="record"]').first().click();
    await expect(parentPage).toHaveURL(/\/record\?/);
    const recordUrl = new URL(parentPage.url());
    expect(recordUrl.searchParams.get("event")).toBe(fixture.session.eventCode);
    expect(recordUrl.searchParams.get("eventSessionId")).toBe(fixture.session.sessionId);
    expect(recordUrl.searchParams.get("rally")).toBe("1");
    expect(recordUrl.searchParams.get("activityIntent")).toBe("share");

    await parentPage.locator("#record-media-photo").setInputFiles(tinyPngFile());
    await expect(parentPage.locator("#record-form")).toBeVisible();
    await parentPage.locator("summary", { hasText: "座標を直接編集" }).click();
    await parentPage.locator("input[name='latitude']").fill("34.812700");
    await parentPage.locator("input[name='longitude']").fill("137.728700");
    const upsertPromise = parentPage.waitForResponse((response) => response.url().includes("/api/v1/observations/upsert") && response.request().method() === "POST");
    await parentPage.locator("#record-submit-panel button[type='submit']").click();
    const upsert = await upsertPromise;
    expect(upsert.ok(), await upsert.text()).toBeTruthy();
    const observation = upsert.request().postDataJSON() as ObservationPayload;
    expect(observation.userId).toBe(parentUserId);
    expect(observation.eventCode).toBe(fixture.session.eventCode);
    expect(observation.eventSessionId).toBe(fixture.session.sessionId);
    expect(observation.participantRole).toBe("participant");
    await expect(parentPage.locator("#record-status")).toContainText(/記録を保存しました|シーンを保存しました/);

    await checkInRegistered(api, fixture.session.sessionId, observerCookie, "観察担当テスト", true);
    await checkInRegistered(api, fixture.session.sessionId, noLocationCookie, "位置共有なしテスト", false);
    await postObservation(api, fixture, fixturePrefix, observerCookie, observerUserId);

    await expect.poll(async () => {
      const response = await api.get(`/api/v1/observation-events/${fixture.session.sessionId}/recap`, { headers: { accept: "application/json" } });
      if (!response.ok()) return null;
      const recap = (await response.json()) as RecapPayload;
      return {
        observationsReady: (recap.highlights?.observationCount ?? 0) >= 2,
        speciesReady: (recap.highlights?.uniqueSpeciesCount ?? 0) >= 1,
        participants: recap.highlights?.participantsCount ?? 0,
      };
    }, { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }).toEqual({ observationsReady: true, speciesReady: true, participants: 5 });

    const parentRecapResponse = await parentContext.request.get(`/api/v1/observation-events/${fixture.session.sessionId}/recap`, { headers: { accept: "application/json" } });
    expect(parentRecapResponse.ok()).toBeTruthy();
    const parentRecap = (await parentRecapResponse.json()) as RecapPayload;
    expect(parentRecap.myContribution?.displayName).toBe("登録済み保護者テスト");
    expect(parentRecap.myContribution?.observationsCount).toBe(1);
    await parentContext.close();

    const guestRecapResponse = await api.get(`/api/v1/observation-events/${fixture.session.sessionId}/recap?token=${encodeURIComponent(guestToken)}`, { headers: { accept: "application/json" } });
    expect(guestRecapResponse.ok()).toBeTruthy();
    const guestRecap = (await guestRecapResponse.json()) as RecapPayload;
    expect(guestRecap.myContribution?.displayName).toBe("れんり家テスト");
    expect(guestRecap.myContribution?.observationsCount).toBe(0);
  });
});
