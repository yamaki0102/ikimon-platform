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
  items: Array<{
    occurrenceId?: string;
    visitId?: string;
    displayName?: string;
  }>;
  stats?: {
    markerProfile?: string;
    totalReturned?: number;
    totalAll?: number;
  };
};

type RouteErrorPayload = {
  ok?: boolean;
  error?: string;
};

function collectOccurrenceIds(payload: MapObservationsPayload): Set<string> {
  return new Set(
    payload.items
      .map((item) => item.occurrenceId ?? "")
      .filter(Boolean),
  );
}

type MapObservationProbe = {
  ok: boolean;
  markerProfile: string | null;
  ids: Set<string>;
  totalReturned: number | null;
  totalAll: number | null;
  sample: string[];
};

async function fetchMapObservationProbe(api: APIRequestContext, path: string): Promise<MapObservationProbe> {
  const response = await api.get(path, {
    headers: { accept: "application/json" },
  });
  const payload = (await response.json().catch(() => ({ items: [] }))) as MapObservationsPayload;
  const ids = collectOccurrenceIds(payload);
  return {
    ok: response.ok(),
    markerProfile: payload.stats?.markerProfile ?? null,
    ids,
    totalReturned: typeof payload.stats?.totalReturned === "number" ? payload.stats.totalReturned : null,
    totalAll: typeof payload.stats?.totalAll === "number" ? payload.stats.totalAll : null,
    sample: Array.from(ids).slice(0, 8),
  };
}

async function waitForMapObservationProbe(
  api: APIRequestContext,
  path: string,
  expected: {
    markerProfile: string;
    requiredIds: string[];
    forbiddenIds: string[];
  },
): Promise<MapObservationProbe> {
  const deadline = Date.now() + 10_000;
  let last: MapObservationProbe | null = null;
  while (Date.now() <= deadline) {
    last = await fetchMapObservationProbe(api, path);
    const missing = expected.requiredIds.filter((id) => !last!.ids.has(id));
    const unexpected = expected.forbiddenIds.filter((id) => last!.ids.has(id));
    if (last.ok && last.markerProfile === expected.markerProfile && missing.length === 0 && unexpected.length === 0) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const missing = expected.requiredIds.filter((id) => !last?.ids.has(id));
  const unexpected = expected.forbiddenIds.filter((id) => last?.ids.has(id));
  throw new Error([
    `map_observation_probe_failed path=${path}`,
    `ok=${last?.ok ?? false}`,
    `markerProfile=${last?.markerProfile ?? "missing"}`,
    `totalReturned=${last?.totalReturned ?? "missing"}`,
    `totalAll=${last?.totalAll ?? "missing"}`,
    `missing=${missing.join(",") || "none"}`,
    `unexpected=${unexpected.join(",") || "none"}`,
    `sample=${last?.sample.join(",") || "empty"}`,
  ].join(" "));
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

  test("map API exposes fixed public snapshot and excludes smoke fixtures", async () => {
    const bbox = "122.9,24.0,146.0,45.6";
    const allProbe = await waitForMapObservationProbe(api, `/api/v1/map/observations?bbox=${bbox}&limit=1500`, {
      markerProfile: "all_research_artifacts",
      requiredIds: [],
      forbiddenIds: [fixture.smoke.occurrenceId],
    });
    expect(allProbe.totalReturned ?? 0).toBeGreaterThan(0);
    expect(allProbe.totalAll ?? 0).toBeGreaterThan(0);
  });

  test("notes/profile/map UI uses display names and keeps smoke fixtures out of public surfaces", async ({ browser }) => {
    const context = await newStagingContext(browser, {
      slug: "notes-map-regression",
      viewport: { width: 1440, height: 960 },
    });

    const notesPage = await context.newPage();
    await notesPage.goto(`/records?view=mine&userId=${encodeURIComponent(fixture.user.userId)}`, { waitUntil: "domcontentloaded" });
    await expect(notesPage.getByTestId("records-workbench")).toContainText(fixture.manual.subjectLabel);
    await expect(notesPage.getByTestId("records-workbench")).toContainText(fixture.historical.subjectLabel);
    await expect(notesPage.getByTestId("records-workbench")).toContainText(fixture.user.displayName);
    await expect(notesPage.getByTestId("records-workbench")).not.toContainText(fixture.user.userId);
    await expect(notesPage.getByTestId("records-workbench")).not.toContainText(fixture.smoke.subjectLabel);

    const profilePage = await context.newPage();
    await profilePage.goto(`/profile/${encodeURIComponent(fixture.user.userId)}`, { waitUntil: "domcontentloaded" });
    await expect(profilePage.getByTestId("profile-heading")).toHaveText(fixture.user.displayName);
    await expect(profilePage.getByTestId("profile-heading")).not.toContainText(fixture.user.userId);

    const mapPage = await context.newPage();
    await waitForMapReady(mapPage, "/map");
    await expect(mapPage.getByTestId("map-result-list")).not.toContainText(fixture.smoke.subjectLabel);
    await mapPage.locator(".me-filter-toggle").click();
    await expect(mapPage.locator(".me-filter-drawer")).toHaveAttribute("open", "");
    await expect(mapPage.locator(".me-filter-panel")).toBeVisible();
    await mapPage.locator("#me-share-state").click();
    await expect.poll(() => new URL(mapPage.url()).searchParams.get("mp")).toBeNull();

    const sharedUrl = mapPage.url();
    const restoredPage = await context.newPage();
    await waitForMapReady(restoredPage, sharedUrl);
    await expect(restoredPage.getByTestId("map-result-list")).not.toContainText(fixture.smoke.subjectLabel);

    await context.close();
  });

  test("map detail target opens observation detail without SQL 500", async () => {
    const response = await api.get("/api/v1/map/observations?bbox=122.9,24.0,146.0,45.6&limit=20", {
      headers: { accept: "application/json" },
    });
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as MapObservationsPayload;
    const target = payload.items.find((item) => item.visitId);
    expect(target?.visitId).toBeTruthy();

    const detailResponse = await api.get(`/observations/${encodeURIComponent(target!.visitId!)}`, {
      headers: { accept: "text/html" },
    });
    expect(detailResponse.status()).toBeLessThan(500);
    expect(detailResponse.ok()).toBeTruthy();
    const html = await detailResponse.text();
    expect(html).not.toContain('{"statusCode":500');
    expect(html).not.toContain("列u.avatar_urlは存在しません");
  });

  test("cleanup route removes seeded fixtures from map API", async () => {
    await cleanupFixtures(api, writeKey, fixturePrefix);
    cleanedUp = true;

    const response = await api.get("/api/v1/map/observations?bbox=122.9,24.0,146.0,45.6&limit=1500&marker_profile=all_research_artifacts", {
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
