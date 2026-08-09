import { mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  APIRequestContext,
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Locator,
  Page,
  Playwright,
} from "@playwright/test";
import { expect } from "@playwright/test";

export const DEFAULT_STAGING_MAP_PATH = "/map?tab=markers&bm=esri&lng=137.8589&lat=34.7219&z=10.6";
export const STAGING_BASE_URL = process.env.STAGING_BASE_URL ?? "https://staging.zukan.earth";

export type SeededRegressionFixture = {
  visitId: string;
  occurrenceId: string;
  placeId: string;
  subjectLabel: string;
  scientificName: string;
  observedAt: string;
  sourceKind: string;
  expectedVisibility: "manual_only" | "all_research_artifacts_only" | "excluded";
};

export type SeededRegressionReferenceFixture = {
  sourceId: string;
  title: string;
  taxonName: string;
  taxonRank: string;
  locator: string;
};

export type SeededRegressionFixtureBundle = {
  fixturePrefix: string;
  user: {
    userId: string;
    displayName: string;
  };
  manual: SeededRegressionFixture;
  historical: SeededRegressionFixture;
  smoke: SeededRegressionFixture;
  scene: SeededRegressionFixture;
  reference: SeededRegressionReferenceFixture;
};

export type SeededRallyFixtureBundle = {
  fixturePrefix: string;
  user: {
    userId: string;
    displayName: string;
  };
  session: {
    sessionId: string;
    eventCode: string;
    title: string;
  };
  station: {
    stationId: string;
    name: string;
  };
  missions: {
    open: { missionId: string; title: string };
    sunnyStation: { missionId: string; title: string };
    rainFallback: { missionId: string; title: string };
  };
  progress: {
    actualCount: number;
    goalCount: number;
    percent: number;
  };
};

export type ViewportProfile = {
  slug: string;
  viewport: { width: number; height: number };
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  userAgent?: string;
};

export const MAP_VIEWPORTS: ViewportProfile[] = [
  { slug: "desktop-1440", viewport: { width: 1440, height: 900 } },
  { slug: "desktop-1280", viewport: { width: 1280, height: 800 } },
  { slug: "desktop-1024", viewport: { width: 1024, height: 768 } },
  { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function encodeBasicAuth(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString("base64");
}

export function stagingBasicAuthHeader(): string | null {
  const user = process.env.STAGING_BASIC_AUTH_USER?.trim();
  const pass = process.env.STAGING_BASIC_AUTH_PASS?.trim();
  if (!user || !pass) {
    return null;
  }
  return `Basic ${encodeBasicAuth(user, pass)}`;
}

export function stagingContextOptions(overrides: Partial<BrowserContextOptions> = {}): BrowserContextOptions {
  const user = process.env.STAGING_BASIC_AUTH_USER?.trim();
  const pass = process.env.STAGING_BASIC_AUTH_PASS?.trim();
  return {
    baseURL: STAGING_BASE_URL,
    ignoreHTTPSErrors: true,
    httpCredentials: user && pass ? { username: user, password: pass } : undefined,
    ...overrides,
  };
}

export async function newStagingContext(
  browser: Browser,
  profile: ViewportProfile,
  overrides: Partial<BrowserContextOptions> = {},
): Promise<BrowserContext> {
  return browser.newContext(
    stagingContextOptions({
      viewport: profile.viewport,
      deviceScaleFactor: profile.deviceScaleFactor,
      isMobile: profile.isMobile,
      hasTouch: profile.hasTouch,
      userAgent: profile.userAgent,
      ...overrides,
    }),
  );
}

export async function suppressMapLibreForSmoke(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLLinkElement.prototype, "integrity", {
      configurable: true,
      get() {
        return "";
      },
      set() {
        // Smoke tests provide an inline, deterministic CSS response instead of
        // the third-party bytes whose SRI digest the production page enforces.
      },
    });
  });
  await page.route(
    /https:\/\/(?:cdn\.jsdelivr\.net\/npm|unpkg\.com)\/maplibre-gl@4\.7\.1\/dist\/maplibre-gl\.(?:js|css)$/,
    async (route) => {
      if (new URL(route.request().url()).pathname.endsWith(".css")) {
        await route.fulfill({
          status: 200,
          contentType: "text/css; charset=utf-8",
          body: "/* MapLibre layout is replaced by the deterministic smoke stub. */",
        });
        return;
      }
      await route.abort("blockedbyclient");
    },
  );
  await page.route(/https:\/\/tile\.openstreetmap\.org\/.*/, async (route) => {
    await route.abort("blockedbyclient");
  });
}

