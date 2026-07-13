import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  addSessionCookie,
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
  highlights?: {
    observationCount?: number;
    uniqueSpeciesCount?: number;
    participantsCount?: number;
  };
  myContribution?: {
    displayName?: string | null;
    observationsCount?: number;
  } | null;
};

function cookieHeader(rawCookie: string): string {
  return rawCookie.split(";")[0] ?? rawCookie;
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
    headers: {
      cookie,
      "content-type": "application/json",
      accept: "application/json",
    },
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
  suffix: string,
  taxonName: string,
): Promise<void> {
  await expectOk(await api.post("/api/v1/observations/upsert", {
    headers: {
      cookie,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      observationId: `${fixturePrefix}-${suffix}-visit`,
      clientSubmissionId: `${fixturePrefix}-${suffix}-client`,
      userId,
      observedAt: new Date().toISOString(),
      latitude: 34.8127,
      longitude: 137.7287,
      visibility: "private",
      note: `連理サイエンスアドベンチャー通しテスト ${suffix}`,
      eventCode: fixture.session.eventCode,
      eventSessionId: fixture.session.sessionId,
      participantRole: "participant",
      taxon: {
        vernacularName: taxonName,
        rank: "species",
      },
      sourcePayload: {
        source: "rally_smoke_renri_family_journey",
        fixturePrefix,
      },
    },
  }), `post_observation:${suffix}`);
}

test.describe.serial("renri science adventure family journey on staging", () => {
  let writeKey = "";
  let fixturePrefix = "";
  let fixture: SeededRallyFixtureBundle;
  let api: APIRequestContext;
  let parentUserId = "";
  let observerUserId = "";
  let noLocationUserId = "";
  let parentCookie = "";
  let observerCookie = "";
  let noLocationCookie = "";
  let guestToken = "";

  test.beforeAll(async ({ playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    api = await createStagingApiContext(playwright);
    fixturePrefix = uniqueFixturePrefix("rally-smoke-renri");
    fixture = await seedRallyFixtures(api, writeKey, fixturePrefix);

    parentUserId = `${fixturePrefix}-parent`;
    observerUserId = `${fixturePrefix}-observer`;
    noLocationUserId = `${fixturePrefix}-no-location`;
    parentCookie = cookieHeader(await issueSessionCookie(api, writeKey, parentUserId));
    observerCookie = cookieHeader(await issueSessionCookie(api, writeKey, observerUserId));
    noLocationCookie = cookieHeader(await issueSessionCookie(api, writeKey, noLocationUserId));
  });

  test.afterAll(async () => {
    if (api && fixturePrefix) {
      await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
      await api.dispose();
    }
  });

  test("guest family, registered participants, posts and recap complete as one journey", async ({ browser }) => {
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
        return;
      }
      await route.continue();
    });

    await guestPage.goto(`/community/events/${encodeURIComponent(fixture.session.eventCode)}/join`, { waitUntil: "domcontentloaded" });
    await expect(guestPage.locator("body")).toContainText("家族・グループは、スマホ1台で参加できます");
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
    guestToken = new URL(guestPage.url()).searchParams.get("token") ?? "";
    expect(guestToken).toMatch(/^g_/);
    const storedGuestToken = await guestPage.evaluate((sessionId) => localStorage.getItem(`evt-guest-token:${sessionId}`), fixture.session.sessionId);
    expect(storedGuestToken).toBe(guestToken);
    await guestContext.close();

    const parentContext = await newStagingContext(browser, {
      slug: "mobile-390",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await addSessionCookie(parentContext, parentCookie);
    const parentPage = await parentContext.newPage();
    await parentPage.goto(`/community/events/${encodeURIComponent(fixture.session.eventCode)}/join`, { waitUntil: "domcontentloaded" });
    await parentPage.locator('input[name="display_name"]').fill("登録済み保護者テスト");
    await parentPage.locator('input[name="share_location"]').uncheck();
    await parentPage.locator('input[name="is_minor"]').check();
    await expect(parentPage.locator("[data-guardian-consent-row]")).toBeHidden();
    await parentPage.locator("[data-evt-checkin-submit]").click();
    await expect(parentPage).toHaveURL(new RegExp(`/events/${fixture.session.sessionId}/rally$`));
    expect(new URL(parentPage.url()).searchParams.has("token")).toBe(false);
    await parentContext.close();

    await checkInRegistered(api, fixture.session.sessionId, observerCookie, "観察担当テスト", true);
    await checkInRegistered(api, fixture.session.sessionId, noLocationCookie, "位置共有なしテスト", false);

    await postObservation(api, fixture, fixturePrefix, parentCookie, parentUserId, "parent", "ナナホシテントウ");
    await postObservation(api, fixture, fixturePrefix, observerCookie, observerUserId, "observer", "シロツメクサ");

    await expect.poll(async () => {
      const response = await api.get(`/api/v1/observation-events/${fixture.session.sessionId}/recap`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok()) return null;
      const recap = (await response.json()) as RecapPayload;
      return {
        observations: recap.highlights?.observationCount ?? 0,
        species: recap.highlights?.uniqueSpeciesCount ?? 0,
        participants: recap.highlights?.participantsCount ?? 0,
      };
    }, {
      timeout: 60_000,
      intervals: [1_000, 2_000, 5_000],
    }).toEqual({ observations: 2, species: 2, participants: 4 });

    const parentRecapResponse = await api.get(`/api/v1/observation-events/${fixture.session.sessionId}/recap`, {
      headers: { cookie: parentCookie, accept: "application/json" },
    });
    expect(parentRecapResponse.ok()).toBeTruthy();
    const parentRecap = (await parentRecapResponse.json()) as RecapPayload;
    expect(parentRecap.myContribution?.displayName).toBe("登録済み保護者テスト");
    expect(parentRecap.myContribution?.observationsCount).toBe(1);

    const guestRecapResponse = await api.get(`/api/v1/observation-events/${fixture.session.sessionId}/recap?token=${encodeURIComponent(guestToken)}`, {
      headers: { accept: "application/json" },
    });
    expect(guestRecapResponse.ok()).toBeTruthy();
    const guestRecap = (await guestRecapResponse.json()) as RecapPayload;
    expect(guestRecap.myContribution?.displayName).toBe("れんり家テスト");
    expect(guestRecap.myContribution?.observationsCount).toBe(0);

    const recapContext = await newStagingContext(browser, {
      slug: "mobile-390",
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const recapPage = await recapContext.newPage();
    await recapPage.goto(`/events/${fixture.session.sessionId}/recap?token=${encodeURIComponent(guestToken)}`, { waitUntil: "domcontentloaded" });
    await expect(recapPage.locator("body")).toContainText(fixture.session.title);
    await expect(recapPage.locator("body")).toContainText("れんり家テスト");
    await recapContext.close();
  });
});
