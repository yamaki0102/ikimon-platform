import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

const RUNTIME_ORIGIN_HEADER = "x-ikimon-runtime-public-origin";

test("production robots and LLM discovery keep production canonical links under forwarded spoofing", async () => {
  const app = buildApp();
  try {
    const robots = await app.inject({
      method: "GET",
      url: "/robots.txt",
      headers: {
        host: "ikimon.life",
        "x-forwarded-host": "staging.ikimon.life",
        "x-forwarded-proto": "http",
      },
    });
    assert.equal(robots.statusCode, 200);
    assert.equal(robots.headers["x-robots-tag"], undefined);
    assert.match(robots.body, /Sitemap: https:\/\/ikimon\.life\/sitemap\.xml/);
    assert.match(robots.body, /LLMs: https:\/\/ikimon\.life\/llms\.txt/);
    assert.doesNotMatch(robots.body, /staging\.ikimon\.life/);

    const llms = await app.inject({
      method: "GET",
      url: "/llms.txt",
      headers: {
        host: "ikimon.life",
        "x-forwarded-host": "staging.ikimon.life",
        "x-forwarded-proto": "http",
      },
    });
    assert.equal(llms.statusCode, 200);
    assert.match(llms.body, /https:\/\/ikimon\.life\/llms\/guide\.md/);
    assert.doesNotMatch(llms.body, /staging\.ikimon\.life/);
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
    assert.match(llms.body, /https:\/\/staging\.ikimon\.life\/llms\/guide\.md/);
    assert.doesNotMatch(llms.body, /https:\/\/ikimon\.life\/llms\/guide\.md/);
  } finally {
    await app.close();
  }
});

test("legacy fallback marker and forwarded host no longer establish trust", async () => {
  const app = buildApp();
  try {
    const llms = await app.inject({
      method: "GET",
      url: "/llms.txt",
      headers: {
        host: "internal-origin.invalid",
        "x-ikimon-cloudflare-fallback": "origin",
        "x-forwarded-host": "ikimon.life",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(llms.statusCode, 200);
    assert.equal(llms.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(llms.body, /https:\/\/staging\.ikimon\.life\/llms\/guide\.md/);
    assert.doesNotMatch(llms.body, /https:\/\/ikimon\.life\/llms\/guide\.md/);
  } finally {
    await app.close();
  }
});

test("nginx-bound runtime origin selects staging and overrides forwarded values", async () => {
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
    assert.match(llms.body, /https:\/\/staging\.ikimon\.life\/llms\/guide\.md/);
    assert.doesNotMatch(llms.body, /https:\/\/ikimon\.life\/llms\/guide\.md/);
  } finally {
    await app.close();
  }
});

test("production runtime binding overrides a spoofed staging Host", async () => {
  const app = buildApp();
  try {
    const robots = await app.inject({
      method: "GET",
      url: "/robots.txt",
      headers: {
        host: "staging.ikimon.life",
        [RUNTIME_ORIGIN_HEADER]: "https://ikimon.life",
      },
    });
    assert.equal(robots.statusCode, 200);
    assert.equal(robots.headers["x-robots-tag"], undefined);
    assert.match(robots.body, /Sitemap: https:\/\/ikimon\.life\/sitemap\.xml/);
    assert.doesNotMatch(robots.body, /staging\.ikimon\.life/);
  } finally {
    await app.close();
  }
});
