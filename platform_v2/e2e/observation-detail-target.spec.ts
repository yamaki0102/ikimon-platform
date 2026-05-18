import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

const defaultTargetPath =
  "/ja/observations/record-1778829649026?subject=occ%3Arecord-1778829649026%3A0";

function targetPath(): string {
  return process.env.OBSERVATION_DETAIL_TARGET_PATH?.trim() || defaultTargetPath;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectPolishedObservationPage(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const bodyText = document.body.textContent ?? "";
    const ledger = document.querySelector<HTMLElement>(".obs-reading-panel > .obs-media-ledger");
    const area = document.querySelector<HTMLElement>(".obs-area-records");
    const small = document.querySelector<HTMLElement>(".obs-video-evidence-frame small");
    return {
      hasOldRelated: bodyText.includes("関連ページ"),
      hasReactionPanel: bodyText.includes("この見つけたものへの反応"),
      hasVideoFrameMetaNote: bodyText.includes("AI が動画フレーム上の対象位置を記録しています"),
      hasFrameReasonVisible: small ? getComputedStyle(small).display !== "none" : false,
      ledgerText: ledger?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      areaText: area?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      bodyText,
      visibleText: document.body.innerText,
      areaImageCount: document.querySelectorAll(".obs-area-records img, .obs-area-records .obs-nearby-nophoto").length,
      areaHrefs: Array.from(document.querySelectorAll<HTMLAnchorElement>(".obs-area-records .obs-nearby-card")).map((anchor) => anchor.getAttribute("href") ?? ""),
      framePreviewTargets: document.querySelectorAll(".obs-video-evidence-frame button, .obs-video-evidence-frame img[role='button']").length,
    };
  });

  expect(metrics.hasOldRelated, "old related-link block should be removed").toBe(false);
  expect(metrics.hasReactionPanel, "reaction block should be removed").toBe(false);
  expect(metrics.hasVideoFrameMetaNote, "duplicated video frame note should be removed").toBe(false);
  expect(metrics.hasFrameReasonVisible, "frame selection reason should not be visible").toBe(false);
  expect(metrics.ledgerText).toContain("写真");
  expect(metrics.ledgerText).toContain("動画");
  expect(metrics.ledgerText).toContain("同エリア");
  expect(metrics.areaText).toContain("次に見るなら");
  expect(metrics.areaText).toContain("浜松市浜名区をもう少し見る");
  expect(metrics.areaText).toContain("近い投稿 2件");
  expect(metrics.visibleText).not.toContain("この映像で読む対象を切り替える");
  expect(metrics.visibleText).not.toContain("この映像に写っているもの");
  expect(metrics.visibleText).not.toContain("候補を確かめる材料");
  expect(metrics.visibleText).not.toContain("名前の記録");
  expect(metrics.visibleText).not.toContain("現場アドバイス");
  expect(metrics.visibleText).not.toContain("確定前");
  expect(metrics.visibleText).not.toContain("イネ科植物");
  expect(metrics.visibleText).not.toContain("映像フレームから拾えている手がかり");
  expect(metrics.bodyText).toContain("かなり近そう");
  expect(metrics.bodyText).toContain("分類候補");
  expect(metrics.bodyText).toContain("Chloris sinica");
  expect(metrics.bodyText).toContain("端末の声で読む");
  expect(metrics.areaImageCount, "same-area cards need thumbnail affordance").toBeGreaterThanOrEqual(2);
  expect(metrics.areaHrefs.some((href) => /\/observations\/occ%3A/i.test(href)), "same-area cards should link to record detail, not occurrence ids").toBe(false);
  expect(metrics.framePreviewTargets, "video frames should be clickable for preview").toBeGreaterThan(0);
}

