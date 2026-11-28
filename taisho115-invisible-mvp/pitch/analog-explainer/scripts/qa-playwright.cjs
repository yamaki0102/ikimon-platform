const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const slides = require("../src/slides.json");
const releaseAssets = require("../src/release-assets.json");

const url = process.env.DECK_URL || "http://127.0.0.1:5178/";
const narrationAssetDir = releaseAssets.rulesNarration;
const outDir = process.env.QA_OUT_DIR ? path.resolve(process.env.QA_OUT_DIR) : path.resolve(__dirname, "..", ".runtime", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

async function openDeck(page) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".slide.active", { state: "visible", timeout: 15000 });
  await page.waitForTimeout(250);
}

function segments(slide, slideIndex) {
  const items =
    Array.isArray(slide.dialogue) && slide.dialogue.length
      ? slide.dialogue.map((line) => ({ text: String(line.text || "").trim(), speaker: line.speaker || "narrator" }))
      : (String(slide.narration)
          .match(/[^。！？!?]+[。！？!?]?/g)
          ?.map((item) => ({ text: item.trim(), speaker: "narrator" }))
          .filter((item) => item.text) ?? [{ text: slide.narration, speaker: "narrator" }]);

  return items.map((item, segmentIndex) => ({
    text: item.text,
    speaker: item.speaker,
    audio: `${narrationAssetDir}/slide-${String(slideIndex + 1).padStart(2, "0")}-${String(segmentIndex + 1).padStart(2, "0")}.wav`
  }));
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() =>
    chromium.launch({ channel: "msedge", headless: true })
  );
  const page = await browser.newPage();
  const failures = [];

  for (const viewport of [
    { name: "desktop", width: 1366, height: 768 },
    { name: "mobile", width: 390, height: 844 },
    { name: "landscape", width: 667, height: 375 }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDeck(page);
    const count = await page.locator("[data-slide]").count();
    if (count !== slides.length) failures.push(`${viewport.name}: slide count ${count}`);
    for (let index = 0; index < count; index += 1) {
      if (index > 0) {
        if (viewport.name === "landscape") await page.keyboard.press("ArrowRight");
        else await page.getByLabel("次のスライド").click();
      }
      await page.waitForTimeout(360);
      const metrics = await page.evaluate(() => {
        const active = document.querySelector(".slide.active");
        const rect = active?.getBoundingClientRect();
        const viewportRect = document.querySelector(".slides-viewport")?.getBoundingClientRect();
        const toolbarRect = document.querySelector(".deck-toolbar")?.getBoundingClientRect();
        const copyRect = active?.querySelector(".slide-copy")?.getBoundingClientRect();
        const visualRect = active?.querySelector(".visual")?.getBoundingClientRect();
        const images = [...(active?.querySelectorAll("img") || [])];
        return {
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
          innerH: window.innerHeight,
          rectW: rect?.width || 0,
          rectH: rect?.height || 0,
          rectBottom: rect?.bottom || 0,
          viewportBottom: viewportRect?.bottom || 0,
          toolbarH: toolbarRect?.height || 0,
          shellClass: document.querySelector(".deck-shell")?.className || "",
          copyRight: copyRect?.right || 0,
          visualLeft: visualRect?.left || 0,
          hasVisibleText: Boolean(active?.textContent?.trim()),
          images: images.length,
          brokenImages: images.filter((img) => img.naturalWidth < 12 || img.naturalHeight < 12).length
        };
      });
      if (metrics.scrollW > metrics.innerW + 2) failures.push(`${viewport.name} slide ${index + 1}: horizontal overflow ${metrics.scrollW}/${metrics.innerW}`);
      if (!metrics.hasVisibleText) failures.push(`${viewport.name} slide ${index + 1}: empty text`);
      if (viewport.name === "desktop" && (metrics.rectW < 900 || metrics.rectH < 520)) {
        failures.push(`${viewport.name} slide ${index + 1}: slide frame too small ${metrics.rectW}x${metrics.rectH}`);
      }
      if (viewport.name === "mobile") {
        if (!metrics.shellClass.includes("portrait-preview-mode")) failures.push(`${viewport.name} slide ${index + 1}: portrait preview mode missing`);
        if (metrics.rectW < 350 || metrics.rectH < 190) failures.push(`${viewport.name} slide ${index + 1}: preview frame too small ${metrics.rectW}x${metrics.rectH}`);
        if (metrics.rectBottom > metrics.viewportBottom + 3) failures.push(`${viewport.name} slide ${index + 1}: preview escapes viewport`);
        if (metrics.visualLeft < metrics.copyRight - 3) failures.push(`${viewport.name} slide ${index + 1}: two-column composition collapsed`);
      }
      if (viewport.name === "landscape") {
        if (!metrics.shellClass.includes("landscape-fit-mode")) failures.push(`${viewport.name} slide ${index + 1}: landscape fit mode missing`);
        if (metrics.rectH > metrics.innerH + 2 || Math.abs(metrics.rectW / metrics.rectH - 16 / 9) > 0.04) {
          failures.push(`${viewport.name} slide ${index + 1}: slide does not fit 16:9 viewport ${metrics.rectW}x${metrics.rectH}`);
        }
        if (metrics.toolbarH > 52) failures.push(`${viewport.name} slide ${index + 1}: toolbar too tall ${metrics.toolbarH}`);
      }
      if (metrics.images === 0) failures.push(`${viewport.name} slide ${index + 1}: no product/rule image`);
      if (metrics.brokenImages > 0) failures.push(`${viewport.name} slide ${index + 1}: broken images ${metrics.brokenImages}`);
      if ([0, 3, 7, 10].includes(index)) {
        await page.screenshot({ path: path.join(outDir, `${viewport.name}-slide-${String(index + 1).padStart(2, "0")}.png`), fullPage: true });
      }
    }
    await page.waitForTimeout(360);
    await page.screenshot({ path: path.join(outDir, `${viewport.name}.png`), fullPage: true });
  }

  await openDeck(page);
  const audioFiles = [
    `${narrationAssetDir}/slide-manifest.json`,
    ...slides.map((_, index) => `${narrationAssetDir}/slides/slide-${String(index + 1).padStart(2, "0")}.wav`)
  ];
  const audioChecks = await page.evaluate(async (files) => {
    const results = [];
    for (const file of files) {
      const href = new URL(file, window.location.href).href;
      const res = await fetch(href);
      results.push({ file: href, ok: res.ok, type: res.headers.get("content-type") || "" });
    }
    return results;
  }, audioFiles);
  for (const item of audioChecks) {
    if (!item.ok) failures.push(`audio fetch failed: ${item.file}`);
  }

  const manifestCheck = await page.evaluate(async (assetDir) => {
    const res = await fetch(new URL(`${assetDir}/slide-manifest.json`, window.location.href));
    const manifest = await res.json();
    const cps = manifest.slides.map((slide) => slide.cps);
    const tempoDeviation = manifest.slides.map((slide) => Number(slide.tempoDeviation)).filter(Number.isFinite);
    return {
      mode: manifest.mode,
      slideCount: manifest.slides.length,
      cueCount: manifest.slides.reduce((total, slide) => total + slide.segments.length, 0),
      minCps: Math.min(...cps),
      maxCps: Math.max(...cps),
      maxTempoDeviation: Math.max(...tempoDeviation),
      allowedTempoDeviation: Number(manifest.maxTempoDeviation ?? 0.16) + 0.005,
      timingMode: manifest.timingMode,
      audioSegmentation: manifest.audioSegmentation
    };
  }, narrationAssetDir);
  if (manifestCheck.mode !== "slide-level") failures.push("slide-level narration manifest missing");
  if (manifestCheck.slideCount !== slides.length) failures.push(`manifest slide count ${manifestCheck.slideCount}`);
  if (manifestCheck.cueCount !== slides.flatMap((slide, index) => segments(slide, index)).length) failures.push(`manifest cue count ${manifestCheck.cueCount}`);
  if (manifestCheck.maxCps - manifestCheck.minCps > 0.05) failures.push(`manifest cps variance ${JSON.stringify(manifestCheck)}`);
  if (manifestCheck.timingMode !== "natural" && manifestCheck.maxTempoDeviation > manifestCheck.allowedTempoDeviation) {
    failures.push(`manifest tempo correction ${JSON.stringify(manifestCheck)}`);
  }
  if (manifestCheck.timingMode === "natural" && !String(manifestCheck.audioSegmentation || "").startsWith("speaker-blocks")) {
    failures.push(`manifest audio segmentation ${JSON.stringify(manifestCheck)}`);
  }

  const ctaChecks = await page.evaluate(() => ({
    hasPurchase: document.body.textContent?.includes("ブースで手に取る"),
    hasShare: document.body.textContent?.includes("共有する"),
    hasAnalytics: Boolean(window.dataLayer || window.clarity)
  }));
  if (!ctaChecks.hasPurchase) failures.push("cta purchase affordance missing");
  if (!ctaChecks.hasShare) failures.push("cta share affordance missing");

  await page.setViewportSize({ width: 1366, height: 768 });
  await openDeck(page);
  await page.locator(".slide.active .segment-timeline button").last().click();
  await page.getByLabel("音声つき自動再生").click();
  const expectedNextSlideId = slides[1]?.id;
  await page.waitForFunction(() => {
    const audio = document.querySelector("audio");
    return Boolean(audio && Number.isFinite(audio.duration) && audio.duration > 1 && !audio.paused);
  }, null, { timeout: 5000 });
  await page.evaluate(() => {
    const audio = document.querySelector("audio");
    if (audio && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, audio.duration - 0.2);
  });
  await page.waitForTimeout(700);
  const beforePageTurnState = await page.evaluate(() => ({
    slideId: document.querySelector(".slide.active")?.getAttribute("data-slide-id"),
    audioEnded: document.querySelector("audio")?.ended
  }));
  if (beforePageTurnState.slideId !== slides[0]?.id) {
    failures.push(`slide advanced before the 2s post-narration hold: ${JSON.stringify(beforePageTurnState)}`);
  }
  try {
    await page.waitForFunction(
      (slideId) => document.querySelector(`[data-slide-id="${slideId}"]`)?.classList.contains("active"),
      expectedNextSlideId,
      { timeout: 6000 }
    );
  } catch {
    failures.push("autoplay did not advance from final segment to next slide");
  }
  await page.waitForTimeout(600);
  const pageTurnHoldState = await page.evaluate(() => {
    const audio = document.querySelector("audio");
    return {
      paused: audio?.paused,
      currentTime: audio?.currentTime || 0,
      src: audio?.currentSrc || ""
    };
  });
  if (!pageTurnHoldState.paused && pageTurnHoldState.currentTime > 0.2) {
    failures.push(`next narration started too soon after page turn: ${JSON.stringify(pageTurnHoldState)}`);
  }
  await page.waitForTimeout(1400);
  const autoplayState = await page.evaluate(() => {
    const audio = document.querySelector("audio");
    return {
      paused: audio?.paused,
      currentTime: audio?.currentTime || 0,
      src: audio?.currentSrc || "",
      playbackRate: audio?.playbackRate,
      statusActive: document.querySelector(".control-button.active") !== null
    };
  });
  if (autoplayState.paused || autoplayState.currentTime <= 0.05) {
    failures.push(`autoplay advanced but next narration is not playing: ${JSON.stringify(autoplayState)}`);
  }
  const expectedPlaybackRate = url.includes("slides-demo") || /[?&]demo(?:[=&]|$)/.test(url) ? 1.2 : 1.15;
  if (Math.abs((autoplayState.playbackRate || 0) - expectedPlaybackRate) > 0.001) {
    failures.push(`narration playback rate mismatch: ${JSON.stringify({ expectedPlaybackRate, autoplayState })}`);
  }

  await page.setViewportSize({ width: 1366, height: 768 });
  await openDeck(page);
  await page.getByLabel("音声つき自動再生").click();
  const firstPlaybackRate = await page.evaluate(() => document.querySelector("audio")?.playbackRate || 0);
  if (Math.abs(firstPlaybackRate - expectedPlaybackRate) > 0.001) {
    failures.push(`first narration playback rate mismatch: ${JSON.stringify({ expectedPlaybackRate, firstPlaybackRate })}`);
  }
  try {
    await page.waitForFunction(
      () => Number(document.querySelector(".slide.active")?.getAttribute("data-segment") || "0") >= 1,
      null,
      { timeout: 12000 }
    );
  } catch {
    failures.push("audio time did not advance visual segment emphasis");
  }

  await browser.close();
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`playwright qa ok: ${url}`);
})();
