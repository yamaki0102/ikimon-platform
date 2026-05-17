import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const pages = [
  { path: "/", marker: /ikimon/i },
  { path: "/records", marker: /記録を見る|Records/i },
  { path: "/learn", marker: /ikimon|Learn/i },
  { path: "/contact", marker: /送信|Contact/i },
];

const publicSurfacePages = ["/", "/records", "/map"];
const canonicalAiSubjectScenes = [
  {
    path: "/ja/observations/record-1778549526406?subject=occ%3Arecord-1778549526406%3A0",
    expectedSubjects: ["セイヨウミツバチ", "イネ科の一種"],
  },
  {
    path: "/ja/observations/record-1778643230506",
    expectedSubjects: ["クスノキ属", "カエデ属"],
  },
] as const;
const canonicalFieldAdviceScene =
  "/ja/observations/record-1778818427350?subject=occ%3Arecord-1778818427350%3A0";

function visibleSubjectRolePattern(name: string): RegExp {
  if (/ミツバチ|ハチ|蜂/.test(name)) return /花に来た虫/;
  if (/イネ科|草|芝/.test(name)) return /草地と裸地/;
  if (/クスノキ|カエデ|樹|木/.test(name)) return /背景の木・植栽|写っている植物/;
  return /代表候補|一緒に写るもの|写っている植物/;
}
const fixtureLeakPattern = /e2e_test_|prod-media-smoke|smoke-ui|smoke_regression_fixture|regression fixture|staging regression|fixture_prefix/i;
const smokePhotoBase64 =
  "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";
const smokeVideoBase64 =
  "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";

