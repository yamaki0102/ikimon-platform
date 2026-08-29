const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const slides = require("../src/slides.json");

const url = process.env.DECK_URL || "http://127.0.0.1:5178/";
const outDir = process.env.QA_OUT_DIR ? path.resolve(process.env.QA_OUT_DIR) : path.resolve(__dirname, "..", ".runtime", "presentation-mode");
fs.mkdirSync(outDir, { recursive: true });

const landscapeViewports = [
  { name: "iphone-se", width: 667, height: 375, minSlideWidth: 610, minSlideHeight: 340 }
];

function safeName(index) {
  return String(index + 1).padStart(2, "0");
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() =>
    chromium.launch({ channel: "msedge", headless: true })
  );
  const page = await browser.newPage();
  const failures = [];

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(url, { waitUntil: "networkidle" });

  const promptVisible = await page.locator(".mobile-fullscreen-prompt").isVisible();
  const promptText = await page.locator(".mobile-fullscreen-prompt").textContent().catch(() => "");
  if (!promptVisible) failures.push("mobile fullscreen prompt is not visible on iPhone SE portrait");
  if (!promptText?.includes("横長フルスクリーン")) failures.push(`mobile fullscreen prompt text missing: ${promptText}`);

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByLabel("全画面で見る").click();
  await page.waitForTimeout(500);
  const desktopInitialMode = await page.evaluate(() => {
    const shell = document.querySelector(".deck-shell");
    const toolbar = document.querySelector(".deck-toolbar");
    const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
    const toolbarRect = toolbar?.getBoundingClientRect();
    const slideRect = document.querySelector(".slide.active")?.getBoundingClientRect();
    return {
      inMode: shell?.classList.contains("presentation-mode") || shell?.classList.contains("fullscreen-active"),
      chromeHidden: shell?.classList.contains("presentation-chrome-hidden"),
      toolbarPosition: toolbarStyle?.position,
      toolbarOpacity: toolbarStyle ? Number.parseFloat(toolbarStyle.opacity) : null,
      toolbarTop: toolbarRect?.top,
      slideCenterDeltaX: slideRect ? Math.abs(slideRect.left + slideRect.width / 2 - window.innerWidth / 2) : null,
      slideCenterDeltaY: slideRect ? Math.abs(slideRect.top + slideRect.height / 2 - window.innerHeight / 2) : null
    };
  });
  if (!desktopInitialMode.inMode) failures.push(`desktop: fullscreen control did not enter presentation mode`);
  if (
    !desktopInitialMode.chromeHidden ||
    desktopInitialMode.toolbarPosition !== "fixed" ||
    (desktopInitialMode.toolbarOpacity ?? 1) > 0.05
  ) {
    failures.push(`desktop: fullscreen toolbar is not hidden by default: ${JSON.stringify(desktopInitialMode)}`);
  }
  if ((desktopInitialMode.slideCenterDeltaX ?? 999) > 3 || (desktopInitialMode.slideCenterDeltaY ?? 999) > 3) {
    failures.push(`desktop: fullscreen slide is not centered: ${JSON.stringify(desktopInitialMode)}`);
  }
  await page.mouse.move(120, 80);
  await page.waitForTimeout(240);
  const desktopMouseRevealState = await page.evaluate(() => {
    const shell = document.querySelector(".deck-shell");
    const toolbar = document.querySelector(".deck-toolbar");
    const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
    return {
      chromeVisible: shell?.classList.contains("presentation-chrome-visible"),
      toolbarOpacity: toolbarStyle ? Number.parseFloat(toolbarStyle.opacity) : null
    };
  });
  if (!desktopMouseRevealState.chromeVisible || (desktopMouseRevealState.toolbarOpacity ?? 0) < 0.85) {
    failures.push(`desktop: mouse movement did not reveal fullscreen toolbar: ${JSON.stringify(desktopMouseRevealState)}`);
  }
  await page.waitForTimeout(3100);
  const desktopHiddenAfterIdle = await page.evaluate(() => {
    const shell = document.querySelector(".deck-shell");
    const toolbar = document.querySelector(".deck-toolbar");
    const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
    return {
      chromeHidden: shell?.classList.contains("presentation-chrome-hidden"),
      toolbarOpacity: toolbarStyle ? Number.parseFloat(toolbarStyle.opacity) : null
    };
  });
  if (!desktopHiddenAfterIdle.chromeHidden || (desktopHiddenAfterIdle.toolbarOpacity ?? 1) > 0.05) {
    failures.push(`desktop: fullscreen toolbar did not auto-hide after idle: ${JSON.stringify(desktopHiddenAfterIdle)}`);
  }

  for (const viewport of landscapeViewports) {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator(".mobile-fullscreen-prompt").click();
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(500);

    const initialMode = await page.evaluate(() => {
      const shell = document.querySelector(".deck-shell");
      const toolbar = document.querySelector(".deck-toolbar");
      const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
      return {
        inMode: shell?.classList.contains("presentation-mode") || shell?.classList.contains("fullscreen-active"),
        chromeHidden: shell?.classList.contains("presentation-chrome-hidden"),
        toolbarOpacity: toolbarStyle ? Number.parseFloat(toolbarStyle.opacity) : null
      };
    });
    if (!initialMode.inMode) failures.push(`${viewport.name}: prompt did not enter presentation mode`);
    if (!initialMode.chromeHidden || (initialMode.toolbarOpacity ?? 1) > 0.05) {
      failures.push(`${viewport.name}: presentation toolbar is not hidden by default: ${JSON.stringify(initialMode)}`);
    }

    if (viewport.name === "iphone-se") {
      await page.mouse.click(Math.floor(viewport.width / 2), Math.floor(viewport.height / 2));
      await page.waitForTimeout(240);
      const revealState = await page.evaluate(() => {
        const shell = document.querySelector(".deck-shell");
        const toolbar = document.querySelector(".deck-toolbar");
        const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
        return {
          chromeVisible: shell?.classList.contains("presentation-chrome-visible"),
          toolbarOpacity: toolbarStyle ? Number.parseFloat(toolbarStyle.opacity) : null
        };
      });
      if (!revealState.chromeVisible || (revealState.toolbarOpacity ?? 0) < 0.85) {
        failures.push(`tap did not reveal presentation toolbar: ${JSON.stringify(revealState)}`);
      }
      await page.waitForTimeout(3100);
      const hiddenAfterIdle = await page.evaluate(() => {
        const shell = document.querySelector(".deck-shell");
        const toolbar = document.querySelector(".deck-toolbar");
        const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
        return {
          chromeHidden: shell?.classList.contains("presentation-chrome-hidden"),
          toolbarOpacity: toolbarStyle ? Number.parseFloat(toolbarStyle.opacity) : null
        };
      });
      if (!hiddenAfterIdle.chromeHidden || (hiddenAfterIdle.toolbarOpacity ?? 1) > 0.05) {
        failures.push(`toolbar did not auto-hide after idle: ${JSON.stringify(hiddenAfterIdle)}`);
      }
      await page.mouse.move(28, 30);
      await page.waitForTimeout(240);
      const mouseRevealState = await page.evaluate(() => {
        const shell = document.querySelector(".deck-shell");
        const toolbar = document.querySelector(".deck-toolbar");
        const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
        return {
          chromeVisible: shell?.classList.contains("presentation-chrome-visible"),
          toolbarOpacity: toolbarStyle ? Number.parseFloat(toolbarStyle.opacity) : null
        };
      });
      if (!mouseRevealState.chromeVisible || (mouseRevealState.toolbarOpacity ?? 0) < 0.85) {
        failures.push(`mouse movement did not reveal presentation toolbar: ${JSON.stringify(mouseRevealState)}`);
      }
      await page.waitForTimeout(3100);
    }

    for (let index = 0; index < slides.length; index += 1) {
      if (index > 0) {
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(300);
      }
      const fileName = `${viewport.name}-landscape-slide-${safeName(index)}.png`;
      await page.screenshot({ path: path.join(outDir, fileName), fullPage: false });

      const metrics = await page.evaluate(() => {
        const shell = document.querySelector(".deck-shell");
        const active = document.querySelector(".slide.active");
        const slide = active?.getBoundingClientRect();
        const copy = active?.querySelector(".slide-copy");
        const visual = active?.querySelector(".visual");
        const copyRect = copy?.getBoundingClientRect();
        const visualRect = visual?.getBoundingClientRect();
        const toolbar = document.querySelector(".deck-toolbar");
        const toolbarStyle = toolbar ? window.getComputedStyle(toolbar) : null;
        const board = active?.querySelector(".network-board")?.getBoundingClientRect();
        const gauge = active?.querySelector(".gauge-card")?.getBoundingClientRect();
        const overlap =
          board && gauge
            ? Math.max(0, Math.min(board.right, gauge.right) - Math.max(board.left, gauge.left)) *
              Math.max(0, Math.min(board.bottom, gauge.bottom) - Math.max(board.top, gauge.top))
            : 0;
        return {
          slideId: active?.getAttribute("data-slide-id"),
          inMode: shell?.classList.contains("presentation-mode") || shell?.classList.contains("fullscreen-active"),
          chromeHidden: shell?.classList.contains("presentation-chrome-hidden"),
          toolbarOpacity: toolbarStyle ? Number.parseFloat(toolbarStyle.opacity) : null,
          slide: slide ? { width: slide.width, height: slide.height, top: slide.top, bottom: slide.bottom } : null,
          copy: copyRect ? { width: copyRect.width, height: copyRect.height, top: copyRect.top } : null,
          visual: visualRect ? { width: visualRect.width, height: visualRect.height, top: visualRect.top } : null,
          copyOverflow: copy ? copy.scrollHeight - copy.clientHeight : 0,
          visualOverflow: visual ? visual.scrollHeight - visual.clientHeight : 0,
          networkOverlap: overlap,
          documentOverflowX: document.documentElement.scrollWidth - window.innerWidth,
          documentOverflowY: document.documentElement.scrollHeight - window.innerHeight,
          visibleText: Boolean(active?.textContent?.trim())
        };
      });

      const label = `${viewport.name} slide ${index + 1}`;
      if (!metrics.inMode) failures.push(`${label}: presentation mode class missing`);
      if (!metrics.chromeHidden || (metrics.toolbarOpacity ?? 1) > 0.05) failures.push(`${label}: toolbar visible by default`);
      if (!metrics.slide || metrics.slide.width < viewport.minSlideWidth || metrics.slide.height < viewport.minSlideHeight) {
        failures.push(`${label}: slide frame too small ${JSON.stringify(metrics.slide)}`);
      }
      if (!metrics.copy || !metrics.visual || metrics.copy.width < 200 || metrics.visual.width < 200) {
        failures.push(`${label}: two-column layout missing ${JSON.stringify({ copy: metrics.copy, visual: metrics.visual })}`);
      }
      if (metrics.copy && metrics.visual && Math.abs(metrics.copy.top - metrics.visual.top) > 4) {
        failures.push(`${label}: copy/visual misaligned ${JSON.stringify({ copy: metrics.copy, visual: metrics.visual })}`);
      }
      if (metrics.copyOverflow > 2) failures.push(`${label}: copy clipped by ${metrics.copyOverflow}px`);
      if (metrics.visualOverflow > 10) failures.push(`${label}: visual clipped by ${metrics.visualOverflow}px`);
      if (metrics.documentOverflowX > 2) failures.push(`${label}: horizontal overflow ${metrics.documentOverflowX}`);
      if (metrics.documentOverflowY > 2) failures.push(`${label}: vertical overflow ${metrics.documentOverflowY}`);
      if (!metrics.visibleText) failures.push(`${label}: visible text missing`);
      if (metrics.slideId === "network" && metrics.networkOverlap > 1) {
        failures.push(`${label}: network gauge overlaps board area ${metrics.networkOverlap}px2`);
      }
    }
  }

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByLabel("音声つき自動再生").click();
  await page.waitForTimeout(500);
  const autoplayMode = await page.evaluate(() => {
    const shell = document.querySelector(".deck-shell");
    return {
      inMode: shell?.classList.contains("presentation-mode"),
      chromeHidden: shell?.classList.contains("presentation-chrome-hidden")
    };
  });
  if (!autoplayMode.inMode || !autoplayMode.chromeHidden) {
    failures.push(`autoplay button did not enter hidden-chrome presentation mode: ${JSON.stringify(autoplayMode)}`);
  }

  await browser.close();
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`presentation mode qa ok: ${url}`);
})();
