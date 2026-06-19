import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import { PUBLIC_MAP_AGGREGATE_POLICY } from "../services/mapSnapshot.js";

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
    assert.deepEqual((payload.stats as { privacy?: unknown }).privacy, PUBLIC_MAP_AGGREGATE_POLICY);
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
    assert.deepEqual((payload.stats as { privacy?: unknown }).privacy, PUBLIC_MAP_AGGREGATE_POLICY);
  } finally {
    await app.close();
  }
});

test("map my-places endpoint is private-by-session and safe for guests", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/map/my-places",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { signedIn: false, items: [] });
  } finally {
    await app.close();
  }
});

test("public map guide spots expose sourced point guides without area registration", async () => {
  const app = buildApp();
  try {
    const invalid = await app.inject({
      method: "GET",
      url: "/api/v1/map/guide-spots",
    });
    assert.equal(invalid.statusCode, 400);
    assert.deepEqual(invalid.json(), { error: "missing_or_invalid_bbox" });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/map/guide-spots?bbox=137.55,34.67,137.75,34.84&limit=10",
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as Record<string, unknown>;
    assert.equal(payload.type, "FeatureCollection");
    const features = payload.features as Array<Record<string, unknown>>;
    assert.ok(features.length >= 5);
    assert.ok(features.some((feature) => {
      const properties = feature.properties as Record<string, unknown>;
      return properties.id === "hamamatsu-shijimizuka-site";
    }));
  } finally {
    await app.close();
  }
});

test("ops public map snapshot endpoint exposes freshness metadata only", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/ops/public-map-snapshot",
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as Record<string, unknown>;
    assert.equal(payload.snapshotKey, "public-map:v1:global");
    assert.ok(["missing", "fresh", "stale", "error"].includes(String(payload.status)));
    assert.ok(!("items" in payload));
    assert.ok(!("features" in payload));
  } finally {
    await app.close();
  }
});
