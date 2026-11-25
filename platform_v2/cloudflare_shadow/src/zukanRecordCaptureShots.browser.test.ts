import { mkdirSync } from "node:fs";
import test from "node:test";
import { openRecord, shoot, waitPhase, waitVideo } from "./zukanRecordCaptureHarness";

const OUT = process.env.ZUKAN_CAPTURE_AFTER_DIR;

for (const [name, fn] of [
  ["390 states", async () => {
    mkdirSync(OUT!, { recursive: true });
    const live = await openRecord({ focusDelay: 1500 });
    try {
      const { page } = live;
      await waitPhase(page, "live");
      await waitVideo(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/CAP1-390.png` });
      await page.click('[data-zt-mode="closeup"]');
      await page.waitForFunction(() => !(document.querySelector("[data-global-record-camera-focus]") as HTMLElement).hidden);
      await page.waitForTimeout(400);
      const box = (await page.locator("[data-global-record-camera-preview]").boundingBox())!;
      await page.mouse.click(190, 420);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/CAP2-390-focusing.png` });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/CAP2-390-focused.png` });
      void box;
      await page.click('[data-zt-mode="standard"]');
      await page.waitForTimeout(400);
      await shoot(page, 3);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/CAP4-390.png` });
      await page.click("[data-zt-stack]");
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/CAP5-390.png` });
      await page.click("[data-zt-review-save]");
      await waitPhase(page, "saved", 8000);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/CAP6-390.png` });
    } finally {
      await live.close();
    }
    const fallback = await openRecord({ caps: {} });
    try {
      const { page } = fallback;
      await waitPhase(page, "live");
      await waitVideo(page);
      await page.click('[data-zt-mode="closeup"]');
      await page.waitForFunction(() => !(document.querySelector("[data-zt-card]") as HTMLElement).hidden);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/CAP3-390.png` });
    } finally {
      await fallback.close();
    }
    const denied = await openRecord({ deny: "NotAllowedError" });
    try {
      await waitPhase(denied.page, "error");
      await denied.page.waitForTimeout(500);
      await denied.page.screenshot({ path: `${OUT}/CAP-denied-390.png` });
    } finally {
      await denied.close();
    }
  }],
  ["1280 states", async () => {
    mkdirSync(OUT!, { recursive: true });
    const { page, close } = await openRecord({ width: 1280, height: 800 });
    try {
      await waitPhase(page, "live");
      await waitVideo(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/CAP1-1280.png` });
      await shoot(page, 2);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/CAP4-1280.png` });
      await page.click('[data-zt-mode="closeup"]');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/CAP2-1280.png` });
    } finally {
      await close();
    }
  }],
] as const) test(name, { skip: OUT ? false : "ZUKAN_CAPTURE_AFTER_DIR is not set" }, fn);
