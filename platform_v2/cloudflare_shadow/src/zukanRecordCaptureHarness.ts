import { mkdirSync } from "node:fs";
import test, { after } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { renderCloudflareRecordHtml } from "./index";
import { globalRecordEntryAsset } from "../../src/ui/siteShell";

export type FakeCaps = {
  focusMode?: string[];
  zoom?: { min: number; max: number; step: number };
  focusDistance?: { min: number; max: number; step: number };
  torch?: boolean;
};

export const FULL_CAPS: FakeCaps = {
  focusMode: ["continuous", "single-shot", "manual"],
  zoom: { min: 1, max: 4, step: 0.1 },
  focusDistance: { min: 0, max: 1, step: 0.01 },
  torch: true,
};

const FAKE_CAMERA = `(() => {
  const calls = { getUserMedia: [], applyConstraints: [], stops: 0, started: 0 };
  window.__cam = calls;
  window.__camDeny = null;
  window.__camCaps = null;
  const draw = (canvas, tick) => {
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "hsl(" + (95 + (tick % 8)) + ",38%,26%)");
    grad.addColorStop(1, "hsl(" + (78 + (tick % 8)) + ",46%,52%)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,.16)";
    for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.ellipse(canvas.width * (0.15 + i * 0.14), canvas.height * (0.3 + (i % 3) * 0.2), canvas.width * 0.12, canvas.height * 0.05, i, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "28px sans-serif";
    ctx.fillText("cam " + tick, 24, 48);
  };
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    calls.getUserMedia.push(JSON.parse(JSON.stringify(constraints)));
    if (window.__camDeny) throw new DOMException("denied", window.__camDeny);
    const canvas = document.createElement("canvas");
    canvas.width = window.__camPortrait ? 480 : 640; canvas.height = window.__camPortrait ? 640 : 480;
    let tick = 0;
    draw(canvas, tick);
    const timer = setInterval(() => draw(canvas, ++tick), 60);
    const stream = canvas.captureStream(15);
    const track = stream.getVideoTracks()[0];
    const caps = window.__camCaps || {};
    track.getCapabilities = () => caps;
    track.getSettings = () => ({ width: canvas.width, height: canvas.height, zoom: 1 });
    track.applyConstraints = async (c) => { calls.applyConstraints.push(JSON.parse(JSON.stringify(c))); if (window.__camDelay) await new Promise((r) => setTimeout(r, window.__camDelay)); };
    const nativeStop = track.stop.bind(track);
    track.stop = () => { calls.stops += 1; clearInterval(timer); nativeStop(); };
    calls.started += 1;
    return stream;
  };
})();`;

const FAKE_GEO = `(() => {
  window.__geo = { calls: [] };
  navigator.geolocation.getCurrentPosition = (ok, fail, options) => {
    window.__geo.calls.push(options ? JSON.parse(JSON.stringify(options)) : null);
    if (window.__geoMode === "granted") setTimeout(() => ok({ coords: { latitude: 34.7108, longitude: 137.7261, accuracy: 25 } }), 30);
    else if (window.__geoMode === "denied") setTimeout(() => fail({ code: 1, message: "denied" }), 30);
  };
})();`;

export type ApiLog = { upsert: Record<string, unknown>[]; uploads: Array<{ path: string; body: Record<string, unknown> }>; other: string[] };

let browser: Browser | null = null;
try {
  browser = await chromium.launch({ headless: true });
} catch {
  browser = null;
}
after(async () => { await browser?.close(); });

export const browserTest = (name: string, fn: () => Promise<void>) => test(name, { skip: browser ? false : "chromium is not available" }, fn);

const SHOT_DIR = process.env.ZUKAN_CAPTURE_SHOT_DIR;
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true });

export async function openRecord(options: {
  caps?: FakeCaps;
  deny?: string;
  width?: number;
  height?: number;
  path?: string;
  reducedMotion?: "reduce" | "no-preference";
  saveFails?: boolean;
  focusDelay?: number;
  geo?: "granted" | "denied" | "hang";
} = {}): Promise<{ page: Page; context: BrowserContext; api: ApiLog; close: () => Promise<void> }> {
  const width = options.width ?? 390;
  const context = await browser!.newContext({
    viewport: { width, height: options.height ?? 844 },
    isMobile: width < 700,
    hasTouch: width < 700,
    reducedMotion: options.reducedMotion ?? "no-preference",
    locale: "ja-JP",
  });
  const api: ApiLog = { upsert: [], uploads: [], other: [] };
  await context.addInitScript("window.__name = (fn) => fn;");
  await context.addInitScript(`window.__camPortrait = ${width < 700}; window.__camDelay = ${options.focusDelay ?? 0};`);
  await context.addInitScript(FAKE_CAMERA);
  await context.addInitScript(`window.__geoMode = ${JSON.stringify(options.geo ?? "denied")};`);
  await context.addInitScript(FAKE_GEO);
  await context.addInitScript(`window.__camCaps = ${JSON.stringify(options.caps ?? FULL_CAPS)}; window.__camDeny = ${JSON.stringify(options.deny ?? null)};`);
  const asset = globalRecordEntryAsset();
  await context.route("https://zukan.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === asset.path) {
      await route.fulfill({ status: 200, contentType: asset.contentType, body: asset.content });
      return;
    }
    if (url.pathname.endsWith("/record")) {
      const html = renderCloudflareRecordHtml({ userId: "user_capture", displayName: "テスター", banned: false } as never, url, "test-nonce");
      await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
      return;
    }
    if (url.pathname === "/api/v1/observations/upsert") {
      api.upsert.push(JSON.parse(route.request().postData() ?? "{}"));
      await route.fulfill({ status: options.saveFails ? 500 : 200, contentType: "application/json", body: JSON.stringify(options.saveFails ? { ok: false, error: "x" } : { ok: true, visitId: "visit-1", observationId: "visit-1" }) });
      return;
    }
    if (/\/api\/v1\/observations\/[^/]+\/photos\/upload$/.test(url.pathname)) {
      api.uploads.push({ path: url.pathname, body: JSON.parse(route.request().postData() ?? "{}") });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      api.other.push(url.pathname);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({ status: 404, body: "" });
  });
  const page = await context.newPage();
  await page.goto(`https://zukan.test${options.path ?? "/ja/record"}`, { waitUntil: "domcontentloaded" });
  return { page, context, api, close: () => context.close() };
}

export async function waitPhase(page: Page, phase: string, timeout = 8000): Promise<void> {
  await page.waitForFunction((p) => document.querySelector("[data-zukan-capture-stage]")?.getAttribute("data-phase") === p, phase, { timeout });
}

export async function shot(page: Page, name: string): Promise<void> {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

export async function waitVideo(page: Page): Promise<void> {
  await page.waitForFunction(() => (document.querySelector("video[data-global-record-camera-video]") as HTMLVideoElement).videoWidth > 0);
}

export async function shoot(page: Page, times: number): Promise<void> {
  await waitVideo(page);
  for (let n = 1; n <= times; n += 1) {
    await page.click("[data-zt-shutter]");
    await page.waitForFunction((count) => document.querySelector("[data-zt-count]")?.textContent === String(count), n);
    await page.waitForTimeout(160);
  }
}

export const camLog = (page: Page) => page.evaluate(() => (window as unknown as { __cam: { getUserMedia: unknown[]; applyConstraints: unknown[]; stops: number } }).__cam);

export const TINY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

export const geoLog = (page: Page) => page.evaluate(() => (window as unknown as { __geo: { calls: unknown[] } }).__geo.calls);
