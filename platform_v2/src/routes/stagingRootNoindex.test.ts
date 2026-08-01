import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

test("staging root Home is noindex while production root remains indexable", async () => {
  const app = buildApp();
  try {
    const staging = await app.inject({
      method: "GET",
      url: "/?lang=ja",
      headers: { host: "staging.ikimon.life", "x-forwarded-proto": "https", accept: "text/html" },
    });
    assert.equal(staging.statusCode, 200);
    assert.equal(staging.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(staging.body, /<meta name="robots" content="noindex, nofollow" \/>/);

    const production = await app.inject({
      method: "GET",
      url: "/?lang=ja",
      headers: { host: "ikimon.life", "x-forwarded-proto": "https", accept: "text/html" },
    });
    assert.equal(production.statusCode, 200);
    assert.equal(production.headers["x-robots-tag"], undefined);
    assert.doesNotMatch(production.body, /<meta name="robots" content="noindex, nofollow" \/>/);
  } finally {
    await app.close();
  }
});
