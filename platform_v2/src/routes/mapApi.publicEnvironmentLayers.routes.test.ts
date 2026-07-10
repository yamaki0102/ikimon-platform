import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import { clearPublicEnvironmentLayerCache, MSIL_SOURCE_NOTICE } from "../services/publicEnvironmentLayers.js";

async function withMockedFetch(
  fetchImpl: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const previousFetch = global.fetch;
  const previousKey = process.env.MSIL_API_SUBSCRIPTION_KEY;
  global.fetch = fetchImpl;
  process.env.MSIL_API_SUBSCRIPTION_KEY = "test-msil-key";
  clearPublicEnvironmentLayerCache();
  try {
    await run();
  } finally {
    global.fetch = previousFetch;
    clearPublicEnvironmentLayerCache();
    if (previousKey === undefined) {
      delete process.env.MSIL_API_SUBSCRIPTION_KEY;
    } else {
      process.env.MSIL_API_SUBSCRIPTION_KEY = previousKey;
    }
  }
}

test("public environment layers require a bounded bbox", async () => {
  const app = buildApp();
  try {
    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/map/public-environment-layers",
    });
    assert.equal(missing.statusCode, 400);
    assert.deepEqual(missing.json(), { error: "missing_or_invalid_bbox" });

    const tooLarge = await app.inject({
      method: "GET",
      url: "/api/v1/map/public-environment-layers?bbox=120,20,150,46",
    });
    assert.equal(tooLarge.statusCode, 400);
    assert.deepEqual(tooLarge.json(), { error: "bbox_too_large_or_invalid" });
  } finally {
    await app.close();
  }
});

test("public environment layers fail closed when the MSIL key is not configured", async () => {
  const previousKey = process.env.MSIL_API_SUBSCRIPTION_KEY;
  delete process.env.MSIL_API_SUBSCRIPTION_KEY;
  clearPublicEnvironmentLayerCache();
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/map/public-environment-layers?bbox=139.60,35.20,139.75,35.32&layers=msil_esi",
    });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), {
      error: "msil_subscription_key_not_configured",
      layers: [],
      notices: [],
    });
  } finally {
    await app.close();
    clearPublicEnvironmentLayerCache();
    if (previousKey === undefined) {
      delete process.env.MSIL_API_SUBSCRIPTION_KEY;
    } else {
      process.env.MSIL_API_SUBSCRIPTION_KEY = previousKey;
    }
  }
});

test("public environment layers proxy selected MSIL GeoJSON server-side", async () => {
  const requestedUrls: string[] = [];
  await withMockedFetch((async (input, init) => {
    const url = input instanceof URL ? input : new URL(String(input));
    requestedUrls.push(url.toString());
    assert.equal((init?.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"], "test-msil-key");
    assert.equal(url.hostname, "api.msil.go.jp");
    assert.equal(url.searchParams.get("f"), "geojson");
    assert.equal(url.searchParams.get("geometry"), "139.6,35.2,139.75,35.32");

    return new Response(JSON.stringify({
      type: "FeatureCollection",
      exceededTransferLimit: false,
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[139.6, 35.2], [139.7, 35.3]] },
          properties: { "esiランク": "1", "海岸地形": "岩礁" },
        },
      ],
    }), { status: 200, headers: { "content-type": "application/geo+json" } });
  }) as typeof fetch, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/map/public-environment-layers?bbox=139.60,35.20,139.75,35.32&layers=msil_esi",
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["cache-control"], "public, max-age=300");
      const payload = response.json();
      assert.deepEqual(payload.notices, [MSIL_SOURCE_NOTICE]);
      assert.equal(payload.layers.length, 1);
      assert.equal(payload.layers[0].id, "msil_esi");
      assert.equal(payload.layers[0].source, "msil_api");
      assert.equal(payload.layers[0].featureCount, 1);
      assert.equal(payload.layers[0].featureCollection.type, "FeatureCollection");
      assert.equal(payload.layers[0].featureCollection.features.length, 1);
      assert.equal(requestedUrls.length, 1);
      assert.match(requestedUrls[0] ?? "", /coastline-type-ESI\/v2\/MapServer\/1\/query/);
    } finally {
      await app.close();
    }
  });
});

test("public environment layers mark capped responses as truncated", async () => {
  const requestedUrls: string[] = [];
  const pageFeatures = Array.from({ length: 1000 }, (_, index) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [139.6 + index * 0.00001, 35.2] },
    properties: { index },
  }));

  await withMockedFetch((async (input) => {
    const url = input instanceof URL ? input : new URL(String(input));
    requestedUrls.push(url.toString());
    return new Response(JSON.stringify({
      type: "FeatureCollection",
      exceededTransferLimit: true,
      features: pageFeatures,
    }), { status: 200, headers: { "content-type": "application/geo+json" } });
  }) as typeof fetch, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/map/public-environment-layers?bbox=139.60,35.20,139.75,35.32&layers=msil_esi",
      });
      assert.equal(response.statusCode, 200);
      const payload = response.json();
      assert.equal(payload.layers[0].featureCount, 2000);
      assert.equal(payload.layers[0].truncated, true);
      assert.equal(requestedUrls.length, 2);
    } finally {
      await app.close();
    }
  });
});

test("public environment layers reject unsupported layer ids", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/map/public-environment-layers?bbox=139.60,35.20,139.75,35.32&layers=msil_esi,bdas_scrape",
    });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      error: "unsupported_public_environment_layers",
      invalidLayerIds: ["bdas_scrape"],
    });
  } finally {
    await app.close();
  }
});
