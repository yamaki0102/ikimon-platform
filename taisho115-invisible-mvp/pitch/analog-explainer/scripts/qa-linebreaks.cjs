const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const slides = require("../src/slides.json");

const url = process.env.DECK_URL || "http://127.0.0.1:5178/";
const outDir = process.env.QA_OUT_DIR ? path.resolve(process.env.QA_OUT_DIR) : path.resolve(__dirname, "..", ".runtime", "linebreak-review");
fs.mkdirSync(outDir, { recursive: true });

async function openDeck(page) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".slide.active", { state: "visible", timeout: 15000 });
  await page.waitForTimeout(250);
}

const viewports = [
  { name: "desktop", width: 1366, height: 768, maxTitleLines: 3, maxHeadlineLines: 3 },
  { name: "mobile", width: 390, height: 844, maxTitleLines: 3, maxHeadlineLines: 4 }
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
  const report = [];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openDeck(page);

    for (let index = 0; index < slides.length; index += 1) {
      if (index > 0) await page.getByLabel("次のスライド").click();
      await page.waitForTimeout(260);
      const fileName = `${viewport.name}-slide-${safeName(index)}.png`;
      await page.screenshot({ path: path.join(outDir, fileName), fullPage: true });

      const metrics = await page.evaluate(() => {
        function rowsFromRange(node) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rects = [...range.getClientRects()].filter((rect) => rect.width > 1 && rect.height > 1);
          const rows = [];
          for (const rect of rects) {
            const row = rows.find((item) => Math.abs(item.top - rect.top) < 3);
            if (row) {
              row.width += rect.width;
              row.left = Math.min(row.left, rect.left);
              row.right = Math.max(row.right, rect.right);
              row.height = Math.max(row.height, rect.height);
            } else {
              rows.push({
                top: rect.top,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height
              });
            }
          }
          return rows;
        }

        function lineMetrics(selector) {
          const element = document.querySelector(`.slide.active ${selector}`);
          if (!element) return null;
          const lineNodes = [...element.querySelectorAll(".copy-line")].filter((line) => {
            const style = window.getComputedStyle(line);
            return style.display !== "none" && line.getClientRects().length > 0;
          });
          const rows = lineNodes.length
            ? lineNodes.flatMap((line) => rowsFromRange(line))
            : rowsFromRange(element);
          const elementRect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return {
            text: element.textContent.trim(),
            intendedLines: lineNodes.length || null,
            lines: rows.length,
            lastLineRatio: rows.length ? rows.at(-1).width / Math.max(elementRect.width, 1) : 0,
            width: elementRect.width,
            height: elementRect.height,
            fontSize: Number.parseFloat(style.fontSize),
            lineHeight: Number.parseFloat(style.lineHeight)
          };
        }

        const active = document.querySelector(".slide.active");
        const slide = active?.getBoundingClientRect();
        const copy = active?.querySelector(".slide-copy")?.getBoundingClientRect();
        const visual = active?.querySelector(".visual")?.getBoundingClientRect();
        return {
          title: lineMetrics("h1"),
          headline: lineMetrics("h2"),
          body: lineMetrics(".body-copy"),
          slide: slide ? { width: slide.width, height: slide.height, bottom: slide.bottom } : null,
          copy: copy ? { bottom: copy.bottom, height: copy.height } : null,
          visual: visual ? { bottom: visual.bottom, height: visual.height } : null,
          viewportHeight: window.innerHeight,
          documentHeight: document.documentElement.scrollHeight,
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth
        };
      });

      const slideId = slides[index].id;
      report.push({ viewport: viewport.name, index: index + 1, slideId, screenshot: fileName, ...metrics });

      if (metrics.horizontalOverflow > 2) {
        failures.push(`${viewport.name} slide ${index + 1}: horizontal overflow ${metrics.horizontalOverflow}`);
      }
      if (!metrics.title) {
        failures.push(`${viewport.name} slide ${index + 1}: title missing`);
      } else if (metrics.title.intendedLines && metrics.title.lines !== metrics.title.intendedLines) {
        failures.push(`${viewport.name} slide ${index + 1}: title wrapped ${metrics.title.lines}/${metrics.title.intendedLines}`);
      } else if (!metrics.title.intendedLines && metrics.title.lines > viewport.maxTitleLines) {
        failures.push(`${viewport.name} slide ${index + 1}: title line count ${metrics.title.lines}`);
      }
      if (!metrics.headline) {
        failures.push(`${viewport.name} slide ${index + 1}: headline missing`);
      } else if (metrics.headline.intendedLines && metrics.headline.lines !== metrics.headline.intendedLines) {
        failures.push(`${viewport.name} slide ${index + 1}: headline wrapped ${metrics.headline.lines}/${metrics.headline.intendedLines}`);
      } else if (!metrics.headline.intendedLines && metrics.headline.lines > viewport.maxHeadlineLines) {
        failures.push(`${viewport.name} slide ${index + 1}: headline line count ${metrics.headline.lines}`);
      }
      if (viewport.name === "mobile" && metrics.body && metrics.body.lines > 5) {
        failures.push(`${viewport.name} slide ${index + 1}: body line count ${metrics.body.lines}`);
      }
      if (metrics.title?.lines > 1 && metrics.title.lastLineRatio < 0.18) {
        failures.push(`${viewport.name} slide ${index + 1}: title orphan line ratio ${metrics.title.lastLineRatio.toFixed(2)}`);
      }
      if (metrics.headline?.lines > 1 && metrics.headline.lastLineRatio < 0.18) {
        failures.push(`${viewport.name} slide ${index + 1}: headline orphan line ratio ${metrics.headline.lastLineRatio.toFixed(2)}`);
      }
    }
  }

  fs.writeFileSync(path.join(outDir, "layout-report.json"), JSON.stringify(report, null, 2));
  await browser.close();

  const summary = report.map((item) => ({
    viewport: item.viewport,
    slide: item.index,
    id: item.slideId,
    titleLines: item.title?.lines,
    headlineLines: item.headline?.lines,
    bodyLines: item.body?.lines,
    screenshot: item.screenshot
  }));
  console.table(summary);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`linebreak qa ok: ${url}`);
})();
