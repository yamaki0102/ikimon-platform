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

test("security origin keeps the actual trusted host while presentation canonicalizes to zukan.earth", () => {
  assert.equal(resolveTrustedPublicOrigin(request({ host: "zukan.earth" })), "https://zukan.earth");
  assert.equal(resolveTrustedPublicOrigin(request({ host: "ikimon.life" })), "https://ikimon.life");
  assert.equal(resolveTrustedPublicOrigin(request({ host: "www.ikimon.life" })), "https://ikimon.life");
  assert.equal(resolveTrustedPublicOrigin(request({ host: "staging.zukan.earth" })), "https://staging.zukan.earth");
  assert.equal(resolveTrustedPublicOrigin(request({ host: "staging.ikimon.life" })), "https://staging.ikimon.life");

  assert.equal(resolvePresentationPublicOrigin(request({ host: "zukan.earth" })), "https://zukan.earth");
  assert.equal(resolvePresentationPublicOrigin(request({ host: "ikimon.life" })), "https://zukan.earth");
  assert.equal(resolvePresentationPublicOrigin(request({ host: "www.ikimon.life" })), "https://zukan.earth");
  assert.equal(resolvePresentationPublicOrigin(request({ host: "staging.zukan.earth" })), "https://staging.zukan.earth");
  assert.equal(resolvePresentationPublicOrigin(request({ host: "staging.ikimon.life" })), "https://staging.zukan.earth");
});

test("security origin prioritizes bound runtime, then explicit config, direct host, or exact local identity", () => {
  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "staging.zukan.earth",
      [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://zukan.earth",
    })),
    "https://zukan.earth",
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({
      host: "internal-origin.invalid",
      [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://staging.ikimon.life",
    })),
    "https://staging.ikimon.life",
  );
  assert.equal(
    resolvePresentationPublicOrigin(request({
      host: "internal-origin.invalid",
      [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://staging.ikimon.life",
    })),
    "https://staging.zukan.earth",
  );

  for (const host of [
    "zukan.earth.attacker.example",
    "ikimon.life.attacker.example",
    "staging.zukan.earth.attacker.example",
    "staging.ikimon.life.attacker.example",
    "attacker-zukan.earth",
    "ikimon.life,attacker.example",
    "attacker.example@zukan.earth",
    "zukan.earth/path",
    "zukan.earth:444",
  ]) {
    assert.equal(resolveTrustedPublicOrigin(request({ host })), null, host);
  }

  assert.equal(
    resolveTrustedPublicOrigin(
      request({
        host: "attacker.example",
        [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://ikimon.life",
      }),
      { explicitOrigin: "https://staging.zukan.earth/" },
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
    resolvePresentationPublicOrigin(
      request({ host: "attacker.example" }),
      { explicitOrigin: "https://staging.ikimon.life/" },
    ),
    "https://staging.zukan.earth",
  );
  assert.equal(
    resolveTrustedPublicOrigin(request({ host: "localhost:3200" }), { allowLocalDevelopment: true }),
    "http://localhost:3200",
  );
  assert.equal(resolvePresentationPublicOrigin(request({ host: "localhost:3200" }), { allowLocalDevelopment: true }), "http://localhost:3200");
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
    "x-forwarded-host": "staging.zukan.earth",
    "x-forwarded-proto": "https",
  });
  assert.equal(resolveTrustedPublicOrigin(workerHop), null);
  assert.equal(resolvePresentationPublicOrigin(workerHop), null);

  const boundWorkerHop = request({
    host: "internal-origin.invalid",
    [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://staging.ikimon.life",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "zukan.earth",
    "x-forwarded-proto": "javascript",
  });
  assert.equal(resolveTrustedPublicOrigin(boundWorkerHop), "https://staging.ikimon.life");
  assert.equal(resolvePresentationPublicOrigin(boundWorkerHop), "https://staging.zukan.earth");

  for (const runtimeOrigin of [
    "https://evil.example",
    "https://zukan.earth.evil.example",
    "http://zukan.earth",
    "https://zukan.earth/path",
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

test("same-origin auth checks remain host-bound during the migration", () => {
  const newProduction = request({
    host: "zukan.earth",
    origin: "https://zukan.earth",
    "x-forwarded-host": "ikimon.life",
    "x-forwarded-proto": "http",
    "sec-fetch-site": "same-origin",
  });
  assert.doesNotThrow(() => assertSameOriginRequest(newProduction));

  const legacyProduction = request({
    host: "ikimon.life",
    origin: "https://ikimon.life",
    "x-forwarded-host": "zukan.earth",
    "x-forwarded-proto": "http",
    "sec-fetch-site": "same-origin",
  });
  assert.doesNotThrow(() => assertSameOriginRequest(legacyProduction));

  const crossHostProduction = request({
    host: "ikimon.life",
    origin: "https://zukan.earth",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(crossHostProduction), /same_origin_required/);

  const boundLegacyStagingRuntime = request({
    host: "internal-origin.invalid",
    origin: "https://staging.ikimon.life",
    [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://staging.ikimon.life",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "zukan.earth",
    "sec-fetch-site": "same-origin",
  });
  assert.doesNotThrow(() => assertSameOriginRequest(boundLegacyStagingRuntime));

  const boundNewStagingRuntime = request({
    host: "internal-origin.invalid",
    origin: "https://staging.zukan.earth",
    [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://staging.zukan.earth",
    "sec-fetch-site": "same-origin",
  });
  assert.doesNotThrow(() => assertSameOriginRequest(boundNewStagingRuntime));

  const unsignedWorkerHop = request({
    host: "internal-origin.invalid",
    origin: "https://staging.zukan.earth",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "staging.zukan.earth",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(unsignedWorkerHop), /same_origin_required/);

  const productionBindingOverridesSpoofedHost = request({
    host: "staging.zukan.earth",
    origin: "https://staging.zukan.earth",
    [RUNTIME_PUBLIC_ORIGIN_HEADER]: "https://zukan.earth",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(productionBindingOverridesSpoofedHost), /same_origin_required/);
});
