import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  cleanupFixtures,
  createStagingApiContext,
  newStagingContext,
  requireEnv,
  seedRegressionFixtures,
  type SeededRegressionFixtureBundle,
  uniqueFixturePrefix,
  waitForMapReady,
} from "./support/staging.js";

type MapObservationsPayload = {
  features: Array<{
    properties?: {
      occurrenceId?: string;
      visitId?: string;
      displayName?: string;
    };
  }>;
  stats?: {
    markerProfile?: string;
  };
};

type RouteErrorPayload = {
  ok?: boolean;
  error?: string;
};

function collectOccurrenceIds(payload: MapObservationsPayload): Set<string> {
  return new Set(
    payload.features
      .map((feature) => feature.properties?.occurrenceId ?? "")
      .filter(Boolean),
  );
}

test.describe.serial("notes/map regression staging fixtures", () => {
  let api: APIRequestContext;
  let fixturePrefix = "";
  let writeKey = "";
  let fixture: SeededRegressionFixtureBundle;
  let cleanedUp = false;

  test.beforeAll(async ({ playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    api = await createStagingApiContext(playwright);
    fixturePrefix = uniqueFixturePrefix("notes-map-regression");
    fixture = await seedRegressionFixtures(api, writeKey, fixturePrefix);
  });

  test.afterAll(async () => {
    if (!cleanedUp) {
      await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
    }
    await api.dispose();
  });

  test("seed regression route rejects requests without privileged key", async ({ playwright }) => {
    const probeApi = await createStagingApiContext(playwright);
    const response = await probeApi.post("/api/v1/ops/staging/fixtures/seed-regression", {
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      data: {
        fixturePrefix: uniqueFixturePrefix("notes-map-regression-forbidden"),
      },
    });
    const payload = (await response.json()) as RouteErrorPayload;
    expect(response.status()).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("forbidden_privileged_write");
    await probeApi.dispose();
  });

  test("map API excludes smoke fixtures and respects marker profiles", async () => {
    const defaultResponse = await api.get("/api/v1/map/observations?limit=1500", {
      headers: { accept: "application/json" },
    });
    expect(defaultResponse.ok()).toBeTruthy();
    const defaultPayload = (await defaultResponse.json()) as MapObservationsPayload;
    const defaultIds = collectOccurrenceIds(defaultPayload);
    expect(defaultPayload.stats?.markerProfile).toBe("all_research_artifacts");
    expect(defaultIds.has(fixture.manual.occurrenceId)).toBeTruthy();
    expect(defaultIds.has(fixture.historical.occurrenceId)).toBeTruthy();
    expect(defaultIds.has(fixture.smoke.occurrenceId)).toBeFalsy();

    const manualOnlyResponse = await api.get("/api/v1/map/observations?limit=1500&marker_profile=manual_only", {
      headers: { accept: "application/json" },
    });
    expect(manualOnlyResponse.ok()).toBeTruthy();
    const manualOnlyPayload = (await manualOnlyResponse.json()) as MapObservationsPayload;
    const manualOnlyIds = collectOccurrenceIds(manualOnlyPayload);
    expect(manualOnlyPayload.stats?.markerProfile).toBe("manual_only");
    expect(manualOnlyIds.has(fixture.manual.occurrenceId)).toBeTruthy();
    expect(manualOnlyIds.has(fixture.historical.occurrenceId)).toBeFalsy();
    expect(manualOnlyIds.has(fixture.smoke.occurrenceId)).toBeFalsy();

    const explicitAllResponse = await api.get("/api/v1/map/observations?limit=1500&marker_profile=all_research_artifacts", {
      headers: { accept: "application/json" },
    });
    expect(explicitAllResponse.ok()).toBeTruthy();
    const explicitAllPayload = (await explicitAllResponse.json()) as MapObservationsPayload;
    const explicitAllIds = collectOccurrenceIds(explicitAllPayload);
    expect(explicitAllPayload.stats?.markerProfile).toBe("all_research_artifacts");
    expect(explicitAllIds.has(fixture.manual.occurrenceId)).toBeTruthy();
    expect(explicitAllIds.has(fixture.historical.occurrenceId)).toBeTruthy();
    expect(explicitAllIds.has(fixture.smoke.occurrenceId)).toBeFalsy();
  });

  test("notes/profile/map UI uses display names and keeps smoke fixtures out of public surfaces", async ({ browser }) => {
    const context = await newStagingContext(browser, {
      slug: "notes-map-regression",
      viewport: { width: 1440, height: 960 },
    });

    const notesPage = await context.newPage();
    await notesPage.goto(`/notes?userId=${encodeURIComponent(fixture.user.userId)}`, { waitUntil: "domcontentloaded" });
    await expect(notesPage.getByTestId("notes-own")).toContainText(fixture.manual.subjectLabel);
    await expect(notesPage.getByTestId("notes-own")).toContainText(fixture.historical.subjectLabel);
    await expect(notesPage.getByTestId("notes-own")).toContainText(fixture.user.displayName);
    await expect(notesPage.getByTestId("notes-own")).not.toContainText(fixture.user.userId);
    await expect(notesPage.getByTestId("notes-nearby")).not.toContainText(fixture.smoke.subjectLabel);

    const profilePage = await context.newPage();
    await profilePage.goto(`/profile/${encodeURIComponent(fixture.user.userId)}`, { waitUntil: "domcontentloaded" });
    await expect(profilePage.getByTestId("profile-heading")).toHaveText(fixture.user.displayName);
    await expect(profilePage.getByTestId("profile-heading")).not.toContainText(fixture.user.userId);

    const mapPage = await context.newPage();
    await waitForMapReady(mapPage, "/map");
    await expect(mapPage.getByTestId("map-result-list")).toContainText(fixture.historical.subjectLabel);
    await mapPage.locator("#me-share-state").click();
    await expect.poll(() => new URL(mapPage.url()).searchParams.get("mp")).toBeNull();

    const sharedUrl = mapPage.url();
    const restoredPage = await context.newPage();
    await waitForMapReady(restoredPage, sharedUrl);
    await expect(restoredPage.getByTestId("map-result-list")).toContainText(fixture.historical.subjectLabel);

    await context.close();
  });

  test("cleanup route removes seeded fixtures from map API", async () => {
    await cleanupFixtures(api, writeKey, fixturePrefix);
    cleanedUp = true;

    const response = await api.get("/api/v1/map/observations?limit=1500&marker_profile=all_research_artifacts", {
      headers: { accept: "application/json" },
    });
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as MapObservationsPayload;
    const ids = collectOccurrenceIds(payload);
    expect(ids.has(fixture.manual.occurrenceId)).toBeFalsy();
    expect(ids.has(fixture.historical.occurrenceId)).toBeFalsy();
    expect(ids.has(fixture.smoke.occurrenceId)).toBeFalsy();
  });
});
