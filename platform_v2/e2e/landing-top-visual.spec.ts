import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getStrings } from "../src/i18n/index.js";
import type { SiteLang } from "../src/i18n.js";
import type { LandingObservation, LandingSnapshot } from "../src/services/readModels.js";
import { LANDING_TOP_STYLES, renderLandingTopSections } from "../src/ui/landingTop.js";
import { renderSiteDocument } from "../src/ui/siteShell.js";

function obs(id: string, overrides: Partial<LandingObservation> = {}): LandingObservation {
  return {
    occurrenceId: `occ-${id}`, visitId: id, detailId: id, displayName: `record-${id}`,
    observedAt: "2026-07-19T08:30:00Z", observerName: "viewer", placeName: "source place", municipality: "浜松市",
    publicLocation: { label: "浜松市", scope: "municipality", cellId: null, gridM: null, radiusM: null, centroidLat: null, centroidLng: null, displayMode: "area" },
    photoUrl: `https://ikimon.life/thumb/md/photos/${id}/photo.webp`, identificationCount: 0,
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
  return { viewerUserId: member ? "viewer" : null, stats: { observationCount: 5, speciesCount: 2, placeCount: 2 }, feed: publicItems, myFeed: ownItems, myPlaces: [], nearbyFields: [], nearbyEvents: [], mapPreviewCells: [], ambient: [], habit: null, dailyDashboard: null };
}

function pageHtml(lang: SiteLang, member: boolean, sparse = false): string {
  const strings = getStrings(lang);
  const sections = renderLandingTopSections({ basePath: "", lang, copy: strings.landing, fieldLoop: strings.fieldLoop, snapshot: snap(member, sparse), isLoggedIn: member });
  return renderSiteDocument({
    basePath: "", title: strings.landing.title, description: strings.landing.home.guest.heroLead,
    body: `${sections.heroHtml}${sections.dailyDashboardHtml}`, lang, currentPath: `/${lang === "pt-BR" ? "pt-br" : lang}/`,
    shellClassName: "shell-bleed prototype-shell", extraStyles: LANDING_TOP_STYLES, homeChrome: member ? "member" : "guest", hideGlobalRecordLauncher: true,
  });
}

const widths = [320, 375, 390, 768, 1280];
const qaDir = process.env.LANDING_HOME_QA_DIR;

async function capture(page: import("@playwright/test").Page, name: string): Promise<void> {
  if (!qaDir) return;
  mkdirSync(qaDir, { recursive: true });
  await page.screenshot({ path: join(qaDir, `${name}.png`), fullPage: true });
}

for (const width of widths) {
  test(`guest ${width}px keeps the value flow readable`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
    await page.setContent(pageHtml("ja", false), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-home-view="guest"]')).toBeVisible();
    await expect(page.locator('[data-home-view="member"]')).toBeHidden();
    await expect(page.locator(".global-record-launcher")).toHaveCount(0);
    await expect(page.locator(".home-bottom-nav")).toBeHidden();
    const metrics = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, heroBottom: Math.round(document.querySelector(".home-guest-hero")?.getBoundingClientRect().bottom || 0), publicTop: Math.round(document.querySelector("#home-public-records")?.getBoundingClientRect().top || 0) }));
    expect(metrics.scrollWidth).toBe(metrics.clientWidth);
    if (width <= 390) {
      expect(metrics.heroBottom).toBeLessThan(760);
      expect(metrics.publicTop).toBeLessThan(800);
    }
    await capture(page, `guest-ja-${width}`);
    await page.close();
  });
}

for (const width of widths) {
  test(`member ${width}px prioritizes record, recent, discovery, nearby`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
    await page.setContent(pageHtml("ja", true), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-home-view="member"]')).toBeVisible();
    await expect(page.locator('[data-home-view="guest"]')).toBeHidden();
    await expect(page.locator(".home-bottom-nav")).toBeVisible();
    await expect(page.getByRole("heading", { name: "最近の記録" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "写真からわかったこと" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "近くで残された記録" })).toBeVisible();
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
  await expect(page.getByRole("link", { name: "Registrar", exact: true }).first()).toBeVisible();
  await capture(page, "guest-pt-br-320-text-200");
  await page.close();
});

test("320px at 200 percent browser zoom keeps long English copy in the page", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
  await page.setContent(pageHtml("en", false), { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ client: 320, scroll: 320 });
  await page.close();
});

test("all locales retain long copy and localized routes", async ({ browser }) => {
  for (const lang of ["ja", "en", "es", "pt-BR"] as const) {
    const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
    await page.setContent(pageHtml(lang, false), { waitUntil: "domcontentloaded" });
    await expect(page.locator(".home-guest-hero h1")).not.toBeEmpty();
    const expected = `/${lang === "pt-BR" ? "pt-br" : lang}/record`;
    expect(await page.locator(".home-primary-button").first().getAttribute("href")).toBe(expected);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    if (lang === "en" || lang === "pt-BR") await capture(page, `guest-${lang.toLowerCase()}-375`);
    await page.close();
  }
});

test("no-JS home preserves primary routes and semantic cards", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 844 } });
  const page = await context.newPage();
  await page.setContent(pageHtml("ja", false), { waitUntil: "domcontentloaded" });
  await expect(page.locator('a[href="/ja/record"]').first()).toBeVisible();
  await expect(page.locator('a[href="/ja/records?view=public"]')).toHaveCount(1);
  await expect(page.locator(".home-public-card").first()).toBeVisible();
  await context.close();
});

test("keyboard focus is visible and every primary target is at least 44px", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 844 } });
  await page.setContent(pageHtml("ja", true), { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const sizes = await page.locator('[data-home-view="member"] a:visible').evaluateAll((links) => links.map((link) => { const rect = link.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
  expect(sizes.filter((size) => size.width > 0).every((size) => size.height >= 44)).toBeTruthy();
  await page.close();
});

test("sparse member data keeps only the record action and navigation", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(pageHtml("ja", true, true), { waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-member-action")).toBeVisible();
  await expect(page.locator(".home-recent-section,.home-discovery-section,.home-nearby-section")).toHaveCount(0);
  await expect(page.locator(".home-bottom-nav")).toBeVisible();
  await capture(page, "member-ja-390-sparse");
  await page.close();
});
