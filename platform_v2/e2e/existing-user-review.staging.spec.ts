import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import sharp from "sharp";
import {
  addSessionCookie,
  cleanupFixtures,
  createStagingApiContext,
  issueSessionCookie,
  newStagingContext,
  requireEnv,
  uniqueFixturePrefix,
  type ViewportProfile,
} from "./support/staging.js";

const VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 900 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

type ObservationPayload = {
  ok?: boolean;
  error?: string;
  visitId?: string;
  occurrenceId?: string;
};

function cookieHeader(rawCookie: string): string {
  return rawCookie.split(";")[0] ?? rawCookie;
}

async function visualPhotoBase64(index: number): Promise<string> {
  const palettes = [
    { background: "#0f9f8f", accent: "#facc15" },
    { background: "#2563eb", accent: "#f97316" },
    { background: "#7c3aed", accent: "#22c55e" },
  ];
  const palette = palettes[index % palettes.length]!;
  const svg = `<svg width="420" height="315" viewBox="0 0 420 315" xmlns="http://www.w3.org/2000/svg">
    <rect width="420" height="315" rx="0" fill="${palette.background}"/>
    <circle cx="96" cy="92" r="42" fill="${palette.accent}" opacity=".95"/>
    <path d="M0 250 C70 198 128 220 190 182 C264 136 326 168 420 104 L420 315 L0 315 Z" fill="#f8fafc" opacity=".86"/>
    <path d="M0 284 C84 236 142 260 222 214 C298 170 354 198 420 146 L420 315 L0 315 Z" fill="#14532d" opacity=".48"/>
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
  return buffer.toString("base64");
}

async function upsertUser(api: APIRequestContext, writeKey: string, userId: string): Promise<void> {
  const response = await api.post("/api/v1/users/upsert", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      userId,
      displayName: `既存ユーザー体験QA ${userId}`,
      email: `${userId}@example.invalid`,
      roleName: "Observer",
      rankLabel: "観察者",
      authProvider: "playwright",
      banned: false,
    },
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  expect(response.ok(), payload?.error ?? `upsert user ${userId}`).toBeTruthy();
}

async function createObservation(
  api: APIRequestContext,
  sessionCookie: string,
  input: {
    fixturePrefix: string;
    userId: string;
    index: number;
    latitude: number;
    longitude: number;
    taxon: string;
    observedAt: string;
  },
): Promise<ObservationPayload> {
  const response = await api.post("/api/v1/observations/upsert", {
    headers: {
      cookie: sessionCookie,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      observationId: `${input.fixturePrefix}-own-place-${input.index}`,
      clientSubmissionId: `${input.fixturePrefix}-own-place-${input.index}-${Date.now()}`,
      userId: input.userId,
      observedAt: input.observedAt,
      latitude: input.latitude,
      longitude: input.longitude,
      localityNote: `existing user review place ${input.index}`,
      note: `existing user review record ${input.fixturePrefix} ${input.index}`,
      taxon: {
        vernacularName: input.taxon,
        scientificName: input.index === 0 ? "Cinnamomum camphora" : "Taraxacum officinale",
        rank: "species",
      },
      sourcePayload: {
        source: "staging_existing_user_review",
        fixturePrefix: input.fixturePrefix,
        reviewIndex: input.index,
      },
    },
  });
  const payload = (await response.json().catch(() => null)) as ObservationPayload | null;
  expect(response.ok(), payload?.error ?? `create observation ${input.index}`).toBeTruthy();
  expect(payload?.ok, payload?.error ?? `create observation ${input.index}`).toBeTruthy();
  expect(payload?.visitId, `visit id ${input.index}`).toBeTruthy();
  return payload!;
}

async function uploadPhoto(
  api: APIRequestContext,
  sessionCookie: string,
  visitId: string,
  index: number,
): Promise<void> {
  const response = await api.post(`/api/v1/observations/${encodeURIComponent(visitId)}/photos/upload`, {
    headers: {
      cookie: sessionCookie,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      filename: `existing-user-review-${index}.jpg`,
      mimeType: "image/jpeg",
      mediaRole: "primary_subject",
      base64Data: await visualPhotoBase64(index),
      facePrivacy: { detector: "qa_fixture", status: "no_faces", faceCount: 0 },
    },
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  expect(response.ok(), payload?.error ?? `upload photo ${index}`).toBeTruthy();
  expect(payload?.ok, payload?.error ?? `upload photo ${index}`).toBe(true);
}

async function screenshotPath(fileName: string): Promise<string> {
  const dir = path.join("test-results", "existing-user-review");
  await mkdir(dir, { recursive: true });
  return path.join(dir, fileName);
}

async function expectOwnPlacesPanel(page: Page, expectedCount: number): Promise<void> {
  const ownPlaces = page.locator("#me-own-places-panel");
  await expect(ownPlaces).toBeVisible({ timeout: 60_000 });
  await expect(ownPlaces.locator(".me-own-place")).toHaveCount(expectedCount);
  await expect(ownPlaces.locator("img")).toHaveCount(expectedCount);
  await expect(ownPlaces).toContainText("自分の場所");
  await expect(ownPlaces).toContainText("もう一度記録");
}

test.describe.serial("existing user own-place visual review", () => {
  let api: APIRequestContext;
  let writeKey = "";
  let fixturePrefix = "";
  let userId = "";
  let rawCookie = "";
  let sessionCookie = "";

  test.beforeAll(async ({ playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    api = await createStagingApiContext(playwright);
    fixturePrefix = uniqueFixturePrefix("existing-user-review");
    userId = `${fixturePrefix}-user`;
    await upsertUser(api, writeKey, userId);
    rawCookie = await issueSessionCookie(api, writeKey, userId);
    sessionCookie = cookieHeader(rawCookie);

    const records = [
      { latitude: 34.7108, longitude: 137.7261, taxon: "クスノキ", observedAt: "2026-05-25T09:00:00.000Z" },
      { latitude: 34.6971, longitude: 137.7014, taxon: "タンポポ", observedAt: "2026-06-02T10:30:00.000Z" },
      { latitude: 34.7219, longitude: 137.8589, taxon: "アオサギ", observedAt: "2026-06-08T07:15:00.000Z" },
    ];
    for (const [index, record] of records.entries()) {
      const created = await createObservation(api, sessionCookie, {
        fixturePrefix,
        userId,
        index,
        ...record,
      });
      await uploadPhoto(api, sessionCookie, created.visitId!, index);
    }
  });

  test.afterAll(async () => {
    if (api && writeKey && fixturePrefix) {
      await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
    }
    await api?.dispose();
  });

  for (const profile of VIEWPORTS) {
    test(`signed-in home shows own places with thumbnails (${profile.slug})`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile);
      await addSessionCookie(context, rawCookie);
      const page = await context.newPage();
      try {
        await page.goto("/?lang=ja", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#map-explorer")).toBeVisible();
        await expectOwnPlacesPanel(page, 3);
        await expect(page.locator("body")).not.toContainText("行った場所へ");
        await expect(page.locator("body")).not.toContainText("季節で再訪");

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: await screenshotPath(`home-own-places-full-${profile.slug}.png`),
          fullPage: true,
          animations: "disabled",
        });
        await page.locator("#me-own-places-panel").screenshot({
          path: await screenshotPath(`home-own-places-section-${profile.slug}.png`),
          animations: "disabled",
        });
      } finally {
        await context.close();
      }
    });

    test(`map shows own place thumbnail strip (${profile.slug})`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile);
      await addSessionCookie(context, rawCookie);
      const page = await context.newPage();
      try {
        await page.goto("/map?tab=places&lng=137.7261&lat=34.7108&z=15.8", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#map-explorer")).toBeVisible();
        await page.locator("#map-explorer canvas").first().waitFor({ state: "visible", timeout: 60_000 });
        await expectOwnPlacesPanel(page, 3);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: await screenshotPath(`map-own-places-full-${profile.slug}.png`),
          fullPage: true,
          animations: "disabled",
        });
        await page.locator("#me-own-places-panel").screenshot({
          path: await screenshotPath(`map-own-places-panel-${profile.slug}.png`),
          animations: "disabled",
        });
      } finally {
        await context.close();
      }
    });
  }
});
