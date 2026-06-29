import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-625", width: 625, height: 844 },
];

function normalizeTargetPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return `${url.pathname}${url.search}`;
  } catch {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
}

function targetPaths(): string[] {
  const raw = process.env.OBSERVATION_DETAIL_IMAGE_TARGETS?.trim();
  if (!raw) {
    throw new Error("OBSERVATION_DETAIL_IMAGE_TARGETS is required. Run npm run e2e:observation-image-target so dynamic targets are resolved first.");
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => normalizeTargetPath(String(item))).filter(Boolean);
    }
  } catch {
    // Fall through to comma/newline parsing.
  }
  return raw.split(/[\n,]+/u).map(normalizeTargetPath).filter(Boolean);
}

function recordSlug(targetPath: string): string {
  return targetPath.match(/record-\d+/u)?.[0] ?? targetPath.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "");
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function imageRecordMetrics(page: Page): Promise<{
  visibleText: string;
  bodyText: string;
  imageStackVisible: boolean;
  previewImageVisible: boolean;
  photoThumbCount: number;
  regionLayerCount: number;
  regionGuideCount: number;
  contextGuideCount: number;
  groundGuideCount: number;
  extraGuideCount: number;
  mediaLedgerText: string;
  visibleRecordText: string;
  videoFrameVisibleCount: number;
  videoEvidenceFrameCount: number;
  nextRecordCards: number;
}> {
  return page.evaluate(() => {
    const visibleText = document.body.innerText;
    const bodyText = document.body.textContent ?? "";
    const isVisible = (element: Element | null): boolean => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const imageStack = document.querySelector(".obs-hero-media-stack.is-photo-only");
    const previewImage = document.querySelector("[data-obs-preview-img]");
    const mediaLedger = document.querySelector<HTMLElement>(".obs-reading-panel > .obs-media-ledger, .obs-media-ledger");
    const visibleRecords = document.querySelector<HTMLElement>(".obs-visible-records");
    return {
      visibleText,
      bodyText,
      imageStackVisible: isVisible(imageStack),
      previewImageVisible: isVisible(previewImage),
      photoThumbCount: document.querySelectorAll(".obs-hero-thumbs .obs-hero-thumb").length,
      regionLayerCount: document.querySelectorAll(".obs-region-layer[data-obs-preview-regions]").length,
      regionGuideCount: document.querySelectorAll(".obs-region-guide").length,
      contextGuideCount: document.querySelectorAll(".obs-region-guide.is-context-guide").length,
      groundGuideCount: document.querySelectorAll(".obs-region-guide.is-ground-guide").length,
      extraGuideCount: document.querySelectorAll(".obs-region-guide.is-extra-guide").length,
      mediaLedgerText: mediaLedger?.textContent?.replace(/\s+/gu, " ").trim() ?? "",
      visibleRecordText: visibleRecords?.textContent?.replace(/\s+/gu, " ").trim() ?? "",
      videoFrameVisibleCount: Array.from(document.querySelectorAll(".obs-hero-video-frame")).filter(isVisible).length,
      videoEvidenceFrameCount: document.querySelectorAll(".obs-video-evidence-frame").length,
      nextRecordCards: document.querySelectorAll(".obs-area-records .obs-nearby-card").length,
    };
  });
}

test.describe("image observation detail VPS parity gate", () => {
  for (const targetPath of targetPaths()) {
    const slug = recordSlug(targetPath);
    for (const viewport of viewports) {
      test(`${slug} ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(targetPath, { waitUntil: "domcontentloaded" });
        expect(response?.status(), "target image observation status").toBe(200);
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

        const metrics = await imageRecordMetrics(page);

        expect(metrics.imageStackVisible, "photo-only records should use the image stack").toBe(true);
        expect(metrics.previewImageVisible, "large image preview should be visible").toBe(true);
        expect(metrics.photoThumbCount, "image records keep a thumbnail rail even when there is one photo").toBeGreaterThan(0);
        expect(metrics.regionLayerCount, "image target frame layer should be present").toBeGreaterThan(0);
        expect(metrics.regionGuideCount, "image records should show distinct reading guides").toBeGreaterThanOrEqual(4);
        expect(metrics.contextGuideCount, "context guide should be present").toBeGreaterThan(0);
        expect(metrics.groundGuideCount, "ground guide should be present").toBeGreaterThan(0);
        expect(metrics.extraGuideCount, "extra-subject guide should be present").toBeGreaterThan(0);
        expect(metrics.mediaLedgerText).toContain("写真");
        expect(metrics.mediaLedgerText).toContain("動画");
        expect(metrics.visibleRecordText).toContain("名前の候補");
        expect(metrics.visibleRecordText).toContain("場所の手がかり");
        expect(metrics.visibleRecordText).toContain("足元の状態");
        expect(metrics.visibleRecordText).toContain("あとで分けられるもの");
        for (const term of [
          "この記録で読む対象",
          "この記録から読めていること",
          "公開記録・候補情報",
          "次の写真で増える情報",
          "同定",
          "同定に参加する",
          "同意する",
          "別候補を提案",
          "保留する",
          "別レコードを追加",
          "提案・コメントの履歴",
          "現在の見方",
          "観察記録を整える",
          "環境情報の下書き",
          "編集履歴",
          "次に見るなら",
        ]) {
          expect(metrics.visibleText, `visible copy should include ${term}`).toContain(term);
        }
        expect(metrics.bodyText).not.toContain("\u91cd\u306d");
        expect(metrics.bodyText).not.toContain("写真の" + "対象枠");
        expect(metrics.bodyText).not.toContain("同じ" + "ページで確認");
        expect(metrics.bodyText).not.toContain("この映像で読む対象を切り替える");
        expect(metrics.videoFrameVisibleCount, "photo-only records must not show the video player frame").toBe(0);
        expect(metrics.videoEvidenceFrameCount, "photo-only records must not show the video frame rail").toBe(0);
        await expectNoHorizontalOverflow(page);

        await page.screenshot({
          path: path.resolve("test-results", `observation-detail-image-${slug}-${viewport.name}.png`),
          fullPage: false,
        });
      });
    }
  }
});
