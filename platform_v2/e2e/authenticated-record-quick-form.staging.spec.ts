import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  addSessionCookie,
  createStagingApiContext,
  issueSessionCookie,
  newStagingContext,
  requireEnv,
  type ViewportProfile,
} from "./support/staging.js";

const VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 1000 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const SEASON_CLUES = ["花・実", "葉の色", "水の量", "土の湿り", "音・におい", "虫・鳥"];

function firstMatch(source: string, pattern: RegExp): string | null {
  const match = source.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function resolveQaUserId(api: APIRequestContext): Promise<string> {
  const response = await api.get("/qa/site-map?lang=ja");
  expect(response.ok(), "/qa/site-map should expose a materialized user").toBeTruthy();
  const html = await response.text();
  const userId = firstMatch(html, /\/home\?userId=([^"&]+)/) ?? firstMatch(html, /\/profile\/([^"?&#]+)/);
  expect(userId, "QA sitemap should expose a user route").toBeTruthy();
  return userId!;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectElementVisibleAndUnoccluded(page: Page, selector: string): Promise<void> {
  const result = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const centerX = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
    const centerY = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(centerX, centerY);
    return {
      text: (element.textContent || "").replace(/\s+/g, " ").trim(),
      rect: {
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      visible: style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0.05 &&
        rect.width > 0 &&
        rect.height > 0,
      inViewport: rect.top >= -1 &&
        rect.left >= -1 &&
        rect.right <= window.innerWidth + 1 &&
        rect.bottom <= window.innerHeight + 1,
      hitTarget: !!hit && (hit === element || element.contains(hit)),
      hitTag: hit ? hit.tagName.toLowerCase() : null,
      hitText: hit?.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ?? null,
    };
  });

  expect(result.visible, JSON.stringify(result, null, 2)).toBe(true);
  expect(result.inViewport, JSON.stringify(result, null, 2)).toBe(true);
  expect(result.hitTarget, JSON.stringify(result, null, 2)).toBe(true);
}

async function openAuthenticatedQuickForm(page: Page): Promise<void> {
  await page.route("**/api/v1/ui-kpi/events", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, eventId: "record-quick-form-evidence" }),
    });
  });

  await page.goto("/ja/record?start=note", { waitUntil: "domcontentloaded" });
  const form = page.locator("#record-form");
  if (!(await form.isVisible().catch(() => false))) {
    await page.locator('[data-capture-action="note"]').first().click();
  }
  await expect(form).toBeVisible();
  await expect(page.locator('input[name="recordMode"]')).toHaveValue("quick");

  const laterDetails = page.locator(".record-later-details");
  if ((await laterDetails.count()) > 0 && (await laterDetails.getAttribute("open")) === null) {
    await laterDetails.locator("summary").click();
  }

  const quickFields = page.locator("[data-quick-only]");
  await expect(quickFields).toBeVisible();
  await page.locator(".record-season-clues").scrollIntoViewIfNeeded();
  await expectNoHorizontalOverflow(page);
}

async function captureEvidence(page: Page, profile: ViewportProfile): Promise<void> {
  const outputDir = process.env.RECORD_QUICK_FORM_CAPTURE_DIR?.trim();
  const screenshotName = `authenticated-record-quick-form-${profile.slug}.png`;
  const stateName = `authenticated-record-quick-form-${profile.slug}.json`;
  const screenshotPath = outputDir
    ? path.join(outputDir, screenshotName)
    : test.info().outputPath(screenshotName);
  const statePath = outputDir
    ? path.join(outputDir, stateName)
    : test.info().outputPath(stateName);

  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({
    path: screenshotPath,
    type: "png",
    animations: "disabled",
    fullPage: false,
  });

  const state = await page.evaluate((clues) => {
    const chipStates = clues.map((clue) => {
      const element = document.querySelector<HTMLElement>(`[data-season-clue="${clue}"]`);
      const rect = element?.getBoundingClientRect();
      return {
        clue,
        present: Boolean(element),
        ariaPressed: element?.getAttribute("aria-pressed") ?? null,
        text: element?.textContent?.replace(/\s+/g, " ").trim() ?? null,
        rect: rect
          ? {
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
              left: Math.round(rect.left),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            }
          : null,
      };
    });
    return {
      url: window.location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      quickFormVisible: !document.querySelector<HTMLElement>("[data-quick-only]")?.hidden,
      seasonClueLabel: document.querySelector(".record-season-clues .record-label")?.textContent?.trim() ?? null,
      chipStates,
    };
  }, SEASON_CLUES);
  await writeFile(statePath, JSON.stringify(state, null, 2));

  await test.info().attach(screenshotName, { path: screenshotPath, contentType: "image/png" });
  await test.info().attach(stateName, { path: statePath, contentType: "application/json" });
}

test.describe("authenticated record quick form staging evidence", () => {
  let api: APIRequestContext;
  let sessionCookie: string;

  test.beforeAll(async ({ playwright }) => {
    api = await createStagingApiContext(playwright);
    const userId = await resolveQaUserId(api);
    sessionCookie = await issueSessionCookie(api, requireEnv("V2_PRIVILEGED_WRITE_API_KEY"), userId);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  for (const profile of VIEWPORTS) {
    test(`captures logged-in /ja/record quick form chips (${profile.slug})`, async ({ browser }) => {
      const context = await newStagingContext(browser, profile);
      await addSessionCookie(context, sessionCookie);
      const page = await context.newPage();

      try {
        await openAuthenticatedQuickForm(page);

        await expect(page.locator(".record-season-clues .record-label")).toHaveText("今見えた変化");
        await expectElementVisibleAndUnoccluded(page, ".record-season-clues");
        for (const clue of SEASON_CLUES) {
          const selector = `[data-season-clue="${clue}"]`;
          await expect(page.locator(selector)).toHaveText(clue);
          await expect(page.locator(selector)).toHaveAttribute("aria-pressed", "false");
          await expectElementVisibleAndUnoccluded(page, selector);
        }

        await captureEvidence(page, profile);
      } finally {
        await context.close();
      }
    });
  }
});
