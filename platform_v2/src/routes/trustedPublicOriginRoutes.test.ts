import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

const RUNTIME_ORIGIN_HEADER = "x-ikimon-runtime-public-origin";

test("production robots and LLM discovery use zukan.earth canonical links from either production host", async () => {
  const app = buildApp();
  try {
    for (const host of ["zukan.earth", "ikimon.life"]) {
      const robots = await app.inject({
        method: "GET",
        url: "/robots.txt",
        headers: {
          host,
          "x-forwarded-host": "staging.ikimon.life",
          "x-forwarded-proto": "http",
        },
      });
      assert.equal(robots.statusCode, 200);
      assert.equal(robots.headers["x-robots-tag"], undefined);
      assert.match(robots.body, /Sitemap: https:\/\/zukan\.earth\/sitemap\.xml/);
      assert.match(robots.body, /LLMs: https:\/\/zukan\.earth\/llms\.txt/);
      assert.doesNotMatch(robots.body, /staging\.(?:zukan\.earth|ikimon\.life)/);

      const llms = await app.inject({
        method: "GET",
        url: "/llms.txt",
        headers: {
          host,
          "x-forwarded-host": "staging.ikimon.life",
          "x-forwarded-proto": "http",
        },
      });
      assert.equal(llms.statusCode, 200);
      assert.match(llms.body, /https:\/\/zukan\.earth\/llms\/guide\.md/);
      assert.doesNotMatch(llms.body, /https:\/\/ikimon\.life\/llms\/guide\.md/);
    }
  } finally {
    await app.close();
  }
});

test("unknown internal origin fails closed to staging presentation", async () => {
  const app = buildApp();
  try {
    const llms = await app.inject({
      method: "GET",
      url: "/llms.txt",
      headers: {
        host: "internal-origin.invalid",
        "x-forwarded-host": "ikimon.life",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(llms.statusCode, 200);
    assert.equal(llms.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(llms.body, /https:\/\/staging\.zukan\.earth\/llms\/guide\.md/);
    assert.doesNotMatch(llms.body, /https:\/\/zukan\.earth\/llms\/guide\.md/);
  } finally {
    await app.close();
  }
});

test("legacy fallback marker and forwarded host do not establish presentation trust", async () => {
  const app = buildApp();
  try {
    const llms = await app.inject({
      method: "GET",
      url: "/llms.txt",
      headers: {
        host: "internal-origin.invalid",
        "x-ikimon-cloudflare-fallback": "origin",
        "x-forwarded-host": "zukan.earth",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(llms.statusCode, 200);
    assert.equal(llms.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(llms.body, /https:\/\/staging\.zukan\.earth\/llms\/guide\.md/);
    assert.doesNotMatch(llms.body, /https:\/\/zukan\.earth\/llms\/guide\.md/);
  } finally {
    await app.close();
  }
});

test("legacy nginx-bound staging identity remains auth-compatible but canonicalizes presentation", async () => {
  const app = buildApp();
  try {
    const llms = await app.inject({
      method: "GET",
      url: "/llms.txt",
      headers: {
        host: "internal-origin.invalid",
        [RUNTIME_ORIGIN_HEADER]: "https://staging.ikimon.life",
        "x-ikimon-cloudflare-fallback": "origin",
        "x-forwarded-host": "ikimon.life",
        "x-forwarded-proto": "http",
      },
    });
    assert.equal(llms.statusCode, 200);
    assert.equal(llms.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(llms.body, /https:\/\/staging\.zukan\.earth\/llms\/guide\.md/);
    assert.doesNotMatch(llms.body, /https:\/\/staging\.ikimon\.life\/llms\/guide\.md/);
  } finally {
    await app.close();
  }
});

test("legacy production runtime binding canonicalizes presentation to zukan.earth", async () => {
  const app = buildApp();
  try {
    const robots = await app.inject({
      method: "GET",
      url: "/robots.txt",
      headers: {
        host: "staging.zukan.earth",
        [RUNTIME_ORIGIN_HEADER]: "https://ikimon.life",
      },
    });
    assert.equal(robots.statusCode, 200);
    assert.equal(robots.headers["x-robots-tag"], undefined);
    assert.match(robots.body, /Sitemap: https:\/\/zukan\.earth\/sitemap\.xml/);
    assert.doesNotMatch(robots.body, /ikimon\.life/);
  } finally {
    await app.close();
  }
});
