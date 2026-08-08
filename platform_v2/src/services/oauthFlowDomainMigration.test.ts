import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { oauthRedirectUri } from "./oauthFlow.js";

function request(headers: Record<string, string>, protocol = "http"): FastifyRequest {
  return { headers, protocol } as FastifyRequest;
}

test("OAuth callback URI follows the actual trusted canonical ZUKAN host", () => {
  const production = request({ host: "zukan.earth", "x-forwarded-proto": "http" });
  assert.equal(
    oauthRedirectUri(production, "google"),
    "https://zukan.earth/oauth_callback.php?provider=google",
  );
  assert.equal(
    oauthRedirectUri(production, "twitter"),
    "https://zukan.earth/auth/oauth/twitter/callback",
  );

  const staging = request({ host: "staging.zukan.earth", "x-forwarded-proto": "http" });
  assert.equal(
    oauthRedirectUri(staging, "google"),
    "https://staging.zukan.earth/oauth_callback.php?provider=google",
  );
});

test("legacy OAuth callback URIs remain host-bound during rollback-compatible migration", () => {
  assert.equal(
    oauthRedirectUri(request({ host: "ikimon.life" }), "google"),
    "https://ikimon.life/oauth_callback.php?provider=google",
  );
  assert.equal(
    oauthRedirectUri(request({ host: "staging.ikimon.life" }), "twitter"),
    "https://staging.ikimon.life/auth/oauth/twitter/callback",
  );
});

test("bound runtime origin outranks spoofed Host for canonical and legacy hosts", () => {
  assert.equal(
    oauthRedirectUri(request({
      host: "ikimon.life",
      "x-ikimon-runtime-public-origin": "https://zukan.earth",
      "x-forwarded-host": "evil.example",
    }), "google"),
    "https://zukan.earth/oauth_callback.php?provider=google",
  );
  assert.equal(
    oauthRedirectUri(request({
      host: "zukan.earth",
      "x-ikimon-runtime-public-origin": "https://staging.ikimon.life",
      "x-forwarded-host": "staging.zukan.earth",
    }), "twitter"),
    "https://staging.ikimon.life/auth/oauth/twitter/callback",
  );
});
