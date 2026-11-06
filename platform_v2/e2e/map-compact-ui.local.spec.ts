import { expect, test } from "@playwright/test";
import { installMapLibreStubForSmoke, suppressMapLibreForSmoke } from "./support/staging.js";

type SurfaceRect = {
  label: string;
  selector: string;
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  visible: boolean;
};

function intersectionArea(a: SurfaceRect, b: SurfaceRect): number {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
  return width * height;
}

test("map start controls stay compact while key actions remain available", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: process.env.STAGING_BASE_URL ?? "http://127.0.0.1:4322",
    serviceWorkers: "block",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await installMapLibreStubForSmoke(page);
  await suppressMapLibreForSmoke(page);

  await page.goto("/ja/map", { waitUntil: "domcontentloaded" });
  const startPanel = page.getByTestId("map-start-panel");
  await expect(startPanel).toBeVisible();
  await expect(startPanel).toHaveClass(/is-collapsed/);
  await expect(page.getByRole("tab", { name: "近くの記録" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "季節" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "ガイド" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "記録の空白" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "雨雲" })).toBeVisible();
  await expect(page.locator(".me-layer-key")).toHaveCount(0);
  await expect(startPanel.getByText("記録・ガイド")).toBeVisible();
  const panelBox = await startPanel.boundingBox();
  expect(panelBox?.width).toBeLessThanOrEqual(230);
  expect(panelBox?.height).toBeLessThanOrEqual(54);
  await startPanel.getByRole("button", { name: "地図メニューを開く" }).click();
  await expect(startPanel).not.toHaveClass(/is-collapsed/);
  await expect(startPanel.locator(".me-start-panel-location")).toBeVisible();
  await expect(startPanel.getByRole("link", { name: "記録" })).toBeVisible();
  await expect(startPanel.getByRole("link", { name: "ガイド" })).toBeVisible();
  await expect(startPanel.getByRole("link", { name: "散策" })).toBeVisible();

  const legend = page.locator("#me-legend");
  await expect(legend).toBeVisible();
  await expect(legend).toHaveClass(/is-collapsed/);
  const legendBox = await legend.boundingBox();
  expect(legendBox?.width).toBeLessThanOrEqual(50);
  expect(legendBox?.height).toBeLessThanOrEqual(48);

  const mapStatus = page.locator("#me-map-status");
  await expect(mapStatus).toBeVisible();
  await expect(mapStatus).not.toContainText("近くを探索中");
  await expect(mapStatus).not.toContainText("少し広げると");

  await page.screenshot({
    path: testInfo.outputPath("map-compact-start.png"),
    fullPage: false,
  });
  await expect(page.getByTestId("map-purpose-hint")).toBeHidden();
  await context.close();
});

test("mobile map bottom surfaces do not cover each other", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: process.env.STAGING_BASE_URL ?? "http://127.0.0.1:4322",
    serviceWorkers: "block",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await installMapLibreStubForSmoke(page);
  await suppressMapLibreForSmoke(page);

  await page.goto("/ja/map?tab=guide&lng=137.8589&lat=34.7219&z=16", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".global-record-launcher")).toBeVisible();
  await expect(page.locator(".me-layer-key")).toHaveCount(0);

  await page.evaluate(() => {
    const trail = document.getElementById("me-own-trail");
    const list = document.getElementById("me-own-trail-list");
    if (!trail || !list) return;
    trail.classList.remove("is-hidden");
    trail.setAttribute("aria-hidden", "false");
    list.innerHTML = [
      '<button type="button" class="me-own-trail-item"><span><strong>名前待ち</strong><small>自分にだけ表示</small></span></button>',
      '<button type="button" class="me-own-trail-item"><span><strong>名前待ち</strong><small>自分にだけ表示</small></span></button>',
      '<button type="button" class="me-own-trail-item"><span><strong>名前待ち</strong><small>自分にだけ表示</small></span></button>',
    ].join("");
  });

  await expect(page.locator("#me-own-trail")).toBeVisible();

  const rects = await page.evaluate<SurfaceRect[]>(() => {
    const surfaces = [
      { selector: "#me-own-trail", label: "own photo tray" },
      { selector: ".global-record-launcher", label: "global record launcher" },
      { selector: ".me-layer-hint:not(.is-hidden)", label: "layer hint" },
      { selector: ".me-filter-panel:not(.is-hidden)", label: "filter panel" },
      { selector: ".me-bottom-sheet:not(.is-hidden):not([aria-hidden='true'])", label: "bottom sheet" },
    ];
    return surfaces.map(({ selector, label }) => {
      const element = document.querySelector<HTMLElement>(selector);
      const box = element?.getBoundingClientRect();
      const style = element ? window.getComputedStyle(element) : null;
      const visible = Boolean(
        element
        && style
        && style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || "1") > 0
        && box
        && box.width > 0
        && box.height > 0
      );
      return {
        label,
        selector,
        x: Math.round(box?.x ?? 0),
        y: Math.round(box?.y ?? 0),
        width: Math.round(box?.width ?? 0),
        height: Math.round(box?.height ?? 0),
        right: Math.round(box?.right ?? 0),
        bottom: Math.round(box?.bottom ?? 0),
        visible,
      };
    });
  });

  const visibleRects = rects.filter((rect) => rect.visible);
  const overlaps: string[] = [];
  for (let i = 0; i < visibleRects.length; i += 1) {
    for (let j = i + 1; j < visibleRects.length; j += 1) {
      const area = intersectionArea(visibleRects[i], visibleRects[j]);
      if (area > 0) {
        overlaps.push(`${visibleRects[i].label} overlaps ${visibleRects[j].label} by ${area}px2`);
      }
    }
  }

  expect(overlaps, JSON.stringify(visibleRects, null, 2)).toEqual([]);
  await context.close();
});

