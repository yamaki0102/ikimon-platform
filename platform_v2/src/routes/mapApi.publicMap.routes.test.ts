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

test("JMA nowcast endpoints expose sanitized times and proxy tiles", async () => {
  const originalFetch = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    fetched.push(url);
    if (url.endsWith("targetTimes_N1.json")) {
      return new Response(JSON.stringify([
        { basetime: "20260620030000", validtime: "20260620030000", elements: ["hrpns"] },
      ]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("targetTimes_N2.json")) {
      return new Response(JSON.stringify([
        { basetime: "20260620030000", validtime: "20260620030500", elements: ["hrpns"] },
        { basetime: "20260620030000", validtime: "20260620031500", elements: ["hrpns"] },
        { basetime: "20260620030000", validtime: "20260620033000", elements: ["hrpns"] },
        { basetime: "20260620030000", validtime: "20260620040000", elements: ["hrpns"] },
      ]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/surf/hrpns/5/28/12.png")) {
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }
    return new Response("missing", { status: 404 });
  }) as typeof fetch;

  const app = buildApp();
  try {
    const times = await app.inject({
      method: "GET",
      url: "/api/v1/weather/jma-nowcast/times",
    });
    assert.equal(times.statusCode, 200);
    const payload = times.json() as Record<string, unknown>;
    assert.equal(payload.source, "jma_high_resolution_precipitation_nowcast");
    assert.match(String(payload.tileUrlTemplate), /^\/api\/v1\/weather\/jma-nowcast\/tile/);
    assert.deepEqual((payload.times as Array<{ offsetMinutes: number }>).map((item) => item.offsetMinutes), [0, 5, 15, 30, 60]);

    const invalidTile = await app.inject({
      method: "GET",
      url: "/api/v1/weather/jma-nowcast/tile?basetime=bad&validtime=20260620030000&z=5&x=28&y=12",
    });
    assert.equal(invalidTile.statusCode, 400);

    const tile = await app.inject({
      method: "GET",
      url: "/api/v1/weather/jma-nowcast/tile?basetime=20260620030000&validtime=20260620030000&z=5&x=28&y=12",
    });
    assert.equal(tile.statusCode, 200);
    assert.match(String(tile.headers["content-type"] ?? ""), /^image\/png/);
    assert.equal(tile.headers["x-ikimon-weather-cache"], "miss");
    const fetchCountAfterMiss = fetched.length;

    const cachedTile = await app.inject({
      method: "GET",
      url: "/api/v1/weather/jma-nowcast/tile?basetime=20260620030000&validtime=20260620030000&z=5&x=28&y=12",
    });
    assert.equal(cachedTile.statusCode, 200);
    assert.equal(cachedTile.headers["x-ikimon-weather-cache"], "hit");
    assert.equal(fetched.length, fetchCountAfterMiss);
    assert.ok(fetched.some((url) => url.includes("www.jma.go.jp/bosai/jmatile/data/nowc/20260620030000/none/20260620030000/surf/hrpns/5/28/12.png")));
  } finally {
    globalThis.fetch = originalFetch;
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
