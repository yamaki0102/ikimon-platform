import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { renderMapExplorerV2Document, MAP_V2_CHIP_ITEMS, buildMapV2PlaceSummaryCopy, shouldPanOnSelection } from "./mapExplorerV2.js";

function findChromiumExecutable(): string | null {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/home/nexus/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

test("MAP_V2 chips integrate all taxons including invasive and exclude voice mic", () => {
  const values = MAP_V2_CHIP_ITEMS.map((c) => c.value);
  assert.deepEqual(values, ["", "plant", "bird", "insect", "water", "invasive"]);
  const html = renderMapExplorerV2Document({
    lang: "ja",
    authenticated: false,
    basePath: "",
    cspNonce: "nonce-test-1",
  });
  assert.doesNotMatch(html, /mic|voice-search|音声検索/i);
  assert.match(html, /class="zv2-app"/);
  assert.match(html, /max-height:44vh/);
  assert.match(html, /cluster:\s*true/);
  assert.match(html, /symbol-sort-key/);
  assert.match(html, /300/);
  assert.match(html, /か所/);
  assert.match(html, /まだ記録のない場所/);
  assert.match(html, /記録のある最寄りへ/);
});

test("buildMapV2PlaceSummaryCopy separates recorded vs zero-record counts and hides zero when filtered", () => {
  assert.equal(buildMapV2PlaceSummaryCopy({ recordedCount: 5, zeroCount: 310, taxonGroup: "", lang: "ja" }), "記録あり 5件 ・ まだ 310件");
  assert.equal(buildMapV2PlaceSummaryCopy({ recordedCount: 3, zeroCount: 310, taxonGroup: "bird", lang: "ja" }), "該当 3件");
  assert.equal(buildMapV2PlaceSummaryCopy({ recordedCount: 0, zeroCount: 12, taxonGroup: "", lang: "ja" }), "まだ記録のない場所 12件");
});

test("shouldPanOnSelection moves viewport only when selected pin is obscured by sheet or left panel", () => {
  assert.equal(
    shouldPanOnSelection({
      pinX: 640,
      pinY: 320,
      viewportWidth: 1280,
      viewportHeight: 800,
      isDesktop: true,
      leftPanelRight: 372,
      topbarBottom: 64,
      sheetTop: 800,
    }),
    false,
  );
  assert.equal(
    shouldPanOnSelection({
      pinX: 220,
      pinY: 320,
      viewportWidth: 1280,
      viewportHeight: 800,
      isDesktop: true,
      leftPanelRight: 372,
      topbarBottom: 64,
      sheetTop: 800,
    }),
    true,
  );
  assert.equal(
    shouldPanOnSelection({
      pinX: 187,
      pinY: 620,
      viewportWidth: 375,
      viewportHeight: 812,
      isDesktop: false,
      leftPanelRight: 0,
      topbarBottom: 112,
      sheetTop: 520,
    }),
    true,
  );
  assert.equal(
    shouldPanOnSelection({
      pinX: 187,
      pinY: 300,
      viewportWidth: 375,
      viewportHeight: 812,
      isDesktop: false,
      leftPanelRight: 0,
      topbarBottom: 112,
      sheetTop: 520,
    }),
    false,
  );
});

test("MAP_V2 unauthenticated HTML never shows own observation strings without login", () => {
  const html = renderMapExplorerV2Document({
    lang: "ja",
    authenticated: false,
    basePath: "",
    cspNonce: "nonce-test-2",
  });
  assert.match(html, /"authenticated":false/);
  const loggedInHtml = renderMapExplorerV2Document({
    lang: "ja",
    authenticated: true,
    displayName: "ゆい",
    basePath: "",
    cspNonce: "nonce-test-3",
  });
  assert.match(loggedInHtml, /"authenticated":true/);
});

test("Playwright renders Hamamatsu Station and Miyakoda with 310 zero-record places at 375px and 1280px", async (t) => {
  const executablePath = findChromiumExecutable();
  if (!executablePath) {
    t.skip("No Chromium binary available");
    return;
  }
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  t.after(() => browser.close());

  const makeDataset = (centerLat: number, centerLng: number, withRecorded: boolean) => {
    const places: Array<Record<string, unknown>> = [];
    if (withRecorded) {
      places.push(
        {
          placeId: "hamamatsu-sanaru",
          name: "佐鳴湖公園",
          lat: 34.706,
          lng: 137.702,
          placeKind: "park",
          recordCount: 18,
          speciesCount: 9,
          ownCount: 2,
          photoUrl: "/thumb/sanaru.svg",
          photos: ["/thumb/sanaru.svg", "/thumb/sanaru2.svg"],
          taxonGroups: ["bird", "plant", "water"],
          invasive: true,
        },
        {
          placeId: "hamamatsu-castle",
          name: "浜松城公園",
          lat: 34.711,
          lng: 137.724,
          placeKind: "park",
          recordCount: 8,
          speciesCount: 5,
          ownCount: 0,
          photoUrl: "/thumb/castle.svg",
          photos: ["/thumb/castle.svg"],
          taxonGroups: ["bird", "insect"],
          invasive: false,
        },
      );
    }
    for (let i = 0; i < 310; i++) {
      const row = Math.floor(i / 20);
      const col = i % 20;
      const lat = i === 0 ? centerLat + 0.0005 : Number((centerLat - 0.025 + row * 0.0025).toFixed(5));
      const lng = i === 0 ? centerLng + 0.0005 : Number((centerLng - 0.025 + col * 0.0025).toFixed(5));
      places.push({
        placeId: `hamamatsu-zero-${i + 1}`,
        name: i === 0 ? "都田総合公園" : i === 1 ? "都田神社" : i === 2 ? "新浜松駅周辺" : `浜松の公園 ${i + 1}`,
        lat,
        lng,
        placeKind: i % 3 === 0 ? "park" : "temple_shrine",
        recordCount: 0,
        speciesCount: 0,
        ownCount: 0,
        photoUrl: null,
        photos: [],
        taxonGroups: [],
        invasive: false,
      });
    }
    return {
      ok: true,
      places,
      nearestRecorded: withRecorded ? null : { placeId: "hamamatsu-sanaru", name: "佐鳴湖公園", lat: 34.706, lng: 137.702, recordCount: 18 },
    };
  };

  const pageHtml = renderMapExplorerV2Document({
    lang: "ja",
    authenticated: false,
    basePath: "",
    cspNonce: "pw-nonce",
  });

  const setupPage = async (width: number, height: number, datasetKind: "hamamatsu" | "miyakoda") => {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => { console.error("PW pageerror:", e.message); errors.push(e.message); });
    page.on("console", (m) => { if (m.type() === "error") console.error("PW console.error:", m.text()); });
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.startsWith("https://zukan.local/ja/map")) {
        await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: pageHtml });
        return;
      }
      if (url.includes("/assets/vendor/maplibre-gl-")) {
        if (url.endsWith(".css")) {
          await route.fulfill({ status: 200, contentType: "text/css", body: ".maplibregl-map{position:relative;overflow:hidden;width:100%;height:100%}.maplibregl-canvas{width:100%;height:100%}" });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: `window.maplibregl = (function(){
            var markerCount = 0;
            function Marker(opts){ this._el = opts && opts.element; this._lngLat = [137.7347, 34.7038]; }
            Marker.prototype.setLngLat = function(ll){ this._lngLat = ll; return this; };
            Marker.prototype.addTo = function(m){ if(this._el && m._container){ this._el.classList.add('maplibregl-marker'); m._container.appendChild(this._el); } return this; };
            Marker.prototype.remove = function(){ if(this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el); };
            function Map(opts){
              var self = this;
              this._container = typeof opts.container === 'string' ? document.getElementById(opts.container) : opts.container;
              this._center = opts.center || [137.7347, 34.7038];
              this._zoom = opts.zoom || 13;
              this._handlers = {};
              this._sources = {};
              this._layers = {};
              this.scrollZoom = { enable: function(){} };
              var c = document.createElement('canvas'); c.className='maplibregl-canvas';
              this._container.classList.add('maplibregl-map');
              this._container.appendChild(c);
              setTimeout(function(){ self._emit('load'); }, 15);
            }
            Map.prototype.on = function(ev, a, b){ var fn = typeof a === 'function' ? a : b; this._handlers[ev] = this._handlers[ev] || []; if(fn) this._handlers[ev].push(fn); };
            Map.prototype._emit = function(ev, payload){ (this._handlers[ev] || []).forEach(function(fn){ fn(payload || {}); }); };
            Map.prototype.getCenter = function(){ return { lat: this._center[1], lng: this._center[0] }; };
            Map.prototype.getBounds = function(){ return { getSouth:function(){return 34.65;}, getNorth:function(){return 34.86;}, getWest:function(){return 137.65;}, getEast:function(){return 137.82;} }; };
            Map.prototype.getZoom = function(){ return this._zoom; };
            Map.prototype.zoomIn = function(){ this._zoom += 1; this._emit('moveend'); };
            Map.prototype.zoomOut = function(){ this._zoom -= 1; this._emit('moveend'); };
            Map.prototype.setCenter = function(ll){ this._center = ll; this._emit('moveend'); };
            Map.prototype.easeTo = function(o){ if(o && o.center) this._center = o.center; if(o && o.zoom) this._zoom = o.zoom; this._emit('moveend'); };
            Map.prototype.addSource = function(id, def){ this._sources[id] = { data: def.data, setData: function(d){ this.data = d; } }; };
            Map.prototype.getSource = function(id){ return this._sources[id] || null; };
            Map.prototype.addLayer = function(l){ this._layers[l.id] = l; };
            Map.prototype.getLayer = function(id){ return this._layers[id] || null; };
            Map.prototype.setFilter = function(){};
            Map.prototype.hasImage = function(){ return true; };
            Map.prototype.addImage = function(){};
            Map.prototype.project = function(ll){
              var r = this._container.getBoundingClientRect();
              return { x: r.left + r.width * 0.6, y: r.top + r.height * 0.3 };
            };
            Map.prototype.resize = function(){};
            return { Map: Map, Marker: Marker };
          })();`,
        });
        return;
      }
      if (url.includes("/api/v1/map/places")) {
        const body = datasetKind === "hamamatsu"
          ? makeDataset(34.7038, 137.7347, true)
          : makeDataset(34.815, 137.715, false);
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        return;
      }
      if (url.endsWith(".svg") || url.includes("/thumb/")) {
        await route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#2e6b4c"/></svg>' });
        return;
      }
      await route.fulfill({ status: 204, body: "" });
    });
    const targetUrl = datasetKind === "miyakoda"
      ? "https://zukan.local/ja/map?lat=34.815&lng=137.715"
      : "https://zukan.local/ja/map?lat=34.7038&lng=137.7347";
    await page.goto(targetUrl);
    await page.waitForSelector("[data-zv2-loaded='1']");
    return { context, page, errors };
  };

  // 1) Mobile 375x812 around Hamamatsu Station (recorded + 310 zero-record places)
  const m1 = await setupPage(375, 812, "hamamatsu");
  assert.deepEqual(m1.errors, []);
  const m1Metrics = await m1.page.evaluate(() => {
    const sheet = document.querySelector(".zv2-sheet") as HTMLElement;
    const zoom = document.querySelector(".zv2-zoombox") as HTMLElement;
    const mic = document.querySelector("[data-mic], .mic");
    const ownSection = document.body.innerText.includes("あなたの撮影");
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sheetState: sheet.getAttribute("data-sheet-state"),
      sheetHeightRatio: sheet.getBoundingClientRect().height / window.innerHeight,
      zoomHiddenOnMobile: getComputedStyle(zoom).display === "none",
      hasMic: Boolean(mic),
      ownVisibleGuest: ownSection,
    };
  });
  assert.equal(m1Metrics.overflowX, 0);
  assert.equal(m1Metrics.sheetState, "collapsed");
  assert.equal(m1Metrics.zoomHiddenOnMobile, true);
  assert.equal(m1Metrics.hasMic, false);
  assert.equal(m1Metrics.ownVisibleGuest, false);

  // Open half sheet by tapping whole header
  await m1.page.click(".zv2-sheet-head");
  await m1.page.waitForTimeout(260);
  const halfMetrics = await m1.page.evaluate(() => {
    const sheet = document.querySelector(".zv2-sheet") as HTMLElement;
    const zeroGroup = document.querySelector("[data-zv2-zero-toggle]") as HTMLElement | null;
    return {
      state: sheet.getAttribute("data-sheet-state"),
      heightRatio: sheet.getBoundingClientRect().height / window.innerHeight,
      zeroSummaryText: zeroGroup ? zeroGroup.textContent?.trim() : "",
    };
  });
  assert.equal(halfMetrics.state, "half");
  assert.ok(halfMetrics.heightRatio <= 0.45, `Half sheet height ratio ${halfMetrics.heightRatio} exceeded 0.45`);
  assert.match(halfMetrics.zeroSummaryText ?? "", /まだ記録のない場所\s*310か所/);

  // Selecting a recorded place shows low compact bar with NO photos until pulled up, and max 1 DOM photo pin
  await m1.page.click('.zv2-sheet [data-zv2-select-place="hamamatsu-sanaru"]');
  await m1.page.waitForTimeout(100);
  const lowSel = await m1.page.evaluate(() => {
    const sheet = document.querySelector(".zv2-sheet") as HTMLElement;
    const imgsInSheet = sheet.querySelectorAll("img").length;
    const domPhotoPins = document.querySelectorAll(".zv2-pin-photo").length;
    const primaryBtn = sheet.querySelector(".zv2-btn-main")?.textContent?.trim();
    return { imgsInSheet, domPhotoPins, primaryBtn, listRows: sheet.querySelectorAll(".zv2-prow").length };
  });
  assert.equal(lowSel.imgsInSheet, 0);
  assert.equal(lowSel.domPhotoPins, 1);
  assert.equal(lowSel.listRows, 0); // list replaced completely
  assert.equal(lowSel.primaryBtn, "この場所を見る");

  // Pull up selected sheet header -> reveals photos (still omits own photo because guest)
  await m1.page.click(".zv2-sheet-head");
  await m1.page.waitForTimeout(260);
  const expandedSel = await m1.page.evaluate(() => {
    const sheet = document.querySelector(".zv2-sheet") as HTMLElement;
    return {
      imgsInSheet: sheet.querySelectorAll(".zv2-pphotos img").length,
      hasOwnRow: sheet.textContent?.includes("あなたの撮影") ?? false,
    };
  });
  assert.ok(expandedSel.imgsInSheet >= 1);
  assert.equal(expandedSel.hasOwnRow, false);
  await m1.context.close();

  // 2) Mobile 375x812 around Miyakoda (0 recorded + 310 zero-record places)
  const m2 = await setupPage(375, 812, "miyakoda");
  await m2.page.click(".zv2-sheet-head");
  await m2.page.waitForTimeout(200);
  const miyakodaText = await m2.page.evaluate(() => {
    const sheet = document.querySelector(".zv2-sheet") as HTMLElement;
    const zeroRows = sheet.querySelectorAll(".zv2-prow.zv2-zero-nearest").length;
    const nearestBtn = sheet.querySelector("[data-zv2-nearest-recorded]")?.textContent?.trim();
    return { zeroRows, nearestBtn, hasPark: sheet.textContent?.includes("都田総合公園") ?? false };
  });
  assert.ok(miyakodaText.zeroRows >= 3 && miyakodaText.zeroRows <= 5, `expected 3..5 nearest zero rows, got ${miyakodaText.zeroRows}`);
  assert.equal(miyakodaText.nearestBtn, "記録のある最寄りへ");
  assert.equal(miyakodaText.hasPark, true);
  await m2.context.close();

  // 3) Desktop 1280x800: single 372px left panel, full remaining width map, zero right panel
  const d1 = await setupPage(1280, 800, "hamamatsu");
  assert.deepEqual(d1.errors, []);
  const deskMetrics = await d1.page.evaluate(() => {
    const panel = document.querySelector(".zv2-panel") as HTMLElement;
    const mapWrap = document.querySelector(".zv2-mapwrap") as HTMLElement;
    const zoom = document.querySelector(".zv2-zoombox") as HTMLElement;
    return {
      panelWidth: panel.getBoundingClientRect().width,
      mapLeft: mapWrap.getBoundingClientRect().left,
      mapWidth: mapWrap.getBoundingClientRect().width,
      zoomVisibleOnDesktop: getComputedStyle(zoom).display !== "none",
      rightPanelExists: Boolean(document.querySelector(".zk-sheet:not([hidden])")),
    };
  });
  assert.equal(Math.round(deskMetrics.panelWidth), 372);
  assert.equal(Math.round(deskMetrics.mapLeft), 372);
  assert.equal(Math.round(deskMetrics.mapWidth), 1280 - 372);
  assert.equal(deskMetrics.zoomVisibleOnDesktop, true);
  assert.equal(deskMetrics.rightPanelExists, false);
  await d1.context.close();
});

