import assert from "node:assert/strict";
import { browserTest, camLog, openRecord, shoot, shot, TINY_PNG, waitPhase, waitVideo } from "./zukanRecordCaptureHarness";

const STANDARD_CONSTRAINTS = { video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false };

browserTest("capture opens a live camera at once and collapses the header and bottom nav", async () => {
  const { page, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    const cam = await page.evaluate(() => (window as unknown as { __cam: { getUserMedia: unknown[] } }).__cam.getUserMedia);
    assert.deepEqual(cam, [STANDARD_CONSTRAINTS]);
    const state = await page.evaluate(() => {
      const visible = (el: Element | null) => {
        if (!el) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0 && Number(style.opacity) > 0.01;
      };
      const video = document.querySelector("video[data-global-record-camera-video]") as HTMLVideoElement;
      return {
        header: visible(document.querySelector(".zukan-app-header")),
        nav: visible(document.querySelector(".zukan-app-nav.is-bottom")),
        hasStream: Boolean(video.srcObject),
        stage: visible(document.querySelector("[data-zukan-capture-stage]")),
        pills: Array.from(document.querySelectorAll("[data-zt-mode]")).map((el) => el.textContent?.trim()),
        shutter: visible(document.querySelector("[data-zt-shutter]")),
      };
    });
    assert.equal(state.header, false);
    assert.equal(state.nav, false);
    assert.equal(state.hasStream, true);
    assert.equal(state.stage, true);
    assert.equal(state.shutter, true);
    assert.deepEqual(state.pills, ["標準", "接写", "動画"]);
    await page.waitForTimeout(400);
    await shot(page, "cap1-390");
  } finally {
    await close();
  }
});

browserTest("shutter keeps the camera running and stacks photos with a live count", async () => {
  const { page, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    await shoot(page, 3);
    const text = await page.evaluate(() => ({
      title: document.querySelector("[data-zt-stack-title]")?.textContent,
      save: document.querySelector("[data-zt-save]")?.textContent,
      hidden: (document.querySelector("[data-zt-bundle]") as HTMLElement).hidden,
      gum: (window as unknown as { __cam: { getUserMedia: unknown[] } }).__cam.getUserMedia.length,
      thumbs: document.querySelectorAll("[data-zt-stack-thumbs] img").length,
    }));
    assert.equal(text.title, "3枚たまっています");
    assert.equal(text.save, "記録する（3枚）");
    assert.equal(text.hidden, false);
    assert.equal(text.gum, 1);
    assert.equal(text.thumbs, 3);
    await page.waitForTimeout(400);
    await shot(page, "cap4-390");
  } finally {
    await close();
  }
});

browserTest("saving the stack sends one private record with every photo in order and shows the saved screen", async () => {
  const { page, api, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    await shoot(page, 3);
    await page.click("[data-zt-save]");
    await waitPhase(page, "saved");
    assert.equal(api.upsert.length, 1);
    const record = api.upsert[0]!;
    assert.equal(record.visibility, "private");
    assert.equal(record.latitude, null);
    assert.equal(record.longitude, null);
    assert.ok(Date.parse(String(record.observedAt)) <= Date.now());
    assert.equal(api.uploads.length, 3);
    assert.deepEqual(api.uploads.map((upload) => upload.body.position), [0, 1, 2]);
    assert.deepEqual(api.uploads.map((upload) => upload.body.mediaRole), ["primary", "context", "context"]);
    assert.ok(api.uploads.every((upload) => upload.path === "/api/v1/observations/visit-1/photos/upload"));
    const saved = await page.evaluate(() => ({
      heading: document.querySelector("[data-zt-saved-title]")?.textContent,
      card: document.querySelector("[data-zt-saved-card-title]")?.textContent,
      meta: document.querySelector("[data-zt-saved-card-meta]")?.textContent,
      again: document.querySelector("[data-zt-again]")?.textContent,
      view: (document.querySelector("[data-zt-view]") as HTMLAnchorElement).getAttribute("href"),
      backHidden: (document.querySelector("[data-zt-back-to]") as HTMLElement).hidden,
    }));
    assert.equal(saved.heading, "自分だけに保存しました");
    assert.equal(saved.card, "写真 3枚の記録");
    assert.match(String(saved.meta), /場所は未設定/);
    assert.equal(saved.again, "続けて撮る");
    assert.equal(saved.view, "/ja/observations/visit-1");
    assert.equal(saved.backHidden, true);
    await page.waitForTimeout(500);
    await shot(page, "cap6-390");
    await page.click("[data-zt-again]");
    await waitPhase(page, "live");
    assert.equal(await page.evaluate(() => document.querySelector("[data-zt-count]")?.textContent), "0");
    assert.equal((await camLog(page)).getUserMedia.length, 2);
  } finally {
    await close();
  }
});