export async function installMapLibreStubForSmoke(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const makeBounds = (center, span) => {
      const lng = Number(center && center.lng) || 138.38;
      const lat = Number(center && center.lat) || 35.34;
      const delta = Number(span) || 0.1;
      return {
        _empty: false,
        _west: lng - delta,
        _south: lat - delta,
        _east: lng + delta,
        _north: lat + delta,
        extend(value) {
          const point = Array.isArray(value) ? value : [value && value.lng, value && value.lat];
          const nextLng = Number(point[0]);
          const nextLat = Number(point[1]);
          if (!Number.isFinite(nextLng) || !Number.isFinite(nextLat)) return this;
          if (this._empty) {
            this._west = nextLng;
            this._east = nextLng;
            this._south = nextLat;
            this._north = nextLat;
            this._empty = false;
          } else {
            this._west = Math.min(this._west, nextLng);
            this._east = Math.max(this._east, nextLng);
            this._south = Math.min(this._south, nextLat);
            this._north = Math.max(this._north, nextLat);
          }
          return this;
        },
        getWest() { return this._west; },
        getSouth() { return this._south; },
        getEast() { return this._east; },
        getNorth() { return this._north; },
        isEmpty() { return this._empty; },
      };
    };

    class SmokeMap {
      constructor(options) {
        this._handlers = {};
        this._onceHandlers = {};
        this._sources = {};
        this._layers = {};
        this._loaded = false;
        this._zoom = Number(options && options.zoom) || 10;
        const center = Array.isArray(options && options.center) ? options.center : [138.38, 35.34];
        this._center = { lng: Number(center[0]) || 138.38, lat: Number(center[1]) || 35.34 };
        (window as any).__ikimonMapSmokeLastMap = this;
        this._container = typeof options.container === "string"
          ? document.getElementById(options.container)
          : options.container;
        this._canvas = document.createElement("canvas");
        this._canvas.setAttribute("data-maplibre-smoke-stub", "1");
        this._canvas.width = this._container && this._container.clientWidth ? this._container.clientWidth : 800;
        this._canvas.height = this._container && this._container.clientHeight ? this._container.clientHeight : 600;
        if (this._container && !this._container.querySelector("[data-maplibre-smoke-stub='1']")) {
          this._container.appendChild(this._canvas);
        }
        this._canvas.addEventListener("click", (event) => {
          const handlers = this._handlers.click || [];
          const firstSource = Object.values(this._sources).find((source) => (
            source
            && source.data
            && Array.isArray(source.data.features)
            && source.data.features.length > 0
          ));
          const feature = firstSource && firstSource.data.features[0];
          const box = this._canvas.getBoundingClientRect();
          const payload = {
            type: "click",
            target: this,
            features: feature ? [feature] : [],
            point: { x: event.clientX - box.left, y: event.clientY - box.top },
            lngLat: { lng: this._center.lng, lat: this._center.lat },
          };
          handlers.slice().forEach((handler) => handler(payload));
        });
        setTimeout(() => {
          this._loaded = true;
          this._emit("load");
          this._emit("style.load");
          this._emit("idle");
        }, 0);
      }
      _listen(bucket, type, layerOrHandler, maybeHandler) {
        const handler = typeof layerOrHandler === "function" ? layerOrHandler : maybeHandler;
        if (typeof handler !== "function") return this;
        if (!bucket[type]) bucket[type] = [];
        bucket[type].push(handler);
        if ((type === "load" || type === "style.load") && this._loaded) {
          setTimeout(() => handler({ type, target: this }), 0);
        }
        return this;
      }
      _emit(type, event) {
        const payload = event || {
          type,
          target: this,
          point: { x: 0, y: 0 },
          lngLat: { lng: this._center.lng, lat: this._center.lat },
        };
        (this._handlers[type] || []).slice().forEach((handler) => handler(payload));
        const onceHandlers = (this._onceHandlers[type] || []).slice();
        this._onceHandlers[type] = [];
        onceHandlers.forEach((handler) => handler(payload));
      }
      on(type, layerOrHandler, maybeHandler) { return this._listen(this._handlers, type, layerOrHandler, maybeHandler); }
      once(type, layerOrHandler, maybeHandler) { return this._listen(this._onceHandlers, type, layerOrHandler, maybeHandler); }
      addControl() { return this; }
      resize() { return this; }
      getCanvas() { return this._canvas; }
      getCenter() { return this._center; }
      getZoom() { return this._zoom; }
      getBounds() { return makeBounds(this._center, 0.1); }
      project(value) {
        const pair = Array.isArray(value)
          ? value
          : [value && value.lng, value && value.lat];
        const lng = Number(pair[0]);
        const lat = Number(pair[1]);
        const width = this._canvas && this._canvas.width ? this._canvas.width : 800;
        const height = this._canvas && this._canvas.height ? this._canvas.height : 600;
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          return { x: width / 2, y: height / 2 };
        }
        const zoom = Number.isFinite(Number(this._zoom)) ? Number(this._zoom) : 10;
        const scale = Math.max(320, Math.min(4800, 24 * Math.pow(2, Math.max(0, zoom - 8))));
        const latScale = Math.max(0.2, Math.cos(this._center.lat * Math.PI / 180));
        return {
          x: width / 2 + (lng - this._center.lng) * scale * latScale,
          y: height / 2 - (lat - this._center.lat) * scale,
        };
      }
      fitBounds(bounds, options) {
        const west = Array.isArray(bounds) && Array.isArray(bounds[0]) ? Number(bounds[0][0]) : NaN;
        const south = Array.isArray(bounds) && Array.isArray(bounds[0]) ? Number(bounds[0][1]) : NaN;
        const east = Array.isArray(bounds) && Array.isArray(bounds[1]) ? Number(bounds[1][0]) : NaN;
        const north = Array.isArray(bounds) && Array.isArray(bounds[1]) ? Number(bounds[1][1]) : NaN;
        if (Number.isFinite(west) && Number.isFinite(south) && Number.isFinite(east) && Number.isFinite(north)) {
          this._center = { lng: (west + east) / 2, lat: (south + north) / 2 };
        }
        if (options && Number.isFinite(Number(options.maxZoom))) this._zoom = Number(options.maxZoom);
        (window as any).__ikimonMapSmokeLastFitBounds = { bounds, options, center: this._center, zoom: this._zoom };
        setTimeout(() => this._emit("moveend"), 0);
        return this;
      }
      flyTo(options) {
        if (options && Array.isArray(options.center)) {
          this._center = { lng: Number(options.center[0]) || this._center.lng, lat: Number(options.center[1]) || this._center.lat };
        }
        if (options && Number.isFinite(Number(options.zoom))) this._zoom = Number(options.zoom);
        setTimeout(() => this._emit("moveend"), 0);
        return this;
      }
      addSource(id, source) {
        this._sources[id] = {
          ...(source || {}),
          id,
          data: source && source.data,
          setData(data) { this.data = data; },
        };
        return this;
      }
      getSource(id) { return this._sources[id] || null; }
      removeSource(id) {
        delete this._sources[id];
        return this;
      }
      addLayer(layer) {
        if (layer && layer.id) this._layers[layer.id] = layer;
        return this;
      }
      getLayer(id) { return this._layers[id] || null; }
      removeLayer(id) {
        delete this._layers[id];
        return this;
      }
      moveLayer() { return this; }
      setFilter() { return this; }
      setPaintProperty() { return this; }
      setLayoutProperty() { return this; }
      setStyle() {
        setTimeout(() => this._emit("style.load"), 0);
        return this;
      }
      queryRenderedFeatures() { return []; }
    }

    class SmokeMarker {
      constructor(options) { this._element = options && options.element; }
      setLngLat(value) { this._lngLat = value; return this; }
      addTo(map) {
        this._map = map;
        if (this._element && map && map._container && !map._container.contains(this._element)) {
          const point = typeof map.project === "function" ? map.project(this._lngLat) : null;
          this._element.style.position = this._element.style.position || "absolute";
          this._element.style.left = this._element.style.left || (point && Number.isFinite(point.x) ? `${Math.round(point.x)}px` : "50%");
          this._element.style.top = this._element.style.top || (point && Number.isFinite(point.y) ? `${Math.round(point.y)}px` : "50%");
          map._container.appendChild(this._element);
        }
        return this;
      }
      remove() {
        if (this._element && this._element.parentElement) {
          this._element.parentElement.removeChild(this._element);
        }
        return this;
      }
    }

    class SmokePopup {
      setLngLat(value) { this._lngLat = value; return this; }
      setDOMContent(value) { this._content = value; return this; }
      setHTML(value) { this._html = value; return this; }
      addTo() { return this; }
      remove() { return this; }
    }

    class SmokeLngLatBounds {
      constructor() {
        const bounds = makeBounds({ lng: 0, lat: 0 }, 0);
        bounds._empty = true;
        return bounds;
      }
    }

    window.maplibregl = {
      Map: SmokeMap,
      Marker: SmokeMarker,
      NavigationControl: class {},
      Popup: SmokePopup,
      LngLatBounds: SmokeLngLatBounds,
    };
  });
}

