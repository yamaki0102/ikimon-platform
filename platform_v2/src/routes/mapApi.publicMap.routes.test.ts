import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    for (const item of payload.items as Array<Record<string, unknown>>) {
      assert.ok(!("cellId" in item));
      assert.ok(!("mesh" in item));
      assert.ok(!("geohash" in item));
    }
    assert.ok(payload.stats && typeof payload.stats === "object");
    assert.deepEqual((payload.stats as { privacy?: unknown }).privacy, PUBLIC_MAP_AGGREGATE_POLICY);
  } finally {
    await app.close();
  }
});

test("place atlas profile route validates stable references instead of accepting raw coordinates", async () => {
  const app = buildApp();
  try {
    for (const url of [
      "/api/v1/map/place-profile",
      "/api/v1/map/place-profile?kind=point&lat=34.9702&lng=138.3805",
      "/api/v1/map/place-profile?kind=osm_area&entity_key=osm:way:999&osm_type=way&osm_id=125727939",
      "/api/v1/map/place-profile?kind=public_cell&cell_id=cell:91,138.38",
    ]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 400, url);
      assert.deepEqual(response.json(), { error: "invalid_place_ref" });
      assert.equal(response.headers["cache-control"], "no-store");
    }
  } finally {
    await app.close();
  }
});

test("public-cell place atlas route returns a versioned privacy-safe profile", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/map/place-profile?kind=public_cell&cell_id=1000:0:0",
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json() as Record<string, unknown>;
    const profile = payload.profile as Record<string, unknown>;
    assert.equal(profile.version, 1);
    assert.equal(response.headers["x-ikimon-profile-version"], "place_atlas_profile/v1");
    assert.match(String(response.headers["cache-control"]), /^public, max-age=60/);
    assert.ok(!JSON.stringify(profile).includes("exactLatitude"));
    assert.ok(!JSON.stringify(profile).includes("exactLongitude"));
    assert.ok(!JSON.stringify(profile).includes("\"lat\""));
    assert.ok(!JSON.stringify(profile).includes("\"lng\""));
    assert.equal((profile.publication as { locationMode: string }).locationMode, "public_cell");
    assert.ok(profile.timelineProjection && typeof profile.timelineProjection === "object");
  } finally {
    await app.close();
  }
});

test("place atlas v1 and v2 add the same canonical timeline projection", async () => {
  const app = buildApp();
  try {
    const baseUrl = "/api/v1/map/place-profile?kind=public_cell&cell_id=1000:0:0";
    const [v1, v2] = await Promise.all([
      app.inject({ method: "GET", url: baseUrl }),
      app.inject({ method: "GET", url: `${baseUrl}&version=2` }),
    ]);
    assert.equal(v1.statusCode, 200);
    assert.equal(v2.statusCode, 200);
    const profileV1 = v1.json().profile as Record<string, unknown>;
    const profileV2 = v2.json().profile as Record<string, unknown>;
    assert.deepEqual(profileV2.timelineProjection, profileV1.timelineProjection);
    assert.equal(profileV1.version, 1);
    assert.equal(profileV2.version, 2);
  } finally {
    await app.close();
  }
});

test("place atlas route isolates not-found and adapter failures from the map response contract", async () => {
  const source = await readFile(new URL("./mapApi.ts", import.meta.url), "utf8");
  const routeStart = source.indexOf('app.get("/api/v1/map/place-profile"');
  const routeEnd = source.indexOf('app.get("/api/v1/map/coverage"', routeStart);
  const placeProfileRoute = source.slice(routeStart, routeEnd);

  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  assert.match(placeProfileRoute, /place_not_found/);
  assert.match(placeProfileRoute, /place_profile_unavailable/);
  assert.match(placeProfileRoute, /retryable:\s*true/);
  assert.match(placeProfileRoute, /place_atlas_profile_failed/);
  assert.match(placeProfileRoute, /stale-while-revalidate=300/);
  assert.match(placeProfileRoute, /buildPlaceAtlasTimelineProjection\(profile\)/);
  assert.doesNotMatch(placeProfileRoute, /q\.lat|q\.lng/);
});

