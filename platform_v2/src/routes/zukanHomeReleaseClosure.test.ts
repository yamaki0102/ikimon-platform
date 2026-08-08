import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { buildApp } from "../app.js";
import { addStagingRobotsMeta, isStagingRequest, stagingRobotsTxt } from "./siteMapRoutes.js";

test("staging classification uses canonical or legacy explicit/bound origin and fails closed on unknown hosts", () => {
  assert.equal(isStagingRequest({ headers: { host: "staging.ikimon.life" } }, "https://ikimon.life"), false);
  assert.equal(isStagingRequest({ headers: { host: "ikimon.life" } }, "https://staging.ikimon.life"), true);
  assert.equal(isStagingRequest({ headers: { host: "staging.zukan.earth" } }, "https://zukan.earth"), false);
  assert.equal(isStagingRequest({ headers: { host: "zukan.earth" } }, "https://staging.zukan.earth"), true);

  assert.equal(isStagingRequest({ headers: { host: "staging.zukan.earth" } }, ""), true);
  assert.equal(isStagingRequest({ headers: { host: "staging.ikimon.life" } }, ""), true);
  assert.equal(isStagingRequest({ headers: { host: "zukan.earth" } }, ""), false);
  assert.equal(isStagingRequest({ headers: { host: "ikimon.life" } }, ""), false);
  assert.equal(isStagingRequest({ headers: { host: "ikimon.life", "x-forwarded-host": "staging.zukan.earth" } }, ""), false);
  assert.equal(isStagingRequest({ headers: { host: "staging.zukan.earth", "x-forwarded-host": "ikimon.life" } }, ""), true);

  assert.equal(isStagingRequest({ headers: { host: "internal-origin.invalid", "x-forwarded-host": "zukan.earth" } }, ""), true);
  assert.equal(isStagingRequest({ headers: {
    host: "internal-origin.invalid",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "zukan.earth",
  } }, ""), true);

  assert.equal(isStagingRequest({ headers: {
    host: "zukan.earth",
    "x-ikimon-runtime-public-origin": "https://staging.ikimon.life",
  } }, ""), true);
  assert.equal(isStagingRequest({ headers: {
    host: "staging.zukan.earth",
    "x-ikimon-runtime-public-origin": "https://ikimon.life",
  } }, ""), false);

  assert.equal(isStagingRequest({ headers: {
    host: "zukan.earth",
    "x-ikimon-runtime-public-origin": "https://staging.zukan.earth",
  } }, "https://ikimon.life"), true);
  assert.equal(isStagingRequest({ headers: {
    host: "staging.zukan.earth",
    "x-ikimon-runtime-public-origin": "https://zukan.earth",
  } }, "https://staging.ikimon.life"), false);

  assert.equal(isStagingRequest({ headers: { "x-forwarded-host": "staging.zukan.earth.attacker.example", host: "zukan.earth" } }, ""), false);
  assert.equal(isStagingRequest({ headers: { "x-forwarded-host": "zukan.earth", host: "staging.zukan.earth.attacker.example" } }, ""), true);
  assert.equal(isStagingRequest({ headers: { host: "zukan.earth" } }, "materialize-admin-preview"), false);
});

test("staging robots stay deny-all while satisfying canonical static-origin audit", () => {
  const robots = stagingRobotsTxt();
  assert.match(robots, /^User-agent: \*\nDisallow: \/\n/);
  assert.match(robots, /# production-canonical-origin: https:\/\/zukan\.earth/);
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

test("both staging hosts deny indexing while both production hosts stay indexable", async () => {
  const app = buildApp();
  try {
    for (const host of ["staging.zukan.earth", "staging.ikimon.life"]) {
      const stagingRoot = await app.inject({
        method: "GET",
        url: "/?lang=ja",
        headers: { host, "x-forwarded-host": "zukan.earth", "x-forwarded-proto": "http", accept: "text/html" },
      });
      assert.equal(stagingRoot.statusCode, 200, host);
      assert.equal(stagingRoot.headers["x-robots-tag"], "noindex, nofollow", host);
      assert.match(stagingRoot.body, /<meta name="robots" content="noindex, nofollow" \/>/, host);
      assert.equal((stagingRoot.body.match(/name="robots"/g) ?? []).length, 1, host);

      const stagingRobots = await app.inject({
        method: "GET",
        url: "/robots.txt",
        headers: { host, "x-forwarded-host": "zukan.earth", "x-forwarded-proto": "http" },
      });
      assert.equal(stagingRobots.statusCode, 200, host);
      assert.match(stagingRobots.body, /^User-agent: \*\nDisallow: \/\n/, host);
      assert.equal(stagingRobots.headers["x-robots-tag"], "noindex, nofollow", host);
      assert.doesNotMatch(stagingRobots.body, /Sitemap:|LLMs:/, host);
    }

    for (const host of ["zukan.earth", "ikimon.life"]) {
      const productionRoot = await app.inject({
        method: "GET",
        url: "/?lang=ja",
        headers: { host, "x-forwarded-host": "staging.zukan.earth", "x-forwarded-proto": "http", accept: "text/html" },
      });
      assert.equal(productionRoot.statusCode, 200, host);
      assert.equal(productionRoot.headers["x-robots-tag"], undefined, host);
      assert.doesNotMatch(productionRoot.body, /<meta name="robots" content="noindex, nofollow" \/>/, host);

      const productionRobots = await app.inject({
        method: "GET",
        url: "/robots.txt",
        headers: { host, "x-forwarded-host": "staging.zukan.earth", "x-forwarded-proto": "http" },
      });
      assert.equal(productionRobots.statusCode, 200, host);
      assert.equal(productionRobots.headers["x-robots-tag"], undefined, host);
      assert.match(productionRobots.body, /Sitemap: https:\/\/zukan\.earth\/sitemap\.xml/, host);
      assert.match(productionRobots.body, /LLMs: https:\/\/zukan\.earth\/llms\.txt/, host);
      assert.doesNotMatch(productionRobots.body, /staging\.(?:zukan\.earth|ikimon\.life)/, host);
    }
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
  app.get("/__zukan-on-send-svg-test", async (_request, reply) => {
    reply.type("image/svg+xml");
    return "<svg/>";
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/__zukan-on-send-stream-test",
      headers: { host: "staging.zukan.earth", "x-forwarded-proto": "https" },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, "stream-safe");
    assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");

    const svgResponse = await app.inject({
      method: "GET",
      url: "/__zukan-on-send-svg-test",
      headers: { host: "staging.zukan.earth", "x-forwarded-proto": "https" },
    });
    assert.equal(svgResponse.statusCode, 200);
    assert.equal(svgResponse.body, "<svg/>");
    assert.doesNotMatch(svgResponse.body, /<meta name="robots"/);
    assert.equal(svgResponse.headers["x-robots-tag"], "noindex, nofollow");
  } finally {
    await app.close();
  }
});
