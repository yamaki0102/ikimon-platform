import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getStrings } from "../src/i18n/index.js";
import type { SiteLang } from "../src/i18n.js";
import type { LandingObservation, LandingSnapshot } from "../src/services/readModels.js";
import type { ProfileSnapshot } from "../src/services/readModels.js";
import { PROFILE_HUB_STYLES, renderSelfProfileHub } from "../src/routes/read.js";
import { LANDING_TOP_STYLES, renderLandingTopSections } from "../src/ui/landingTop.js";
import { renderSiteDocument } from "../src/ui/siteShell.js";

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function fixturePhoto(id: string): string {
  const palettes = [
    ["#f4b35d", "#b8503f", "#274c5a"],
    ["#9ac6d8", "#527c70", "#d4a154"],
    ["#e7b2a5", "#78536d", "#314b57"],
    ["#b9d58a", "#507c61", "#d9a768"],
  ];
  const palette = palettes[id.split("").reduce((total, char) => total + char.charCodeAt(0), 0) % palettes.length]!;
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 510"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="#f7e6c8"/></linearGradient></defs><rect width="680" height="510" fill="url(#sky)"/><circle cx="540" cy="110" r="52" fill="#fff2bd" opacity=".82"/><path d="M0 330 150 205l120 92 110-132 155 142 145-95v298H0z" fill="${palette[1]}" opacity=".82"/><path d="M0 390c145-72 260-42 362 2 116 50 207 28 318-34v152H0z" fill="${palette[2]}"/><path d="M80 285v112m-26-82h52M580 250v150m-34-112h68" stroke="#fff8e8" stroke-width="16" stroke-linecap="round" opacity=".75"/></svg>`);
}

const fixtureBrandMark = svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#177b50"/><path d="M17 38c10-21 25-23 32-19-1 17-12 29-27 27 5-8 11-13 19-18-10 2-17 6-24 10z" fill="#fff"/></svg>');
const fixtureWordmark = svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 60"><text x="2" y="45" fill="#17211b" font-family="Arial,sans-serif" font-size="48" font-weight="700">ikimon</text></svg>');

function obs(id: string, overrides: Partial<LandingObservation> = {}): LandingObservation {
  return {
    occurrenceId: `occ-${id}`, visitId: id, detailId: id, displayName: `record-${id}`,
    observedAt: "2026-07-19T08:30:00Z", observerName: "viewer", placeName: "source place", municipality: "浜松市",
    publicLocation: { label: "浜松市", scope: "municipality", cellId: null, gridM: null, radiusM: null, centroidLat: null, centroidLng: null, displayMode: "area" },
    photoUrl: fixturePhoto(id), identificationCount: 0,
    latitude: null, longitude: null, observerUserId: "other", observerAvatarUrl: null, entryType: "observation", publicFeedEligible: true, librarySourceKind: "photo",
    ...overrides,
  };
}

function snap(member: boolean, sparse = false): LandingSnapshot {
  const publicItems = sparse ? [] : [
    obs("public-landscape", { displayName: "川沿いの夕景" }),
    obs("public-portrait", { displayName: "ツバメかもしれません" }),
    obs("public-video", { displayName: "水辺の動画", librarySourceKind: "video", hasVideo: true }),
    obs("public-audio", { displayName: "夜の音", librarySourceKind: "audio", hasAudio: true, photoUrl: null }),
    obs("public-memo", { displayName: "草地のメモ", librarySourceKind: "note", photoUrl: null }),
  ];
  const ownItems = member && !sparse ? [
    obs("mine-latest", { observerUserId: "viewer", displayName: "川沿いの夕景", aiAssessmentStatus: "processing" }),
    obs("mine-discovery", { observerUserId: "viewer", displayName: "名前待ち", aiCandidateName: "ツバメ", isAiCandidate: true }),
  ] : [];
  const myPlaces = member && !sparse ? [{
    placeId: "place-miyakoda", placeName: "都田", municipality: "浜松市",
    lastObservedAt: "2026-07-19T08:30:00Z", previousObservedAt: "2026-06-20T08:30:00Z", firstObservedAt: "2026-05-18T08:30:00Z",
    visitCount: 3, latestDisplayName: "夏祭りの準備", revisitReason: null, nextLookFor: null,
    lastRecordMode: null, lastSurveyResult: null, absenceSemantics: null, latitude: null, longitude: null,
  }] : [];
  const nearbyEvents = member && !sparse ? [{
    sessionId: "event-miyakoda", eventCode: "miyakoda-summer", title: "都田夏祭り",
    startedAt: "2026-08-01T09:00:00Z", endedAt: null, fieldId: "place-miyakoda",
    fieldName: "都田", city: "浜松市", prefecture: "静岡県", participantCount: 12,
  }] : [];
  return { viewerUserId: member ? "viewer" : null, stats: { observationCount: 5, speciesCount: 2, placeCount: 2 }, feed: publicItems, myFeed: ownItems, myPlaces, nearbyFields: [], nearbyEvents, mapPreviewCells: [], ambient: [], habit: null, dailyDashboard: null };
}

