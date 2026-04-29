import { test, expect } from "@playwright/test";
import { newStagingContext } from "./support/staging.js";

test("guide shows photo fallback when camera permission is unavailable", async ({ browser }) => {
  const context = await newStagingContext(browser, {
    slug: "mobile-390",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await page.addInitScript(() => {
      const unavailable = async () => {
        throw new DOMException("camera unavailable", "NotAllowedError");
      };
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          ...(navigator.mediaDevices ?? {}),
          getUserMedia: unavailable,
        },
      });
    });

    await page.goto("/guide?lang=ja", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#guide-photo-fallback")).toBeHidden();
    await expect(page.locator("#guide-audio-opt-btn")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#guide-privacy-live")).toContainText("音声記録はOFF");

    await page.locator("#guide-start-btn").click();
    await expect(page.locator("#guide-start-sheet")).toBeVisible();
    await expect(page.locator("#guide-start-sheet")).toContainText("カメラを使いますか？");
    await expect(page.locator("#guide-start-sheet")).toContainText("おすすめ設定");
    await page.locator("#guide-start-confirm").click();

    await expect(page.locator("#guide-permission-msg")).toBeVisible();
    await expect(page.locator("#guide-photo-fallback")).toBeVisible();
    await expect(page.locator("#guide-photo-btn")).toContainText("投稿用写真を選ぶ");
  } finally {
    await context.close();
  }
});

test("guide requests rear camera first and keeps microphone off until opt-in", async ({ browser }) => {
  const context = await newStagingContext(browser, {
    slug: "mobile-390",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await page.addInitScript(() => {
      const calls: unknown[] = [];
      let callCount = 0;
      (window as typeof window & { __guideMediaCalls?: unknown[] }).__guideMediaCalls = calls;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          ...(navigator.mediaDevices ?? {}),
          getUserMedia: async (constraints: unknown) => {
            calls.push(constraints);
            callCount += 1;
            if (callCount === 1) {
              throw new DOMException("rear camera exact constraint unavailable", "OverconstrainedError");
            }
            return new MediaStream();
          },
        },
      });
    });

    await page.goto("/guide?lang=ja", { waitUntil: "domcontentloaded" });
    await page.locator("#guide-start-btn").click();
    await page.locator("#guide-start-confirm").click();
    await page.waitForFunction(() => {
      return ((window as typeof window & { __guideMediaCalls?: unknown[] }).__guideMediaCalls ?? []).length >= 2;
    });

    const calls = await page.evaluate(() => {
      return (window as typeof window & { __guideMediaCalls?: unknown[] }).__guideMediaCalls ?? [];
    });
    expect(calls).toEqual([
      {
        video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      },
      {
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      },
    ]);
    await expect(page.locator("#guide-audio-opt-btn")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#guide-privacy-live")).toContainText("カメラだけで開始");
  } finally {
    await context.close();
  }
});

test("guide can start audio-only without requesting camera video", async ({ browser }) => {
  const context = await newStagingContext(browser, {
    slug: "mobile-390",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await page.addInitScript(() => {
      const calls: unknown[] = [];
      (window as typeof window & { __guideMediaCalls?: unknown[] }).__guideMediaCalls = calls;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          ...(navigator.mediaDevices ?? {}),
          getUserMedia: async (constraints: unknown) => {
            calls.push(constraints);
            return new MediaStream();
          },
        },
      });
    });

    await page.goto("/guide?lang=ja", { waitUntil: "domcontentloaded" });
    await page.locator("#guide-start-btn").click();
    await page.locator('input[name="guide-camera-choice"][value="off"]').check();
    await page.locator('input[name="guide-audio-choice"][value="on"]').check();
    await page.locator("#guide-start-confirm").click();

    await expect(page.locator("#guide-camera-wrap")).toHaveClass(/is-audio-only/);
    await expect(page.locator("#guide-audio-only-panel")).toBeVisible();
    await expect(page.locator("#guide-video")).toBeHidden();
    await expect(page.locator("#guide-privacy-live")).toContainText("音声だけ");
    await page.locator("#guide-stop-btn").click();
    await expect(page.locator("#guide-session-summary")).toBeVisible();
    await expect(page.locator("#guide-session-summary")).toContainText("今回のふりかえり");
    await expect(page.locator("#guide-session-summary")).toContainText("音声だけで取れたもの");

    const calls = await page.evaluate(() => {
      return (window as typeof window & { __guideMediaCalls?: unknown[] }).__guideMediaCalls ?? [];
    });
    expect(calls).toEqual([
      {
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      },
    ]);
  } finally {
    await context.close();
  }
});
