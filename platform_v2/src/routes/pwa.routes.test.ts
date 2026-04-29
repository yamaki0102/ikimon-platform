import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("manifest is app-first and localized from device or query language", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/manifest.webmanifest?lang=en",
      headers: { accept: "application/manifest+json" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"] as string, /application\/manifest\+json/);
    const manifest = JSON.parse(response.body) as {
      start_url: string;
      display: string;
      shortcuts: Array<{ url: string }>;
      icons: Array<{ src: string; purpose?: string }>;
    };
    assert.equal(manifest.start_url, "/en/?source=pwa");
    assert.equal(manifest.display, "standalone");
    assert.deepEqual(manifest.shortcuts.map((shortcut) => shortcut.url), ["/en/guide", "/en/record", "/en/map"]);
    assert.ok(manifest.icons.some((icon) => icon.src === "/assets/img/icon-512-maskable-v2.png" && icon.purpose === "maskable"));
  } finally {
    await app.close();
  }
});

test("app service worker is separate from legacy cleanup worker and caches app shells only as fallback", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/app-sw.js" });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"] as string, /application\/javascript/);
    assert.equal(response.headers["service-worker-allowed"], "/");
    assert.match(response.body, /ikimon-app-v1/);
    assert.match(response.body, /networkFirstNavigation/);
    assert.match(response.body, /OFFLINE_URLS/);
    assert.match(response.body, /offline\.html\?lang=en/);
    assert.match(response.body, /APP_NAV_RE/);
    assert.match(response.body, /ikimon-app-outbox-sync/);
    assert.match(response.body, /self\.addEventListener\('sync'/);
    assert.doesNotMatch(response.body, /registration\.unregister/);
  } finally {
    await app.close();
  }
});

test("offline fallback page links the three field-first app surfaces", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/offline.html?lang=pt-BR",
      headers: { accept: "text/html" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<html lang="pt-BR">/);
    assert.match(response.body, /href="\/pt-br\/guide"/);
    assert.match(response.body, /href="\/pt-br\/record"/);
    assert.match(response.body, /href="\/pt-br\/map"/);
  } finally {
    await app.close();
  }
});

test("app outbox debug page is noindexed and reads the client outbox", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/ja/debug/app-outbox",
      headers: { accept: "text/html" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["x-robots-tag"] as string, /noindex/);
    assert.match(response.body, /data-outbox-debug/);
    assert.match(response.body, /window\.ikimonAppOutbox\.all/);
    assert.match(response.body, /ikimonRequestAppOutboxSync/);
    assert.match(response.body, /App outbox debug \| ikimon\.life/);
  } finally {
    await app.close();
  }
});
