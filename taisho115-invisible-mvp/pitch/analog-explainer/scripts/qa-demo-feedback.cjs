const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const demoSlides = require("../src/demo-slides.json");
const releaseAssets = require("../src/release-assets.json");

const url = process.env.DECK_URL || "http://127.0.0.1:4186/?demo";
const formalAssetDir = releaseAssets.formal;
const demoNarrationAssetDir = releaseAssets.demoNarration;
const outDir = process.env.QA_OUT_DIR ? path.resolve(process.env.QA_OUT_DIR) : path.resolve(__dirname, "..", ".runtime", "screenshots-demo-feedback");
fs.mkdirSync(outDir, { recursive: true });

async function openDeck(page) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".slide.active", { state: "visible", timeout: 15000 });
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() =>
    chromium.launch({ channel: "msedge", headless: true })
  );
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play;
    window.__narrationPlayStarts = [];
    HTMLMediaElement.prototype.play = function patchedPlay(...args) {
      if (this.tagName === "AUDIO" && this.getAttribute("aria-hidden") !== "true") {
        window.__narrationPlayStarts.push({
          t: performance.now(),
          src: this.currentSrc || this.src,
          slide: document.querySelector(".slide.active")?.getAttribute("data-slide-id") || "",
          segment: document.querySelector(".slide.active")?.getAttribute("data-segment") || ""
        });
      }
      return originalPlay.apply(this, args);
    };
  });
  const failures = [];

  for (const viewport of [
    { name: "desktop", width: 1366, height: 768 },
    { name: "tablet", width: 1024, height: 768 },
    { name: "mobile", width: 390, height: 844 },
    { name: "landscape", width: 667, height: 375 }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDeck(page);
    const count = await page.locator("[data-slide]").count();
    if (count !== demoSlides.length) failures.push(`${viewport.name}: slide count ${count} !== ${demoSlides.length}`);

    let currentIndex = 0;
    const targetIndexes = viewport.name === "mobile"
      ? demoSlides.map((_, index) => index)
      : [1, 4, 8, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26].filter((index) => index < demoSlides.length);
    for (const targetIndex of targetIndexes) {
      while (currentIndex < targetIndex) {
        if (viewport.name === "landscape") await page.keyboard.press("ArrowRight");
        else await page.getByLabel("次のスライド").click();
        currentIndex += 1;
        await page.waitForTimeout(180);
      }
      await page.waitForTimeout(1200);
      const metrics = await page.evaluate(() => {
        const active = document.querySelector(".slide.active");
        const shell = document.querySelector(".deck-shell");
        const toolbar = document.querySelector(".deck-toolbar");
        const prompt = document.querySelector(".mobile-fullscreen-prompt");
        const entrySummary = document.querySelector(".mobile-entry-summary");
        const viewport = document.querySelector(".slides-viewport");
        const stage = active?.querySelector(".demo-stage");
        const board = active?.querySelector(".demo-board");
        const gaugePanel = active?.querySelector(".demo-gauge-panel");
        const slideRect = active?.getBoundingClientRect();
        const toolbarRect = toolbar?.getBoundingClientRect();
        const promptRect = prompt?.getBoundingClientRect();
        const entrySummaryRect = entrySummary?.getBoundingClientRect();
        const viewportRect = viewport?.getBoundingClientRect();
        const stageRect = stage?.getBoundingClientRect();
        const boardRect = board?.getBoundingClientRect();
        const gaugeRect = gaugePanel?.getBoundingClientRect();
        const secondaryControls = [
          ".deck-toolbar .control-link",
          ".deck-toolbar .volume-control",
          ".deck-toolbar .bgm-volume-control",
          '.deck-toolbar .icon-button[aria-label="現在スライドの音声"]',
          '.deck-toolbar .icon-button[aria-label="BGMをオン"]',
          '.deck-toolbar .icon-button[aria-label="BGMをオフ"]',
          '.deck-toolbar .icon-button[aria-label="字幕を開く"]',
          '.deck-toolbar .icon-button[aria-label="共有"]',
          '.deck-toolbar .icon-button[aria-label="PDF出力"]'
        ];
        const visibleSecondaryControls = secondaryControls.flatMap((selector) => [...document.querySelectorAll(selector)]).filter((node) => {
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
        }).length;
        const activeRail = [...(active?.querySelectorAll(".demo-step-rail span.active") || [])].map((node) => node.textContent?.trim());
        const gaugeImage = document.querySelector(".slide.active .demo-gauge-card-image");
        const gaugeCurrent = [...document.querySelectorAll(".slide.active .demo-gauge-current span")].map((node) => node.textContent?.replace(/\s+/g, " ").trim());
        const gaugeMarkers = [...document.querySelectorAll(".slide.active .demo-gauge-marker")].map((node) => node.getAttribute("class") || "");
        const bodyText = active?.textContent || "";
        const diceValues = [...document.querySelectorAll(".slide.active .die-face")].map((node) => node.getAttribute("data-value"));
        const rollingDiceRows = document.querySelectorAll(".slide.active .demo-dice-row.rolling").length;
        const clippedToolbarControls = [...(toolbar?.children || [])].filter((node) => {
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none" && (rect.left < -1 || rect.right > window.innerWidth + 1);
        }).length;
        return {
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
          scrollH: document.documentElement.scrollHeight,
          innerH: window.innerHeight,
          slideId: active?.getAttribute("data-slide-id"),
          portraitPreview: shell?.classList.contains("portrait-preview-mode") || false,
          landscapeFit: shell?.classList.contains("landscape-fit-mode") || false,
          slideRect: slideRect ? { top: slideRect.top, bottom: slideRect.bottom, width: slideRect.width, height: slideRect.height } : null,
          toolbarRect: toolbarRect ? { top: toolbarRect.top, bottom: toolbarRect.bottom, width: toolbarRect.width, height: toolbarRect.height } : null,
          promptRect: promptRect ? { top: promptRect.top, bottom: promptRect.bottom, width: promptRect.width, height: promptRect.height } : null,
          entrySummaryRect: entrySummaryRect ? { top: entrySummaryRect.top, bottom: entrySummaryRect.bottom, width: entrySummaryRect.width, height: entrySummaryRect.height } : null,
          entrySummaryText: entrySummary?.textContent || "",
          viewportRect: viewportRect ? { top: viewportRect.top, bottom: viewportRect.bottom, width: viewportRect.width, height: viewportRect.height } : null,
          stageRect: stageRect ? { left: stageRect.left, right: stageRect.right, top: stageRect.top, bottom: stageRect.bottom, width: stageRect.width, height: stageRect.height } : null,
          boardRect: boardRect ? { left: boardRect.left, right: boardRect.right, top: boardRect.top, bottom: boardRect.bottom, width: boardRect.width, height: boardRect.height } : null,
          gaugeRect: gaugeRect ? { left: gaugeRect.left, right: gaugeRect.right, top: gaugeRect.top, bottom: gaugeRect.bottom, width: gaugeRect.width, height: gaugeRect.height } : null,
          visibleSecondaryControls,
          clippedToolbarControls,
          activeRail,
          sidePanelCount: document.querySelectorAll(".slide.active .demo-side-panel").length,
          gaugeImageSrc: gaugeImage?.getAttribute("src") || "",
          gaugeCurrent,
          gaugeMarkers,
          bodyText,
          diceValues,
          rollingDiceRows,
          brokenImages: [...(active?.querySelectorAll("img") || [])].filter((img) => img.naturalWidth < 12 || img.naturalHeight < 12).length
        };
      });
      if (metrics.scrollW > metrics.innerW + 2) failures.push(`${viewport.name} ${metrics.slideId}: horizontal overflow ${metrics.scrollW}/${metrics.innerW}`);
      if (viewport.name === "mobile") {
        if (!metrics.portraitPreview) failures.push(`${viewport.name} ${metrics.slideId}: portrait preview mode missing`);
        if (!metrics.toolbarRect || metrics.toolbarRect.height > 96) {
          failures.push(`${viewport.name} ${metrics.slideId}: portrait toolbar too tall ${JSON.stringify(metrics.toolbarRect)}`);
        }
        if (!metrics.promptRect || metrics.promptRect.height > 48) {
          failures.push(`${viewport.name} ${metrics.slideId}: portrait fullscreen prompt too tall ${JSON.stringify(metrics.promptRect)}`);
        }
        if (metrics.visibleSecondaryControls > 0) {
          failures.push(`${viewport.name} ${metrics.slideId}: secondary controls visible in portrait ${metrics.visibleSecondaryControls}`);
        }
        if (!metrics.entrySummaryRect || metrics.entrySummaryRect.height > 120 || !metrics.entrySummaryText.includes("異なる10地点") || !metrics.entrySummaryText.includes("突入で逮捕")) {
          failures.push(`${viewport.name} ${metrics.slideId}: compact win-condition summary is missing ${JSON.stringify({ rect: metrics.entrySummaryRect, text: metrics.entrySummaryText })}`);
        }
        if (!metrics.viewportRect || metrics.viewportRect.top > 300) {
          failures.push(`${viewport.name} ${metrics.slideId}: portrait preview starts too low ${JSON.stringify(metrics.viewportRect)}`);
        }
        if (!metrics.viewportRect || metrics.viewportRect.height > 260) {
          failures.push(`${viewport.name} ${metrics.slideId}: portrait preview too tall ${JSON.stringify(metrics.viewportRect)}`);
        }
        if (!metrics.slideRect || metrics.slideRect.bottom > (metrics.viewportRect?.bottom ?? 0) + 3) {
          failures.push(`${viewport.name} ${metrics.slideId}: portrait slide escapes preview ${JSON.stringify({ slide: metrics.slideRect, viewport: metrics.viewportRect })}`);
        }
        if (metrics.gaugeRect && metrics.boardRect && metrics.gaugeRect.left < metrics.boardRect.right + 8) {
          failures.push(`${viewport.name} ${metrics.slideId}: police state card overlaps board ${JSON.stringify({ gauge: metrics.gaugeRect, board: metrics.boardRect })}`);
        }
        if (metrics.gaugeRect && metrics.stageRect && metrics.gaugeRect.right > metrics.stageRect.right - 6) {
          failures.push(`${viewport.name} ${metrics.slideId}: police state card escapes stage ${JSON.stringify({ gauge: metrics.gaugeRect, stage: metrics.stageRect })}`);
        }
        if (metrics.scrollH > metrics.innerH + 180) {
          failures.push(`${viewport.name} ${metrics.slideId}: portrait page is too tall ${metrics.scrollH}/${metrics.innerH}`);
        }
      }
      if (viewport.name === "tablet") {
        if (!metrics.toolbarRect || metrics.toolbarRect.height > 64 || metrics.clippedToolbarControls > 0) {
          failures.push(`${viewport.name} ${metrics.slideId}: toolbar clips or wraps ${JSON.stringify({ toolbar: metrics.toolbarRect, clipped: metrics.clippedToolbarControls })}`);
        }
      }
      if (viewport.name === "landscape") {
        if (!metrics.landscapeFit) failures.push(`${viewport.name} ${metrics.slideId}: landscape fit mode missing`);
        if (!metrics.slideRect || metrics.slideRect.height > metrics.innerH + 2 || Math.abs(metrics.slideRect.width / metrics.slideRect.height - 16 / 9) > 0.04) {
          failures.push(`${viewport.name} ${metrics.slideId}: slide does not fit 16:9 viewport ${JSON.stringify(metrics.slideRect)}`);
        }
        if (!metrics.toolbarRect || metrics.toolbarRect.height > 52 || metrics.clippedToolbarControls > 0) {
          failures.push(`${viewport.name} ${metrics.slideId}: compact toolbar is invalid ${JSON.stringify({ toolbar: metrics.toolbarRect, clipped: metrics.clippedToolbarControls })}`);
        }
      }
      if (metrics.activeRail.length !== 1) failures.push(`${viewport.name} ${metrics.slideId}: active step rail missing`);
      if (metrics.sidePanelCount !== 0) failures.push(`${viewport.name} ${metrics.slideId}: old side panel still rendered`);
      if (!metrics.gaugeImageSrc.includes(`${formalAssetDir}/gauge.webp`)) failures.push(`${viewport.name} ${metrics.slideId}: real gauge card image missing`);
      if (metrics.gaugeCurrent.length !== 2) failures.push(`${viewport.name} ${metrics.slideId}: fatigue/tip current values missing`);
      if (metrics.gaugeMarkers.length !== 2) failures.push(`${viewport.name} ${metrics.slideId}: fatigue/tip gauge markers missing`);
      if (metrics.brokenImages > 0) failures.push(`${viewport.name} ${metrics.slideId}: broken images ${metrics.brokenImages}`);
      if (metrics.rollingDiceRows > 0) failures.push(`${viewport.name} ${metrics.slideId}: dice still rolling after result timing window`);
      if (/[阿伊宇江][一二三]丁目|[阿伊宇江][一二三](?![0-9])/.test(metrics.bodyText)) {
        failures.push(`${viewport.name} ${metrics.slideId}: old town numerals remain in visible text`);
      }
      if (/警察ダイス[:：]\s*[一二三四五六]|出目[:：]\s*[一二三四五六]|[一二三四五六]・[一二三四五六]/.test(metrics.bodyText)) {
        failures.push(`${viewport.name} ${metrics.slideId}: old kanji dice labels remain in visible text`);
      }
      if (metrics.diceValues.some((value) => !["1", "2", "3", "4", "5", "6"].includes(value || ""))) {
        failures.push(`${viewport.name} ${metrics.slideId}: dice face values are not numeric`);
      }
    }

    await page.screenshot({ path: path.join(outDir, `${viewport.name}-demo-feedback.png`), fullPage: true });
  }

  const r7RaidIndex = demoSlides.findIndex((slide) => slide.id === "demo-round-7-raid");
  await page.setViewportSize({ width: 1366, height: 768 });
  await openDeck(page);
  for (let index = 0; index < r7RaidIndex; index += 1) {
    await page.getByLabel("次のスライド").click();
    await page.waitForTimeout(80);
  }
  await page.getByLabel("現在スライドの音声").click();
  await page.waitForTimeout(700);
  const earlyR7Direction = await page.evaluate(() => {
    const label = document.querySelector(".slide.active .demo-direction-label");
    const headerAnswer = document.querySelector(".slide.active .demo-screen-head b")?.textContent?.trim() || "";
    const visiblePoints = [...document.querySelectorAll(".slide.active .point-list li.visible")].map((node) =>
      node.textContent?.replace(/\s+/g, " ").trim()
    );
    if (!label) return { text: "", visible: false, segment: "" };
    const style = window.getComputedStyle(label);
    return {
      text: label.textContent?.trim() || "",
      visible: label.classList.contains("cue-on") && style.visibility !== "hidden" && Number(style.opacity) > 0.5,
      segment: document.querySelector(".slide.active")?.getAttribute("data-segment") || "",
      headerAnswer,
      visiblePoints
    };
  });
  if (earlyR7Direction.visible && earlyR7Direction.text.includes("突入")) {
    failures.push(`R7 raid target direction is visible before narration reaches the raid: ${JSON.stringify(earlyR7Direction)}`);
  }
  if (earlyR7Direction.headerAnswer !== "プレイ進行") {
    failures.push(`R7 answer header is visible before the question is answered: ${JSON.stringify(earlyR7Direction)}`);
  }
  if (earlyR7Direction.visiblePoints.some((text) => text?.includes("突入: 阿四"))) {
    failures.push(`R7 raid point is visible before the raid is narrated: ${JSON.stringify(earlyR7Direction)}`);
  }

  await openDeck(page);
  await page.evaluate(() => {
    window.__narrationPlayStarts = [];
  });
  await page.getByLabel("音声つき自動再生").click();
  await page.waitForTimeout(320);
  for (let index = 0; index < 5; index += 1) {
    await page.getByLabel("次のスライド").click();
    await page.waitForTimeout(140);
  }
  await page.waitForTimeout(2300);
  const rapidNavAudio = await page.evaluate(() => {
    const activeSlide = document.querySelector(".slide.active")?.getAttribute("data-slide-id") || "";
    const starts = window.__narrationPlayStarts || [];
    return {
      activeSlide,
      starts,
      activeSlideStarts: starts.filter((item) => item.slide === activeSlide).length
    };
  });
  if (rapidNavAudio.activeSlideStarts > 1 || rapidNavAudio.starts.length > 3) {
    failures.push(`rapid navigation caused repeated narration starts: ${JSON.stringify(rapidNavAudio)}`);
  }

  await page.setViewportSize({ width: 1280, height: 606 });
  await openDeck(page);
  for (let index = 0; index < 7; index += 1) {
    await page.getByLabel("次のスライド").click();
    await page.waitForTimeout(80);
  }
  await page.getByLabel("全画面で見る").click();
  await page.waitForTimeout(250);
  await page.evaluate(async () => {
    const audio = document.querySelector('audio:not([aria-hidden="true"])');
    if (!audio) throw new Error("active narration audio missing");
    await audio.play();
  });
  await page.waitForTimeout(900);
  const presentationCueBounds = await page.evaluate(() => {
    const active = document.querySelector(".slide.active");
    const activeRect = active?.getBoundingClientRect();
    const labels = [
      ...document.querySelectorAll(
        ".slide.active .demo-route-label.cue-on, .slide.active .demo-direction-label.cue-on, .slide.active .demo-dice-pack.cue-on, .slide.active .demo-question-bubble.cue-on, .slide.active .demo-decision-panel.cue-on"
      )
    ]
      .map((node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return {
          className: node.className,
          text: node.textContent?.replace(/\s+/g, " ").trim() || "",
          visible: style.visibility !== "hidden" && Number(style.opacity) > 0.5 && rect.width > 1 && rect.height > 1,
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }
        };
      })
      .filter((item) => item.visible);
    return {
      slideId: active?.getAttribute("data-slide-id") || "",
      shellClass: document.querySelector(".deck-shell")?.className || "",
      activeRect: activeRect
        ? { left: activeRect.left, right: activeRect.right, top: activeRect.top, bottom: activeRect.bottom, width: activeRect.width, height: activeRect.height }
        : null,
      labels
    };
  });
  if (!presentationCueBounds.shellClass.includes("presentation-mode") && !presentationCueBounds.shellClass.includes("fullscreen-active")) {
    failures.push(`presentation mode did not activate for cue-bound check: ${JSON.stringify(presentationCueBounds)}`);
  }
  for (const label of presentationCueBounds.labels) {
    const frame = presentationCueBounds.activeRect;
    if (!frame) {
      failures.push(`missing active slide frame for cue-bound check: ${JSON.stringify(presentationCueBounds)}`);
      break;
    }
    if (label.rect.left < frame.left + 4 || label.rect.right > frame.right - 4 || label.rect.top < frame.top + 4 || label.rect.bottom > frame.bottom - 4) {
      failures.push(`presentation cue label escapes slide frame: ${JSON.stringify({ label, frame })}`);
    }
  }

  await openDeck(page);
  const assetChecks = await page.evaluate(async (assetDir) => {
    const manifestUrl = new URL(`${assetDir}/slide-manifest.json`, window.location.href);
    const manifestRes = await fetch(manifestUrl);
    const manifest = await manifestRes.json();
    const byId = (slideId) => manifest.slides.find((slide) => slide.slideId === slideId) || { segments: [] };
    const earlyRaid = byId("demo-raid-miss");
    const r6Stealth1 = byId("demo-round-6-stealth-1");
    const r6Trace1 = byId("demo-round-6-trace-1");
    const r6Stealth2 = byId("demo-round-6-stealth-2");
    const r6Trace2 = byId("demo-round-6-trace-2");
    const r6Intel = byId("demo-round-6-intel");
    const r7Move = byId("demo-round-7-move");
    const r7Raid = byId("demo-round-7-raid");
    const r8Move = byId("demo-round-8-move");
    const cover = byId("demo-cover");
    const finalDecision = byId("demo-final-decision");
    const summary = byId("demo-summary");
    const wavRes = await fetch(new URL(`${assetDir}/slides/slide-18.wav`, window.location.href));
    return {
      manifestOk: manifestRes.ok,
      engine: manifest.engine,
      slides: manifest.slides.length,
      r6Duration: r6Stealth1.duration || 0,
      r6Segments: r6Stealth1.segments.length,
      earlyRaidHasFootstepQuestion: earlyRaid.segments.some((segment) => segment.text.includes("伊の壱丁目") && segment.text.includes("過去にいましたか")),
      earlyRaidHasNoFootprintAnswer: earlyRaid.segments.some((segment) => segment.text.includes("過去に訪れたこともない")),
      r6HasCrisisStealth: r6Stealth1.segments.some((segment) => segment.text.includes("中盤") && segment.text.includes("奥の手の透明化")),
      r6Trace1HasDice: r6Trace1.segments.some((segment) => segment.text.includes("一歩目の移動が終わったので、痕跡ダイス")),
      r6Move2HasSecondMove: r6Stealth2.segments.some((segment) => segment.text.includes("宇四丁目から宇三丁目へ移動")),
      r6Trace2HasDice: r6Trace2.segments.some((segment) => segment.text.includes("二歩目のあとも、もう一度痕跡ダイス")),
      r6IntelHasFootstepQuestion: r6Intel.segments.some((segment) => segment.text.includes("宇四丁目") && segment.text.includes("過去に通ったことはありますか")),
      r6IntelHasFootstepAnswer: r6Intel.segments.some((segment) => segment.text.includes("透明化の一歩目で通った")),
      r7UsesNormalMove: r7Move.segments.some((segment) => segment.text.includes("通常移動")),
      r7RaidHasFootstepQuestion: r7Raid.segments.some((segment) => segment.text.includes("阿四丁目") && segment.text.includes("過去に通りましたか")),
      r7RaidHasFootstepAnswer: r7Raid.segments.some((segment) => segment.text.includes("まだ通っていない")),
      r8UsesNormalMove: r8Move.segments.some((segment) => segment.text.includes("通常移動")),
      r8ReachesTen: r8Move.segments.some((segment) => segment.text.includes("足跡は十枚")),
      coverHasWinCondition: cover.segments.some((segment) => segment.text.includes("重複しない十の街") && segment.text.includes("最後の警察手番")),
      removedEndingIdsRemain: manifest.slides.some((slide) => slide.slideId === "demo-network-final" || slide.slideId === "demo-capture"),
      finalDecisionHasR6: finalDecision.segments.some((segment) => segment.text.includes("R6") && segment.text.includes("透明化")),
      summaryHasExactRules: summary.segments.some((segment) => segment.text.includes("異なる十の街") && segment.text.includes("最後の警察手番")) && summary.segments.some((segment) => segment.text.includes("タレコミ") && segment.text.includes("内偵")),
      redundantEndingDialogue: manifest.slides.some((slide) => slide.segments.some((segment) => segment.text.includes("警察手番終了。捕まえられなかったので") || segment.text.includes("R8の突入は近かった"))),
      wavOk: wavRes.ok,
      wavBytes: Number(wavRes.headers.get("content-length") || "0")
    };
  }, demoNarrationAssetDir);
  if (!assetChecks.manifestOk) failures.push("demo manifest fetch failed");
  if (!String(assetChecks.engine || "").includes("VOICEVOX Engine")) failures.push(`demo manifest engine mismatch: ${assetChecks.engine}`);
  if (assetChecks.slides !== demoSlides.length) failures.push(`demo manifest slides ${assetChecks.slides}`);
  if (!assetChecks.earlyRaidHasFootstepQuestion || !assetChecks.earlyRaidHasNoFootprintAnswer) {
    failures.push(`early raid footstep question not reflected in manifest: ${JSON.stringify(assetChecks)}`);
  }
  if (assetChecks.r6Segments < 3 || !assetChecks.r6HasCrisisStealth) {
    failures.push(`R6 mid-game stealth feedback not reflected in manifest: ${JSON.stringify(assetChecks)}`);
  }
  if (!assetChecks.r6Trace1HasDice || !assetChecks.r6Move2HasSecondMove || !assetChecks.r6Trace2HasDice) {
    failures.push(`R6 stealth trace sequence not reflected in manifest: ${JSON.stringify(assetChecks)}`);
  }
  if (!assetChecks.r6IntelHasFootstepQuestion || !assetChecks.r6IntelHasFootstepAnswer) {
    failures.push(`R6 post-stealth intel not reflected in manifest: ${JSON.stringify(assetChecks)}`);
  }
  if (!assetChecks.r7UsesNormalMove || !assetChecks.r7RaidHasFootstepQuestion || !assetChecks.r7RaidHasFootstepAnswer) {
    failures.push(`R7 normal move and raid not reflected in manifest: ${JSON.stringify(assetChecks)}`);
  }
  if (!assetChecks.r8UsesNormalMove || !assetChecks.r8ReachesTen) failures.push(`R8 ten-card normal move not reflected in manifest: ${JSON.stringify(assetChecks)}`);
  if (!assetChecks.coverHasWinCondition) failures.push(`win condition is not explained before setup: ${JSON.stringify(assetChecks)}`);
  if (assetChecks.removedEndingIdsRemain || assetChecks.redundantEndingDialogue) failures.push(`redundant ending remains in manifest: ${JSON.stringify(assetChecks)}`);
  if (!assetChecks.finalDecisionHasR6 || !assetChecks.summaryHasExactRules) failures.push(`final decision or summary lost the core rule explanation: ${JSON.stringify(assetChecks)}`);
  if (!assetChecks.wavOk || assetChecks.wavBytes < 100000) failures.push(`R6 WAV fetch failed or too small: ${JSON.stringify(assetChecks)}`);

  await browser.close();
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`demo feedback qa ok: ${url}`);
})();
