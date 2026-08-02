import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { buildApp } from "../app.js";
import { addStagingRobotsMeta, isStagingRequest, stagingRobotsTxt } from "./siteMapRoutes.js";

test("staging classification uses host or explicit public origin, never an auth token", () => {
  assert.equal(isStagingRequest({ headers: { host: "staging.ikimon.life" } }, "https://ikimon.life"), true);
  assert.equal(isStagingRequest({ headers: { "x-forwarded-host": "staging.ikimon.life" } }, "https://ikimon.life"), true);
  assert.equal(isStagingRequest({ headers: { "x-forwarded-host": "staging.ikimon.life.attacker.example", host: "ikimon.life" } }, "https://ikimon.life"), false);
  assert.equal(isStagingRequest({ headers: { "x-forwarded-host": "ikimon.life", host: "staging.ikimon.life.attacker.example" } }, "https://ikimon.life"), false);
  assert.equal(isStagingRequest({ headers: { host: "ikimon.life" } }, "https://staging.ikimon.life"), true);
  assert.equal(isStagingRequest({ headers: { host: "ikimon.life" } }, "https://ikimon.life"), false);
  assert.equal(isStagingRequest({ headers: { host: "ikimon.life" } }, "materialize-admin-preview"), false);
});

test("staging robots stay deny-all while satisfying canonical static-origin audit", () => {
  const robots = stagingRobotsTxt();
  assert.match(robots, /^User-agent: \*\nDisallow: \/\n/);
  assert.match(robots, /# production-canonical-origin: https:\/\/ikimon\.life/);
  assert.doesNotMatch(robots, /Sitemap:|LLMs:/);
});

test("staging robots metadata normalizes every contradictory directive", () => {
  assert.equal(
    addStagingRobotsMeta('<html><head><meta name="robots" content="index"><meta content="follow" name="robots"></head></html>'),
    '<html><head>  <meta name="robots" content="noindex, nofollow" />\n</head></html>',
  );
  assert.equal(
    addStagingRobotsMeta("<html><head></head></html>"),
    '<html><head>  <meta name="robots" content="noindex, nofollow" />\n</head></html>',
  );
  assert.equal(
    addStagingRobotsMeta("<main>no head</main>"),
    '<meta name="robots" content="noindex, nofollow" />\n<main>no head</main>',
  );
});

test("staging denies indexing while production remains indexable", async () => {
  const app = buildApp();
  try {
    const stagingRoot = await app.inject({
      method: "GET",
      url: "/?lang=ja",
      headers: { host: "staging.ikimon.life", "x-forwarded-proto": "https", accept: "text/html" },
    });
    assert.equal(stagingRoot.statusCode, 200);
    assert.equal(stagingRoot.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(stagingRoot.body, /<meta name="robots" content="noindex, nofollow" \/>/);
    assert.equal((stagingRoot.body.match(/name="robots"/g) ?? []).length, 1);

    const stagingRobots = await app.inject({
      method: "GET",
      url: "/robots.txt",
      headers: { host: "staging.ikimon.life", "x-forwarded-proto": "https" },
    });
    assert.equal(stagingRobots.statusCode, 200);
    assert.match(stagingRobots.body, /^User-agent: \*\nDisallow: \/\n/);
    assert.equal(stagingRobots.headers["x-robots-tag"], "noindex, nofollow");
    assert.doesNotMatch(stagingRobots.body, /Sitemap:|LLMs:/);

    const productionRoot = await app.inject({
      method: "GET",
      url: "/?lang=ja",
      headers: { host: "ikimon.life", "x-forwarded-proto": "https", accept: "text/html" },
    });
    assert.equal(productionRoot.statusCode, 200);
    assert.equal(productionRoot.headers["x-robots-tag"], undefined);
    assert.doesNotMatch(productionRoot.body, /<meta name="robots" content="noindex, nofollow" \/>/);

    const productionRobots = await app.inject({
      method: "GET",
      url: "/robots.txt",
      headers: { host: "ikimon.life", "x-forwarded-proto": "https" },
    });
    assert.equal(productionRobots.statusCode, 200);
    assert.equal(productionRobots.headers["x-robots-tag"], undefined);
    assert.match(productionRobots.body, /Sitemap: https:\/\/ikimon\.life\/sitemap\.xml/);
  } finally {
    await app.close();
  }
});

test("staging robots onSend hook leaves streamed assets single-finalized", async () => {
  const app = buildApp();
  app.get("/__zukan-on-send-stream-test", async (_request, reply) => {
    reply.type("application/octet-stream");
    return Readable.from([Buffer.from("stream-safe")]);
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/__zukan-on-send-stream-test",
      headers: { host: "staging.ikimon.life", "x-forwarded-proto": "https" },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, "stream-safe");
    assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
  } finally {
    await app.close();
  }
});