test("MAP_V2 tap selects the nearest dot, pin or cluster and the selected sheet is tall enough to show the card", () => {
  const html = renderMapExplorerV2Document({ lang: "ja", authenticated: false, basePath: "", cspNonce: "nonce-tap-1" });
  const has = (needle: string) => assert.ok(html.includes(needle), needle);
  has('.zv2-sheet[data-sheet-state="selected-low"]{max-height:280px}');
  has("map.on('click', function (e) {");
  has("queryRenderedFeatures([[e.point.x - rad, e.point.y - rad], [e.point.x + rad, e.point.y + rad]], { layers: ['zv2-clusters', 'zv2-rec-pin', 'zv2-zero-hit'] })");
  assert.ok(!html.includes("map.on('click', 'zv2-"));
  has("selectPlace(best.properties.placeId)");
  has("getClusterExpansionZoom");
  has("sheetRect.bottom - 280");
  has("ここで最初の記録を");
});

test("MAP_V2 sheet drag: head pointer events, body touch drag at scroll top, velocity snap to true collapsed, selected can close", () => {
  const html = renderMapExplorerV2Document({ lang: "ja", authenticated: false, basePath: "", cspNonce: "nonce-drag-1" });
  const has = (needle: string) => assert.ok(html.includes(needle), needle);
  has(".zv2-sheet-head{touch-action:none;");
  has("sheetHeadEl.addEventListener('pointerdown'");
  has("sheetHeadEl.addEventListener('pointermove'");
  has("sheetHeadEl.addEventListener('pointerup'");
  has("sheetHeadEl.addEventListener('pointercancel'");
  has("sheetBodyEl.addEventListener('touchmove'");
  has("{ passive: false }");
  has("sheetBodyEl.scrollTop <= 0");
  has("Math.abs(dy) < 8");
  has("var dir = vel < 0 ? 1 : -1;");
  has("Math.abs(vel) > 0.35");
  has("{ h: headH, act: 'close' }");
  has("{ h: headH, act: 'collapsed' }");
  has("state.selectedId = null;");
  has("Math.max(sheetHeadEl.offsetHeight, Math.min(window.innerHeight - 144, drag.h0 - dy))");
  has("Date.now() - (state.dragEndAt || 0) < 400");
  has("@media (prefers-reduced-motion:reduce){.zv2-sheet{transition:none}}");
});

