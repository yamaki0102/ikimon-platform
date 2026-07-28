import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const pages = [
  { path: "/", marker: /ikimon/i },
  { path: "/records", marker: /記録を見る|Records/i },
  { path: "/learn", marker: /ikimon|Learn/i },
  { path: "/ja/contact", marker: /送信|お問い合わせ|Contact/i },
];

const publicSurfacePages = ["/", "/records", "/map"];
const canonicalAiSubjectScenes = [
  {
    path: "/ja/observations/record-1778549526406?subject=occ%3Arecord-1778549526406%3A0",
  },
  {
    path: "/ja/observations/record-1778643230506",
  },
] as const;
const canonicalFieldAdviceScene =
  "/ja/observations/record-1778818427350?subject=occ%3Arecord-1778818427350%3A0";

const fixtureLeakPattern = /e2e_test_|prod-media-smoke|smoke-ui|smoke_regression_fixture|regression fixture|staging regression|fixture_prefix/i;
const smokePhotoBase64 =
  "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";
const smokeVideoBase64 =
  "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";

type JsonPayload = Record<string, unknown>;
type SmokeAccount = { email: string; userId: string; sessionCookie: string };
type PlaceMemorySmokeRecord = {
  ok?: boolean;
  error?: string;
  visitId?: string;
  occurrenceId?: string;
  placeMemory?: {
    entryId: string;
    cellId: string;
    echoNote: string;
    hasPrivateNote: boolean;
  } | null;
  placeMemorySample?: JsonPayload[];
};
type OwnerMapSmokeItem = {
  displayName?: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string | null;
  visitId?: string;
};
type ReferenceCaptureSmokeRecord = {
  sourceId: string;
  title: string;
};

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

const productionSmokeObservationVisibility = "private" as const;
type ProductionSmokeWriteScope =
  | "auth-write"
  | "private-post"
  | "private-post-ui"
  | "shared-production-write"
  | "place-memory-write"
  | "public-capsule-write";

function productionSmokeCheckpointFile(): string {
  return process.env.PRODUCTION_SMOKE_CHECKPOINT_FILE?.trim() ||
    path.resolve(process.cwd(), "test-results", "production-smoke-checkpoints.jsonl");
}

function productionSmokeWriteScope(): string {
  return process.env.PRODUCTION_SMOKE_WRITE_SCOPE?.trim().toLowerCase() ?? "";
}

function allowsProductionSmokeWriteScope(scope: ProductionSmokeWriteScope): boolean {
  const requested = productionSmokeWriteScope();
  return requested === "all" || requested === scope;
}

function requireProductionSmokeWriteScope(scope: ProductionSmokeWriteScope): void {
  test.skip(
    !allowsProductionSmokeWriteScope(scope),
    `requires PRODUCTION_SMOKE_WRITE_SCOPE=${scope} or all`,
  );
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

function smokeReferenceIsbn(prefix: string): string {
  const digits = prefix.replace(/\D/g, "").padEnd(10, "0").slice(-10);
  return `979${digits}`;
}

async function jsonFromResponse(response: import("@playwright/test").Response, label: string): Promise<JsonPayload> {
  const payload = (await response.json().catch(() => null)) as JsonPayload | null;
  expect(payload, `${label} should return JSON`).toBeTruthy();
  return payload!;
}

function collectForbiddenJsonKeyPaths(value: unknown, forbiddenKeys: RegExp[], pathLabel = "$"): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenJsonKeyPaths(item, forbiddenKeys, `${pathLabel}[${index}]`));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const keyPath = `${pathLabel}.${key}`;
    const current = forbiddenKeys.some((pattern) => pattern.test(key)) ? [keyPath] : [];
    return current.concat(collectForbiddenJsonKeyPaths(nested, forbiddenKeys, keyPath));
  });
}

function sessionCookieFromResponse(response: import("@playwright/test").APIResponse): string {
  const setCookie = response.headers()["set-cookie"] ?? "";
  const match = setCookie.match(/(?:^|,\s*)(ikimon_v2_session=[^;,\s]+)/);
  return match?.[1] ?? "";
}

