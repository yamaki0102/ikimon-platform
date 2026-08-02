import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { assertSameOriginRequest } from "./authSecurity.js";
import { oauthRedirectUri } from "./oauthFlow.js";

function request(headers: Record<string, string | string[]>, protocol = "http"): FastifyRequest {
  return { headers, protocol } as FastifyRequest;
}

async function withNodeEnv(value: string | undefined, run: () => void): Promise<void> {
  const previous = process.env.NODE_ENV;
  if (value === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

test("OAuth localhost fallback is disabled in production", async () => {
  await withNodeEnv("production", () => {
    for (const host of ["localhost:3200", "127.0.0.1:3200", "[::1]:3200"]) {
      assert.throws(
        () => oauthRedirectUri(request({ host }), "google"),
        /public_origin_untrusted/,
        host,
      );
    }
  });

  await withNodeEnv("test", () => {
    assert.equal(
      oauthRedirectUri(request({ host: "localhost:3200" }), "google"),
      "http://localhost:3200/oauth_callback.php?provider=google",
    );
  });
});

test("same-origin checks reject ambiguous Origin and Sec-Fetch-Site headers", () => {
  for (const headers of [
    {
      host: "ikimon.life",
      origin: "https://ikimon.life,https://evil.example",
      "sec-fetch-site": "same-origin",
    },
    {
      host: "ikimon.life",
      origin: ["https://ikimon.life", "https://evil.example"],
      "sec-fetch-site": "same-origin",
    },
    {
      host: "ikimon.life",
      origin: "https://ikimon.life",
      "sec-fetch-site": "same-origin,cross-site",
    },
    {
      host: "ikimon.life",
      origin: "https://ikimon.life",
      "sec-fetch-site": ["same-origin", "cross-site"],
    },
  ]) {
    assert.throws(
      () => assertSameOriginRequest(request(headers)),
      /same_origin_required/,
    );
  }
});
