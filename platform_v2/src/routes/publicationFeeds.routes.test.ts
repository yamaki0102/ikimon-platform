import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import {
  encodePublicationFeedCursor,
  type PublicationFeedResponse,
} from "../services/publicationFeed.js";
import {
  registerPublicationFeedRoutes,
  type PublicationFeedRouteDependencies,
} from "./publicationFeeds.js";

const response: PublicationFeedResponse = {
  api_version: "1",
  feed: {
    feed_key: "miyakoda-renri-area",
    title: "この場所で見つけたもの",
    scope_label: "浜松・都田",
    updated_at: "2026-08-28T00:00:00.000Z",
    publication_policy_version: "public-feed-v1",
  },
  channels: [
    { key: "living", label: "この場所の生きもの", items: [] },
    { key: "community_photo", label: "みんなのフォト", items: [] },
  ],
  next_cursor: null,
};

async function withApp(
  dependencies: PublicationFeedRouteDependencies,
  run: (app: Awaited<ReturnType<typeof Fastify>>) => Promise<void>,
): Promise<void> {
  const app = Fastify({ logger: false });
  await registerPublicationFeedRoutes(app, dependencies);
  try {
    await run(app);
  } finally {
    await app.close();
  }
}

test("publication feed route returns the public envelope, cache headers, and CORS allowlist", async () => {
  let received: unknown;
  await withApp({
    async getFeed(input) {
      received = input;
      return response;
    },
  }, async (app) => {
    const result = await app.inject({
      method: "GET",
      url: "/api/v1/publication-feeds/miyakoda-renri-area?limit=2&channel=living",
      headers: { origin: "https://lenrinokinoshitade-top-staging.pages.dev" },
    });
    assert.equal(result.statusCode, 200);
    assert.match(String(result.headers["content-type"]), /application\/json/);
    assert.equal(result.headers["cache-control"], "public, max-age=60, stale-while-revalidate=300");
    assert.equal(result.headers["access-control-allow-origin"], "https://lenrinokinoshitade-top-staging.pages.dev");
    assert.match(String(result.headers.etag), /^"[0-9a-f]{64}"$/);
    assert.deepEqual(result.json(), response);
    assert.deepEqual(received, {
      feedKey: "miyakoda-renri-area",
      channel: "living",
      locale: undefined,
      limit: 2,
      cursor: null,
    });
  });
});
test("If-None-Match returns 304 for the same deterministic projection", async () => {
  await withApp({ getFeed: async () => response }, async (app) => {
    const first = await app.inject({ method: "GET", url: "/api/v1/publication-feeds/miyakoda-renri-area" });
    const cached = await app.inject({
      method: "GET",
      url: "/api/v1/publication-feeds/miyakoda-renri-area",
      headers: { "if-none-match": String(first.headers.etag) },
    });
    assert.equal(cached.statusCode, 304);
    assert.equal(cached.body, "");
    assert.equal(cached.headers.etag, first.headers.etag);
    assert.equal(cached.headers["cache-control"], "public, max-age=60, stale-while-revalidate=300");
  });
});

test("supported query values accept an opaque cursor while scope remains config-owned", async () => {
  let received: Record<string, unknown> | undefined;
  const cursor = encodePublicationFeedCursor({
    observedAt: "2026-08-01T00:00:00.000Z",
    recordId: "record-1",
    channel: "living",
  });
  await withApp({
    async getFeed(input) {
      received = input;
      return response;
    },
  }, async (app) => {
    const result = await app.inject({
      method: "GET",
      url: `/api/v1/publication-feeds/miyakoda-renri-area?locale=en&cursor=${cursor}&scope=outside-the-config`,
    });
    assert.equal(result.statusCode, 200);
    assert.equal(received?.feedKey, "miyakoda-renri-area");
    assert.equal(received?.locale, "en");
    assert.deepEqual(received?.cursor, {
      observedAt: "2026-08-01T00:00:00.000Z",
      recordId: "record-1",
      channel: "living",
    });
    assert.equal("scope" in (received ?? {}), false);
  });
});

test("malformed supported parameters are rejected without widening the feed", async () => {
  await withApp({ getFeed: async () => response }, async (app) => {
    for (const url of [
      "/api/v1/publication-feeds/miyakoda-renri-area?limit=0",
      "/api/v1/publication-feeds/miyakoda-renri-area?limit=25",
      "/api/v1/publication-feeds/miyakoda-renri-area?channel=private",
      "/api/v1/publication-feeds/miyakoda-renri-area?locale=fr",
      "/api/v1/publication-feeds/miyakoda-renri-area?cursor=not-a-cursor",
    ]) {
      const result = await app.inject({ method: "GET", url });
      assert.equal(result.statusCode, 400, url);
      assert.match(result.body, /invalid_publication_feed_/);
    }
  });
});

test("missing feeds are 404 and loader failures are an explicit 503", async () => {
  await withApp({ getFeed: async () => response }, async (app) => {
    const missing = await app.inject({ method: "GET", url: "/api/v1/publication-feeds/not-configured" });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error, "publication_feed_not_found");
  });

  await withApp({
    async getFeed() {
      throw new Error("database unavailable");
    },
  }, async (app) => {
    const unavailable = await app.inject({ method: "GET", url: "/api/v1/publication-feeds/miyakoda-renri-area" });
    assert.equal(unavailable.statusCode, 503);
    assert.equal(unavailable.headers["cache-control"], "no-store");
    assert.equal(unavailable.json().error, "publication_feed_unavailable");
  });
});
