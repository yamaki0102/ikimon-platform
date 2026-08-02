import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { assertSameOriginRequest } from "./authSecurity.js";
import {
  RUNTIME_PUBLIC_ORIGIN_HEADER,
  resolvePresentationPublicOrigin,
  resolveTrustedPublicOrigin,
} from "./trustedPublicOrigin.js";

function request(headers: Record<string, string>, protocol = "http"): FastifyRequest {
  return { headers, protocol } as FastifyRequest;
}

test("security origin prioritizes bound runtime, then explicit config, direct host, or exact local identity", () => {
  assert.equal(resolveTrustedPublicOrigin(request({ host: "ikimon.life" })), "https://ikimon.life");
  assert.equal(resolveTrustedPublicOrigin(request({ host: "www.ikimon.life" })), "https://ikimon.life");
  assert.equal(resolveTrustedPublicOrigin(request({ host: "staging.ikimon.life" })), "https://staging.ikimon.life");

  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "staging.ikimon.life",
      [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://ikimon.life",
    })),
    "https://ikimon.life",
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "internal-origin.invalid",
      [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://staging.ikimon.life",
    })),
    "https://staging.ikimon.life",
  );

  for (const host of [
    "ikimon.life.attacker.example",
    "staging.ikimon.life.attacker.example",
    "attacker-ikimon.life",
    "ikimon.life,attacker.example",
    "attacker.example@ikimon.life",
    "ikimon.life/path",
    "ikimon.life:444",
  ]) {
    assert.equal(resolveTrustedPublicOrigin(request({ host })), null, host);
  }

  assert.equal(
    resolveTrustedPublicOrigin(
      request({
        host: "attacker.example",
        [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://ikimon.life",
      }),
      { explicitOrigin: "https://staging.ikimon.life/" },
    ),
    "https://ikimon.life",
  );
  assert.equal(
    resolveTrustedPublicOrigin(
      request({ host: "attacker.example" }),
      { explicitOrigin: "https://staging.ikimon.life/" },
    ),
    "https://staging.ikimon.life",
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({ host: "localhost:3200" }), { allowLocalDevelopment: true }),
    "http://localhost:3200",
  );
  assert.equal(resolveTrustedPublicOrigin(request({ host: "localhost:3200" })), null);
  assert.throws(
    () => resolveTrustedPublicOrigin(
      request({ host: "internal-origin.invalid" }),
      { allowLocalDevelopment: true },
    ),
    /public_origin_untrusted/,
  );
});

test("unsigned marker and forwarded identity are ignored for security and presentation", () => {
  const workerHop = request({
    host: "internal-origin.invalid",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "staging.ikimon.life",
    "x-forwarded-proto": "https",
  });
  assert.equal(resolveTrustedPublicOrigin(workerHop), null);
  assert.equal(resolvePresentationPublicOrigin(workerHop), null);

  const boundWorkerHop = request({
    host: "internal-origin.invalid",
    [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://staging.ikimon.life",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "ikimon.life",
    "x-forwarded-proto": "javascript",
  });
  assert.equal(resolveTrustedPublicOrigin(boundWorkerHop), "https://staging.ikimon.life");
  assert.equal(resolvePresentationPublicOrigin(boundWorkerHop), "https://staging.ikimon.life");

  for (const runtimeOrigin of [
    "https://evil.example",
    "https://ikimon.life.evil.example",
    "http://ikimon.life",
    "https://ikimon.life/path",
  ]) {
    assert.equal(
      resolvePresentationPublicOrigin(request({
        host: "internal-origin.invalid",
        [RUNTIME_PUBLIC_ORIGIN_HEADER]: runtimeOrigin,
      })),
      null,
      runtimeOrigin,
    );
  }
});

test("same-origin auth checks use the nginx-bound origin and ignore unsigned marker", () => {
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

  const unsignedWorkerHop = request({
    host: "internal-origin.invalid",
    origin: "https://staging.ikimon.life",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "staging.ikimon.life",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(unsignedWorkerHop), /same_origin_required/);

  const productionBindingOverridesSpoofedHost = request({
    host: "staging.ikimon.life",
    origin: "https://staging.ikimon.life",
    [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://ikimon.life",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(productionBindingOverridesSpoofedHost), /same_origin_required/);
});
