import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildApp } from "../app.js";

test("public map observations require bbox or cell scope", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/map/observations",
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "missing_scope" });
  } finally {
    await app.close();
  }
});

test("public map cells expose a feature collection contract", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/map/cells?bbox=137.70,34.70,137.75,34.75&zoom=13",
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as Record<string, unknown>;
    assert.equal(payload.type, "FeatureCollection");
    assert.ok(Array.isArray(payload.features));
    assert.ok(payload.stats && typeof payload.stats === "object");
  } finally {
    await app.close();
  }
});

test("public map observations expose list items instead of point features", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/map/observations?bbox=137.70,34.70,137.75,34.75&zoom=13",
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as Record<string, unknown>;
    assert.ok(Array.isArray(payload.items));
    assert.ok(!("features" in payload));
    assert.ok(payload.stats && typeof payload.stats === "object");
  } finally {
    await app.close();
  }
});

test("area polygon route logs high zoom empty viewport diagnostics", () => {
  const source = readFileSync(new URL("./mapApi.ts", import.meta.url), "utf8");
  assert.match(source, /area_polygons_high_zoom_empty_viewport/);
  assert.match(source, /bbox/);
  assert.match(source, /zoom/);
  assert.match(source, /sources/);
});