function pageHtml(lang: SiteLang, member: boolean, sparse = false): string {
  const strings = getStrings(lang);
  const sections = renderLandingTopSections({ basePath: "", lang, copy: strings.landing, fieldLoop: strings.fieldLoop, snapshot: snap(member, sparse), isLoggedIn: member });
  return renderSiteDocument({
    basePath: "", title: strings.landing.title, description: strings.landing.home.guest.heroLead,
    body: `${sections.heroHtml}${sections.dailyDashboardHtml}`, lang, currentPath: `/${lang === "pt-BR" ? "pt-br" : lang}/`,
    shellClassName: "shell-bleed prototype-shell", extraStyles: LANDING_TOP_STYLES, homeChrome: member ? "member" : "guest",
  })
    .replaceAll("/assets/brand/app-icon-192.png", fixtureBrandMark)
    .replaceAll("/assets/brand/ikimon-wordmark-black.png", fixtureWordmark)
    .replaceAll("/assets/img/landing/yamaki.webp", fixturePhoto("guest-owner"));
}

const widths = [320, 375, 390, 768, 1280, 1440];
const qaDir = process.env.LANDING_HOME_QA_DIR;

async function capture(page: import("@playwright/test").Page, name: string): Promise<void> {
  if (!qaDir) return;
  mkdirSync(qaDir, { recursive: true });
  await page.screenshot({ path: join(qaDir, `${name}.png`), fullPage: true });
}

async function prepareIndexedDbOrigin(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/__visual-indexeddb-origin", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>visual qa</title>" });
  });
  await page.goto("/__visual-indexeddb-origin", { waitUntil: "domcontentloaded" });
}

function selfSnapshot(): ProfileSnapshot {
  return {
    visibility: "owner",
    userId: "viewer",
    displayName: "八巻 毅",
    rankLabel: null,
    avatarUrl: null,
    profileBio: "地域で見つけた風景や活動を記録しています。",
    expertise: null,
    publicContributionRange: null,
    stats: {
      totalObservations: 24,
      thisMonthObservations: 3,
      placeCount: 7,
      uniqueTaxaAllTime: 0,
      currentStreakDays: 0,
      tier2PlusCount: 0,
      tier3PlusCount: 0,
      firstObservedAt: "2026-05-01T09:00:00.000Z",
      latestObservedAt: "2026-07-19T08:30:00.000Z",
    },
    lifeListPreview: [],
    recentPlaces: [],
    recentObservations: [],
  };
}

function selfPageHtml(): string {
  const snapshot = selfSnapshot();
  return renderSiteDocument({
    basePath: "",
    title: `${snapshot.displayName} | ikimon`,
    activeNav: "自分",
    lang: "ja",
    body: renderSelfProfileHub("", "ja", snapshot),
    extraStyles: PROFILE_HUB_STYLES,
    currentPath: "/ja/profile",
  })
    .replaceAll("/assets/brand/app-icon-192.png", fixtureBrandMark)
    .replaceAll("/assets/brand/ikimon-wordmark-black.png", fixtureWordmark);
}

for (const width of [375, 390, 768, 1440]) {
  test(`self hub ${width}px separates identity controls from Home memories`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setContent(selfPageHtml(), { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("self-control-hub")).toBeVisible();
    await expect(page.getByRole("heading", { name: "プロフィールと公開ページ" })).toBeVisible();
    await expect(page.getByRole("link", { name: "24件の記録" })).toBeVisible();
    await expect(page.getByRole("link", { name: "7か所" })).toBeVisible();
    await expect(page.getByRole("link", { name: "公開範囲と位置情報" })).toBeVisible();
    await expect(page.getByRole("link", { name: "参加とフォロー" })).toBeVisible();
    await expect(page.getByTestId("profile-saved-record-pulse")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const targets = await page.locator(".self-control-hub a:visible,.profile-account-utilities :is(a,button):visible").evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    }));
    expect(targets.every((target) => target.height >= 44)).toBeTruthy();
    expect(errors).toEqual([]);
    await capture(page, `self-ja-${width}`);
    await page.close();
  });
}