browserTest("arriving from a place or an event offers the way back after saving", async () => {
  const place = await openRecord({ path: "/ja/record?placeId=place-abc" });
  try {
    await waitPhase(place.page, "live");
    await shoot(place.page, 1);
    await place.page.click("[data-zt-save]");
    await waitPhase(place.page, "saved");
    const back = await place.page.evaluate(() => ({ hidden: (document.querySelector("[data-zt-back-to]") as HTMLElement).hidden, href: document.querySelector("[data-zt-back-to]")?.getAttribute("href"), text: document.querySelector("[data-zt-back-to]")?.textContent }));
    assert.equal(back.hidden, false);
    assert.equal(back.href, "/ja/places/place-abc");
    assert.equal(back.text, "元の場所に戻る");
  } finally {
    await place.close();
  }
  const event = await openRecord({ path: "/ja/record?eventSessionId=ev-1" });
  try {
    await waitPhase(event.page, "live");
    await shoot(event.page, 1);
    await event.page.click("[data-zt-save]");
    await waitPhase(event.page, "saved");
    assert.equal(await event.page.evaluate(() => document.querySelector("[data-zt-back-to]")?.getAttribute("href")), "/ja/events/ev-1/live");
  } finally {
    await event.close();
  }
});

browserTest("close-up keeps the same stream and the exact legacy constraints, and only offers what the device reports", async () => {
  const { page, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    await waitVideo(page);
    await page.click('[data-zt-mode="closeup"]');
    await page.waitForFunction(() => document.querySelector("[data-zukan-capture-stage]")?.getAttribute("data-mode") === "closeup");
    await page.waitForFunction(() => !(document.querySelector("[data-global-record-camera-focus]") as HTMLElement).hidden);
    let log = await camLog(page);
    assert.equal(log.getUserMedia.length, 1);
    assert.equal(JSON.stringify(log.getUserMedia[0]), '{"video":{"facingMode":{"ideal":"environment"},"width":{"ideal":2560},"height":{"ideal":1920}},"audio":false}');
    assert.equal(log.stops, 0);
    const shown = await page.evaluate(() => ({
      zoom: !(document.querySelector("[data-zt-zoom-row]") as HTMLElement).hidden,
      focus: !(document.querySelector("[data-global-record-camera-focus]") as HTMLElement).hidden,
      torch: !(document.querySelector("[data-zt-torch]") as HTMLElement).hidden,
      near: document.querySelector("[data-global-record-camera-focus]")?.textContent,
    }));
    assert.deepEqual({ zoom: shown.zoom, focus: shown.focus, torch: shown.torch }, { zoom: true, focus: true, torch: true });
    assert.match(String(shown.near), /ピント[\s\S]*近い[\s\S]*遠い/);
    await page.evaluate(() => {
      const range = document.querySelector("[data-global-record-camera-focus-range]") as HTMLInputElement;
      range.value = "0.5";
      range.dispatchEvent(new Event("input", { bubbles: true }));
      const zoom = document.querySelector("[data-global-record-camera-zoom-range]") as HTMLInputElement;
      zoom.value = "2";
      zoom.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.click("[data-zt-torch]");
    const box = (await page.locator("[data-global-record-camera-preview]").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => (window as unknown as { __cam: { applyConstraints: unknown[] } }).__cam.applyConstraints.length >= 4);
    log = await camLog(page);
    const applied = log.applyConstraints as Array<{ advanced: Array<Record<string, unknown>> }>;
    assert.deepEqual(applied[0], { advanced: [{ focusDistance: 0.5, focusMode: "manual" }] });
    assert.deepEqual(applied[1], { advanced: [{ zoom: 2 }] });
    assert.deepEqual(applied[2], { advanced: [{ torch: true }] });
    const tap = applied[3]!.advanced[0]!;
    assert.equal(tap.focusMode, "single-shot");
    const point = (tap.pointsOfInterest as Array<{ x: number; y: number }>)[0]!;
    assert.ok(Math.abs(point.x - 0.5) < 0.05 && Math.abs(point.y - 0.5) < 0.05, JSON.stringify(point));
    assert.equal(log.getUserMedia.length, 1);
    await page.waitForTimeout(300);
    await shot(page, "cap2-390");
    await page.click('[data-zt-mode="standard"]');
    await page.waitForFunction(() => document.querySelector("[data-zukan-capture-stage]")?.getAttribute("data-mode") === "standard");
    assert.equal((await camLog(page)).getUserMedia.length, 1);
  } finally {
    await close();
  }
});

browserTest("close-up on a device without focus control shows the fallback and never blocks", async () => {
  const { page, close } = await openRecord({ caps: {} });
  try {
    await waitPhase(page, "live");
    await waitVideo(page);
    await page.click('[data-zt-mode="closeup"]');
    await page.waitForFunction(() => !(document.querySelector("[data-zt-card]") as HTMLElement).hidden);
    const card = await page.evaluate(() => {
      const visible = (el: Element | null) => Boolean(el) && getComputedStyle(el!).display !== "none" && (el as HTMLElement).getBoundingClientRect().width > 0;
      const root = document.querySelector("[data-zt-card]")!;
      return {
        main: root.querySelector("[data-global-record-camera-error-body]")?.textContent,
        device: visible(root.querySelector("[data-global-record-camera-focus-fallback] [data-zt-device-photo]")),
        standard: visible(root.querySelector("[data-zt-standard]")),
        deviceText: root.querySelector("[data-global-record-camera-focus-fallback] [data-zt-device-photo]")?.textContent?.trim(),
        standardText: root.querySelector("[data-zt-standard]")?.textContent?.trim(),
        errorActions: visible(root.querySelector("[data-global-record-camera-error-actions]")),
      };
    });
    assert.equal(card.main, "このブラウザでは接写のピントを調整できません");
    assert.equal(card.deviceText, "端末のカメラで撮る");
    assert.equal(card.standardText, "標準に戻る");
    assert.deepEqual({ device: card.device, standard: card.standard, errorActions: card.errorActions }, { device: true, standard: true, errorActions: false });
    assert.equal((await camLog(page)).stops, 0);
    await page.waitForTimeout(300);
    await shot(page, "cap3-390");
    const chooser = page.waitForEvent("filechooser");
    await page.click("[data-zt-card] [data-global-record-camera-focus-fallback] [data-zt-device-photo]");
    const picked = await chooser;
    await picked.setFiles({ name: "device.png", mimeType: "image/png", buffer: TINY_PNG });
    await page.waitForFunction(() => document.querySelector("[data-zt-count]")?.textContent === "1");
    await page.click("[data-zt-standard]");
    await page.waitForFunction(() => (document.querySelector("[data-zt-card]") as HTMLElement).hidden);
    await waitPhase(page, "live");
    assert.equal(await page.evaluate(() => document.querySelector("[data-zukan-capture-stage]")?.getAttribute("data-mode")), "standard");
  } finally {
    await close();
  }
});

browserTest("permission denied still offers choosing photos and the device camera, and the shutter opens the device camera", async () => {
  const { page, close } = await openRecord({ deny: "NotAllowedError" });
  try {
    await waitPhase(page, "error");
    const card = await page.evaluate(() => {
      const visible = (el: Element | null) => Boolean(el) && getComputedStyle(el!).display !== "none" && (el as HTMLElement).getBoundingClientRect().width > 0;
      const root = document.querySelector("[data-zt-card]")!;
      return {
        hidden: (root as HTMLElement).hidden,
        main: root.querySelector("[data-global-record-camera-error-body]")?.textContent,
        pick: visible(root.querySelector("[data-zt-pick-photo]")),
        device: visible(root.querySelector("[data-global-record-camera-error-actions] [data-zt-device-photo]")),
        retry: visible(root.querySelector("[data-zt-retry]")),
        side: visible(document.querySelector("[data-zt-pick]")),
      };
    });
    assert.equal(card.hidden, false);
    assert.ok(String(card.main).length > 8);
    assert.deepEqual({ pick: card.pick, device: card.device, retry: card.retry, side: card.side }, { pick: true, device: true, retry: true, side: true });
    await page.waitForTimeout(300);
    await shot(page, "cap-denied-390");
    const chooser = page.waitForEvent("filechooser");
    await page.click("[data-zt-card] [data-zt-pick-photo]");
    await (await chooser).setFiles({ name: "a.png", mimeType: "image/png", buffer: TINY_PNG });
    await page.waitForFunction(() => document.querySelector("[data-zt-count]")?.textContent === "1");
    const shutterChooser = page.waitForEvent("filechooser");
    await page.click("[data-zt-shutter]");
    await shutterChooser;
  } finally {
    await close();
  }
});

browserTest("reduced motion turns every capture transition and animation off", async () => {
  const { page, close } = await openRecord({ reducedMotion: "reduce" });
  try {
    await waitPhase(page, "live");
    const motion = await page.evaluate(() => {
      const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
      return {
        stage: style("[data-zukan-capture-stage]").animationName,
        thumb: style("[data-zt-pill-thumb]").transitionDuration,
        header: style(".zukan-app-header").transitionDuration,
        shutter: style("[data-zt-shutter]").transitionDuration,
      };
    });
    assert.equal(motion.stage, "none");
    for (const value of [motion.thumb, motion.header, motion.shutter]) assert.match(value, /^(0s|1e-05s)(, (0s|1e-05s))*$/);
    await shoot(page, 1);
    assert.equal(await page.evaluate(() => document.querySelector("[data-zt-flash]")?.classList.contains("is-on")), false);
  } finally {
    await close();
  }
});

browserTest("motion uses the shared 120 / 240 ms vocabulary with the standard easing", async () => {
  const { page, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    const motion = await page.evaluate(() => {
      const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
      return {
        thumb: style("[data-zt-pill-thumb]").transitionDuration,
        thumbEase: style("[data-zt-pill-thumb]").transitionTimingFunction,
        header: style(".zukan-app-header").transitionDuration,
        shutter: style("[data-zt-shutter]").transitionDuration,
      };
    });
    assert.match(motion.thumb, /0\.24s/);
    assert.match(motion.thumbEase, /cubic-bezier\(0\.2, 0, 0, 1\)/);
    assert.match(motion.header, /0\.24s/);
    assert.match(motion.shutter, /0\.12s/);
  } finally {
    await close();
  }
});

browserTest("1280px puts the camera on the left and the controls in a 320px right column in the same order", async () => {
  const { page, close } = await openRecord({ width: 1280, height: 800 });
  try {
    await waitPhase(page, "live");
    await waitVideo(page);
    const layout = await page.evaluate(() => {
      const rect = (selector: string) => {
        const box = document.querySelector(selector)!.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
      };
      return { frame: rect(".zt-cap-frame"), panel: rect(".zt-cap-panel"), modes: rect("[data-zt-modes]"), shutter: rect("[data-zt-shutter]"), pick: rect("[data-zt-pick]"), memo: rect("[data-zt-memo-open]") };
    });
    assert.equal(Math.round(layout.panel.width), 320);
    assert.ok(layout.frame.right <= layout.panel.left + 1);
    assert.ok(layout.modes.top < layout.shutter.top);
    assert.ok(layout.pick.left < layout.shutter.left && layout.shutter.left < layout.memo.left);
    await page.waitForTimeout(400);
    await shot(page, "cap1-1280");
    await shoot(page, 2);
    await page.waitForTimeout(400);
    await shot(page, "cap1-1280-stack");
  } finally {
    await close();
  }
});

browserTest("tapping the stack opens a large review where photos are removed one by one", async () => {
  const { page, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    await shoot(page, 3);
    await page.click("[data-zt-stack]");
    await page.waitForFunction(() => !(document.querySelector("[data-zt-review]") as HTMLElement).hidden);
    const review = await page.evaluate(() => ({
      thumbs: document.querySelectorAll("[data-zt-review-thumbs] .zt-rv-thumb").length,
      save: document.querySelector("[data-zt-review-save]")?.textContent,
    }));
    assert.equal(review.thumbs, 3);
    assert.match(String(review.save), /3枚/);
    await page.waitForTimeout(450);
    await shot(page, "cap5-390");
    await page.click("[data-zt-review-thumbs] .zt-rv-thumb:nth-child(2) .zt-rv-x");
    await page.waitForFunction(() => document.querySelector("[data-zt-count]")?.textContent === "2");
    assert.match(String(await page.evaluate(() => document.querySelector("[data-zt-review-save]")?.textContent)), /2枚/);
    await page.click("[data-zt-review-more]");
    await page.waitForFunction(() => (document.querySelector("[data-zt-review]") as HTMLElement).hidden);
    assert.equal(await page.evaluate(() => document.querySelector("[data-zt-save]")?.textContent), "記録する（2枚）");
    assert.equal((await camLog(page)).getUserMedia.length, 1);
  } finally {
    await close();
  }
});

browserTest("the memo opens from the right button and its text is saved with the record", async () => {
  const { page, api, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    await shoot(page, 1);
    await page.click("[data-zt-memo-open]");
    await page.waitForFunction(() => (document.querySelector("[data-zt-memo]") as HTMLDialogElement).open);
    await page.fill("[data-zt-memo-text]", "裏に小さなクモ");
    await page.click("[data-zt-memo-close]");
    await page.click("[data-zt-save]");
    await waitPhase(page, "saved");
    assert.equal(api.upsert[0]!.note, "裏に小さなクモ");
  } finally {
    await close();
  }
});

browserTest("video mode records on its own stream and keeps photos and video apart", async () => {
  const { page, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    await shoot(page, 1);
    await page.click('[data-zt-mode="video"]', { force: true });
    assert.equal(await page.evaluate(() => document.querySelector("[data-zukan-capture-stage]")?.getAttribute("data-mode")), "standard");
    assert.match(String(await page.textContent("[data-zt-error]")), /動画/);
    assert.equal((await camLog(page)).getUserMedia.length, 1);
    await page.click("[data-zt-stack]");
    await page.click("[data-zt-review-thumbs] .zt-rv-x");
    await page.waitForFunction(() => document.querySelector("[data-zt-count]")?.textContent === "0");
    await page.evaluate(() => { const review = document.querySelector("[data-zt-review]") as HTMLElement; if (!review.hidden) (document.querySelector("[data-zt-review-more]") as HTMLElement).click(); });
    await page.click('[data-zt-mode="video"]');
    await page.waitForFunction(() => document.querySelector("[data-zukan-capture-stage]")?.getAttribute("data-mode") === "video");
    await waitPhase(page, "live");
    const gum = (await camLog(page)).getUserMedia;
    assert.equal(gum.length, 2);
    assert.deepEqual(gum[1], { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
    await waitVideo(page);
    await page.click("[data-zt-shutter]");
    await page.waitForFunction(() => document.querySelector("[data-zt-shutter]")?.getAttribute("aria-pressed") === "true");
    await page.waitForTimeout(1200);
    await page.click("[data-zt-shutter]");
    await page.waitForFunction(() => document.querySelector("[data-zt-count]")?.textContent === "1", undefined, { timeout: 8000 });
    assert.equal(await page.evaluate(() => document.querySelector("[data-zt-save]")?.textContent), "記録する（動画）");
  } finally {
    await close();
  }
});
