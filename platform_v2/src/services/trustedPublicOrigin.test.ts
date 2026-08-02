import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { assertSameOriginRequest } from "./authSecurity.js";
import { resolveTrustedPublicOrigin } from "./trustedPublicOrigin.js";

function request(headers: Record<string, string>, protocol = "http"): FastifyRequest {
  return { headers, protocol } as FastifyRequest;
}

test("trusted public origin cannot be switched by forwarded headers", () => {
  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "ikimon.life",
      "x-forwarded-host": "staging.ikimon.life",
      "x-forwarded-proto": "javascript",
    })),
    "https://ikimon.life",
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "staging.ikimon.life",
      "x-forwarded-host": "ikimon.life",
      "x-forwarded-proto": "http",
    })),
    "https://staging.ikimon.life",
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "internal-origin.invalid",
      "x-forwarded-host": "staging.ikimon.life",
      "x-forwarded-proto": "http",
    })),
    "https://staging.ikimon.life",
  );
  assert.equal(
    resolveTrustedPublicOrigin(
      request({ host: "ikimon.life", "x-forwarded-host": "evil.example" }),
      { explicitOrigin: "https://staging.ikimon.life/" },
    ),
    "https://staging.ikimon.life",
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({ host: "internal-origin.invalid", "x-forwarded-host": "evil.example" })),
    null,
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({ host: "localhost:3200", "x-forwarded-host": "evil.example" }), { allowLocalDevelopment: true }),
    "http://localhost:3200",
  );
});

test("same-origin auth checks use the trusted public origin", () => {
  const production = request({
    host: "ikimon.life",
    origin: "https://ikimon.life",
    "x-forwarded-host": "staging.ikimon.life",
    "x-forwarded-proto": "http",
    "sec-fetch-site": "same-origin",
  });
  assert.doesNotThrow(() => assertSameOriginRequest(production));

  const forwardedEnvironmentSpoof = request({
    host: "ikimon.life",
    origin: "https://staging.ikimon.life",
    "x-forwarded-host": "staging.ikimon.life",
    "x-forwarded-proto": "https",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(forwardedEnvironmentSpoof), /same_origin_required/);

  const trustedWorkerHop = request({
    host: "internal-origin.invalid",
    origin: "https://staging.ikimon.life",
    "x-forwarded-host": "staging.ikimon.life",
    "x-forwarded-proto": "http",
    "sec-fetch-site": "same-origin",
  });
  assert.doesNotThrow(() => assertSameOriginRequest(trustedWorkerHop));

  const arbitraryForwardedOrigin = request({
    host: "internal-origin.invalid",
    origin: "https://evil.example",
    "x-forwarded-host": "evil.example",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(arbitraryForwardedOrigin), /same_origin_required/);
});