export async function createStagingApiContext(playwright: Playwright): Promise<APIRequestContext> {
  const authHeader = stagingBasicAuthHeader();
  return playwright.request.newContext({
    baseURL: STAGING_BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: authHeader ? { Authorization: authHeader } : undefined,
  });
}

type SeedRegressionResponse = {
  ok: boolean;
  error?: string;
  fixture?: SeededRegressionFixtureBundle;
};

type SeedRallyResponse = {
  ok: boolean;
  error?: string;
  fixture?: SeededRallyFixtureBundle;
};

type CleanupResponse = {
  ok: boolean;
  error?: string;
};

type SessionIssueResponse = {
  ok: boolean;
  error?: string;
};

export async function seedRegressionFixtures(
  api: APIRequestContext,
  writeKey: string,
  fixturePrefix: string,
): Promise<SeededRegressionFixtureBundle> {
  const response = await api.post("/api/v1/ops/staging/fixtures/seed-regression", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: { fixturePrefix },
  });
  const payload = (await response.json()) as SeedRegressionResponse;
  expect(response.ok(), payload.error ?? "seed_regression_failed").toBeTruthy();
  expect(payload.ok, payload.error ?? "seed_regression_failed").toBeTruthy();
  expect(payload.fixture).toBeTruthy();
  return payload.fixture!;
}

