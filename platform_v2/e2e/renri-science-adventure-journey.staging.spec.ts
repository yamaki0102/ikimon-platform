import { randomUUID } from "node:crypto";
import { test, expect, type APIRequestContext, type BrowserContext, type Page, type Playwright } from "@playwright/test";
import sharp from "sharp";
import {
  addSessionCookie,
  createStagingApiContext,
  newStagingContext,
  requireEnv,
  type ViewportProfile,
} from "./support/staging.js";

// This spec sends privileged staging credentials and raw session/guest cookies.
// Playwright network traces preserve those headers verbatim, so never retain one.
test.use({ trace: "off" });

type SessionIssuePayload = { ok?: boolean; error?: string };
type EventPayload = {
  error?: string;
  sessionId?: string;
  session_id?: string;
  eventCode?: string | null;
  event_code?: string | null;
};
type InventoryPayload = {
  ok?: boolean;
  error?: string;
  inventory?: Record<string, number>;
};

const VIEWPORTS: ViewportProfile[] = [
  { slug: "mobile-320", viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
  { slug: "mobile-360", viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
  { slug: "mobile-375", viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
  { slug: "iphone-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { slug: "iphone-393", viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true },
  { slug: "android-412", viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true },
  { slug: "tablet", viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
  { slug: "ops-desktop", viewport: { width: 1440, height: 900 } },
];

function fixturePrefix(): string {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `renri-e2e-${stamp}-${randomUUID().slice(0, 8)}`;
}

function setCookieValue(rawCookie: string): string {
  return rawCookie.split(";", 1)[0] ?? "";
}

async function issueSession(api: APIRequestContext, writeKey: string, userId: string): Promise<string> {
  const response = await api.post("/api/v1/auth/session/issue", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: { userId, displayName: "連理QA保護者", ttlHours: 2 },
  });
  const payload = (await response.json().catch(() => ({}))) as SessionIssuePayload;
  expect(response.ok(), payload.error ?? "session_issue_failed").toBeTruthy();
  const cookie = response.headers()["set-cookie"] ?? "";
  expect(cookie, "session issue must return a secure cookie").toBeTruthy();
  return cookie;
}

async function fixtureInventory(api: APIRequestContext, writeKey: string, prefix: string): Promise<Record<string, number>> {
  const response = await api.post("/api/v1/ops/staging/renri-fixtures/inventory", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: { fixturePrefix: prefix },
  });
  const payload = (await response.json().catch(() => ({}))) as InventoryPayload;
  expect(response.ok(), payload.error ?? "fixture_inventory_failed").toBeTruthy();
  expect(payload.ok, payload.error ?? "fixture_inventory_failed").toBeTruthy();
  return payload.inventory ?? {};
}

async function cleanupFixture(api: APIRequestContext, writeKey: string, prefix: string): Promise<void> {
  const response = await api.post("/api/v1/ops/staging/renri-fixtures/cleanup", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: { fixturePrefix: prefix },
  });
  const payload = (await response.json().catch(() => ({}))) as InventoryPayload;
  expect(response.ok(), payload.error ?? "fixture_cleanup_failed").toBeTruthy();
  expect(payload.ok, payload.error ?? "fixture_cleanup_failed").toBeTruthy();
  expect(Object.values(payload.inventory ?? {}).every((count) => count === 0), JSON.stringify(payload.inventory)).toBeTruthy();
}

async function createEvent(api: APIRequestContext, prefix: string): Promise<{ sessionId: string; eventCode: string }> {
  const code = `R${Date.now().toString(36).toUpperCase()}`.slice(0, 14);
  const startedAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const headers = { origin: "https://staging.ikimon.life", "content-type": "application/json", accept: "application/json" };
  const data = {
    event_code: code,
    title: `連理サイエンスアドベンチャー ${prefix}`,
    started_at: startedAt,
    field_id: "aikan-renri-ikan-hq",
    plan: "community",
    primary_mode: "discovery",
    active_modes: ["discovery", "rally"],
    target_species: ["名前が分からない生きもの"],
    config: {
      qa_fixture: true,
      fixture_prefix: prefix,
      public_list_visibility: "hidden",
      participant_public_start: "2026-07-19T11:10:00+09:00",
      participant_public_end: "2026-07-19T13:00:00+09:00",
    },
  };
  const [first, replay] = await Promise.all([
    api.post("/api/v1/observation-events", { headers, data }),
    api.post("/api/v1/observation-events", { headers, data }),
  ]);
  const firstPayload = (await first.json().catch(() => ({}))) as EventPayload;
  const replayPayload = (await replay.json().catch(() => ({}))) as EventPayload;
  expect(first.ok(), JSON.stringify(firstPayload)).toBeTruthy();
  expect(replay.ok(), JSON.stringify(replayPayload)).toBeTruthy();
  const sessionId = firstPayload.sessionId ?? firstPayload.session_id ?? "";
  const replaySessionId = replayPayload.sessionId ?? replayPayload.session_id ?? "";
  const eventCode = firstPayload.eventCode ?? firstPayload.event_code ?? code;
  expect(sessionId).toBeTruthy();
  expect(replaySessionId).toBe(sessionId);
  expect(eventCode).toBeTruthy();

  const changedPayload = await api.post("/api/v1/observation-events", {
    headers,
    data: { ...data, title: `${data.title} changed` },
  });
  const changedBody = (await changedPayload.json().catch(() => ({}))) as EventPayload;
  expect(changedPayload.status(), JSON.stringify(changedBody)).toBe(409);
  expect(changedBody.error).toBe("observation_event_activation_conflict");
  return { sessionId, eventCode: eventCode! };
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function gpsExifFixture(): Promise<Buffer> {
  const image = await sharp({
    create: { width: 960, height: 720, channels: 3, background: { r: 74, g: 139, b: 77 } },
  })
    .composite([{ input: Buffer.from('<svg width="960" height="720"><rect x="90" y="100" width="780" height="520" rx="42" fill="#dcefb8"/><circle cx="360" cy="360" r="110" fill="#405f35"/><circle cx="600" cy="360" r="110" fill="#7a4d9b"/><text x="480" y="660" text-anchor="middle" font-size="38" fill="#18351c">RENRI STAGING FIXTURE</text></svg>') }])
    .jpeg({ quality: 88 })
    .withExif({
      IFD0: { Copyright: "Synthetic fixture - no participant data" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "34/1 48/1 0/100",
        GPSLongitudeRef: "E",
        GPSLongitude: "137/1 44/1 0/100",
      },
    })
    .toBuffer();
  const metadata = await sharp(image).metadata();
  expect(metadata.exif, "the source fixture must really contain EXIF").toBeTruthy();
  return image;
}

async function addAuthenticatedCookie(context: BrowserContext, rawCookie: string): Promise<void> {
  await addSessionCookie(context, rawCookie);
}

test.describe.serial("Renri Science Adventure staging journey", () => {
  let writeKey = "";
  let prefix = "";
  let api: APIRequestContext;
  let organizerCookie = "";
  let event: { sessionId: string; eventCode: string };

  test.beforeAll(async ({ playwright }: { playwright: Playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    prefix = fixturePrefix();
    api = await createStagingApiContext(playwright);
    expect(Object.values(await fixtureInventory(api, writeKey, prefix)).every((count) => count === 0)).toBeTruthy();
    organizerCookie = await issueSession(api, writeKey, `${prefix}-organizer`);
    event = await createEvent(api, prefix);
  });

  test.afterAll(async () => {
    if (api && prefix && writeKey) {
      await cleanupFixture(api, writeKey, prefix);
      await api.dispose();
    }
  });

  for (const profile of VIEWPORTS) {
    test(`${profile.slug}: join is family-first, private by default, and fits the viewport`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile);
      const page = await context.newPage();
      try {
        const response = await page.goto(`/community/events/${event.eventCode}/join`, { waitUntil: "domcontentloaded" });
        expect(response?.status()).toBe(200);
        await expect(page.getByText("家族・グループはスマホ1台で参加できます")).toBeVisible();
        await expect(page.getByText("名前が分からなくても写真だけで大丈夫")).toBeVisible();
        await expect(page.locator('input[name="share_location"]')).not.toBeChecked();
        await expectNoHorizontalOverflow(page);
      } finally {
        await context.close();
      }
    });
  }

  test("guest form survives a 503 and reload, then check-in is idempotent", async ({ browser }) => {
    const context = await newStagingContext(browser, VIEWPORTS[3]!);
    const page = await context.newPage();
    const checkinPath = `/api/v1/observation-events/${event.sessionId}/checkin`;
    await page.goto(`/community/events/${event.eventCode}/join`, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="display_name"]').fill("あおぞら家族");
    await page.route(`**${checkinPath}`, async (route) => {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary_unavailable" }) });
    }, { times: 1 });
    await page.getByRole("button", { name: /参加/ }).click();
    await expect(page.locator('[role="status"]')).toContainText(/もう一度|通信|失敗|保存/);
    await expect(page.locator('input[name="display_name"]')).toHaveValue("あおぞら家族");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('input[name="display_name"]')).toHaveValue("あおぞら家族");

    const cookie = (await context.cookies()).find((item) => item.name.startsWith("__Host-ikimon_evt_"));
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(cookie?.secure).toBe(true);
    const headers = {
      origin: "https://staging.ikimon.life",
      "content-type": "application/json",
      cookie: `${cookie!.name}=${cookie!.value}`,
    };
    const body = { display_name: "あおぞら家族", share_location: false, is_minor: true };
    const [first, second] = await Promise.all([
      page.request.post(checkinPath, { headers, data: body }),
      page.request.post(checkinPath, { headers, data: body }),
    ]);
    expect(first.ok()).toBeTruthy();
    expect(second.ok()).toBeTruthy();
    const firstJson = await first.json();
    const secondJson = await second.json();
    expect(firstJson.participant?.participantId ?? firstJson.participant?.participant_id).toBe(
      secondJson.participant?.participantId ?? secondJson.participant?.participant_id,
    );
    await context.close();
  });

  test("registered parent saves a real GPS-EXIF photo, event recap shows it, and public bytes are scrubbed", async ({ browser, playwright }) => {
    const userApi = await createStagingApiContext(playwright);
    const userId = `${prefix}-parent`;
    const rawCookie = await issueSession(userApi, writeKey, userId);
    const authHeader = setCookieValue(rawCookie);
    const checkin = await userApi.post(`/api/v1/observation-events/${event.sessionId}/checkin`, {
      headers: { origin: "https://staging.ikimon.life", cookie: authHeader, "content-type": "application/json" },
      data: { display_name: "つばさ家族", share_location: false, is_minor: false },
    });
    expect(checkin.ok(), await checkin.text()).toBeTruthy();

    const context = await newStagingContext(browser, VIEWPORTS[3]!);
    await addAuthenticatedCookie(context, rawCookie);
    const page = await context.newPage();
    const photo = await gpsExifFixture();
    await page.goto(
      `/ja/record?draft=1&start=photo&source=login_required&event=${encodeURIComponent(event.eventCode)}&eventSessionId=${encodeURIComponent(event.sessionId)}&participantRole=participant`,
      { waitUntil: "domcontentloaded" },
    );
    await page.locator("#record-media-photo").setInputFiles({
      name: `${prefix}-synthetic-gps.jpg`,
      mimeType: "image/jpeg",
      buffer: photo,
    });
    await page.locator('input[name="latitude"]').fill("34.800000");
    await page.locator('input[name="longitude"]').fill("137.733333");
    await page.locator('textarea[name="note"]').fill("名前はまだ分からない");
    await page.locator("[data-record-recovery-save]").click();
    await expect(page.locator("#record-status")).toContainText("記録を保存しました", { timeout: 60_000 });

    await expect.poll(async () => {
      const recap = await page.request.get(`/api/v1/observation-events/${event.sessionId}/recap`, {
        headers: { cookie: authHeader },
      });
      if (!recap.ok()) return null;
      return recap.json();
    }, { timeout: 90_000 }).toMatchObject({ highlights: { observationCount: 1 } });

    await page.goto(`/events/${event.sessionId}/recap`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText("未同定");
    const image = page.locator(`img[src^="/api/v1/observation-events/${event.sessionId}/photos/"]`).first();
    await expect(image).toBeVisible({ timeout: 90_000 });
    const src = await image.getAttribute("src");
    const publicResponse = await page.request.get(src!);
    expect(publicResponse.ok()).toBeTruthy();
    expect(publicResponse.headers()["content-type"]).toContain("image/webp");
    const publicBytes = Buffer.from(await publicResponse.body());
    const publicMetadata = await sharp(publicBytes).metadata();
    expect(publicMetadata.exif).toBeUndefined();
    expect(publicBytes.includes(Buffer.from("GPSLatitude"))).toBe(false);
    expect(publicBytes.includes(Buffer.from("34.800000"))).toBe(false);
    expect(publicBytes.includes(Buffer.from("137.733333"))).toBe(false);

    await context.close();
    await userApi.dispose();
  });

  test("fixture remains hidden from the public event list but visible to its organizer", async ({ browser }) => {
    const guest = await newStagingContext(browser, VIEWPORTS[7]!);
    const guestPage = await guest.newPage();
    await guestPage.goto("/community/events", { waitUntil: "domcontentloaded" });
    await expect(guestPage.locator("body")).not.toContainText(prefix);
    await guest.close();

    const organizer = await newStagingContext(browser, VIEWPORTS[7]!);
    await addAuthenticatedCookie(organizer, organizerCookie);
    const organizerPage = await organizer.newPage();
    await organizerPage.goto("/community/events", { waitUntil: "domcontentloaded" });
    await expect(organizerPage.locator("body")).toContainText(prefix);
    await organizer.close();
  });
});