test.describe("target observation detail local repro", () => {
  test.skip(
    Boolean(process.env.STAGING_BASE_URL) && !process.env.OBSERVATION_DETAIL_TARGET_PATH,
    "target record is a production/local repro record and is not guaranteed to exist in staging fixtures",
  );

  test("mobile video observation keeps evidence controls usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(targetPath(), { waitUntil: "domcontentloaded" });
    expect(response?.status(), "target observation status").toBeLessThan(500);

    await expect(page.locator("body")).toContainText("AIが見た動画フレーム");
    await expect(page.locator(".obs-hero-video-frame")).toBeVisible();
    expect(await page.locator(".obs-video-evidence-frame").count()).toBeGreaterThan(0);
    await expectPolishedObservationPage(page);
    await expectNoHorizontalOverflow(page);

    await page.screenshot({
      path: path.resolve("test-results", "observation-detail-target-mobile.png"),
      fullPage: false,
    });
  });

  test("wide mobile layout keeps the snapshot order", async ({ page }) => {
    await page.setViewportSize({ width: 625, height: 844 });
    const response = await page.goto(targetPath(), { waitUntil: "domcontentloaded" });
    expect(response?.status(), "target observation status").toBeLessThan(500);

    await expect(page.locator("body")).toContainText("AIが見た動画フレーム");
    await expect(page.locator(".obs-hero-video-frame")).toBeVisible();
    await expectPolishedObservationPage(page);
    await expectNoHorizontalOverflow(page);

    await page.screenshot({
      path: path.resolve("test-results", "observation-detail-target-mobile-625.png"),
      fullPage: false,
    });
  });

  test("desktop layout keeps the two-column polish and frame preview", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(targetPath(), { waitUntil: "domcontentloaded" });
    expect(response?.status(), "target observation status").toBeLessThan(500);

    await expect(page.locator(".obs-reading-hero")).toBeVisible();
    await expect(page.locator(".obs-reading-panel")).toBeVisible();
    await expectPolishedObservationPage(page);
    await expectNoHorizontalOverflow(page);

    const layoutMetrics = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>(".desktop-side-nav")?.getBoundingClientRect();
      const hero = document.querySelector<HTMLElement>(".obs-reading-hero")?.getBoundingClientRect();
      return {
        navRight: nav ? Math.round(nav.right) : 0,
        heroLeft: hero ? Math.round(hero.left) : 0,
      };
    });
    expect(layoutMetrics.navRight, "collapsed side nav should not cover the reading content").toBeLessThanOrEqual(layoutMetrics.heroLeft);

    const previewTarget = page.locator(".obs-video-evidence-frame button, .obs-video-evidence-frame img[role='button']").first();
    await previewTarget.click();
    await expect(page.locator(".obs-frame-preview.is-open")).toBeVisible();
    await expect(page.locator(".obs-frame-preview-img")).toBeVisible();
    const fitMetrics = await page.evaluate(() => {
      const img = document.querySelector<HTMLElement>(".obs-frame-preview-img");
      return {
        width: img?.getBoundingClientRect().width ?? 0,
        height: img?.getBoundingClientRect().height ?? 0,
      };
    });
    await page.locator("[data-frame-zoom-in]").click();
    const zoomMetrics = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(".obs-frame-preview-stage");
      const img = document.querySelector<HTMLElement>(".obs-frame-preview-img");
      return {
        zoomed: stage?.dataset.zoomed === "1" || stage?.classList.contains("is-zoomed"),
        width: img?.getBoundingClientRect().width ?? 0,
        height: img?.getBoundingClientRect().height ?? 0,
      };
    });
    expect(zoomMetrics.zoomed).toBeTruthy();
    expect(
      zoomMetrics.width > fitMetrics.width || zoomMetrics.height > fitMetrics.height,
      "zoom should enlarge the preview even when a vertical frame still fits the stage",
    ).toBeTruthy();

    await page.locator("[data-frame-zoom-in]").click();
    await page.locator("[data-frame-zoom-in]").click();
    const panMetrics = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(".obs-frame-preview-stage");
      return {
        scrollable: Boolean(stage && (stage.scrollWidth > stage.clientWidth || stage.scrollHeight > stage.clientHeight)),
      };
    });
    expect(panMetrics.scrollable, "further zoom should expose panning area").toBeTruthy();

    await page.screenshot({
      path: path.resolve("test-results", "observation-detail-target-desktop.png"),
      fullPage: false,
    });
  });
});
