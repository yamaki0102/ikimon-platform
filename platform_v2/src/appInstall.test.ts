import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { BRAND_ASSETS } from "./brandAssets.js";
import { buildAppServiceWorker } from "./appInstall.js";

test("app service worker serves its pre-cached brand assets offline without caching private routes", async () => {
  const listeners = new Map<string, (event: any) => void>();
  const cacheLookups: string[] = [];
  let networkFetches = 0;
  let responded: Promise<Response> | null = null;
  const iconUrl = `https://zukan.earth${BRAND_ASSETS.mark192}`;
  const cachedIcon = new Response("cached brand icon", { status: 200, headers: { "content-type": "image/png" } });
  const context = {
    self: {
      location: new URL("https://zukan.earth/app-sw.js"),
      addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener),
      clients: { claim: async () => undefined, matchAll: async () => [] },
      skipWaiting: async () => undefined,
    },
    location: new URL("https://zukan.earth/app-sw.js"),
    caches: {
      match: async (request: Request) => {
        cacheLookups.push(request.url);
        return new URL(request.url).pathname === BRAND_ASSETS.mark192 ? cachedIcon.clone() : undefined;
      },
      open: async () => ({ put: async () => undefined, addAll: async () => undefined }),
      keys: async () => [],
      delete: async () => true,
    },
    fetch: async () => {
      networkFetches += 1;
      return new Response("network response");
    },
    URL,
    Request,
    Response,
    Promise,
    Set,
  };
  runInNewContext(buildAppServiceWorker(), context);
  const fetchListener = listeners.get("fetch");
  assert.ok(fetchListener, "service worker should register a fetch handler");

  const iconEvent = {
    request: new Request(iconUrl, { method: "GET", mode: "cors" }),
    respondWith: (response: Promise<Response>) => { responded = response; },
  };
  fetchListener(iconEvent);
  assert.ok(responded, "allowlisted brand assets should be served through CacheStorage");
  assert.equal(await (responded as Promise<Response>).then((response) => response.text()), "cached brand icon");
  assert.deepEqual(cacheLookups, [iconUrl]);
  assert.equal(networkFetches, 0, "an available precached asset should not require network access");

  responded = null;
  const privateApiEvent = {
    request: new Request("https://zukan.earth/api/v1/observations/upsert", { method: "GET", mode: "cors" }),
    respondWith: (response: Promise<Response>) => { responded = response; },
  };
  fetchListener(privateApiEvent);
  assert.equal(responded, null, "private/API requests must not be added to the static cache path");
  assert.deepEqual(cacheLookups, [iconUrl]);

  let postResponded = false;
  fetchListener({
    request: new Request("https://zukan.earth/api/v1/observations/upsert", { method: "POST", mode: "cors" }),
    respondWith: () => { postResponded = true; },
  });
  assert.equal(postResponded, false, "the service worker must leave POST requests untouched");
});