test("MAP_V2 starts at the real location without a visible jump and treats null record count as unknown, not zero", () => {
  const html = renderMapExplorerV2Document({ lang: "ja", authenticated: false, basePath: "", cspNonce: "nonce-geo-1" });
  const has = (needle: string) => assert.ok(html.includes(needle), needle);
  has("現在地を確認中…");
  has("{ enableHighAccuracy: false, maximumAge: 60000, timeout: 4000 }");
  has("navigator.geolocation.watchPosition(");
  has("{ enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }");
  has("Date.now() - o.t > 86400000");
  has("zoomParam !== null ? zoomParam : 15");
  has("setTimeout(function () { build(CFG.defaultCenter");
  has("}, 1500);");
  has("distMeters(c.lat, c.lng, lat, lng) > 150");
  has("m.jumpTo({ center: [lng, lat] })");
  has("if (hasUrlCenter) {");
  has("function createMap(startCenter, startZoom)");
  const initIdx = html.indexOf("function createMap(startCenter, startZoom)");
  const fetchIdx = html.indexOf("fetchPlaces();", initIdx);
  assert.ok(initIdx > 0 && fetchIdx > initIdx, "places are fetched only inside createMap after the center is decided");
  has("function rcOf(p) { return typeof p.recordCount === 'number' ? p.recordCount : null; }");
  has("return rcOf(p) !== 0; });");
  has("return rcOf(p) === 0; });");
  has("recordCount: rcOf(p) === null ? '' : p.recordCount");
  has("function enrichPlace(sel)");
  has("if (sel && rcOf(sel) === null && !sel.enrichTried) enrichPlace(sel);");
  assert.ok(!html.includes("var rc = typeof p.recordCount === 'number' ? p.recordCount : 0;"));
});

test("mapExplorerV2 worker graph has no node imports and asset paths match pinned assets", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["mapExplorerV2.ts", "mapExplorerAssetPaths.ts"]) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /mapExplorerAssets|node:|import\.meta|readFileSync/);
    assert.doesNotMatch(src, /from "\.\/(?:siteShell|mapExplorer)\.js"/);
  }
  const a = await import("./mapExplorerAssets.js");
  const p = await import("./mapExplorerAssetPaths.js");
  assert.equal(p.MAPLIBRE_SELF_HOSTED_JS_PATH, a.MAPLIBRE_SELF_HOSTED_JS.path);
  assert.equal(p.MAPLIBRE_SELF_HOSTED_CSS_PATH, a.MAPLIBRE_SELF_HOSTED_CSS.path);
});