test("area polygon route logs high zoom empty viewport diagnostics", async () => {
  const source = await readFile(new URL("./mapApi.ts", import.meta.url), "utf8");

  assert.match(source, /shouldLogHighZoomEmptyAreaViewport/);
  assert.match(source, /area_polygons_high_zoom_empty_viewport/);
  assert.match(source, /featureCount === 0/);
  assert.match(source, /\(zoom \?\? 0\) >= 13/);
  assert.match(source, /bbox/);
  assert.match(source, /sources: sources \?\? "default"/);
  assert.match(source, /limit: limit \?\? null/);
  assert.doesNotMatch(source, /source === "user_defined"/);
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

test("map my-observations endpoints are private-by-session and safe for guests", async () => {
  const app = buildApp();
  try {
    for (const url of ["/api/v1/me/map-observations", "/api/v1/map/my-observations"]) {
      const response = await app.inject({
        method: "GET",
        url,
      });

      assert.equal(response.statusCode, 200, url);
      assert.deepEqual(response.json(), { signedIn: false, items: [], clusters: [] });
    }
  } finally {
    await app.close();
  }
});

test("map my-observations reads only the signed-in user's records", async () => {
  const source = await readFile(new URL("../services/mapOwnObservations.ts", import.meta.url), "utf8");

  assert.match(source, /where v\.user_id = \$1/);
  assert.match(source, /\[userId, limit\]/);
  assert.match(source, /buildMapOwnObservationClusters/);
  assert.doesNotMatch(source, /public_visibility/);
  assert.doesNotMatch(source, /display_name from users|join users/i);
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
    if (url.endsWith("/rasrf/targetTimes.json")) {
      return new Response(JSON.stringify([
        { basetime: "20260620030000", validtime: "20260620050000", member: "immed", elements: ["rasrf"] },
        { basetime: "20260620030000", validtime: "20260620060000", member: "immed", elements: ["rasrf"] },
        { basetime: "20260620030000", validtime: "20260620070000", member: "immed", elements: ["rasrf"] },
        { basetime: "20260620030000", validtime: "20260620080000", member: "immed", elements: ["rasrf"] },
        { basetime: "20260620030000", validtime: "20260620090000", member: "immed", elements: ["rasrf"] },
      ]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/surf/hrpns/5/28/12.png")) {
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }
    if (url.includes("/surf/rasrf/5/28/12.png")) {
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
    assert.equal(payload.source, "jma_precipitation_map");
    assert.match(String(payload.tileUrlTemplate), /^\/api\/v1\/weather\/jma-nowcast\/tile/);
    assert.match(String(payload.tileUrlTemplate), /product=\{product\}/);
    assert.deepEqual((payload.times as Array<{ offsetMinutes: number }>).map((item) => item.offsetMinutes), [0, 5, 15, 30, 60, 120, 180, 240, 300, 360]);
    assert.deepEqual((payload.times as Array<{ product: string }>).map((item) => item.product).slice(-5), ["short_range", "short_range", "short_range", "short_range", "short_range"]);

    const invalidTile = await app.inject({
      method: "GET",
      url: "/api/v1/weather/jma-nowcast/tile?basetime=bad&validtime=20260620030000&z=5&x=28&y=12",
    });
    assert.equal(invalidTile.statusCode, 400);

    const overscaledTile = await app.inject({
      method: "GET",
      url: "/api/v1/weather/jma-nowcast/tile?basetime=20260620030000&validtime=20260620030000&z=11&x=1807&y=813",
    });
    assert.equal(overscaledTile.statusCode, 400);

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

    const shortRangeTile = await app.inject({
      method: "GET",
      url: "/api/v1/weather/jma-nowcast/tile?product=short_range&member=immed&basetime=20260620030000&validtime=20260620050000&z=5&x=28&y=12",
    });
    assert.equal(shortRangeTile.statusCode, 200);
    assert.ok(fetched.some((url) => url.includes("www.jma.go.jp/bosai/jmatile/data/rasrf/20260620030000/immed/20260620050000/surf/rasrf/5/28/12.png")));
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
