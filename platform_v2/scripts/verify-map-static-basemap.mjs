import assert from "node:assert/strict";
import { chromium } from "playwright";
import { buildApp } from "../src/app.ts";

const WIDTHS = [360, 375, 390, 412, 430];
const DPRS = [2, 3];
const VIEWPORT_HEIGHT = 760;

const HIDE_UI_OVERLAYS_CSS = `
  .me-start-panel,
  .me-locate-fab,
  .me-map-status,
  .me-legend,
  .me-privacy-strip,
  .me-purpose-hint,
  .maplibregl-control-container {
    visibility: hidden !important;
  }
`;

async function comparePngBuffersInPage(page, staticPng, livePng) {
  const staticB64 = `data:image/png;base64,${staticPng.toString("base64")}`;
  const liveB64 = `data:image/png;base64,${livePng.toString("base64")}`;
  return await page.evaluate(async ({ staticB64, liveB64 }) => {
    const loadImg = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    const [imgA, imgB] = await Promise.all([loadImg(staticB64), loadImg(liveB64)]);
    const w = imgA.naturalWidth;
    const h = imgA.naturalHeight;
    if (w !== imgB.naturalWidth || h !== imgB.naturalHeight) {
      throw new Error(`Dimension mismatch: ${w}x${h} vs ${imgB.naturalWidth}x${imgB.naturalHeight}`);
    }
    const readRgba = (img) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, w, h).data;
    };
    const a = readRgba(imgA);
    const b = readRgba(imgB);

    const margin = 4;
    const evalShift = (dx, dy) => {
      let sumAbs = 0;
      let mismatch = 0;
      let count = 0;
      for (let y = margin; y < h - margin; y++) {
        for (let x = margin; x < w - margin; x++) {
          const i1 = (y * w + x) * 4;
          const i2 = ((y + dy) * w + (x + dx)) * 4;
          const dr = Math.abs(a[i1] - b[i2]);
          const dg = Math.abs(a[i1 + 1] - b[i2 + 1]);
          const db = Math.abs(a[i1 + 2] - b[i2 + 2]);
          const maxCh = Math.max(dr, dg, db);
          sumAbs += (dr + dg + db) / 3;
          if (maxCh > 24) mismatch++;
          count++;
        }
      }
      return {
        dx,
        dy,
        mae: sumAbs / count,
        mismatchRatio: mismatch / count,
      };
    };

    let best = null;
    let zero = null;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const res = evalShift(dx, dy);
        if (dx === 0 && dy === 0) zero = res;
        if (!best || res.mae < best.mae) best = res;
      }
    }
    return { w, h, zero, best };
  }, { staticB64, liveB64 });
}

