import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { assertSameOriginRequest } from "./authSecurity.js";
import {
  resolvePresentationPublicOrigin,
  resolveTrustedPublicOrigin,
} from "./trustedPublicOrigin.js";

function request(headers: Record<string, string>, protocol = "http"): FastifyRequest {
  return { headers, protocol } as FastifyRequest;
}

test("security origin uses only explicit, direct allowlisted, or explicit local identity", () => {
  assert.equal(resolveTrustedPublicOrigin(request({ host: "ikimon.life" })), "https://ikimon.life");
  assert.equal(resolveTrustedPublicOrigin(request({ host: "www.ikimon.life" })), "https://ikimon.life");
  assert.equal(resolveTrustedPublicOrigin(request({ host: "staging.ikimon.life" })), "https://staging.ikimon.life");

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

test("unsigned Worker marker is presentation-only and forwarded proto is never trusted", () => {
  const workerHop = {
    host: "internal-origin.invalid",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "staging.ikimon.life",
  };

  for (const forwardedProto of ["http", "javascript", "https,http"]) {
    const req = request({ ...workerHop, "x-forwarded-proto": forwardedProto });
    assert.equal(resolveTrustedPublicOrigin(req), null);
    assert.equal(resolvePresentationPublicOrigin(req), "https://staging.ikimon.life");
  }

  for (const forwardedHost of [
    "ikimon.life.attacker.example",
    "staging.ikimon.life.attacker.example",
    "attacker-ikimon.life",
    "ikimon.life,attacker.example",
  ]) {
    assert.equal(
      resolvePresentationPublicOrigin(request({
        host: "internal-origin.invalid",
        "x-ikimon-cloudflare-fallback": "origin",
        "x-forwarded-host": forwardedHost,
      })),
      null,
      forwardedHost,
    );
  }
});

test("same-origin auth checks ignore unsigned marker and forwarded identity", () => {
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

  const unsignedWorkerHop = request({
    host: "internal-origin.invalid",
    origin: "https://staging.ikimon.life",
    "x-ikimon-cloudflare-fallback": "origin",
    "x-forwarded-host": "staging.ikimon.life",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(unsignedWorkerHop), /same_origin_required/);

  const unmarkedWorkerHop = request({
    host: "internal-origin.invalid",
    origin: "https://staging.ikimon.life",
    "x-forwarded-host": "staging.ikimon.life",
    "sec-fetch-site": "same-origin",
  });
  assert.throws(() => assertSameOriginRequest(unmarkedWorkerHop), /same_origin_required/);
});