export async function seedRallyFixtures(
  api: APIRequestContext,
  writeKey: string,
  fixturePrefix: string,
): Promise<SeededRallyFixtureBundle> {
  const response = await api.post("/api/v1/ops/staging/fixtures/seed-rally", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: { fixturePrefix },
  });
  const payload = (await response.json()) as SeedRallyResponse;
  expect(response.ok(), payload.error ?? "seed_rally_failed").toBeTruthy();
  expect(payload.ok, payload.error ?? "seed_rally_failed").toBeTruthy();
  expect(payload.fixture).toBeTruthy();
  return payload.fixture!;
}

export async function cleanupFixtures(
  api: APIRequestContext,
  writeKey: string,
  fixturePrefix: string,
): Promise<void> {
  const response = await api.post("/api/v1/ops/staging/fixtures/cleanup", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: { fixturePrefix },
  });
  const payload = (await response.json()) as CleanupResponse;
  expect(response.ok(), payload.error ?? "cleanup_fixtures_failed").toBeTruthy();
  expect(payload.ok, payload.error ?? "cleanup_fixtures_failed").toBeTruthy();
}

export async function issueSessionCookie(
  api: APIRequestContext,
  writeKey: string,
  userId: string,
): Promise<string> {
  const response = await api.post("/api/v1/auth/session/issue", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      userId,
      ttlHours: 24,
    },
  });
  const payload = (await response.json()) as SessionIssueResponse;
  expect(response.ok(), payload.error ?? "session_issue_failed").toBeTruthy();
  const rawCookie = response.headers()["set-cookie"];
  expect(rawCookie).toBeTruthy();
  return rawCookie;
}

function parseSetCookie(rawCookie: string): { name: string; value: string } {
  const firstSegment = rawCookie.split(";")[0] ?? "";
  const separatorIndex = firstSegment.indexOf("=");
  if (separatorIndex < 1) {
    throw new Error(`invalid_set_cookie:${rawCookie}`);
  }
  return {
    name: firstSegment.slice(0, separatorIndex),
    value: decodeURIComponent(firstSegment.slice(separatorIndex + 1)),
  };
}

