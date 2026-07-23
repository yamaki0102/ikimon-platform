const { chromium } = require("playwright");
const { mkdir, writeFile } = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");

const fixturePath = resolve(process.argv[2] || ".visual-record-detail-ai-dedup/dedup-bird-candidates-owner.html");
const outputDirectory = resolve(process.argv[3] || ".visual-record-detail-ai-dedup/screenshots");
const viewports = [320, 375, 390, 768, 1280];

(async () => {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.CODEX_PLAYWRIGHT_CHANNEL || "chrome", headless: true });
  const results = [];
  for (const width of viewports) {
    const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 900 } });
    await page.goto(pathToFileURL(fixturePath).href, { waitUntil: "networkidle" });
    const metrics = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const undersizedTargets = [...document.querySelectorAll("a,button,input,select,textarea,summary")]
        .filter(visible)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { tag: element.tagName, text: (element.textContent || "").trim().slice(0, 60), width: rect.width, height: rect.height };
        })
        .filter((item) => item.width < 44 || item.height < 44);
      return {
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        undersizedTargets,
        mediaSlides: document.querySelectorAll(".of-media-slide").length,
        candidateComparison: Boolean(document.querySelector(".of-candidate-comparison")),
        dedupNotice: Boolean(document.querySelector("[data-media-dedup-notice]")),
      };
    });
    await page.screenshot({ path: resolve(outputDirectory, `dedup-bird-${width}.png`), fullPage: true });
    results.push({ width, ...metrics });
    await page.close();
  }

  const textPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await textPage.goto(pathToFileURL(fixturePath).href, { waitUntil: "networkidle" });
  await textPage.evaluate(() => {
    const sizes = [...document.querySelectorAll("body, body *")].map((element) => ({
      element,
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
    }));
    for (const item of sizes) {
      if (Number.isFinite(item.fontSize) && item.fontSize > 0) item.element.style.fontSize = `${item.fontSize * 2}px`;
    }
  });
  const textResize = await textPage.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  await textPage.screenshot({ path: resolve(outputDirectory, "dedup-bird-390-text-200.png"), fullPage: true });
  await textPage.close();

  const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noJsPage = await noJsContext.newPage();
  await noJsPage.goto(pathToFileURL(fixturePath).href, { waitUntil: "load" });
  const noJs = {
    mediaSlides: await noJsPage.locator(".of-media-slide").count(),
    candidateComparison: await noJsPage.locator(".of-candidate-comparison").count() === 1,
    dedupNotice: await noJsPage.locator("[data-media-dedup-notice]").count() === 1,
  };
  await noJsContext.close();
  await browser.close();

  const report = { fixturePath, outputDirectory, results, textResize, noJs };
  await writeFile(resolve(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (results.some((result) => result.horizontalOverflow || result.undersizedTargets.length > 0)
    || textResize.horizontalOverflow
    || noJs.mediaSlides !== 3
    || !noJs.candidateComparison
    || !noJs.dedupNotice) process.exitCode = 1;
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
