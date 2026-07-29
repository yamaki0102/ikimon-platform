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
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      background_color: string;
      theme_color: string;
      shortcuts: Array<{ url: string; icons: Array<{ src: string; sizes: string; type: string }> }>;
      icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };
    assert.equal(manifest.name, "ZUKAN");
    assert.equal(manifest.short_name, "ZUKAN");
    assert.equal(manifest.start_url, "/en/?source=pwa");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.background_color, "#f7f7f3");
    assert.equal(manifest.theme_color, "#143f2e");
    assert.deepEqual(
      manifest.shortcuts.map((shortcut) => shortcut.url),
      ["/en/record", "/en/map?tab=places", "/en/records?view=mine", "/en/profile"],
    );
    assert.deepEqual(
      manifest.icons.map(({ src, sizes, type, purpose }) => ({ src, sizes, type, purpose })),
      [
        { src: "/assets/brand/zukan-app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/assets/brand/zukan-app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/assets/brand/zukan-app-icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/assets/brand/zukan-app-icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    );
    assert.ok(manifest.shortcuts.every((shortcut) => shortcut.icons.every((icon) => icon.sizes === "192x192" && icon.type === "image/png")));
  } finally {
    await app.close();
  }
});

test("app service worker keeps authenticated navigation out of shared caches without activate-time self-navigation", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/app-sw.js" });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"] as string, /application\/javascript/);
    assert.equal(response.headers["service-worker-allowed"], "/");
    assert.match(response.body, /ikimon-app-v9/);
    assert.match(response.body, /networkFirstNavigation/);
    assert.doesNotThrow(() => new Function(response.body));
    assert.doesNotMatch(response.body, /APP_NAV_RE|SHELL_CACHE/);
    assert.match(response.body, /OFFLINE_URLS/);
    assert.match(response.body, /offline\.html\?lang=en/);
    assert.match(response.body, /\/assets\/brand\/zukan-app-icon-192\.png/);
    assert.match(response.body, /\/assets\/brand\/zukan-favicon-32\.png/);
    assert.match(response.body, /MAP_NAV_RE/);
    assert.match(response.body, /PERSONAL_NAV_RE/);
    assert.doesNotMatch(response.body, /REFRESH_NAV_RE/);
    const navigationPattern = (name: "PERSONAL_NAV_RE"): RegExp => {
      const declaration = response.body
        .split("\n")
        .find((line) => line.startsWith(`const ${name} = `));
      assert.ok(declaration, `${name} declaration should be present`);
      const expression = declaration.slice(`const ${name} = `.length).replace(/;$/, "");
      return new Function(`return ${expression}`)() as RegExp;
    };
    const personalNavigation = navigationPattern("PERSONAL_NAV_RE");
    assert.equal(personalNavigation.test("/record"), true);
    assert.equal(personalNavigation.test("/ja/record"), true);
    assert.equal(personalNavigation.test("/records"), true);
    assert.equal(personalNavigation.test("/ja/records"), true);
    assert.match(response.body, /profile(?:\\\/settings)?/);
    assert.match(response.body, /cache: 'no-store'/);
    assert.match(response.body, /self\.clients\.claim/);
    assert.match(response.body, /clients\.matchAll/);
    assert.doesNotMatch(response.body, /client\.navigate/);
    assert.doesNotMatch(response.body, /searchParams\.set\('sw', VERSION\)/);
    assert.match(response.body, /request\.mode === 'navigate'/);
    assert.match(response.body, /ikimon-app-outbox-sync/);
    assert.match(response.body, /self\.addEventListener\('sync'/);
    assert.doesNotMatch(response.body, /registration\.unregister/);
  } finally {
    await app.close();
  }
});

test("app refresh page unregisters stale service workers without clearing client data stores", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/app-refresh?to=%2Fmap%3Flang%3Dja%26tab%3Dplaces",
      headers: { accept: "text/html" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["cache-control"] as string, /no-store/);
    assert.match(response.headers["x-robots-tag"] as string, /noindex/);
    assert.match(response.body, /navigator\.serviceWorker\.getRegistrations/);
    assert.match(response.body, /registration\.unregister/);
    assert.match(response.body, /caches\.keys/);
    assert.match(response.body, /\^ikimon-app-/);
    assert.match(response.body, /URLSearchParams\(window\.location\.search\)/);
    assert.match(response.body, /"\/map\?lang=ja&tab=places"/);
    assert.doesNotMatch(response.body, /indexedDB\.deleteDatabase/);
    assert.doesNotMatch(response.body, /localStorage\.clear/);
  } finally {
    await app.close();
  }
});

test("app refresh page rejects external redirect targets", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/app-refresh?to=https%3A%2F%2Fevil.example%2Fmap",
      headers: { accept: "text/html" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /"\/map"/);
    assert.doesNotMatch(response.body, /evil\.example/);
  } finally {
    await app.close();
  }
});

test("offline fallback page links the four primary app surfaces", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/offline.html?lang=pt-BR",
      headers: { accept: "text/html" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<html lang="pt-BR">/);
    assert.match(response.body, /href="\/pt-br\/record"/);
    assert.match(response.body, /href="\/pt-br\/map\?tab=places"/);
    assert.match(response.body, /href="\/pt-br\/records\?view=mine"/);
    assert.match(response.body, /href="\/pt-br\/profile"/);
    assert.match(response.body, /alt="ZUKAN"/);
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
    assert.match(response.body, /App outbox debug \| ZUKAN/);
  } finally {
    await app.close();
  }
});