async function addSessionCookieToContext(context: BrowserContext, baseUrl: string, sessionCookie: string): Promise<void> {
  const separatorIndex = sessionCookie.indexOf("=");
  expect(separatorIndex, "session cookie should include a name/value separator").toBeGreaterThan(0);
  const url = new URL(baseUrl);
  await context.addCookies([
    {
      name: sessionCookie.slice(0, separatorIndex),
      value: sessionCookie.slice(separatorIndex + 1),
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
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
  options?: { displayName?: string },
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
      displayName: options?.displayName ?? `候補UIスモーク ${accountKey}`,
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

async function postPlaceMemorySmokeRecord(
  api: APIRequestContext,
  baseUrl: string,
  account: SmokeAccount,
  prefix: string,
  suffix: string,
  input: { latitude: number; longitude: number; echoNote: string; privateNote: string },
): Promise<PlaceMemorySmokeRecord> {
  const response = await api.post(joinUrl(baseUrl, "/api/v1/observations/upsert"), {
    headers: jsonHeaders(baseUrl, account),
    data: {
      observationId: `${prefix}-place-memory-${suffix}`,
      clientSubmissionId: `${prefix}-place-memory-${suffix}-${Date.now()}`,
      userId: account.userId,
      observedAt: "2026-05-25T09:00:00.000Z",
      latitude: input.latitude,
      longitude: input.longitude,
      visibility: productionSmokeObservationVisibility,
      localityNote: `production place memory smoke ${prefix}`,
      note: `production place memory smoke record ${prefix} ${suffix}`,
      taxon: { vernacularName: "クスノキ", scientificName: "Cinnamomum camphora", rank: "species" },
      sourcePayload: { source: "production_place_memory_smoke", fixturePrefix: prefix },
      placeMemory: {
        tags: ["refresh_walk", "walked_with_someone"],
        echoNote: input.echoNote,
        privateNote: input.privateNote,
        photoEchoEnabled: false,
      },
    },
  });
  const payload = (await response.json().catch(() => null)) as PlaceMemorySmokeRecord | null;
  expect(response.ok(), payload?.error ?? `place memory record ${suffix}`).toBeTruthy();
  expect(payload?.ok, payload?.error ?? `place memory record ${suffix}`).toBeTruthy();
  expect(payload?.placeMemory?.entryId, `place memory entry ${suffix}`).toBeTruthy();
  return payload!;
}

async function pollOwnerMapPhotoRecord(
  api: APIRequestContext,
  baseUrl: string,
  account: SmokeAccount,
  expected: { latitude: number; longitude: number },
): Promise<OwnerMapSmokeItem> {
  const deadline = Date.now() + 30_000;
  let lastPayload: JsonPayload = {};
  while (Date.now() < deadline) {
    const response = await api.get(joinUrl(baseUrl, "/api/v1/map/my-observations?limit=48"), {
      headers: authHeaders(baseUrl, account),
    });
    const payload = (await response.json().catch(() => ({}))) as JsonPayload & {
      signedIn?: boolean;
      items?: OwnerMapSmokeItem[];
    };
    expect(response.ok(), `owner map observations should be reachable: ${response.status()}`).toBeTruthy();
    expect(payload.signedIn, "owner map observations should see the smoke session").toBe(true);
    lastPayload = payload;

    const match = (payload.items ?? []).find((item) => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);
      return Boolean(item.photoUrl)
        && Number.isFinite(lat)
        && Number.isFinite(lng)
        && Math.abs(lat - expected.latitude) < 0.0002
        && Math.abs(lng - expected.longitude) < 0.0002;
    });
    if (match) {
      expect(match.photoUrl, "owner map photo URL should use a thumbnail derivative").toMatch(/\/thumb\//);
      expect(match.photoUrl, "owner map photo URL must not expose original uploads").not.toMatch(/\/uploads\/|original\//);
      expect(JSON.stringify(match), "owner map item must not expose observer identity").not.toMatch(/userId|ownerUserId|observer|profile/i);
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`owner map photo record not found; last=${JSON.stringify(lastPayload).slice(0, 800)}`);
}

async function pollOwnerMapRecord(
  api: APIRequestContext,
  baseUrl: string,
  account: SmokeAccount,
  expected: { visitId: string; latitude: number; longitude: number },
): Promise<OwnerMapSmokeItem> {
  const deadline = Date.now() + 30_000;
  let lastPayload: JsonPayload = {};
  while (Date.now() < deadline) {
    const response = await api.get(joinUrl(baseUrl, "/api/v1/map/my-observations?limit=48"), {
      headers: authHeaders(baseUrl, account),
    });
    const payload = (await response.json().catch(() => ({}))) as JsonPayload & {
      signedIn?: boolean;
      items?: OwnerMapSmokeItem[];
    };
    expect(response.ok(), `owner map observations should be reachable: ${response.status()}`).toBeTruthy();
    expect(payload.signedIn, "owner map observations should see the smoke session").toBe(true);
    lastPayload = payload;

    const match = (payload.items ?? []).find((item) => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);
      return item.visitId === expected.visitId
        && Number.isFinite(lat)
        && Number.isFinite(lng)
        && Math.abs(lat - expected.latitude) < 0.0002
        && Math.abs(lng - expected.longitude) < 0.0002;
    });
    if (match) {
      if (match.photoUrl) {
        expect(match.photoUrl, "owner map photo URL should use a thumbnail derivative").toMatch(/\/thumb\//);
        expect(match.photoUrl, "owner map photo URL must not expose original uploads").not.toMatch(/\/uploads\/|original\//);
      }
      expect(JSON.stringify(match), "owner map item must not expose observer identity").not.toMatch(/userId|ownerUserId|observer|profile/i);
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`owner map record not found; last=${JSON.stringify(lastPayload).slice(0, 800)}`);
}

function isObservationUpsertResponse(response: import("@playwright/test").Response): boolean {
  try {
    return new URL(response.url()).pathname.endsWith("/api/v1/observations/upsert") &&
      response.request().method() === "POST";
  } catch {
    return false;
  }
}

async function hideSmokeObservation(
  api: APIRequestContext,
  baseUrl: string,
  account: SmokeAccount,
  visitId: string,
  label: string,
): Promise<void> {
  expect(visitId, `${label} should have a visit id before hide`).toBeTruthy();
  const response = await api.post(joinUrl(baseUrl, `/api/v1/observations/${encodeURIComponent(visitId)}/hide`), {
    headers: authHeaders(baseUrl, account),
  });
  const payload = await jsonFromResponse(response, `${label} hide`);
  expect(response.ok(), `${label} hide HTTP status: ${JSON.stringify(payload).slice(0, 300)}`).toBeTruthy();
  expect(payload.ok, `${label} hide ok`).toBe(true);
  expect(payload.hidden, `${label} hide hidden`).toBe(true);
}

async function captureIdentificationSmokeReference(
  api: APIRequestContext,
  baseUrl: string,
  account: SmokeAccount,
  prefix: string,
  taxonHint: string,
): Promise<ReferenceCaptureSmokeRecord> {
  const title = `Production Smoke Field Guide ${prefix}`;
  const response = await api.post(joinUrl(baseUrl, "/api/v1/references/capture-batches"), {
    headers: jsonHeaders(baseUrl, account),
    data: {
      countryCode: "JP",
      items: [{
        title,
        isbn: smokeReferenceIsbn(prefix),
        authorText: "IKIMON QA",
        publisher: "IKIMON",
        publicationYear: 2026,
        taxonHints: [taxonHint],
        proofKind: "isbn",
      }],
    },
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    items?: Array<{ sourceId?: string; title?: string; verificationStatus?: string }>;
  } | null;
  expect(response.ok(), payload?.error ?? "reference_capture_failed").toBeTruthy();
  expect(payload?.ok, payload?.error ?? "reference_capture_failed").toBeTruthy();
  const item = payload?.items?.[0];
  expect(item?.sourceId, "reference source id").toBeTruthy();
  expect(item?.verificationStatus, "reference ownership should be verified for ISBN proof").toBe("ai_verified");
  return {
    sourceId: item!.sourceId!,
    title: item!.title || title,
  };
}

async function thumbUrlsOnPage(page: import("@playwright/test").Page): Promise<string[]> {
  return page.locator("img").evaluateAll((imgs) => {
    return Array.from(new Set(imgs
      .map((img) => (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || img.getAttribute("src") || "")
      .filter((src) => src.includes("/thumb/") || src.includes("/derived/"))));
  });
}

function occurrenceIdFromIdentificationEndpoint(endpoint: string): string {
  const match = endpoint.match(/\/api\/v1\/observations\/([^/]+)\/identifications(?:$|\?)/);
  expect(match?.[1], "identification endpoint should include an encoded occurrence id").toBeTruthy();
  return decodeURIComponent(match![1]!);
}

function visitIdFromObservationHref(baseUrl: string, href: string): string {
  const url = new URL(href, baseUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const observationIndex = segments.lastIndexOf("observations");
  const visitId = observationIndex >= 0 ? segments[observationIndex + 1] : "";
  expect(visitId, "records card href should include an observation visit id").toBeTruthy();
  return decodeURIComponent(visitId!);
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

  test("global quick record success ships return links", async ({ page }) => {
    const response = await page.goto("/ja/", { waitUntil: "domcontentloaded" });
    expect(response?.status(), "home status").toBeLessThan(500);
    const html = await page.content();
    expect(html, "saved record should link back to own records").toContain('data-global-record-saved-action="records"');
    expect(html, "saved record should link back to My page").toContain('data-global-record-saved-action="profile"');
    expect(html, "saved record should link back to map").toContain('data-global-record-saved-action="map"');
    expect(html, "records return URL should preserve source attribution").toContain("/records?view=mine&source=record_saved");
    expect(html, "profile return URL should preserve source attribution").toContain("/profile?source=record_saved");
    expect(html, "map return URL should preserve source attribution").toContain("/map?tab=places&source=record_saved");
  });

  test("public map payload stays public-safe", async ({ request }) => {
    const observations = await request.get("/api/v1/map/observations?bbox=122.9,24.0,146.0,45.6&zoom=6&limit=48");
    expect(observations.status(), "public map observations status").toBeLessThan(500);
    const observationPayload = await observations.json() as JsonPayload & { items?: unknown[] };
    expect(Array.isArray(observationPayload.items), "public map observations should return list items").toBe(true);
    expect(observationPayload.items?.length ?? 0, "public map should expose at least one public-safe item").toBeGreaterThan(0);
    expect(collectForbiddenJsonKeyPaths(observationPayload, [
      /^latitude$/i,
      /^longitude$/i,
      /^userId$/i,
      /^ownerUserId$/i,
      /^observerUserId$/i,
      /^observerName$/i,
      /^observerAvatarUrl$/i,
      /^profileHref$/i,
      /^profileUrl$/i,
      /^profileLink$/i,
    ])).toEqual([]);
    expect(JSON.stringify(observationPayload), "public map photos must not expose original uploads").not.toMatch(/\/uploads\/|\/original\//i);

    const cells = await request.get("/api/v1/map/cells?bbox=122.9,24.0,146.0,45.6&zoom=6&limit=48");
    expect(cells.status(), "public map cells status").toBeLessThan(500);
    const cellPayload = await cells.json() as JsonPayload & { features?: unknown[] };
    expect(Array.isArray(cellPayload.features), "public map cells should return feature collection").toBe(true);
    expect(cellPayload.features?.length ?? 0, "public map should expose at least one public-safe cell").toBeGreaterThan(0);
    expect(collectForbiddenJsonKeyPaths(cellPayload, [
      /^userId$/i,
      /^ownerUserId$/i,
      /^observerUserId$/i,
      /^observerName$/i,
      /^observerAvatarUrl$/i,
      /^profileHref$/i,
      /^profileUrl$/i,
      /^profileLink$/i,
    ])).toEqual([]);
  });

  test("guide relay static GSI map loads real tile images", async ({ page, request }) => {
    const response = await page.goto("/ja/guide-programs/aikan-renri-guide-relay", { waitUntil: "domcontentloaded" });
    expect(response?.status(), "guide program status").toBeLessThan(500);

    const staticMap = page.locator('[data-guide-static-map="gsi-std"]');
    await expect(staticMap).toBeVisible();
    await staticMap.scrollIntoViewIfNeeded();
    const tiles = staticMap.locator('img[data-guide-static-tile="true"]');
    await expect(tiles, "guide program preview should render the 4x3 GSI tile grid").toHaveCount(12);

    await expect.poll(async () =>
      tiles.evaluateAll((images) =>
        images.filter((image) => {
          const img = image as HTMLImageElement;
          return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
        }).length,
      ), { message: "all guide program GSI tiles should finish loading in the browser" },
    ).toBe(12);

    const tileUrls = await tiles.evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src),
    );
    const tileFetchWarnings: string[] = [];
    for (const url of tileUrls) {
      expect(url, "tile src should use the GSI standard tile endpoint").toContain("cyberjapandata.gsi.go.jp/xyz/std/");
      try {
        const tileResponse = await request.get(url, { timeout: 10_000 });
        const contentType = tileResponse.headers()["content-type"] ?? "";
        const body = await tileResponse.body();
        if (tileResponse.status() !== 200 || !/^image\/png\b/.test(contentType) || body.length <= 1024) {
          tileFetchWarnings.push(`${url} status=${tileResponse.status()} content-type=${contentType} bytes=${body.length}`);
        }
      } catch (error) {
        tileFetchWarnings.push(`${url} ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (tileFetchWarnings.length) {
      console.warn(`Best-effort GSI tile fetch warnings:\n${tileFetchWarnings.join("\n")}`);
    }

    const mapBox = await page.locator(".guide-program-map").boundingBox();
    const pinBox = await page.locator(".guide-program-map-pin").first().boundingBox();
    expect(mapBox, "guide program map should be visible").toBeTruthy();
    expect(pinBox, "guide program map pin should be visible").toBeTruthy();
    expect(pinBox!.x + pinBox!.width / 2).toBeGreaterThanOrEqual(mapBox!.x);
    expect(pinBox!.x + pinBox!.width / 2).toBeLessThanOrEqual(mapBox!.x + mapBox!.width);
    expect(pinBox!.y + pinBox!.height / 2).toBeGreaterThanOrEqual(mapBox!.y);
    expect(pinBox!.y + pinBox!.height / 2).toBeLessThanOrEqual(mapBox!.y + mapBox!.height);
    await expectNoHorizontalOverflow(page);
  });

  test("public surfaces do not leak fixtures or 1x1 placeholder record images", async ({ page, request }) => {
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
    expect(checkedThumbs.size, "public smoke should inspect at least one public record image").toBeGreaterThan(0);
  });

  for (const scene of canonicalAiSubjectScenes) {
    test(`canonical scene keeps snapshot-aligned AI subject detail flow: ${scene.path}`, async ({ page }) => {
    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );

    const response = await page.goto(scene.path, { waitUntil: "domcontentloaded" });
    expect(response?.ok(), "canonical AI subject scene should be readable").toBeTruthy();
    await expect(page.locator("body")).not.toContainText("この写真に写っているもの");
    await expect(page.locator("body")).not.toContainText("この映像に写っているもの");
    await expect(page.locator("body")).not.toContainText("この映像で読む対象を切り替える");
    await expect(page.locator("body")).not.toContainText("候補を確かめる材料");
    await expect(page.locator("body")).toContainText("AI候補");
    await expect(page.locator("body")).toContainText("観察記録 / 環境情報");
    await expect(page.locator(".obs-ai-readout")).toBeVisible();
    const recordDetails = page.locator(".obs-record-details");
    await expect(recordDetails.locator(":scope > summary")).toContainText("記録を詳しくする");
    await expect(page.locator(".obs-local-quality-inline")).toBeHidden();
    await recordDetails.locator(":scope > summary").click();
    await expect(page.locator(".obs-local-quality-inline")).toBeVisible();
    await expect(page.locator(".obs-frame-identify-card")).toBeVisible();
    await expect(page.locator(".obs-local-quality-card")).toBeVisible();
    await expect(page.locator(".obs-visible-record-card")).toHaveCount(0);

    await expect(page.locator("body")).not.toContainText("これも写ってると提案");
    await expect(page.locator("body")).not.toContainText("写っている対象として知らせる");
    await expect(page.locator("body")).not.toContainText("観測レコードにする");
    await recordSmokeCheckpoint("canonical_scene_snapshot_detail_flow", {
      path: scene.path,
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
      await expect(page.locator("body")).not.toContainText("この写真に写っているもの");
      await expect(page.locator("body")).not.toContainText("候補を確かめる材料");
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

  test("[auth-write] logged-in invasive species pages render against the production candidate", async ({ browser }) => {
    test.setTimeout(120_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );
    requireProductionSmokeWriteScope("auth-write");

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

  test("observation detail keeps field-management edit UI out of the snapshot flow", async ({ browser }) => {
    test.setTimeout(90_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );

    const baseUrl = productionSmokeBaseUrl();
    const context = await browser.newContext({ ignoreHTTPSErrors: true });

    try {
      const page = await context.newPage();

      await page.goto(joinUrl(baseUrl, canonicalFieldAdviceScene), { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).not.toContainText("現場アドバイス");
      await expect(page.locator("[data-care-policy-form]")).toHaveCount(0);
      await expect(page.locator("body")).toContainText("観察記録 / 環境情報");
      await recordSmokeCheckpoint("field_policy_ui_hidden_on_observation_detail", {
        path: page.url(),
      });
    } finally {
      await context.close();
    }
  });

  test("[shared-production-write] identification workbench saves reference evidence against the production candidate", async ({ browser }) => {
    test.setTimeout(180_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );
    requireProductionSmokeWriteScope("shared-production-write");

    const baseUrl = productionSmokeBaseUrl();
    const prefix = productionSmokePrefix();
    const identifierContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 860 },
    });

    try {
      const identifier = await registerSmokeUser(identifierContext.request, baseUrl, prefix, "id-identifier", {
        displayName: "同定確認担当",
      });

      await addSessionCookieToContext(identifierContext, baseUrl, identifier.sessionCookie);
      const page = await identifierContext.newPage();
      const recordsPath = joinUrl(baseUrl, "/records?view=needs_id&lang=ja");
      await page.goto(recordsPath, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-records-identify-workbench]")).toBeVisible();
      const card = page.locator("[data-records-identify-card]").first();
      await expect(card, "production needs_id workbench should expose an identification candidate").toBeVisible();
      const candidateName = (
        await card.getAttribute("data-identify-default-name") ||
        await card.getAttribute("data-identify-title") ||
        ""
      ).trim();
      expect(candidateName, "selected production candidate name").toBeTruthy();
      const identifyEndpoint = await card.getAttribute("data-identify-endpoint");
      expect(identifyEndpoint, "selected production candidate identify endpoint").toBeTruthy();
      const occurrenceId = occurrenceIdFromIdentificationEndpoint(identifyEndpoint!);
      const detailHref = await card.locator(".records-post-card-link").first().getAttribute("href");
      expect(detailHref, "selected production candidate detail href").toBeTruthy();
      const visitId = visitIdFromObservationHref(baseUrl, detailHref!);
      const reference = await captureIdentificationSmokeReference(identifierContext.request, baseUrl, identifier, prefix, candidateName);
      await card.locator(".records-post-card-link").click();

      const referenceOption = page.locator(".records-identify-reference-option", { hasText: reference.title }).first();
      await expect(referenceOption, "owned reference should be suggested for the target taxon").toBeVisible();
      await expect(referenceOption.locator('input[name="referenceSourceIds"]')).toBeChecked();

      const locator = "p.12 / fig. smoke";
      await page.locator("[data-identify-panel-reference-locator]").fill(locator);
      await page.locator('[data-identify-panel-action="support"]').click();
      await expect(page.locator("[data-identify-panel-status]")).toContainText("保存しました");

      await page.goto(
        joinUrl(baseUrl, `/observations/${encodeURIComponent(visitId)}?subject=${encodeURIComponent(occurrenceId)}&lang=ja`),
        { waitUntil: "domcontentloaded" },
      );
      const idHistory = page.locator(".obs-local-name-activity-list").first();
      await expect(idHistory).toContainText(candidateName);
      await expect(idHistory).toContainText(reference.title);
      await expect(idHistory).toContainText(locator);
      await recordSmokeCheckpoint("identification_workbench_reference_flow", {
        visitId,
        occurrenceId,
        sourceId: reference.sourceId,
        identifierUserId: identifier.userId,
        candidateName,
      });
    } finally {
      await identifierContext.close();
    }
  });

  test("[private-post] API private observation post uploads a photo and stays out of public detail", async ({ request }) => {
    test.setTimeout(120_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );
    requireProductionSmokeWriteScope("private-post");

    const baseUrl = productionSmokeBaseUrl();
    const prefix = productionSmokePrefix();
    const account = await registerSmokeUser(request, baseUrl, prefix, "api-private-post");
    const observationId = `${prefix}-api-private-post`;
    const observedAt = new Date().toISOString();
    const expectedLocation = { latitude: 34.7108, longitude: 137.7261 };

    const upsertResponse = await request.post(joinUrl(baseUrl, "/api/v1/observations/upsert"), {
      headers: jsonHeaders(baseUrl, account),
      data: {
        observationId,
        clientSubmissionId: `${observationId}-${Date.now()}`,
        userId: account.userId,
        observedAt,
        latitude: expectedLocation.latitude,
        longitude: expectedLocation.longitude,
        visibility: productionSmokeObservationVisibility,
        localityNote: `production private post smoke ${prefix}`,
        note: `production private post smoke ${prefix}`,
        taxon: { vernacularName: "クスノキ", scientificName: "Cinnamomum camphora", rank: "species" },
        sourcePayload: { source: "production_private_post_smoke", fixturePrefix: prefix },
      },
    });
    const upsertPayload = await jsonFromResponse(upsertResponse, "private post observation upsert");
    expect(upsertResponse.ok(), String(upsertPayload.error ?? "private_post_upsert_failed")).toBeTruthy();
    expect(upsertPayload.ok, "private post observation upsert ok").toBe(true);
    const visitId = String(upsertPayload.visitId ?? observationId);
    expect(visitId).toBe(observationId);

    const photoResponse = await request.post(joinUrl(baseUrl, `/api/v1/observations/${encodeURIComponent(visitId)}/photos/upload`), {
      headers: jsonHeaders(baseUrl, account),
      data: {
        filename: `${prefix}-private-post.png`,
        mimeType: "image/png",
        base64Data: smokePhotoBase64,
        facePrivacy: "no_faces",
      },
    });
    const photoPayload = await jsonFromResponse(photoResponse, "private post photo upload");
    expect(photoResponse.ok(), String(photoPayload.error ?? "private_post_photo_failed")).toBeTruthy();
    expect(photoPayload.ok, "private post photo upload ok").toBe(true);

    const publicDetail = await request.get(joinUrl(baseUrl, `/api/v1/observations/${encodeURIComponent(visitId)}/public-detail`));
    expect(publicDetail.status(), "private post should not have a public detail document").toBe(404);

    const ownerMapItem = await pollOwnerMapRecord(request, baseUrl, account, { visitId, ...expectedLocation });
    expect(ownerMapItem.visitId).toBe(visitId);

    await hideSmokeObservation(request, baseUrl, account, visitId, "api private post");
    await recordSmokeCheckpoint("api_private_post_hidden", {
      visitId,
      userId: account.userId,
      hasPhotoUrl: Boolean(ownerMapItem.photoUrl),
    });
  });

  test("[private-post-ui] mobile record UI saves photo and video against the production candidate", async ({ browser }) => {
    test.setTimeout(180_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );
    requireProductionSmokeWriteScope("private-post-ui");

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
      await context.setExtraHTTPHeaders({ cookie: account.sessionCookie });
      await addSessionCookieToContext(context, baseUrl, account.sessionCookie);
      const page = await context.newPage();

      await page.goto(joinUrl(baseUrl, "/record?lang=ja"), { waitUntil: "domcontentloaded" });
      await expect(page.locator("#record-form")).toBeHidden();
      await page.locator("#record-media-photo").setInputFiles(smokePhotoFile(prefix));
      await expect(page.locator("#record-form")).toBeVisible();
      await fillRequiredRecordFields(page);

      const photoObservationSave = page.waitForResponse(isObservationUpsertResponse);
      const photoUpload = page.waitForResponse((response) =>
        response.url().includes("/photos/upload") && response.request().method() === "POST",
      );
      await page.locator("#record-submit-panel button[type='submit']").click();
      const photoObservationResponse = await photoObservationSave;
      const photoObservationPayload = await jsonFromResponse(photoObservationResponse, "photo observation upsert");
      expect(photoObservationResponse.ok(), `photo observation upsert HTTP status for ${account.email}`).toBeTruthy();
      const photoVisitId = String(photoObservationPayload.visitId ?? "");
      expect(photoVisitId, "photo observation upsert should return visitId").toBeTruthy();
      const photoResponse = await photoUpload;
      const photoPayload = await jsonFromResponse(photoResponse, "photo upload");
      expect(photoResponse.ok(), `photo upload HTTP status for ${account.email}`).toBeTruthy();
      expect(photoPayload.ok, "photo upload must keep the shared ok:true contract").toBe(true);
      await recordSmokeCheckpoint("photo_api_contract", { httpStatus: photoResponse.status() });
      await expect(page.locator("#record-status")).toContainText("記録を保存しました");
      await expect(page.locator("#record-status")).toContainText("写真1枚を同じ記録に保存しました。");
      await recordSmokeCheckpoint("photo_ui_post");
      const ownerMapItem = await pollOwnerMapRecord(context.request, baseUrl, account, {
        visitId: photoVisitId,
        latitude: 34.7108,
        longitude: 137.7261,
      });
      await recordSmokeCheckpoint("owner_map_photo_lane", {
        visitId: ownerMapItem.visitId,
        hasPhotoUrl: Boolean(ownerMapItem.photoUrl),
      });
      await hideSmokeObservation(context.request, baseUrl, account, photoVisitId, "photo private post");
      await recordSmokeCheckpoint("photo_private_post_hidden", { visitId: photoVisitId });

      await page.goto(joinUrl(baseUrl, "/record?lang=ja&start=video"), { waitUntil: "domcontentloaded" });
      await page.locator("#record-media-video").setInputFiles(smokeVideoFile(prefix));
      await expect(page.locator("#record-form")).toBeVisible();
      await fillRequiredRecordFields(page);

      const videoObservationSave = page.waitForResponse(isObservationUpsertResponse);
      const directUpload = page.waitForResponse((response) =>
        response.url().includes("/api/v1/videos/direct-upload") && response.request().method() === "POST",
      );
      const finalizeUpload = page.waitForResponse((response) =>
        /\/api\/v1\/videos\/[^/]+\/finalize$/.test(new URL(response.url()).pathname) &&
        response.request().method() === "POST",
      );
      await page.locator("#record-submit-panel button[type='submit']").click();
      const videoObservationResponse = await videoObservationSave;
      const videoObservationPayload = await jsonFromResponse(videoObservationResponse, "video observation upsert");
      expect(videoObservationResponse.ok(), "video observation upsert HTTP status").toBeTruthy();
      const videoVisitId = String(videoObservationPayload.visitId ?? "");
      expect(videoVisitId, "video observation upsert should return visitId").toBeTruthy();
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
      await hideSmokeObservation(context.request, baseUrl, account, videoVisitId, "video private post");
      await recordSmokeCheckpoint("video_private_post_hidden", { visitId: videoVisitId });
    } finally {
      await context.close();
    }
  });

  test("[place-memory-write] place memory unlocks same-cell echoes without leaking private notes", async ({ request }) => {
    test.setTimeout(120_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );
    requireProductionSmokeWriteScope("place-memory-write");

    const baseUrl = productionSmokeBaseUrl();
    const prefix = productionSmokePrefix();
    const accountA = await registerSmokeUser(request, baseUrl, prefix, "place-memory-a");
    const accountB = await registerSmokeUser(request, baseUrl, prefix, "place-memory-b");

    const first = await postPlaceMemorySmokeRecord(request, baseUrl, accountA, prefix, "a", {
      latitude: 34.7108,
      longitude: 137.7261,
      echoNote: "春の夕方に歩いた",
      privateNote: "private production memo should never leak",
    });
    const cellId = first.placeMemory!.cellId;
    expect(first.placeMemory?.hasPrivateNote).toBe(true);
    expect(JSON.stringify(first)).not.toContain("private production memo");

    const lockedResponse = await request.get(joinUrl(baseUrl, `/api/v1/place-memory?cellId=${encodeURIComponent(cellId)}`), {
      headers: authHeaders(baseUrl, accountB),
    });
    const locked = await jsonFromResponse(lockedResponse, "locked place memory list") as {
      unlocked?: boolean;
      items?: unknown[];
    };
    expect(lockedResponse.ok(), String(locked.error ?? "locked place memory list failed")).toBeTruthy();
    expect(locked.unlocked).toBe(false);
    expect(locked.items ?? []).toHaveLength(0);

    const second = await postPlaceMemorySmokeRecord(request, baseUrl, accountB, prefix, "b", {
      latitude: 34.71082,
      longitude: 137.72612,
      echoNote: "同じ木陰で見つけた",
      privateNote: "second private production memo should never leak",
    });
    expect(JSON.stringify(second.placeMemorySample ?? [])).not.toContain("second private production memo");

    const listResponse = await request.get(joinUrl(baseUrl, `/api/v1/place-memory?cellId=${encodeURIComponent(cellId)}&limit=12`), {
      headers: authHeaders(baseUrl, accountB),
    });
    const list = await jsonFromResponse(listResponse, "unlocked place memory list") as {
      unlocked?: boolean;
      items?: Array<{ entryId: string; echoNote: string; observedYearMonth: string; ownEntry: boolean; likeCount: number }>;
    };
    expect(listResponse.ok(), String(list.error ?? "unlocked place memory list failed")).toBeTruthy();
    expect(list.unlocked).toBe(true);
    expect((list.items ?? []).map((item) => item.echoNote)).toEqual(expect.arrayContaining(["春の夕方に歩いた", "同じ木陰で見つけた"]));
    expect(JSON.stringify(list)).not.toContain("private production memo");
    expect((list.items ?? []).every((item) => /^\d{4}-\d{2}$/.test(item.observedYearMonth))).toBe(true);

    const firstEntry = (list.items ?? []).find((item) => item.echoNote === "春の夕方に歩いた");
    expect(firstEntry).toBeTruthy();
    const likeResponse = await request.post(joinUrl(baseUrl, `/api/v1/place-memory/${encodeURIComponent(firstEntry!.entryId)}/like`), {
      headers: authHeaders(baseUrl, accountB),
    });
    const liked = await jsonFromResponse(likeResponse, "place memory like") as { liked?: boolean; likeCount?: number; error?: string };
    expect(likeResponse.ok(), String(liked.error ?? "place memory like failed")).toBeTruthy();
    expect(liked.liked).toBe(true);
    expect(liked.likeCount).toBe(1);

    const selfLikeResponse = await request.post(joinUrl(baseUrl, `/api/v1/place-memory/${encodeURIComponent(second.placeMemory!.entryId)}/like`), {
      headers: authHeaders(baseUrl, accountB),
    });
    expect(selfLikeResponse.status()).toBe(403);

    const reportResponse = await request.post(joinUrl(baseUrl, `/api/v1/place-memory/${encodeURIComponent(firstEntry!.entryId)}/report`), {
      headers: jsonHeaders(baseUrl, accountB),
      data: { reasonCode: "qa_hide", reasonNote: "production self-hide check" },
    });
    const reported = await jsonFromResponse(reportResponse, "place memory report") as { hiddenForMe?: boolean; moderationStatus?: string; error?: string };
    expect(reportResponse.ok(), String(reported.error ?? "place memory report failed")).toBeTruthy();
    expect(reported.hiddenForMe).toBe(true);
    expect(reported.moderationStatus).toBe("visible");

    await recordSmokeCheckpoint("place_memory_same_cell_echo", {
      cellId,
      firstEntryId: firstEntry!.entryId,
      firstUserId: accountA.userId,
      secondUserId: accountB.userId,
    });
  });

  test("[public-capsule-write] place event capsule flow works with organizer, recorder, guide, and scanner accounts", async ({ browser }) => {
    test.setTimeout(180_000);

    test.skip(
      !process.env.PRODUCTION_SMOKE_BASE_URL?.trim(),
      "requires a production candidate base URL or SSH tunnel",
    );
    requireProductionSmokeWriteScope("public-capsule-write");

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
          visibility: productionSmokeObservationVisibility,
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
          visibility: productionSmokeObservationVisibility,
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
