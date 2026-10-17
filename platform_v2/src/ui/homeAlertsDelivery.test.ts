import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { getStrings } from "../i18n/index.js";
import { renderLandingHomeState } from "./landingHomeState.js";
import { renderSiteDocument } from "./siteShell.js";

const copy = getStrings("ja").landing;
const home = renderLandingHomeState({ basePath: "", lang: "ja", copy, isLoggedIn: true,
  snapshot: { viewerUserId: "viewer", stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
    feed: [], myFeed: [], myPlaces: [], nearbyFields: [], nearbyEvents: [], mapPreviewCells: [], ambient: [], habit: null, dailyDashboard: null } });
const shell = renderSiteDocument({ basePath: "", title: "ZUKAN", body: "", lang: "ja" });
const script = (html: string, marker: string) => {
  const result = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gu)].find(match => match[1]?.includes(marker));
  const body = result?.[1];
  assert.ok(body, marker);
  return body;
};
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function runtime(options: { guest?: boolean; unavailable?: boolean; pending?: boolean } = {}) {
  const listeners = new Map<string, (event: any) => void>();
  const requests: string[] = [];
  const timers = new Map<number, () => void>();
  let retryClick: (() => void) | undefined;
  const status = { textContent: "" };
  const list = { textContent: "" };
  const retry = { hidden: true, querySelector: () => ({ addEventListener: (_: string, fn: () => void) => { retryClick = fn; } }) };
  const root = { hidden: false, querySelector: (selector: string) => selector.includes("-status") ? status : selector.includes("-retry") ? retry : list };
  const dataset: Record<string, string> = {};
  let fail = options.unavailable;
  const context = {
    AbortController,
    setTimeout(fn: () => void, ms: number) { assert.equal(ms, 12000); const id = timers.size + 1; timers.set(id, fn); return id; },
    clearTimeout(id: number) { timers.delete(id); },
    CustomEvent: class {
      readonly detail: unknown;
      constructor(readonly type: string, options: { detail: unknown }) { this.detail = options.detail; }
    },
    document: {
      documentElement: { dataset, lang: "ja" },
      querySelector: (selector: string) => selector.includes("data-home-auth-state") ? {} : selector === "[data-home-watch-updates]" ? root : null,
      querySelectorAll: () => [], addEventListener() {},
    },
    window: {
      addEventListener: (name: string, fn: (event: any) => void) => listeners.set(name, fn),
      dispatchEvent(event: any) { listeners.get(event.type)?.(event); },
    },
    fetch: async (url: string, init?: { signal?: AbortSignal }) => {
      requests.push(url);
      if (url.includes("auth/session")) return { ok: true, json: async () => ({ ok: true, session: options.guest ? null : { userId: "viewer" } }) };
      if (url.includes("personalized-menu")) return { ok: true, json: async () => ({ ok: true, items: [] }) };
      if (options.pending && requests.filter(x => x.endsWith("/alerts")).length === 1) {
        return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("timeout"))));
      }
      if (fail) { fail = false; return { ok: false }; }
      return { ok: true, json: async () => ({ ok: true, alerts: [] }) };
    },
  };
  runInNewContext(script(home.bodyHtml, "data-home-watch-updates-status"), context);
  runInNewContext(script(shell, "const publishAuthSessionReady"), context);
  return { requests, status, retry, timers, clickRetry: () => retryClick?.() };
}

test("Home and the notification menu use one authenticated alerts request", async () => {
  const f = runtime(); await flush();
  assert.equal(f.requests.filter(url => url.endsWith("/alerts")).length, 1);
  assert.equal(f.status.textContent, copy.home.member.watchUpdatesEmpty);
  assert.equal(f.retry.hidden, true);
  assert.equal(f.timers.size, 0);
});

test("guests never request personal alerts", async () => {
  const f = runtime({ guest: true }); await flush();
  assert.equal(f.requests.filter(url => url.endsWith("/alerts")).length, 0);
});

test("a failed shared request is not reported as empty and can be retried once", async () => {
  const f = runtime({ unavailable: true }); await flush();
  assert.equal(f.status.textContent, copy.home.member.watchUpdatesError);
  assert.equal(f.retry.hidden, false);
  f.clickRetry(); f.clickRetry(); await flush();
  assert.equal(f.requests.filter(url => url.endsWith("/alerts")).length, 2);
  assert.equal(f.status.textContent, copy.home.member.watchUpdatesEmpty);
  assert.equal(f.retry.hidden, true);
});

test("an unresponsive alerts request is aborted and exposes recovery", async () => {
  const f = runtime({ pending: true }); await flush();
  assert.equal(f.status.textContent, copy.home.member.watchUpdatesLoading);
  assert.equal(f.timers.size, 1);
  const abort = [...f.timers.values()][0];
  assert.ok(abort);
  abort(); await flush();
  assert.equal(f.status.textContent, copy.home.member.watchUpdatesError);
  assert.equal(f.retry.hidden, false);
  f.clickRetry(); await flush();
  assert.equal(f.status.textContent, copy.home.member.watchUpdatesEmpty);
});
