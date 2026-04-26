import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("legacy service worker URLs return an unregistering cleanup worker", async () => {
  const app = buildApp();
  try {
    for (const url of ["/sw.php", "/sw.js"]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 200);
      assert.match(response.headers["content-type"] as string, /application\/javascript/);
      assert.equal(response.headers["cache-control"], "no-cache, no-store, must-revalidate");
      assert.equal(response.headers["service-worker-allowed"], "/");
      assert.match(response.body, /registration\.unregister\(\)/);
      assert.match(response.body, /caches\.delete\(key\)/);
      assert.match(response.body, /No respondWith/);
    }
  } finally {
    await app.close();
  }
});

test("v2 HTML pages ask browsers to remove legacy service worker registrations", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/map?lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /navigator\.serviceWorker\.getRegistrations\(\)/);
    assert.match(response.body, /registration\.unregister\(\)/);
    assert.match(response.body, /ikimon-pwa-/);
  } finally {
    await app.close();
  }
});
