import { test, expect, type Page } from "@playwright/test";
import {
  listVisualQaPages,
  materializeSitePagePath,
  sitePageLabel,
  visualQaViewport,
  type SitePageMaterializationContext,
} from "../src/siteMap.js";
import { newStagingContext, suppressMapLibreForSmoke } from "./support/staging.js";

function firstMatch(source: string, pattern: RegExp): string | undefined {
  const match = source.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

async function resolveMaterializationContext(page: Page): Promise<SitePageMaterializationContext> {
  const fromEnv: SitePageMaterializationContext = {
    userId: process.env.VISUAL_QA_USER_ID?.trim() || undefined,
    visitId: process.env.VISUAL_QA_VISIT_ID?.trim() || undefined,
    occurrenceId: process.env.VISUAL_QA_OCCURRENCE_ID?.trim() || undefined,
  };
  if (fromEnv.userId && (fromEnv.visitId || fromEnv.occurrenceId)) {
    return fromEnv;
  }

  const response = await page.request.get("/qa/site-map?lang=ja");
  const html = await response.text().catch(() => "");
  const detailLink = html.match(/\/observations\/([^"?&#]+)\?subject=([^"&#]+)/);
  return {
    userId: fromEnv.userId
      ?? firstMatch(html, /\/home\?userId=([^"&]+)/)
      ?? firstMatch(html, /\/profile\/([^"?&#]+)/),
    visitId: fromEnv.visitId ?? (detailLink?.[1] ? decodeURIComponent(detailLink[1]) : undefined),
    occurrenceId: fromEnv.occurrenceId
      ?? (detailLink?.[2] ? decodeURIComponent(detailLink[2]) : undefined)
      ?? firstMatch(html, /\/observations\/([^"?&#]+)/),
  };
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function stabilizeVisualDiff(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      video { visibility: hidden !important; }
    `,
  });
}

async function expectRenderedDocument(page: Page): Promise<void> {
  const body = page.locator("body");
  await expect(body).toBeVisible();
  const text = (await body.innerText()).replace(/\s+/g, "");
  expect(text.length).toBeGreaterThan(20);
}

const pages = listVisualQaPages();
const assertScreenshots = process.env.VISUAL_QA_ASSERT_SCREENSHOTS === "1";

test.describe("sitemap registry visual smoke", () => {
  for (const pageDef of pages) {
    const qa = pageDef.visualQa;
    if (!qa) continue;

    for (const viewportName of qa.viewports) {
      const viewport = visualQaViewport(viewportName);

      test(`${sitePageLabel(pageDef)} renders from registry (${viewport.slug})`, async ({ browser }) => {
        const context = await newStagingContext(browser, viewport);
        const page = await context.newPage();
        try {
          await suppressMapLibreForSmoke(page);
          const materialization = await resolveMaterializationContext(page);
          if (qa.requires === "user" && !materialization.userId) {
            test.skip(true, `${pageDef.path} requires VISUAL_QA_USER_ID or a QA sitemap user link`);
          }
          if (qa.requires === "occurrence" && !materialization.occurrenceId) {
            test.skip(true, `${pageDef.path} requires VISUAL_QA_OCCURRENCE_ID or a QA sitemap observation link`);
          }

          const href = materializeSitePagePath(pageDef, materialization);
          const response = await page.goto(`${href}${href.includes("?") ? "&" : "?"}lang=ja`, { waitUntil: "domcontentloaded" });
          const status = response?.status() ?? 0;
          const allowed = qa.allowStatus ?? [200];
          expect(allowed, `${href} allowed statuses`).toContain(status);
          expect(new URL(page.url()).pathname).toBe(new URL(href, "https://staging.ikimon.life").pathname);

          if (qa.readySelector) {
            await page.locator(qa.readySelector).first().waitFor({ state: "visible" });
          }
          await expectRenderedDocument(page);
          await expectNoHorizontalOverflow(page);

          if (assertScreenshots && qa.screenshot) {
            await stabilizeVisualDiff(page);
            await expect(page).toHaveScreenshot(`${qa.screenshot.baselineName}-${viewport.slug}.png`, {
              animations: "disabled",
              fullPage: qa.screenshot.fullPage ?? true,
              maxDiffPixelRatio: qa.screenshot.maxDiffPixelRatio ?? 0.02,
            });
          }
        } finally {
          await context.close();
        }
      });
    }
  }
});