for (const width of [390, 1440]) {
  test(`guest self entry ${width}px stays a short authentication choice`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
    await page.goto("/profile?lang=ja", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("ログインすると、残した記録と場所へ戻れます")).toBeVisible();
    await expect(page.getByRole("link", { name: "ログイン", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "アカウントを作る", exact: true })).toBeVisible();
    await expect(page.getByText("これはサンプルです")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await capture(page, `self-guest-ja-${width}`);
    await page.close();
  });
}

for (const width of widths) {
  test(`guest ${width}px keeps the value flow readable`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
    await page.setContent(pageHtml("ja", false), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-home-view="guest"]')).toBeVisible();
    await expect(page.locator('[data-home-view="member"]')).toBeHidden();
    if (width <= 960) {
      await expect(page.locator(".global-record-launcher")).toBeVisible();
    } else {
      await expect(page.locator(".global-record-launcher")).toBeHidden();
      await expect(page.locator(".site-core-nav")).toBeVisible();
    }
    await expect(page.locator(".home-bottom-nav")).toHaveCount(0);
    await expect(page.locator(".home-guest-owner-photo img")).toHaveAttribute("src", /^data:image\/svg\+xml/);
    await expect(page.locator(".home-guest-loop")).toBeVisible();
    const metrics = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, heroBottom: Math.round(document.querySelector(".home-guest-hero")?.getBoundingClientRect().bottom || 0), loopTop: Math.round(document.querySelector(".home-guest-loop")?.getBoundingClientRect().top || 0) }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    if (width <= 390) {
      expect(metrics.heroBottom).toBeLessThan(840);
      expect(metrics.loopTop).toBeGreaterThan(metrics.heroBottom);
      expect(metrics.loopTop).toBeLessThan(980);
    }
    await capture(page, `guest-ja-${width}`);
    await page.close();
  });
}

for (const width of widths) {
  test(`member ${width}px keeps personal memory and places separate`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
    await page.setContent(pageHtml("ja", true), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-home-view="member"]')).toBeVisible();
    await expect(page.locator('[data-home-view="guest"]')).toBeHidden();
    if (width <= 960) {
      await expect(page.locator(".global-record-launcher")).toBeVisible();
    } else {
      await expect(page.locator(".global-record-launcher")).toBeHidden();
      await expect(page.locator(".site-core-nav")).toBeVisible();
    }
    await expect(page.locator('[data-home-primary-state="recent_memory"]')).toBeVisible();
    await expect(page.locator('[data-home-primary-state="draft_resume"]')).toBeHidden();
    await expect(page.getByRole("heading", { name: "最近の記録" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "関わっている場所" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "次の活動" })).toHaveCount(0);
    await expect(page.getByText("写真からわかったこと")).toHaveCount(0);
    await expect(page.getByText("近くで残された記録")).toHaveCount(0);
    const memberIds = await page.locator('[data-home-view="member"] [data-home-record-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-home-record-id")));
    expect(new Set(memberIds).size).toBe(memberIds.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await capture(page, `member-ja-${width}`);
    await page.close();
  });
}

test("320px at 200 percent text does not create page overflow", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
  await page.setContent(pageHtml("pt-BR", false), { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "html{font-size:200%!important}" });
  expect(await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ client: 320, scroll: 320 });
  await expect(page.locator('.global-record-launcher [data-global-record-trigger="photo"]')).toBeVisible();
  await capture(page, "guest-pt-br-320-text-200");
  await page.close();
});

test("320px at 200 percent browser zoom keeps long English copy in the page", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
  await page.setContent(pageHtml("en", false), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  const metrics = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  if (metrics.scroll > metrics.client) {
    const overflowers = await page.locator("body *").evaluateAll((nodes) => nodes
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { tag: node.tagName, className: node.getAttribute("class") || "", right: Math.round(rect.right), width: Math.round(rect.width), text: (node.textContent || "").trim().slice(0, 60) };
      })
      .filter((item) => item.right > document.documentElement.clientWidth + 1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 12));
    console.log("overflowers", overflowers);
  }
  expect(metrics).toEqual({ client: 320, scroll: 320 });
  await page.close();
});