export async function addSessionCookie(context: BrowserContext, rawCookie: string): Promise<void> {
  const url = new URL(STAGING_BASE_URL);
  const parsed = parseSetCookie(rawCookie);
  await context.addCookies([
    {
      name: parsed.name,
      value: parsed.value,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}

export async function waitForMapReady(page: Page, mapPath = DEFAULT_STAGING_MAP_PATH): Promise<void> {
  await page.goto(mapPath, { waitUntil: "domcontentloaded" });
  await page.locator("#map-explorer").waitFor({ state: "visible" });
  await expect(page.locator(".me-main")).toBeVisible();
  await page.locator("#map-explorer canvas").first().waitFor({ state: "visible" });
  try {
    await expect(page.locator("#map-explorer")).toHaveAttribute("data-results-state", /^(ready|empty)$/, { timeout: 60_000 });
    await page.waitForFunction(() => {
      return document.querySelectorAll(".me-result-row").length > 0 || document.querySelectorAll(".me-results-empty").length > 0;
    }, undefined, { timeout: 10_000 });
  } catch (error) {
    const sideStatus = ((await page.locator("#me-side-status").textContent().catch(() => "")) ?? "").trim();
    const mapStatus = ((await page.locator("#me-map-status").textContent().catch(() => "")) ?? "").trim();
    const pending = await page.locator("#map-explorer").getAttribute("data-results-pending").catch(() => null);
    const state = await page.locator("#map-explorer").getAttribute("data-results-state").catch(() => null);
    const count = await page.locator("#map-explorer").getAttribute("data-results-count").catch(() => null);
    const rows = await page.locator(".me-result-row").count().catch(() => -1);
    const empties = await page.locator(".me-results-empty").count().catch(() => -1);
    const listPreview = ((await page.locator("#me-results-list").evaluate((node) => node.innerHTML.slice(0, 180)).catch(() => "")) ?? "").replace(/\s+/g, " ");
    throw new Error(`map_ready_timeout path=${mapPath} sideStatus=${sideStatus || "empty"} mapStatus=${mapStatus || "empty"} pending=${pending ?? "missing"} state=${state ?? "missing"} count=${count ?? "missing"} rows=${rows} empty=${empties} list=${listPreview || "empty"} cause=${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function waitForSearchAreaButton(page: Page): Promise<void> {
  await expect(page.locator("#me-search-area-btn")).toBeVisible();
}

export async function dragMap(page: Page, deltaX: number, deltaY: number): Promise<void> {
  const canvas = page.locator("#map-explorer canvas").first();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("map_canvas_not_ready");
  }
  const startX = box.x + box.width * 0.78;
  const startY = box.y + box.height * 0.34;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 12 });
  await page.mouse.up();
}

export async function triggerPendingViewportSearch(page: Page): Promise<void> {
  await page.waitForTimeout(700);
  const attempts = [
    { x: 220, y: 80 },
    { x: -240, y: 110 },
    { x: 0, y: -180 },
  ];
  for (const attempt of attempts) {
    await dragMap(page, attempt.x, attempt.y);
    try {
      await expect(page.locator("#me-search-area-btn")).toBeVisible({ timeout: 4_000 });
      return;
    } catch {
      // Try a different drag vector until moveend toggles the pending-search CTA.
    }
  }
  await expect(page.locator("#me-search-area-btn")).toBeVisible();
}

export async function maybeCaptureQaScreenshot(page: Page, fileName: string): Promise<string | null> {
  const targetDir = process.env.MAP_QA_CAPTURE_DIR?.trim();
  if (!targetDir) {
    return null;
  }
  await mkdir(targetDir, { recursive: true });
  const outputPath = path.join(targetDir, fileName);
  await page.screenshot({
    path: outputPath,
    type: "jpeg",
    quality: 72,
    animations: "disabled",
  });
  return outputPath;
}

export async function expectMaskedScreenshot(
  locator: Locator,
  fileName: string,
  masks: Locator[] = [],
): Promise<void> {
  await expect(locator).toHaveScreenshot(fileName, {
    animations: "disabled",
    caret: "hide",
    mask: masks,
    maxDiffPixelRatio: 0.03,
  });
}

export function uniqueFixturePrefix(prefix: string): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;
  return `${prefix}-${stamp}`;
}