for (const width of [320, 375, 390, 1280]) {
  test(`map attribution stays visible and clear of bottom UI at ${width}px`, async ({ browser }) => {
    const mobile = width < 900;
    const context = await browser.newContext({
      baseURL: process.env.STAGING_BASE_URL ?? "http://127.0.0.1:4322",
      serviceWorkers: "block",
      viewport: { width, height: mobile ? 844 : 800 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    await installMapLibreStubForSmoke(page);
    await suppressMapLibreForSmoke(page);

    await page.goto("/ja/map", { waitUntil: "domcontentloaded" });
    await page.locator("#me-map").evaluate((map) => {
      const position = document.createElement("div");
      position.className = "maplibregl-ctrl-bottom-right";
      Object.assign(position.style, { position: "absolute", right: "0", bottom: "0" });
      const attribution = document.createElement("div");
      attribution.className = "maplibregl-ctrl maplibregl-ctrl-attrib";
      attribution.innerHTML = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>';
      position.appendChild(attribution);
      map.appendChild(position);
    });

    const attribution = page.locator(".maplibregl-ctrl-attrib");
    await expect(attribution).toBeVisible();
    await expect(attribution).toContainText("OpenStreetMap contributors");
    const attributionBox = await attribution.boundingBox();
    expect(attributionBox).not.toBeNull();
    expect(attributionBox!.x).toBeGreaterThanOrEqual(0);
    expect(attributionBox!.x + attributionBox!.width).toBeLessThanOrEqual(width);

    const launcher = page.locator(".global-record-launcher:visible");
    if (await launcher.count()) {
      const launcherBox = await launcher.boundingBox();
      expect(launcherBox).not.toBeNull();
      const attributionRect = { label: "attribution", selector: ".maplibregl-ctrl-attrib", ...attributionBox!, right: attributionBox!.x + attributionBox!.width, bottom: attributionBox!.y + attributionBox!.height, visible: true };
      const launcherRect = { label: "launcher", selector: ".global-record-launcher", ...launcherBox!, right: launcherBox!.x + launcherBox!.width, bottom: launcherBox!.y + launcherBox!.height, visible: true };
      expect(intersectionArea(attributionRect, launcherRect)).toBe(0);
    }
    if (mobile) {
      const sheet = page.locator(".me-bottom-sheet").first();
      await sheet.evaluate((element) => {
        element.classList.remove("is-hidden");
        element.classList.add("is-open");
        element.setAttribute("aria-hidden", "false");
      });
      await expect(sheet).toBeVisible();
      const sheetBox = await sheet.boundingBox();
      const currentAttributionBox = await attribution.boundingBox();
      expect(sheetBox).not.toBeNull();
      expect(currentAttributionBox).not.toBeNull();
      const attributionRect = { label: "attribution", selector: ".maplibregl-ctrl-attrib", ...currentAttributionBox!, right: currentAttributionBox!.x + currentAttributionBox!.width, bottom: currentAttributionBox!.y + currentAttributionBox!.height, visible: true };
      const sheetRect = { label: "bottom sheet", selector: ".me-bottom-sheet", ...sheetBox!, right: sheetBox!.x + sheetBox!.width, bottom: sheetBox!.y + sheetBox!.height, visible: true };
      expect(intersectionArea(attributionRect, sheetRect)).toBe(0);
    }
    await context.close();
  });
}