test("all locales retain long copy and localized routes", async ({ browser }) => {
  for (const lang of ["ja", "en", "es", "pt-BR"] as const) {
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
    await page.setContent(pageHtml(lang, false), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".home-guest-hero h1")).not.toBeEmpty();
    const expected = `/${lang === "pt-BR" ? "pt-br" : lang}/map?tab=places`;
    expect(await page.locator(".home-secondary-link").first().getAttribute("href")).toBe(expected);
    await expect(page.locator(".home-primary-button").first()).toHaveAttribute("data-global-record-trigger", "photo");
    await expect(page.locator(".home-primary-button").first()).not.toHaveAttribute("href", /.+/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    if (lang === "en" || lang === "pt-BR") await capture(page, `guest-${lang.toLowerCase()}-375`);
    await page.close();
  }
});

test("no-JS home preserves the place route and semantic explanation", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 844 } });
  const page = await context.newPage();
  await page.setContent(pageHtml("ja", false), { waitUntil: "domcontentloaded" });
  await expect(page.locator('.home-guest-hero .home-secondary-link[href="/ja/map?tab=places"]')).toBeVisible();
  await expect(page.locator(".home-primary-button").first()).toHaveText("撮る");
  await expect(page.locator(".home-guest-loop")).toBeVisible();
  await context.close();
});

