import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

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

test("unmarked internal forwarded host cannot select staging presentation", async () => {
  const app = buildApp();
  try {
    const llms = await app.inject({
      method: "GET",
      url: "/llms.txt",
      headers: {
        host: "internal-origin.invalid",
        "x-forwarded-host": "staging.ikimon.life",
        "x-forwarded-proto": "http",
      },
    });
    assert.equal(llms.statusCode, 200);
    assert.equal(llms.headers["x-robots-tag"], undefined);
    assert.match(llms.body, /https:\/\/ikimon\.life\/llms\/guide\.md/);
    assert.doesNotMatch(llms.body, /staging\.ikimon\.life/);
  } finally {
    await app.close();
  }
});

test("staging LLM discovery uses staging origin on the trusted Worker-to-origin hop", async () => {
  const app = buildApp();
  try {
    const llms = await app.inject({
      method: "GET",
      url: "/llms.txt",
      headers: {
        host: "internal-origin.invalid",
        "x-ikimon-cloudflare-fallback": "origin",
        "x-forwarded-host": "staging.ikimon.life",
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