type JsonPayload = Record<string, unknown>;
type SmokeAccount = { email: string; userId: string; sessionCookie: string };

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function stagingBasicAuthHeader(): string | null {
  const username = process.env.STAGING_BASIC_AUTH_USER?.trim();
  const password = process.env.STAGING_BASIC_AUTH_PASS?.trim();
  if (!username || !password) return null;
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function sameOriginBasicAuthHeaders(targetUrl: string, pageUrl: string): Record<string, string> | undefined {
  const authorization = stagingBasicAuthHeader();
  if (!authorization) return undefined;
  try {
    return new URL(targetUrl).origin === new URL(pageUrl).origin ? { authorization } : undefined;
  } catch {
    return undefined;
  }
}

function productionSmokeBaseUrl(): string {
  return process.env.PRODUCTION_SMOKE_BASE_URL ?? "http://127.0.0.1:13202";
}

function productionSmokePrefix(): string {
  return process.env.PRODUCTION_SMOKE_UI_PREFIX?.trim() || `smoke-ui-local-${Date.now()}`;
}

function productionSmokeCheckpointFile(): string {
  return process.env.PRODUCTION_SMOKE_CHECKPOINT_FILE?.trim() ||
    path.resolve(process.cwd(), "test-results", "production-smoke-checkpoints.jsonl");
}

async function recordSmokeCheckpoint(phase: string, details: JsonPayload = {}): Promise<void> {
  const filePath = productionSmokeCheckpointFile();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${JSON.stringify({ ts: new Date().toISOString(), phase, status: "passed", ...details })}\n`,
    { flag: "a" },
  );
}

async function expectObservationTextNotClipped(page: Page): Promise<void> {
  const offenders = await page.evaluate(() => {
    const scope = document.querySelector("main") ?? document.body;
    return Array.from(scope.querySelectorAll<HTMLElement>("*"))
      .filter((el) => {
        if (el.matches("script, style, template, svg, path, img, picture, video, canvas")) return false;
        if (el.closest(".obs-hero-preview, .obs-hero-thumb, .obs-lightbox, .obs-media-discovery-rail, .obs-id-tabs")) return false;
        const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
        if (text.length < 8) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 12 || rect.height < 10) return false;
        const style = window.getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") return false;
        const lineClamp = style.getPropertyValue("-webkit-line-clamp");
        const clampsText = lineClamp && lineClamp !== "none" && lineClamp !== "0";
        const clipsInlineText = el.scrollWidth > el.clientWidth + 2
          && /hidden|clip/.test(style.overflowX)
          && style.whiteSpace === "nowrap";
        const clipsBlockText = el.scrollHeight > el.clientHeight + 2
          && /hidden|clip/.test(style.overflowY)
          && style.maxHeight !== "none";
        return Boolean(clampsText || clipsInlineText || clipsBlockText);
      })
      .slice(0, 10)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        className: String(el.className || ""),
        text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
      }));
  });
  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

function smokePhotoFile(prefix: string) {
  return {
    name: `${prefix}-photo.png`,
    mimeType: "image/png",
    buffer: Buffer.from(smokePhotoBase64, "base64"),
  };
}

function smokeVideoFile(prefix: string) {
  return {
    name: `${prefix}-video.webm`,
    mimeType: "video/webm",
    buffer: Buffer.from(smokeVideoBase64, "base64"),
  };
}

async function jsonFromResponse(response: import("@playwright/test").Response, label: string): Promise<JsonPayload> {
  const payload = (await response.json().catch(() => null)) as JsonPayload | null;
  expect(payload, `${label} should return JSON`).toBeTruthy();
  return payload!;
}

function sessionCookieFromResponse(response: import("@playwright/test").APIResponse): string {
  const setCookie = response.headers()["set-cookie"] ?? "";
  const match = setCookie.match(/(?:^|,\s*)(ikimon_v2_session=[^;,\s]+)/);
  return match?.[1] ?? "";
}

function authHeaders(baseUrl: string, account?: SmokeAccount): Record<string, string> {
  return {
    accept: "application/json",
    origin: baseUrl,
    ...(account?.sessionCookie ? { cookie: account.sessionCookie } : {}),
  };
}

function jsonHeaders(baseUrl: string, account?: SmokeAccount): Record<string, string> {
  return {
    ...authHeaders(baseUrl, account),
    "content-type": "application/json",
  };
}

async function registerSmokeUser(
  api: APIRequestContext,
  baseUrl: string,
  prefix: string,
  suffix?: string,
): Promise<SmokeAccount> {
  const password = `IkimonUiSmoke${prefix.replace(/\W/g, "").slice(-16)}!`;
  const accountKey = suffix ? `${prefix}-${suffix}` : prefix;
  const email = `${accountKey}@example.invalid`;
  const response = await api.post(joinUrl(baseUrl, "/api/v1/auth/register"), {
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: baseUrl,
    },
    data: {
      displayName: `候補UIスモーク ${accountKey}`,
      email,
      password,
      redirect: "/record",
    },
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    session?: { userId?: string };
  } | null;
  expect(response.ok(), payload?.error ?? "register_failed").toBeTruthy();
  expect(payload?.ok, payload?.error ?? "register_failed").toBeTruthy();
  expect(payload?.session?.userId, payload?.error ?? "missing_user_id").toBeTruthy();
  const sessionCookie = sessionCookieFromResponse(response);
  expect(sessionCookie, "register should issue a session cookie").toBeTruthy();
  return { email, userId: payload!.session!.userId!, sessionCookie };
}

async function pollRecentEvent(
  api: APIRequestContext,
  baseUrl: string,
  sessionId: string,
  type: string,
): Promise<JsonPayload> {
  const deadline = Date.now() + 20_000;
  let lastPayload: JsonPayload = {};
  while (Date.now() < deadline) {
    const response = await api.get(joinUrl(baseUrl, `/api/v1/observation-events/${sessionId}/recent?limit=50`));
    lastPayload = (await response.json().catch(() => ({}))) as JsonPayload;
    const events = Array.isArray(lastPayload.events) ? lastPayload.events as JsonPayload[] : [];
    const found = events.find((event) => event.type === type);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`recent event not found: ${type}; last=${JSON.stringify(lastPayload).slice(0, 600)}`);
}

async function fillRequiredRecordFields(page: Page): Promise<void> {
  await page.locator("summary", { hasText: "座標を直接編集" }).click();
  await page.locator("input[name='latitude']").fill("34.710800");
  await page.locator("input[name='longitude']").fill("137.726100");
}

async function thumbUrlsOnPage(page: import("@playwright/test").Page): Promise<string[]> {
  return page.locator("img").evaluateAll((imgs) => {
    return Array.from(new Set(imgs
      .map((img) => (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || img.getAttribute("src") || "")
      .filter((src) => src.includes("/thumb/"))));
  });
}

test.describe("production candidate smoke", () => {
  for (const pageSpec of pages) {
    test(`${pageSpec.path} renders`, async ({ page }) => {
      const response = await page.goto(pageSpec.path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${pageSpec.path} status`).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).toContainText(pageSpec.marker);
    });
  }

  test("/map renders map shell", async ({ page }) => {
    const response = await page.goto("/map", { waitUntil: "domcontentloaded" });
    expect(response?.status(), "/map status").toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("#map-explorer")).toBeVisible();
  });

  test("public surfaces do not leak fixtures or 1x1 placeholder thumbnails", async ({ page, request }) => {
    const checkedThumbs = new Set<string>();
    for (const path of publicSurfacePages) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${path} status`).toBeLessThan(500);
      const html = await page.content();
      expect(html, `${path} leaked fixture marker`).not.toMatch(fixtureLeakPattern);

      for (const src of await thumbUrlsOnPage(page)) {
        const url = new URL(src, page.url()).toString();
        if (checkedThumbs.has(url)) continue;
        checkedThumbs.add(url);
        const imageResponse = await request.get(url, {
          headers: sameOriginBasicAuthHeaders(url, page.url()),
        });
        expect(imageResponse.status(), `${url} status`).toBeLessThan(400);
        expect(imageResponse.headers()["content-type"] ?? "", `${url} content-type`).toMatch(/^image\//);
        const body = await imageResponse.body();
        expect(body.length, `${url} should not be a 1x1 / placeholder asset`).toBeGreaterThan(512);
      }
    }
    expect(checkedThumbs.size, "public smoke should inspect at least one public thumbnail").toBeGreaterThan(0);
  });

  for (const scene of canonicalAiSubjectScenes) {
    test(`canonical scene renders visible AI subjects as observation records: ${scene.path}`, async ({ page }) => {
    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );

    const response = await page.goto(scene.path, { waitUntil: "domcontentloaded" });
    expect(response?.ok(), "canonical AI subject scene should be readable").toBeTruthy();
    await expect(page.locator("body")).toContainText("この写真に写っているもの");
    await expect(page.locator(".obs-first-read"), "scene read summary").toContainText(/この写真に写っているもの|この映像に写っているもの/);

    for (const name of scene.expectedSubjects) {
      const card = page.locator(".obs-visible-record-card").filter({ hasText: name }).first();
      await expect(card, `${name} visible record card`).toBeVisible();
      await expect(card, `${name} is an occurrence-backed observation record`).toHaveAttribute(
        "href",
        /[?&]subject=occ%3A[^&]+%3A\d+/,
      );
      await expect(card, `${name} keeps a user-facing scene role visible`).toContainText(
        visibleSubjectRolePattern(name),
      );
      await expect(card, `${name} does not expose internal AI materialization copy`).not.toContainText(
        "AIが写真から分けた観測レコード",
      );
    }

    await expect(page.locator("body")).not.toContainText("これも写ってると提案");
    await expect(page.locator("body")).not.toContainText("写っている対象として知らせる");
    await expect(page.locator("body")).not.toContainText("観測レコードにする");
    await recordSmokeCheckpoint("canonical_scene_ai_subject_records", {
      path: scene.path,
      expectedSubjects: scene.expectedSubjects,
    });
  });
  }

  for (const scene of canonicalAiSubjectScenes) {
    test(`canonical scene mobile layout keeps media and readout usable: ${scene.path}`, async ({ page }) => {
      test.skip(
        !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
        "requires a production candidate base URL or SSH tunnel",
      );

      await page.setViewportSize({ width: 320, height: 760 });
      const response = await page.goto(scene.path, { waitUntil: "domcontentloaded" });
      expect(response?.ok(), "canonical AI subject scene should be readable on 320px").toBeTruthy();
      await expect(page.locator("body")).toContainText("この写真に写っているもの");
      await expect(page.locator("body")).toContainText("候補を確かめる材料");
      await expect(page.locator(".obs-hero-preview .obs-media-role-badge")).toBeHidden();
      await expect(page.locator(".obs-hero-preview .obs-annotation-target")).toHaveCount(0);
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(horizontalOverflow, "record detail should not horizontally overflow at 320px").toBeLessThanOrEqual(1);
      await expectObservationTextNotClipped(page);
      await recordSmokeCheckpoint("canonical_scene_mobile_layout", {
        path: scene.path,
        viewport: "320x760",
      });
    });
  }

  test("logged-in invasive species pages render against the production candidate", async ({ browser }) => {
    test.setTimeout(120_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );

    const baseUrl = productionSmokeBaseUrl();
    const prefix = productionSmokePrefix();
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
    });

    try {
      const account = await registerSmokeUser(context.request, baseUrl, prefix, "invasive");
      await context.setExtraHTTPHeaders({ cookie: account.sessionCookie });
      const page = await context.newPage();

      await page.goto(joinUrl(baseUrl, "/learn/invasive-species?lang=ja"), { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toContainText("外来種を見つけたときの安全メモ");
      await expect(page.locator("body")).toContainText("全26件");
      for (const name of ["オオキンケイギク", "ナガエツルノゲイトウ", "ヒアリ", "ヌートリア"]) {
        await expect(page.locator("a").filter({ hasText: name }).first()).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: "test-results/production-invasive-list-desktop.png", fullPage: true });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(joinUrl(baseUrl, "/learn/invasive-species/solenopsis-invicta?lang=ja"), { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toContainText("ヒアリ");
      await expect(page.locator("body")).toContainText(/触らない|自治体や管理者/);
      await expect(page.locator("body")).toContainText("外来生物法");
      await expect(page.locator("a").filter({ hasText: "出典を開く" }).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: "test-results/production-invasive-detail-mobile.png", fullPage: true });
      await recordSmokeCheckpoint("logged_in_invasive_species_pages", {
        listPath: "/learn/invasive-species",
        detailPath: "/learn/invasive-species/solenopsis-invicta",
        userId: account.userId,
      });
    } finally {
      await context.close();
    }
  });

  test("logged-in field manager can save site management policy from observation UI", async ({ browser }) => {
    test.setTimeout(90_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );

    const baseUrl = productionSmokeBaseUrl();
    const prefix = productionSmokePrefix();
    const context = await browser.newContext({ ignoreHTTPSErrors: true });

    try {
      const account = await registerSmokeUser(context.request, baseUrl, prefix, "field-policy");
      await context.setExtraHTTPHeaders({ cookie: account.sessionCookie });
      const page = await context.newPage();

      await page.goto(joinUrl(baseUrl, canonicalFieldAdviceScene), { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toContainText("現場アドバイス");

      const form = page.locator("[data-care-policy-form]").first();
      await form.evaluate((element) => element.closest("details")?.setAttribute("open", ""));
      await expect(form, "logged-in plant detail should show management policy form").toBeVisible();
      await form.locator("select[name='managementGoal']").selectOption("keep_clear");
      await form.locator("select[name='weedTolerance']").selectOption("low");
      await form.locator("select[name='invasiveResponse']").selectOption("controlled_removal");
      await form.locator("select[name='mowingFrequency']").selectOption("monthly");
      await form.locator("textarea[name='notes']").fill(`production smoke field policy ${prefix}`);

      const saveResponse = page.waitForResponse((response) =>
        response.url().includes("/api/v1/places/") &&
        response.url().includes("/management-policy") &&
        response.request().method() === "POST",
      );
      await form.locator("button[type='submit']").click();
      const response = await saveResponse;
      const payload = await jsonFromResponse(response, "field policy save");
      expect(response.ok(), String(payload.error ?? "policy_save_failed")).toBeTruthy();
      await expect(form.locator("[data-care-policy-status]")).toContainText("保存しました");
      await recordSmokeCheckpoint("field_policy_ui_save", {
        path: page.url(),
        userId: account.userId,
      });
    } finally {
      await context.close();
    }
  });

  test("mobile record UI saves photo and video against the production candidate", async ({ browser }) => {
    test.setTimeout(180_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );

    const baseUrl = productionSmokeBaseUrl();
    const prefix = productionSmokePrefix();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      ignoreHTTPSErrors: true,
    });

    try {
      const account = await registerSmokeUser(context.request, baseUrl, prefix);
      const page = await context.newPage();

      await page.goto(joinUrl(baseUrl, "/record?lang=ja"), { waitUntil: "domcontentloaded" });
      await expect(page.locator("#record-form")).toBeHidden();
      await page.locator("#record-media-photo").setInputFiles(smokePhotoFile(prefix));
      await expect(page.locator("#record-form")).toBeVisible();
      await fillRequiredRecordFields(page);

      const photoUpload = page.waitForResponse((response) =>
        response.url().includes("/photos/upload") && response.request().method() === "POST",
      );
      await page.locator("#record-submit-panel button[type='submit']").click();
      const photoResponse = await photoUpload;
      const photoPayload = await jsonFromResponse(photoResponse, "photo upload");
      expect(photoResponse.ok(), `photo upload HTTP status for ${account.email}`).toBeTruthy();
      expect(photoPayload.ok, "photo upload must keep the shared ok:true contract").toBe(true);
      await recordSmokeCheckpoint("photo_api_contract", { httpStatus: photoResponse.status() });
      await expect(page.locator("#record-status")).toContainText("記録を保存しました");
      await expect(page.locator("#record-status")).toContainText("写真1枚を同じ記録に保存しました。");
      await recordSmokeCheckpoint("photo_ui_post");

      await page.goto(joinUrl(baseUrl, "/record?lang=ja&start=video"), { waitUntil: "domcontentloaded" });
      await page.locator("#record-media-video").setInputFiles(smokeVideoFile(prefix));
      await expect(page.locator("#record-form")).toBeVisible();
      await fillRequiredRecordFields(page);

      const directUpload = page.waitForResponse((response) =>
        response.url().includes("/api/v1/videos/direct-upload") && response.request().method() === "POST",
      );
      const finalizeUpload = page.waitForResponse((response) =>
        /\/api\/v1\/videos\/[^/]+\/finalize$/.test(new URL(response.url()).pathname) &&
        response.request().method() === "POST",
      );
      await page.locator("#record-submit-panel button[type='submit']").click();
      const directResponse = await directUpload;
      const directPayload = await jsonFromResponse(directResponse, "video direct upload");
      expect(directResponse.ok(), "video direct upload HTTP status").toBeTruthy();
      expect(directPayload.ok, "video direct upload should return ok:true").toBe(true);
      expect(directPayload.uid, "video direct upload should issue a stream uid").toBeTruthy();
      const finalizeResponse = await finalizeUpload;
      const finalizePayload = await jsonFromResponse(finalizeResponse, "video finalize");
      expect(finalizeResponse.ok(), "video finalize HTTP status").toBeTruthy();
      expect(finalizePayload.ok, "video finalize should return ok:true").toBe(true);
      await expect(page.locator("#record-status")).toContainText("記録を保存しました", { timeout: 30_000 });
      await expect(page.locator("#record-status")).toContainText("動画は保存済みです。");
      await recordSmokeCheckpoint("video_ui_post", {
        directStatus: directResponse.status(),
        finalizeStatus: finalizeResponse.status(),
      });
    } finally {
      await context.close();
    }
  });

  test("place event capsule flow works with organizer, recorder, guide, and scanner accounts", async ({ browser }) => {
    test.setTimeout(180_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );

    const baseUrl = productionSmokeBaseUrl();
    const prefix = productionSmokePrefix();
    const organizerContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const recorderContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const guideContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const scannerContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const publicContext = await browser.newContext({ ignoreHTTPSErrors: true });

    try {
      const [organizer, recorder, guideUser, scanner] = await Promise.all([
        registerSmokeUser(organizerContext.request, baseUrl, prefix, "organizer"),
        registerSmokeUser(recorderContext.request, baseUrl, prefix, "recorder"),
        registerSmokeUser(guideContext.request, baseUrl, prefix, "guide"),
        registerSmokeUser(scannerContext.request, baseUrl, prefix, "scanner"),
      ]);
      await organizerContext.setExtraHTTPHeaders({ cookie: organizer.sessionCookie });
      const eventCode = `PE${Date.now().toString(36).toUpperCase()}`;
      const startedAt = new Date().toISOString();
      const createResponse = await organizerContext.request.post(joinUrl(baseUrl, "/api/v1/observation-events"), {
        headers: jsonHeaders(baseUrl, organizer),
        data: {
          title: `連理の木の下 ${prefix}`,
          event_code: eventCode,
          plan: "public",
          primary_mode: "discovery",
          active_modes: ["discovery", "effort_maximize"],
          location_lat: 34.7108,
          location_lng: 137.7261,
          location_radius_m: 35,
          started_at: startedAt,
          target_species: ["クスノキ"],
          config: {
            place_event: {
              place_label: `連理の木の下 ${prefix}`,
              meeting_point: "木の根元",
              event_kind: "fixed_place_observation",
              audience: "production_smoke",
              consent_policy_version: "place_event_capsule/v1",
              source_modes: ["record", "guide", "field_scan"],
              public_story_enabled: true,
              ai_recap_enabled: false,
            },
          },
        },
      });
      const created = await jsonFromResponse(createResponse, "place event create");
      expect(createResponse.ok(), String(created.error ?? "event_create_failed")).toBeTruthy();
      const sessionId = String(created.sessionId ?? "");
      expect(sessionId, "created session id").toBeTruthy();

      for (const [context, account, role] of [
        [recorderContext, recorder, "recorder"],
        [guideContext, guideUser, "guide"],
        [scannerContext, scanner, "scanner"],
      ] as const) {
        const response = await context.request.post(joinUrl(baseUrl, `/api/v1/observation-events/${sessionId}/checkin`), {
          headers: jsonHeaders(baseUrl, account),
          data: { display_name: `候補UIスモーク ${prefix}-${role}`, is_minor: false, share_location: true },
        });
        expect(response.ok(), `${role} checkin`).toBeTruthy();
      }

      const observedAt = new Date().toISOString();
      const recordResponse = await recorderContext.request.post(joinUrl(baseUrl, "/api/v1/observations/upsert"), {
        headers: jsonHeaders(baseUrl, recorder),
        data: {
          clientSubmissionId: `${prefix}-record-${Date.now()}`,
          userId: recorder.userId,
          observedAt,
          latitude: 34.7108,
          longitude: 137.7261,
          localityNote: `連理の木の下 ${prefix}`,
          note: `production place event smoke record ${prefix}`,
          taxon: { vernacularName: "クスノキ", scientificName: "Cinnamomum camphora", rank: "species" },
          sourcePayload: { source: "production_place_event_smoke", fixturePrefix: prefix },
          eventSessionId: sessionId,
          eventCode,
          participantRole: "record",
        },
      });
      const recordPayload = await jsonFromResponse(recordResponse, "place event record");
      expect(recordResponse.ok(), String(recordPayload.error ?? "record_failed")).toBeTruthy();
      await pollRecentEvent(organizerContext.request, baseUrl, sessionId, "observation_added");

      const guideResponse = await guideContext.request.post(joinUrl(baseUrl, "/api/v1/guide/record"), {
        headers: jsonHeaders(baseUrl, guideUser),
        data: {
          sessionId,
          sceneId: `${prefix}-guide-scene`,
          eventSessionId: sessionId,
          eventCode,
          participantRole: "guide",
          lang: "ja",
          lat: 34.71082,
          lng: 137.72612,
          capturedAt: observedAt,
          returnedAt: new Date().toISOString(),
          sceneSummary: "連理の木の根元に常緑樹の葉と落ち葉が見える",
          detectedSpecies: ["クスノキ"],
          detectedFeatures: [{ kind: "vegetation", label: "evergreen_tree" }],
          primarySubject: { name: "クスノキ", confidence: 0.62 },
          environmentContext: "樹木の根元と落ち葉のある狭い地点",
          facePrivacy: { status: "no_face", faceCount: 0 },
          guideMode: "site_context",
        },
      });
      expect(guideResponse.ok(), "guide record").toBeTruthy();
      await pollRecentEvent(organizerContext.request, baseUrl, sessionId, "guide_scene_added");

      const scanResponse = await scannerContext.request.post(joinUrl(baseUrl, "/api/v1/observations/upsert"), {
        headers: jsonHeaders(baseUrl, scanner),
        data: {
          clientSubmissionId: `${prefix}-scan-${Date.now()}`,
          userId: scanner.userId,
          observedAt,
          latitude: 34.71079,
          longitude: 137.72608,
          localityNote: `連理の木の下 ${prefix}`,
          note: `production place event smoke field scan ${prefix}`,
          taxon: { vernacularName: "地点スキャン", scientificName: null, rank: "unknown" },
          fieldScan: {
            scanMode: "site_snapshot",
            methodPayload: { source: "production_place_event_smoke", fixturePrefix: prefix },
            qualityPayload: { repeatablePoint: true },
          },
          sourcePayload: { source: "production_place_event_smoke", fixturePrefix: prefix },
          eventSessionId: sessionId,
          eventCode,
          participantRole: "field_scan",
        },
      });
      const scanPayload = await jsonFromResponse(scanResponse, "place event field scan");
      expect(scanResponse.ok(), String(scanPayload.error ?? "field_scan_failed")).toBeTruthy();
      await pollRecentEvent(organizerContext.request, baseUrl, sessionId, "field_scan_added");

      const endResponse = await organizerContext.request.post(joinUrl(baseUrl, `/api/v1/observation-events/${sessionId}/end`), {
        headers: authHeaders(baseUrl, organizer),
      });
      const ended = await jsonFromResponse(endResponse, "end event");
      expect(endResponse.ok(), String(ended.error ?? "end_event_failed")).toBeTruthy();

      const generateResponse = await organizerContext.request.post(joinUrl(baseUrl, `/api/v1/observation-events/${sessionId}/capsule/generate`), {
        headers: jsonHeaders(baseUrl, organizer),
        data: { useAi: false },
      });
      const generated = await jsonFromResponse(generateResponse, "capsule generate");
      expect(generateResponse.ok(), String(generated.error ?? "capsule_generate_failed")).toBeTruthy();
      const capsule = generated.capsule as JsonPayload;
      expect((capsule.sourceCounts as JsonPayload).observations).toBe(1);
      expect((capsule.sourceCounts as JsonPayload).guideScenes).toBe(1);
      expect((capsule.sourceCounts as JsonPayload).fieldScans).toBe(1);
      expect((capsule.readiness as JsonPayload).exportReady).toBe(true);
      expect(JSON.stringify(capsule.recordCandidates)).toContain('"identificationStatus":"suggested"');
      expect(JSON.stringify(capsule.publicStoryDraft)).toContain("live:");

      const blockedPublicResponse = await publicContext.request.get(joinUrl(baseUrl, `/api/v1/observation-events/${sessionId}/capsule`));
      expect(blockedPublicResponse.status(), "capsule should stay private before review").toBe(403);

      const publishResponse = await organizerContext.request.patch(joinUrl(baseUrl, `/api/v1/observation-events/${sessionId}/capsule/review`), {
        headers: jsonHeaders(baseUrl, organizer),
        data: { reviewStatus: "published" },
      });
      const published = await jsonFromResponse(publishResponse, "capsule publish");
      expect(publishResponse.ok(), String(published.error ?? "capsule_publish_failed")).toBeTruthy();
      expect((published.capsule as JsonPayload).reviewStatus).toBe("published");

      const publicResponse = await publicContext.request.get(joinUrl(baseUrl, `/api/v1/observation-events/${sessionId}/capsule`));
      const publicPayload = await jsonFromResponse(publicResponse, "public capsule");
      expect(publicResponse.ok(), "public capsule after publish").toBeTruthy();
      expect(publicPayload.visibility).toBe("public");
      expect(JSON.stringify(publicPayload)).not.toContain("privateDigest");

      const recapPage = await organizerContext.newPage();
      await recapPage.goto(joinUrl(baseUrl, `/events/${sessionId}/recap`), { waitUntil: "domcontentloaded" });
      await expect(recapPage.locator("[data-can-manage='true']")).toBeVisible();
      await expect(recapPage.locator("body")).toContainText("地点ストーリー");
      await recordSmokeCheckpoint("place_event_capsule_flow", {
        sessionId,
        eventCode,
        organizerUserId: organizer.userId,
      });
    } finally {
      await Promise.all([
        organizerContext.close(),
        recorderContext.close(),
        guideContext.close(),
        scannerContext.close(),
        publicContext.close(),
      ]);
    }
  });
});