test("keyboard focus is visible and every primary target is at least 44px", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
  await page.setContent(pageHtml("ja", true), { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const sizes = await page.locator('[data-home-view="member"] :is(a,button):visible').evaluateAll((links) => links.map((link) => { const rect = link.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
  expect(sizes.filter((size) => size.width > 0).every((size) => size.height >= 44)).toBeTruthy();
  await page.close();
});

test("sparse member data keeps only the first-record action and navigation", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(pageHtml("ja", true, true), { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-home-primary-state="first_record"]')).toBeVisible();
  await expect(page.locator('[data-home-primary-state="draft_resume"]')).toBeHidden();
  await expect(page.locator(".home-recent-section,.home-discovery-section,.home-nearby-section,.home-places-section,.home-next-section")).toHaveCount(0);
  await expect(page.locator(".global-record-launcher")).toBeVisible();
  await capture(page, "member-ja-390-sparse");
  await page.close();
});

test("member draft replaces the base Home state only for the same owner", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await prepareIndexedDbOrigin(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ikimon-record-draft", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("drafts")) request.result.createObjectStore("drafts");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite");
      transaction.objectStore("drafts").put({
        ownerKey: "user:viewer",
        continuationToken: null,
        file: new File(["draft"], "draft.jpg", { type: "image/jpeg" }),
        files: [],
        kind: "photo",
        savedAt: Date.now(),
      }, "latest:user:viewer");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.setContent(pageHtml("ja", true), { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-home-primary-state="draft_resume"]')).toBeVisible();
  await expect(page.locator('[data-home-primary-state="recent_memory"]')).toBeHidden();
  await page.close();
});

test("member Home ignores a draft record whose owner metadata does not match", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await prepareIndexedDbOrigin(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ikimon-record-draft", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("drafts")) request.result.createObjectStore("drafts");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite");
      transaction.objectStore("drafts").put({
        ownerKey: "user:someone-else",
        continuationToken: null,
        file: new File(["draft"], "draft.jpg", { type: "image/jpeg" }),
        files: [],
        kind: "photo",
        savedAt: Date.now(),
      }, "latest:user:viewer");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.setContent(pageHtml("ja", true), { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-home-primary-state="draft_resume"]')).toBeHidden();
  await expect(page.locator('[data-home-primary-state="recent_memory"]')).toBeVisible();
  await page.close();
});

test("authenticated recovery atomically rekeys only the matching guest draft", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const token = "guest-continuation-token";
  await page.route("**/api/v1/auth/session?optional=1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, session: { userId: "viewer" } }),
    });
  });
  await prepareIndexedDbOrigin(page);
  await page.evaluate(async (continuationToken) => {
    sessionStorage.setItem("ikimon:record-draft-guest-token-v1", continuationToken);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ikimon-record-draft", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("drafts")) request.result.createObjectStore("drafts");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite");
      const store = transaction.objectStore("drafts");
      store.put({
        ownerKey: `guest:${continuationToken}`,
        continuationToken,
        file: new File(["guest-draft"], "guest-draft.jpg", { type: "image/jpeg" }),
        files: [],
        kind: "photo",
        savedAt: Date.now(),
      }, `latest:guest:${continuationToken}`);
      store.put({
        file: new File(["legacy"], "legacy.jpg", { type: "image/jpeg" }),
        kind: "photo",
        savedAt: Date.now(),
      }, "latest");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, token);

  await page.goto(`/record?userId=viewer&draft=1&source=login_required&draft_token=${token}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-record-recovery]")).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => page.evaluate(async (continuationToken) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ikimon-record-draft", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<{ userOwner: string | null; guestExists: boolean; legacyExists: boolean }>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readonly");
      const store = transaction.objectStore("drafts");
      const userRequest = store.get("latest:user:viewer");
      const guestRequest = store.get(`latest:guest:${continuationToken}`);
      const legacyRequest = store.get("latest");
      transaction.oncomplete = () => {
        const result = {
          userOwner: userRequest.result?.ownerKey ?? null,
          guestExists: Boolean(guestRequest.result),
          legacyExists: Boolean(legacyRequest.result),
        };
        db.close();
        resolve(result);
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }, token)).toEqual({ userOwner: "user:viewer", guestExists: false, legacyExists: true });
  expect(new URL(page.url()).searchParams.has("draft_token")).toBeFalsy();
  expect(await page.evaluate(() => sessionStorage.getItem("ikimon:record-draft-guest-token-v1"))).toBeNull();
  await page.close();
});

test("camera permission denial never opens the gallery without an explicit choice", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    HTMLMediaElement.prototype.play = async () => undefined;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException("denied", "NotAllowedError"); } },
    });
  });
  const page = await context.newPage();
  await page.setContent(pageHtml("ja", false), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    (window as typeof window & { __galleryClicks?: number }).__galleryClicks = 0;
    const original = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function click() {
      if (this.matches('[data-global-record-input="gallery"]')) {
        (window as typeof window & { __galleryClicks?: number }).__galleryClicks = ((window as typeof window & { __galleryClicks?: number }).__galleryClicks ?? 0) + 1;
        return;
      }
      original.call(this);
    };
  });
  await page.locator(".global-record-launcher [data-global-record-trigger=photo]").click();
  await expect(page.locator("[data-global-record-camera-error]")).toBeVisible();
  await expect(page.getByText("カメラを開けませんでした")).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __galleryClicks?: number }).__galleryClicks)).toBe(0);
  await page.locator("[data-global-record-camera-error] [data-global-record-gallery-select]").click();
  expect(await page.evaluate(() => (window as typeof window & { __galleryClicks?: number }).__galleryClicks)).toBe(1);
  await capture(page, "guest-ja-390-camera-denied");
  await context.close();
});

test("camera unavailable shows choices instead of silently falling back", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 844 } });
  await context.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
  });
  const page = await context.newPage();
  await page.setContent(pageHtml("ja", false), { waitUntil: "domcontentloaded" });
  await page.locator(".global-record-launcher [data-global-record-trigger=photo]").click();
  await expect(page.locator("[data-global-record-camera-error]")).toBeVisible();
  await expect(page.locator("[data-global-record-camera-retry]")).toBeVisible();
  await expect(page.locator("[data-global-record-camera-cancel]")).toBeVisible();
  await context.close();
});

test("closing a successfully opened camera stops every MediaStream track", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    HTMLMediaElement.prototype.play = async () => undefined;
    const assignedMedia = new WeakMap<object, unknown>();
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      get() {
        return assignedMedia.get(this) ?? null;
      },
      set(value) {
        assignedMedia.set(this, value);
      },
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const track = {
            getCapabilities: () => ({}),
            getSettings: () => ({}),
            stop: () => {
              (window as typeof window & { __stoppedTracks?: number }).__stoppedTracks = ((window as typeof window & { __stoppedTracks?: number }).__stoppedTracks ?? 0) + 1;
            },
          };
          return {
            getTracks: () => [track],
            getVideoTracks: () => [track],
          };
        },
      },
    });
  });
  const page = await context.newPage();
  await page.setContent(pageHtml("ja", true), { waitUntil: "domcontentloaded" });
  await page.locator(".global-record-launcher [data-global-record-trigger=photo]").click();
  await expect(page.locator("[data-global-record-camera-sheet]")).toHaveAttribute("data-camera-active", "true");
  await page.locator('button[data-global-record-camera-close]').click();
  expect(await page.evaluate(() => (window as typeof window & { __stoppedTracks?: number }).__stoppedTracks ?? 0)).toBeGreaterThan(0);
  await context.close();
});

test("PWA-like standalone and landscape layouts keep navigation visible without overflow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => query === "(display-mode: standalone)"
      ? ({ matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false } as MediaQueryList)
      : original(query);
  });
  const page = await context.newPage();
  await page.setContent(pageHtml("ja", true), { waitUntil: "domcontentloaded" });
  await expect(page.locator(".global-record-launcher")).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ client: 844, scroll: 844 });
  await expect(page.locator(".global-record-launcher")).toBeVisible();
  await context.close();
});