async function verifyViewport(browser, baseUrl, width, dpr) {
  const context = await browser.newContext({
    viewport: { width, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: dpr,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  // Hide symbol layers in live MapLibre so C1 compares basemap geometry cleanly
  await page.addInitScript(() => {
    let innerMaplibre = null;
    Object.defineProperty(window, "maplibregl", {
      configurable: true,
      get() {
        return innerMaplibre;
      },
      set(val) {
        if (val && typeof val.Map === "function" && !val.__zukanWrapped) {
          const OrigMap = val.Map;
          const WrappedMap = function (options) {
            if (options && options.style && Array.isArray(options.style.layers)) {
              options = {
                ...options,
                fadeDuration: 0,
                style: {
                  ...options.style,
                  layers: options.style.layers.map((layer) =>
                    layer && layer.type === "symbol"
                      ? { ...layer, layout: { ...(layer.layout || {}), visibility: "none" } }
                      : layer,
                  ),
                },
              };
            }
            const instance = new OrigMap(options);
            window.__zukanTestMap = instance;
            return instance;
          };
          WrappedMap.prototype = OrigMap.prototype;
          Object.setPrototypeOf(WrappedMap, OrigMap);
          val.Map = WrappedMap;
          val.__zukanWrapped = true;
        }
        innerMaplibre = val;
      },
    });
  });

  // Hold MapLibre JS momentarily so we can capture the pure static picture before live map mounts
  let releaseMaplibre;
  const maplibreHoldPromise = new Promise((resolve) => {
    releaseMaplibre = resolve;
  });
  await page.route(/\/assets\/vendor\/maplibre-gl-.*\.js$/, async (route) => {
    await maplibreHoldPromise;
    await route.continue();
  });

  await page.goto(`${baseUrl}/ja/map`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.addStyleTag({ content: HIDE_UI_OVERLAYS_CSS });

  await page.waitForFunction(() => {
    const img = document.getElementById("me-static-basemap");
    return Boolean(img && img.complete && img.naturalWidth > 0);
  }, null, { timeout: 15_000 });

  const box = await page.locator("#map-explorer").boundingBox();
  assert.ok(box && box.width === width && box.height > 300, `Unexpected #map-explorer box for ${width}x${dpr}: ${JSON.stringify(box)}`);
  const clip = {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };

  const staticPng = await page.screenshot({ clip, animations: "allow" });

  // Start rAF swap monitor for C2 before releasing MapLibre
  await page.evaluate(() => {
    window.__zukanSwapSamples = [];
    window.__zukanSwapMonitorActive = true;
    const sample = () => {
      const root = document.getElementById("map-explorer");
      const img = document.getElementById("me-static-basemap");
      const cc = root ? root.querySelector(".maplibregl-canvas-container") : null;
      const imgVisible = Boolean(img && img.parentNode && getComputedStyle(img).display !== "none" && parseFloat(getComputedStyle(img).opacity) > 0.99);
      const ccOpacity = cc ? parseFloat(getComputedStyle(cc).opacity) : 0;
      window.__zukanSwapSamples.push({
        t: performance.now(),
        imgPresent: Boolean(img && img.parentNode),
        imgVisible,
        ccOpacity,
      });
      if (window.__zukanSwapMonitorActive) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  releaseMaplibre();

  // Wait until live map is idle and static picture has been removed after fade
  await page.waitForFunction(() => {
    const img = document.getElementById("me-static-basemap");
    const root = document.getElementById("map-explorer");
    const cc = root ? root.querySelector(".maplibregl-canvas-container") : null;
    const op = cc ? parseFloat(getComputedStyle(cc).opacity) : 0;
    return Boolean(window.__zukanTestMap && !img && root && !root.hasAttribute("data-static-basemap-active") && op >= 0.99);
  }, null, { timeout: 30_000 });

  // Stop C2 monitor after a couple more frames
  await page.waitForTimeout(50);
  const swapSamples = await page.evaluate(() => {
    window.__zukanSwapMonitorActive = false;
    return window.__zukanSwapSamples;
  });

  // Verify C2: every frame during swap had either static img visible or live canvas visible (never blank)
  const blankFrames = swapSamples.filter((s) => !s.imgVisible && s.ccOpacity < 0.99);
  assert.equal(
    blankFrames.length,
    0,
    `Detected ${blankFrames.length} blank/partial-without-backdrop frames at ${width}@${dpr}x: ${JSON.stringify(blankFrames.slice(0, 3))}`,
  );

  const livePng = await page.screenshot({ clip, animations: "allow" });
  const cmp = await comparePngBuffersInPage(page, staticPng, livePng);

  await context.close();

  assert.equal(cmp.best.dx, 0, `C1 x-offset must be 0 at ${width}@${dpr}x (best=${JSON.stringify(cmp.best)}, zero=${JSON.stringify(cmp.zero)})`);
  assert.equal(cmp.best.dy, 0, `C1 y-offset must be 0 at ${width}@${dpr}x (best=${JSON.stringify(cmp.best)}, zero=${JSON.stringify(cmp.zero)})`);
  assert.ok(cmp.zero.mae < 6.0, `C1 MAE too high at ${width}@${dpr}x: ${cmp.zero.mae}`);
  assert.ok(cmp.zero.mismatchRatio < 0.05, `C1 mismatch ratio too high at ${width}@${dpr}x: ${cmp.zero.mismatchRatio}`);

  return { width, dpr, ...cmp.zero, bestDx: cmp.best.dx, bestDy: cmp.best.dy, swapSampleCount: swapSamples.length };
}

async function verifyNonDefaultDoesNotDownload(browser, baseUrl) {
  const scenarios = [
    { name: "explicit_url_viewport", url: "/ja/map?lng=138.41&lat=34.99&z=14.2", storage: null },
    { name: "non_standard_basemap", url: "/ja/map?bm=gsi", storage: null },
    {
      name: "last_location",
      url: "/ja/map",
      storage: { key: "ikimon-map-last-startup-location-v1", value: JSON.stringify({ lng: 138.45, lat: 35.01, zoom: 15, capturedAt: Date.now() }) },
    },
    {
      name: "saved_state_viewport",
      url: "/ja/map",
      storage: { key: "ikimon-map-state-v1", value: "lng=138.41&lat=34.99&z=14" },
    },
  ];
  for (const sc of scenarios) {
    const context = await browser.newContext({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 2, serviceWorkers: "block" });
    if (sc.storage) {
      await context.addInitScript(({ key, value }) => {
        localStorage.setItem(key, value);
      }, sc.storage);
    }
    const page = await context.newPage();
    const staticRequests = [];
    page.on("request", (req) => {
      if (req.url().includes("static-basemap")) staticRequests.push(req.url());
    });
    await page.goto(`${baseUrl}${sc.url}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(300);
    const hasImg = await page.evaluate(() => Boolean(document.getElementById("me-static-basemap")));
    assert.equal(hasImg, false, `${sc.name}: static basemap img must not be inserted`);
    assert.equal(staticRequests.length, 0, `${sc.name}: static basemap must not be downloaded`);
    await context.close();
  }
}

async function main() {
  let app = null;
  let baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    app = buildApp();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });

  try {
    const c1Results = [];
    for (const width of WIDTHS) {
      for (const dpr of DPRS) {
        const res = await verifyViewport(browser, baseUrl, width, dpr);
        c1Results.push(res);
        console.log("C1_C2_OK", JSON.stringify(res));
      }
    }
    await verifyNonDefaultDoesNotDownload(browser, baseUrl);
    console.log("NON_DEFAULT_OK", JSON.stringify({ checked: 4 }));
    console.log("ALL_VERIFIED", JSON.stringify({ count: c1Results.length }));
  } finally {
    await browser.close();
    if (app) await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
