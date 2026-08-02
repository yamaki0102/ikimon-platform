import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import { addStagingRobotsMeta } from "./siteMapRoutes.js";

test("staging robots metadata replaces any contradictory index directive", () => {
  assert.equal(
    addStagingRobotsMeta('<html><head><meta name="robots" content="index, follow"></head></html>'),
    '<html><head><meta name="robots" content="noindex, nofollow" /></head></html>',
  );
  assert.equal(
    addStagingRobotsMeta("<html><head></head></html>"),
    '<html><head>  <meta name="robots" content="noindex, nofollow" />\n</head></html>',
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

    const stagingRobots = await app.inject({
      method: "GET",
      url: "/robots.txt",
      headers: { host: "staging.ikimon.life", "x-forwarded-proto": "https" },
    });
    assert.equal(stagingRobots.statusCode, 200);
    assert.equal(stagingRobots.body, "User-agent: *\nDisallow: /\n");
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
