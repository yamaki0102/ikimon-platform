import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { assertSameOriginRequest } from "./authSecurity.js";
import { RUNTIME_PUBLIC_ORIGIN_HEADER, resolveTrustedPublicOrigin } from "./trustedPublicOrigin.js";

function request(headers: Record<string, string>, protocol = "http"): FastifyRequest {
  return { headers, protocol } as FastifyRequest;
}

test("trusted public origin cannot be switched by forwarded headers or the legacy marker", () => {
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
    null,
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "internal-origin.invalid",
      "x-ikimon-cloudflare-fallback": "origin",
      "x-forwarded-host": "staging.ikimon.life",
      "x-forwarded-proto": "http",
    })),
    null,
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "internal-origin.invalid",
      [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://staging.ikimon.life",
      "x-forwarded-host": "ikimon.life",
    })),
    "https://staging.ikimon.life",
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "staging.ikimon.life",
      [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://ikimon.life",
    })),
    "https://ikimon.life",
  );
  assert.equal(
    resolveTrustedPublicOrigin(
      request({
        host: "ikimon.life",
        [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://ikimon.life",
        "x-forwarded-host": "evil.example",
      }),
      { explicitOrigin: "https://staging.ikimon.life/" },
    ),
    "https://staging.ikimon.life",
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "internal-origin.invalid",
      [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://evil.example",
    })),
    null,
  );
  assert.equal(
    resolveTrustedPublicOrigin(
      request({ host: "localhost:3200", "x-forwarded-host": "staging.ikimon.life" }),
      { allowLocalDevelopment: true },
    ),
    "http://localhost:3200",
  );
});

test("same-origin auth checks use the bound runtime public origin", () => {
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

  const boundStagingRuntime = request({
    host: "internal-origin.invalid",
    origin: "https://staging.ikimon.life",
    [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://staging.ikimon.life",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "ikimon.life",
    "sec-fetch-site": "same-origin",
  });
  assert.doesNotThrow(() => assertSameOriginRequest(boundStagingRuntime));

  const legacyMarkerSpoof = request({
    host: "internal-origin.invalid",
    origin: "https://staging.ikimon.life",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "staging.ikimon.life",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(legacyMarkerSpoof), /same_origin_required/);

  const productionBindingOverridesSpoofedHost = request({
    host: "staging.ikimon.life",
    origin: "https://staging.ikimon.life",
    [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://ikimon.life",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(productionBindingOverridesSpoofedHost), /same_origin_required/);

  const arbitraryRuntimeOrigin = request({
    host: "internal-origin.invalid",
    origin: "https://evil.example",
    [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://evil.example",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(arbitraryRuntimeOrigin), /same_origin_required/);
});
