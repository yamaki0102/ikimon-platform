import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { newStagingContext } from "./support/staging.js";

async function installGuideOfflineMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, "EventSource", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        ...(navigator.mediaDevices ?? {}),
        getUserMedia: async (constraints: unknown) => {
          const calls = ((window as typeof window & { __guideMediaCalls?: unknown[] }).__guideMediaCalls ??= []);
          calls.push(constraints);
          const wantsVideo = Boolean((constraints as MediaStreamConstraints).video);
          if (!wantsVideo) return new MediaStream();
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext("2d");
          let frame = 0;
          const draw = () => {
            if (!ctx) return;
            ctx.fillStyle = frame % 2 ? "#14532d" : "#166534";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#facc15";
            ctx.fillRect(80 + (frame % 20), 70, 76, 52);
            frame += 1;
          };
          draw();
          window.setInterval(draw, 250);
          return canvas.captureStream(4);
        },
      },
    });
  });

  await page.route("**/api/v1/guide/scene", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        sceneId: body.clientSceneId,
        status: "pending",
        capturedAt: body.capturedAt,
        lat: body.lat,
        lng: body.lng,
        frameThumb: body.frameThumb,
      }),
    });
  });

  await page.route(/\/api\/v1\/guide\/scene\/[^/?]+(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const sceneId = decodeURIComponent(url.pathname.split("/").pop() ?? "scene");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sceneId,
        status: "ready",
        capturedAt: new Date().toISOString(),
        returnedAt: new Date().toISOString(),
        lat: 35.68,
        lng: 139.76,
        distanceFromCurrentM: 0,
        deliveryState: "ready",
        delayedSummary: "足元の草地に黄色い花が見えます。",
        summary: "草地の花",
        whyInteresting: "野外の植生手がかりです。",
        nextLookTarget: "葉と花をもう一度見てください。",
        detectedSpecies: ["セイヨウタンポポ"],
        detectedFeatures: [{ type: "species", name: "セイヨウタンポポ", confidence: 0.8 }],
        autoSave: { state: "saved", decision: "save", confidence: 0.8, reasonCodes: ["field_nature_signal"], note: "野外の手がかりです。" },
        sceneHash: "offline-e2e",
      }),
    });
  });

  await page.route("**/api/v1/fieldscan/session/**/recap", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, recap: { soundBundles: [], privacySkippedCount: 0 } }),
    });
  });
}

test("guide queues a camera scene offline and syncs it after reconnect", async ({ browser }) => {
  const context = await newStagingContext(browser, {
    slug: "mobile-390",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await installGuideOfflineMocks(page);
    await page.goto("/guide?lang=ja", { waitUntil: "domcontentloaded" });

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.locator("#guide-start-btn").click();
    await page.locator("#guide-start-confirm").click();

    await expect(page.locator("#guide-offline-state")).toContainText("オフライン中");
    await expect(page.locator("#guide-offline-queued")).toContainText("未同期 1件", { timeout: 15_000 });
    await expect(page.locator("#guide-discovery-list")).toContainText("端末に一時保存中");

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    await expect(page.locator("#guide-offline-queued")).toBeHidden({ timeout: 20_000 });
    await expect(page.locator("#guide-discovery-list")).toContainText("自動保存済み");
  } finally {
    await context.close();
  }
});

test("guide audio-only offline mode does not request camera video", async ({ browser }) => {
  const context = await newStagingContext(browser, {
    slug: "mobile-390",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await installGuideOfflineMocks(page);
    await page.goto("/guide?lang=ja", { waitUntil: "domcontentloaded" });
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    await page.locator("#guide-start-btn").click();
    await page.locator('input[name="guide-camera-choice"][value="off"]').check();
    await page.locator('input[name="guide-audio-choice"][value="on"]').check();
    await page.locator("#guide-start-confirm").click();

    await expect(page.locator("#guide-camera-wrap")).toHaveClass(/is-audio-only/);
    await expect(page.locator("#guide-offline-state")).toContainText("オフライン中");
    const calls = await page.evaluate(() => (window as typeof window & { __guideMediaCalls?: unknown[] }).__guideMediaCalls ?? []);
    expect(calls).toEqual([
      {
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      },
    ]);
  } finally {
    await context.close();
  }
});
