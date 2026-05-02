import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("map route keeps share-state plumbing in the shell", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/map?lang=ja",
    });

    assert.equal(response.statusCode, 200);
    const html = response.body;
    assert.match(html, /id="me-share-state"/);
    assert.match(html, /MapExplorerStateHelpers/);
    assert.match(html, /MAP_STATE_KEYS = \[[^\]]*"cell"/);
    assert.match(html, /serializeSharedMapState/);
    assert.match(html, /source: 'map'/);
    assert.match(html, /id: 'map:state'/);
    assert.match(html, /class="me-map-command-deck"/);
    assert.match(html, /data-map-tab="frontier"/);
    assert.match(html, /data-map-basemap="esri"/);
  } finally {
    await app.close();
  }
});
