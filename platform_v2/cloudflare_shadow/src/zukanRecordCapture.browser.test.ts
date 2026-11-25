import assert from "node:assert/strict";
import { browserTest, camLog, geoLog, openRecord, shoot, shot, TINY_PNG, waitPhase, waitVideo } from "./zukanRecordCaptureHarness";

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
    assert.equal(text.thumbs, 1);
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
    assert.equal(card.main, "このブラウザでは、接写のピントを調整できません");
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
      return { frame: rect(".zt-cap-view"), panel: rect(".zt-cap-panel"), modes: rect("[data-zt-modes]"), shutter: rect("[data-zt-shutter]"), pick: rect("[data-zt-pick]"), memo: rect("[data-zt-memo-open]") };
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

browserTest("video mode can be chosen with photos in the stack, keeps them, and recording waits until they are saved or removed", async () => {
  const { page, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    await shoot(page, 1);
    assert.equal(await page.getAttribute('[data-zt-mode="video"]', "aria-disabled"), null);
    await page.click('[data-zt-mode="video"]');
    await page.waitForFunction(() => document.querySelector("[data-zukan-capture-stage]")?.getAttribute("data-mode") === "video");
    await waitPhase(page, "live");
    assert.equal(await page.evaluate(() => document.querySelector("[data-zt-count]")?.textContent), "1");
    const gum = (await camLog(page)).getUserMedia;
    assert.equal(gum.length, 2);
    assert.deepEqual(gum[1], { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
    await waitVideo(page);
    await page.click("[data-zt-shutter]");
    assert.match(String(await page.textContent("[data-zt-error]")), /動画/);
    assert.equal(await page.getAttribute("[data-zt-shutter]", "aria-pressed"), null);
    await page.click("[data-zt-stack]");
    await page.click("[data-zt-review-thumbs] .zt-rv-x");
    await page.waitForFunction(() => document.querySelector("[data-zt-count]")?.textContent === "0");
    await page.evaluate(() => { const review = document.querySelector("[data-zt-review]") as HTMLElement; if (!review.hidden) (document.querySelector("[data-zt-review-more]") as HTMLElement).click(); });
    await page.waitForTimeout(300);
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

browserTest("going back from close-up to standard resets zoom, focus and the light on the camera", async () => {
  const { page, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    await waitVideo(page);
    await page.click('[data-zt-mode="closeup"]');
    await page.waitForFunction(() => !(document.querySelector("[data-global-record-camera-focus]") as HTMLElement).hidden);
    await page.evaluate(() => {
      const zoom = document.querySelector("[data-global-record-camera-zoom-range]") as HTMLInputElement;
      zoom.value = "3";
      zoom.dispatchEvent(new Event("input", { bubbles: true }));
      const range = document.querySelector("[data-global-record-camera-focus-range]") as HTMLInputElement;
      range.value = "0.1";
      range.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.click("[data-zt-torch]");
    await page.waitForFunction(() => (window as unknown as { __cam: { applyConstraints: unknown[] } }).__cam.applyConstraints.length >= 3);
    const before = (await camLog(page)).applyConstraints.length;
    await page.click('[data-zt-mode="standard"]');
    await page.waitForFunction((n) => (window as unknown as { __cam: { applyConstraints: unknown[] } }).__cam.applyConstraints.length >= n + 3, before);
    const after = (await camLog(page)).applyConstraints.slice(before) as Array<{ advanced: Array<Record<string, unknown>> }>;
    const flat = after.map((entry) => entry.advanced[0]!);
    assert.ok(flat.some((entry) => entry.zoom === 1), JSON.stringify(flat));
    assert.ok(flat.some((entry) => entry.focusMode === "continuous"), JSON.stringify(flat));
    assert.ok(flat.some((entry) => entry.torch === false), JSON.stringify(flat));
    assert.equal(await page.getAttribute("[data-zt-torch]", "aria-pressed"), "false");
    assert.equal((await camLog(page)).getUserMedia.length, 1);
  } finally {
    await close();
  }
});

browserTest("location granted: asked in the background at the first shutter press only, attached at save, and the saved screen shows no 場所は未設定", async () => {
  const { page, api, close } = await openRecord({ geo: "granted" });
  try {
    await waitPhase(page, "live");
    await waitVideo(page);
    assert.deepEqual(await geoLog(page), []);
    await shoot(page, 1);
    assert.deepEqual(await geoLog(page), [{ enableHighAccuracy: false, timeout: 8000, maximumAge: 15000 }]);
    await page.waitForTimeout(200);
    await page.click("[data-zt-shutter]");
    await page.waitForFunction(() => document.querySelector("[data-zt-count]")?.textContent === "2");
    assert.equal((await geoLog(page)).length, 1);
    await page.click("[data-zt-save]");
    await waitPhase(page, "saved");
    assert.equal((await geoLog(page)).length, 1);
    assert.equal(api.upsert.length, 1);
    assert.equal(api.upsert[0]!.latitude, 34.7108);
    assert.equal(api.upsert[0]!.longitude, 137.7261);
    assert.equal(api.upsert[0]!.visibility, "private");
    assert.equal(api.uploads.length, 2);
    assert.doesNotMatch(String(await page.textContent("[data-zt-saved-card-meta]")), /場所は未設定/);
    await page.click("[data-zt-again]");
    await waitPhase(page, "live");
    assert.equal(await page.evaluate(() => (document.querySelector('#record-form [name="latitude"]') as HTMLInputElement).value), "");
  } finally {
    await close();
  }
});

browserTest("location denied: the record is saved private and shown as 場所未設定", async () => {
  const { page, api, close } = await openRecord({ geo: "denied" });
  try {
    await waitPhase(page, "live");
    await shoot(page, 1);
    await page.click("[data-zt-save]");
    await waitPhase(page, "saved");
    assert.equal(api.upsert.length, 1);
    assert.equal(api.upsert[0]!.latitude, null);
    assert.equal(api.upsert[0]!.longitude, null);
    assert.equal(api.upsert[0]!.visibility, "private");
    assert.match(String(await page.textContent("[data-zt-saved-card-meta]")), /場所は未設定/);
  } finally {
    await close();
  }
});

browserTest("location that never answers does not block the shutter and save waits at most 1.5 seconds", async () => {
  const { page, api, close } = await openRecord({ geo: "hang" });
  try {
    await waitPhase(page, "live");
    const started = Date.now();
    await shoot(page, 3);
    assert.ok(Date.now() - started < 6000);
    assert.equal((await geoLog(page)).length, 1);
    const clicked = Date.now();
    await page.click("[data-zt-save]");
    await waitPhase(page, "saved", 6000);
    assert.ok(Date.now() - clicked < 4500, String(Date.now() - clicked));
    assert.equal(api.upsert[0]!.latitude, null);
    assert.equal(api.upsert[0]!.longitude, null);
    assert.equal(api.upsert[0]!.visibility, "private");
    assert.equal(api.uploads.length, 3);
    assert.match(String(await page.textContent("[data-zt-saved-card-meta]")), /場所は未設定/);
  } finally {
    await close();
  }
});

browserTest("observedAt keeps seconds: shutter time for camera shots, EXIF DateTimeOriginal for library photos", async () => {
  const shutter = await openRecord();
  try {
    await waitPhase(shutter.page, "live");
    const before = Date.now();
    await shoot(shutter.page, 1);
    await shutter.page.click("[data-zt-save]");
    await waitPhase(shutter.page, "saved");
    const observed = Date.parse(String(shutter.api.upsert[0]!.observedAt));
    assert.ok(observed >= before - 1000 && observed <= Date.now(), `${observed} vs ${before}`);
    assert.match(String(shutter.api.upsert[0]!.observedAt), /\.000Z$/);
  } finally {
    await shutter.close();
  }
  const library = await openRecord();
  try {
    await waitPhase(library.page, "live");
    const jpeg = Buffer.from(await library.page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 48;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#3a7";
      ctx.fillRect(0, 0, 64, 48);
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg"));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = "";
      for (const byte of bytes) text += String.fromCharCode(byte);
      return btoa(text);
    }), "base64");
    const stamp = Buffer.from("2025:03:04 11:22:33\0", "latin1");
    const tiff = Buffer.concat([
      Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]),
      Buffer.from([0x01, 0x00, 0x69, 0x87, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      Buffer.from([0x01, 0x00, 0x03, 0x90, 0x02, 0x00, 0x14, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      stamp,
    ]);
    const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
    const segment = Buffer.concat([Buffer.from([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload]);
    const withExif = Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
    await library.page.setInputFiles("#record-media-photo", { name: "library.jpg", mimeType: "image/jpeg", buffer: withExif });
    await library.page.waitForFunction(() => document.querySelector("[data-zt-count]")?.textContent === "1");
    await library.page.click("[data-zt-save]");
    await waitPhase(library.page, "saved");
    assert.equal(library.api.upsert[0]!.observedAt, new Date(2025, 2, 4, 11, 22, 33).toISOString());
    assert.deepEqual(await geoLog(library.page), []);
    assert.equal(library.api.upsert[0]!.latitude, null);
  } finally {
    await library.close();
  }
});

browserTest("mock typography and sizes apply: bold labels, 74px shutter, 48px save, video fills the screen with no bands", async () => {
  for (const [width, height] of [[390, 844], [1280, 800]] as const) {
    const { page, close } = await openRecord({ width, height });
    try {
      await waitPhase(page, "live");
      await waitVideo(page);
      await shoot(page, 3);
      const m = await page.evaluate(() => {
        const st = (sel: string) => { const el = document.querySelector(sel)!; const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return { fs: c.fontSize, fw: c.fontWeight, h: Math.round(r.height), w: Math.round(r.width) }; };
        const view = document.querySelector(".zt-cap-view")!.getBoundingClientRect();
        const frame = document.querySelector(".zt-cap-frame")!.getBoundingClientRect();
        return {
          pill: st('[data-zt-mode="standard"]'), side: st("[data-zt-pick] span"), memo: st("[data-zt-memo-open] span"), shutter: st("[data-zt-shutter]"), save: st("[data-zt-save]"), title: st("[data-zt-stack-title]"),
          badge: st("[data-zt-count]"), badgeBg: getComputedStyle(document.querySelector("[data-zt-count]")!).backgroundColor,
          covers: frame.left <= view.left + 1 && frame.right >= view.right - 1 && frame.top <= view.top + 1 && frame.bottom >= view.bottom - 1,
          videoFits: (() => { const v = document.querySelector("video[data-global-record-camera-video]")!.getBoundingClientRect(); return v.left <= view.left + 1 && v.right >= view.right - 1 && v.top <= view.top + 1 && v.bottom >= view.bottom - 1; })(),
          autoVisible: (() => { const a = document.querySelector("[data-global-record-camera-focus-auto]") as HTMLElement | null; return a ? getComputedStyle(a).display !== "none" : false; })(),
        };
      });
      assert.deepEqual({ fs: m.pill.fs, fw: m.pill.fw }, { fs: "14px", fw: "700" }, `${width} pill`);
      assert.deepEqual({ fs: m.side.fs, fw: m.side.fw }, { fs: "11.5px", fw: "600" });
      assert.deepEqual({ fs: m.memo.fs, fw: m.memo.fw }, { fs: "11.5px", fw: "600" });
      assert.equal(m.shutter.h, 74);
      assert.equal(m.shutter.w, 74);
      assert.deepEqual({ fs: m.save.fs, fw: m.save.fw }, { fs: "15px", fw: "800" });
      assert.ok(m.save.h >= 46 && m.save.h <= 52, String(m.save.h));
      assert.deepEqual({ fs: m.title.fs, fw: m.title.fw }, { fs: "13.5px", fw: "700" });
      assert.ok(m.badge.h >= 23);
      assert.equal(m.badgeBg, "rgb(180, 73, 43)");
      assert.equal(m.covers, true, `${width} frame covers view`);
      assert.equal(m.videoFits, true, `${width} video covers view`);
      assert.equal(m.autoVisible, false);
    } finally {
      await close();
    }
  }
});

browserTest("review and saved screens match the mock sizes and the 動画 tab is a normal tab", async () => {
  const { page, close } = await openRecord();
  try {
    await waitPhase(page, "live");
    await shoot(page, 3);
    const pill = await page.evaluate(() => { const el = document.querySelector('[data-zt-mode="video"]')!; return { opacity: getComputedStyle(el).opacity, dis: el.getAttribute("aria-disabled") }; });
    assert.deepEqual(pill, { opacity: "1", dis: null });
    await page.click("[data-zt-stack]");
    await page.waitForFunction(() => !(document.querySelector("[data-zt-review]") as HTMLElement).hidden);
    await page.waitForTimeout(450);
    const rv = await page.evaluate(() => {
      const st = (sel: string) => { const el = document.querySelector(sel)!; const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return { fs: c.fontSize, fw: c.fontWeight, h: Math.round(r.height), w: Math.round(r.width), color: c.color, bg: c.backgroundColor, radius: c.borderTopLeftRadius, border: c.borderTopWidth }; };
      return { save: st("[data-zt-review-save]"), more: st("[data-zt-review-more]"), x: st(".zt-rv-x"), thumb: st(".zt-rv-thumb-img"), head: st("[data-zt-review-title]") };
    });
    assert.equal(rv.save.h, 54);
    assert.deepEqual({ fs: rv.save.fs, fw: rv.save.fw, radius: rv.save.radius }, { fs: "16px", fw: "800", radius: "14px" });
    assert.deepEqual({ fs: rv.more.fs, fw: rv.more.fw, color: rv.more.color }, { fs: "15px", fw: "700", color: "rgb(0, 85, 173)" });
    assert.deepEqual({ w: rv.x.w, h: rv.x.h, color: rv.x.color }, { w: 26, h: 26, color: "rgb(255, 255, 255)" });
    assert.equal(rv.thumb.border, "0px");
    await page.click("[data-zt-review-save]");
    await waitPhase(page, "saved");
    await page.waitForTimeout(500);
    const sv = await page.evaluate(() => {
      const st = (sel: string) => { const el = document.querySelector(sel)!; const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return { fs: c.fontSize, fw: c.fontWeight, h: Math.round(r.height), w: Math.round(r.width) }; };
      return { check: st(".zt-sv-check"), title: st("[data-zt-saved-title]"), img: st(".zt-sv-card img"), again: st("[data-zt-again]"), view: st("[data-zt-view]") };
    });
    assert.equal(sv.check.w, 74);
    assert.equal(sv.title.fs, "21px");
    assert.equal(sv.img.w, 64);
    assert.equal(sv.again.h, 54);
    assert.ok(sv.view.h >= 52 && sv.view.h <= 54, String(sv.view.h));
  } finally {
    await close();
  }
});

browserTest("focus reticle is corner brackets, the focusing text disappears the moment the frame turns green, and no extra auto button shows", async () => {
  const { page, close } = await openRecord({ focusDelay: 700 });
  try {
    await waitPhase(page, "live");
    await waitVideo(page);
    await page.click('[data-zt-mode="closeup"]');
    await page.waitForFunction(() => !(document.querySelector("[data-global-record-camera-focus]") as HTMLElement).hidden);
    await page.mouse.click(190, 420);
    await page.waitForFunction(() => document.querySelector("[data-zt-note]")?.classList.contains("is-on"));
    const during = await page.evaluate(() => {
      const marker = document.querySelector("[data-zt-focus-frame]") as HTMLElement;
      return { corners: marker.querySelectorAll("i").length, border: getComputedStyle(marker).borderTopWidth, ok: marker.classList.contains("is-ok"), note: getComputedStyle(document.querySelector("[data-zt-note]")!).opacity };
    });
    assert.deepEqual({ corners: during.corners, border: during.border, ok: during.ok }, { corners: 4, border: "0px", ok: false });
    await page.waitForFunction(() => document.querySelector("[data-zt-focus-frame]")?.classList.contains("is-ok"), undefined, { timeout: 4000 });
    assert.equal(await page.evaluate(() => document.querySelector("[data-zt-note]")?.classList.contains("is-on")), false);
    assert.equal(await page.evaluate(() => { const a = document.querySelector("[data-global-record-camera-focus-auto]") as HTMLElement; return getComputedStyle(a).display; }), "none");
  } finally {
    await close();
  }
});
